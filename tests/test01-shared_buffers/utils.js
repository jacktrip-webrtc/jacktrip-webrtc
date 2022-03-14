/**
 * Gastaldi Paolo
 * 27/042021
 */
'use strict';

let consolelog_count = new Int16Array(1);
consolelog_count[0] = 0;

function consolelog(value) {
    const prev_val = Atomics.add(consolelog_count, 0, 1);
    console.log(prev_val);
    console.log(value);
}