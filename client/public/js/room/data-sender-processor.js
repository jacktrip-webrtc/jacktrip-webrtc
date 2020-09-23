'use strict'

const LIMIT_NUM = 100
const LIMIT = false

/*** Copy of class Packet from packet.js due to limitations of import inside workers ***/
class Packet {
    /**
     * Method to create an ArrayBuffer given a JS Object
     *
     * @static
     *
     * @param {Object} obj
     *    The object to "covert" into an ArrayBuffer
     *    The object needs to have 2 properties:
     *      - packet_n (Number): contains the packet number
     *      - samples (Float32Array): contains the array of samples
     *
     * @returns {ArrayBuffer}
     *    Returns the generated ArrayBuffer
    **/
    static create(obj) {
        //  Convert the packet numbet to a BigInt (max value = 2^53-1)
        let packet_n = BigInt(obj.packet_n);
        // Get the Float32Array
        let samples = obj.samples;
        // Set the offset in the ArrayBuffer
        let offset = 0;

        // Create the ArrayBuffer
        let buf = new ArrayBuffer(samples.length * Float32Array.BYTES_PER_ELEMENT + BigUint64Array.BYTES_PER_ELEMENT);
        let dw = new DataView(buf);

        // Set the packet number
        dw.setBigUint64(offset, packet_n);
        offset+=BigUint64Array.BYTES_PER_ELEMENT;

        // Set all the samples
        for(let s of samples) {
            dw.setFloat32(offset, s);
            offset += Float32Array.BYTES_PER_ELEMENT;
        }

        // Return the ArrayBuffer
        return buf;
    }
}

class DataSenderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.packet_n = 0; // Packet counter
        this.muted = false;
        this.terminate = false; // To signal its destruction
        this.loopback = false; // To signal if it is in loopback state
        this.audioLoopback = false; // This is needed in order to not mute the source when the peer is set in the audio Loopback
        this.log = false; // Flag to decide whether to send permormance statistics or not

        this.port.onmessage = (event) => {
            let obj = event.data;

            switch(obj.type) {
                case 'track-status':
                    this.muted = obj.muted;
                    break;
                case 'destroy':
                    this.terminate = true;
                    break;
                case 'loopback':
                    this.loopback = obj.loopback;
                    break;
                case 'audioLoopback':
                    this.audioLoopback = obj.audioLoopback;
                    break;
                case 'log':
                    this.log = obj.log;
                    break;
            }
        }
    }


    process(inputs, outputs, parameters) {
        // The processor may have multiple inputs. Get the first input.
        const input = inputs[0];

        // Each input or output may have multiple channels. Get the first channel. (They are equal)
        const inputChannel0 = input[0];

        // The processor may have multiple outputs. Get the first output.
        const output = outputs[0][0];

        if(this.log) {
            // Send a message to the main thread for process iteration measures
            this.port.postMessage({
                type: 'process_iteration',
                packet_n: this.packet_n
            });
        }

        if(inputChannel0 !== undefined && (!this.muted || this.audioLoopback) && inputChannel0.some((value) => value !== 0) && !this.loopback) {
            // Send a message to the main thread for performance measures
            this.port.postMessage({
                type: 'performance',
                packet_n: this.packet_n
            });

            // Create the ArrayBuffer
            let buf = Packet.create({
                samples: inputChannel0,
                packet_n: this.packet_n
            });

            // Send the buffer to DataNode (no transferring the ownership)
            let message = {
                type: 'packet',
                buf: buf
            }
            this.port.postMessage(message);
        }
        else if(this.loopback) {
            this.port.postMessage({
                type: 'loopback',
                packet_n: this.packet_n
            });
        }

        // Set silence (just for safety reasons)
        for(let i = 0; i<output.length; i++) {
            output[i] = 0;
        }

        if(inputChannel0 !== undefined) {
            // It has a input, so update packet number
            this.packet_n++;
        }

        // For test purposes
        if(this.terminate || (LIMIT === true && this.packet_n === LIMIT_NUM)) {
            return false;
        }

        // To keep this processor alive.
        return true;
    }
}

registerProcessor('data-sender-processor', DataSenderProcessor);
