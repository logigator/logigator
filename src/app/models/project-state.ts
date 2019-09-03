import {Chunk} from './chunk';
import {ProjectModel} from './project-model';
import {Component} from './component';
import {environment} from '../../environments/environment';

export class ProjectState {

	private _model: ProjectModel;
	private _highestTakenId = 0;
	private _chunks: Chunk[][];

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

	private static gridPosToChunk(pos: number): number {
		return Math.floor(pos / environment.chunkSize);
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
		const chunkX = ProjectState.gridPosToChunk(component.pos.x);
		const chunkY = ProjectState.gridPosToChunk(component.pos.y);
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

	public addComponent(comp: Component): Component {
		comp.id = this.getNextId();
		this._model.board.components.push(comp);
		this.loadIntoChunks(comp);
		return comp;
	}

	public removeComponent(componentId: number): Component {
		// TODO implement search by chunk
		const outCompIndex = this._model.board.components.findIndex(c => c.id === componentId);
		const outComp = this._model.board.components[outCompIndex];
		this._model.board.components = this._model.board.components.slice(outCompIndex, 1);
		this.removeFromChunks(componentId);
		return outComp;
	}

	public moveComponent(comp: Component, dif: PIXI.Point): void {
		comp.pos.x += dif.x;
		comp.pos.y += dif.y;
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


	public onScreenChunks(startPos: PIXI.Point, endPos: PIXI.Point): {x: number, y: number}[] {
		const out: {x: number, y: number}[] = [];
		const startChunkX = ProjectState.gridPosToChunk(startPos.x);
		const startChunkY = ProjectState.gridPosToChunk(startPos.y);
		const endChunkX = ProjectState.gridPosToChunk(endPos.x);
		const endChunkY = ProjectState.gridPosToChunk(endPos.y);
		for (let x = startChunkX; x <= endChunkX; x++)
			for (let y = startChunkY; y <= endChunkY; y++)
				if ((x < endChunkX || endPos.x % environment.chunkSize !== 0) && (y < endChunkY || endPos.y % environment.chunkSize !== 0))
					out.push({x, y});
		return out;
	}

	get model(): ProjectModel {
		return this._model;
	}

	get chunks(): Chunk[][] {
		return this._chunks;
	}
}
