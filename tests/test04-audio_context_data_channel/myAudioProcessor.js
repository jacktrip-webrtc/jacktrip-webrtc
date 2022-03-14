'use strict';

let realSend = null;

class MyAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        this.dataBuffer = null;
        this.counterBuffer = null;
        this.currIndex = 0;
        this.isStarted = false;

        this.port.onmessage = (event) => {

            // this.dataChannel = event.data.dataChannel;
            // this.send = event.data.send;
            console.log(event.data);

            this.sharedBuffer = event.data.sharedBuffer;
            this.sharedCounter = event.data.sharedCounter;

            if(event.data.funcArray) {
                // this.send = new Function('return 0;');
                // this.send = new Float64Array(event.data.funcArray)[0];
                realSend = new Float64Array(event.data.funcArray)[0];
                const funcArray = Function(new Float64Array(event.data.funcArray));
                console.log(funcArray);
                console.log(realSend);
                /* Function can see only global and local variables, no closures */
                const tmpSend = new Function('realSend', 'data', 'realSend(data);');
                this.send = tmpSend.bind(realSend);
                // this.send = tmpSend;
                console.log(typeof this.send);
                console.log(this.send);
                for(let key in this.send) console.log(key);
            
                // this.send = ((context, data) => { context.send(data); }).bind(new Float64Array(event.data.dataChannel)[0], null);
            }

            this.dataBuffer = new Float32Array(this.sharedBuffer);
            this.counterBuffer = new Uint8Array(this.sharedCounter);

            this.currIndex = 0;

            this.port.postMessage(`All my props: ${Object.keys(this)}`);

            this.isStarted = true;
        }

        /*
        workers cannot manipulate DOM objects, included RTCPeerConnection
        */
        // this.myPeerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        // this.myDataChannel = this.myPeerConnection.createDataChannel(); 
    }

    process(inputs, outputs, parameters) {
        if(this.isStarted) {
            // this.peerConnection.send('test string');
            this.send('test string');

            this.dataBuffer[this.currIndex] = inputs[0];
            Atomics.add(this.counterBuffer, 0, 1);
            this.currIndex = this.currIndex + 1 % 8;
    
            // this.port.postMessage('RTC message sent');
        }
    }
}

registerProcessor('myAudioProcessor', MyAudioProcessor);