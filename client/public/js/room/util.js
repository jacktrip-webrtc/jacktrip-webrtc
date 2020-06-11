'use strict'

function getStats(name='') {
    let obj = {}
    obj.timeOrigin = performance.timeOrigin;
    obj.data = performance.getEntriesByType('mark').map((el) => {
        let newEl = {};
        newEl.name = name === '' ? el.name : `${el.name}-${name}`;
        newEl.startTime = el.startTime;
        newEl.entryType = el.entryType;
        newEl.duration = el.duration;
        return newEl;
    });

    return JSON.stringify(obj);
}

function getLimitedStats(name='', start=0, end=100) {
    let obj = {}
    obj.timeOrigin = performance.timeOrigin;
    obj.data = performance.getEntriesByType('mark')
    .filter((el) => {
        let packet_n = el.name.split("-")[2];
        if(packet_n !== undefined) {
            let n = parseInt(packet_n);
            if(n<start || n>=end) {
                return false;
            }
            else {
                return true;
            }
        }

        // Keep also messages without a number
        return true;
    })
    .map((el) => {
        let newEl = {};
        newEl.name = name === '' ? el.name : `${el.name}-${name}`;
        newEl.startTime = el.startTime;
        newEl.entryType = el.entryType;
        newEl.duration = el.duration;
        return newEl;
    });

    return JSON.stringify(obj);
}
