/*** Node modules ***/
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const bodyParser = require('body-parser');
const httpStatusCodes = require('http-status-codes');
const rateLimit = require("express-rate-limit");
const pem = require('pem');
const io = require('socket.io')();
const which = require('which');

/*** Custom modules ***/
const logger = require('./lib/logger.js');
const utils = require('./lib/utils.js');
const config = require('./lib/config.js');

/*** Custom functions ***/
/**
 * @function addRoute
 *
 * Function used to add a route to the express app.
 * The file which contains the route has the same name as the route and receives a socket.io namespace as parameter
 *
 * @param {String} route
 *    A valid route path (Ex. "/api")
 *
**/
function addRoute(route) {
  const router = require('./routes'+route+'.js')(io.of(route));
  app.use(route, router);
}

/*** App settings ***/
const httpPort = config.httpPort;
const httpsPort = config.httpsPort;
const environment = config.environment;
const staticFolder = config.staticFolder;
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: utils.createHttpResponse(429)
});

/*** Options ***/
const opt_http = config.useHttp;
const opt_https = config.useHttps;
const opt_static = config.useStatic;

if(environment === 'development') {
  let pathOpenSSL;
  if(config.pathOpenSSL !== undefined) {
    // Get path from configuration
    pathOpenSSL = config.pathOpenSSL;
  }
  else {
    // Find OpenSSL in system PATH
    pathOpenSSL = which.sync('openssl', {nothrow: true});
    if(pathOpenSSL === null) {
      // OpenSSL not found in system PATH, so try "default" paths
      if(os.platform() === 'win32') {
        // In windows
        pathOpenSSL = '/Program Files/OpenSSL-Win64/bin/openssl';
      }
      else if(os.platform() === 'darwin') {
        // In Unix
        pathOpenSSL = '/usr/local/bin/openssl';
      }
      else {
        // In Linux
        pathOpenSSL = '/usr/bin/openssl';
      }
    }
  }

  // Set pem configuration
  pem.config({
    pathOpenSSL: pathOpenSSL
  });
}

/*** Create app ***/
const app = express();

/*** Starting servers ***/
if(opt_http) {
  // Starting http server
  const httpServer = http.createServer(app);
  io.attach(httpServer);

  // It listens on port httpPort
  httpServer.listen(httpPort, () => {
  	logger.info(`HTTP Server running on port ${httpPort}`);
  });
}

if(opt_https) {
  if(environment === 'development') {
    // Generate a self signed certificate which lasts 1 day
    pem.createCertificate({ days: 1, selfSigned: true }, function (err, keys) {
      if (err) {
        throw err;
      }

      // Set credentials for starting the https server
      const credentials = {
      	key: keys.serviceKey,
      	cert: keys.certificate
      };

      // Starting https server
      const httpsServer = https.createServer(credentials, app);
      io.attach(httpsServer);

      // It listens on port httpsServer
      httpsServer.listen(httpsPort, () => {
      	logger.info(`HTTPS Server running on port ${httpsPort}`);
      });
    });
  }
  else {
    // Certificate
    const privateKey = fs.readFileSync(config.sslKeyPath, 'utf8');
    const certificate = fs.readFileSync(config.sslCertPath, 'utf8');

    // Set credentials for starting the https server
    const credentials = {
    	key: privateKey,
    	cert: certificate
    };

    // Starting https server
    const httpsServer = https.createServer(credentials, app);
    io.attach(httpsServer);

    // It listens on port httpsServer
    httpsServer.listen(httpsPort, () => {
    	logger.info(`HTTPS Server running on port ${httpsPort}`);
    });
  }
}

/*** Define middlewares ***/
app.use(limiter); // Apply the limit to all requests
app.use(bodyParser.urlencoded({ extended: false })); // Parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // Parse application/json
app.use(helmet());

if(environment === 'development') {
  // Middlewares used in development
  app.use(morgan('tiny', { stream: logger.stream }));
}
else if(environment === 'production') {
  // Middlewares used in production
  app.use(morgan('combined', { stream: logger.stream }));
  app.use(compression());
}

/*** Define custom routes ***/
addRoute('/room');

/*** Define static folder ***/
if(opt_static) {
  app.use(express.static(staticFolder));
}

/*** Default 404 handler ***/
app.get('*', (req, res, next) => {
  res
    .status(404)
    .end();
})
