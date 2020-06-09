'use strict'

// Get room id
let room_id = window.location.pathname.split("/").pop();

// First we get the viewport height and we multiple it by 1% to get a value for a vh unit
let vh = window.innerHeight * 0.01;

// Then we set the value in the --vh custom property to the root of the document
document.documentElement.style.setProperty('--vh', `${vh}px`);

// Media configuration
const mediaConfiguration = {
    video: true,
    audio: {
        autoGainControl: false,
        channelCount: 1,
        echoCancellation: false,
        latency: {
            min: 0.01,
            max: 0.02
        },
        noiseSuppression: false,
        sampleRate: 48000,
        sampleSize: 16,
        volume: 1.0
    }
};

// Streams
let localAudioStream = undefined;
let localVideoStream = undefined;
let socket = undefined;

// Start socket connection
socket = io.connect('/room', { transports: ['websocket'], rejectUnauthorized: false });

// Module classes
let Packet;

function joinAudio() {
    audioContext.resume();
    $('#joinAudioModal').modal('hide');
}

function toggleMuteAudio() {
    let track = localAudioStream.getAudioTracks()[0];
    if(track.enabled) {
        // Mute it
        track.enabled = false;
        document.getElementById('audioIcon').classList = "fas fa-microphone-slash";

        let div = document.getElementById('local-mute-message');
        div.classList.remove('invisible');
        div.classList.add('visible');
    }
    else {
        // Unmute it
        track.enabled = true;
        document.getElementById('audioIcon').classList = "fas fa-microphone";

        let div = document.getElementById('local-mute-message');
        div.classList.remove('visible');
        div.classList.add('invisible');
    }

    for(let id in peers) {
        peers[id].sendTrackStatus();
    }
}

function toggleMuteVideo() {
    let track = localVideoStream.getVideoTracks()[0];
    if(track.enabled) {
        // Mute it
        track.enabled = false;
        document.getElementById('videoIcon').classList = "fas fa-video-slash";
    }
    else {
        // Unmute it
        track.enabled = true;
        document.getElementById('videoIcon').classList = "fas fa-video";
    }
}

// Register processing node before entering the room, so the DataProcessor is available in each other step
audioContext.audioWorklet.addModule('/js/room/data-sender-processor.js')
.then(() => {
    return audioContext.audioWorklet.addModule('/js/room/data-receiver-processor.js');
})
.then(() => {
    return import('./packet.js');
})
.then((mod) => {
    // Save module class
    Packet = mod.default;

    // Join the room
    socket.emit('join', room_id);
})
.catch(e => {
    console.error(e);
});

// Once joined
socket.on('joined', (clients) => {
    if(!USE_MEDIA_AUDIO) {
        // Check for audioContext
        if(audioContext.state !== "running"){
            $('#joinAudioModal').modal('show');
        }
    }

    // Create a peer connection for each client
    clients.forEach((id, index) => {
        // I will be the one sending the offer -> true
        createNewPeer(id, socket, true);
    });

    // Leave the room when i leave the page
    window.onunload = function(){
        socket.emit('leave');

        // Stop all peerConnections
        for(let id in peers) {
            removePeer(id);
        }

        localAudioStream.stop();
        localVideoStream.stop();
    }

    // Handle media devices
    navigator.mediaDevices.getUserMedia(mediaConfiguration)
    .then(stream => {
        // Create separated streams
        localVideoStream = new MediaStream();
        localAudioStream = new MediaStream();

        stream.getVideoTracks().forEach((track) => {
            localVideoStream.addTrack(track);
        });

        stream.getAudioTracks().forEach((track) => {
            localAudioStream.addTrack(track);
        });

        // Add local video
        let localVideo = document.getElementById('local-video');
        localVideo.srcObject = localVideoStream;

        for(let id in peers){
            // Setup peer
            setUpPeer(id);

            // Create and send the offer
            createAndSendOffer(id);
        }
    })
    .catch(e => {
        console.error(e);
    })
})

socket.on('new client', (id) => {
    // Create the new peer connection
    // I will not be the one sending the offer -> false
    createNewPeer(id, socket, false);

    // Setup peer
    setUpPeer(id);
});

socket.on('client left', (id) => {
    // Remove peer
    removePeer(id);
})

// Handle incoming offers
socket.on('incoming offer', (offer, id) => {
    console.log(offer);

    // Set remote description, create and send answer
    setRemoteDescription(id, offer)
    .then(() => {
        createAndSendAnswer(id);
    })
    .catch((error) => {
        console.log(error);
    });
})

// Hadle incoming answers
socket.on('incoming answer', (answer, id) => {
    console.log(answer);

    setRemoteDescription(id, answer);
})

// Errors in the process will be reported here
socket.on('communication error', (error) => {
    // Show error modal
    let p = document.getElementById('errorMessage');
    p.innerText = error;
    $('#errorModal').modal('show');

    console.error(error);
})

// Handle signaling of ICE candidate
socket.on('new candidate', (candidate, id) => {
    addIceCandidate(id, candidate);
})
