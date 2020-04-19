'use strict'

// Get room id
let room_id = window.location.pathname.split("/").pop();

// Media configuration
const mediaConfiguration = {
    video: true,
    audio: true
};

// Streams
let localAudioStream = undefined;
let localVideoStream = undefined;
let socket = undefined;

// Start socket connection
socket = io.connect('/room', { transports: ['websocket'], rejectUnauthorized: false });

// Register processing node before entering the room, so the DataProcessor is available in each other step
audioContext.audioWorklet.addModule('/js/room/data-sender-processor.js')
.then(() => {
    return audioContext.audioWorklet.addModule('/js/room/data-receiver-processor.js');
})
.then(() => {
    // Join the room
    socket.emit('join', room_id);
});

// Once joined
socket.on('joined', (clients) => {
    // Create a peer connection for each client
    clients.forEach((id, index) => {
        // I will be the one sending the offer -> true
        createNewPeer(id, socket, true);
    });

    // Leave the room when i leave the page
    window.onunload = () => {
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
    console.error(error);
})

// Handle signaling of ICE candidate
socket.on('new candidate', (candidate, id) => {
    addIceCandidate(id, candidate);
})
