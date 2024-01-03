import { InjectionToken } from '@angular/core';

export const StorageService = new InjectionToken<StorageServiceModel>(
	'StorageService Injection Token'
);

export abstract class StorageServiceModel {
	public abstract get<T = unknown>(key: string): T | null;

	public abstract set(key: string, data: unknown): void;

	public abstract remove(key: string): void;

	public abstract has(key: string): boolean;
}
