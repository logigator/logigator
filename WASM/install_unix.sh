#!/bin/bash

if [ -d 'WASM/emscripten' ]; then
  exit 0
fi

git clone https://github.com/emscripten-core/emsdk.git WASM/emscripten || exit 1
cd WASM/emscripten || exit 1

./emsdk install latest || exit 1
./emsdk activate latest || exit 1

source ./emsdk_env.sh || exit 1
