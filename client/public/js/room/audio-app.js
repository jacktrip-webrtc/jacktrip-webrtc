'use strict';

import AudioClientManager from './audio-client-manager.js';
import { isEmpty, getRoomId } from './utils.js';
import AudioCircularBuffer from './audio-circular-buffer.js';
import { AudioSenderNode, AudioReceiverNode, AudioSenderReceiverNode, AudioTestNode, AudioBeepGeneratorNode, AudioBeepAnalyzerNode } from './audio-modules/audio-nodes.js';
import PacketManager from './packet-manager.js';

let gAudioInput = null;
let gAudioContext = null;

/**
 * @author Sacchetto Matteo
 * @author Gastaldi Paolo
 * 
 * refactoring of jacktrip-webRTC app for new architecture
 */
class AudioApp {
    /**
     * constructor
     * @param {Object} props
     * @param {...any} args
     */
    constructor(props, ...args) {
        this.window = props.window || null;
        this.navigator = props.navigator || null;
        this.audio = props.audio || null;

        // audio status
        this.status = 'init';

        // tracks
        this.audioInputStream = this.audioInputStream ?? new MediaStream();
        // this.videoStream = new MediaStream();

        // track status
        this._username = '';

        // audio chain
        this.audioContext = null;
        this.audioChain = [];
        this.input = null;
        this.audioSenderNode = null;
        this.audioReceiverNode = null;
        this.audioTestNode = null;
        this.audioBeepGeneratorNode = null;
        this.audioBeepAnalyzerNode = null;

        this.audioGainNode = null;

        this.packetManager = null;
        
        // audio chain receiving support structures
        this.rxQueue = null; // receiving circular buffer

        // Atomics.waitAsync support structures
        this.txQueue = null; // transmission circular buffer
        this.waitAsyncNotificationSharedBuffer = null; // shared buffer for Atomics.waitAsync and Atomics.notify
        
        // socket
        this.socket = null;

        // for jitter tracking
        // it has to be enabled from config
        this.jitterData = {};

        this.log = false;

        this.isSenderMutedSharedBuffer = null;
        this.isReceiverMutedSharedBuffer = null;
        this.isReceiverSilentSharedBuffer = null;
        this.isBeepGeneratorMutedSharedBuffer = null;
        this.isBeepAnalyzerMutedSharedBuffer = null;
    }

    async _setupCircularBuffers(config, runtimeConfig) {
        this._isFullLocalLoopback = this.config.useAudioLoopback && this.config.audioLoopbackType == 'fullLocalLoopback';
        if(this._isFullLocalLoopback)
            this.rxQueue = this.rxQueue ?? new AudioCircularBuffer(config, null, true, this.config.LOG_DATA, config.balancedOffset); // is data source
        else
            this.rxQueue = this.rxQueue ?? new AudioCircularBuffer(config, null, false, this.config.LOG_DATA, config.balancedOffset);

        if(this.config.useWaitAsync) {
            // for Atomics.waitAsync case only, a second circular buffer is needed
            // queue for trasmission, as Atomics.notify - Atomics.waitAsync are not synchronized
            // IMPORTANT: this is NOT a de-jitter buffer
            // so the index offset between the write index (for enqueue) and the read index (for dequeue) must be 0
            this.txQueue = this.txQueue ?? new AudioCircularBuffer(config, null, false, this.config.LOG_DATA, false, config.waitAsyncMinBufferOffset);

            // for the notification event, a SharedArrayBuffer have to be shared between threads
            // this array is useless, but used by Atomics.notify and Atomics.waitAsync to send events
            this.waitAsyncNotificationSharedBuffer = this.waitAsyncNotificationSharedBuffer ?? new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
            this.waitAsyncNotificationSharedBuffer[0] = 0;
        }
    }

