import {Chunk} from './chunk';
import {ProjectModel} from './project-model';
import {Component} from './component';
import {ComponentProviderService} from '../services/component-provider/component-provider.service';

export class ProjectState {

	private _model: ProjectModel;
	private highestTakenId = 0;
	private chunks: Chunk[]; // 2D array?

	private CHUNK_SIZE = 16;

	public constructor(private compProvService: ComponentProviderService, model: ProjectModel) {
		this._model = model;
		this.loadIntoChunks();
		for (let i = 0; model.board.components.find(c => c.id === i); i++) {
			this.highestTakenId = i;
		}
	}

	public getNextId(): number {
		return ++this.highestTakenId;
	}

	public loadIntoChunks(): void {
		for (const component of this._model.board.components) {
			// TODO
		}
	}

	public addComponent(compTypeId: number, posX: number, posY: number): void {
		const newComp: Component = {
			id: this.getNextId(),
			typeId: compTypeId,
			name: this.compProvService.getComponentNameById(compTypeId),
			posX,
			posY,
			inputs: [],	// TODO fill in
			outputs: []
		};
		this._model.board.components.push(newComp);
	}

	public removeComponent(elemId: number): void {
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
		this._model.board.components = this._model.board.components.filter(c => c.id !== elemId);
	}

	public moveComponent(elemId: number, newPosX: number, newPosY: number): void {
		const comp = this.getComponentById(elemId);
		comp.posX = newPosX;
		comp.posY = newPosY;
	}



	public getComponentById(compId: number): Component {
		return this._model.board.components.find(c => c.id === compId);
	}

	public copy(): ProjectState {
		// TODO copy chunks
		// TODO make cleaner/faster
		const outModel: ProjectModel = {
			id: this._model.id,
			board: {
				components: []
			}
		};
		for (const comp of this._model.board.components)
			outModel.board.components.push(Object.assign({}, comp));
		return new ProjectState(this.compProvService, outModel);
	}

	get model(): ProjectModel {
		return this._model;
	}
}
