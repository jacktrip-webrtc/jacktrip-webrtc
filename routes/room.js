/*** Node modules ***/
const express = require('express');
const root = require('app-root-path');
const httpStatusCodes = require('http-status-codes');
const crypto = require('crypto');
const urlJoin = require('url-join');
const url = require('url');
const path = require('path');

/*** Custom modules ***/
const logger = require(`${root}/lib/logger.js`);
const utils = require(`${root}/lib/utils.js`);
const config = require(`${root}/lib/config.js`);
const {
  Exception,
  CommunicationException
} = require(`${root}/lib/exceptions.js`);
const Timeout = require(`${root}/lib/timeout.js`);

/*** Global variables ***/
const staticFolder = path.join(`${root}`,config.staticFolder);
const timeoutSec = config.timeoutSec;
let rooms = {};

/*** Custom functions ***/
/**
 * @function randomString
 *
 * Function to obtain a url valid random strings
 *
 * @param {Number} [size=12]
 *    The number of characters the string should contain
 *
 * @returns {String}
 *    Returns the generated string
 *
 * @throws
 *
**/
function randomString(size = 12) {
  let string;
  let i = 0;
  let n = Math.pow(16, size);

  do {
    string = crypto
    .randomBytes(size)
    .toString('hex')
    .slice(0, size);

    i++;
    if(i > n) {
      throw new Exception('All rooms are busy');
    }
  } while (rooms[string] != undefined);

  return string;
}

/**
 * @function mapElements
 *
 * Function to map object's elemnts using a given function.
 * It does not modified the passed object, but returns a new one
 *
 * @param {Object} obj
 *    The object which elements have to be remapped
 *
 * @param {Function} f
 *    The function which has to be applied to every element of the object
 *
 * @returns {Object}
 *    Return the generated object
 *
**/
function mapElements(obj, f) {
  return Object.fromEntries(Object.entries(rooms).map(([k, v]) => [k, f(v)]));
}

/*** Create route ***/
const router = express.Router();

/*** Handle routes ***/
// Route '/'
router
.route('/')
.get((req, res, next) => {
  let data = mapElements(rooms, x => ({
      id: x.id,
      url: x.url,
      num_users: x.num_users
    })
  );

  res
    .status(200)
    .send(utils.createHttpResponse(200, {rooms: data}));
})
.post((req, res, next) => {
  // Create a room
  let uniqueString = randomString();

  let room = {
    id: uniqueString,
    url: url.format({
      protocol: req.protocol,
      host: req.get('host'),
      pathname: urlJoin(req.originalUrl, uniqueString)
    }),
    num_users: 0,
    users: {},
    job: new Timeout(timeoutSec, () => {
    	delete rooms[uniqueString];
    })
  };

  // Save room
  rooms[uniqueString] = room;

  // Start job
  room.job.start();

  res
    .status(200)
    .send(utils.createHttpResponse(200,{ url: room.url }));
});

// Route '/:id'
router
.route('/:id')
.get((req, res, next) => {
  let file = path.join(staticFolder, req.baseUrl, 'index.html');
  res
    .status(200)
    .sendFile(file);
});

/*** Handle socket.io ***/
function handleSocket(io) {
  // Define socket.io functions
  io.on('connection', function (socket) {
    // Keep track of the room for the disconnect
    let roomJoined;

    // Join room
    socket.on('join', (room) => {
      logger.info(`Socket ${socket.id} tried to join room ${room}`)
      try{
        // Check if the socket already joined a room
        let joinedRoom = Object.keys(socket.rooms)[1];
        if(joinedRoom != undefined) {
          // Already joined a rooms
          throw new CommunicationException(`Already joined room ${joinedRoom}`);
        }

        // Otherwise check if room exists
        if(rooms[room] != undefined){
          // Room exists

          // Stop job
          rooms[room].job.stop();

          // Join the room
          socket.join(room, () => {
            // Logging
            logger.info(`Socket ${socket.id} joined room ${room}`);

            // Set joined room
            roomJoined = room;

            // Get clients
            let clients = [];
            Object.keys(rooms[room].users).forEach((key,index) => {
              clients.push(key);
            });

            // Store info about clients
            rooms[room].users[socket.id] = socket.id;
            rooms[room].num_users++;

            // Let the user know he is connected
            socket.emit('joined', clients);

            // Let other users know he is connected
            socket.to(room).emit('new client', socket.id);
          });
        }
        else {
          // Room does not exist
          throw new CommunicationException(`Room ${room} does not exist`);
        }
      } catch (e) {
        logger.info(e.message);
        socket.emit('communication error', e.message);
      }
    });

    // Signal offer to remote
    socket.on('offer', (offer, id) => {
      // Logging
      logger.info(`Socket ${socket.id} sent an offer to ${id}`);

      try {
        let room = Object.keys(socket.rooms)[1];
        if(room != undefined) {
          // Room joined
          io.sockets[id].emit('incoming offer', offer, socket.id);
        }
        else {
          // Socket did not join any room
          throw new CommunicationException('You must join a room before sending data')
        }
      } catch (e) {
        logger.info(e.message);
        socket.emit('communication error', e.message);
      }
    });

    // Signal answer to remote
    socket.on('answer', (answer, id) => {
      // Logging
      logger.info(`Socket ${socket.id} sent an answer to ${id}`);

      try {
        let room = Object.keys(socket.rooms)[1];
        if(room != undefined) {
          // Room joined
          io.sockets[id].emit('incoming answer', answer, socket.id);
        }
        else {
          // Socket did not join any room
          throw new CommunicationException('You must join a room before sending datas')
        }
      } catch (e) {
          logger.info(e.message);
        socket.emit('communication error', e.message);
      }
    });

    socket.on('new candidate', (candidate, id) => {
      // Logging
      logger.info(`Socket ${socket.id} has got a new candidate for ${id}`);

      try {
        let room = Object.keys(socket.rooms)[1];
        if(room != undefined) {
          // Room joined
          io.sockets[id].emit('new candidate', candidate, socket.id);
        }
        else {
          // Socket did not join any room
          throw new CommunicationException('You must join a room before sending datas')
        }
      } catch (e) {
        logger.info(e.message);
        socket.emit('communication error', e.message);
      }
    })

    socket.on('leave', () => {
      let room = Object.keys(socket.rooms)[1];
      if(room != undefined) {
        socket.leave(room, () => {
          // Logging
          logger.info(`Socket ${socket.id} left the room ${room}`);

          // Set room left
          roomJoined = undefined;

          // Remove from list
          delete rooms[room].users[socket.id];
          rooms[room].num_users--;

          // Disconnect socket
          socket.disconnect(true);

          // Delete room
          if(rooms[room].num_users === 0) {
            // Start job
            rooms[room].job.start();
          }

          // Room left
          socket.to(room).emit('client left', socket.id);
        });
      }
    });

    socket.on('disconnect', () => {
      let room = roomJoined;
      if(room != undefined) {
        // Logging
        logger.info(`Socket ${socket.id} left the room ${room}`);

        // Set room left
        roomJoined = undefined;

        // Remove from list
        delete rooms[room].users[socket.id];
        rooms[room].num_users--;

        // Delete room
        if(rooms[room].num_users === 0) {
          // Start job
          rooms[room].job.start();
        }

        // Room left
        socket.to(room).emit('client left', socket.id);
      }
    })
  });

  // Return the router
  return router;
}

/*** Export the router ***/
module.exports = handleSocket;
