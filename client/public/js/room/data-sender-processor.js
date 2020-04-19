'use strict'

class DataSenderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.n = 0; // Counter
    }


    process(inputs, outputs, parameters) {
        // The processor may have multiple inputs. Get the first input.
        const input = inputs[0];

        // Each input or output may have multiple channels. Get the first channel. (They are equal)
        const inputChannel0 = input[0];

        // Send data to DataNode
        this.port.postMessage(inputChannel0);

        // To keep this processor alive.
        return true;
    }
}

registerProcessor('data-sender-processor', DataSenderProcessor);