    /**
     * setup
     * @param {Object} config
     * @async
     */
    async setup(config) {
        this.config = config;

        this.log = this.config.LOG_DATA;

        // get room
        this.runtimeConfig = { roomId: getRoomId(this.window) };

        // setup submodules
        await this._setupCircularBuffers(this.config, this.runtimeConfig);
        await this._setupAudioChain(this.config, this.runtimeConfig);
        await this._setupSocket(this.config, this.runtimeConfig);

        // AudioClientManager needs the audio chain already configured
        this.clientManager = this.clientManager ?? new AudioClientManager(
            this.rxQueue.share(),
            config,
            this.audioContext,
            this.audioReceiverNode,
            this.jitterData,
            this.log,
        );
    }

    _printArch() {
        // some useful architecture logs at the end of setup
        if(this.log || this.config.showArchitectureInfo) {
            let archString = '';

            this.audioChain.forEach((audioNode, i) => {
                let name = audioNode.name;
                if(!name) name = i == 0 ? 'input' : 'output';
                i != 0 ? archString += '\n' : '';
                archString += `${i++} - ${name}`;
            });

            let systemString = `=== SYSTEM OVERVIEW ===

                --- ARCHITECTURE ---
                ${archString}

                --- COMMUNICATION ---
                using MessageChannel on receiving:                          ${this.config.useMessageChannel}
                using SharedArrayBuffer on receiving:                       ${!this.config.useMessageChannel}
                using Atomics.waitAsync on trasmission:                     ${this.config.useWaitAsync}
                using SharedArrayBuffer to control AudioWorkletProcessor:   ${this.config.useSharedBufferForProcessorStatus}

                --- AUDIO ---
                AudioContext state:                                         ${this.audioContext.state}
                audioContext sample rate [Hz]:                              ${this.audioContext.sampleRate}
                configuration sample rate [Hz]:                             ${this.config.audioContextOptions.sampleRate}
                window size:                                                ${this.config.windowSize}

                --- CIRCULAR BUFFER ---
                circular buffer size:                                       ${this.config.queueSize}
                enqueue/dequeue index offset:                               ${this.config.circularBufferOffset}

                --- TEST ---
                using test samples:                                         ${this.config.useTestSamples}
                using beep generator and analyzer:                          ${this.config.useBeepGeneratorAndAnalyzer}
                looback:                                                    ${this.config.useAudioLoopback ? this.config.audioLoopbackType : 'false'}
            `;

            let trimmedString = '';
            systemString.split('\n').forEach((s, i) => trimmedString += i != 0 ? '\n' + s.trim() : s.trim());
            console.log(trimmedString);
        }
    }

