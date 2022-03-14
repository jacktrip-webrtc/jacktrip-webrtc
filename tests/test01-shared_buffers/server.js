/**
 * Gastaldi Paolo
 * 27/04/2021
 */
'use strict';

const express = require('express');
const app = express();
const path = require('path');

// app.get('/', (req, res) => {
//     // headers needed to enable SharedBuffer usage on the client
//     res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
//         .setHeader('Cross-Origin-Opener-Policy', 'same-origin')
//         .sendFile(path.join(__dirname + '/index.html'));
// });

app.use(express.static('.', {
    setHeaders: function (res, path, stat) {
        // headers needed to enable SharedBuffer and Worker usage on the client
        res.set('Cross-Origin-Embedder-Policy', 'require-corp')
            .set('Cross-Origin-Opener-Policy', 'same-origin');
    }
}));

app.listen(8080);