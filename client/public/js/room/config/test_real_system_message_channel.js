'use strict';

/*
------------------------------------------
GENERAL
------------------------------------------
*/

export const LOG_DATA = false;
export const logData = LOG_DATA; // renaming

// export const RTT_PACKET_N = 500; // TODO: implement this!

// export const LIMIT_PACKETIZATION_STATS = -1; // TODO: implement this!

export const showArchitectureInfo = true;

/*
------------------------------------------
NETWORK
------------------------------------------
*/

export const peerConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // STUN server
};

/*
------------------------------------------
AUDIO
------------------------------------------
*/

export const USE_MEDIA_AUDIO = false;

export const dataChannelConfiguration = {
    // maxPacketLifeTime, maxRetransmits
    // maxPacketLifeTime: 0, // [ms] amount of time taken by the browser to send a packet
    bufferedAmountLowThreshold: 0,
    maxRetransmits: 0,
    ordered: false,
    protocol: 'raw'
};

export const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};

export const audioContextOptions = {
    latencyHint: 0,
    sampleRate: 48000 // 44100, 48000
};

export const mediaConfiguration = {
    video: false, // true // false for easier configuration or testing
    audio: {
        autoGainControl: false,
        echoCancellation: false,
        latency: audioContextOptions.latencyHint,
        noiseSuppression: false,
        sampleRate: audioContextOptions.sampleRate,
        // sampleSize: 32 // default value, as required by AudioContext
    }
};

export const audioTrackPlay = true;
export const videoTrackPlay = true;

/*
------------------------------------------
THREAD COMMUNICATION
------------------------------------------
*/

/*
true: create a SharedArrayBuffer for play/mute audio processor, for better performances
false: use postMessage for play/mute audio processor
*/
export const useSharedBufferForProcessorStatus = true;

/*
true: use MessageChannel (port.postMessage) to communicate data from the main thread to the audio worker (± Matteo's architecture)
false: use SharedArrayBuffers to communicate data from the main thread to the audio worker (Paolo's architecture)
*/
export const useMessageChannel = false;
export const useSharedBuffer = !useMessageChannel;

/*
IMPORTANT: working on Chrome only
maybe on Firefox too, check it!
it is suggested to set 'useSharedBufferForProcessorStatus' = true
*/
export const useWaitAsync = false;

/*
in milliseconds
null, undefined or Infinity for Infinity
*/
export const waitAsyncTimeout = Infinity;

/*
------------------------------------------
CIRCULAR BUFFER
------------------------------------------
*/

export const maxPacketInQueue = 16; // 16 packets: 8 packets + 8 packets (first packet jitter)
export const queueSize = maxPacketInQueue + 1; // write and read at the same index is not allowed

// BigInt value required
export const queueMask = BigInt(queueSize); // 31 in binary: 11111

/*
BigInt value required
IMPORTANT: Chrome can "read future samples"
Chrome returns 2 samples (at least) together, so it can write faster then the output part can consume samples
for that, -1n is added
*/
export const circularBufferOffset = BigInt(Math.ceil(queueSize / 2.)); // 8 packets ≈ 21 ms

/*
number of audio channels
currently: #inputs = #outputs
no mixdown supported
*/
export const nChannels = 1;

export const nInputChannels = 1; // TODO: implement this
export const nOutputChannels = 1; // TODO: implement this

export const windowSize = 128;

// compute and update automatically the packet offset
export const balancedOffset = true;

/*
------------------------------------------
TESTING
------------------------------------------
*/

// track jitter for each peer connection
export const isJitterTracked = false;

export const drawJitterGraphOnClose = false;

// generate a sinusoid
export const useTestSamples = false;

// IMPORTANT: when 'useBeepGeneratorAndAnalyzer' is enables, its logs cannot be disabled
// it is suggested to disable logs for an easier analysis
export const useBeepGeneratorAndAnalyzer = false;

// enable loopback
export const useAudioLoopback = true;

// choose loopback type
export const audioLoopbackTypesToChooseFrom = [
    'noLoopback',
    'directForwardLoopback',    // connects input to ouput
    'basicForwardLoopback',     // connects input to ouput with a basic intermediate AudioWorkletProcessor
    'localLoopback',            // use sender and receiver architecture
    // 'networkLoopback',          // use network to send and receive myself, MUST be enabled by GUI
    // IMPORTANT: 'networkLoopback' MUST be enabled w/ GUI button directly, even if useAudioLoopback is false
]
export const audioLoopbackType = 'noLoopback';