import {Project} from '../../src/app/models/project';
import * as PIXI from 'pixi.js';
import {getStaticDI} from '../../src/app/models/get-di';
import {SelectionService} from '../../src/app/services/selection/selection.service';
import {ElementProviderService} from '../../src/app/services/element-provider/element-provider.service';

export class BruteForceTester {

	private project: Project;
	private readonly TYPE_IDS = [1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 100, 101, 102, 200, 201, 202, 203, 204];

	private selectionSer = getStaticDI(SelectionService);
	private elemProvider = getStaticDI(ElementProviderService);

	private failed = false;

	constructor(project: Project) {
		this.project = project;
	}

	public runAndTestRandom(steps: number, fieldSize: number) {
		this.failed = false;
		for (let i = 0; i < steps && !this.failed; i++) {
			this.randomStep(fieldSize);
			this.checkForErrors(fieldSize);
		}
	}

	public randomStep(fieldSize: number) {
		let rand = this.randomInt(0, 30);
		if (rand > 16)
			rand = 5;
		console.log(rand);
		switch (rand) {
			case 0:
			case 1:
			case 2: // addElement
				this.project.addElement(this.randomTypeId(), this.randomPos(fieldSize));
				break;
			case 3:
			case 4:
			case 5: // addWire
				const pos = this.randomPos(fieldSize);
				if (Math.random() > 0.5)
					this.project.addWire(pos, this.randomPosFromPos(pos, fieldSize));
				else
					this.project.addWire(this.randomPosFromPos(pos, fieldSize), pos, this.randomPosFromPos(pos, fieldSize));
				break;
			case 6:
			case 7:
			case 8:
			case 9:
			case 10:
			case 11: // selectFromRect and move
				const selectFromRect = this.selectionSer.selectFromRect(this.project, this.randomPos(fieldSize), this.randomPos(fieldSize));
				this.project.moveElementsById(selectFromRect, this.randomPos(fieldSize / 4));
				break;
			case 12:
				if (this.project.allElements.length === 0)
					break;
				this.project.removeElementsById(this.randomElemIds(this.project.allElements.length / 10));
				break;
			case 13:
				if (this.project.allElements.length === 0)
					break;
				const id = this.randomElemId();
				const rot = this.randomInt(0, 4);
				console.log('rot', id, rot);
				this.project.rotateComponent(id, rot);
				break;
			case 14:
				if (this.project.allElements.length === 0)
					break;
				const numInputsElemId = this.randomElemId();
				const numInputsElem = this.elemProvider.getElementById(this.project.currState.getElementById(numInputsElemId).typeId);
				this.project.setNumInputs(numInputsElemId, this.randomInt(numInputsElem.minInputs, numInputsElem.maxInputs));
				break;
			case 15:
				this.project.stepBack();
				break;
			case 16:
				this.project.stepForward();
				break;
		}
	}

	private randomTypeId() {
		return this.TYPE_IDS[this.randomInt(0, this.TYPE_IDS.length)];
	}

	private randomPos(fieldSize: number): PIXI.Point {
		return new PIXI.Point(this.randomInt(0, fieldSize), this.randomInt(0, fieldSize));
	}

	private randomElemId(): number {
		let out;
		do {
			out = this.randomInt(0, this.project.currState.highestTakenId + 1);
		} while (!this.project.currState.model.has(out));
		return out;
	}

	private randomElemIds(count: number): number[] {
		const out = new Set<number>();
		for (let i = 0; i < this.project.allElements.length && i < count; i++) {
			let id;
			do {
				id = this.randomElemId();
			} while (out.has(id));
			out.add(id);
		}
		return [...out];
	}

	private randomPosFromPos(given: PIXI.Point, fieldSize: number): PIXI.Point {
		if (Math.random() > 0.5)
			return new PIXI.Point(given.x, this.randomInt(0, fieldSize));
		else
			return new PIXI.Point(this.randomInt(0, fieldSize), given.y);
	}

	// to not included
	private randomInt(from: number, to: number): number {
		return Math.floor(Math.random() * (to - from) + from);
	}

	public checkForErrors(fieldSize: number) {
		for (let x = 0; x <= fieldSize / 16; x++) {
			for (let y = 0; y <= fieldSize / 16; y++) {
				const chunk = this.project.currState.chunk(new PIXI.Point(x, y));
				if (chunk)
					for (const con of chunk.connectionPoints)
						this.checkCon(con);
			}
		}
	}

	public checkCon(con: PIXI.Point) {
		const onPoint = this.project.currState.elemsOnPoint(con);
		if (onPoint.length < 3) {
			// ng.getComponent($0)._pixiRenderer.render(ng.getComponent($0).activeView)
			this.failed = true;
		}
	}

}
