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

This will start a server on http://localhost:8000 and on https://localhost:44300. To modify that values you can simply create a .env file containing all required settings



## Environment variables

These are the environment variables that can be defined in the .env file

* **PORT**: the port on which the HTTP server will listen (_default: **8000**_)
* **PORT_HTTPS**: the port on which the HTTPS server will listen (_default: **44300**_)
* **NODE_ENV**: the environment {development, production} (_default: **development**_)
* **STATIC**: the path of the folder which contains static files. The path is relative with respect to the project folder (_default: **client/public**_)
* **PATH_OPENSSL**: the path of the folder to the openssl executable (default: depends on the actual OS)
* **TIMEOUT_SEC**: the amount of seconds after which an inactive room is deleted (_default: **1800**_)

