'use strict';

self.addEventListener('message', function (event) {
    const {sharedBuffer} = event.data;
    const floatArray = new Float32Array(sharedBuffer); // local only
    const intArray = new Uint32Array(sharedBuffer);

    intArray.forEach((value, index, array) => console.log(value));
    floatArray.forEach((value, index, array) => console.log(value)); // 0 (IEEE) = 0 float, Atomics.exchange() can be used
    // BUT Atomics cannot be used for summing samples
    // locks/mutex are needed

    // Atomics: blocks every other operation ON THE WHOLE ARRAY
    // Atomics can work only with IntArray, UintArray, ma la somma di sample dev'essere fatta in float
    intArray.forEach((value, index, array) => Atomics.exchange(array, index, 99));

    intArray.forEach((value, index, array) => console.log(value));
    floatArray.forEach((value, index, array) => console.log(value));

    // console.log(`Old value (IEEE FORMAT): ${Atomics.exchange(intArray, 0, ).toString(16)}`);
    // console.log(`New value: ${floatArray[0]} (IEEE FORMAT: ${intArray[0]})`);
});