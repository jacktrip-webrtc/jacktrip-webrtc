const FRAME_SIZE = 128;

class AudioBeepGeneratorProcessor extends AudioWorkletProcessor {
    constructor() {
        super();

        // State related to peak detection processing:
        // clicks
        this.click_index = 0;
        const bpm = 60;
        this.click_frame_interval =
            Math.round(sampleRate / FRAME_SIZE * 60 / bpm);
        this.click_index_samples = 0;
        this.click_length_samples = sampleRate / 64;

        // peak detection
        this.window = [];
        this.last_peak = Date.now();
        this.background_noise = 0;
        this.background_samples = [];
        this.max_background_samples = sampleRate * 3 / FRAME_SIZE;  // 3s
        this.frames_since_last_beat = 0;

        // tuning params
        this.peak_ratio = 10;
        this.min_peak_interval_ms = 200;
        this.window_size_samples = 20;
        this.click_interval_samples = 3000;

        this.latencies = [];

        this.isPaused = false;
        this._readAtomics = false;
        this.useSharedBufferForProcessorStatus = false;
        this.isBeepGeneratorMutedSharedBuffer = null;
        this.frameCounterBuffer = null;
        this.lastPeakBuffer = null;

        this.port.onmessage = (event) => {
            let data = event.data;

            switch(data.type) {
                case 'config':
                    for(let key in data) this[key] = data[key]; // copy all values
                    this._readAtomics = this.useSharedBufferForProcessorStatus && this.isBeepGeneratorMutedSharedBuffer != undefined;
                    break;
                case 'pause':
                case 'mute':
                    this.isPaused = true;
                    break;
                case 'play':
                case 'unmute':
                    this,this.isPaused = false;
                    break;
                default:
            }
        };
    }

    process(inputs, outputs, parameters) {
        let _isStarted =  this._readAtomics ? !Atomics.load(this.isBeepGeneratorMutedSharedBuffer, 0) : !this.isPaused;

        if(_isStarted) {
            this.click_index++;
            var is_beat = this.click_index % this.click_frame_interval == 0;
            if(is_beat) {
                // this.frames_since_last_beat = 0;
                this.frameCounterBuffer ? Atomics.store(this.frameCounterBuffer, 0, 0) : this.frames_since_last_beat = 0;
                this.click_index_samples = 0;
                console.log('BEEP GENERATOR: BEEP');
                if(this.lastPeakBuffer)
                    Atomics.compareExchange(this.lastPeakBuffer, 0, 0n, BigInt(Date.now())) != 0 ? 
                        console.error('BEEP GENERATOR: previous beep still not detected') : null;
            } else {
                // this.frames_since_last_beat++;
                this.frameCounterBuffer ? Atomics.add(this.frameCounterBuffer, 0, 1) : this.frames_since_last_beat++;
            }
    
            const freq = 1024;
            const period = sampleRate / freq;
    
            // generate beep
            for(var sample = 0; sample < outputs[0][0].length; sample++) {
                if(this.click_index_samples < this.click_length_samples) {
                    outputs[0][0][sample] = Math.sin(Math.PI * 2 * this.click_index_samples / period);
                    this.click_index_samples++;
                }
                else
                    outputs[0][0][sample] = 0; // silence

                // copy first channel on the other channels
                for(var channel = 1; channel < outputs[0].length; channel++)
                    outputs[0][channel][sample] = outputs[0][0][sample];
            }
        }
            
        return true;
    }
}

registerProcessor('audio-beep-generator-processor', AudioBeepGeneratorProcessor);