'use strict'

// First we get the viewport height and we multiple it by 1% to get a value for a vh unit
let vh = window.innerHeight * 0.01;
// Then we set the value in the --vh custom property to the root of the document
document.documentElement.style.setProperty('--vh', `${vh}px`);

function createRoom() {
  axios.post('/room')
    .then(function (response) {
      let room = response.data;
      let url = room.data.url

      window.location.assign(url);
    })
    .catch(function (error) {
      // handle error
      console.log(error);
    })
}
