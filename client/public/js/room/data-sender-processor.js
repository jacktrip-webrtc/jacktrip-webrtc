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
        let buf = new ArrayBuffer(samples.length * Float32Array.BYTES_PER_ELEMENT + BigInt64Array.BYTES_PER_ELEMENT);
        let dw = new DataView(buf);

        // Set the packet number
        dw.setBigUint64(offset, packet_n);
        offset+=BigInt64Array.BYTES_PER_ELEMENT;

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

        this.port.onmessage = (event) => {
            let obj = event.data;

            switch(obj.type) {
                case 'track-status':
                    this.muted = obj.muted;
                    break;
                case 'destroy':
                    this.terminate = true;
                    break;
            }
        }
    }


    process(inputs, outputs, parameters) {
        // The processor may have multiple inputs. Get the first input.
        const input = inputs[0];

        // Each input or output may have multiple channels. Get the first channel. (They are equal)
        const inputChannel0 = input[0];

        if(inputChannel0 !== undefined && !this.muted && !inputChannel0.every((value) => value === 0)) {
            // Create the ArrayBuffer
            let buf = Packet.create({
                samples: inputChannel0,
                packet_n: this.packet_n
            });

            // Send the buffer to DataNode (transferring the ownership)
            this.port.postMessage(buf, [buf]);
        }

        if(inputChannel0 !== undefined) {
            // Update packet number
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
