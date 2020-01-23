# LogigatorEditor
[![Build Status](https://travis-ci.org/logigator/logigator-editor.svg?branch=master)](https://travis-ci.org/logigator/logigator-editor)
[![Build Status](https://travis-ci.org/logigator/logigator-editor.svg?branch=development)](https://travis-ci.org/logigator/logigator-editor)

## Getting Started 
### Prerequisites
You need to have node and npm installed to use this module. We recommend installing it via [nvm](https://github.com/nvm-sh/nvm):

#### Debian
```shell
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.1/install.sh | bash
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm
nvm install lts/*
```

### Installation
Download the contents of the repository, open the command line in that directory and install all required dependencies using ```npm install```.
#### Linux / Unix
```shell
git clone 'https://github.com/logigator/logigator-editor.git' && cd ./logigator-editor && npm install
```
To start the app in your browser run:
```
npm start
```
The app will be served at localhost:8202 <br>
You can also run the app on your local PC using Electron
```
npm run start:electron
```
If you want to use the Backend, which is required for login and saving projects, 
you must also setup [Logigator-Backend](https://github.com/logigator/logigator-backend). 
Instructions for doing so can be found in the [logigator-development-distribution](https://github.com/logigator/logigator-development-distribution).

##### Using the Simulation-Code
If the simulation-mode is not working, is this most likely due to a missing Webassembly module. 
To fix this issue you must build the [Simulation Code](https://github.com/logigator/logigator-simulation) by your self. 
Instructions for doing so can be found in the simulation repo. 
After you built the simulation-code, just copy the contents of `logigator-simulation/webAssembly/dist/` to `src/assets/wasm`.

### Building the App
Browser: `npm run build`<br>
Electron: `npm run build:electron:*platform*`
