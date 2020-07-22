'use strict'

// Connection method
// true -> Use MediaStream to send/receive audio
// false -> Use DataChannel and AudioWorklets
const USE_MEDIA_AUDIO = false;

// Loopback method
// true -> Use loopback at an audio level
// false -> Use loopback at the dataChannel level
const USE_AUDIO_LOOPBACK = true;

// Peer configuration
const configuration = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302' // STUN server
        }
    ]
};

// Peer offer options
const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};

// Audio context options
const audioContextOptions = {
    latencyHint: 'interactive',
    sampleRate: 48000
}

// Audio context
let audioContext = new AudioContext(audioContextOptions);

audioContext.onstatechange = () => {
    for(let id in peers) {
        peers[id].sendAudioContextState();
    }
}

// AudioWorklet for sending data
class DataSenderNode extends AudioWorkletNode {
  constructor(context) {
    super(context, 'data-sender-processor');
  }
}

// AudioWorklet for receiving data
class DataReceiverNode extends AudioWorkletNode {
    constructor(context) {
        super(context, 'data-receiver-processor');
    }
}

// Array containing peers
let peers = [];

// Functions
function createNewPeer(id, socket, offering) {
    if(peers[id] === undefined) {
        // Create Client object and set custom property
        peers[id] = new Client(id, socket, offering);
    }
}

function setUpPeer(id) {
    if(peers[id] !== undefined && localVideoStream !== undefined && localAudioStream !== undefined) {
        peers[id].setUp(localVideoStream, localAudioStream);
    }
}

function removePeer(id) {
    if(peers[id] !== undefined) {
        // Close PeerConnection and removeit from the array
        peers[id].remove();
        delete peers[id]
    }
}

function setUpDataChannel(id) {
    if(peers[id] !== undefined) {
        peers[id].setUpDataChannel();
    }
}

function setRemoteDescription(id, desc) {
    return peers[id].setRemoteDescription(desc);
}

function createAndSendOffer(id) {
    peers[id].createAndSendOffer();
}

function createAndSendAnswer(id) {
    peers[id].createAndSendAnswer();
}

function addIceCandidate(id, candidate) {
    peers[id].addIceCandidate(candidate);
}

