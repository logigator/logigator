import {Chunk} from './chunk';
import {ProjectModel} from './project-model';
import {Component} from './component';
import {ComponentProviderService} from '../services/component-provider/component-provider.service';

export class ProjectState {

	private model: ProjectModel;
	private highestTakenId = 0;
	private chunks: Chunk[]; // 2D array?

	private CHUNK_SIZE = 16;

	public constructor(private compProvSerice: ComponentProviderService, model: ProjectModel) {
		this.model = model;
		this.loadIntoChunks();
	}

	public getNextId(): number {
		return ++this.highestTakenId;
	}

	public loadIntoChunks(): void {
		for (const component of this.model.board.components) {
			console.log(component);
			// TODO
		}
	}

	public addComponent(compTypeId: number, posX: number, posY: number): void {
		const newComp: Component = {
			id: this.getNextId(),
			typeId: compTypeId,
			name: this.compProvSerice.getComponentNameById(compTypeId),
			posX,
			posY,
			inputs: [],	// TODO fill in
			outputs: []
		};
		this.model.board.components.push(newComp);
	}

	public removeComponent(compId: number): void {
		// TODO remove and remove von inputs/outputs
	}
}
