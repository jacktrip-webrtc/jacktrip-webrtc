# jacktrip-webrtc

JackTrip WebRTC is an HTML5 implementation of [Jacktrip](https://ccrma.stanford.edu/software/jacktrip/) for the web browser.

Multi-machine network music performance over the Internet is achieved using high quality, uncompressed, and ultra-low delay audio signal streaming. WebRTC [MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream) is routed through the [RTCDataChannel](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel) in order to bypass processing (i.e., encoding) and buffering delay of the [RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection) media channel.



## Setup

After cloning the repository use the following commands to install all dependencies:

```bash
npm install
cd client
npm install
cd ..
```



To start the server use the following command:

```bash
npm start
```

or

```bash
node app.js
```

This will start a server on http://localhost:8000 and on https://localhost:44300. To modify those values, and also other parameters, you can simply create a .env file containing all required settings.   More details about that can be found in [Configuration.md](documentation/Configuration.md)



## Usage

Now you can connect to http://localhost:8000 or https://localhost:44300 and to https://\<host-ip-address\>:44300 if connecting from another device.

Once connected you just need to create a room, by clicking on the 'Create Room' button, then allow access to camera and microphone and click on the 'Join Audio' button to actually join the room with audio.

Next you need to share the link with the other party.

The other party needs to navigate to the received URL, allow access to camera and microphone and join the room with audio, by clicking on the 'Join Audio' button.



Now you are both connected and ready to communicate.