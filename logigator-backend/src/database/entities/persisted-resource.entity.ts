import {AfterInsert, BeforeRemove, BeforeUpdate, Column, Generated, PrimaryGeneratedColumn} from 'typeorm';
import {promises as fs} from 'fs';
import * as path from 'path';
import mime from 'mime';
import md5 from 'md5';
import { v4 as uuid } from 'uuid';
import {Exclude, Expose} from 'class-transformer';

export abstract class PersistedResource {

	@Exclude({toPlainOnly: true})
	@PrimaryGeneratedColumn('uuid')
	readonly id: string;

	@Exclude()
	@Column({unique: true, name: 'filename'})
	@Generated('uuid')
	private _filename: string;

	@Column()
	mimeType: string;

	@Exclude()
	@Column({type: 'char', length: 32, name: 'md5', default: '00000000000000000000000000000000'})
	private _md5: string;

	@Exclude()
	private _fileContent: Buffer;

	@Exclude()
	private _dirty = false;

	@Exclude()
	protected _cacheable = false;

	@Exclude()
	protected _path = 'persisted';

	public get filename(): string {
		return this._filename;
	}

	@Expose()
	public get md5(): string {
		return this._md5;
	}

	public get cacheable(): boolean {
		return this._cacheable;
	}

	@AfterInsert()
	private async createFile() {
		await fs.writeFile(this.filePath, this._fileContent);
		this._dirty = false;
	}

	@BeforeUpdate()
	private async updateFile(): Promise<void> {
		if (this._dirty) {
			if (this._cacheable) {
				await fs.unlink(this.filePath);
				this._filename = uuid();
			}
			await fs.writeFile(this.filePath, this._fileContent);
			this._dirty = false;
		}
	}

	@BeforeRemove()
	private deleteFile() {
		return fs.unlink(this.filePath);
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
		this._dirty = this._md5 !== hash;
		this._md5 = hash;
	}

	public get filePath(): string {
		return path.join(__dirname, '..', '..', '..', 'resources', 'public', this._path, this._filename + '.' + mime.getExtension(this.mimeType));
	}

	@Expose()
	public get publicUrl(): string {
		return `/${this._path}/${this._filename}.${mime.getExtension(this.mimeType)}`;
	}
}
