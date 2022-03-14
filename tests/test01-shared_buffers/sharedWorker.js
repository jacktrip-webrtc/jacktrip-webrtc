/**
Gastaldi Paolo
27/04/2021
*/
'use strict';

console.log('sharedworkler: loaded');

self.addEventListener('message', (event) => {
    console.log('sharedworkler: new message');
    console.log(event);

	const sharedArray = new Int32Array(event.data);
	for (let i = 0; i < 8; i++) {
		const arrayValue = Atomics.load(sharedArray, i);
		console.log(`The item at array index ${i} is ${arrayValue}`);
	}
}, false);