'use strict';

import { Int16ToFloat32, Float32ToInt16 } from './convert.js';
import PacketManager from './packet-manager.js';

/**
 * circular buffer class for a single audio channel
 * w/ SharedArrayBuffer
 * 
 * @author Sacchetto Matteo
 * @author Gastaldi Paolo
 */
class AudioCircularBufferSingle {
    /**
      * class constructor
      * @param {Object} config
      *     manage many configuration parameters:
      *         - {Number} windowSize
      *         - {Number} queueSize 
      *         - {BigInt} queueMask
      * @param {Object} transferred
      *     share buffers with another object
      * @param {Number} channelIndex
      * @param {...any} args
      *     - [0]: log
      */
    constructor(config={}, transferred=null, channelIndex, ...args) {
        this.config = config;

        this.windowSize = config.windowSize || 128;
        this.queueSize = config.queueSize || 32;
        this.queueMask = config.queueMask || BigInt(this.queueSize-1);
        this.channelIndex = channelIndex || 0;

        this.log = args[0] || false;

        if(this.log) console.log(`AudioCircularBufferSingle, logging enabled`);

        // create basic structures
        if(transferred) {
            if(this.log) console.log('AudioCircularBuffer, transferred buffer');
            for(let key in transferred) this[key] = transferred[key]; // copy all values
        }
        else {
            if(this.log) console.log('AudioCircularBuffer, brand new buffer');
            this._queueBuffers = [];
            for(let i=0; i<this.queueSize; i++) {
                // using Int32Array
                // summing Int16 samples, so more space is needed to avoid overflow
                // samples scaling only once at the end (see dequeue)
                let buffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * this.windowSize);
                let dw = new DataView(buffer);
                for(let k=0; k<this.windowSize; k++)
                    dw.setInt32(k, 0); // to be sure only
                this._queueBuffers.push(buffer);
            }
        }

        // create queues
        this._queues = [];
        for(let i=0; i<this.queueSize; i++)
            this._queues.push(new Int32Array(this._queueBuffers[i]));

        // things you can compute only once (let's save same runtime effort!)
        this.packetBufferOffsetWithoutHeader = this.channelIndex * this.windowSize;
        this.packetBufferOffset = PacketManager.headerSize / Int16Array.BYTES_PER_ELEMENT + this.packetBufferOffsetWithoutHeader; // update for multi-channel
        if(PacketManager.headerSize % Int16Array.BYTES_PER_ELEMENT != 0) // safety check on byte alignment
            throw new Exception('Invalid sample size between packet and circular buffer');

        // function renaming
        this.share = this.transfer;
        this.push = this.enqueue;
        this.pop = this.dequeue;
        this.getNext = this.dequeue;

