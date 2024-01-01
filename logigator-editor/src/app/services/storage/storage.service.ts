// @ts-strict-ignore
import { InjectionToken } from '@angular/core';

export const StorageService = new InjectionToken<StorageServiceModel>(
	'StorageService Injection Token'
);

export abstract class StorageServiceModel {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public abstract get(key: string): any;

	public abstract set(key: string, data: unknown);

	public abstract remove(key: string);

	public abstract has(key: string): boolean;
}
