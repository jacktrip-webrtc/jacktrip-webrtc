# Configuration

## Use

Once the repository has been downloaded, execute the following commands in the main folder:

```bash
npm install
cd client
npm install
cd ..
```

By doing that all dependencies and modules will be installed



To start the server use the following command:

```bash
npm start
```

This will start a server on http://localhost:8000 and on https://localhost:44300. To modify these values you can simply create a .env file containing all required settings. For example:

```
# Setting HTTP Port
PORT=4464
# Defining path to openSSL
PATH_OPENSSL=/usr/local/opt/openssl
```


To see a richer example of the .env file take a look at the [.env.example](../.env.example) file in the root folder of the project




## Environment variables

These are the environment variables that can be defined in the .env file

* **USE_HTTP**: to specify whether to start a HTTP server or not. (_default: **true**_)
  * **false**: do **not** start the HTTP server
  * **true**: do start the HTTP server
* **PORT**: the port on which the HTTP server will listen (_default: **8000**_)
* **USE_HTTPS**: to specify whether to start a HTTPS server or not. (_default: **true**_)
  * **false**: do **not** start the HTTPS server
  * **true**: do start the HTTPS server
* **PORT_HTTPS**: the port on which the HTTPS server will listen (_default: **44300**_)
* **NODE_ENV**: the environment {development, production} (_default: **development**_)
* **SSL_KEY_PATH**: to specify the path to the ssl key to use.  (_default **'ssl/key.pem'**_)
  **NOTE**: it is only used if the **NODE_ENV** is set to _production_ and **USE_HTTPS** is set to _true_
* **SSL_CERT_PATH**: to specify the path to the ssl certificate to use.  (_default **'ssl/cert.pem'**_)
  **NOTE**: it is only used if the **NODE_ENV** is set to _production_ and **USE_HTTPS** is set to _true_
* **USE_STATIC**: to specify whether to serve static files or not. (_default: **true**_)
  * **false**: do **not** server static files
  * **true**: do serve static files
* **STATIC_PATH**: the path of the folder which contains static files. The path is relative with respect to the project folder (_default: **client/public**_)
* **OPENSSL_PATH**: the path of the openssl executable (default: depends on the actual OS)
* **TIMEOUT_SEC**: the amount of seconds after which an inactive room is deleted (_default: **1800**_)
* **TURN_SERVER_URL**: the url of the TURN server that needs to be used
* **TURN_SERVER_USERNAME**: the username in order to access the turn server
* **TURN_SERVER_PASSWORD**: the password in order to access the turn server
