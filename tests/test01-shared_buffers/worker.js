/**
Gastaldi Paolo
27/04/2021
*/
'use strict';

console.log('workler: loaded');

self.addEventListener('message', (event) => {
    console.log('worker: new message');
    console.log(event);

	const sharedArray = new Int32Array(event.data);
	for (let i = 0; i < 8; i++) {
		const arrayValue = Atomics.load(sharedArray, i);
		console.log(`The item at array index ${i} is ${arrayValue}`);
	}

    let indexSharedWorker = 0;
    console.log('workler: ready to use wait-notify');
    for(let j=0; j<10; j++) {
        switch(Atomics.wait(sharedArray, indexSharedWorker, 0, 10000)) { // array, index, expectedValue, timeout
            // case 'ok':
            // case 'not-equal':
            case 'timed-out':
                console.log('workler: time out');
            default: // 'ok' or 'not-equal'
                console.log(`workler: reading ${sharedArray[indexSharedWorker]}`);
            indexSharedWorker = (indexSharedWorker+1)%8;
        }
    }
}, false);