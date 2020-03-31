'use strict'

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
