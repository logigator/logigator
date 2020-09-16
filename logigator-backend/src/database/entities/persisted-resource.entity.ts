import {AfterInsert, AfterUpdate, BeforeRemove, Column, PrimaryGeneratedColumn} from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import mime from 'mime';
import md5 from 'md5';

export abstract class PersistedResource {

	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	mimeType: string;

	@Column({type: 'char', length: 32})
	md5: string

	private _fileContent: Buffer;

	@AfterInsert()
	private createFile() {
		fs.writeFileSync(this.filePath, this._fileContent);
	}

	@AfterUpdate()
	private updateFile() {
		fs.writeFileSync(this.filePath, this._fileContent);
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
			this.md5 = md5(this._fileContent);
			return;
		}
		this._fileContent = Buffer.from(content);
		this.md5 = md5(this._fileContent);
	}

	public get filePath(): string {
		return path.join(__dirname, '..', '..', '..', 'resources', 'public', 'persisted', this.id + '.' + mime.getExtension(this.mimeType));
	}

	public get publicUrl(): string {
		return `/persisted/${this.id}.${mime.getExtension(this.mimeType)}`;
	}
}
