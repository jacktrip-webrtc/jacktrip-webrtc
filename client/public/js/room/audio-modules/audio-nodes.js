/**
 * @author Sacchetto Matteo
 * @author Gastaldi Paolo
 */

'use strict';

// AudioWorklet for receiving data
class AudioReceiverNode extends AudioWorkletNode {
    constructor(context) {
        super(context, 'audio-receiver-processor');
        this.name = 'AudioReceiverNode';
    }
}

// AudioWorklet for sending data
class AudioSenderNode extends AudioWorkletNode {
    constructor(context) {
        super(context, 'audio-sender-processor');
        this.name = 'AudioSenderNode';
    }
}

// AudioWorklet for sending and receiving data
class AudioSenderReceiverNode extends AudioWorkletNode {
    constructor(context) {
        super(context, 'audio-sender-receiver-processor');
        this.name = 'AudioSenderReceiverNode';
    }
}

// basic forward
class AudioTestNode extends AudioWorkletNode {
    constructor(context) {
        super(context, 'audio-test-processor');
        this.name = 'AudioTestNode';
    }
}

class AudioBeepGeneratorNode extends AudioWorkletNode {
    constructor(context) {
        super(context, 'audio-beep-generator-processor');
        this.name = 'AudioBeepGeneratorNode';
    }
}

class AudioBeepAnalyzerNode extends AudioWorkletNode {
    constructor(context) {
        super(context, 'audio-beep-analyzer-processor');
        this.name = 'AudioBeepAnalyzerNode';
    }
}

export { AudioReceiverNode, AudioSenderNode, AudioSenderReceiverNode, AudioTestNode, AudioBeepGeneratorNode, AudioBeepAnalyzerNode };