    /**
     * setup socket and event handlers
     * @param {Object} config
     * @param {Object} runtimeConfig
     * @private
     */
    _setupSocket(config, runtimeConfig) {
        // start socket connection
        this.socket = io.connect('/room', { transports: ['websocket'], rejectUnauthorized: false });

        // set event listeners
        // if the room exists try to join it
        this.socket.on('room-checked', (exists, error) => {
            if(this.log) console.log('socket: room-checked');
            if(exists) {
                if(this.log) console.log('socket.emit join');
                this.socket.emit('join', runtimeConfig.roomId);
            }
            else
                console.error(error);
        });
        
        // once room has been joined
        this.socket.on('joined', async(clients) => {
            if(this.log) console.log('socket: joined');

            if(this.config.USE_MEDIA_AUDIO)
                // stop audioContext
                this.audioContext.suspend();

            // create a peer connection for each client
            clients.forEach((id, index) => {
                // I will be the one sending the offer -> true
                this.clientManager.create(id, this.socket, true);
            });

            // leave the room when I leave the page
            this.window.onunload = () => {
                if(this.log) console.log('socket.emit leave');
                this.socket.emit('leave');

                // stop all peerConnections
                this.clientManager.forEach(client => this.clientManager.remove(client.id));
            }

            clients.forEach((id, index) => {
                this.clientManager.setup(id);

                // create and send the offer
                this.clientManager.createAndSendOffer(id);
            });

            if(this.clientManager.getLength() > 0)
                await this.play(); // now start playing
        });

        // when a new client connects to the room
        this.socket.on('new client', async (id) => {
            if(this.log) console.log('socket: new client');
            
            // create the new peer connection
            // I will not be the one sending the offer -> false
            this.clientManager.create(id, this.socket, false);
            this.clientManager.setup(id); // setup the new client

            if(this.status != 'play' && this.status != 'silence')
                await this.play(); // now start playing
        });

        // when a client lefts the room
        this.socket.on('client left', async (id) => {
            if(this.log) console.log('socket: client left');
            this.clientManager.remove(id); // remove client from clients list

            if(this.log) console.log(`number of clients still connected: ${this.clientManager.getLength()}`);

            // standby for less effort
            if(this._canStanby()) {
                let _prevStatus = this.status;
                await this.pause();
                this.status = _prevStatus == 'silence' ? _prevStatus : 'standby';
            }

        });

        // handle incoming offers
        this.socket.on('incoming offer', (offer, id) => {
            if(this.log) console.log('socket: incoming offer');
            
            // set remote description, create and send answer
            this.clientManager.setRemoteDescription(id, offer)
            .then(() => { this.clientManager.createAndSendAnswer(id); })
            .catch(console.error);
        });

        // hadle incoming answers
        this.socket.on('incoming answer', (answer, id) => {
            if(this.log) console.log('socket: incoming answer');
            this.clientManager.setRemoteDescription(id, answer);
        })

        // errors in the process will be reported here
        this.socket.on('communication error', (error) => {
            if(this.log) console.log('socket: communication error');
            console.error(error);
        });

        // handle signaling of ICE candidate
        this.socket.on('new candidate', (candidate, id) => {
            if(this.log) console.log('socket: new candidate');
            this.clientManager.addIceCandidate(id, candidate);
        });

        this.socket.on('error', (error) => {
            if(this.log) console.log('socket: generic error');
            console.error(error);
        })

        // enter the room
        fetch('/room/turn')
        .then(async (response) => {
            if(this.log) console.log('socket.emit check-room');
            const turn = await response.json();
            if(!isEmpty(turn)) {
                if(this.log) console.log('add turn server:', turn);
                config.peerConfiguration.iceServers.push(turn); // add the TURN server in the array
                this.clientManager.config.peerConfiguration.iceServers.push(turn);
            }
            this.socket.emit('check-room', runtimeConfig.roomId);
        })
        .catch(console.error);
    }

    /**
     * manage Atomics.waitAsync recursive function for transmission queue extraction
     * @private
     * @async
     */
    async _manageWaitAsyncPromise() {
        if(this.log) console.log(`AudioApp, calling waitAsync`);
        
        let ret = Atomics.waitAsync(this.waitAsyncNotificationSharedBuffer, 0, 0, this.config.waitAsyncTimeout);
        if(ret && ret.async) { // if async, ret.value is a Promise
            ret.value
            .then((res) => {
                if(this.log) console.log(`AudioApp, waitAsync resolved`);
                if(res == 'ok') {
                    while(this.txQueue.hasData() > 0) { // check if the queue has data
                        let buffer = null;

                        if(this.config.useTestSamples) {
                            buffer = this.packetManager.create({
                                    source: { channelCount: this.config.nChannels }
                                }, true); // fill the packet w/ fake samples
                            this.txQueue.eraseNext(); // keep the queue index running
                        }
                        else { // standard case
                            buffer = this.packetManager.create({
                                    source: { channelCount: this.config.nChannels }
                                }, false); // do not fill samples, set header only
                            this.txQueue.dequeue(new Int16Array(buffer), true, true); // wants Int16 samples and has header
                        }

                        // if(this.log) console.log('DEQUEUEING', PacketManager.getPacketNumber(buffer), buffer);
                        if (this._isFullLocalLoopback) {
                            let packet = PacketManager.parse(buffer);
                            this.rxQueue.enqueue(packet);
                        }
                        else
                            this.clientManager.sendAudioToAll(buffer); // forward to all peers
                    }
                }

                // recursive function call at the end, to avoid buffer overflow
                return this._manageWaitAsyncPromise(); // recursion
            })
            .catch((err) => {
                if(this.log) console.error(err);
                return this._manageWaitAsyncPromise(); // recursion, even if errors
            });
        };
    }

