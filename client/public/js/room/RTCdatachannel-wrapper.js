'use strict';

import AudioCircularBuffer from './audio-circular-buffer.js';
import PacketManager from './packet-manager.js';

/**
 * @author Gastaldi Paolo
 * 
 * extend RTCDataChannel operations
 * comunication w/ circular buffer
 */
class RTCDataChannelWrapper {
    rtcDataChannel = null;

    /**
     * class constructor
     * @param {RTCDataChannel} rtcDataChannel
     * @param {Object} circularBufferTransfer
     * @param {...any} args
     */
    constructor(rtcDataChannel, circularBufferTransfer, ...args) {
        this.config = args[0];
        this.audioProps = args[1];
        this.jitterData = args[2];
        this.log = args[3];
        this.audioContext = this.audioProps.audioContext;
        this.audioReceiverNode = this.audioProps.audioReceiverNode;

        this.rtcDataChannel = rtcDataChannel;

        this.circularBuffer = new AudioCircularBuffer(this.config, circularBufferTransfer, true, this.log); // this is a data source

        this.expectedPacket_n = null;
        this.discardedPackets = null;
        this.isOpen = false;

        // for testing only
        this.mute = false;

        this.latestPacket = null;
        this.packet_nOffset = null;

        this.discardedPackets = 0;
        this.isNetworkLoopback = new Uint8Array(new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT));
        Atomics.store(this.isNetworkLoopback, 0, this.useAudioLoopback && this.config.audioLoopbackType == 'networkLoopback');
        this.latestPacket_nForwarded = null;
        this.lastestPacket_nSent = 0n;

        // for testing only
        this.packetManager = new PacketManager(
            this.log,
            0,
            this.config.useTestSamples,
            this.config.audioContextOptions.sampleRate,
            this.config.windowSize,
            this.config.channelCount
        );
        this.emptyPacket = this.packetManager.create({
            samples: new Array(this.config.channelCount)
        }, true);
        this.emptyPacket = PacketManager.parse(this.emptyPacket);

