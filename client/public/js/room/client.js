'use strict'

// Peer configuration
const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};

// Peer offer options
const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};

// Audio context options
const audioContextOptions = {
    latencyHint: "interactive",
    sampleRate: 48000
}

// Audio context options
let audioContext = new AudioContext(audioContextOptions);
audioContext.suspend();

audioContext.onstatechange = () => {
    for(let id in peers) {
        peers[id].sendAudioContextState();
    }
}

// Audio context
class DataSenderNode extends AudioWorkletNode {
  constructor(context) {
    super(context, 'data-sender-processor');
  }
}

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

        // Create DOM elements for peer stream
        let div = document.getElementById('stream-elements');
        this.container = document.createElement('div')
        this.container.classList = 'embed-responsive embed-responsive-4by3 w-100 col-lg-4 col-md-6 col-sm-12 py-0 px-0 bg-black rounded'

        this.videoElement = document.createElement('video');
        this.videoElement.id = `remote-video-${id}`;
        this.classList ="embed-responsive-item"
        this.videoElement.muted = true;
        this.videoElement.autoplay = true;
        // Attach stream
        this.videoElement.srcObject = this.remoteVideoStream;

        this.audioElement = document.createElement('audio');
        this.audioElement.id = `remote-audio-${id}`;
        this.audioElement.autoplay = true;
        // Attach stream
        this.audioElement.srcObject = this.remoteAudioDestination.stream;

        this.muteMessage = document.createElement('div');
        this.muteMessage.id = `remote-mute-message-${id}`;
        this.muteMessage.classList = 'embed-responsive-item w-100 h-100 invisible';

        let innerDiv = document.createElement('div');
        innerDiv.classList = 'position-absolute bottom-right px-2 py-1 d-flex flex-row rounded mb-1 mr-1 bg-custom text-small';

        let innerI = document.createElement('i');
        innerI.classList = 'fas fa-microphone-slash text-danger my-auto mr-1';

        let innerP = document.createElement('p');
        innerP.classList = 'mb-0 text-white';
        innerP.innerText = 'Muted';

        innerDiv.appendChild(innerI);
        innerDiv.appendChild(innerP);

        this.muteMessage.appendChild(innerDiv);

        this.container.appendChild(this.videoElement);
        this.container.appendChild(this.audioElement);
        this.container.appendChild(this.muteMessage);

        div.appendChild(this.container);
    }

    setUp(videoStream, audioStream) {
        // Add video tracks to peer
        videoStream.getVideoTracks().forEach(track => {
            this.sender = this.peerConnection.addTrack(track, videoStream)
        });

        // Save the localAudioStream
        this.localAudioStream = audioStream;

        // Create audio source
        this.localAudioSource = audioContext.createMediaStreamSource(audioStream);

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
            this.addVideoTrack(e.track);
        });

        // Node for sending data
        this.localProcessingNode = new DataSenderNode(audioContext);
        this.localProcessingNode.port.onmessage = (event) => {
            if(this.dataChannel.readyState === 'open' && this.otherAudioContextRunning) {
                // Stringify the object in order to send it
                this.dataChannel.send(JSON.stringify(event.data));
            }
            else {
                console.log('Not running')
            }
        };

        // Node for receiving data
        this.remoteProcessingNode = new DataReceiverNode(audioContext);
        this.remoteProcessingNode.port.onmessage = (event) => {
            // Update localPacket number for filtering (below)
            this.packet_n = event.data.packet_n;
        };

        this.localAudioSource.connect(this.localProcessingNode);
        if(this.offering) {
            // Create controlChannel (TCP)
            this.controlChannel = this.peerConnection.createDataChannel('control');
            this.setUpControlChannel();

            // Create dataChannel (UDP - no retransmit)
            this.dataChannel = this.peerConnection.createDataChannel('audio', {maxRetransmits: 0, ordered: false});
            this.setUpDataChannel();
        }
        else {
            // Listen for datachannel creation
            this.peerConnection.addEventListener('datachannel', event => {
                console.log("created "+event.channel.label);
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
        // Close dataChannel
        this.dataChannel.close();

        // Close controlChannel
        this.controlChannel.close();

        // Remove video stream
        this.peerConnection.removeTrack(this.sender);

        // Close PeerConnection
        this.peerConnection.close();

        // Remove tracks from stream
        this.remoteVideoStream.getVideoTracks().forEach((track, index) => {
            this.remoteVideoStream.removeTrack(track);
            track.stop();
        });

        // Remove DOM elements
        this.videoElement.remove();
        this.audioElement.remove();
        this.container.remove();
    }

    setUpDataChannel() {
        // Listener for when the datachannel is opened
        this.dataChannel.addEventListener('open', event => {
            this.sendAudioContextState();
            console.log('Data channel opened');
        });

        // Listener for when the datachannel is closed
        this.dataChannel.addEventListener('close', event => {
            this.localProcessingNode.disconnect();
            this.remoteProcessingNode.disconnect();
            console.log('Data channel closed');
        });

        // Append new messages to the box of incoming messages
        this.dataChannel.addEventListener('message', event => {
            // Parse JSON
            const data = JSON.parse(event.data);

            // If packet_n is >= last packet received => send it to the processor
            // Otherwise drop it (to save time)
            if(data.packet_n >= this.packet_n){
                // Recreate the Float32Array buffer
                data.samples = new Float32Array(Object.values(data.samples));

                // Process data
                this.remoteProcessingNode.port.postMessage(data);
            }
            else {
                console.log("Packet dropped");
            }
        });
    }

    setUpControlChannel() {
        // Listener for when the controlChannel is opened
        this.controlChannel.addEventListener('open', event => {
            this.sendTrackStatus();
            this.sendAudioContextState();
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
                    // Attach source and dest
                    this.localProcessingNode.connect(audioContext.destination);
                    this.remoteProcessingNode.connect(this.remoteAudioDestination);
                    this.otherAudioContextRunning = true;
                    console.log('Connected');
                }
                else {
                    // Detach source and dest
                    this.localProcessingNode.disconnect();
                    this.remoteProcessingNode.disconnect();
                    this.otherAudioContextRunning = false;
                    console.log('Disconnected');
                }
            }
        });
    }

    sendTrackStatus() {
        let message = {
           trackStatus: this.localAudioStream.getAudioTracks()[0].enabled
        }
        this.controlChannel.send(JSON.stringify(message));
        console.log(message);
    }

    sendAudioContextState() {
      if(this.dataChannel.readyState === "open" && this.controlChannel.readyState == "open") {
          let message = {
             audioContextRunning: audioContext.state === "running"
          }
          this.controlChannel.send(JSON.stringify(message));
          console.log(message);
      }
    }

    addVideoTrack(track) {
        // Attach remote video
        this.remoteVideoStream.addTrack(track);
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
}
