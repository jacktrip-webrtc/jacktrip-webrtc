/**
 * Gastaldi Paolo
 * 09/05/2021
 * 
 * Shared buffer and atomics
 */
'use strict';

const windowSize = 128;
const sampleDepth = Float32Array.BYTES_PER_ELEMENT; // 32 bit = 4 byte

const sharedBuffer = new SharedArrayBuffer(windowSize * sampleDepth);
const floatArray = new Float32Array(sharedBuffer); // local only
const uintArray = new Uint32Array(sharedBuffer); // local only, for Atomics use

floatArray.fill(0); // buffer allocated on at first use
console.log('SharedBuffer created!');

let index = 0, newValue = 999, oldValue = 0;
// Atomics.exchange(floatArray, index, newValue); // not allowed
oldValue = Atomics.exchange(uintArray, index, newValue); // allowed

floatArray[0] = 0.1;
console.log('--- Direct insert ---');
console.log(`0x${floatArray[0].toString(16)}`);
console.log(`0x${uintArray[0].toString(16)}`);

oldValue = Atomics.exchange(uintArray, 0, 0.5);
console.log('--- Atomics.exchange() ---');
console.log(`0x${floatArray[0].toString(16)}`);
console.log(`0x${uintArray[0].toString(16)}`);

oldValue = Atomics.add(uintArray, 0, 0.5);
console.log('--- Atomics.add ---');
console.log(`0x${floatArray[0].toString(16)}`);
console.log(`0x${uintArray[0].toString(16)}`);

// const worker = new Worker('worker.js');
// console.log('Worker loaded!');

// worker.postMessage({sharedBuffer});