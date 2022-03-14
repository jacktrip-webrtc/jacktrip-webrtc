/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* A "Synchronic" object represents an atomic cell as a JS object with
 * methods that can block waiting for the cell to change value.
 *
 * For motivation, see:
 * http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2014/n4195.pdf
 * https://code.google.com/p/synchronic/
 */

"use strict";

/* Synchronic API
 * --------------
 *
 * The Synchronic constructors are type specific.  To construct a
 * Synchronic Int32 object do:
 *
 *   new SynchronicInt32(sab, index)
 *
 * where "sab" is a SharedArrayBuffer and "index" is a byte index within
 * sab that is divisible by (in this case) SynchronicInt32.BYTE_ALIGNMENT.
 *
 * Similarly for Int8, Uint8, Int16, Uint16, Uint32, Float32, Float64.
 *
 * Each constructor function has a property BYTES_PER_ELEMENT, which
 * denotes the number of bytes in the SharedArrayBuffer that MUST be
 * reserved for a Synchronic of the given type.  This value includes
 * any padding and control words; the memory required for an array of
 * Synchronic objects is thus the length of the array times the
 * BYTES_PER_ELEMENT value for the base type.
 *
 * The memory covered by the Synchronic MUST be zero-filled before the
 * synchronic is constructed on it, and that zero-filling MUST be
 * observable in the constructing agent when the constructor is
 * called.
 *
 * Each constructor function has a property BYTE_ALIGNMENT, which
 * denotes the required alignment for a Synchronic of the base type.
 *
 * One may assume that BYTES_PER_ELEMENT is some integer multiple of
 * BYTE_ALIGNMENT.
 *
 * Do not construct synchronics of different base type on the same
 * memory.
 *
 * All Synchronic objects have the following value manipulation
 * methods (all are atomic and mirror their counterparts on the
 * Atomics object):
 *
 * - load() retrieves the current value of the object
 * - store(v) stores v in the object
 * - compareExchange(o, n) stores n in the object if its current
 *   value c is equal to o, and in any case returns c
 * - add(v) adds v to the object and returns the old value
 * - sub(v) subtracts v from the object and returns the old value
 * - exchange(v) stores v in the object and returns the old value
 * - isLockFree() returns true if the synchronic is lock free
 *
 * Integer objects additionally have these methods:
 *
 * - and(v) bitwise-ands v into the object and returns the old value
 * - or(v) bitwise-ors v into the object and returns the old value
 * - xor(v) bitwise-xors v into the object and returns the old value
 *
 * Finally, objects have methods that wait for and signal events:
 *
 * - loadWhenEqual(x) waits until the value in the object is observed
 *   to be x, this could be immediately.  It then returns the value in
 *   the cell (which may no longer be x).
 *
 * - loadWhenNotEqual(x) waits until the value in the object is
 *   observed to be other than x, this could be immediately.  It then
 *   returns the value in the cell (which may once again be x).
 *
 * - expectUpdate(x, t) waits until the value in the cell may no
 *   longer be x - this could be immediately - or t milliseconds have
 *   passed.  It returns nothing.
 *
 * - notify() asks all waiters to re-check their waiting conditions.
 *
 * The methods that store values in the object will send notifications
 * as appropriate, there is rarely a need to call notify().
 *
 * Synchronization:
 *
 * - The methods that load are: loadWhenEqual(), loadWhenNotEqual(),
 *   load(), expectUpdate(), add(), sub(), and(), or(), xor(),
 *   compareExchange(), and exchange().
 *
 * - The methods that store are: store(), notify(), add(), sub(), and(),
 *   or(), xor(), compareExchange(), and exchange().
 *
 * - A call that stores into a synchronic S synchronizes-with
 *   temporally succeeding calls that load from S.
 *
 *
 * TODO:
 *
 *  - We /might/ need the updating methods to take a hint about how
 *    many waiters to wake.  The C++ proposal has none/one/all.  But
 *    hints are not great for JS - we'd like something binding, or
 *    nothing at all.
 */

/*
 * At present, all Synchronic objects are 16 bytes divided into four
 * words as follows:
 *
 *  - the number of waiters
 *  - the wait word, a generation number used for wait / wake
 *  - first value word
 *  - second value word
 *
 * Integer types less than 32 bits use part of the first value word.
 * Only Float64 uses the second value word.
 *
 * The wait word is a little more complex for floating types, see
 * later.
 */
const _SYN_SYNSIZE = 16;
const _SYN_SYNALIGN = 8;

