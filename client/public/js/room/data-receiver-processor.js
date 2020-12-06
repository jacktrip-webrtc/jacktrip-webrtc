'use strict'

const BUFF_SIZE = 128;
const WINDOW_SIZE = 32;
let IN_BUFFER = 8; // This will be updated by the worklet once created, with the value selected by the user
const LIMIT_NUM = 100
const LIMIT = false
const NUM_PACKETS = 500; // Number of packets after which sending info to the main thread

/*** Copy of class Packet from packet.js due to limitations of import inside workers ***/
class Packet {

    /**
     * Method to create a JS Object given an ArrayBuffer
     *
     * @static
     *
     * @param {ArrayBuffer} buf
     *    The ArrayBuffer to "covert" into a JS Object
     *
     * @returns {Object}
     *    Returns the generated object
     *    The returned object has 2 properties:
     *      - packet_n (Number): contains the packet number
     *      - samples (Float32Array): contains the array of samples
    **/
    static parse(buf) {
        // Create the object to be returned
        let obj = {};
        let dw = new DataView(buf);
        // Set the offset in the ArrayBuffer
        let offset = 0;

        // Get the packet number
        obj.packet_n = Number(dw.getBigUint64(offset))
        offset+=BigUint64Array.BYTES_PER_ELEMENT;
        // Get source info
        obj.source = {
            channelCount: Number(dw.getUint8(offset))
        }
        offset+=Uint8Array.BYTES_PER_ELEMENT;

        // Evaluate size of the Float32Array buffer with the samples
        let dim = (buf.byteLength - BigUint64Array.BYTES_PER_ELEMENT - Uint8Array.BYTES_PER_ELEMENT)/Int16Array.BYTES_PER_ELEMENT/obj.source.channelCount;

        // Create the output buffer
        obj.samples = new Array(obj.source.channelCount);
        for(let i=0; i<obj.source.channelCount; i++) {
            // Create the inner buffer
            obj.samples[i] = new Float32Array(dim);

            // Load the samples
            for(let j = 0; j<dim; j++, offset+=Int16Array.BYTES_PER_ELEMENT) {
                obj.samples[i][j] = Packet.Int16ToFloat32(dw.getInt16(offset));
            }
        }

        // Return the object
        return obj;
    }

    /**
     * Method to convert from Float32 to Int16
     *
     * @static
     *
     * @param {Int16} s16
     *    The Int16 sample
     *
     * @returns {Float32}
     *    Returns the Float32 sample
    **/
    static Int16ToFloat32(s16) {
        // Convert the range [-32768, 32767] of Int16 in [-1, 1] of Float32
        let s32 = ((s16 + 32767) / 65535) * 2 - 1;

        // Just for safety
        s32 = Math.min(1, s32);
        s32 = Math.max(-1, s32);

        return s32;
    }
}

class CircularBuffer {
    constructor() {
        this.requested_packet = -1; // Packet counter

        this.buffer_size = BUFF_SIZE; // Number of samples in each packet
        this.window_size = WINDOW_SIZE; // Max number of packets that can be stored in the queue simultaneously
        this.currDimm = 0; // Current size of the buffer
        this.queue = new Array(this.window_size) // Buffer
        this.marker = new Array(this.window_size); // Array to keep track if there is a packet or not

        this.min = WINDOW_SIZE; // Keep track of the minimun value of continuous packet in the buffer
        this.current = 0; // Keep track of the current value of continuous packet in the buffer

        // Initialize marker
        for(let i=0; i<this.window_size; i++) {
            this.marker[i] = false;
            this.queue[i] = [];
        }
    }

    enqueue(packet_n, samples) {
        // If i try to enqueue a previous packet or a packet which is too early i discard it
        // Handles the case in which the first packet is not actually 0
        if(this.requested_packet === -1 || (packet_n > this.requested_packet) && (packet_n < this.requested_packet+this.window_size)) {
            // Set the packet as present
            this.marker[packet_n%this.window_size] = true;

            // Set the data
            this.queue[packet_n%this.window_size] = samples;
            //console.log("Packet stored");
        }
        else {
            //console.log("Packet dropped");
        }
    }