        if(this.log) console.log(`packetBufferOffset: ${this.packetBufferOffset}`);
    }

    /**
     * transfer inner buffers to create another object working on the same data
     * @returns {Object}
     *      inner buffers
     */
     transfer() {
        return {
            _queueBuffers: this._queueBuffers,
            windowSize: this.windowSize,
            queueSize: this.queueSize,
            queueMask: this.queueMask,
            _myIndex: this.channelIndex
        };
    }

    /**
     * add data to queue
     * IMPORTANT: this function uses direct buffer access
     * it works if the trasmission is done w/ little endian values
     * little endian flag MUST be explicited during packet creation
     * @param {Int16Array} input
     *      packet
     * @param {Number} queueIndex
     * @param {String} envelop
     *      (optional)
     * @param {Boolean} isInputInt16
     *      (optional)
     * @param {Boolean} hasPacketHeader
     *      (optional)
     * @param {...any} args
     */
     enqueue(input, queueIndex, envelop=null, isInputInt16=true, hasPacketHeader=true, ...args) {
        // let initFade = 1.;
        // let fadeStep = 0.;

        // // fade-in or fade-out option
        // if(this.log) if(envelop) console.log(`AudioCircularBuffer.enqueue, envelop ${envelop}`);
        // if(envelop == 'fade in') {
        //     initFade = 0.;
        //     fadeStep = 1./this.windowSize;
        // }
        // else if(envelop == 'fade out') {
        //     initFade = 1.;
        //     fadeStep = -1./this.windowSize;
        // }

        // let k = hasPacketHeader ? this.packetBufferOffset : this.packetBufferOffsetWithoutHeader;
        let k = hasPacketHeader ? this.packetBufferOffset : 0n;

        // insert into circular buffer
        if(isInputInt16) // single check at the beginning, less effort
            // for(let i=0, fade=initFade; i<this.windowSize; i++, k++, fade+=fadeStep)
                // Atomics.add(this._queues[queueIndex], i, input[k] * fade);
            for(let i=0; i<this.windowSize; i++, k++)
                Atomics.add(this._queues[queueIndex], i, input[k]);
        else
            // for(let i=0, fade=initFade; i<this.windowSize; i++, k++, fade+=fadeStep)
                // Atomics.add(this._queues[queueIndex], i, Float32ToInt16(input[k]) * fade);
            for(let i=0; i<this.windowSize; i++, k++)
                Atomics.add(this._queues[queueIndex], i, Float32ToInt16(input[k]));
    }

    /**
     * extract an element from the queue
     * @param {Float32Array} output
     *      output vector
     * @param {Number} queueIndex
     * @param {Number} scaleFactor
     * @param {Number} scaleFactorStep
     * @param {Boolean} isOutputInt16
     * @param {Boolean} hasPacketHeader
     * @param {...any} args
     */
    dequeue(output, queueIndex, scaleFactor=1., scaleFactorStep=0., isOutputInt16=false, hasPacketHeader=false, ...args) {
        let k = hasPacketHeader ? this.packetBufferOffset : 0;

        if(!isOutputInt16) // single check at the beginning, less effort
            for(let i=0; i<this.windowSize; i++, k++, scaleFactor+=scaleFactorStep)
                // steps:
                //     1- reading a Int32 sample
                //     2- scaling by scaleFactor, so it is reduced to a Int16 sample
                //     3- converted to Float32 sample
                //     4- reset sample value to 0 at the same time
                // NOTE THIS: Atomics.exchange: returns the old value, Atomics.store: returns the new value
                output[k] = Int16ToFloat32(Atomics.exchange(this._queues[queueIndex], i, 0) * scaleFactor);
        else
            for(let i=0; i<this.windowSize; i++, k++, scaleFactor+=scaleFactorStep)
                output[k] = Atomics.exchange(this._queues[queueIndex], i, 0) * scaleFactor;
    }

    /**
     * erase the audio window at that index
     * @param {Number} queueIndex
     */
     eraseAt(queueIndex) {
        for(let i=0; i<this.windowSize; i++)
            Atomics.store(this._queues[queueIndex], i, 0);
    }

    /**
     * free resources (if allocated)
     */
    destroy() {
        // nothing to do...
    }
}

/**
 * circular buffer class
 * w/ SharedArrayBuffer
 * new architecture for the circular buffer
 * this class includes some audio-specific functionalities related to PacketManager class
 * 
 * @author Sacchetto Matteo
 * @author Gastaldi Paolo
 */
