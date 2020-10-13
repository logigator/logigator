import {InjectionToken, Injector, Type} from '@angular/core';

let _injector: Injector;

export function setStaticDIInjector(injector: Injector) {
	_injector = injector;
}

export function getStaticDI<T>(token: Type<T> | InjectionToken<T>): T {
	return _injector.get(token);
}
