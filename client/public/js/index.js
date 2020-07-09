'use strict'

// First we get the viewport height and we multiple it by 1% to get a value for a vh unit
let vh = window.innerHeight * 0.01;

// Then we set the value in the --vh custom property to the root of the document
document.documentElement.style.setProperty('--vh', `${vh}px`);

function createRoom() {
    fetch('/room', {
        method: 'POST'
    })
    .then((response) => {
        // Examine the JSON in the response
        return response.json();
    })
    .then((data) => {
        let room = data;
        let url = room.data.url

        window.location.assign(url);
    })
    .catch((error) => {
        // handle error
        console.error(error);
    })
}
