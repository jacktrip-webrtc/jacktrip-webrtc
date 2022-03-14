'use strict';

import RTCDataChannelWrapper from './RTCdatachannel-wrapper.js';

/**
 * manage a single peer connections
 * 
 * @author Gastaldi Paolo
 */
class AudioPeer {
    /**
     * constructor
     * @param {Object} netProps
     * @param {Object} audioProps
     * @param {...any} args
     */
    constructor(netProps, audioProps, ...args) {
        this.netProps = netProps;
        this.audioProps = audioProps;
        this.config = netProps; // TODO: refactor this!
        this.jitterData = args[0];
        this.log = args[1] || false;

        this.id = netProps.id;
        this.socket = netProps.socket;
        this.offering = netProps.offering;
        
        this.peerConnection = new RTCPeerConnection(this.config.peerConfiguration);
        this.dataChannel = null;
        this.controlChannel = null;

        // functions renaming (not working w/ inheritance)
        this.destroy = this.remove;
        this.close = this.remove;
    }

    sendAudio = (data) => {
        if(this.dataChannel) this.dataChannel.send(data);
        else if(this.log) console.error('no data channel');
    }

    sendVideo = null; // TODO: implement this
    sendControl = null; // TODO: implement this

    /**
     * setup all channels
     */
    setup() {
        if(this.log) console.log('AudioPeer.setup');

        // TODO: what does this code? useless?
        // this.peerConnection.addEventListener('datachannel', event => {
        //     console.log('created '+event.channel.label);
        //     switch (event.channel.label) {
        //       case 'audio':
        //         this.dataChannel = event.channel;
        //         this._setupDataChannel();
        //         break;
        //       case 'control':
        //         this.controlChannel = event.channel;
        //         this._setupControlChannel();
        //         break;
        //       default:
        //         // Nothing to be done
        //     }
        // });

        // listen for local ICE candidates on the local RTCPeerConnection
        this.peerConnection.onicecandidate = event => {
            if (event.candidate)
                // send the 'new candidate' to the interested client
                this.socket.emit('new candidate', event.candidate, this.id);
        }

        // ;isten for connection state changes
        this.peerConnection.onconnectionstatechange = event => {
            if (this.peerConnection.connectionState === 'connected') {
                if(this.log) console.log('connected');
            }
            if (this.peerConnection.connectionState === 'disconnected' || this.peerConnection.connectionState === 'closed') {
                // If the peer has disconnected remove it from the list
                // removePeer(this.id); // TODO: implement this
            }
        };

        if(this.log) console.log(`offering: ${this.offering}`);
        if(this.offering) {
            this._setupDataChannel();
            this._setupControlChannel();
        }
        else
            this.peerConnection.ondatachannel = event => {
                if(this.log) console.log('AudioPeer, created '+event.channel.label);
                switch(event.channel.label) {
                case 'audio':
                    this.dataChannel = new RTCDataChannelWrapper(
                        event.channel,
                        this.audioProps.circularBufferTransfer,
                        this.config,
                        this.audioProps,
                        this.jitterData,
                        this.log,
                    );
                    this._setupDataChannel();
                    break;
                case 'control':
                    this.controlChannel = event.channel;
                    this._setupControlChannel();
                    break;
                default:
                    // Nothing to be done
                }
            };
    }

    /**
     * @private
     */
    _setupDataChannel() {
        if(this.log) console.log('AudioPeer._setupDataChannel');
        if(this.offering) {
            if(this.log) console.log('AudioPeer, brand new RTCDataChannelWrapper');
            this.dataChannel = new RTCDataChannelWrapper(
                this.peerConnection.createDataChannel('audio', this.netProps.dataChannelConfiguration),
                this.audioProps.circularBufferTransfer,
                this.config,
                this.audioProps,
                this.jitterData,
                this.log,
            );
        }
        this.dataChannel.setup(); // event listeners are setted inside this class

        // function forward
        // this._sendAudio = this.dataChannel.send;
    }

    /**
     * @private
     */
    _setupControlChannel() {
        this.controlChannel = null;
        // this._sendAudio = null;
    }

    // /**
    //  * list of accepted events
    //  * @override
    //  */
    // static events = {
    //     beforeAudioSend: 'before-audio-send',
    //     afterAudioSend: 'after-audio-send',
    //     beforeAudioReceive: 'before-audio-receive',
    //     afterAudioReceive: 'after-audio-receive',
    // }

    // /**
    //  * use functions w/ event listeners
    //  * @override
    //  */
    // enableListeners() {
    //     console.log('AudioPeer.enableListeners');
    //     this.sendVideo = this._sendVideo;
    //     this.sendAudio = this.wrapWithListeners(this._sendAudio, { initEvent: 'before-audio-send', endEvent: 'after-audio-send' }, this);
    //     this.sendControl = this._sendControl;
    // }

    // /**
    //  * use functions w/o event listeners
    //  * @override
    //  */
    // disableListeners() {
    //     console.log('AudioPeer.disableListeners');
    //     this.sendVideo = this._sendVideo;
    //     this.sendAudio = this._sendAudio;
    //     this.sendControl = this._sendControl;
    // }

    async createAndSendOffer() {
        if(this.log) console.log('AudioClient.createAndSendOffer');

        // Create and send the offer
        this.peerConnection
        .createOffer(this.config.offerOptions)
        .then(async (offer) => {
            await this.peerConnection.setLocalDescription(offer);
            this.socket.emit('offer', offer, this.id);
        })
        .catch(console.error);
    }

    async createAndSendAnswer() {
        if(this.log) console.log('AudioClient.createAndSendAnswer'); // TOOD: remove this!

        // Set remote description, create and send answer
        this.peerConnection
        .createAnswer()
        .then(async (answer) => {
            await this.peerConnection.setLocalDescription(answer);
            this.socket.emit('answer', answer, this.id);
        })
        .catch(console.error);
    }

    setRemoteDescription(desc) {
        if(this.log) console.log('AudioClient.setRemoteDescription'); // TOOD: remove this!
        // set remote description, create and send answer
        return this.peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
    }

    addIceCandidate(candidate) {
        if(this.log) console.log('AudioClient.addIceCandidate'); // TOOD: remove this!
        this.peerConnection.addIceCandidate(candidate)
        .catch((e) => { console.error('Error adding received ice candidate', e); });
    }

    getStats() {
        if(this.log) console.log('AudioClient.getStats');
        
        this.peerConnection.getStats(null)
        .then(stats => {
            [...stats]
            .map(report => report[1])
            .filter(report => report.type === 'data-channel')
            .filter(report => report.label === "audio")
            .forEach(report => {
                if(this.log) console.log(report);
            });
        })
        .catch((e) => console.error(e));
    }

    /**
     * destroy this peer
     */
    remove() {
        if(this.log) console.log(`AudioPeer.remove`); // TODO: remove this
        if(this.dataChannel) this.dataChannel.close();
        if(this.controlChannel) this.controlChannel.close();
    }
}
export default AudioPeer;