import * as path from 'path';
import * as fs from 'fs';
import {app, remote, ipcMain} from 'electron';

export class Storage {

	private static _instance: Storage;

	private static readonly STORAGE_PATH = Storage.getStoragePath();

	constructor() {
		this.readStorage();
	}

	public static getInstance(): Storage {
		if (Storage._instance)
			return Storage._instance;

		Storage._instance = new Storage();
		return Storage._instance;
	}

	public setupCommunicationWithRenderer() {
		ipcMain.on('storageKeyChanged', ( (event, args: {key: string, data: any}) => {
			this.set(args.key, args.data);
		}));
		ipcMain.on('storageKeyRemoved', ( (event, args: {key: string}) => {
			this.remove(args.key);
		}));
	}

	private static getStoragePath(): string {
		const userDataPath = (app || remote.app).getPath('userData');
		return path.join(userDataPath, 'electron-savings.json');
	}

	public set(key: string, data: any) {
		global['storageData'][key] = data;
		this.saveStorage();
	}

	public get(key: string): any {
		return global['storageData'][key];
	}

	public remove(key: string) {
		if (this.has(key)) {
			delete global['storageData'][key];
			this.saveStorage();
		}
	}

	public has(key: string): boolean {
		return global['storageData'].hasOwnProperty(key);
	}

	private readStorage() {
		try {
			global['storageData'] = JSON.parse(fs.readFileSync(Storage.STORAGE_PATH).toString());
		} catch (e) {
			global['storageData'] = {};
		}
	}

	private saveStorage() {
		fs.writeFileSync(Storage.STORAGE_PATH, JSON.stringify(global['storageData']));
	}
}