class Client {
    constructor(id, socket, offering = false) {
        // Set attributes
        this.id = id;
        this.socket = socket;
        this.offering = offering;
        this.peerConnection = new RTCPeerConnection(configuration);
        this.remoteVideoStream = new MediaStream();
        this.remoteAudioStream = new MediaStream();
        this.sender = null;
        this.localAudioStream = null;
        this.localAudioSource = null;
        this.localProcessingNode = null;
        this.remoteProcessingNode = null;
        this.remoteAudioDestination = audioContext.createMediaStreamDestination();
        this.dataChannel = null;
        this.controlChannel = null;
        this.packet_n = 0;
        this.otherAudioContextRunning = false;
        this.name = ''; // Name of the other peer
        this.createdPacket_n = -1; // Keep track of the number of the created packet for loopback reasons
        this.loopback = false; // loopback at DataChannel level
        this.audioLoopback = false; // Loopback at Audio level
        this.remoteAudioLoopbackDestination = audioContext.createMediaStreamDestination();
        this.remoteAudioLoopbackDestinationToSource = audioContext.createMediaStreamSource(this.remoteAudioLoopbackDestination.stream); // This will be used as source of the audio worklet in case of loopback

        // Create DOM elements for peer stream
        let div = document.getElementById('stream-elements');
        this.container = document.createElement('div')
        this.container.classList = 'embed-responsive embed-responsive-4by3 w-100 col-lg-4 col-md-6 col-sm-12 py-0 px-0 bg-black rounded'

        this.videoElement = document.createElement('video');
        this.videoElement.id = `remote-video-${this.id}`;
        this.classList ='embed-responsive-item'
        this.videoElement.muted = true;
        this.videoElement.autoplay = true;
        // Attach stream
        this.videoElement.srcObject = this.remoteVideoStream;

        this.audioElement = document.createElement('audio');
        this.audioElement.id = `remote-audio-${this.id}`;
        this.audioElement.srcObject = null;

        let startAudioRemotePeer = () => {
            if(USE_MEDIA_AUDIO) {
                // Attach stream
                this.audioElement.srcObject = this.remoteAudioStream;
            }
            else {
                // Attach destination stream
                this.audioElement.srcObject = this.remoteAudioDestination.stream;
            }

            this.audioElement.autoplay = true;
        }

        if(document.getElementById('audio-output-button').audioId !== undefined  && (typeof this.audioElement.setSinkId === 'function')) {
            let sinkId = document.getElementById('audio-output-button').audioId;
            this.audioElement.setSinkId(sinkId)
            .then(() => {
                startAudioRemotePeer();
            })
            .catch(e => console.log(e));
        }
        else {
            startAudioRemotePeer();
        }

        // Create name badge
        this.remoteName = document.createElement('div');
        this.remoteName.id = `remote-name-${this.id}`;
        this.remoteName.classList = 'embed-responsive-item w-100 h-100 invisible';

        let innerDiv = document.createElement('div');
        innerDiv.classList = 'position-absolute bottom-left px-2 py-1 d-flex flex-row rounded mb-1 ml-1 bg-custom text-small';

        this.remoteNameDisplay = document.createElement('p');
        this.remoteNameDisplay.id = `local-name-display-${this.id}`
        this.remoteNameDisplay.classList = 'mb-0 text-white';
        this.remoteNameDisplay.innerText = '';

        innerDiv.appendChild(this.remoteNameDisplay);

        this.remoteName.appendChild(innerDiv);

        // Create mute badge
        this.muteMessage = document.createElement('div');
        this.muteMessage.id = `remote-mute-message-${this.id}`;
        this.muteMessage.classList = 'embed-responsive-item w-100 h-100 invisible';

        let innerDiv1 = document.createElement('div');
        innerDiv1.classList = 'position-absolute bottom-right px-2 py-1 d-flex flex-row rounded mb-1 mr-1 bg-custom text-small';

        let innerI1 = document.createElement('i');
        innerI1.classList = 'fas fa-microphone-slash text-danger my-auto mr-1';

        let innerP1 = document.createElement('p');
        innerP1.classList = 'mb-0 text-white';
        innerP1.innerText = 'Muted';

        innerDiv1.appendChild(innerI1);
        innerDiv1.appendChild(innerP1);

        this.muteMessage.appendChild(innerDiv1);

        // Create loopback badge
        this.loopbackMessage = document.createElement('div');
        this.loopbackMessage.id = `remote-loopback-message-${this.id}`;
        this.loopbackMessage.classList = 'embed-responsive-item w-100 h-100 invisible';

        let innerDiv2 = document.createElement('div');
        innerDiv2.classList = 'position-absolute z-index-1000 bottom-right px-2 py-1 d-flex flex-row rounded mb-1 mr-1 bg-custom text-small';

        let innerI2 = document.createElement('i');
        innerI2.classList = 'fas fa-undo text-blu my-auto mr-1';

        let innerP2 = document.createElement('p');
        innerP2.classList = 'mb-0 text-white';
        innerP2.innerText = 'Loopback';

        innerDiv2.appendChild(innerI2);
        innerDiv2.appendChild(innerP2);

        this.loopbackMessage.appendChild(innerDiv2);

        // Attach all the elements
        this.container.appendChild(this.videoElement);
        this.container.appendChild(this.audioElement);
        this.container.appendChild(this.remoteName);
        this.container.appendChild(this.muteMessage);
        this.container.appendChild(this.loopbackMessage);

        div.appendChild(this.container);
    }

