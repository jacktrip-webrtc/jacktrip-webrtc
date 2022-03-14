'use strict';

/**
 * @author Sacchetto Matteo
 * @author Gastaldi Paolo
 * 
 * create audio app and set GUI event handlers
 */

import AudioApp from './audio-app.js';
import * as config from './config/config.js';

let globalAudioContext = null;

// let config = await import('./config/config.js');

async function reloadConfig() {
    const url = `/js/room/config/config.js`;
    const res = await fetch(url);
    const data =  await res.text();

    const lines = data.split('\n');
    console.log(lines);
    const newConfig = {}
    for (let key in config) newConfig[key] = config[key];

    for (let line of lines) {
        // WTF? And OR condition between both regex does not match re1 anymore...
        // I have to check them in 2 steps...
        const re1 = /^export const (?<key>\w+) = (?<value>(("[^"]*")|('[^']*')));/mg;
        const re2 = /^export const (?<key>\w+) = (?<value>\w+);/mg;
        
        let match = re1.exec(line);
        if (match === null) {
            match = re2.exec(line);
            if (match === null) {
                // console.log(`No match in "${line}"`);
                continue;
            }
        }

        console.log(`Match ${match.groups.key}:${match.groups.value} in "${line}"`);

        if (newConfig[match.groups.value] != undefined) // If this key refers to another key
            match.groups.value = newConfig[match.groups.value];

        if (newConfig[match.groups.key] != undefined)
            newConfig[match.groups.key] = eval(match.groups.value);
        else
            console.error(`Key ${match.groups.key} not found`);
    }
    console.log(newConfig);

    // release app resources (except audioContext in some cases)
    await app.destroy();

    // setup audio app
    await app._setupCircularBuffers(newConfig);
    await app._setupAudioChain(newConfig);
    console.log("The new configuration has been loaded!");
}
$('#updateConfigButton').click(reloadConfig);

/*
---- create the audio app ----
*/

// check which browser is used
// Google Chrome only support Atomics.waitAsync currently
const isChrome = navigator.userAgent.indexOf("Chrome") !== -1;
if(config.useWaitAsync && !isChrome)
    throw new Error('This browser cannot support Atomics.waitAsync, change config');

const app = new AudioApp({
    navigator: navigator,
    window: window,
    document: document,
    audio: document.getElementById('modal-audio'),
    // channelList: document.getElementById('audio-source-button').getAttribute('data-channel-list')
});

// setup audio app
app.setup(config)
.then(() => { if(config.LOG_DATA) console.log('The app has been loaded!') })
.catch(console.error);

/*
---- GUI event handlers management ----
*/

// app state
let micIsMuted = false;
let speakerIsMuted = false;
let isNetworkLoopback = false;
let isSinActive = false;

async function toggleMuteMic() {
    try {
        if(isNetworkLoopback)
            return; // no mic control in this case
        
        micIsMuted ? await app.play() : await app.mute();
        micIsMuted = !micIsMuted;

        // graphical things, change microphone icon
        micIsMuted ?
            document.getElementById('micIcon').classList = 'fas fa-microphone-slash' :
            document.getElementById('micIcon').classList = 'fas fa-microphone';
    } catch(e) { console.error(e); }

}

async function toggleMuteSpeaker() {
    try {
        speakerIsMuted ? await app.play() : await app.silence();
        speakerIsMuted = !speakerIsMuted;
        
        // graphical things, change microphone icon
        speakerIsMuted ?
            document.getElementById('speakerIcon').classList = 'fas fa-volume-mute' :
            document.getElementById('speakerIcon').classList = 'fas fa-volume-up';
    } catch(e) { console.error(e); }
}

async function toggleNetworkLoopback() {
    try {
        isNetworkLoopback = !isNetworkLoopback;
        if(app && app.clientManager) {
            app.clientManager.forEach(client => {
                if(client && client.dataChannel && client.dataChannel.isNetworkLoopback != undefined)
                    Atomics.store(client.dataChannel.isNetworkLoopback, 0, config.useAudioLoopback && isNetworkLoopback);
                else
                    console.error('Cannot set new network loopback value');
            });
            isNetworkLoopback ? await app.mute() : await app.play(); // DO NOT send my mic audio
            isNetworkLoopback ?
                document.getElementById('micIcon').classList = 'fas fa-microphone-slash' :
                document.getElementById('micIcon').classList = 'fas fa-microphone';
        }
        
        // graphical things, change microphone icon
        isNetworkLoopback ?
            document.getElementById('networkLoopbackIcon').classList = 'fas fa-share-square' :
            document.getElementById('networkLoopbackIcon').classList = 'far fa-share-square';
    } catch(e) { console.error(e); }
}

async function toggleSin() {
    try {
        isSinActive ? await app._setSinActive(false) : await app._setSinActive(true);
        isSinActive = !isSinActive;

        isSinActive ?
            document.getElementById('sinIcon').classList = 'fas fa-bell' :
            document.getElementById('sinIcon').classList = 'far fa-bell';
        // no graphical changes
    } catch(e) { console.error(e); }
}
if(!config.addSin) {
    document.getElementById("sinButton").disabled = true;
    document.getElementById("sinIcon").classList = 'fas fa-times';
}

// attach event handlers
$('#micButton').click(toggleMuteMic);
$('#speakerButton').click(toggleMuteSpeaker);
$('#networkLoopbackButton').click(toggleNetworkLoopback);
$('#sinButton').click(toggleSin);

// just for testing
function selectAllExceptMe(id) {
    // console.log(`selectAllExceptMe ${id}`);

    if(id == 'unmute all')
        app.clientManager.forEach((client) => {
            client.dataChannel.mute = false;
        });
    else
        app.clientManager.forEach((client) => {
            client.dataChannel.mute = client.id != id;
        });
}

// just for testing
document.getElementById('peerSelect').onchange = (event) => {
    let e = document.getElementById('peerSelect');
    let id = e.options[e.selectedIndex].id;
    selectAllExceptMe(id);
};
let option = document.createElement("option");
option.text = 'unmute all';
option.id = 'unmute all';
document.getElementById('peerSelect').add(option); 

$('#graphModal').on('shown.bs.modal', function () {
    let ids = app.getPeerIds();
    let select = document.getElementById('graphPeerSelect');
    let length = select.options.length;
    for(let i = length-1; i >= 0; i--) { // remove all entries
        select.options[i] = null;
    }

    ids.forEach(id => {
        let option = document.createElement("option");
        option.text = id;
        option.id = id;
        select.add(option); 
    });
    updateJitterGraph({ id: ids[0] || null });
});

let configData = {
    datasets: [],
    labels: [],
};
const chartConfig = {
    type: 'scatter',
    data: configData,
    options: {
        responsive: true,
        plugins: {
            legend: { position: 'top', },
            title: {
                display: true,
                text: 'JITTER'
            }
        },
        animation: false,
    },
    scales: {
        x: { display: true, },
        y: { display: true, }
    },
};
let ctx = document.getElementById('myChart').getContext('2d');
let chart = new Chart(ctx, chartConfig);

async function updateChart(chart, data) {
    // clear all
    chart.data.labels.forEach(label => {
        chart.data.labels.pop();
    });
    chart.data.datasets.forEach(dataset => {
        chart.data.datasets.pop();
    });

    // re-set all values
    data.datasets.forEach(dataset => {
        chart.data.datasets.push(dataset);
    })
    chart.update();
}

async function _scaleJitterData(jitterData) {
    for(let [key, obj] of Object.entries(jitterData)) {
        let min = Math.min(...obj.data.map(d => d.y));
        console.log(`min y for ${key} = ${min}`);
        for(let d of obj.data) {
            d.y -= min;
        }
    }
    return jitterData;
}

function _selectDataForChart(jitterData) {
    let newData = [];
    jitterData.forEach(item => newData.push({
        x: item.x,
        y: item.y,
    }));

    return newData;
}

function _createChartJSDataset(jitterData) {
    return {
        datasets: [ {
            label: 'Received packets',
            // data: _selectDataForChart(jitterData['onreceive'].data),
            data: jitterData['onreceive'].data,
            color: [ 'rgba(255, 0, 0, 0) '],
            backgroundColor: [ 'rgba(255, 99, 132, 0.2)', ],
            borderColor: [ 'rgba(255, 0, 0, 1) '], // red
        }, {
            label: 'Sent packets',
            // data: _selectDataForChart(jitterData['onsend'].data),
            data: jitterData['onsend'].data,
            color: [ 'rgba(0, 255, 0, 0) '],
            backgroundColor: [ 'rgba(255, 99, 132, 0.2)', ],
            borderColor: [ 'rgba(0, 255, 0, 1) '], // green
        } ]
    };
}

async function prepareData(jitterData) {
    // jitterData = await _scaleJitterData(jitterData);
    jitterData = await _createChartJSDataset(jitterData);
    return jitterData;
}

async function updateJitterGraph(event) {
    let select = document.getElementById('graphPeerSelect');
    let selectedPeer = select.options[select.selectedIndex];
    if(! (selectedPeer && selectedPeer.id))
        return;
    let id = selectedPeer.id;
    if(id) {
        let data = app.getJitterData(id);
        if(!data) {
            console.error('Missing jitter data!')
            return;
        }
        data['onreceive'] = data['onreceive'] || { data: [] };
        data['onsend'] = data['onsend'] || { data: [] };
        data = await prepareData(data);
        await updateChart(chart, data);
    }
}

function downloadJitterDataAsJSON() {
    const data = chart.data.datasets;
    const fileName = 'jitterData.json';
    var fileToSave = new Blob([JSON.stringify(data)], {
        type: 'application/json',
        name: fileName
    });
    
    // Save the file
    saveAs(fileToSave, fileName);
}

if(!config.isJitterTracked) {
    document.getElementById("graphButton").disabled = true;
    document.getElementById("graphIcon").classList = 'fas fa-times';
}
$('#graphPeerSelect').change(updateJitterGraph);
$('#jitterDownloadButton').click(downloadJitterDataAsJSON);