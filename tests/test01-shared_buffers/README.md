# TEST 01 - Shared Buffers

Steps:
1. `npm -i` to install dependencies
2. `node server.js` to start the Express web server
3. go to `localhost:8080` with a browser
4. using the webpage inspector look at the console messages

Notes:
- server is needed to set these HTTP headers:
    ```
    'Cross-Origin-Embedder-Policy : require-corp'
    'Cross-Origin-Opener-Policy' : 'same-origin'
    ```
    That allows SharedBuffer and Worker usage on the client