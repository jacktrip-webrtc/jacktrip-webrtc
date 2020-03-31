/*** Node modules ***/
const dotenv = require('dotenv');

/*** Loading App Settings ***/
dotenv.config();
config = {
  httpPort: process.env.PORT || 8000,
  httpsPort: process.env.PORT_HTTPS || 44300,
  environment: process.env.NODE_ENV || 'development',
  staticFolder: process.env.STATIC || 'client/public',
  pathOpenSSL: process.env.PATH_OPENSSL || undefined,
  timeoutSec: process.env.TIMEOUT_SEC || 30*60
};

/*** Export the configuration object ***/
module.exports = config;
