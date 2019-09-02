import {Chunk} from './chunk';
import {ProjectModel} from './project-model';
import {Component} from './component';

export class ProjectState {

	private _model: ProjectModel;
	private _highestTakenId = 0;
	private _chunks: Chunk[][];

	private CHUNK_SIZE = 50;

	public constructor(model: ProjectModel, highestId?: number) {
		this._model = model;
		if (highestId) {
			this._highestTakenId = highestId;
		} else {
			this._highestTakenId = this.findHighestTakenId();
		}
		this._chunks = [];
		this.loadAllIntoChunks();
	}

	private findHighestTakenId(): number {
		let out = 0;
		for (const comp of this.model.board.components) {
			if (comp.id > out)
				out = comp.id;
		}
		return out;
	}

	public getNextId(): number {
		return ++this._highestTakenId;
	}

	public loadAllIntoChunks(): void {
		for (const component of this._model.board.components) {
			this.loadIntoChunks(component);
		}
	}

	public loadIntoChunks(component: Component): void {
		const chunkX = this.gridPosToChunk(component.posX);
		const chunkY = this.gridPosToChunk(component.posY);
		this.createChunk(chunkX, chunkY);
		this._chunks[chunkX][chunkY].components.push(component);
	}

	public removeFromChunks(componentId: number): void {
		// TODO break when found and checks surrounding _chunks
		for (const chunkArr of this._chunks) {
			for (const chunk of chunkArr) {
				chunk.components = chunk.components.filter(comp => comp.id !== componentId);
			}
		}
	}

	private createChunk(x: number, y: number): void {
		if (this._chunks[x] && this._chunks[x][y])
			return;
		for (let i = 0; i <= x; i++)
			if (!this._chunks[i])
				this._chunks[i] = [];
		for (let i = 0; i <= y; i++)
			if (!this._chunks[x][y] && this._chunks[x][y] !== undefined)
				this._chunks[x].push(undefined);
		this._chunks[x][y] = {
			components: []
		};
	}

	public addComponent(comp: Component): void {
		comp.id = this.getNextId();
		this._model.board.components.push(comp);
		this.loadIntoChunks(comp);
	}

	public removeComponent(componentId: number): void {
		// TODO implement search by chunk
		this._model.board.components = this._model.board.components.filter(c => c.id !== componentId);
		this.removeFromChunks(componentId);
	}

	public moveComponent(comp: Component, newPosX: number, newPosY: number): void {
		comp.posX = newPosX;
		comp.posY = newPosY;
	}

	public getComponentById(compId: number): Component {
		return this._model.board.components.find(c => c.id === compId);
	}

	public copy(): ProjectState {
		// TODO copy _chunks
		// TODO make cleaner/faster
		const outModel: ProjectModel = {
			id: this._model.id,
			board: {
				components: []
			}
		};
		for (const comp of this._model.board.components)
			outModel.board.components.push(Object.assign({}, comp));
		return new ProjectState(outModel, this._highestTakenId);
	}

	public componentsInChunk(x: number, y: number): Component[] {
		return this._chunks[x][y].components;
	}


	public onScreenChunks(startX: number, startY: number, endX: number, endY: number): {x: number, y: number}[] {
		const out: {x: number, y: number}[] = [];
		const startChunkX = this.gridPosToChunk(startX);
		const startChunkY = this.gridPosToChunk(startY);
		const endChunkX = this.gridPosToChunk(endX);
		const endChunkY = this.gridPosToChunk(endY);
		for (let x = startChunkX; x <= endChunkX; x++)
			for (let y = startChunkY; y <= endChunkY; y++)
				if ((x < endChunkX || endX % this.CHUNK_SIZE !== 0) && (y < endChunkY || endY % this.CHUNK_SIZE !== 0))
					out.push({x, y});
		return out;
	}

	private gridPosToChunk(pos: number): number {
		return Math.floor(pos / this.CHUNK_SIZE);
	}

	get model(): ProjectModel {
		return this._model;
	}

	get chunks(): Chunk[][] {
		return this._chunks;
	}
}
