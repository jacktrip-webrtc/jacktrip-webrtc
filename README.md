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

Once connected you just need to create a room, by clicking on the 'Create Room' button, then allow access to camera and microphone. Once the application has access to camera and microphone, you can select which camera, microphone  and speakers to use (the last one is available only on browsers based on Chromium). Then you can perform a loopback test if needed and then insert a name.

After you inserted a name you can join the room by clicking on the 'Join' button. 

Next you need to share the current page web address link with the other party. You can either copy it from the web browser address bar or by clicking on the button inside the notification that will appear on the top left of the screen once you join the room.

The other party needs to navigate to the received URL, perform the same steps in order to select microphone, camera, speakers and a name. Then he can join the room by clicking on the 'Join' button.



Now you are both connected and ready to communicate.
