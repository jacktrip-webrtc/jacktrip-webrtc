/*** Node modules ***/
const dotenv = require('dotenv');

/*** Loading App Settings ***/
dotenv.config();
config = {
  httpPort: process.env.PORT || 8000,
  httpsPort: process.env.PORT_HTTPS || 44300,
  environment: process.env.NODE_ENV || 'development',
  staticFolder: process.env.STATIC_PATH || 'client/public',
  pathOpenSSL: process.env.OPENSSL_PATH || undefined,
  timeoutSec: process.env.TIMEOUT_SEC || 30*60,
  useHttp: process.env.USE_HTTP ? (process.env.USE_HTTP.toLowerCase() === 'true') : true,
  useHttps: process.env.USE_HTTPS ? (process.env.USE_HTTPS.toLowerCase() === 'true') : true,
  useStatic: process.env.USE_STATIC ? (process.env.USE_STATIC.toLowerCase() === 'true') : true,
  sslKeyPath: process.env.SSL_KEY_PATH || 'ssl/key.pem',
  sslCertPath: process.env.SSL_CERT_PATH || 'ssl/cert.pem',
  turnServerURL: process.env.TURN_SERVER_URL || '',
  turnServerUsername: process.env.TURN_SERVER_USERNAME || '',
  turnServerPassword: process.env.TURN_SERVER_PASSWORD || ''
};

/*** Export the configuration object ***/
module.exports = config;