    setUp(videoStream, audioStream) {
        // Add video tracks to peer
        videoStream.getVideoTracks().forEach(track => {
            this.sender = this.peerConnection.addTrack(track, videoStream)
        });

        audioStream.getAudioTracks().forEach(track => {
            this.sender = this.peerConnection.addTrack(track, audioStream)
        });

        // Save the localAudioStream
        this.localAudioStream = audioStream;

        if(!USE_MEDIA_AUDIO) {
            // Create audio source
            this.localAudioSource = audioContext.createMediaStreamSource(audioStream);
        }

        // Listen for local ICE candidates on the local RTCPeerConnection
        this.peerConnection.onicecandidate = event => {
            if (event.candidate) {
                // Send the 'new candidate' to the interested client
                this.socket.emit('new candidate', event.candidate, this.id);
            }
        }

        // Listen for connection state changes
        this.peerConnection.onconnectionstatechange = event => {
            if (this.peerConnection.connectionState === 'connected') {
                console.log('connected');
            }
            if (this.peerConnection.connectionState === 'disconnected' || this.peerConnection.connectionState === 'closed') {
                // If the peer has disconnected remove it from the list
                removePeer(this.id);
            }
        };

        // Listener for remote tracks
        this.peerConnection.addEventListener('track', (e) => {
            if(e.track.kind === 'video') {
                console.log('Video');
                this.addVideoTrack(e.track);
            }
            else if(e.track.kind === 'audio') {
                console.log('Audio');
                this.addAudioTrack(e.track);
            }
        });

        if(!USE_MEDIA_AUDIO) {
            // Node for sending data
            this.localProcessingNode = new DataSenderNode(audioContext);
            this.localProcessingNode.port.onmessage = (event) => {
                if(this.otherAudioContextRunning && this.dataChannel.readyState === 'open') {
                    switch (event.data.type) {
                        case 'performance':
                            // Keep track of when the packet has been created (when the process method of the AudioWorklet has been called)
                            performance.mark(`data-created-${socket.id}-${this.id}-${event.data.packet_n}`);
                            this.createdPacket_n = event.data.packet_n;
                            break;
                        case 'packet':
                            // Take the generated packet and send it to the other peer
                            let buf = event.data.buf;
                            let packet_n = Packet.getPacketNumber(buf);

                            if(this.dataChannel.readyState === 'open') {
                                // Send the ArrayBuffer
                                this.dataChannel.send(buf);
                            }

                            // Update the created pakcet num (for loopback reasons)
                            this.createdPacket_n++;

                            // Save time of sent data
                            performance.mark(`data-sent-${socket.id}-${this.id}-${packet_n}`);
                            break;
                        case 'loopback':
                            this.createdPacket_n = event.data.packet_n;
                            break;
                    }
                }
                else {
                    console.log('Not running')
                }
            };

            // Node for receiving data
            this.remoteProcessingNode = new DataReceiverNode(audioContext);
            this.remoteProcessingNode.port.onmessage = (event) => {
                switch (event.data.type) {
                    case 'packet_n-request':
                        // Update localPacket number for filtering (below)
                        this.packet_n = event.data.packet_n;
                        break;
                    case 'performance':
                        // Save time of sent data
                        performance.mark(`data-played-${this.id}-${socket.id}-${event.data.packet_n}`);
                        break;
                }
            };
        }

        if(this.offering) {
            // Create controlChannel (TCP)
            this.controlChannel = this.peerConnection.createDataChannel('control');
            this.setUpControlChannel();

            if(!USE_MEDIA_AUDIO) {
                // Create dataChannel (UDP - no retransmit)
                this.dataChannel = this.peerConnection.createDataChannel('audio', {maxRetransmits: 0, ordered: false});
                this.setUpDataChannel();
            }
        }
        else {
            // Listen for datachannel creation
            this.peerConnection.addEventListener('datachannel', event => {
                console.log('created '+event.channel.label);
                switch (event.channel.label) {
                  case 'audio':
                    this.dataChannel = event.channel;
                    this.setUpDataChannel();
                    break;
                  case 'control':
                    this.controlChannel = event.channel;
                    this.setUpControlChannel();
                    break;
                  default:
                    // Nothing to be done
                }
            });
        }
    }