    /**
     * create audio chain
     * @param {Object} config
     * @param {Object} runtimeConfig
     * @private
     * @async
     */
    async _setupAudioChain(config, runtimeConfig) {
        this.config = config; // For testing only
        // audio context
        if (this.config.enableDynamicConfig && gAudioContext != null) {
            this.audioContext = gAudioContext;
            console.log('AudioContext resumed from previous config!');
        }
        else
            this.audioContext = new AudioContext(config.audioContextConfig);
        gAudioContext = this.audioContext;

        console.log(`AudioContext created! Current state: ${this.audioContext.state}`);
        globalAudioContext = this.audioContext; // for browser debugging only

        // import workers
        await Promise.all([
            this.audioContext.audioWorklet.addModule('/js/room/audio-modules/audio-sender-processor.js'),
            this.audioContext.audioWorklet.addModule('/js/room/audio-modules/audio-receiver-processor.js'),
            this.audioContext.audioWorklet.addModule('/js/room/audio-modules/audio-sender-receiver-processor.js'),
            this.audioContext.audioWorklet.addModule('/js/room/audio-modules/audio-test-processor.js'),
            this.audioContext.audioWorklet.addModule('/js/room/audio-modules/audio-beep-generator-processor.js'),
            this.audioContext.audioWorklet.addModule('/js/room/audio-modules/audio-beep-analyzer-processor.js'),
        ]); // load all modules, even if some of them wont be used

        // get input stream
        if (this.config.enableDynamicConfig && gAudioInput != null) {
            this.input = gAudioInput;
            console.log('Resume input node from previous usage');
        }
        else {
            const audioStream = await this.navigator.mediaDevices.getUserMedia(config.mediaConfiguration);
            audioStream.getAudioTracks().forEach((track) => this.audioInputStream.addTrack(track));
            this.input = this.audioContext.createMediaStreamSource(this.audioInputStream);
        }
        gAudioInput = this.input;

        if (!this.audioGainNode && this.config.useGainNode) {
            this.audioGainNode = new GainNode(this.audioContext);
            this.audioGainNode.gain.setTargetAtTime(0., this.audioContext.currentTime, 0.);
            this.input.connect(this.audioGainNode);
            this.audioGainNode.connect(this.audioContext.destination);
        }

        // create audioNodes and connect audio chain
        // I've to explicit all configurations
        // sorry, this following code will be boring to read :(
        // when 'audioContext.destination' is connected, the chain start
        // this cause some errors in second to last audio processor input format
        if(this.config.useBeepGeneratorAndAnalyzer) {
            // create audio nodes
            this.audioBeepGeneratorNode = this.audioBeepGeneratorNode ?? new AudioBeepGeneratorNode(this.audioContext);
            this.audioBeepAnalyzerNode = this.audioBeepAnalyzerNode ?? new AudioBeepAnalyzerNode(this.audioContext);

            // create shared values for beep generator/analyzer
            this.isBeepGeneratorMutedSharedBuffer = this.isBeepGeneratorMutedSharedBuffer ?? new Uint8Array(new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT)); // beep generator mute flag
            Atomics.store(this.isBeepGeneratorMutedSharedBuffer, 0, 1); // default = true
            this.isBeepAnalyzerMutedSharedBuffer = this.isBeepAnalyzerMutedSharedBuffer ?? new Uint8Array(new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT)); // beep analyzer mute flag
            Atomics.store(this.isBeepAnalyzerMutedSharedBuffer, 0, 1); // default = true
            this.lastPeakBuffer = this.lastPeakBuffer ?? new BigUint64Array(new SharedArrayBuffer(BigUint64Array.BYTES_PER_ELEMENT)); // temporal value for delay computation
            Atomics.store(this.lastPeakBuffer, 0, 0n);
            this.frameCounterBuffer = this.frameCounterBuffer ?? new Uint16Array(new SharedArrayBuffer(Uint16Array.BYTES_PER_ELEMENT)); // count frame number for beep generation
            Atomics.store(this.frameCounterBuffer, 0, 0); // default = 0

