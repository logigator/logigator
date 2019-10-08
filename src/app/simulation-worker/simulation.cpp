#include <stdio.h>
#include <emscripten/bind.h>

int test() {
	std::printf("Hello");
	return 254;
}

EMSCRIPTEN_BINDINGS(my_module) {
	emscripten::function("test", &test);
}
