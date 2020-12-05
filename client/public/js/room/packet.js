'use strict'

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
     * Method to get the packet number given the ArrayBuffer
     *
     * @static
     *
     * @param {ArrayBuffer} buf
     *    The ArrayBuffer from which we need to extract the packer number
     *
     * @returns {Number}
     *    Returns the packet number
    **/
    static getPacketNumber(buf) {
        let dw = new DataView(buf);

        // Return the packet number
        return Number(dw.getBigUint64(0));
    }

    /**
     * Method to replace the packet number given the ArrayBuffer and the packet number
     *
     * @static
     *
     * @param {ArrayBuffer} buf
     *    The ArrayBuffer on which we need to replace the packer number
     * @param {Number} n
     *    The new packet number
     *
     * @returns {ArrayBuffer}
     *    Returns the buffer with the new packet number
    **/
    static replacePacketNum(buf, n) {
        let dw = new DataView(buf);

        //  Convert the packet numbet to a BigInt (max value = 2^53-1)
        let packet_n = BigInt(n);

        // Set the packet number
        dw.setBigUint64(0, packet_n);

        // Return the buffer
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
