import {Chunk} from './chunk';
import {ProjectModel} from './project-model';
import {Component} from './component';
import {ComponentProviderService} from '../services/component-provider/component-provider.service';

export class ProjectState {

	private _model: ProjectModel;
	private _highestTakenId = 0;
	private _chunks: Chunk[][];

	private CHUNK_SIZE = 16;

	public constructor(private compProvService: ComponentProviderService, model: ProjectModel, highestId?: number) {
		this._model = model;
		if (highestId) {
			this._highestTakenId = highestId;
		} else {
			for (let i = 0; model.board.components.find(c => c.id === i); i++) {
				this._highestTakenId = i;
			}
		}
		this._chunks = [];
		this.loadAllIntoChunks();
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
		const chunkX = Math.floor(component.posX / this.CHUNK_SIZE);
		const chunkY = Math.floor(component.posY / this.CHUNK_SIZE);
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
		const newComp: Component = {
			id: this.getNextId(),
			typeId: comp.typeId,
			name: comp.name,
			posX: comp.posX,
			posY: comp.posY,
			inputs: [],	// TODO fill in
			outputs: []
		};
		this._model.board.components.push(newComp);
		this.loadIntoChunks(newComp);
	}

	public removeComponent(componentId: number): void {
		// TODO implement search by chunk
		// const comp = this.getComponentById(elemId);
		// for (const input of comp.inputs) {
		// 	const prevComp = this.getComponentById(input);
		// 	prevComp.outputs = prevComp.outputs.filter(value => value !== input);
		// }
		// for (const output of comp.outputs) {
		// 	const nextComp = this.getComponentById(output);
		// 	nextComp.inputs = nextComp.inputs.filter(value => value !== output);
		// }
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
		return new ProjectState(this.compProvService, outModel, this._highestTakenId);
	}

	public componentsInChunk(x: number, y: number): Component[] {
		return this._chunks[x][y].components;
	}

	get model(): ProjectModel {
		return this._model;
	}
}