class AudioCircularBuffer {
    /**
      * class constructor
      * @param {Object} config
      *     manage many configuration parameters:
      *         - {Number} windowSize
      *         - {Number} queueSize 
      * @param {Object} transferred
      *     share buffers with another object
      * @param {Boolean} isDataSource
      * @param {...any} args
      *     - [0]: log
      *     - [1]: balancedOffset
      */
    constructor(config={}, transferred=null, isDataSource=true, ...args) {
        this.config = config;
        
        this.windowSize = config.windowSize || 128;
        this.queueSize = config.queueSize || 32;
        this.queueMask = config.queueMask || BigInt(this.queueSize-1);
        this.nChannels = config.nChannels || 1;

        this.log = args[0] || false;

        // enable a set of functionalities for packet offset and long pause recover
        // see enqueue() for more details
        this.balancedOffset = args[1] != undefined ? args[1] : config.balancedOffset;
        this.packet_nOffset = null;
        this.discardedPackets = 0;

        if(this.log) console.log(`AudioCircularBuffer, logging enabled`);

        this._singleBuffers = [];

        // create basic structures
        if(transferred) {
            for(let key in transferred) this[key] = transferred[key]; // copy all values

            // create a single channel buffer for each channel
            if(this.log) console.log('AudioCircularBuffer, transferred single buffers');
            for(let channelIndex=0; channelIndex<this.nChannels; channelIndex++)
                this._singleBuffers.push(new AudioCircularBufferSingle(config, this._singleBuffersTransferred[channelIndex], channelIndex, this.log));
        }
        else {
            // create a single channel buffer for each channel
            if(this.log) console.log('AudioCircularBuffer, brand new single buffers');
            for(let i=0; i<this.nChannels; i++)
                this._singleBuffers.push(new AudioCircularBufferSingle(config, null, i, this.log));
            
            // keep track of how many instances of this class are inserting data
            this._nDataSourceBuffer = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT); // max number of peers = 2^32
            new DataView(this._nDataSourceBuffer).setUint32(0, 0);

            // keep track of the latest packet enqueued
            this._latestPacket_nEnqueuedBuffer = new SharedArrayBuffer(BigUint64Array.BYTES_PER_ELEMENT);
            new DataView(this._latestPacket_nEnqueuedBuffer).setBigUint64(0, 0n, true);

            // keep track of the latest packet dequeued
            this._latestPacket_nDequeuedBuffer = new SharedArrayBuffer(BigUint64Array.BYTES_PER_ELEMENT);
            new DataView(this._latestPacket_nDequeuedBuffer).setBigUint64(0, 0n, true);

            // keep track of how many packets have been written per each buffer position
            this._nWrittenPacketPerIndexBuffer = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * this.queueSize);
            let dw = new DataView(this._nWrittenPacketPerIndexBuffer);
            for(let k=0; k<this.queueSize; k++)
                dw.setUint32(Uint32Array.BYTES_PER_ELEMENT * k, 0); // just to be sure