const _SYN_NUMWAIT = 0;
const _SYN_WAITGEN = 1;

const _Synchronic_int_methods =
{
    isLockFree: function () {
	    return true;
    },

    load: function () {
	    return Atomics.load(this._ta, this._taIdx);
    },

    store: function (value) {
        Atomics.store(this._ta, this._taIdx, value);
        this._notify();
    },

    compareExchange: function (oldval, newval) {
        var v = Atomics.compareExchange(this._ta, this._taIdx, oldval, newval);
        if (v == oldval)
            this._notify();
        return v;
    },

    add: function (value) {
        const v = Atomics.add(this._ta, this._taIdx, value);
        this._notify();
        return v;
    },

    sub: function (value) {
        const v = Atomics.sub(this._ta, this._taIdx, value);
        this._notify();
        return v;
    },

    and: function (value) {
        const v = Atomics.and(this._ta, this._taIdx, value);
        this._notify();
        return v;
    },

    or: function (value) {
        const v = Atomics.or(this._ta, this._taIdx, value);
        this._notify();
        return v;
    },

    xor: function (value) {
        const v = Atomics.xor(this._ta, this._taIdx, value);
        this._notify();
        return v;
    },

    exchange: function (value) {
        // No Atomics.exchange() operator yet.
        do {
            var v = Atomics.load(this._ta, this._taIdx);
        } while (Atomics.compareExchange(this._ta, this._taIdx, v, value) != v);
        this._notify();
        return v;
    },

    loadWhenNotEqual: function (value_) {
        var value = this._coerce(value_);
        for (;;) {
            var tag = Atomics.load(this._ia, this._iaIdx+_SYN_WAITGEN);
            var v = Atomics.load(this._ta, this._taIdx) ;
            if (v !== value)
            break;
            this._waitForUpdate(tag, Number.POSITIVE_INFINITY);
        }
        return v;
    },

    loadWhenEqual: function (value_) {
        var value = this._coerce(value_);
        for (;;) {
            var tag = Atomics.load(this._ia, this._iaIdx+_SYN_WAITGEN);
            var v = Atomics.load(this._ta, this._taIdx) ;
            if (v === value)
            break;
            this._waitForUpdate(tag, Number.POSITIVE_INFINITY);
        }
        return v;
    },

    expectUpdate: function (value_, timeout_) {
        var value = this._coerce(value_);
        var timeout = +timeout_;
        var now = this._now();
        var limit = now + timeout;
        for (;;) {
            var tag = Atomics.load(this._ia, this._iaIdx+_SYN_WAITGEN);
            var v = Atomics.load(this._ta, this._taIdx) ;
            if (v !== value || now >= limit)
            break;
            this._waitForUpdate(tag, limit - now);
            now = this._now();
        }
    },

    notify: function() {
	    this._notify();
    },

    _waitForUpdate: function (tag, timeout) {
        // Spin for a short time before going into the wait.
        //
        // Hard to know what a good count should be - it is machine
        // dependent, for sure, and "typical" applications should
        // influence the choice.  If the count is high without
        // hindering an eventual drop into wait then it will just
        // decrease performance.  If the count is low it is pointless.
        // (This is why Synchronic really wants a native implementation.)
        //
        // Data points from a 2.6GHz i7 MacBook Pro:
        //
        // - the simple send-integer benchmark (test-sendint.html),
        //   which is the very simplest case we can really imagine,
        //   gets noisy timings with an iteration count below 4000
        //
        // - the simple send-object benchmark (test-sendmsg.html)
        //   gets a boost when the count is at least 10000
        //
        // 10000 is perhaps 5us (CPI=1, naive) and seems like a
        // reasonable cutoff, for now - but note, it is reasonable FOR
        // THIS SYSTEM ONLY, which is a big flaw.
        //
        // The better fix might well be to add some kind of spin/nanosleep
        // functionality to wait, see https://bugzil.la/1134973.
        // That functionality can be platform-dependent and even
        // adaptive, with JIT support.
        var i = 10000;
        do {
            // May want this to be a relaxed load, though on x86 it won't matter.
            if (Atomics.load(this._ia, this._iaIdx+_SYN_WAITGEN) != tag)
            return;
        } while (--i > 0);
        Atomics.add(this._ia, this._iaIdx+_SYN_NUMWAIT, 1);
        Atomics.wait(this._ia, this._iaIdx+_SYN_WAITGEN, tag, timeout);
        Atomics.sub(this._ia, this._iaIdx+_SYN_NUMWAIT, 1);
    },

    _notify: function () {
        Atomics.add(this._ia, this._iaIdx+_SYN_WAITGEN, 1);
        // Would it be appropriate & better to wake n waiters, where n
        // is the number loaded in the load()?  I almost think so,
        // since our futexes are fair.
        if (Atomics.load(this._ia, this._iaIdx+_SYN_NUMWAIT) > 0)
            Atomics.wake(this._ia, this._iaIdx+_SYN_WAITGEN, Number.POSITIVE_INFINITY);
    },

    _now: (typeof 'performance' != 'undefined' && typeof performance.now == 'function'
	   ? performance.now.bind(performance)
	   : Date.now.bind(Date))
};

