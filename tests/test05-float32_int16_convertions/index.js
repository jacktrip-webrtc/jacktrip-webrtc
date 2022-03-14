'use strict';

const { Float32ToInt16, Int16ToFloat32 } = require('./convert');

console.log(Int16ToFloat32(384), Int16ToFloat32(-129));
console.log(Int16ToFloat32(-5889));

console.log(Float32ToInt16(0.005300203338265419));
console.log(Int16ToFloat32(-20992));

console.log(Float32ToInt16(0.001858032075688243)); // 61

let ary = new ArrayBuffer(1024);
let dw = new DataView(ary);

let val = 0.001858032075688243;
let conv_val = Float32ToInt16(val);
console.log(val, conv_val);
dw.setInt16(0, conv_val, true);

console.log(ary);
console.log(new Int16Array(ary));

let threshold = 0.001;

console.log('Testing double convertion...');
console.log('testing Int16ToFloat32');
for(let int=-32768/2.; int<32767/2; int++) {
    let doubleConvertedValue = Float32ToInt16(Int16ToFloat32(int));
    if(Math.abs(int - doubleConvertedValue) > threshold) {
        console.error(`INCORRECT OPERATION: int = ${int}, doubleConvertedValue = ${doubleConvertedValue}`);
    }
}
console.log('testing Float32ToInt16');
for(let float=65535/2.; float<65535/2; float=float+1.) {
    let doubleConvertedValue = Int16ToFloat32(Float32ToInt16(float));
    if(Math.abs(float - doubleConvertedValue) > threshold) {
        console.error(`INCORRECT OPERATION: float = ${float}, doubleConvertedValue = ${doubleConvertedValue}`);
    }
}
console.log('Testing double convertion... - done');

console.log('Testing sum...');
console.log('testing Int16ToFloat32');
for(let int=-32768/2.; int<32767/2; int++) {
    let float = Int16ToFloat32(int);
    let intSum = int + int;
    let floatSum = float + float;
    if(Math.abs(floatSum - Int16ToFloat32(intSum)) > threshold) {
        console.error(`INCORRECT OPERATION: int = ${int}, float = ${float}, intSum = ${intSum}, floatSum = ${floatSum}`);
    }
}
console.log('testing Float32ToInt16');
for(let float=65535/2.; float<65535/2; float=float+1.) {
    let int = Float32ToInt16(float);
    let intSum = int + int;
    let floatSum = float + float;
    if(Math.abs(intSum - Float32ToInt16(floatSum)) > threshold) {
        console.error(`INCORRECT OPERATION: int = ${int}, float = ${float}, intSum = ${intSum}, floatSum = ${floatSum}`);
    }
}
console.log('Testing sum... - done!');

// MORE SPECIFIC TESTS

function testFloat32ToInt16(val) {
    conv_val = Float32ToInt16(val);
    console.log(`Float32 ${val} to Int16 ${conv_val}`);
}

function testInt16ToFloat32(val) {
    conv_val = Int16ToFloat32(val);
    console.log(`Int16 ${val} to Float32 ${conv_val}`);
}

testFloat32ToInt16(-0.7319676280021667);
testInt16ToFloat32(2364);

testFloat32ToInt16(0.14393931447411912);
testInt16ToFloat32(4717);
