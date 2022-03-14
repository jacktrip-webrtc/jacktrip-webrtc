# jacktrip-webrtc

JackTrip WebRTC is an HTML5 implementation of [Jacktrip](https://ccrma.stanford.edu/software/jacktrip/) for the web browser.

Multi-machine network music performance over the Internet is achieved using high quality, uncompressed, and ultra-low delay audio signal streaming. WebRTC [MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream) is routed through the [RTCDataChannel](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel) in order to bypass processing (i.e., encoding) and buffering delay of the [RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection) media channel.

## Introduction to experiments

This branch `/experimental` is a specific version of **jacktrip-webrtc** using new technologies for a better scalability. The code, as intended by the branch name, has been built with the purpose of testing new app enhancements, no for a public (realistic) usage. Given that, the GUI is very minimal and can be hard to understand what is happening. The video and control parts have been removed, has not interesting in the testing procedure.

The main improvements in scalability are given by the usage of `SharedArrayBuffer` and `Atomics`, replacing the previous `port.postMessage` for the audio receiving procedure only. For audio trasmission, no optimizations has been found and, for that specific case only, `port.postMessage` seems working as well as `Atomics.waitAsync` which is a Google Chrome browser specific API. Moreover, the number of threads (`AudioWorklet`) is reduced to 1.

If you want to take a look at the test procedure, [this](./README_JAES_paper_tests_EN.md) document could be a good introduction to the app architecture and the tools which have been used. Further information during setup and runtime can be found in the browser console.

_Paolo Gastaldi_


## Setup

### NodeJS

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

This will start a server on http://localhost:8000 and on https://localhost:44300. To modify these values, and other parameters, you can simply create a .env file containing all required settings. More details can be found in [Configuration.md](documentation/Configuration.md)



### Docker

Alternatively you can start this app using dokcer.

After cloning the repository use the following command to create the docker image:

```bash
docker build -t jacktrip-webrtc/jacktrip-webrtc .
```



The image you obtained is configured to run the app in a production environment, so it starts only the https version of the app and it requires a ssl certificate in order to run this server. You can generate a self signed certificate through the following commands:

```bash
mkdir ssl
openssl req -new -x509 -days 365 -nodes -out ssl/ssl.cert -keyout ssl/ssl.key
chmod 600 ssl.*
```

It creates the ssl folder containing both the certificate and the key.



Then you can create and run the container using the following command:

```bash
docker run --name jacktrip-webrtc -p 44300:44300 -v "$(pwd)"/ssl:/usr/src/app/ssl -v "$(pwd)"/logs:/usr/src/app/logs -d jacktrip-webrtc/jacktrip-webrtc
```

This command will create a container using the image we created previously, will mount to it the ssl folder containing the certificate files we created before, will mount to it the logs folder, where application logs will be stored and will map the container port to the port 44300 of the machine executing the container.



Take a look at the [documentation](https://docs.docker.com/engine/reference/run/#env-environment-variables) of `docker run` to know how to define and customize environment variable. More details on the available environment variables can be found in [Configuration.md](documentation/Configuration.md)



## Usage

Now you can connect to http://localhost:8000 or https://localhost:44300 (if you used the docker version you can connect only the https server).

**NOTE:** if you are connecting to the app from a different device with respect to the one where you started the server, you need to connect to the https version, so to https://\<host-ip-address\>:44300. The http version won't work, since you need a secure context in order to use AudioWorklets, which are the foundation of this app.



Once connected you just need to create a room, by clicking on the 'Create Room' button, then allow access to camera and microphone. Once the application has access to camera and microphone, you can select which camera, microphone  and speakers to use (the last one is available only on browsers based on Chromium), and customize the size of the playout buffer, if needed. Then you can perform a loopback test if needed and then insert a name.

After you inserted a name you can join the room by clicking on the 'Join' button. 

Next you need to share the current page web address link with the other party. You can either copy it from the web browser address bar or by clicking on the button inside the notification that will appear on the top left of the screen once you join the room.

The other party needs to navigate to the received URL, perform the same steps in order to select microphone, camera, speakers and a name. Then he can join the room by clicking on the 'Join' button.



Now you are both connected and ready to communicate.