/*
 * For floating types use spinlocks, since we have no Atomics.
 *
 * Float32 and Float64 use the same spinlocked code since the Float32
 * code using Atomics would otherwise have to transfer the value
 * through memory, it seems like overkill to specialize for that at
 * this point.
 *
 * This uses the same layout as the int code, with the following
 * tweak: the wait word (_SYN_WAITGEN) has two fields, the low bit is
 * the spinlock bit and the high 31 bits are the generation number.
 */
const _Synchronic_float_methods =
{
    isLockFree: function () {
	    return false;
    },

    load: function () {
        this._acquire();
        var v = this._ta[this._taIdx];
        this._release();
        return v;
    },

    store: function (value_) {
        var value = +value_;
        this._acquire();
        this._ta[this._taIdx] = value;
        this._release();
        this._notify();
    },

    compareExchange: function (oldval_, newval_) {
        var oldval = +oldval_;
        var newval = +newval_;
        this._acquire();
        var v = this._ta[this._taIdx];
        if (this._equals(oldval, v)) {
            this._ta[this._taIdx] = newval;
            this._release();
            this._notify();
        }
        else
            this._release();
        return v;
    },

    add: function (value_) {
        var value = +value_;
        this._acquire();
        var oldval = this._ta[this._taIdx];
        this._ta[this._taIdx] = oldval + value;
        this._release();
        this._notify();
        return oldval;
    },

    sub: function (value_) {
        var value = +value_;
        this._acquire();
        var oldval = this._ta[this._taIdx];
        this._ta[this._taIdx] = oldval - value;
        this._release();
        this._notify();
        return oldval;
    },

    exchange: function (value_) {
        var value = +value_;
        this._acquire();
        var oldval = this._ta[this._taIdx];
        this._ta[this._taIdx] = value;
        this._release();
        this._notify();
        return oldval;
    },

    loadWhenNotEqual: function (value_) {
        const value = +value_;
        for (;;) {
            var tag = Atomics.load(this._ia, this._iaIdx+_SYN_WAITGEN);
            this._acquire();
            var v = this._ta[this._taIdx];
            this._release();
            if (!(this._equals(v, value)))
            break;
            this._waitForUpdate(tag, Number.POSITIVE_INFINITY);
        }
        return v;
    },

    loadWhenEqual: function (value_) {
        const value = +value_;
        for (;;) {
            var tag = Atomics.load(this._ia, this._iaIdx+_SYN_WAITGEN);
            this._acquire();
            var v = this._ta[this._taIdx];
            this._release();
            if (this._equals(v, value))
            break;
            this._waitForUpdate(tag, Number.POSITIVE_INFINITY);
        }
        return v;
    },

    expectUpdate: function (value_, timeout_) {
        var value = +value_;
        var timeout = +timeout_;
        var now = this._now();
        var limit = now + timeout;
        for (;;) {
            var tag = Atomics.load(this._ia, this._iaIdx+_SYN_WAITGEN);
            this._acquire();
            var v = this._ta[this._taIdx];
            this._release();
            if (!this._equals(v, value) || now >= limit)
            break;
            this._waitForUpdate(tag, limit - now);
            now = this._now();
        }
    },

    notify: function () {
        this._notify();
    },

    _equals: function (v, w) {
	    return v == w || isNaN(v) && isNaN(w);
    },

    _acquire: function () {
        while ((Atomics.or(this._ia, this._iaIdx+_SYN_WAITGEN, 1) & 1) == 1)
            ;
    },

    _release: function () {
	    Atomics.xor(this._ia, this._iaIdx+_SYN_WAITGEN, 1);
    },

    _waitForUpdate: function (tag, timeout) {
        // similar spin optimization as the integer case.
        var i = 10000;
        do {
            // May want this to be a relaxed load, though on x86 it won't matter.
            if (Atomics.load(this._ia, this._iaIdx+_SYN_WAITGEN) != tag)
            return;
        } while (--i > 0);

        Atomics.add(this._ia, this._iaIdx+_SYN_NUMWAIT, 1);
        Atomics.wait(this._ia, this._iaIdx+_SYN_WAITGEN, tag, timeout);
        Atomics.sub(this._ia, this._iaIdx+_SYN_NUMWAIT, 1);
    },

    _notify: function () {
	Atomics.add(this._ia, this._iaIdx+_SYN_WAITGEN, 2);
        if (Atomics.load(this._ia, this._iaIdx+_SYN_NUMWAIT) > 0)
            Atomics.wake(this._ia, this._iaIdx+_SYN_WAITGEN, Number.POSITIVE_INFINITY);
    },

    _now: (typeof 'performance' != 'undefined' && typeof performance.now == 'function'
	   ? performance.now.bind(performance)
	   : Date.now.bind(Date))
};