    remove() {
        if(!USE_MEDIA_AUDIO) {
            // Close dataChannel
            this.dataChannel.close();
        }

        // Close controlChannel
        this.controlChannel.close();

        if(!USE_MEDIA_AUDIO) {
            // Stop all audio processing
            this.localAudioSource.disconnect();
            this.localProcessingNode.disconnect();
            this.remoteProcessingNode.disconnect();
            this.remoteAudioLoopbackDestinationToSource.disconnect();

            this.localProcessingNode.port.postMessage({
                type: 'destroy'
            });

            this.remoteProcessingNode.port.postMessage({
                type: 'destroy'
            })
        }

        // Remove video stream
        this.peerConnection.removeTrack(this.sender);

        // Close PeerConnection
        this.peerConnection.close();

        // Remove tracks from stream
        this.remoteVideoStream.getVideoTracks().forEach((track, index) => {
            this.remoteVideoStream.removeTrack(track);
            track.stop();
        });

        // Remove tracks from stream
        this.remoteAudioStream.getVideoTracks().forEach((track, index) => {
            this.remoteAudioStream.removeTrack(track);
            track.stop();
        });

        // Remove DOM elements
        this.videoElement.remove();
        this.audioElement.remove();
        this.container.remove();
        if(!USE_MEDIA_AUDIO) {
            removeLoopbackEntry(this.id);
        }

        // Create toast notification
        let div = document.createElement('div');
        div.classList = 'd-flex flex-wrap w-100 col-12 px-2 py-2';

        let p = document.createElement('p');
        p.classList = 'py-0';
        p.innerHTML = '<strong>'+this.name+'</strong> left the room';

        div.appendChild(p);
        createToast('Participant left', div, 1500);
    }

    setUpDataChannel() {
        // Listener for when the datachannel is opened
        this.dataChannel.addEventListener('open', event => {
            // Force the binary type to be ArrayBuffer
            this.dataChannel.binaryType = 'arraybuffer';

            this.sendAudioContextState();
            console.log('Data channel opened');
        });

        // Listener for when the datachannel is closed
        this.dataChannel.addEventListener('close', event => {
            this.localAudioSource.disconnect();
            this.localProcessingNode.disconnect();
            this.remoteProcessingNode.disconnect();
            console.log('Data channel closed');
        });

        // Append new messages to the box of incoming messages
        this.dataChannel.addEventListener('message', event => {
            if(!this.loopback) {
                // Get the ArrayBuffer
                let buf = event.data;

                // Get packet number
                let packet_n = Packet.getPacketNumber(buf);

                // If packet_n is >= last packet received => send it to the processor
                // Otherwise drop it (to save time)
                if(packet_n >= this.packet_n){
                    // Save the time at which we receive data
                    performance.mark(`data-received-${this.id}-${socket.id}-${packet_n}`);

                    // Process data (tranfer of ownership)
                    this.remoteProcessingNode.port.postMessage({
                        type: 'packet',
                        data: buf
                    }, [buf]);
                }
                else {
                    // console.log('Packet dropped');
                }
            }
            else {
                // Replace the packet_n
                let buf = event.data;
                Packet.replacePacketNum(buf, this.createdPacket_n);
                this.createdPacket_n++;

                // Send the packet back
                this.dataChannel.send(event.data);
            }
        });
    }

