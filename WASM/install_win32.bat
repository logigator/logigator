@ECHO OFF

IF EXIST WASM\emscripten\ (
	exit /b 0
)

git clone https://github.com/emscripten-core/emsdk.git WASM/emscripten || exit /b 1
cd WASM\emscripten || exit /b 1

@CALL emsdk install latest
@CALL emsdk activate latest

@CALL emsdk_env.bat --build=Release
