import * as path from 'path';
import * as fs from 'fs';
import {app, remote} from 'electron';

export class Storage {

	private static readonly STORAGE_PATH = Storage.getStoragePath();

	private static _storageData;

	private static getStoragePath(): string {
		const userDataPath = (app || remote.app).getPath('userData');
		return path.join(userDataPath, 'electron-savings.json');
	}

	static set(key: string, data: any) {
		if (!Storage._storageData) Storage._storageData = {};
		Storage._storageData[key] = data;
		Storage.saveStorage();
	}

	static get(key: string) {
		if (!Storage._storageData) {
			Storage.readStorage();
		}
		return Storage._storageData[key];
	}

	static remove(key: string) {
		if (Storage.has(key)) {
			delete Storage._storageData[key];
			Storage.saveStorage();
		}
	}

	static has(key: string) {
		if (!Storage._storageData) {
			Storage.readStorage();
		}
		return Storage._storageData.hasOwnProperty(key);
	}

	private static readStorage() {
		try {
			Storage._storageData = JSON.parse(fs.readFileSync(Storage.STORAGE_PATH).toString());
		} catch (e) {
			Storage._storageData = {};
		}
	}

	private static saveStorage() {
		fs.writeFileSync(Storage.STORAGE_PATH, JSON.stringify(Storage._storageData));
	}
}
