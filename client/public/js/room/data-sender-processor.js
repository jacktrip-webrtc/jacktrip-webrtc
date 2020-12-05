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
     *      - samples (Array(Float32Array)): contains the array of inputs
     *      - source (Object):
     *          - channelCount (Number): number of channels in input
     *          - channels: list of selected channels
     *
     * @returns {ArrayBuffer}
     *    Returns the generated ArrayBuffer
    **/
    static create(obj) {
        //  Convert the packet numbet to a BigInt (max value = 2^53-1)
        let packet_n = BigInt(obj.packet_n);
        // Get the input Array
        let samples = obj.samples;
        // Get source info
        let source = obj.source;
        // Set the offset in the ArrayBuffer
        let offset = 0;

        let BUFF_SIZE = 128;

        // Create the ArrayBuffer
        let buf = new ArrayBuffer(BUFF_SIZE * Int16Array.BYTES_PER_ELEMENT * source.channelCount + Uint8Array.BYTES_PER_ELEMENT + BigUint64Array.BYTES_PER_ELEMENT);
        let dw = new DataView(buf);

        // Set the packet number
        dw.setBigUint64(offset, packet_n);
        offset+=BigUint64Array.BYTES_PER_ELEMENT;
        // Set the channel count number
        dw.setUint8(offset, source.channelCount);
        offset+=Uint8Array.BYTES_PER_ELEMENT;

        // Set all the samples
        for(let i of source.channels) {
            for(let s of samples[i]) {
                let s16 = Packet.Float32ToInt16(s);
                dw.setInt16(offset, s16);
                offset += Int16Array.BYTES_PER_ELEMENT;
            }
        }

        // Return the ArrayBuffer
        return buf;
    }

    /**
     * Method to convert from Float32 to Int16
     *
     * @static
     *
     * @param {Float32} s32
     *    The Float32 sample
     *
     * @returns {Int16}
     *    Returns the Int16 sample
    **/
    static Float32ToInt16(s32) {
        // Convert the range [-1, 1] of Float32 in [-32768, 32767] of Int16
        let s16 = Math.floor(((s32 + 1) / 2) * 65535 - 32767);

        // Just for safety
        s16 = Math.min(32767, s16);
        s16 = Math.max(-32768, s16);

        return s16;
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
        this.source = {
            channelCount: 1, // Number of channels
            channels: [0] // Id of channels within the array
        }

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
                case 'channelList':
                    let channels = obj.channelList.split(',');
                    this.source = {
                        channelCount: channels.length,
                        channels: channels
                    }
            }
        }
    }


    process(inputs, outputs, parameters) {
        // The processor may have multiple inputs. Get the first input.
        const input = inputs[0];

        // The processor may have multiple outputs. Get the first output.
        const output = outputs[0];

        if(this.log) {
            // Send a message to the main thread for process iteration measures
            this.port.postMessage({
                type: 'process_iteration',
                packet_n: this.packet_n
            });
        }

        if(input.length > 0 && (!this.muted || this.audioLoopback) && !this.loopback) {
            let silent = true;
            if(this.source.channelCount === 1) {
                if(input[this.source.channels[0]].some((el) => el !== 0)) { // Check if the selected channel is not muted
                    silent = false;
                }
            }
            else if (this.source.channelCount === 2) {
                for(let i of this.source.channels) { // Check if at least one of the channels is not muted
                    if(input[i].some((el) => el !== 0)) {
                        silent = false;
                        break;
                    }
                }
            }

            if(!silent) {
                // Send a message to the main thread for performance measures
                this.port.postMessage({
                    type: 'performance',
                    packet_n: this.packet_n
                });

                // Create the ArrayBuffer
                let buf = Packet.create({
                    samples: input,
                    packet_n: this.packet_n,
                    source: this.source
                });

                // Send the buffer to DataNode (no transferring the ownership)
                let message = {
                    type: 'packet',
                    buf: buf
                }
                this.port.postMessage(message);
            }
        }
        else if(this.loopback) {
            this.port.postMessage({
                type: 'loopback',
                packet_n: this.packet_n
            });
        }

        // Set silence (for safety reasons)
        output.forEach(channel => {
            for (let i = 0; i < channel.length; i++) {
                channel[i] = 0;
            }
        })

        if(input.length > 0) {
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
