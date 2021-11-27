import * as path from 'path';
import * as fs from 'fs';
import {app} from 'electron';

export class Storage {

	private static _instance: Storage;

	private static readonly STORAGE_PATH = Storage.getStoragePath();

	private storageData: object;

	constructor() {
		this.readStorage();
	}

	private static getStoragePath(): string {
		const userDataPath = app.getPath('userData');
		return path.join(userDataPath, 'logigator-storage.json');
	}

	public static getInstance(): Storage {
		if (Storage._instance)
			return Storage._instance;

		Storage._instance = new Storage();
		return Storage._instance;
	}

	public set(key: string, data: any) {
		this.storageData[key] = data;
		this.saveStorage();
	}

	public get(key: string): any {
		return this.storageData[key];
	}

	public remove(key: string) {
		if (this.has(key)) {
			delete this.storageData[key];
			this.saveStorage();
		}
	}

	public has(key: string): boolean {
		return this.storageData.hasOwnProperty(key);
	}

	private readStorage() {
		try {
			this.storageData = JSON.parse(fs.readFileSync(Storage.STORAGE_PATH).toString());
		} catch (e) {
			this.storageData = {};
		}
	}

	private saveStorage() {
		fs.writeFileSync(Storage.STORAGE_PATH, JSON.stringify(this.storageData));
	}
}
