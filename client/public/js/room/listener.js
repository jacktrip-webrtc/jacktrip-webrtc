'use strict';

/**
 * @author Gastaldi Paolo
 * 
 * class for listener management
 * inherit this class for listener functionalities
 * 
 * 'TODO' MUST NOT BE IMPLEMENTED, these comments are for inheritance usage only!
 */
class Listener {
    /**
     * constructor
     * @param {... any} args
     */
    constructor(args) {
        this.listeners = [];
        this.isListenersEnabled = false;
    }

    /**
     * list of accepted events
     */
    static events = { /* TODO: fill w/ your events */};

    /**
     * add one listener or a list of listeners to list
     * @param {String} event 
     * @param {Function | Array<Function>} cb 
     */
    addListener(event, cb) {
        if(typeof cb == typeof Function)
            cb = [ cb ];
        if(typeof cb == typeof [])
            cb.forEach(c =>  this.listeners.push({ event: event, cb: c }));
        else throw new Expection('Unexpected callback type');
    }

    /**
     * remove one listener or a list of listeners to list
     * @param {String} event 
     * @param {Function | Array<Function>} cb 
     */
    removeListener(event, cb) {
        if(typeof cb == typeof Function)
            cb = [ cb ];
        if(typeof cb == typeof [])
            cb.forEach(c => this.listeners = this.listeners.filter(l => !(l.event == event && l.cb == c)));
        else throw new Expection('Unexpected callback type');
    }

    /**
     * call all listeners related to a specific event
     * @param {String} event 
     * @param {Object} context
     */
    callListeners(event, context) {
        for(let listener of this.listeners)
            if(listener.event == event)
                listener.cb(context);
    }

    updateListeners() {
        console.log('Listener.updateListeners'); // TODO: remove this
        this.isListenersEnabled ? this.enableListeners() : this.disableListeners();
    }

    enableListeners() { /* TODO: listeners setup */ }
    disableListeners() { /* TODO: listeners remove */ }

    /**
     * create a new function surrounded by 2 event listener calls
     * @param {Function} fc
     *      - {...any} args
     * @param {Object} events
     *      - initEvent
     *      - endEvent
     * @param {Object} context
     *      what the event listener function refers to
     * @returns {Function} new function
     */
    wrapWithListeners(fc, { initEvent, endEvent }, context=this) {
        return (function(...args) {
            this.callListeners(initEvent, context);
            let retVal = fc(...args);
            this.callListeners(endEvent, context);
            return retVal;
        }).bind(context);
    }
}

/**
 * print a string
 * @param {String} string
 */ 
 const print = function(string) {
    return function(context, ...args) { console.log(string); }
}

/**
 * print a log
 */
const log = function() {
    return function(context, ...args) { console.log( /* TODO: fill this */ ); }
}

/**
 * start timer and print
 * @param {Object} context 
 */
const tik = function(...args) {
    return function(context, ...args) { console.log('timer started'); }
}

/**
 * stop timer and print
 * @param {Object} context
 */
const tok = function(...args) {
    return function(context, ...args) { console.log( /* TODO: fill this */ ); }
}

/**
 * create a custom function
 * it can retrieve the context at runtime
 * @param {Funtion} fc 
 * @param {...any} args 
 * @returns 
 */
const custom = function(fc, ...args) {
    return function(context, ...args2) { return fc(context, ...[args, args2]) }
}

export {
    Listener,
    print,
    log,
    tik,
    tok,
    custom,
};