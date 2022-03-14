const fs = require('fs');
const { exit } = require('process');

// Open config model
let configModel = null;
try {
    configModel = fs.readFileSync('src/jacktrip-webrtc/client/public/js/room/config/config-model.js');
} catch(err) {
    console.error("Cannot read config model " + err);
}

// Default values
const params = {
    LOG_DATA: false,
    useMessageChannel: true,
    useWaitAsync: false, // W/ Chrome only!
    maxPacketInQueue: 16,
    nChannels: 1,
    nInputChannels: 1,
    nOutputChannels: 1,
    isJitterTracked: false,
    useAudioLoopback: false,
    audioLoopbackType: "no loopback",
    // enableDynamicConfig: false,
    useGainNode: false,
};

let i = 2; // Args index. Index 1: node, 2: program name
while(i < process.argv.length) {
    let command = process.argv[i++];
    if (command[0] != '-') {
        console.error(`Invalid argument ${command}`);
        continue;
    }
    command = command.slice(command[1] == '-' ? 2 : 1);
    const param = null;

    switch(command) {
        case "h":
        case "help":
            console.log(`USAGE: ${process.argv[0]} [OPTIONS...] \n
-h, --help: show help
-l, --log: enable logs on console. WARNING: logs can have effects on app performances 
-i, --input <channels>: set the number of input channels, default = 1 
-o, --output <channels>: set the number of output channels, default = 1 
-b, --buffer <offset>: set the dejitter buffer offset, default = 8 
-j, --jitter: track jitter and enable graph button on GUI 
-1, --loopback1: use directForwardLoopback between mic and speaker, no other threads 
-2, --loopback2: use basicForwardLoopback between with the audio thread 
-3, --loopback3: use localLoopback with audio processors
-4, --loopback4: use fulllocalLoopback with thread exchange 
-5, --loopback5: use networkLoopback between 2 computers 
-m, --messagechannel: use message channel 
-s, --sab: use shared array buffer 
-w, --waitasync: use wait async
-d, --direct: keep a direct audio path with gain zero
            `);
// -a, --audiocontext: enable dynamic configuration using the same audioContext
            exit(0);
            break;

        case "log":
        case "l":
            params.LOG_DATA = true;
            console.log(`Log enabled`);
            break;

        case "i":
        case "input":
            param = process.argv[i++];
            params.nChannels = param;
            params.nInputChannels = param;
            console.log(`Number of input channels: ${nInputChannels}`);
            break;

        case "o":
        case "output":
            param = process.argv[i++];
            params.nChannels = param;
            params.nOutputChannels = param;
            console.log(`Number of output channels: ${nInputChannels}`);
            break;

        case "b":
        case "buffer":
            param = process.argv[i++];
            params.maxPacketInQueue = param*2;
            console.log(`Dejitter buffer offset: ${param}`);
            break;

        case "j":
        case "jitter":
            params.isJitterTracked = true;
            console.log(`Jitter tracking enabled`);
            break;

        case "1":
        case "loopback1":
            params.useAudioLoopback = true;
            params.audioLoopbackType = "directForwardLoopback";
            console.log(`Direct audio forward enabled`);
            break;

        case "2":
        case "loopback2":
            params.useAudioLoopback = true;
            params.audioLoopbackType = "basicForwardLoopback";
            console.log(`Basic audio forward enabled`);
            break;

        case "3":
        case "loopback3":
            params.useAudioLoopback = true;
            params.audioLoopbackType = "localLoopback";
            console.log(`Audio forward within audio thread processors exchange enabled`);
            break;

        case "4":
        case "loopback4":
            params.useAudioLoopback = true;
            params.audioLoopbackType = "fullLocalLoopback";
            console.log(`Audio forward with thread exchange enabled`);
            break;

        case "5":
        case "loopback5":
            params.useAudioLoopback = true;
            params.audioLoopbackType = "networkLoopback";
            console.log(`Network loopback activated. IMPORTANT: it MUST be enabled with the GUI button`);
            break;
        
        case "m":
        case "messagechannel":
            params.useMessageChannel = true;
            params.useWaitAsync = false;
            console.log(`Using messageChannel`);
            break;
        
        case "s":
        case "sab":
            params.useMessageChannel = false;
            params.useWaitAsync = false;
            console.log(`Using SharedArrayBuffer`);
            break;

        case "w":
        case "waitasync":
            params.useMessageChannel = false; // Use SharedArrayBuffer
            params.useWaitAsync = true;
            console.log(`Using Atomics.waitAsync. WARNING: it works on Google Chrome only!`);
            break;

        // case "a":
        // case "audiocontext":
        //     params.enableDynamicConfig = true;
        //     console.log(`Dynamic config enable, using the same audioContext`);
        //     break;

        case "d":
        case "direct":
            params.useGainNode = true;
            console.log(`Using direct audio path`);
            break;

        default:
            console.error(`Unknown argument ${command}`);
            exit(-1);
    }
}

let config = "";
for(const [key, val] of Object.entries(params)) {
    if (key == "audioLoopbackType")
        config += `export const ${key} = "${val}";\n`;
    else
        config += `export const ${key} = ${val};\n`;
}

const newConfig = config + "\n" + configModel;
fs.writeFileSync('src/jacktrip-webrtc/client/public/js/room/config/config.js', newConfig);

console.log("New config file created!");