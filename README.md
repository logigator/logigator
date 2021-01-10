# logigator
**Build, simulate and manage complex logic circuits for free - [Logigator](https://logigator.com)**


[![CI logigator-backend](https://github.com/logigator/logigator/workflows/CI%20logigator-backend/badge.svg)](https://github.com/logigator/logigator/actions?query=workflow%3A%22CI+logigator-backend%22)
[![CI logigator-editor](https://github.com/logigator/logigator/workflows/CI%20logigator-editor/badge.svg)](https://github.com/logigator/logigator/actions?query=workflow%3A%22CI+logigator-editor%22)

### Prerequisites
* NodeJS v12 or newer [(download)](https://nodejs.org/en/download/)
* Docker [(download)](https://docs.docker.com/engine/install/)
* Docker-Compose [(download)](https://docs.docker.com/compose/install/)

### Installation
Clone the repository:
```shell
git clone 'https://github.com/logigator/logigator.git'
```
Install all dependencies:
```shell
cd logigator-backend && npm install
cd logiator-editor && npm install
```
To start the app in your browser run:
```shell
cd logigator-backend && npm start
cd logigator-editor && npm start
```
For this to work you need the following services running and correctly [configured](#configuration) in your machine:
* MySQL Database
* Redis
* NodeJs v12 or higher
* Some Service to proxy requests to the correct services. ex. Apache with a [config](docker/development/httpd.conf) like this. 

Running the logigator-editor Electron App:
```shell
cd logigator-editor && npm start:electron
```
To run the Electron App you just need NodeJs v12 or higher.

#### Docker
There is a [docker-compose](docker-compose.development.yaml) file provided in the repository.
It defines containers for the following services:
* Apache HTTP Proxy
* MySQL Database
* Redis
* Rebrow (Redis UI)

and Logigator itself.

The logigator-editor Electron App can only be run directly on your PC.

### Configuration
All configuration files can be found under ``logigator-backend/config``.
Configure them appropriately, then rename them omitting the ``.example``.
##### hosts file
Add the following entry to your hosts file (Windows: ``C:\Windows\System32\drivers\etc\hosts``, Linux: `/etc/hosts`):
````
127.0.0.1 dev.logigator.com
````

## License
This Project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
