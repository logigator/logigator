import { InjectionToken } from '@angular/core';

export const StorageService = new InjectionToken<StorageServiceModel>(
	'StorageService Injection Token'
);

export abstract class StorageServiceModel {
	public abstract get(key: string): any;

	public abstract set(key: string, data: any);

	public abstract remove(key: string);

	public abstract has(key: string): boolean;
}
