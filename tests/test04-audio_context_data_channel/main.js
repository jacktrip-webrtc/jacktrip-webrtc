/**
 * Gastaldi Paolo
 * 12/05/2021
 * 
 * Can an audio processor running on AudioWorklet send messages through an RTC connection ?
 */

'use strict';

/*
-------------------------------------------
RTC connection tests
-------------------------------------------
*/

const peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
const dataChannel = peerConnection.createDataChannel('myDataChannel');
dataChannel.onmessage = (event) => {
    // const data = event.data;
    // send(data); // message back
}
let realSend = dataChannel.send;

/* Uncaught DOMException: An attempt was made to use an object that is not, or is no longer, usable */
// let txBuffer = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 8);
// const txData = new Float32Array(txBuffer);
// dataChannel.send(txData);

/* Uncaught TypeError: RTCDataChannel.send: Argument 1 can't be a SharedArrayBuffer or an ArrayBufferView backed by a SharedArrayBuffer */
// const txBuffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 8);
// const txData = new Float32Array(txBuffer);
// dataChannel.send(txData);

/* same errors as before */
// const txBuffer = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 8);
// const txBuffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 8);
// const txData = new DataView(txBuffer, 0, Float32Array.BYTES_PER_ELEMENT * 8);
// dataChannel.send(txData);

/*
Unexpencted error type
it should work in this way... Why not?
Uncaught DOMException: An attempt was made to use an object that is not, or is no longer, usable

taken from the docs:
The data to transmit across the connection. This may be a USVString, a Blob, an ArrayBuffer, or an ArrayBufferView
*/
// const txBuffer = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 8);
// const txData = new Float32Array(txBuffer); // derives from ArrayBufferView
// dataChannel.send(txBuffer);

/*
-------------------------------------------
Tests with AudioWorklet
-------------------------------------------
*/

const audioContextConfig = {
    // sampleRate : 44100,
    latencyHint : 0
};
const mediaConfig = {
    video: false,
    audio: {
        autoGainControl: false,
        echoCancellation: false,
        latency: audioContextConfig.latencyHint,
        noiseSuppression: false,
        // sampleRate: audioContextConfig.sampleRate,
        // sampleSize: 32 // default value, as required by AudioContext
    }
};

const audioContext = new AudioContext(audioContextConfig);
const audioInputStream = new MediaStream();

const sharedBuffer = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 8);
const sharedCounter = new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT);
const dataBuffer = new Float32Array(sharedBuffer);
const counterBuffer = new Uint8Array(sharedCounter);

/*
Forward all messages to the RTCDataChannel

not working: this causes main thread block
*/
const infiniteMainForward = async () => {
    let currIndex = 0;

    // not working: it blocks the whole app
    for(;;) {
        if(Atomics.load(counterBuffer, 0) > 0) {
            Atomics.sub(counterBuffer, 0, 1);

            const data = dataBuffer[currIndex];
            this.dataChannel.send(data);

            currIndex = currIndex + 1 % 8;

            console.log('Main: packet forward done!');
        }
    }
}

audioContext.audioWorklet.addModule('myAudioProcessor.js')
.then(() => {
    class MyAudioNode extends AudioWorkletNode {
        constructor(audioContext, dataChannel) {
            super(audioContext, 'myAudioProcessor');
            this.dataChannel = dataChannel;
        }
    }
    
    let audioInput = null;
    let audioOutput = null;
    
    navigator.mediaDevices.getUserMedia(mediaConfig)
    .then((stream) => {
        // Add new tracks
        stream.getAudioTracks().forEach((track) => {
            audioInputStream.addTrack(track);
            track.enabled = true;
        });

        audioInput = audioContext.createMediaStreamSource(audioInputStream);
        audioOutput  = audioContext.createMediaStreamDestination(audioContext.destination);

        const myAudioNode = new MyAudioNode(audioContext, dataChannel);
        myAudioNode.port.onmessage = event => {
            console.log(`Message from processor: ${event.data}`);
        };

        /*
        -------------------------------------------
        Tests transferring RTCDataChannel
        -------------------------------------------
        */

        /*
        RTCPeerConnection cannot be cloned
        as MediaStream: not trasferrable
        */
        // myAudioNode.port.postMessage({ dataChannel : dataChannel });

        /*
        nemmeno il passaggio di una funzione è permesso
        verrebbe comunque copiato l'oggetto
        */
        // myAudioNode.port.postMessage({ send : dataChannel.send });


        /*
        -------------------------------------------
        Tests with function and bind
        -------------------------------------------
        */
        // const forwardFunc = async(context, data) => {
        //     context.dataChannel.send(data);
        // }
        // const mySend = forwardFunc.bind(this, null);
        // console.log(typeof mySend);
        // console.log(mySend);
        // console.log(Object.keys(mySend).length);
        // for(let key in mySend) console.log(key);
        // const tmpArray = [ mySend ];
        const tmpArray = [ dataChannel.send ];
        const funcArray = new Float64Array(tmpArray);
        console.log(`ArrayBuffer of functions`);
        console.log(funcArray.buffer);
        console.log(funcArray[0]);

        myAudioNode.port.postMessage({ 
            sharedBuffer : sharedBuffer,
            sharedCounter : sharedCounter,
            funcArray : funcArray.buffer
            // forwardFunc : mySend // still cloning
        });

        /* some prints */
        // console.log(dataChannel);
        // const sendFunc = dataChannel.send;
        // console.log(sendFunc.toString());

        myAudioNode.port.postMessage({
            sharedBuffer : sharedBuffer,
            sharedCounter : sharedCounter,
            // dataChannel : peerConnection.createDataChannel('myDataChannel2')
        });
        
        // Audio nodes connection, so start operating
        audioInput.connect(myAudioNode);
        myAudioNode.connect(audioOutput);

        // infiniteMainForward();
    });
});