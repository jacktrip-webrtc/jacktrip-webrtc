'use strict'

// Get room id
let room_id = window.location.pathname.split('/').pop();

// First we get the viewport height and we multiple it by 1% to get a value for a vh unit
let vh = window.innerHeight * 0.01;

// Then we set the value in the --vh custom property to the root of the document
document.documentElement.style.setProperty('--vh', `${vh}px`);

// Media configuration
const mediaConfiguration = {
    video: true,
    audio: {
        autoGainControl: false,
        echoCancellation: false,
        latency: 0,
        noiseSuppression: false,
    }
};

// Streams
let localAudioStream = new MediaStream();// Create separated streams
let localVideoStream = new MediaStream();
let socket = undefined;

// Track status
let audioTrackPlay = true;
let videoTrackPlay = true; // Used to decide wheter to mute the video or not when joining

// WebAudio API objects used for the meter
let analyser = audioContext.createAnalyser();
let input = undefined;
let output = audioContext.createMediaStreamDestination();

// WebAudio API object used for loopback
let senderAudioWorklet = undefined;
let receiverAudioWorklet = undefined;
let outputAudioWorklets = audioContext.createMediaStreamDestination();
let packet_n = 0;

// Name selected by user
let name = '';

// Loopback counter
let loopbackCounter = 0;

// Setting to decide whether or not to activate output selection
let activateAudioSelection = false;

// Start socket connection
socket = io.connect('/room', { transports: ['websocket'], rejectUnauthorized: false });

// Reset all checkboxes
$('input[type=checkbox]').prop('checked',false);

// Enable tooltips
$(function () {
    $("[data-toggle='tooltip']").tooltip({
       container: 'body'
    });
});

// Check USE_MEDIA_AUDIO
if(USE_MEDIA_AUDIO) {
    // We do not need step 2 in the modal => delete it
    let indicators = document.getElementById('modal-indicators');

    // Remove the indicator
    indicators.children[2].remove();

    // Remove the carousel item
    document.getElementsByClassName('opt-audio')[2].remove();

    // Scale indicator after the one removed to point to the correct slide
    for(let i = 2; i < indicators.children.length; i++) {
        indicators.children[i].setAttribute('data-slide-to', i);
    }

    // Hide settings
    let settingsToolbar = document.getElementById('settingsToolbar');
    settingsToolbar.classList.remove('d-flex');
    settingsToolbar.classList.add('d-none');
}

if(activateAudioSelection) {
    let audioOutputDiv = document.getElementById('audio-out-div');
    audioOutputDiv.classList.remove('collapse');
    audioOutputDiv.classList.add('d-flex');
}

