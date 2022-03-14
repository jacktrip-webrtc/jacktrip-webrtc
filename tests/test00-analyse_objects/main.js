/**
 * Gastaldi Paolo
 * 26/04/2021
 * 
 * Analyse object content and behavior
 * Looking for native code entry points
 * 
 * Open this page in a broswer and look at console messages with the analysis tool
 */

'use strict';

let count = 0;
function consolelog(value) {
    console.log(count++);
    console.log(value);
}

/* --- CONFIG --- */

const audioContextOptions = {
    latencyHint: 0,
    sampleRate: 48000
}
// Peer configuration
const configuration = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302' // STUN server
        }
    ]
};

const audioBufferOptions = {
    length : 1, // size of the audio buffer in sample-frames. To determine the length to use for a specific number of seconds of audio, use numSeconds * sampleRate
    numberOfChannels : 2,
    sampleRate : 48000
};

/* --- RTCPeerConnection --- */
consolelog('--- RTCPeerConnection ---');

let peerConnection = new RTCPeerConnection(configuration);
let peerConnectionProtype = Object.getPrototypeOf(peerConnection);

consolelog(peerConnection);
consolelog(peerConnectionProtype);

consolelog(peerConnection.addTrack.toString()); // native code
consolelog(peerConnection.createDataChannel.toString()); // native code
consolelog(peerConnection.close.toString()); // native code

/* --- MediaStream --- */
consolelog('--- MediaStream ---');

let mediaStream = new MediaStream();
let mediaStreamPrototype = Object.getPrototypeOf(mediaStream);

consolelog(mediaStream);
consolelog(mediaStreamPrototype);

consolelog(mediaStream.constructor.toString()); // native code
consolelog(mediaStreamPrototype.constructor.toString()); // native code
consolelog(mediaStreamPrototype.getTracks.toString()); // native code
consolelog(mediaStreamPrototype.getAudioTracks.toString()); // native code
consolelog(mediaStreamPrototype.getVideoTracks.toString()); // native code

/* --- AudioContext --- */
consolelog('--- AudioContext ---');

/*
AudioContext.baseLatency : readonly
This represents the number of seconds of processing latency incurred by the AudioContext passing an audio buffer from the AudioDestinationNode — i.e. the end of the audio graph — into the host system's audio subsystem ready for playing.
Note: You can request a certain latency during construction time with the latencyHint option, but the browser may ignore the option.
value : 0

AudioContext.outputLatency : readonly
This is the time, in seconds, between the browser passing an audio buffer out of an audio graph over to the host system's audio subsystem to play, and the time at which the first sample in the buffer is actually processed by the audio output device.
value : 0.009125
*/

let audioContext = new AudioContext(audioContextOptions);
let audioContextPrototype = Object.getPrototypeOf(audioContext);

let mediaStreamAudioDestinationNode = audioContext.createMediaStreamDestination();
// class DataSenderProcessor extends AudioWorkletProcessor {};
// let audioWorklet = new DataSenderProcessor();

consolelog(audioContext);
consolelog(audioContextPrototype);
consolelog(mediaStreamAudioDestinationNode);
// consolelog(audioWorklet);

consolelog(audioContext.constructor.toString()); // native code

consolelog(mediaStreamAudioDestinationNode.context);

let mediaStreamAudioDestinationNodeContext = mediaStreamAudioDestinationNode.context;
let audioDestinationNode = mediaStreamAudioDestinationNodeContext.destination;

let audioWorkletPrototype = Object.getPrototypeOf(audioContext.audioWorklet);
let workletPrototype = Object.getPrototypeOf(audioWorkletPrototype);

consolelog(audioContextPrototype.createMediaStreamDestination.toString()); // native code
consolelog(audioContextPrototype.createMediaStreamSource.toString()); // native code

consolelog(audioWorkletPrototype.constructor.toString()); // native code
consolelog(workletPrototype.constructor.toString()); // native code

let audioListener = audioContext.listener; // subsystem interface
consolelog(audioListener.constructor.toString()); // native code
consolelog(audioListener.setOrientation.toString()); // native code
consolelog(audioListener.setPosition.toString()); // native code

consolelog(audioDestinationNode);
/*
recursive structure:
AudioContext -> destination = AudioDestinationNode -> context = AudioContext

going deeper: increasing value of currentTime by very variable values
*/
let audioDestinationNodeContext = audioDestinationNode.context;
consolelog(audioDestinationNodeContext);

let audioDestination = audioContext.createMediaStreamDestination();
consolelog(audioDestination);

/* --- AudioBuffer --- */
consolelog('--- AudioBuffer ---');

let audioBuffer = new AudioBuffer(audioBufferOptions); // subsystem interface
let audioBufferPrototype = Object.getPrototypeOf(audioBuffer);

consolelog(audioBuffer);

consolelog(audioBufferPrototype.constructor.toString()); // native code
consolelog(audioBufferPrototype.copyFromChannel.toString()); // native code
consolelog(audioBufferPrototype.copyToChannel.toString()); // native code
consolelog(audioBufferPrototype.getChannelData.toString()); // native code

/* --- io --- */
consolelog('--- io ---');

console.log(io);