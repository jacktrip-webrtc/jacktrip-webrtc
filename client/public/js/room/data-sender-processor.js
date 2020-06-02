'use strict'

const LIMIT_NUM = 100
const LIMIT = false

class DataSenderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.packet_n = 0; // Packet counter
    }


    process(inputs, outputs, parameters) {
        // The processor may have multiple inputs. Get the first input.
        const input = inputs[0];

        // Each input or output may have multiple channels. Get the first channel. (They are equal)
        const inputChannel0 = input[0];

        // Send data to DataNode
        this.port.postMessage({
            samples: inputChannel0,
            packet_n: this.packet_n
        });

        // Update packet number
        this.packet_n++;

        // For test purposes
        if(LIMIT === true && this.packet_n === LIMIT_NUM) {
            return false;
        }

        // To keep this processor alive.
        return true;
    }
}

registerProcessor('data-sender-processor', DataSenderProcessor);