    setUpControlChannel() {
        // Listener for when the controlChannel is opened
        this.controlChannel.addEventListener('open', event => {
            this.sendTrackStatus();
            this.sendAudioContextState();
            this.sendName();
            console.log('Control channel opened');
        });

        // Listener for when the datachannel is closed
        this.controlChannel.addEventListener('close', event => {
            console.log('Control channel closed');
        });

        // Append new messages to the box of incoming messages
        this.controlChannel.addEventListener('message', event => {
            // Handle track status
            let message = JSON.parse(event.data);
            console.log(message);
            if(message.trackStatus !== undefined) {
                // Set widget visible or not
                if(message.trackStatus === true) {
                    // Not mute
                    this.muteMessage.classList.remove('visible');
                    this.muteMessage.classList.add('invisible');
                }
                else if(message.trackStatus === false) {
                    // Mute
                    this.muteMessage.classList.remove('invisible');
                    this.muteMessage.classList.add('visible');
                }
            }
            else if(message.audioContextRunning !== undefined) {
                console.log('Connecting');
                if(message.audioContextRunning === true) {
                    if(!USE_MEDIA_AUDIO) {
                        // Attach source and dest
                        this.localAudioSource.connect(this.localProcessingNode);
                        if(document.getElementById('audio-output-button').audioId !== undefined && (typeof this.audioElement.setSinkId === 'function')) {
                            this.localProcessingNode.connect(this.remoteAudioDestination);
                            this.remoteProcessingNode.connect(this.remoteAudioDestination);
                        }
                        else {
                            this.localProcessingNode.connect(audioContext.destination);
                            this.remoteProcessingNode.connect(audioContext.destination);
                        }
                    }

                    if(audioContext.state === 'running') {
                        // Processing started
                        performance.mark('processing-started');
                    }

                    this.otherAudioContextRunning = true;
                    console.log('Connected');
                }
                else {
                    if(!USE_MEDIA_AUDIO) {
                        // Detach source and dest
                        this.localAudioSource.disconnect();
                        this.localProcessingNode.disconnect();
                        this.remoteProcessingNode.disconnect();
                    }

                    this.otherAudioContextRunning = false;
                    console.log('Disconnected');
                }
            }
            else if (message.name !== undefined) {
                this.name = message.name;
                this.remoteNameDisplay.innerText = this.name;
                this.remoteName.classList.remove('invisible');

                if(!this.offering) {
                    // Create toast notification if this peer is the one that received the offer
                    let div = document.createElement('div');
                    div.classList = 'd-flex flex-wrap w-100 col-12 px-2 py-2';

                    let p = document.createElement('p');
                    p.classList = 'py-0';
                    p.innerHTML = '<strong>'+this.name+'</strong> joined the room';

                    div.appendChild(p);
                    createToast('New participant', div, 2000);
                }

                if(!USE_MEDIA_AUDIO) {
                    createLoopbackEntry(this.id, this.name, () => { this.setLoopback(); }, () => { this.removeLoopback(); });
                }
            }
            else if (message.loopback !== undefined) {
                // Set widget visible or not
                if(message.loopback === true) {
                    // Loopback
                    this.loopbackMessage.classList.remove('invisible');
                    this.loopbackMessage.classList.add('visible');
                }
                else if(message.loopback === false) {
                    // Not loopback
                    this.loopbackMessage.classList.remove('visible');
                    this.loopbackMessage.classList.add('invisible');
                }
            }
        });
    }

    sendTrackStatus() {
        if(this.controlChannel.readyState === 'open') {
            let message = {
               trackStatus: audioTrackPlay
            }
            this.controlChannel.send(JSON.stringify(message));

            if(!USE_MEDIA_AUDIO) {
                this.localProcessingNode.port.postMessage({
                    type: 'track-status',
                    muted: !audioTrackPlay
                });
            }

            console.log(message);
        }
    }

    sendAudioContextState() {
        if(!USE_MEDIA_AUDIO) {
            if(this.dataChannel !== null && this.dataChannel.readyState === 'open' && this.controlChannel.readyState === 'open') {
                let message = {
                    audioContextRunning: audioContext.state === 'running'
                }
                this.controlChannel.send(JSON.stringify(message));
                console.log(message);

                if(this.otherAudioContextRunning && message.audioContextRunning) {
                    // Processing started
                    performance.mark('processing-started');
                }
            }
        }
    }

    sendName() {
        if(this.controlChannel.readyState == 'open') {
            let message = {
                name: name
            }
            this.controlChannel.send(JSON.stringify(message));
        }
    }

    addVideoTrack(track) {
        // Attach remote video
        this.remoteVideoStream.addTrack(track);
    }

    addAudioTrack(track) {
        if(USE_MEDIA_AUDIO) {
            // Attach remote audio
            this.remoteAudioStream.addTrack(track);
        }
    }

