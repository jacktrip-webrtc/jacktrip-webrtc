'use strict';

import AudioPeer from './audio-peer.js';

/**
 * extend peer functionalities for the audio client
 * 
 * @author Sacchetto Matteo
 * @author Gastaldi Paolo
 */
class AudioClient extends AudioPeer {
    /**
     * constructor
     * @param {Object} netProps
     * @param {Object} audioProps
     * @param {...any} args 
     */
    constructor(netProps, audioProps,  ...args) {
        super(netProps, audioProps, ...args);

        this.config = netProps; // TODO: refactor this!

        this.id = netProps.id;
        this.socket = netProps.socket;
        // this.offering = netProps.offering;
        console.log(`AudioClient: socket is ${this.socket != 'undefined'}`);

        this.otherAudioContextRunning = false;
        this.name = ''; // name of the other peer
        this.createdPacket_n = -1; // keep track of the number of the created packet for loopback reasons
        this.loopback = false; // loopback at DataChannel level
        this.audioLoopback = false; // loopback at Audio level

        // function renaming
        this.destroy = this.remove;
    }
    
    // sendVideo = null;
    // sendAudio = null;
    // sendControl = null;

    // setup() {
    //     super.setup();
    //     console.log('AudioClient.setup');
    //     // this.peerConnection.setup();
    // }

    // remove() {
    //     // this.peerConnection.close();
    //     console.log('AudioClient.remove');
    //     super.remove();
    // }

    // setUpDataChannel() {
    //     super.setup();

    //     // // Listener for when the datachannel is closed
    //     // this.dataChannel.addEventListener('close', event => {
    //     //     this.localAudioSource.disconnect();
    //     //     this.localProcessingNode.disconnect();
    //     //     this.remoteProcessingNode.disconnect();
    //     //     console.log('Data channel closed');
    //     // });

    //     // Append new messages to the box of incoming messages
    //     // this.dataChannel.addEventListener('message', event => {
    //     //     /*
    //     //     bind with this
    //     //     I can use the dataChannel to send data
    //     //     */
    //     //     // this.dataChannel.send('test')
    //     //     // console.log(typeof this);

    //     //     if(!this.loopback) {
    //     //         // Get the ArrayBuffer
    //     //         let buf = event.data;

    //     //         // Get packet number
    //     //         let packet_n = Packet.getPacketNumber(buf);
    //     //         this.stats.totalPacketCounter++;

    //     //         // If packet_n is >= last packet received => send it to the processor
    //     //         // Otherwise drop it (to save time)
    //     //         if(packet_n >= this.packet_n){
    //     //             if(LOG_DATA) {
    //     //                 // Save the time at which we receive data
    //     //                 performance.mark(`data-received-${this.id}-${socket.id}-${packet_n}`);
    //     //             }

    //     //             // Process data (tranfer of ownership)
    //     //             let message = {
    //     //                 type: 'packet',
    //     //                 data: buf
    //     //             }
    //     //             this.remoteProcessingNode.port.postMessage(message);
    //     //             this.stats.packetReceivedCounter++;
    //     //         }
    //     //         else {
    //     //             if(LOG_DATA) {
    //     //                 // Save the time at which we discard data
    //     //                 performance.mark(`data-discarded-${this.id}-${socket.id}-${packet_n}`);
    //     //             }
    //     //             this.stats.packetDropCounter++;
    //     //         }

    //     //         if(packet_n % RTT_PACKET_N === 0) {
    //     //             // Send timing measure
    //     //             let message = {
    //     //                rtt: packet_n
    //     //             }
    //     //             this.controlChannel.send(JSON.stringify(message));
    //     //         }
    //     //     }
    //     //     else {
    //     //         // Replace the packet_n
    //     //         let buf = event.data;
    //     //         Packet.replacePacketNum(buf, this.createdPacket_n);
    //     //         this.createdPacket_n++;

    //     //         // Send the packet back
    //     //         this.dataChannel.send(event.data);
    //     //     }
    //     // });
    // }
}
export default AudioClient;