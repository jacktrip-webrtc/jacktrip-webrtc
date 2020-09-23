'use strict'

function getStats() {
    let obj = {}
    obj.timeOrigin = performance.timeOrigin;
    obj.data = performance.getEntriesByType('mark').map((el) => {
        let newEl = {};
        newEl.name = el.name;
        newEl.startTime = el.startTime;
        newEl.entryType = el.entryType;
        newEl.duration = el.duration;
        return newEl;
    });

    return JSON.stringify(obj);
}

function getLimitedStats(start=0, end=100) {
    let obj = {}
    obj.timeOrigin = performance.timeOrigin;
    obj.data = performance.getEntriesByType('mark')
    .filter((el) => {
        let tmp = el.name.split("-");
        let packet_n = parseInt(tmp[tmp.length-1]);
        if(!isNaN(packet_n)) {
            if(packet_n<start || packet_n>=end) {
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
        newEl.name = el.name;
        newEl.startTime = el.startTime;
        newEl.entryType = el.entryType;
        newEl.duration = el.duration;
        return newEl;
    });

    return JSON.stringify(obj);
}
