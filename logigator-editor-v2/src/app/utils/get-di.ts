import { InjectionToken, Injector, Type } from '@angular/core';

let _injector: Injector;

export function setStaticDIInjector(injector: Injector) {
	_injector = injector;
}

export function getStaticDI<T>(token: Type<T> | InjectionToken<T>): T {
	if (!_injector) throw new Error('Static DI Injector not set yet!');
	return _injector.get(token);
}
