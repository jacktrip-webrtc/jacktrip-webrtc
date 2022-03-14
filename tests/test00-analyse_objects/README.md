# TEST 00 - Analyse Objects

Steps:
1. `npm -i` to install dependencies
2. `node server.js` to start the Express web server
3. go to `localhost:8080` with a browser
4. using the webpage inspector look at the console messages

List of entry points/interfaces to native code (for those objects all functions are implemented in native code):
- audioContext
    + .constructor
    + .listener = AudioListener
        - .setOrientation
        - .setPosition
    + .createMediaStreamSource
    + .createMediaStreamDestination
- audioContext
    + .audioWorklet
- audioBuffer:
    + .constructor
    + .copyFromChannel
    + .copyToChannel
    + .getChannelData