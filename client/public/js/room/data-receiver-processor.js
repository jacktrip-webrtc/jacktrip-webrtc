'use strict'

const BUFF_SIZE = 128;

class DataReceiverProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.n = 0; // Counter

        this.start = 0; // Start of the queue
        this.end = 0; // End of the circular buffer
        this.size = BUFF_SIZE * 8; // Size of the circular buffer
        this.currDimm = 0; // Current size of the buffer
        this.queue = new Float32Array(this.size) // Buffer
        this.begin = false; // Flag to decide whether to start or not the playback
        this.port.onmessage = (event) => {
            let data = event.data;

            // Load data in the queue
            for(let i=0; i<BUFF_SIZE; i++) {
                this.end = (this.end+1)%this.size;
                this.queue[this.end] = data[i];
            }

            // Check size
            this.currDimm = this.start > this.end ? this.end+this.size-this.start : this.end-this.start;

            // Check the number of buffered items
            if(this.currDimm >= 2*BUFF_SIZE) {
                this.begin = true;
            }
        };
    }

    process(inputs, outputs, parameters) {
        // The processor may have multiple outputs. Get the first output.
        const output = outputs[0][0];

        if(this.begin) {
            // Process output data
            if(this.start === this.end) {
                this.end += BUFF_SIZE;
            }

            for(let i = 0; i<BUFF_SIZE; i++) {
                this.start = (this.start+1)%this.size;

                output[i] = this.queue[this.start];
            }
            this.currDimm = this.start > this.end ? this.end+this.size-this.start : this.end-this.start;

            if(this.currDimm === 0) {
                this.begin = false;
            }
        }

        // To keep this processor alive.
        return true;
    }
}

registerProcessor('data-receiver-processor', DataReceiverProcessor);
