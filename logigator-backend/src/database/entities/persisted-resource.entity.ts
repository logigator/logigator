import {AfterInsert, BeforeRemove, BeforeUpdate, Column, Generated, PrimaryGeneratedColumn} from 'typeorm';
import {promises as fs} from 'fs';
import * as path from 'path';
import mime from 'mime';
import md5 from 'md5';
import { v4 as uuid } from 'uuid';
import {Exclude, Expose} from 'class-transformer';

@Exclude({toPlainOnly: true})
export abstract class PersistedResource {

	@PrimaryGeneratedColumn('uuid')
	readonly id: string;

	@Column({unique: true, name: 'filename'})
	@Generated('uuid')
	private _filename: string;

	@Expose()
	@Column()
	mimeType: string;

	@Column({type: 'char', length: 32, name: 'hash', default: '00000000000000000000000000000000'})
	private _hash: string;

	private _fileContent: Buffer;

	private _dirty = false;

	protected _cacheable = false;

	protected _path = 'persisted';

	public get filename(): string {
		return this._filename;
	}

	@Expose()
	public get hash(): string {
		return this._hash;
	}

	public get cacheable(): boolean {
		return this._cacheable;
	}

	@AfterInsert()
	private async createFile() {
		await fs.writeFile(this.filePath, this._fileContent ?? Buffer.alloc(0));
		this._dirty = false;
	}

	@BeforeUpdate()
	private async updateFile(): Promise<void> {
		if (this._dirty) {
			if (this._cacheable) {
				await this.deleteFile();
				this._filename = uuid();
			}
			await fs.writeFile(this.filePath, this._fileContent);
			this._dirty = false;
		}
	}

	@BeforeRemove()
	private async deleteFile() {
		try {
			await fs.unlink(this.filePath);
		} catch (e) {
			if (e.code !== 'ENOENT')
				throw e;
		}
	}

	public async getFileContent(): Promise<Buffer> {
		if (!this._fileContent)
			this._fileContent = await fs.readFile(this.filePath);
		return this._fileContent;
	}

	public setFileContent(content: Buffer | string) {
		if (content instanceof Buffer) {
			this._fileContent = content;
		} else {
			this._fileContent = Buffer.from(content);
		}
		const hash = md5(this._fileContent);
		this._dirty = this._hash !== hash;
		this._hash = hash;
	}

	public get filePath(): string {
		return path.join(__dirname, '..', '..', '..', 'resources', 'public', this._path, this._filename + '.' + mime.getExtension(this.mimeType));
	}

	@Expose()
	public get publicUrl(): string {
		return `/${this._path}/${this._filename}.${mime.getExtension(this.mimeType)}`;
	}
}
