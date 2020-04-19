'use strict'

// Get room id
let room_id = window.location.pathname.split("/").pop();

// Peer configuration
const configuration = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

// Media configuration
const mediaConfiguration = {
  video: true,
  audio: true
};

// Streams
let localStream = undefined;
let remoteStream = [];

// Peer offer options
const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

// Functions
function handleTrack(e, id) {
  let video = document.getElementById(`remote-video-${id}`);
  remoteStream[id].addTrack(e.track, remoteStream[id]);
  video.srcObject = remoteStream[id];
  let audio = document.getElementById(`remote-audio-${id}`);
  audio.srcObject = remoteStream[id];
}

function createNewPeer(id) {
  if(peerConnections[id] === undefined) {
    // Create RTCPeerConnection object and set custom property
    peerConnections[id] = new RTCPeerConnection(configuration);
    peerConnections[id].id = id;
    remoteStream[id] = new MediaStream();

    // Create DOM elements for peer stream
    let div = document.getElementById('stream-elements');
    let video = document.createElement('video');
    video.id = `remote-video-${id}`;
    video.muted = true;
    video.autoplay = true;

    let audio = document.createElement('audio');
    audio.id = `remote-audio-${id}`;
    audio.autoplay = true;

    div.appendChild(video);
    div.appendChild(audio);
  }
}

function setUpPeer(id) {
  if(peerConnections[id] !== undefined && localStream !== undefined) {
    // Add tracks to peer
    localStream.getTracks().forEach(
      track => peerConnections[id].addTrack(track, localStream)
    );

    // Listen for local ICE candidates on the local RTCPeerConnection
    peerConnections[id].onicecandidate = event => {
        if (event.candidate) {
          // Send the 'new candidate' to the interested client
          socket.emit('new candidate', event.candidate, peerConnections[id].id);
        }
    }

    // Liste for connection state changes
    peerConnections[id].onconnectionstatechange = event => {
      if (peerConnections[id].connectionState === 'connected') {
        console.log('connected');
      }
      if (peerConnections[id].connectionState === 'disconnected') {
        // If the peer has disconnected remove it from the list
        removePeer(id);
      }
    };

    // Listener for remote tracks
    peerConnections[id].addEventListener('track', (e) => {
      handleTrack(e, id);
    });
  }
}

function removePeer(id) {
  if(peerConnections[id] !== undefined) {
    // Close PeerConnection and removeit from the array
    peerConnections[id].close();
    delete peerConnections[id];

    // Remove DOM elements
    let video = document.getElementById(`remote-video-${id}`);
    video.remove();
    let audio = document.getElementById(`remote-audio-${id}`);
    audio.remove();

    // Remove elements from stream and remove it from the array
    remoteStream[id].getTracks().forEach((track, index) => {
      remoteStream[id].removeTrack(track);
    });

    delete remoteStream[id];
  }
}

// Array containing peers
let peerConnections = [];

// Start socket connection
let socket = io.connect('/room', { transports: ['websocket'], rejectUnauthorized: false });

// Join the room
socket.emit('join', room_id);

// Once joined
socket.on('joined', (clients) => {
  // Create a peer connection fo each client
  clients.forEach((id, index) => {
    createNewPeer(id)
  });

  // Leave the room when i leave the page
  window.onunload = () => {
    socket.emit('leave');

    // Stop all peerConnections
    for(let id in peerConnections) {
      peerConnections[id].close();
    }
  }

  // Handle media devices
  navigator.mediaDevices.getUserMedia(mediaConfiguration)
  .then(stream => {
    localStream = stream;

    let localVideo = document.getElementById('local-video');
    localVideo.srcObject = localStream;

    for(let id in peerConnections){
      setUpPeer(id);

      // Create and send the offer
      peerConnections[id]
        .createOffer(offerOptions)
        .then((offer) => {
          return peerConnections[id].setLocalDescription(offer)
        })
        .then(() => {
          let offer = peerConnections[id].localDescription
          socket.emit('offer', offer, peerConnections[id].id);
        })
        .catch((error) => {
          console.log(error)
        });
    }
  })
  .catch(e => {
    console.error(e);
  })
})

socket.on('new client', (id) => {
  createNewPeer(id);
  setUpPeer(id);
});

socket.on('client left', (id) => {
  removePeer(id);
})

// Hndle incoming offers
socket.on('incoming offer', (offer, id) => {
  console.log(offer);

  // Set remote description, create and send answer
  peerConnections[id]
  .setRemoteDescription(new RTCSessionDescription(offer))
  .then(() => {
    peerConnections[id]
    .createAnswer()
    .then((answer) => {
      return peerConnections[id].setLocalDescription(answer);
    })
    .then(() => {
      let answer = peerConnections[id].localDescription
      socket.emit('answer', answer, id);
    })
    .catch((error) => {
      console.log(error)
    });
  })
  .catch((error) => {
    console.log(error)
  });
})

// Hadle incoming answers
socket.on('incoming answer', (answer, id) => {
  console.log(answer)

  const remoteDesc = new RTCSessionDescription(answer);
  peerConnections[id].setRemoteDescription(remoteDesc);
})

// Errors in the process will be reported here
socket.on('communication error', (error) => {
  console.error(error)
})

// Handle signaling of ICE candidate
socket.on('new candidate', (candidate, id) => {
  peerConnections[id].addIceCandidate(candidate)
  .catch((e) => {
    console.error('Error adding received ice candidate', e);
  });
})
