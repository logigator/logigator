# logigator
**Build, simulate and manage complex logic circuits for free - [Logigator](https://logigator.com)**


[![CI logigator-backend](https://github.com/logigator/logigator/workflows/CI%20logigator-backend/badge.svg)](https://github.com/logigator/logigator/actions?query=workflow%3A%22CI+logigator-backend%22)
[![CI logigator-editor](https://github.com/logigator/logigator/workflows/CI%20logigator-editor/badge.svg)](https://github.com/logigator/logigator/actions?query=workflow%3A%22CI+logigator-editor%22)

## Prerequisites
* Docker [(download)](https://docs.docker.com/engine/install/)

## Installation
Clone the repository:
```shell
git clone 'https://github.com/logigator/logigator.git'
```

### Docker
There is a [docker-compose.yaml](docker-compose.yaml) file provided in the repository.
It defines containers for the following services:
* Apache HTTP Proxy
* MySQL Database
* Redis
* Rebrow (Redis UI)

and the development servers for Logigator itself.

Simply run
```shell
docker compose up -d
```
and the services should come online.

## Configuration
All configuration files can be found under ``logigator-backend/config``.
Configure them appropriately, then rename them omitting the ``.example``.
### hosts file
Add the following entry to your hosts file (Windows: ``C:\Windows\System32\drivers\etc\hosts``, Linux: `/etc/hosts`):
````
127.0.0.1 logigator.test
````

## License
This Project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