const _Synchronic_constructor = function (constructor, methods) {
    var tag = "";

    const _coerce_int = function (v) { return v|0; }
    const _coerce_uint = function (v) { return v>>>0; }

    switch (constructor) {
        case Int8Array:    tag = "int8"; break;
        case Uint8Array:   tag = "uint8"; break;
        case Int16Array:   tag = "int16"; break;
        case Uint16Array:  tag = "uint16"; break;
        case Int32Array:   tag = "int32"; break;
        case Uint32Array:  tag = "uint32"; break;
        case Float32Array: tag = "float32"; break;
        case Float64Array: tag = "float64"; break;
        default:                 throw new Error("Invalid constructor for Synchronic: " + constructor);
    }

    const taName = "_synchronic_" + tag + "_view";

    const makeSynchronicType = function (sab, offset) {
        offset = offset|0;
        if (!(sab instanceof SharedArrayBuffer))
            throw new Error("Synchronic not onto SharedArrayBuffer");
        if (offset < 0 || (offset & (_SYN_SYNALIGN-1)))
            throw new Error("Synchronic at negative or unaligned index");
        if (offset + _SYN_SYNSIZE > sab.byteLength)
            throw new Error("Synchronic extends beyond end of buffer");
        if (!sab._synchronic_int32_view)
            sab._synchronic_int32_view = new Int32Array(sab);
        if (!sab[taName])
            sab[taName] = new constructor(sab);
        this._ta = sab[taName];
        this._taIdx = (offset + 8) / constructor.BYTES_PER_ELEMENT;
        this._ia = sab._synchronic_int32_view;
        this._iaIdx = offset / 4;
        this._coerce = tag == "uint32" ? _coerce_uint : _coerce_int;

        // If initialization beyond zero-fill is needed then the
        // constructor might arrange for initialization by an atomic
        // protocol where it transitions some word of the synchronic
        // from 0 -> x -> y where y is the final initialized value and
        // x signifies an intermediate state.  The constructor call
        // that succeeds in storing x performs initialization; the
        // other calls spin while the value is x.  Usefully, x would
        // be an invalid value for that field during operation, for
        // example, it could be -1 in the _SYN_NUMWAIT field.
        //
        // We have no such needs, zero-initialization is just fine.
    };

    makeSynchronicType.prototype = methods;
    makeSynchronicType.BYTES_PER_ELEMENT = _SYN_SYNSIZE;
    makeSynchronicType.BYTE_ALIGNMENT = _SYN_SYNALIGN;

    return makeSynchronicType;
}

var SynchronicInt8 = _Synchronic_constructor(Int8Array, _Synchronic_int_methods);
var SynchronicUint8 = _Synchronic_constructor(Uint8Array, _Synchronic_int_methods);
var SynchronicInt16 = _Synchronic_constructor(Int16Array, _Synchronic_int_methods);
var SynchronicUint16 = _Synchronic_constructor(Uint16Array, _Synchronic_int_methods);
var SynchronicInt32 = _Synchronic_constructor(Int32Array, _Synchronic_int_methods);
var SynchronicUint32 = _Synchronic_constructor(Uint32Array, _Synchronic_int_methods);
var SynchronicFloat32 = _Synchronic_constructor(Float32Array, _Synchronic_float_methods);
var SynchronicFloat64 = _Synchronic_constructor(Float64Array, _Synchronic_float_methods);
