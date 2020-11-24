# logigator
### Prerequisites
* NodeJS v14 or newer [(download)](https://nodejs.org/en/download/)
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
npm start
```
##### Docker
There is a [docker-compose](docker-compose.development.yaml) file provided in the repository.
It defines containers for the following services:
* Apache HTTP Proxy
* MySQL Database
* Redis
* Rebrow (Redis UI)

and Logigator itself.

### Configuration
All configuration files can be found under ``logigator-backend/config``.
Configure them appropriately, then rename them omitting the ``.example``.
##### hosts file
Add the following entry to your hosts file (Windows: ``C:\Windows\System32\drivers\etc\hosts``, Linux: `/etc/hosts`):
````
127.0.0.1 dev.logigator.com
````
