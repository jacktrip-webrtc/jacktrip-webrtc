'use strict';

import { Float32ToInt16 } from './convert.js';

/**
 * packet class
 * with adaptations to new Paolo's architecture
 * 
 * packet structure changed:
 *      - aligned to 16 bit values: source is Uint16Array and not Uint8Array anymore
 *      - no samples extraction from buffer: reduce copy effort, managed as circular buffer offset
 * 
 * @author Sacchetto Matteo
 * @author Gastaldi Paolo
 */
 class PacketManager {
    static headerSize = BigUint64Array.BYTES_PER_ELEMENT + Uint32Array.BYTES_PER_ELEMENT; // packet number + channel count
    static windowSize = 128;
    static channelCount = 1;

    /**
     * constructor
     * @param {...any} args
     *      - [0]: log
     *      - [1]: packetCount
     *      - [2]: useTestSamples
     *      - [3]: sampleRate
     *      - [4]: windowSize
     *      - [5]: channelCount
     */
    constructor(...args) {
        this.log = args[0] || false;
        this.packetCount = args[1] || 0n;
        this.useTestSamples = args[2] || false;
        this.sampleRate = args[3] || 48000;
        this.windowSize = args[4] || PacketManager.windowSize;
        this.channelCount = args[5] || PacketManager.channelCount;
        this.channelCount = args[5] || 1;

        this._setupTestSin();
    }

    /**
     * for testing only
     * w/ a simple sin
     */
     _setupTestSin() {
        this._sinChoice = [ 110, 220, 330, 440, 550, 660, 770, 880, 990, 1100 ];
        
        let index = Math.floor(Math.random() * 1000 % this._sinChoice.length);
        this._sinFreq = this._sinChoice[index];
        this._sinLength = Math.round(this.sampleRate/this._sinFreq);
        this._sinVet = [];
        for(let i=0; i<this._sinLength; i++) {
            let rad = i / this._sinLength * 2 * Math.PI;
            this._sinVet.push(Math.sin(rad));
        }
        if(this.log) console.log(`test sin: ${this._sinFreq} Hz`);
    }

    // for testing only
    _generateFakeSamples(obj, nSamples, nChannels) {
        let fakeSamples = [];
        for(let k=0; k<nChannels; k++) {
            fakeSamples[k] = [];
            for(let i=0; i<nSamples; i++) {
                let sample = this._sinVet[i % this._sinLength];
                fakeSamples[k].push(sample);
            }
        }
        obj.samples = fakeSamples;
    }

    /**
     * create an ArrayBuffer given a JS object
     * @static
     * @param {Object} obj
     *      object that will be converted to an ArrayBuffer:
     *          - {Number} packet_n: packet number
     *          - {Float32Array} samples: data as-is from AudioContext (they will be copied)
     *          - {Object} source:
     *              - {Number} channelCount: number of channels in input
     *              - {Array} channels: list of selected channels
     * @param {Boolean} fillSamples
     *      (optional) set samples too
     * @returns {ArrayBuffer}
     */
    create(obj, fillSamples=true) {
        if(!obj) throw new Error(`PacketManager, object needed`);
        
        let nSamples = obj.samples && obj.samples[0] ? obj.samples[0].length : this.windowSize;
        let nChannels = obj.source && obj.source.channelCount ? obj.source.channelCount : this.channelCount;
        let packet_n = obj.packet_n ? obj.packet_n : this.packetCount++;

        // for testing only
        if(this.useTestSamples)
            this._generateFakeSamples(obj, nSamples, nChannels);

        let buffer = new ArrayBuffer(PacketManager.headerSize + Int16Array.BYTES_PER_ELEMENT * nSamples * nChannels);
        let dw = new DataView(buffer);

        // set packet header (packet_n, channelCount)
        dw.setBigUint64(0, packet_n, true);
        dw.setUint32(BigUint64Array.BYTES_PER_ELEMENT, nChannels, true);
        
        if(fillSamples) {
            // fill the buffer w/ Float32ToInt16 samples (here we merge 2 sample copy in 1 place!)
            for(let channel=0, offset=PacketManager.headerSize; channel<nChannels; channel++) { // for each channel
                if(obj.samples[channel] && obj.samples[channel].length > 0)
                    for(let sample=0; sample<nSamples; sample++, offset+=Int16Array.BYTES_PER_ELEMENT) // for each sample
                        dw.setInt16(offset, Float32ToInt16(obj.samples[channel][sample]), true); // concat all values
                else
                    for(let sample=0; sample<nSamples; sample++, offset+=Int16Array.BYTES_PER_ELEMENT) // for each sample
                        dw.setInt16(offset, Float32ToInt16(0.), true); // concat all values
            }
        }
        
        return buffer;
    }

    /**
     * create a packet given an ArrayBuffer
     * @static
     * @param {ArrayBuffer} buffer
     *      ArrayBuffer to covert into a JS Object
     * @param {BigInt} packet_nOffset
     * @returns {Object} packet
    **/
    static parse(buffer, packet_nOffset=BigInt(0)) {
        let packet = {};
        let dw = new DataView(buffer);

        packet.packet_n = dw.getBigUint64(0, true) + packet_nOffset;
        packet.source = { channelCount: dw.getUint32(BigUint64Array.BYTES_PER_ELEMENT, true) }; // source info
        packet.buffer = new Int16Array(buffer); // JS does not support pointer math, so I have to split this in channels later (see AudioCircularBuffer)

        return packet;
    }

    /**
     * method to get the packet number given the ArrayBuffer
     * @static
     * @param {ArrayBuffer} buffer - ArrayBuffer from which we need to extract the packer number
     * @returns {BigInt} packet number
    **/
    static getPacketNumber(buffer) {
        let dw = new DataView(buffer);
        return dw.getBigUint64(0, true);
    }

    /**
     * Method to replace the packet number given the ArrayBuffer and the packet number
     *
     * @static
     * @param {ArrayBuffer} buffer - ArrayBuffer on which we need to replace the packer number
     * @param {Number} newPacketNumber - new packet number
     *
     * @returns {ArrayBuffer}
     *    Returns the buffer with the new packet number
    **/
    static replacePacketNum(buffer, newPacketNumber) {
        let dw = new DataView(buffer);

        // convert the packet numbet to a BigInt (max value = 2^53-1)
        let packet_n = BigInt(newPacketNumber);

        // set the packet number
        dw.setBigUint64(0, packet_n, true);

        // Return the buffer
        return buffer;
    }
}

export default PacketManager;