        if(this.log) console.log(`RTCDataChannelWrapper.constructor: created!`);
    }

    /**
     * tracking jitter
     * just for testing
     * @param {String} event 
     * @param {Object} packet 
     */
    async _trackJitter(event, packet) {
        // init support variables
        if(!this.jitterData) this.jitterData = [];
        if(!this.jitterData[event]) this.jitterData[event] = {
            initTime: performance.now(),
            firstPacket_n: packet.packet_n,
            data: [],
        };
        // if(!this._timeStep) this._timeStep = 128. * 1000. / this.audioContext.sampleRate; // in milliseconds
        if(!this._timeStep) this._timeStep = 128. * 1000. / this.config.audioContextOptions.sampleRate;  // in milliseconds

        // compute jitter
        const now = performance.now();
        let obj = this.jitterData[event];
        let _relativePacket_n = Number(packet.packet_n - obj.firstPacket_n);
        let _expectedInterval = _relativePacket_n * this._timeStep;
        let _currentInterval = now - obj.initTime;
        let _jitter = _currentInterval - _expectedInterval;

        obj.data.push({
            x: _relativePacket_n,
            y: Number(_jitter),
            jitter: Number(_jitter),
            currentInterval: _currentInterval,
            expectedInterval: _expectedInterval,
            performanceNow: now,
        });
    }

    /**
     * tracking jitter for a specific event: enqueue
     * just for testing
     * @param {String} isBefore - before enqueue or after enqueue
     * @param {Object} packet 
     */
    async _trackJitterForEnqueue(isBefore, packet) {
        if(isBefore)
            this._initEnqueue = performance.now();
        else {
            let obj = this.jitterData['enqueue'];
            let _relativePacket_n = Number(packet.packet_n - obj.firstPacket_n);
            let _finiEnqueue = performance.now();
            let _jitter = _finiEnqueue - this._initEnqueue;
            obj.data.push({ x: _relativePacket_n, y: Number(_jitter) });
        }
     }

     /**
      * scale values, so that the minimumn jitter value is = 0
      */
    async _scaleJitterData() {
        if(!this.jitterData) return;

        for(let [key, obj] of Object.entries(this.jitterData)) {
            let min = Math.min(...obj.data.map(d => d.y));
            console.log(`min y for ${key} = ${min}`);
            for(let d of obj.data) {
                d.y -= min;
            }
        }
     }

    /**
     * just for testing
     * create jitter graph
     * see Chart.io docs for more details about what this functions does
     */
    async _printJitter() {
        if(!this.jitterData) return;

        let data = {
            datasets: [ {
                label: 'Received packets',
                data: this.jitterData['onreceive'].data,
                color: [ 'rgba(255, 0, 0, 0) '],
                backgroundColor: [ 'rgba(255, 99, 132, 0.2)', ],
                borderColor: [ 'rgba(255, 0, 0, 1) '], // red
            }, {
                label: 'Sent packets',
                data: this.jitterData['onsend'].data,
                color: [ 'rgba(0, 255, 0, 0) '],
                backgroundColor: [ 'rgba(255, 99, 132, 0.2)', ],
                borderColor: [ 'rgba(0, 255, 0, 1) '], // green
            } ]
        };
        const config = {
            type: 'scatter',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top', },
                    title: {
                        display: true,
                        text: 'Chart.js Scatter Chart'
                    }
                }
            },
            scales: {
                x: { display: true, },
                y: { display: true, }
            }
        };

        Chart.defaults.elements.point.radius = 1;
        let ctx = document.getElementById('myChart').getContext('2d');
        let myChart = new Chart(ctx, config);
        myChart.update();
    }
    
    /**
     * send data on the DataChannel
     * @param {ArrayBuffer} data
     */
    send(data) {
        if(! (this.rtcDataChannel && this.rtcDataChannel.readyState == 'open' && this.isOpen)) {
            if(this.log) console.error('RTCDataChannelWrapper not opened'); // TODO: remove this
            return;
        }

        // track jitter on send
        if(this.config.isJitterTracked) this._trackJitter('onsend',  PacketManager.parse(data)); // track jitter on acquisition, not on RTC sending
        
        // for network loopback packet, saved before sending for better sync
        this.lastestPacket_nSent = PacketManager.getPacketNumber(data);

        if(this.log) console.log('SENDING', PacketManager.getPacketNumber(data));
        this.rtcDataChannel.send(data);
    }

    /**
     * setup RTCDataChannel events
     */
    setup() {
        if(this.log) console.log('RTCDataChannelWrapper setup');

        this.rtcDataChannel.onopen = event => {
            if(this.log) console.log('RTCDataChannelWrapper opening...');
            // force the binary type to be ArrayBuffer
            this.rtcDataChannel.binaryType = 'arraybuffer';
            // this.sendAudioContextState();
            this.isOpen = true;
        };
        
        this.rtcDataChannel.onmessage = event => {
            if(! (this.rtcDataChannel.readyState == 'open' && this.isOpen)) {
                if(this.log) console.error('RTCDataChannelWrapper not opened anymore');
                return;
            }

            let data = event.data;

            // track jitter on receive
            if(this.config.isJitterTracked) this._trackJitter('onreceive', { packet_n: PacketManager.getPacketNumber(data) });

            // network loopback
            if(this.isNetworkLoopback != undefined && Atomics.load(this.isNetworkLoopback, 0)) {
                if(!this.latestPacket_nForwarded)
                    this.latestPacket_nForwarded = this.lastestPacket_nSent;
                PacketManager.replacePacketNum(data, this.latestPacket_nForwarded++);
                if(this.log) console.log('FORWARDING', PacketManager.getPacketNumber(data));
                this.send(data);
                return;
            }

            if(this.log) console.log('RECEIVING', PacketManager.getPacketNumber(data));
            let packet = PacketManager.parse(data);

            // for testing only
            if(this.mute && this.emptyPacket) {
                let oldPacket = packet;
                packet = this.emptyPacket;
                packet.packet_n = oldPacket.packet_n;
            }

            // gain envelop on first packet // TODO: check if this works!
            let envelop = null;
            if(!this.latestPacket)
                envelop = 'fade in';

            // for testing only
            let packetLastBits = Number(packet.packet_n & 65535n);
            if(this.log && packetLastBits%50==0) { // log every 50 packets (50 = random value)
                let performanceInit = performance.now();
                console.log(JSON.stringify([ packetLastBits, this.audioContext.currentTime, performanceInit, 'RTCDataChannelWrapper packet received (1)' ]));

                if(this.config.useMessageChannel)
                    this.audioReceiverNode.port.postMessage({ type: 'packet', packet: packet, packetLastBits: packetLastBits, performanceInit: performanceInit, envelop: envelop });
                else
                    // insert packet in queue
                    this.circularBuffer.enqueue(packet, envelop);
                    
                let performanceFini = performance.now();
                console.log(JSON.stringify([ packetLastBits, this.audioContext.currentTime, performanceFini, 'RTCDataChannelWrapper enqueued (3)' ]));
                console.log(`${packetLastBits}, RTCDataChannelWrapper summary: enqueued time = ${performanceFini-performanceInit} ms`);
            }
            else {
                if(this.config.useMessageChannel)
                    this.audioReceiverNode.port.postMessage({ type: 'packet', packet: packet, envelop: envelop });
                else
                    // insert packet in queue
                    this.circularBuffer.enqueue(packet, envelop);
            }
            
            this.latestPacket = packet;
        };

        this.rtcDataChannel.onclose = event => {
            if(this.log) console.log('RTCDataChannelWrapper closing...');
            this.isOpen = false;

            let packet = this.latestPacket;
            if(packet) {
                packet.packet_n++;

                if(this.config.useMessageChannel)
                    this.audioReceiverNode.port.postMessage({ type: 'packet', packet: packet, envelop: 'fade out' });
                else
                    // gain envelop on last packet // TODO: check if this works!
                    this.circularBuffer.enqueue(packet, 'fade out'); // insert packet in queue
                this.latestPacket = null;
            }

            if(this.circularBuffer) this.circularBuffer.destroy();
            this.circularBuffer = null;

            // just for testing
            // if(this.config.isJitterTracked)
            //     this._scaleJitterData();
            if(this.config.drawJitterGraphOnClose)
                this._printJitter(); // TODO: remove this!
        };

        this.rtcDataChannel.onerror = event => {
            if(this.log) {
                console.log('RTCDataChannelWrapper error');
                console.error(event);
            }
        }
    }

    /**
     * close this data connection
     * free all resources
     */
    close() {
        if(!this.isOpen)
            return;
        
        if(this.rtcDataChannel) this.rtcDataChannel.close();
        this.rtcDataChannel = null
    }
}
export default RTCDataChannelWrapper;