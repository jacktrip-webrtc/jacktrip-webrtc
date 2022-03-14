const FRAME_SIZE = 128;

class AudioBeepAnalyzerProcessor extends AudioWorkletProcessor {
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
        this.last_peak = null;
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
        this.isMutedSharedBuffer = null;
        this.isBeepAnalyzerMutedSharedBuffer = null;
        this.frameCounterBuffer = null;
        this.lastPeakBuffer = null;

        this.port.onmessage = (event) => {
            let data = event.data;

            switch(data.type) {
                case 'config':
                    for(let key in data) this[key] = data[key]; // copy all values
                    this._readAtomics = this.useSharedBufferForProcessorStatus && this.isBeepAnalyzerMutedSharedBuffer != undefined;                    break;
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
        let _isStarted =  this._readAtomics ? !Atomics.load(this.isBeepAnalyzerMutedSharedBuffer, 0) : !this.isPaused;

        if(_isStarted && inputs[0][0]) {
            this.click_index++;
            var is_beat = this.click_index % this.click_frame_interval == 0;
            if (is_beat) {
                this.frames_since_last_beat = 0;
                this.click_index_samples = 0;
            } else {
                this.frames_since_last_beat++;
            }

            const freq = 1024;
            // const period = sampleRate / freq;

            // forward
            for(let channel=0; channel<inputs[0].length; channel++)
                for(let sample=0; sample<inputs[0][0].length; sample++)
                    outputs[0][channel][sample] = inputs[0][channel][sample];

            // analyze beep
            let noise = 0;
            for(let i=0; i < inputs[0][0].length; i++) {
                var sample = inputs[0][0][i];
                noise += Math.abs(sample);

                this.window.push(sample);
                if(this.window.length > this.window_size_samples)
                    this.window.shift();

                if(this.background_noise > 0)
                    this.detect_peak(i);
            }
            if(this._isPeakDetected) this._printResults();
            this.background_samples.push(noise);
            this.background_noise += noise;
            if (this.background_samples.length > this.max_background_samples)
                // Note: if this ends up using too much CPU we can use a circular buffer.
                this.background_noise -= Math.abs(this.background_samples.shift());
        }

        return true;
    }

    /**
     * detect peak and compute latency
     * @param {Number} index 
     */
    detect_peak(index) {
        var now = Date.now();
        let _lastPeakBuffer = this.lastPeakBuffer ? Number(Atomics.load(this.lastPeakBuffer, 0)) : Date.now();
        var abs_sum = 0;
        for(var i = 0; i < this.window.length; i++) {
            abs_sum += Math.abs(this.window[i]);
        }

        if(abs_sum / this.window.length >
                this.background_noise / (
                    this.background_samples.length * FRAME_SIZE) * this.peak_ratio &&
                now - this.last_peak > this.min_peak_interval_ms) {
            // update values, record a new peak has been found
            this.last_peak = now;
            Atomics.store(this.lastPeakBuffer, 0, 0n); // reset

            // compute latency
            let _frames_since_last_beat = this.frameCounterBuffer ? Atomics.load(this.frameCounterBuffer, 0) : this.frames_since_last_beat;
            var latency_samples = index + FRAME_SIZE*_frames_since_last_beat;
            var latency_ms = 1000.0 * latency_samples / sampleRate;
            if (latency_ms > 500)
                latency_ms -= 1000;
            let latency_ms_by_date = now - _lastPeakBuffer;

            console.log(`BEEP ANALYZER RESULT: ${latency_ms.toFixed(2)}ms (w/ Date: ${latency_ms_by_date}ms)`);
        }
    }
}

registerProcessor('audio-beep-analyzer-processor', AudioBeepAnalyzerProcessor);