    dequeue(packet_n) {
        // Set the packet as no more present since consumed
        this.marker[packet_n%this.window_size] = false;

        // Get the buffer
        let buff = this.queue[packet_n%this.window_size];
        this.queue[packet_n%this.window_size] = [];

        let current = 0; // Current number of continuous packets
        let start = (packet_n+1)%this.window_size; // Starting position is next position
        for(let i = start, j=0; j<this.window_size; i= (i+1)%this.window_size, j++) {
            // Count continuous packet until you find a empty spot
            if(!this.marker[i]) {
                break;
            }
            current++;
        }

        // Update global current number (we will evaluate the average of this statistic)
        this.current += current;

        // Update minimum
        if(current < this.min) {
            this.min = current;
        }

        // Return the buffer
        return buff;
    }

    hasData(packet_n) {
        // Update requested packet
        this.requested_packet = packet_n;

        // Return if data is present or not
        return this.marker[packet_n%this.window_size];
    }

    getMin() {
        // Save the minimum and reset it for the next round of iterations
        let min = this.min;
        this.min = WINDOW_SIZE;

        return min;
    }

    getCurrent() {
        // Evaluate average and reset it for the next round of iterations
        let current = Math.round(this.current/NUM_PACKETS);
        this.current = 0;

        return current;
    }
}

class DataReceiverProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.n = 0; // Counter to decide when to start
        this.packet_n = -1; // Packet number
        this.queue = new CircularBuffer(); // CircularBuffer
        this.begin = false; // Flag to decide whether to start or not the playback
        this.terminate = false; // To signal its destruction
        this.log = false; // Flag to decide whether to send permormance statistics or not

        this.port.onmessage = (event) => {
            let obj = event.data;

            switch(obj.type) {
                case 'packet':
                    // Receive the array buffer
                    let data = Packet.parse(obj.data);

                    // Load data in the queue
                    this.queue.enqueue(data.packet_n, data.samples);
                    this.n++;

                    if(!this.begin) {
                        // Set first packet which may not be 0 (they may arrive not in order)
                        if(this.packet_n === -1 || data.packet_n < this.packet_n) {
                            this.packet_n = data.packet_n;
                        }

                        // I received IN_BUFFER packets => start the playback
                        if(this.n >= IN_BUFFER) {
                            this.begin = true;
                        }
                    }

                    break;
                case 'destroy':
                    this.terminate = true;
                    break;
                case 'log':
                    this.log = obj.log;
                    break;
                case 'playoutBufferSize':
                    IN_BUFFER = obj.playoutBufferSize;
                    break
                default:
                    // Nothing to do
            }
        };
    }

    process(inputs, outputs, parameters) {
        // The processor may have multiple outputs. Get the first output.
        const output = outputs[0];

        // Check wheter or not to start playback
        if(this.begin) {

            // Check if packet is present
            if(this.queue.hasData(this.packet_n)) {
                // Get samples
                let buff = this.queue.dequeue(this.packet_n);

                // Process output data
                if(buff.length === 1) {
                    // Set data
                    output.forEach(channel => {
                        for (let i = 0; i < BUFF_SIZE; i++) {
                            channel[i] = buff[0][i];
                        }
                    })
                }
                else if(buff.length === 2) {
                    // Set data
                    for(let i in buff) {
                        for(let j=0; j<BUFF_SIZE; j++) {
                            output[i][j] = buff[i][j];
                        }
                    }
                }
                else {
                    // Set silence
                    output.forEach(channel => {
                        for (let i = 0; i < channel.length; i++) {
                            channel[i] = 0;
                        }
                    })
                }
            }
            else {
                // Set silence
                output.forEach(channel => {
                    for (let i = 0; i < channel.length; i++) {
                        channel[i] = 0;
                    }
                })
            }

            // Send packetNumber to DataNode
            this.port.postMessage({
                type: 'packet_n-request',
                packet_n: this.packet_n
            });

            if(this.log) {
                // Send packetNumber to DataNode
                this.port.postMessage({
                    type: 'performance',
                    packet_n: this.packet_n
                });
            }

            // Update packet number to request
            this.packet_n++;

            if(this.packet_n % NUM_PACKETS === 0 && !this.terminate) {
                // Send playout buffer stats
                this.port.postMessage({
                    type: 'minPlayoutBufferSize',
                    min: this.queue.getMin(),
                    current: this.queue.getCurrent()
                });
            }
        }
        else {
            // Set silence
            output.forEach(channel => {
                for (let i = 0; i < channel.length; i++) {
                    channel[i] = 0;
                }
            })
        }

        // For test purposes
        if(this.terminate || (LIMIT === true && this.packet_n === LIMIT_NUM)) {
            return false;
        }

        // To keep this processor alive.
        return true;
    }
}

registerProcessor('data-receiver-processor', DataReceiverProcessor);