// Utility function
function isEmpty(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

// Resume audio context when carousel li elements are clicked
$('#modal-indicators').children().click(() => {
    if(audioContext.state === 'suspended') {
        audioContext.resume();
    }
})

// Modal controls
function next() {
    // Resume audio context
    if(audioContext.state === 'suspended') {
        audioContext.resume();
    }

    // Go to next page of the modal
    $('#audio-options-carousel').carousel('next');
}

function previous() {
    // Go to previous page of the modal
    $('#audio-options-carousel').carousel('prev');
}

// Modal scroll issue with overflowing content: SOLVED
$('#audio-options-carousel').on('slid.bs.carousel', function() {
    document.getElementById('audio-options-carousel-content').style.overflow = 'visible';
});

// Custom control to decide which button to show in the modal
$('#audio-options-carousel').on('slide.bs.carousel', function(e) {
    // Stop eventual loopback
    if(!USE_MEDIA_AUDIO) {
        stopLoopback();
    };

    document.getElementById('audio-options-carousel-content').style.overflow = 'hidden';
    let currentIndex = e.to; // index of the slide previous to content change
    if(currentIndex == 0) {
        // Keep 'next' button, hide 'previous' and 'join' button
        $('#carousel-prev').addClass('d-none');
        $('#carousel-next').removeClass('d-none');
        $('#carousel-join').addClass('d-none');
    }
    else if (currentIndex > 0 && currentIndex < $('.opt-audio').length-1){
        // Keep 'next' and 'previous' button, hide 'join' button
        $('#carousel-prev').removeClass('d-none');
        $('#carousel-next').removeClass('d-none');
        $('#carousel-join').addClass('d-none');
    }
    else {
        // Keep and 'previous' and 'join' button, hide 'next' button
        $('#carousel-prev').removeClass('d-none');
        $('#carousel-next').addClass('d-none');
        $('#carousel-join').removeClass('d-none');
    }
});

// Handle click on dropdown-input-output lists
$('.dropdown-input-output').click(function(event){
    // Check if the selected device is different from the previous one
    if(document.getElementById(this.id+'-button').audioId !== event.target.audioId) {
        // Update selected item
        document.getElementById(this.id+'-button').innerText = event.target.innerText;
        document.getElementById(this.id+'-button').audioId = event.target.audioId;

        // Update media stream
        updateMediaStream();
    }
});

// Handle click on dropdown-source lists
$('.dropdown-source').click(function(event){
    console.log(event.target.getAttribute("data-channel-list"));
    // Check if the selected device is different from the previous one
    if(document.getElementById(this.id+'-button').getAttribute("data-channel-list") !== event.target.getAttribute("data-channel-list")) {
        // Update selected item
        document.getElementById(this.id+'-button').innerText = event.target.innerText;
        document.getElementById(this.id+'-button').setAttribute("data-channel-list", event.target.getAttribute("data-channel-list"));
        localStorage['channel-list'] = event.target.getAttribute("data-channel-list");
    }
});

function updateDeviceList() {
    // Deactivate button
    document.getElementById('test-speaker').disabled = true;

    navigator.mediaDevices.enumerateDevices()
    .then((devices) => {
        // Flags to set if it was the first device found
        let firstAudioIn = true;
        let firstAudioOut = true;
        let firstVideoIn = true;

        // Clear previous lists
        document.getElementById('audio-input').innerHTML = '';
        document.getElementById('audio-output').innerHTML = '';
        document.getElementById('video-input').innerHTML = '';

        // Insert into lists
        devices.forEach(function(device) {
            switch(device.kind) {
                case 'audioinput': {
                    // Get the div with the options
                    let audioInputDiv = document.getElementById('audio-input');

                    // Add one option
                    let a = document.createElement('a');
                    a.classList = 'dropdown-item';
                    a.audioId = device.deviceId;
                    a.innerText = device.label;
                    audioInputDiv.appendChild(a);

                    // Set previous choice from local storage, or load first device
                    if(firstAudioIn || localStorage['audio-input-id'] == device.deviceId) {
                        document.getElementById('audio-input-button').innerText = device.label;
                        document.getElementById('audio-input-button').audioId = device.deviceId;
                        firstAudioIn = false;
                    }
                    break;
                }
                case 'audiooutput': {
                    // Get the div with the options
                    let audioOutputDiv = document.getElementById('audio-output');

                    // Add one option
                    let a = document.createElement('a');
                    a.classList = 'dropdown-item';
                    a.audioId = device.deviceId;
                    a.innerText = device.label;
                    audioOutputDiv.appendChild(a);

                    // Set previous choice from local storage, or load first device
                    if(firstAudioOut || localStorage['audio-output-id'] == device.deviceId) {
                        document.getElementById('audio-output-button').innerText = device.label;
                        document.getElementById('audio-output-button').audioId = device.deviceId;
                        firstAudioOut = false;
                    }

                    break;
                }
                case 'videoinput': {
                    // Get the div with the options
                    let videoInputDiv = document.getElementById('video-input');

                    // Add one option
                    let a = document.createElement('a');
                    a.classList = 'dropdown-item';
                    a.audioId = device.deviceId;
                    a.innerText = device.label;
                    videoInputDiv.appendChild(a);

                    // Set previous choice from local storage, or load first device
                    if(firstVideoIn || localStorage['video-input-id'] == device.deviceId) {
                        document.getElementById('video-input-button').innerText = device.label;
                        document.getElementById('video-input-button').audioId = device.deviceId;
                        firstVideoIn = false;
                    }
                    break;
                }

            }
        });

        if(firstAudioOut || (typeof document.getElementById('modal-audio').setSinkId !== 'function')) {
            // No audio out found or it is not possible to select audio output -> hide list
            $('#audio-out-div').removeClass('d-flex');
            $('#audio-out-div').addClass('d-none');
            $('#audio-out-activate').removeClass('d-flex');
            $('#audio-out-activate').addClass('d-none');
        }

        // Update MediaStreams according to selected devices
        updateMediaStream();
    });
}

function updateMediaStream() {
    // Get selected options
    let audioId = document.getElementById('audio-input-button').audioId;
    let videoId = document.getElementById('video-input-button').audioId;
    let outputId = document.getElementById('audio-output-button').audioId;

    // Get default media configuration
    let conf = mediaConfiguration;

    // Update default media configuration
    conf.audio.deviceId = {
        exact: audioId
    }

    conf.video = {
        deviceId: {
            exact: videoId
        }
    }

    // Stop previous streams
    localAudioStream.getAudioTracks().forEach((track) => {
        localAudioStream.removeTrack(track);
        track.stop();
    });

    localVideoStream.getVideoTracks().forEach((track) => {
        localVideoStream.removeTrack(track);
        track.stop();
    });

    // Handle media devices
    navigator.mediaDevices.getUserMedia(conf)
    .then((stream) => {
        // Add new tracks
        stream.getAudioTracks().forEach((track) => {
            localAudioStream.addTrack(track);
            if(USE_MEDIA_AUDIO) {
                track.enabled = audioTrackPlay;
            }
        });

        stream.getVideoTracks().forEach((track) => {
            localVideoStream.addTrack(track);
            track.enabled = videoTrackPlay;
        });

        // Add local video
        let localVideo = document.getElementById('local-video');
        localVideo.srcObject = localVideoStream;

        let modalVideo = document.getElementById('modal-video');
        modalVideo.srcObject = localVideoStream;

        // Store info in local storage
        localStorage['video-input-id'] = videoId;
        localStorage['audio-input-id'] = audioId;
        localStorage['audio-output-id'] = outputId;

        // Activate button
        document.getElementById('test-speaker').disabled = false;

        /*** Section with the code relative to the meter object ***/
        // Disconnect all of them
        analyser.disconnect();
        if(input !== undefined) {
            input.disconnect();
        }

        // Create media stream source
        input = audioContext.createMediaStreamSource(localAudioStream);

        // Connect everithing
        input.connect(analyser);
        analyser.connect(output);

        // Setup the meter
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.85;
        const sampleBuffer = new Float32Array(analyser.fftSize);

        function loop() {
            // Get data
            analyser.getFloatTimeDomainData(sampleBuffer);

            // Compute peak instantaneous power over the interval.
            let peak = 0;
            for (let i = 0; i < sampleBuffer.length; i++) {
                const power = sampleBuffer[i] ** 2;
                peak = Math.max(power, peak);
            }
            const peakDbs = 10 * Math.log10(peak);

            // Display peak value.
            const meter = document.getElementById('modal-meter');
            const text = document.getElementById('modal-meter-level');

            // Set '-' as text if below threshold or actually muted
            if(peakDbs < meter.min || !audioTrackPlay) {
                text.innerHTML = '-&#8734;';
            }
            else {
                text.textContent = peakDbs.toFixed(2);
            }

            // Set meter.min if muted
            if(!audioTrackPlay) {
                meter.value = meter.min;
            }
            else {
                meter.value = isFinite(peakDbs) ? peakDbs : meter.min;
            }

            requestAnimationFrame(loop);
        }
        loop();
    })
    .catch(e => {
        console.error(e);
    })
}

function toggleFlipVideo() {
    let checkbox = document.getElementById('flip-video');
    if(checkbox.checked) {
        // Flip video
        $('#modal-video').addClass('mirror');
        $('#local-video').addClass('mirror');
    }
    else {
        // Flip video
        $('#modal-video').removeClass('mirror');
        $('#local-video').removeClass('mirror');
    }

    localStorage['flip-video'] = checkbox.checked;
}

function toggleJoinWithVideoMuted() {
    // Toggle video falg
    videoTrackPlay = !videoTrackPlay;

    // Toggle enable status for each track
    let track = localVideoStream.getVideoTracks()[0];
    track.enabled = videoTrackPlay;
    if(!track.enabled) {
        // Set the icon to hidden
        document.getElementById('videoIcon').classList = 'fas fa-video-slash';
    }
    else {
        // Set the icon to not hidden
        document.getElementById('videoIcon').classList = 'fas fa-video';
    }

    localStorage['join-video-muted'] = !videoTrackPlay;
}

function toggleJoinWithAudioMuted() {
    if(audioTrackPlay) {
        // Mute it
        if(USE_MEDIA_AUDIO) {
            // Mute it
            let track = localAudioStream.getAudioTracks()[0];
            track.enabled = false;
            audioTrackPlay = false;
        }
        else {
            // Mute it
            audioTrackPlay = false;
        }

        // Change microphone icon
        document.getElementById('audioIcon').classList = 'fas fa-microphone-slash';

        // Show mute badge
        let div = document.getElementById('local-mute-message');
        div.classList.remove('invisible');
        div.classList.add('visible');
    }
    else {
        // Unmute it
        if(USE_MEDIA_AUDIO) {
            // Unmute it
            let track = localAudioStream.getAudioTracks()[0];
            track.enabled = true;
            audioTrackPlay = true;
        }
        else {
            // Unmute it
            audioTrackPlay = true;
        }

        // Change microphone icon
        document.getElementById('audioIcon').classList = 'fas fa-microphone';

        // Hide mute badge
        let div = document.getElementById('local-mute-message');
        div.classList.remove('visible');
        div.classList.add('invisible');
    }

    localStorage['join-mic-muted'] = !audioTrackPlay;
}

function testSpeaker() {
    // create Oscillator node
    let oscillator = audioContext.createOscillator();
    let gain = audioContext.createGain();
    let mediaStreamDestination = audioContext.createMediaStreamDestination();

    // Get modal audio object and set its source
    let audio = document.getElementById('modal-audio');
    audio.srcObject = null;

    // Set oscillator values
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // value in hertz
    oscillator.connect(gain);

    // Set gain values
    gain.gain.value = 0.25;

    let playAudio1sec = () => {
        // Connect all nodes
        if(activateAudioSelection) {
            // Once the sinkId has been set, then set the sourceObject
            audio.srcObject = mediaStreamDestination.stream;
            gain.connect(mediaStreamDestination);
        }
        else {
            gain.connect(audioContext.destination);
        }

        oscillator.start();

        if(activateAudioSelection) {
            audio.play();
        }

        // Set a 1 second timeout
        let i = setTimeout(() => {
            if(activateAudioSelection) {
                // Pause audio
                audio.pause();
            }

            // Stop ocillator
            oscillator.stop();

            // Disconnect everithing
            gain.disconnect();
            oscillator.disconnect();

            // Unset the source object
            audio.srcObject = null;

            // Enable the button
            document.getElementById('test-speaker').disabled = false;
        }, 1000);
    }

    // Set sink id if there is an id and the function is available
    if(activateAudioSelection && document.getElementById('audio-output-button').audioId !== undefined && (typeof audio.setSinkId === 'function')) {
        let sinkId = document.getElementById('audio-output-button').audioId;
        audio
        .setSinkId(sinkId)
        .then(() => {
            playAudio1sec();
        })
        .catch((e) => console.error(e));
    }
    else {
        playAudio1sec();
    }

    // Disable the button
    document.getElementById('test-speaker').disabled = true;
}

function toggleActivateOutputSelection() {
    if(activateAudioSelection) {
        // Disable it
        activateAudioSelection = false;
        let audioOutputDiv = document.getElementById('audio-out-div');
        audioOutputDiv.classList.remove('d-flex');
        audioOutputDiv.classList.add('collapse');
    }
    else {
        // Eable it
        activateAudioSelection = true;
        let audioOutputDiv = document.getElementById('audio-out-div');
        audioOutputDiv.classList.remove('collapse');
        audioOutputDiv.classList.add('d-flex');
    }
}

function createAudioWorklets() {
    if(input !== undefined && senderAudioWorklet === undefined && receiverAudioWorklet === undefined) {
        // Node for sending data
        senderAudioWorklet = new DataSenderNode(audioContext);
        senderAudioWorklet.port.onmessage = (event) => {
            switch (event.data.type) {
                case 'packet':
                    let buf = event.data.buf;

                    // Send the ArrayBuffer
                    socket.emit('loopback-client-server', buf);
                    break;
            }
        };
        senderAudioWorklet.port.postMessage({
            type: 'channelList',
            channelList: document.getElementById('audio-source-button').getAttribute('data-channel-list')
        });

        // Node for receiving data
        receiverAudioWorklet = new DataReceiverNode(audioContext);
        receiverAudioWorklet.port.onmessage = (event) => {
            switch (event.data.type) {
                case 'packet_n-request':
                    // Update localPacket number for filtering (below)
                    packet_n = event.data.packet_n;
                    break;
            }
        };
        receiverAudioWorklet.port.postMessage({
            type: 'playoutBufferSize',
            playoutBufferSize: document.getElementById('playoutBufferSize').value
        });

        // Reset packet_n
        packet_n = 0;

        // Get output element
        let audio = document.getElementById('modal-audio');

        // Function to start processing
        let startProcessing = (sinkOk = false) => {
            // Set source
            audio.srcObject = outputAudioWorklets.stream;

            // Start processing
            input.connect(senderAudioWorklet);
            senderAudioWorklet.connect(receiverAudioWorklet);
            if(activateAudioSelection && sinkOk) {
                receiverAudioWorklet.connect(outputAudioWorklets);
            }
            else {
                receiverAudioWorklet.connect(audioContext.destination);
            }

            // Start audio
            audio.play();
        }

        // Set sink id if there is an id and the function is available
        if(activateAudioSelection && document.getElementById('audio-output-button').audioId !== undefined && (typeof audio.setSinkId === 'function')) {
            let sinkId = document.getElementById('audio-output-button').audioId;
            audio
            .setSinkId(sinkId)
            .then(() => {
                startProcessing(true);
            })
            .catch((e) => console.error(e));
        }
        else {
            startProcessing(false);
        }
    }
}

function removeAudioWorklets() {
    if(input !== undefined && senderAudioWorklet !== undefined && receiverAudioWorklet !== undefined) {
        // Get output element
        let audio = document.getElementById('modal-audio');

        // Disconnect everithing
        input.disconnect(senderAudioWorklet);
        senderAudioWorklet.disconnect();
        receiverAudioWorklet.disconnect();

        senderAudioWorklet.port.postMessage({
            type: 'destroy'
        });

        receiverAudioWorklet.port.postMessage({
            type: 'destroy'
        })

        senderAudioWorklet = undefined;
        receiverAudioWorklet = undefined;

        // Stop audio
        audio.pause();
        audio.srcObject = null;
    }
}

function testLoopback() {
    // Hide the test button
    let testBtn = document.getElementById('modal-test-loopback');
    testBtn.parentElement.classList.remove('d-flex');
    testBtn.parentElement.classList.add('d-none');

    // Show the stop button
    let stopBtn = document.getElementById('modal-stop-loopback');
    stopBtn.parentElement.classList.remove('d-none');
    stopBtn.parentElement.classList.add('d-flex');

    // Create AudioWorklets and start processing
    createAudioWorklets();
}

function stopLoopback() {
    // Hide the stop button
    let stopBtn = document.getElementById('modal-stop-loopback');
    stopBtn.parentElement.classList.remove('d-flex');
    stopBtn.parentElement.classList.add('d-none');

    // Show the test button
    let testBtn = document.getElementById('modal-test-loopback');
    testBtn.parentElement.classList.remove('d-none');
    testBtn.parentElement.classList.add('d-flex');

    // Stop processing and delete AudioWorklets
    removeAudioWorklets();
}

function checkName(element) {
    name = element.value;

    // If the name is empty then disable the join button, otherwise enable it
    if(name === '') {
        document.getElementById('carousel-join-button').disabled = true;
    }
    else {
        document.getElementById('carousel-join-button').disabled = false;
    }

    // Store the new name in the local storage
    localStorage['name'] = name;

    // Update name badge
    document.getElementById('local-name-display').innerText = name;
}

function toggleLogging() {
    LOG_DATA = !LOG_DATA;
    localStorage['logging'] = LOG_DATA;
}

function joinAudio() {
    // Resume audio context
    if(audioContext.state === 'suspended') {
        audioContext.resume();
    }

    // Disconnect all of the processing
    analyser.disconnect();
    if(input !== undefined) {
        input.disconnect();
    }

    // Hide modal
    $('#joinAudioModal').modal('hide');

    // Show elements
    $('#stream-elements-container').removeClass('d-none');

    // Remove event listener for device changes
    navigator.mediaDevices.ondevicechange = null;

    // Join the room
    socket.emit('join', room_id);
}

function createToast(title, innerHTML, delay=2000, id='') {
    // Function to create a toast notification
    let toast = document.createElement('div');
    if(id !== '') {
        toast.id = id; // Set id
    }
    toast.className = 'toast ml-auto custom-toast';
    toast.role = 'alert';
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    let header = document.createElement('div');
    header.className = 'toast-header bg-light';

    let rectangle = document.createElement('div');
    rectangle.className = 'rounded bg-blu mr-2';
    rectangle.style.width = '20px';
    rectangle.style.height = '20px';

    let strong_text = document.createElement('strong');
    strong_text.className = 'mr-auto';
    strong_text.innerText = title; // Set title

    let small_text = document.createElement('small');
    small_text.className = 'text-muted';
    small_text.innerText = 'just now';

    let button = document.createElement('button');
    button.className = 'ml-2 mb-1 close btn-no-outline';
    button.setAttribute('data-dismiss', 'toast');
    button.setAttribute('aria-label', 'Close');

    let span = document.createElement('span');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = '&times;'

    button.appendChild(span);
    header.appendChild(rectangle);
    header.appendChild(strong_text);
    header.appendChild(small_text);
    header.appendChild(button);

    let body = document.createElement('div');
    body.className = 'toast-body text-wrap px-0 py-0';
    body.appendChild(innerHTML); // Append content

    toast.appendChild(header);
    toast.appendChild(body);

    $('#messages').append(toast);

    $(toast).toast({delay: delay});
    $(toast).toast('show');
}

function createShareLinkToast() {
    // Function to create the toast notification with the link to be shared
    let div = document.createElement('div');
    div.classList = 'd-flex flex-wrap w-100 col-12 px-0';

    let div1 = document.createElement('div');
    div1.classList = 'col-sm-10 col-xs-8 py-2 pr-1'

    let p = document.createElement('p');
    p.classList = 'my-0'
    p.innerHTML = `<strong>Share the room link with others:</strong> ${window.location.href}`

    let div2 = document.createElement('div');
    div2.classList = 'col-sm-2 col-xs-4 btn-blu d-flex copy-btn py-12px'
    div2.onclick = () => {
        $(div2).tooltip('hide').attr('data-original-title','Link copied');
        $(div2).tooltip('show');
        navigator.clipboard.writeText(window.location.href);

        setTimeout(() => {
            $('#link-toast').toast('hide')
        }, 500)
    }
    div2.setAttribute('data-toggle', 'tooltip');
    div2.setAttribute('data-placement', 'bottom');
    div2.setAttribute('data-title','Copy link');

    div2.onmouseover = () => {
        $(div2).tooltip('show'); // Show tooltip when overing over the 'button'
    }

    div2.onmouseout = () => {
        $(div2).tooltip('hide'); // Hide tooltip when not overing anymore over the 'button'
    }

    let i = document.createElement('i');
    i.classList = 'far fa-copy my-auto mx-auto text-white'

    div1.appendChild(p);
    div2.appendChild(i);

    div.appendChild(div1);
    div.appendChild(div2);

    createToast('Room link', div, 10000, 'link-toast');
}

function toggleMuteAudio() {
    if(audioTrackPlay) {
        // Mute it
        if(USE_MEDIA_AUDIO) {
            // Mute it
            let track = localAudioStream.getAudioTracks()[0];
            track.enabled = false;
            audioTrackPlay = false;
        }
        else {
            // Mute it
            audioTrackPlay = false;
        }

        // Change microphone icon
        document.getElementById('audioIcon').classList = 'fas fa-microphone-slash';

        // Show mute badge
        let div = document.getElementById('local-mute-message');
        div.classList.remove('invisible');
        div.classList.add('visible');
    }
    else {
        // Unmute it
        if(USE_MEDIA_AUDIO) {
            // Unmute it
            let track = localAudioStream.getAudioTracks()[0];
            track.enabled = true;
            audioTrackPlay = true;
        }
        else {
            // Unmute it
            audioTrackPlay = true;
        }

        // Change microphone icon
        document.getElementById('audioIcon').classList = 'fas fa-microphone';

        // Hide mute badge
        let div = document.getElementById('local-mute-message');
        div.classList.remove('visible');
        div.classList.add('invisible');
    }

    // Send track status to all connected peers
    for(let id in peers) {
        peers[id].sendTrackStatus();
    }
}

function toggleMuteVideo() {
    let track = localVideoStream.getVideoTracks()[0];
    if(track.enabled) {
        // Mute it
        track.enabled = false;
        document.getElementById('videoIcon').classList = 'fas fa-video-slash';
    }
    else {
        // Unmute it
        track.enabled = true;
        document.getElementById('videoIcon').classList = 'fas fa-video';
    }
}

function showSettingsModal() {
    // Open settings modal
    $('#settingsModal').modal('show');
}

function showStatsModal() {
    // Open settings modal
    $('#statsModal').modal('show');
}

function createLoopbackEntry(id, name, startCallback, stopCallback) {
    let entryDiv = document.getElementById('loopbackEntries');

    if(entryDiv.children.length == 0) {
        // Hide message
        document.getElementById('loopbackMessage').classList.add('d-none');

        // Show div
        entryDiv.classList.remove('d-none');
        entryDiv.classList.add('d-flex');
    }

    let div = document.createElement('div');
    div.classList='d-flex flex-row w-100 mb-3';
    div.id = `entry-${id}`;

    let div1 = document.createElement('div');
    div1.classList='d-flex w-75 justify-content-start';

    let p = document.createElement('p');
    p.classList = 'my-auto';
    p.innerText = name;

    div1.appendChild(p);

    let div2 = document.createElement('div');
    div2.classList='d-flex w-25 justify-content-end'

    let btn1 = document.createElement('button');
    btn1.classList='btn btn-blu';
    btn1.innerText = 'Loopback';
    btn1.onclick = () => {
        // Hide btn1 and show btn2
        div2.classList.remove('d-flex');
        div2.classList.add('d-none');

        startCallback();

        div3.classList.remove('d-none');
        div3.classList.add('d-flex');

        loopbackCounter++;
        document.getElementById('loopbackCounter').innerText = loopbackCounter;

        if(loopbackCounter === 1) {
            // Disable loopback type selection
            for(let i of document.getElementById('audio-loopback-btn-goup').children) {
                i.disabled = true;
            }
        }
    }

    div2.appendChild(btn1);

    let div3 = document.createElement('div');
    div3.classList='d-none w-25 justify-content-end';

    let btn2 = document.createElement('button');
    btn2.classList = 'btn btn-blu';
    btn2.innerText = 'Stop';
    btn2.onclick = () => {
        // Hide btn2 and show btn1
        div3.classList.remove('d-flex');
        div3.classList.add('d-none');

        stopCallback();

        div2.classList.remove('d-none');
        div2.classList.add('d-flex');

        loopbackCounter--;
        document.getElementById('loopbackCounter').innerText = loopbackCounter === 0 ? '' : loopbackCounter;

        if(loopbackCounter === 0) {
            // Enable loopback type selection
            for(let i of document.getElementById('audio-loopback-btn-goup').children) {
                i.disabled = false;
            }
        }
    }

    div3.appendChild(btn2);

    div.appendChild(div1);
    div.appendChild(div2);
    div.appendChild(div3);

    entryDiv.appendChild(div);

    // Show loopback settings
    let loopbackSettings = document.getElementById('audio-loopback-info')
    loopbackSettings.classList.remove('d-none');
    loopbackSettings.classList.add('d-flex');
}

function removeLoopbackEntry(id) {
    document.getElementById(`entry-${id}`).remove();

    let entryDiv = document.getElementById('loopbackEntries');

    if(entryDiv.children.length == 0) {
        // Show message
        document.getElementById('loopbackMessage').classList.remove('d-none');

        // Hide div
        entryDiv.classList.add('d-none');
        entryDiv.classList.remove('d-flex');

        // Hide loopback settings
        let loopbackSettings = document.getElementById('audio-loopback-info')
        loopbackSettings.classList.remove('d-flex');
        loopbackSettings.classList.add('d-none');
    }
}

function setAudioLoopbackType() {
    USE_AUDIO_LOOPBACK = true;
    document.getElementById('audio-loopback-type').innerText = "Audio";
}

function setDataChannelLoopbackType() {
    USE_AUDIO_LOOPBACK = false;
    document.getElementById('audio-loopback-type').innerText = "Network";
}

fetch('/room/turn')
.then((response) => {
    // Examine the JSON in the response
    return response.json();
})
.then((turn) => {
    if(!isEmpty(turn)) {
        // Add the TURN server in the array
        configuration.iceServers.push(turn);
    }
})
.then(() => {
    // Register sender node before entering the room, so the DataSenderProcessor is available in each other step
    return audioContext.audioWorklet.addModule('/js/room/data-sender-processor.js')
})
.then(() => {
    // Register receiver node before entering the room, so the DataReceiverProcessor is available in each other step
    return audioContext.audioWorklet.addModule('/js/room/data-receiver-processor.js');
})
.then(() => {
    // Check if the room exists
    socket.emit('check-room', room_id);
})
.catch(e => {
    console.error(e);
});

socket.on('room-checked', (exists, error) => {
    if(exists) {
        navigator.mediaDevices.getUserMedia(mediaConfiguration)
        .then((stream) => {
            // Update local streams
            stream.getVideoTracks().forEach((track) => {
                localVideoStream.addTrack(track);
            });

            stream.getAudioTracks().forEach((track) => {
                localAudioStream.addTrack(track);
            });

            document.getElementById('modal-video').srcObject = localVideoStream;
            document.getElementById('modal-video').autoplay = true;

            // Load checkbox values from localStorage - default value = false
            if(localStorage['flip-video'] === 'true') {
                document.getElementById('flip-video').checked = true;
                toggleFlipVideo();
            }

            if(localStorage['join-video-muted'] === 'true') {
                document.getElementById('join-video-muted').checked = true;
                toggleJoinWithVideoMuted();
            }

            if(localStorage['join-mic-muted'] === 'true') {
                document.getElementById('join-mic-muted').checked = true;
                toggleJoinWithAudioMuted();
            }

            // Event listener for device changes
            navigator.mediaDevices.ondevicechange = function(event) {
                updateDeviceList();
            }

            // Update list of devices
            updateDeviceList();

            // Perload channel selection
            if(localStorage['channel-list']) {
                // Check that the channel list is valid
                let channelList = localStorage['channel-list'];
                let selectedElement = document.getElementById('audio-source').children[0];
                for(let el of document.getElementById('audio-source').children) {
                    if(el.getAttribute('data-channel-list') === channelList) {
                        selectedElement = el;
                        break;
                    }
                }

                // Use selected element, which contains or the selected element or the default value
                let btn = document.getElementById('audio-source-button');
                btn.innerText = selectedElement.innerText;
                btn.setAttribute('data-channel-list', selectedElement.getAttribute('data-channel-list'));

                // Store a valid value in case the previous value was not valid
                localStorage['channel-list'] = selectedElement.getAttribute('data-channel-list');
            }
            else {
                // Use the default value (which is the first element)
                let selectedElement = document.getElementById('audio-source').children[0];
                let btn = document.getElementById('audio-source-button');
                btn.innerText = selectedElement.innerText;
                btn.setAttribute('data-channel-list', selectedElement.getAttribute('data-channel-list'));
            }

            // Update playout buffer size slider
            let slider = document.getElementById('playoutBufferSize');
            let sliderValue = document.getElementById('playoutBufferSizeValue');

            // Check if it is present a value from local storage else use default value of 8
            if(localStorage['playoutBufferSize']) {
                let pbs = parseInt(localStorage['playoutBufferSize']);

                // Check if the number is valid
                if(pbs >=2 && pbs <=30) {
                    sliderValue.innerHTML = localStorage['playoutBufferSize'];
                }
                else {
                    sliderValue.innerHTML = 8;
                }
            }
            else {
                sliderValue.innerHTML = 8;
            }
            slider.value = sliderValue.innerHTML;

            // Update playout buffer on slide
            slider.oninput = function() {
                sliderValue.innerHTML = this.value;
                localStorage['playoutBufferSize'] = this.value;
            }

            // Load previous name
            if(localStorage['name'] !== undefined) {
                let val = localStorage['name'].substring(0, localStorage['name'].length <= 25 ? localStorage['name'].length : 25);
                name = val;
                localStorage['name'] = val;
            }
            document.getElementById('name').value = name;

            // Load logging selection
            if(localStorage['logging'] !== undefined) {
                LOG_DATA = (localStorage['logging'] === 'true');
                $('#customSwitch2').prop( "checked", LOG_DATA);
            }

            // Enable the join button if the name is not empty
            if(name !== '') {
                document.getElementById('carousel-join-button').disabled = false;
            }

            // Update name badge
            document.getElementById('local-name-display').innerText = name;

            // Room exists => Open modal to join room
            $('#joinAudioModal').modal('show');
        })
        .catch((e) => console.error(e));
    }
    else {
        // Room does not exist => Show error modal
        let p = document.getElementById('errorMessage');
        p.innerText = error;
        $('#errorModal').modal('show');

        console.error(error);
    }
})

socket.on('loopback-server-client', (buf) => {
    if(receiverAudioWorklet !== undefined) {
        // Get packet number
        let local_packet_n = Packet.getPacketNumber(buf);

        // If packet_n is >= last packet received => send it to the processor
        // Otherwise drop it (to save time)
        if(local_packet_n >= packet_n){
            // Process data (tranfer of ownership)
            receiverAudioWorklet.port.postMessage({
                type: 'packet',
                data: buf
            });
        }
        else {
            //console.log('Packet dropped -'+local_packet_n);
        }
    }
})

// Once joined
socket.on('joined', (clients) => {
    createShareLinkToast();

    if(USE_MEDIA_AUDIO) {
        // Stop audioContext
        audioContext.suspend();
    }

    // Create a peer connection for each client
    clients.forEach((id, index) => {
        // I will be the one sending the offer -> true
        createNewPeer(id, socket, true);
    });

    // Leave the room when i leave the page
    window.onunload = function(){
        socket.emit('leave');

        // Stop all peerConnections
        for(let id in peers) {
            removePeer(id);
        }

        // Unload streams
        localAudioStream.getAudioTracks().forEach((track, index) => {
            localAudioStream.removeTrack(track);
            track.stop();
        });

        localVideoStream.getVideoTracks().forEach((track, index) => {
            localVideoStream.removeTrack(track);
            track.stop();
        });
    }

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
    // Show error modal
    let p = document.getElementById('errorMessage');
    p.innerText = error;
    $('#errorModal').modal('show');

    console.error(error);
})

// Handle signaling of ICE candidate
socket.on('new candidate', (candidate, id) => {
    addIceCandidate(id, candidate);
})
