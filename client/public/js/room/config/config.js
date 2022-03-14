export const LOG_DATA = false;
export const useMessageChannel = true;
export const useWaitAsync = false;
export const maxPacketInQueue = 16;
export const nChannels = 1;
export const nInputChannels = 1;
export const nOutputChannels = 1;
export const isJitterTracked = true;
export const useAudioLoopback = false;
export const audioLoopbackType = "no loopback";
export const useGainNode = false;

export const enableDynamicConfig = true; // Fixed

/*
---------------------------------------------------
GENERAL
---------------------------------------------------
*/

// export const LOG_DATA = false;
export const logData = LOG_DATA; // renaming

// log every time a packet has been discarded by the circular buffer
// export const logDiscardedPackets = false; // deprecated

// export const RTT_PACKET_N = 500; // TODO: implement this!

// export const LIMIT_PACKETIZATION_STATS = -1; // TODO: implement this!

export const showArchitectureInfo = true;

/*
---------------------------------------------------
NETWORK
---------------------------------------------------
*/

export const peerConfiguration = {
    iceTransportPolicy: "all", // force using TURN
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }, // STUN server
        // { urls: "turn:localhost:3478", username:"testclient", credential:"testclient123." } // TURN server
    ],
};

/*
---------------------------------------------------
AUDIO
---------------------------------------------------
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
---------------------------------------------------
THREAD COMMUNICATION AND SYSTEM ARCHITECTURE
---------------------------------------------------
*/

// true: create a SharedArrayBuffer for play/mute audio processor, for better performances
// false: use postMessage for play/mute audio processor
export const useSharedBufferForProcessorStatus = true;

// // true: use MessageChannel (port.postMessage) to communicate data from the main thread to the audio worker (± Matteo's architecture)
// // false: use SharedArrayBuffers to communicate data from the main thread to the audio worker (Paolo's architecture)
// export const useMessageChannel = false;

export const useSharedBuffer = !useMessageChannel;
// export const useMessageChannel = !useSharedBuffer;


// // IMPORTANT: working on Chrome only
// // maybe on Firefox too, check it!c
// // it is suggested to set 'useSharedBufferForProcessorStatus' = true
// export const useWaitAsync = false;

// value in milliseconds
// null, undefined or Infinity for Infinity
export const waitAsyncTimeout = Infinity;

// value in number of frames
// min buffer offset for working properly w/ Atomics.waitAsync
export const waitAsyncMinBufferOffset = 0;

// flat the architecture to merge sender and receiver thread in a single thread
export const useSingleAudioThread = false;

/*
---------------------------------------------------
CIRCULAR BUFFER
---------------------------------------------------
*/

// export const maxPacketInQueue = 16; // 16 packets: 8 packets + 8 packets (first packet jitter)
// export const queueSize = maxPacketInQueue + 1; // write and read at the same index is not allowed
export const queueSize = maxPacketInQueue;

// BigInt value required
export const queueMask = BigInt(queueSize); // 31 in binary: 11111


// BigInt value required
// IMPORTANT: Chrome can "read future samples"
// Chrome returns 2 samples (at least) together, so it can write faster then the output part can consume samples
// for that, -1n is added
export const circularBufferOffset = BigInt(Math.ceil(queueSize / 2.)); // 8 packets ≈ 21 ms


// // number of audio channels
// // currently: #inputs = #outputs
// // no mixdown supported
// export const nChannels = 1;

// export const nInputChannels = 1; // TODO: implement this
// export const nOutputChannels = 1; // TODO: implement this

export const windowSize = 128;

// compute and update automatically the packet offset
export const balancedOffset = true;

/*
---------------------------------------------------
TESTING
---------------------------------------------------
*/

// track jitter for each peer connection
// export const isJitterTracked = true;
export const drawJitterGraphOnClose = false;

// generate a sinusoid
export const useTestSamples = false;

// IMPORTANT: when 'useBeepGeneratorAndAnalyzer' is enables, its logs cannot be disabled
// it is suggested to disable logs for an easier analysis
export const useBeepGeneratorAndAnalyzer = false;

// enable loopback
// export const useAudioLoopback = false;

// choose loopback type
export const audioLoopbackTypesToChooseFrom = [
    'noLoopback',

    // 'directForwardLoopback':
    // connects input to ouput
    // no intermediate AudioNode
    'directForwardLoopback',   
    
    // 'basicForwardLoopback':
    // connects input to output with a basic intermediate AudioWorkletProcessor
    // the looback delay is computed between speaker -> mic, not on the inner audio chain
    'basicForwardLoopback',

    // 'localLoopback':
    // use sender and receiver architecture
    // the loopback delay is computed on the inner audio chain using tx/rx
    'localLoopback',

    // 'fullLocalLoopback':
    // use sender and receiver architecture
    // audio buffer is sent the the main thread
    // the main thread does not forward data to the WebRTC, but insert them in the receiving queue directly
    // the loopback delay is computed on the inner audio chain using tx/rx and the main thread
    'fullLocalLoopback',

    // 'networkLoopback'
    // use network to send and receive myself, MUST be enabled by GUI
    // BUT 'useAudioLoopback' must be set = true
    // the loopback delay is computed between 2 peers using the inner audio chains of both peers
    'networkLoopback',          
    // IMPORTANT: 'networkLoopback' MUST be enabled w/ GUI button directly, even if useAudioLoopback is false
]
// export const audioLoopbackType = 'networkLoopback';

// add a sinusoid to the input signal to detect missing packets during the analysis
export const addSin = true; // this is necessary to activate the GUI
export const sinGain = 0.1; // [0., 1.]
export const sinFreq = 200; // Hz