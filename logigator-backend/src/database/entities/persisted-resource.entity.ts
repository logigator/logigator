import {AfterInsert, BeforeRemove, BeforeUpdate, Column, Generated, PrimaryGeneratedColumn} from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import mime from 'mime';
import md5 from 'md5';
import { v4 as uuid } from 'uuid';

export abstract class PersistedResource {

	@PrimaryGeneratedColumn('uuid')
	readonly id: string;

	@Column({unique: true, name: 'filename'})
	@Generated('uuid')
	private _filename: string;

	@Column()
	mimeType: string;

	@Column({type: 'char', length: 32, name: 'md5'})
	private _md5: string;

	private _fileContent: Buffer;
	private _dirty = false;
	protected _cacheable = false;
	protected _path = 'persisted';

	public get filename() {
		return this._filename;
	}

	public get md5() {
		return this._md5;
	}

	public get cacheable() {
		return this._cacheable;
	}

	@AfterInsert()
	private createFile() {
		fs.writeFileSync(this.filePath, this._fileContent);
	}

	@BeforeUpdate()
	private async updateFile() {
		if (this._dirty) {
			if (this._cacheable) {
				return new Promise<void>((resolve, reject) => {
					fs.unlink(this.filePath, err => {
						if (err) {
							reject(err);
							return;
						}
						this._filename = uuid();
						fs.writeFile(this.filePath, this._fileContent, err => {
							if (err) {
								reject(err);
								return;
							}
							this._dirty = false;
							resolve();
						});
					});
				});
			} else {
				return new Promise<void>((resolve, reject) => {
					fs.writeFile(this.filePath, this._fileContent, err => {
						if (err) {
							reject(err);
							return;
						}
						this._dirty = false;
						resolve();
					});
				});
			}
		}
	}

	@BeforeRemove()
	private deleteFile() {
		fs.unlinkSync(this.filePath);
	}

	public getFileContent(): Promise<Buffer> {
		if (this._fileContent) {
			return Promise.resolve(this._fileContent);
		}
		return new Promise<Buffer>((resolve, reject) => {
			fs.readFile(this.filePath, (err, data) => {
				if (err) {
					reject(err);
					return;
				}
				this._fileContent = data;
				resolve(data);
			});
		});
	}

	public setFileContent(content: Buffer | string) {
		if (content instanceof Buffer) {
			this._fileContent = content;
		} else {
			this._fileContent = Buffer.from(content);
		}
		const hash = md5(this._fileContent);
		this._dirty = this._md5 !== hash;
		this._md5 = hash;
	}

	public get filePath(): string {
		return path.join(__dirname, '..', '..', '..', 'resources', 'public', this._path, this._filename + '.' + mime.getExtension(this.mimeType));
	}

	public get publicUrl(): string {
		return `/${this._path}/${this._filename}.${mime.getExtension(this.mimeType)}`;
	}
}
