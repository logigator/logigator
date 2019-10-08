#include <stdio.h>
#include <emscripten/bind.h>

int test() {
	return 254;
}

EMSCRIPTEN_BINDINGS(my_module) {
	emscripten::function("test", &test);
}
