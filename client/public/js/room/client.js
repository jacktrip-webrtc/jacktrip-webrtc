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

// Audio context
let audioContext = new AudioContext();

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
        this.localAudioSource = null;
        this.localProcessingNode = null;
        this.remoteProcessingNode = null;
        this.remoteAudioDestination = audioContext.createMediaStreamDestination();
        this.dataChannel = null;

        // Create DOM elements for peer stream
        let div = document.getElementById('stream-elements');
        this.videoElement = document.createElement('video');
        this.videoElement.id = `remote-video-${id}`;
        this.videoElement.muted = true;
        this.videoElement.autoplay = true;
        // Attach stream
        this.videoElement.srcObject = this.remoteVideoStream;

        this.audioElement = document.createElement('audio');
        this.audioElement.id = `remote-audio-${id}`;
        this.audioElement.autoplay = true;
        // Attach stream
        this.audioElement.srcObject = this.remoteAudioDestination.stream;

        div.appendChild(this.videoElement);
        div.appendChild(this.audioElement);
    }

    setUp(videoStream, audioStream) {
        // Add video tracks to peer
        videoStream.getVideoTracks().forEach(track => {
            this.sender = this.peerConnection.addTrack(track, videoStream)
        });

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
            if(this.dataChannel.readyState === 'open') {
                this.dataChannel.send(event.data);
            }
        };

        // Node for receiving data
        this.remoteProcessingNode = new DataReceiverNode(audioContext);

        this.localAudioSource.connect(this.localProcessingNode);
        if(this.offering) {
            // Create dataChannel (UDP - no retransmit)
            this.dataChannel = this.peerConnection.createDataChannel('audio', {maxRetransmits: 0, ordered: false});
            this.setUpDataChannel();
        }
        else {
            // Listen for datachannel creation
            this.peerConnection.addEventListener('datachannel', event => {
                console.log("created");
                this.dataChannel = event.channel;
                this.setUpDataChannel();
            });
        }
    }

    remove() {
        // Close dataChannel
        this.dataChannel.close();

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
    }

    setUpDataChannel() {
        // Listener for when the datachannel is opened
        this.dataChannel.addEventListener('open', event => {
            this.localProcessingNode.connect(audioContext.destination);
            this.remoteProcessingNode.connect(this.remoteAudioDestination);
            console.log('Data channel opened');
        });

        // Listener for when the datachannel is closed
        this.dataChannel.addEventListener('close', event => {
            this.localProcessingNode.disconnect(audioContext.destination);
            this.remoteProcessingNode.disconnect(this.remoteAudioDestination);
            console.log('Data channel closed');
        });

        // Append new messages to the box of incoming messages
        this.dataChannel.addEventListener('message', event => {
            const data = new Float32Array(event.data);
            this.remoteProcessingNode.port.postMessage(data);
        });
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