            // keep track of the packet number per each buffer position
            // for testing only
            this._packet_nBuffer = new SharedArrayBuffer(BigUint64Array.BYTES_PER_ELEMENT * this.queueSize);
            dw = new DataView(this._packet_nBuffer);
            for(let k=0; k<this.queueSize; k++)
                dw.setBigUint64(BigUint64Array.BYTES_PER_ELEMENT * k, 0n);
        }

        // keep track of how many data source workers can write data into the queue
        this.nDataSource = new Uint32Array(this._nDataSourceBuffer);
        this._currentNDataSource = this.nDataSource; // used to avoid discontinuities when new peers connect/disconnect
        this.isDataSource = isDataSource;
        if(this.isDataSource)
            Atomics.add(this.nDataSource, 0, 1);

        // keep track of the next and the latest packet_n enqueued
        this.latestPacket_nEnqueued = new BigUint64Array(this._latestPacket_nEnqueuedBuffer); // shared
        this.latestPacket_nDequeued = new BigUint64Array(this._latestPacket_nDequeuedBuffer);; // shared

        // things you can compute only once (let's save same runtime effort!)
        this.packetBufferOffset = PacketManager.headerSize / Int16Array.BYTES_PER_ELEMENT;
        if(PacketManager.headerSize % Int16Array.BYTES_PER_ELEMENT != 0) // safety check on byte alignment
            throw new Exception('Invalid sample size between packet and circular buffer');

        this.nWrittenPacketPerIndex = new Uint32Array(this._nWrittenPacketPerIndexBuffer);
        this.packet_nAry = new BigUint64Array(this._packet_nBuffer);

        // function renaming
        this.share = this.transfer;
        this.push = this.enqueue;
        this.pop = this.dequeue;
        this.getNext = this.dequeue;

        this._localEnqueuePacket_n = 0n;
    }

    /**
     * transfer inner buffers
     * @returns {Object}
     *      inner buffers
     */
    transfer() {
        return {
            _singleBuffersTransferred:      this._singleBuffers.map(b => b.transfer()), // data from single channel buffers
            _nDataSourceBuffer:             this._nDataSourceBuffer,
            _latestPacket_nEnqueuedBuffer:  this._latestPacket_nEnqueuedBuffer,
            _latestPacket_nDequeuedBuffer:  this._latestPacket_nDequeuedBuffer,
            windowSize:                     this.windowSize,
            queueSize:                      this.queueSize,
            queueMask:                      this.queueMask,
            _nWrittenPacketPerIndexBuffer:  this._nWrittenPacketPerIndexBuffer,
            _packet_nBuffer:                this._packet_nBuffer, // for testing only
            balancedOffset:                 this.balancedOffset,
        }; 
    }

    /**
     * manage packet offset before enqueue
     * @param {Object} packet 
     */
    _updatePacket_n(packet) {
        if(!this.packet_nOffset) { // set at runtime for better sync
            this.packet_nOffset = - packet.packet_n + // first packet = zero packet
                Atomics.load(this.latestPacket_nDequeued, 0) +
                this.config.circularBufferOffset;
            if(this.log)
                console.log(`packet_nOffset = ${this.packet_nOffset} =
                    ${- packet.packet_n} + 
                    ${Atomics.load(this.latestPacket_nDequeued, 0)} +
                    ${this.config.circularBufferOffset}`);
        }
        packet.packet_n += this.packet_nOffset;
    }

    /**
     * add data to queue
     * @param {Int16Array|Float32Array} packet
     * @param {String} isLast
     * @param {Boolean} isInputInt16
     * @param {Boolean} hasPacketHeader
     * @param {...any} args
     * @returns {Number}
     *      0 if okay, -1 if packet discarded
     */
    enqueue(packet, envelop=null, isInputInt16=true, hasPacketHeader=true, ...args) {
        packet.packet_n = packet.packet_n || this._localEnqueuePacket_n++;
        packet.source = packet.source || { channelCount: this.channelCount };
        if(this.balancedOffset)
            this._updatePacket_n(packet);

        let _latestPacket_nDequeued = Atomics.load(this.latestPacket_nDequeued, 0);

        // for testing only
        if(this.log) console.log('enqueue packet.packet_n', packet.packet_n, '_latestPacket_nDequeued', _latestPacket_nDequeued);

        // safety check
        if(Math.abs(Number(packet.packet_n - _latestPacket_nDequeued)) >= this.queueSize) {
            if(this.log || this.config.logDiscardedPackets) console.error(`AudioCircularBuffer.enqueue: packet too late or too early for this index, discarded ${packet.packet_n}/${_latestPacket_nDequeued}`);
            if(this.balancedOffset) {
                if(++this.discardedPackets > this.queueSize) {
                    this.packet_nOffset = null; // resync is needed!
                    if(this.log) console.error(`AudioCircularBuffer, too many packets lost, reset packet offset`);
                }
            }
            return -1; // signal this packet has been discarded
        }
        // else
        this.discardedPackets = 0;

        // computer buffer index
        let queueIndex = Number(packet.packet_n % this.queueMask);

        // enqueue single channel
        if(hasPacketHeader)
            this._singleBuffers.forEach((b, i) => b.enqueue(packet.buffer, queueIndex, envelop, isInputInt16, hasPacketHeader, args));
        else
            this._singleBuffers.forEach((b, i) => b.enqueue(packet.buffer[i], queueIndex, envelop, isInputInt16, hasPacketHeader, args));

        // keep track of the inserted packet
        Atomics.add(this.nWrittenPacketPerIndex, queueIndex, 1);

        // record that data are available for dequeue
        if(Atomics.load(this.latestPacket_nEnqueued, 0) < packet.packet_n) // Atomics.compareExchange cannot be used in this case
            Atomics.store(this.latestPacket_nEnqueued, 0, packet.packet_n);

        // for testing only
        Atomics.add(this.packet_nAry, queueIndex, packet.packet_n); // keep track of the packet number
    }

    /**
     * create a fade for the scale factor when the number of inputs changes
     * @param {Number} queueIndex
     * @deprecated
     */
     _generateAutoFade(queueIndex) {
        // scaleFactor this MUST be computed a runtime, sorry. But only 1 division for all samples ;)
        let tmpNDataSource = Math.max(Atomics.load(this.nDataSource, 0), 1); // read only once, the value can change in the meantime
        let scaleFactor = 1. / tmpNDataSource;
        let scaleFactorStep = 0.;

        // for testing only
        if(this.log) {
            let _latestPacket_nEnqueued = Atomics.load(this.latestPacket_nEnqueued, 0);
            let _latestPacket_nDequeued = Atomics.load(this.latestPacket_nDequeued, 0);
            console.log(`indexes distance = ${Number(_latestPacket_nEnqueued - _latestPacket_nDequeued)}`);
        }

        // reset the value
        let nWrittenPacketHere = Atomics.exchange(this.nWrittenPacketPerIndex, queueIndex, 0);

        // for testing only
        let _packet_n = Atomics.load(this.packet_nAry, queueIndex);
        if(nWrittenPacketHere != tmpNDataSource) // notify if not corresponding
            if(this.log) console.error(`AudioCircularBuffer.dequeue, ${nWrittenPacketHere}/${tmpNDataSource}, packet_n = ${_packet_n}`);

        return { scaleFactor, scaleFactorStep };
    }

    /**
     * extract an element from the queue
     * @param {Int16Array|Float32Array} output
     *      output vector, can have many channels
     * @param {Boolean} isOutputInt16
     * @param {Boolean} hasPacketHeader
     * @param {...any} args
     */
    dequeue(output, isOutputInt16=false, hasPacketHeader=false, ...args) {
        let queueIndex = Number(Atomics.add(this.latestPacket_nDequeued, 0, 1n) % this.queueMask);

        let { scaleFactor, scaleFactorStep } = this._generateAutoFade(queueIndex);

        // extract data for each channel
        if(hasPacketHeader)
            for(let i=0; i<this.nChannels; i++)
                this._singleBuffers.forEach((b, i) => b.dequeue(output, queueIndex, scaleFactor, scaleFactorStep, isOutputInt16, hasPacketHeader, args));
        else
            for(let i=0; i<this.nChannels; i++)
                this._singleBuffers.forEach((b, i) => b.dequeue(output[i], queueIndex, scaleFactor, scaleFactorStep, isOutputInt16, hasPacketHeader, args));

        // if the index is more the queue size the whole buffer is not working correctly
        let _latestPacket_nEnqueued = Atomics.load(this.latestPacket_nEnqueued, 0);
        let _latestPacket_nDequeued = Atomics.load(this.latestPacket_nDequeued, 0);
        if(Number(_latestPacket_nEnqueued - _latestPacket_nDequeued) > this.queueSize)
            if(this.log) console.error(`AudioCircularBuffer: not scaling index: ${_latestPacket_nEnqueued}/${_latestPacket_nDequeued}`);
        
        // for testing only
        let _packet_nDequeued = Atomics.exchange(this.packet_nAry, queueIndex, 0n);
        if(this.log) console.log(`packet ${_packet_nDequeued} dequeued @ index ${queueIndex}`);
    }

    /**
     * erase the next position in the buffer and increment the dequeue index
     */
    eraseNext() {
        let queueIndex = Number(Atomics.load(this.latestPacket_nDequeued, 0) % this.queueMask);
        
        // erase data for each channel
        this._singleBuffers.forEach((b) => b.eraseAt(queueIndex));
        Atomics.store(this.nWrittenPacketPerIndex, queueIndex, 0); // reset

        Atomics.add(this.latestPacket_nDequeued, 0, 1n);
    }

    /**
     * check if data can be extracted from queue
     * @returns {Number} hasData
     *      index distances if has data, 0 otherwise (no negative values)
     */
    hasData() {
        return Math.max(Number(Atomics.load(this.latestPacket_nEnqueued, 0) - Atomics.load(this.latestPacket_nDequeued, 0)), 0);
    }

    /**
     * free resources (if allocated)
     */
    destroy() {
        if(this.isDataSource) // remove from count only if it is data source
            Atomics.sub(this.nDataSource, 0, 1);
    }
}

export default AudioCircularBuffer;