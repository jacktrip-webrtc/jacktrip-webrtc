/**
Gastaldi Paolo
27/04/2021

Testing SharedArrayBuffer
*/
'use strict';

consolelog('main: loaded');

if(!crossOriginIsolated) { // SharedArrayBuffer is NOT available
    consolelog('UNABLE TO USE SharedArrayBuffer');
}

/*
buffer creation
*/
const length = 8;
const size = Int32Array.BYTES_PER_ELEMENT * length;
const sharedBuffer = new SharedArrayBuffer(size);
const sharedArray = new Int32Array(sharedBuffer);

consolelog(sharedBuffer);
consolelog(sharedArray); // JS buffer

/*
worker creation
*/
const worker = new Worker('worker.js');
consolelog(worker);

/*
testing Atomics
*/
consolelog(Atomics);
consolelog(Atomics.load.toString()); // native code
consolelog(Atomics.store.toString()); // native code

/*
using the shared array
*/
let index = 3, value = 999;
Atomics.store(sharedArray, index, value);
consolelog(sharedArray);

/*
connecting the buffer
*/
worker.onmessage = (event) => { worker_start(event); };
consolelog(worker);

worker.postMessage(sharedBuffer);

/*
testing sharedWorker
*/
const sharedWorker = new SharedWorker('sharedWorker.js');
sharedWorker.onmessage = (event) => { sharedworker_start(event); };
sharedWorker.port.postMessage(sharedBuffer);

/*
testing atomic
*/
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const testingAtomic = async() => {
    await sleep(5000);
    consolelog('ready to test sharedArray and atomic');
    
    let indexMain = 0;
    let valueMain = 0;
    for(let k=0; k<5; k++) {
        sharedArray[indexMain] = valueMain;
        consolelog(`value inserted: ${valueMain} at ${indexMain}`);
        Atomics.notify(sharedArray, indexMain, 1);

        valueMain++;
        indexMain = (indexMain+1)%8;
        
        await sleep(5000);
    }
}
testingAtomic();