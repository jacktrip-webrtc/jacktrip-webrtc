
'use strict';

/**
 * convert from Float32 to Int16
 * @param {Float32} s32 - Float32 sample
 * @returns {Int16} Int16 sample
*/
const Float32ToInt16 = function Float32ToInt16(s32) {
    // Convert the range [-1, 1] of Float32 in [-32768, 32767] of Int16
    let s16 = Math.floor(((s32 + 1) / 2 ) * 65535 - 32767);

    // Just for safety
    s16 = Math.min(32767, s16);
    s16 = Math.max(-32768, s16);

    return s16;
}

/**
 * convert from Float32 to Int16
 * @param {Int16} s16 - Int16 sample
 * @returns {Float32} Float32 sample
 */
const Int16ToFloat32 = function(s16) {
    // Convert the range [-32768, 32767] of Int16 in [-1, 1] of Float32
    let s32 = ((s16 + 32767) / 65535) / 2 - 1;

    // Just for safety
    s32 = Math.min(1, s32);
    s32 = Math.max(-1, s32);

    return s32;
}

/**
 * audio processor for testing the audio chain
 * @author Gastaldi Paolo
 */
class AudioTestProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        this.isStarted = true;

        this.port.onmessage = (event) => {
            switch(event.data.type) {
                case 'start':
                case 'play':
                    this.isStarted = true;
                    break;
                case 'stop':
                    this.isStarted = false;
                    break;
                default:
                    console.error(`AudioTestProcessor, unexpected message ${event.data}`);
            }
            console.log(`AudioTestProcessor, is started = ${this.isStarted}`);
        }
    }

    /**
     * what the processor has to do
     * @param {ArrayBuffer} inputs 
     * @param {ArrayBuffer} outputs 
     * @param {ArrayBuffer} parameters 
     * @returns {Boolean} keep worker alive
     */
     process(inputs, outputs, parameters) {
        let input = inputs[0];
        let output = outputs[0];

        // copy all values
        for(let channel=0; channel<input.length; channel++) {
            for(let sample=0; sample<input[0].length; sample++) {
                output[channel][sample] = input[channel][sample];
            }
        }

        return true;
    }
}

registerProcessor('audio-test-processor', AudioTestProcessor);