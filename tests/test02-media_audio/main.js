/**
 * Gastaldi Paolo
 * 28/04/2021
 * 
 * Basic audio stream usage
 */
'use strict';

// Audio context options
const audioContextOptions = {
    latencyHint: 0,
    sampleRate: 48000
}

// Audio context
let audioContext = new AudioContext(audioContextOptions);

let stream = audioContext.createMediaElementSource(document.getElementById("mic"));
stream.createWorkerProcessor(new Worker("worker.js"));
let mic = context.createMediaStreamSource(stream);
let peer = context.createMediaStreamDestination();
mic(peer);
peerConnection.addStream(peer.stream);