    setLoopback() {
        if(!USE_MEDIA_AUDIO) {
            if(!USE_AUDIO_LOOPBACK) {
                // DataChannel version
                this.loopback = true;
                this.localProcessingNode.port.postMessage({
                    type: 'loopback',
                    loopback: this.loopback
                })
            }
            else {
                // AudioLoopback version
                this.audioLoopback = true;

                // Disconnect all nodes
                this.localAudioSource.disconnect();
                this.localProcessingNode.disconnect();
                this.remoteProcessingNode.disconnect();

                // Connect them differently
                // Connection:
                // The source stream is the remoteAudioLoopbackDestinationToSource, a MediaSourceStream obtained by the MediaStreamDestionation remoteAudioLoopbackDestination
                // We connect this source to the DataSenderNode, and we connect both DataSender and DataReceiver to the remoteAudioLoopbackDestination
                // This way we are able to achieve a loopback in which the data received by the DataReceiver node is then delivered to the DataSender
                this.remoteAudioLoopbackDestinationToSource.connect(this.localProcessingNode);
                this.localProcessingNode.connect(audioContext.destination);
                this.remoteProcessingNode.connect(this.remoteAudioLoopbackDestination);

                // We tell the audio worklet that we are in a loopback situation (to avoid muting audio)
                this.localProcessingNode.port.postMessage({
                    type: 'audioLoopback',
                    audioLoopback: this.audioLoopback
                })
            }

            // The following code is valid in both versions
            let message = {
                loopback: this.loopback || this.audioLoopback
            }
            this.controlChannel.send(JSON.stringify(message));
        }
    }

    removeLoopback() {
        if(!USE_MEDIA_AUDIO) {
            if(!USE_AUDIO_LOOPBACK) {
                // DataChannel version
                this.loopback = false;
                this.localProcessingNode.port.postMessage({
                    type: 'loopback',
                    loopback: this.loopback
                })
            }
            else {
                // Audio loopback version
                this.audioLoopback = false;

                // Disconnect all nodes
                this.remoteAudioLoopbackDestinationToSource.disconnect();
                this.localProcessingNode.disconnect();
                this.remoteProcessingNode.disconnect();

                // Connect them in the previous configuration
                // Create audio source
                this.localAudioSource = audioContext.createMediaStreamSource(this.localAudioStream);
                this.localAudioSource.connect(this.localProcessingNode);
                if(document.getElementById('audio-output-button').audioId !== undefined && (typeof this.audioElement.setSinkId === 'function')) {
                    this.localProcessingNode.connect(this.remoteAudioDestination);
                    this.remoteProcessingNode.connect(this.remoteAudioDestination);
                }
                else {
                    this.localProcessingNode.connect(audioContext.destination);
                    this.remoteProcessingNode.connect(audioContext.destination);
                }

                if(USE_MEDIA_AUDIO) {
                    // Attach stream
                    this.audioElement.srcObject = this.remoteAudioStream;
                }
                else {
                    // Attach destination stream
                    this.audioElement.srcObject = this.remoteAudioDestination.stream;
                }

                // We tell the audio worklet that we are no more in a loopback situation
                this.localProcessingNode.port.postMessage({
                    type: 'audioLoopback',
                    audioLoopback: this.audioLoopback
                })
            }

            // The following code is valid in both versions
            let message = {
                loopback: this.loopback || this.audioLoopback
            }
            this.controlChannel.send(JSON.stringify(message));
        }
    }

    createAndSendOffer() {
        // Create and send the offer
        this.peerConnection
        .createOffer(offerOptions)
        .then((offer) => {
            return this.peerConnection.setLocalDescription(offer)
        })
        .then(() => {
            let offer = this.peerConnection.localDescription
            this.socket.emit('offer', offer, this.id);
        })
        .catch((error) => {
            console.log(error)
        });
    }

    createAndSendAnswer() {
        // Set remote description, create and send answer
        this.peerConnection
            .createAnswer()
            .then((answer) => {
                return this.peerConnection.setLocalDescription(answer);
            })
            .then(() => {
                let answer = this.peerConnection.localDescription
                this.socket.emit('answer', answer, this.id);
            })
            .catch((error) => {
                console.log(error)
            });
    }

    setRemoteDescription(desc) {
        // Set remote description, create and send answer
        return this.peerConnection
                   .setRemoteDescription(new RTCSessionDescription(desc));
    }

    addIceCandidate(candidate) {
        this.peerConnection.addIceCandidate(candidate)
        .catch((e) => {
          console.error('Error adding received ice candidate', e);
        });
    }

    getStats() {
        this.peerConnection.getStats(null)
        .then(stats => {
            [...stats]
            .map(report => report[1])
            .filter(report => report.type === 'data-channel')
            .forEach(report => {
                console.log(report);
            });
        })
        .catch((e) => console.error(e));
    }
}
