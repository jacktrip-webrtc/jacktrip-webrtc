'use strict';

import AudioPeer from './audio-peer.js';

/**
 * manage clients
 * 
 * @author Gastaldi Paolo
 */
class AudioClientManager {
    /**
     * constructor
     * @param {Object} circularBufferTransfer
     * @param {...any} args
     */
    constructor(circularBufferTransfer, ...args) {
        this.config = args[0];
        this.audioContext = args[1];
        this.audioReceiverNode = args[2];
        this.jitterData = args[3];
        this.log = args[4] || false;

        this.circularBufferTransfer = circularBufferTransfer;

        this.clients = [];
    }

    /**
     * just for testing
     */
    _createMuteEntry(id) {
        if(this.log) console.log('Adding select entry...');
        let option = document.createElement("option");
        option.text = id;
        option.id = id;
        document.getElementById('peerSelect').add(option); 
        // console.log(option, document.getElementById('peerSelect'));
        if(this.log) console.log('Adding select entry... - done!');
    }

    /**
     * just for testing
     */
    _removeMuteEntry(id) {
        if(this.log) console.log('Removing select entry...');
        $(`#peerSelect option[id='${id}']`).remove();
        if(this.log) console.log('Removing select entry... - done!');
    }

    create(id, socket, offering, ...args) {
        if(this.log) console.log(`AudioClientManager.create w/ id = ${id}`); // TODO: remove this!
        if(!this.clients[id]) {
            // create Client object and set custom property
            const netProps = Object.assign({}, this.config);
            netProps.id = id;
            netProps.socket = socket;
            netProps.offering = offering;

            this.jitterData[id] = [];

            // this.clients[id] = new AudioClient( // TODO: use this and implement loopback!
            this.clients[id] = new AudioPeer(
                netProps,
                // audioProps
                {
                    circularBufferTransfer: this.circularBufferTransfer,
                    audioContext: this.audioContext,
                    audioReceiverNode: this.audioReceiverNode,
                },
                this.jitterData[id],
                this.log,
            );

            // just for testing
            this._createMuteEntry(id);
        }
        else
            console.error(`AudioClientManager.create client w/ id = ${id} still exists`);
    }
    
    /**
     * get how many clients are actually connected
     * @returns {Number} length
     */
    getLength() {
        return Object.keys(this.clients).length;
    }

    /**
     * setup an existing client
     * @param {String} id 
     */
    setup(id) {
        if(this.log) console.log('AudioClientManager.setup'); // TODO: remove this!
        // if(this.clients[id] && this.localVideoStream && this.localAudioStream)
        if(this.clients[id])
            this.clients[id].setup();
    }

    /**
     * remove a client from the list
     * @param {String} id 
     */
    remove(id) {
        if(this.log) console.log(`AudioClientManager.remove w/ id = ${id}`); // TODO: remove this!
        if(this.clients[id] !== undefined) {
            // close PeerConnection and remove it from the array
            this.clients[id].remove();
            delete this.clients[id];

            // just for testing
            this._removeMuteEntry(id);
        }
        else
            console.error(`AudioClientManager.remove client w/ id = ${id} not found`);
    }

    /**
     * forward audio data to all peers
     * @param {ArrayBuffer} buffer 
     */
    sendAudioToAll(buffer) {
        for(let key in this.clients)
            this.clients[key].sendAudio(buffer);

    }

    /**
     * forward control data to all peers
     * @param {ArrayBuffer} buffer 
     */
    sendControlToAll(buffer) {
        for(let key in this.clients)
            this.clients[key].sendControl(buffer);
    }
    // TODO: check which worker is involved. If all in main thread, consider using promises and Promise.all()

    /**
     * 
     * @param {Function} cb 
     *      params:
     *          - client
     *          - prevRetVal: return value on the previous client
     * @returns {any} last value of prevRetVal
     */
    forEach(cb) {
        let prevRetVal = null;
        for(let key in this.clients) {
            prevRetVal = cb(this.clients[key], prevRetVal);
        }
        return prevRetVal;
    }
    // TODO: modify these functions

    createAndSendOffer(id) {
        // create and send the offer
        return this.clients[id].createAndSendOffer();
    }

    createAndSendAnswer(id) {
        // set remote description, create and send answer
        return this.clients[id].createAndSendAnswer();
    }

    setRemoteDescription(id, desc) {
        // set remote description, create and send answer
        return this.clients[id].setRemoteDescription(desc);
    }

    addIceCandidate(id, candidate) {
        return this.clients[id].addIceCandidate(candidate);
    }
}
export default AudioClientManager;