            // merge all config into a single config object
            let config = {
                type:                               'config',
                useSharedBufferForProcessorStatus:  this.config.useSharedBufferForProcessorStatus,
                lastPeakBuffer:                     this.lastPeakBuffer,
                isBeepGeneratorMutedSharedBuffer:   this.isBeepGeneratorMutedSharedBuffer,
                isBeepAnalyzerMutedSharedBuffer:    this.isBeepAnalyzerMutedSharedBuffer,
                frameCounterBuffer:                 this.frameCounterBuffer,
            }

            // send config to audio processors
            this.audioBeepGeneratorNode.port.postMessage(config);
            this.audioBeepAnalyzerNode.port.postMessage(config);
        }

        if(this.log) console.log(`useAudioLoopback = ${this.config.useAudioLoopback}, audioLoopbackType = ${this.config.audioLoopbackType}`);
        if(this.config.useAudioLoopback) { // manage looback modules
            switch(this.config.audioLoopbackType) {
                case 'directForwardLoopback':
                    // no AudioNode to add
                    break;
                case 'basicForwardLoopback':
                    this.audioTestNode = this.audioTestNode ?? new AudioTestNode(this.audioContext);

                    this.audioChain.push(this.audioTestNode);
                    break;
                default: // local, fullLocal and network loopback
                    if(this.config.useSingleAudioThread) {
                        this.audioSenderReceiverNode = this.audioSenderReceiverNode ?? new AudioSenderReceiverNode(this.audioContext);
                        this.audioSenderNode = this.audioSenderReceiverNode;
                        this.audioReceiverNode = this.audioSenderReceiverNode;
                        
                        this.audioChain.push(this.audioSenderReceiverNode);
                    }
                    else {
                        this.audioSenderNode = this.audioSenderNode ?? new AudioSenderNode(this.audioContext);
                        this.audioReceiverNode = this.audioReceiverNode ?? new AudioReceiverNode(this.audioContext);

                        this.audioChain.push(this.audioSenderNode);
                        this.audioChain.push(this.audioReceiverNode);
                    }
            }
        }
        else { // standard case
            if(this.config.useSingleAudioThread) {
                this.audioSenderReceiverNode = this.audioSenderReceiverNode ?? new AudioSenderReceiverNode(this.audioContext);

                // the same AudioNode is considered as 2 AudioNodes, for legacy compatibility
                this.audioSenderNode = this.audioSenderReceiverNode;
                this.audioReceiverNode = this.audioSenderReceiverNode;
                
                this.audioChain.push(this.audioSenderReceiverNode);
            }
            else {
                this.audioSenderNode = this.audioSenderNode ?? new AudioSenderNode(this.audioContext);
                this.audioReceiverNode = this.audioReceiverNode ?? new AudioReceiverNode(this.audioContext);

                this.audioChain.push(this.audioSenderNode);
                this.audioChain.push(this.audioReceiverNode);
            }
        }

        if(this.config.useBeepGeneratorAndAnalyzer) {
            this.audioChain.unshift(this.audioBeepGeneratorNode); // insert at the beginning
            this.audioChain.unshift(this.audioBeepAnalyzerNode); // insert at the beginning
            // basic looback: the delay computed is:
            // generator -> speaker -> mic -> analyzer

            // local loopback: the delay computed w/ 1 peer only:
            // generator_1 -> tx_1 -> rx_1 -> speaker -> mic -> analyzer_1
            
            // network loopback: the delay computed between 2 peers is:
            // generator_1 -> tx_1 -> rx_2 -> tx_2 -> rx_1 -> speaker -> mic -> analyzer_1

            // (where tx: transmitter, rx: receiver, _1/_2: peer count)
        }

        // fixed init and fini AudioNode
        this.audioChain.unshift(this.input); // insert at the beginning
        this.audioChain.push(this.audioContext.destination);

        // tmp variables as they cannot be transferred w/ postMessage
        let _config = {};
        for(let key in this.config) _config[key] = this.config[key]; // copy all values
        let _isLocalLoopback = this.config.useAudioLoopback && this.config.audioLoopbackType == 'localLoopback';

        // prepare audio processor configurations
        let _senderConfig = {
            type:           'config',
            log:            this.config.LOG_DATA,
            useTestSamples: this.config.useTestSamples,
            config:         _config,
        };
        if(_isLocalLoopback) {
            _senderConfig.isLocalLoopback =     _isLocalLoopback; // flag
            _senderConfig.rxCircularBuffer =    this.rxQueue.share(); // rx circular buffer
        }
        if(this.config.useWaitAsync) {
            _senderConfig.useWaitAsync =                        this.config.useWaitAsync; // flag
            _senderConfig.txCircularBuffer =                    this.txQueue.share(); // this case only needs 2 circular buffers, txQueue and rxQueue
            _senderConfig.waitAsyncNotificationSharedBuffer =   this.waitAsyncNotificationSharedBuffer; // sharedArrayBuffer where Atomics.notify() is used
        }
        let _receiverConfig = {
            type:               'config',
            log:                this.config.LOG_DATA,
            config:             _config,
            rxCircularBuffer:   this.rxQueue.share(),
            useMessageChannel:  this.config.useMessageChannel,
        }
        if(this.config.useSharedBufferForProcessorStatus) {
            // create shared buffers for tx/rx
            this.isSenderMutedSharedBuffer = this.isSenderMutedSharedBuffer ?? new Uint8Array(new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT));
            Atomics.store(this.isSenderMutedSharedBuffer, 0, 1); // default = true
            this.isReceiverMutedSharedBuffer = this.isReceiverMutedSharedBuffer ?? new Uint8Array(new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT));
            Atomics.store(this.isReceiverMutedSharedBuffer, 0, 1); // default = true
            this.isReceiverSilentSharedBuffer = this.isReceiverSilentSharedBuffer ?? new Uint8Array(new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT));
            Atomics.store(this.isReceiverSilentSharedBuffer, 0, 0); // default = false

            // update config object
            _senderConfig.isSenderMutedSharedBuffer = this.isSenderMutedSharedBuffer; // shared flag
            _receiverConfig.isReceiverMutedSharedBuffer = this.isReceiverMutedSharedBuffer; // shared flag
            _receiverConfig.isReceiverSilentSharedBuffer = this.isReceiverSilentSharedBuffer; // shared flag
        }

        // send audio processors configuration
        if(this.audioSenderNode && this.audioReceiverNode) {
            this.packetManager = new PacketManager(
                this.config.LOG_DATA,
                null,
                this.config.useTestSamples,
                this.config.sampleRate,
                this.config.windowSize,
                this.config.channelCount,
            );

            // send config to tx/rx AudioNodes
            this.audioSenderNode.port.postMessage(_senderConfig);
            this.audioReceiverNode.port.postMessage(_receiverConfig);
    
            // set event handlers to send data to other peers
            if(this.config.useWaitAsync)
                this._manageWaitAsyncPromise();
            else if(this._isFullLocalLoopback)
                // no modifications are required for the audio chain
                // only the main thread needs a different behaviour
                this.audioSenderNode.port.onmessage = event => {
                    let packet = PacketManager.parse(event.data);
                    this.rxQueue.enqueue(packet);
                };
            else 
                this.audioSenderNode.port.onmessage = event => this.clientManager.sendAudioToAll(event.data);
    
            // event handler for testing MessageChannel only
            this.audioReceiverNode.port.onmessage = event => {
                switch(event.data.type) {
                    case 'performance':
                        let performanceFini = performance.now();
                        if(this.log) console.log(JSON.stringify([ event.data.packetLastBits, this.audioContext.currentTime, performanceFini, 'AudioApp enqueued (4)' ]));
                        /*
                        time summary:
                            the system has done 3 operations:
                                1- send packet to AudioWorkletProcessor w/ MessageChannel
                                2- enqueue packet
                                1- send confirm back from AudioWorkletProcessor to here w/ MessageChannel
                            hp. enqueue packet time << MessageChannel time
                                => enqueue packet time = 0
                            so, the final time is divided by 2, considering only MessageChannel delays
                        */
                        if(this.log) console.log(`${event.data.packetLastBits}, AudioApp summary: enqueued time = ${(performanceFini-event.data.performanceInit)/2.} ms`);
                        break;
                    default:
                }
            };
        }

        // mount audio chain
        for(let i=1, currNode = this.audioChain[0]; i<this.audioChain.length; i++) // first node is this.input
            currNode = currNode.connect(this.audioChain[i]); // connect each node to the next one
        
        this.audio.load(); // reset audio
        await this.play();
        
        this._printArch();
    }

    /**
     * dealloc all resources
     */
    async _destroyAudioChain() {
        await this.pause();

        // detach the audio
        for(let i=0; i<this.audioChain.length-1; i++) { // Not the last one
            this.audioChain[i].disconnect();
        }

        // // detach the audio
        // if(this.audioBeepAnalyzerNode) this.audioBeepAnalyzerNode.disconnect();
        // if(this.audioReceiverNode) {
        //     this.audioReceiverNode.disconnect();
        //     this.audioReceiverNode.port.postMessage({ type: 'destroy' });
        // }
        // if(this.audioSenderNode) {
        //     this.audioSenderNode.disconnect();
        //     this.audioSenderNode.port.postMessage({ type: 'destroy' });
        // }
        // if(this.audioTestNode) this.audioTestNode.disconnect();
        // if(this.audioBeepGeneratorNode) this.audioBeepGeneratorNode.disconnect();
        // if(this.input) this.input.disconnect(this.audioSenderNode);

        // if(this.audioContext && !this.config.enableDynamicConfig) await this.audioContext.close();
        // else console.log("AudioContext not closed for future use");

        // destroy objects
        if(!this.config.enableDynamicConfig) {
            this.input = null;
            this.audioSenderNode = null;
            this.audioReceiverNode = null;
            this.audioTestNode = null;
            this.audioBeepGeneratorNode = null;
            this.audioBeepAnalyzerNode = null;
            this.audioContext = null;
        }
        this.audioChain = [];
    }

    /**
     * condition to decide if the system can standby or not
     * for avoid blocking during testing
     * @returns {Boolean} result
     */
    _canStanby() {
        return (!this.clientManager || this.clientManager.getLength() == 0) // if no peer connected...
            && !(this.config.useAudioLoopback && (
                this.config.audioLoopbackType == 'directForwardLoopback'
                || this.config.audioLoopbackType == 'basicForwardLoopback'
                || this.config.audioLoopbackType == 'localLoopback'
                || this.config.audioLoopbackType == 'fullLocalLoopback'
            )); // ...and not loopback mode so that I want to ear myself
    }

    /**
     * start audio chain
     * let's rock!
     * @async
     */
    async play() {
        if(this._canStanby()) {
            if(this.log) console.log('AudioApp: no other peers, so pause the app (avoid useless CPU effort)');
            await this.pause();
            this.status = 'standby';
            return;
        }

        if(this.log) console.log('AudioApp.play');

        // audio start
        if(this.audioContext) await this.audioContext.resume();

        if(this.config.useSharedBufferForProcessorStatus) {
            Atomics.store(this.isSenderMutedSharedBuffer, 0, 0);
            Atomics.store(this.isReceiverMutedSharedBuffer, 0, 0);
            Atomics.store(this.isReceiverSilentSharedBuffer, 0, 0);

            if(this.config.useBeepGeneratorAndAnalyzer) {
                Atomics.store(this.isBeepGeneratorMutedSharedBuffer, 0, 0);
                Atomics.store(this.isBeepAnalyzerMutedSharedBuffer, 0, 0);
            }
        }
        else {
            if(this.audioReceiverNode) this.audioReceiverNode.port.postMessage({ type: 'play' });
            if(this.audioSenderNode) this.audioSenderNode.port.postMessage({ type: 'play' });

            if(this.config.useBeepGeneratorAndAnalyzer) {
                if(this.audioBeepGeneratorNode) this.audioBeepGeneratorNode.port.postMessage({ type: 'play' });
                if(this.audioBeepAnalyzerNode) this.audioBeepAnalyzerNode.port.postMessage({ type: 'play' });
            }
        }

        this.status = 'play';
    }
    
    /**
     * mute my input
     * I will be able to listen to the others, but I wont send any data to them
     */
    async mute() {
        if(this.log) console.log('AudioApp.mute');
        
        if(this.config.useBeepGeneratorAndAnalyzer) {
            if(this.config.useSharedBufferForProcessorStatus)
                Atomics.store(this.isBeepGeneratorMutedSharedBuffer, 0, 1);
            else
                this.audioBeepGeneratorNode.port.postMessage({ type: 'mute' });
            return;
        }

        if(this.config.useSharedBufferForProcessorStatus)
            Atomics.store(this.isSenderMutedSharedBuffer, 0, 1);
        else
            if(this.audioSenderNode) this.audioSenderNode.port.postMessage({ type: 'mute' });

        this.status = 'mute';
    }

    /**
     * pause the whole audio chain
     * TODO: manage resync when play() is called to restart
     * @async
     */
    async pause() {
        if(this.log) console.log('AudioApp.pause');

        if(this.audioContext) await this.audioContext.suspend();

        if(this.config.useSharedBufferForProcessorStatus) {
            Atomics.store(this.isSenderMutedSharedBuffer, 0, 1);
            Atomics.store(this.isReceiverMutedSharedBuffer, 0, 1);

            if(this.config.useBeepGeneratorAndAnalyzer) {
                Atomics.store(this.isBeepGeneratorMutedSharedBuffer, 0, 1);
                Atomics.store(this.isBeepAnalyzerMutedSharedBuffer, 0, 1);
            }
        }
        else {
            if(this.audioSenderNode) this.audioSenderNode.port.postMessage({ type: 'pause' });
            if(this.audioReceiverNode) this.audioReceiverNode.port.postMessage({ type: 'pause' });

            if(this.config.useBeepGeneratorAndAnalyzer) {
                if(this.audioBeepGeneratorNode) this.audioBeepGeneratorNode.port.postMessage({ type: 'pause' });
                if(this.audioBeepAnalyzerNode) this.audioBeepAnalyzerNode.port.postMessage({ type: 'pause' });
            }
        }
        
        this.status = 'pause';
    }

    /**
     * silence the audio ouput
     * keep the audio chain working
     * @async
     */
    async silence() {
        if(this.log) console.log('AudioApp.silence');

        if(this.config.useSharedBufferForProcessorStatus)
            Atomics.store(this.isReceiverSilentSharedBuffer, 0, 1);
        else if(this.audioReceiverNode) this.audioReceiverNode.port.postMessage({ type: 'silence' });

        this.status = 'silence';
    }

    /**
     * @returns {Array} list of peer id
     */
    getPeerIds() {
        return Object.keys(this.clientManager.jitterData);
    }

    /**
     * @param {Number} peerId 
     */
    getJitterData(peerId) {
        return this.jitterData[peerId];
    }

    /**
     * destroy inner resources
     */
    async destroy() {
        await this.pause();
        if(this.log) console.log('AudioApp.destroy'); // TODO: remove this
        await this._destroyAudioChain();
        this.status = 'fini';
    }

    /**
     * activate/deactivate a sinusoid summed to the original input
     * @param {Boolean} status
     */
    async _setSinActive(status) {
        this.audioSenderNode.port.postMessage({ type: 'sin', isSinActive: status });
    }
}

export default AudioApp;