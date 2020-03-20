import {WorkModeService} from '../services/work-mode/work-mode.service';
import {InteractionAction, InteractionActionUsable} from './interaction-action';
import {getStaticDI} from './get-di';

const actionUsableInEditor: InteractionActionUsable = {
	copy: true,
	paste: true,
	cut: true,
	delete: true,
	undo: true,
	redo: true,
	zoom100: true,
	zoomIn: true,
	zoomOut: true,
	fullscreen: true,
	connWireMode: true,
	wireMode: true,
	selectMode: true,
	cutSelectMode: true,
	newComp: true,
	newProj: true,
	openProj: true,
	eraserMode: true,
	textMode: true,
	save: true,
	share: true,
	export: true,
	editDropdown: true,
	exportImage: true,
	enterSim: true,
	leaveSim: false
};

const actionUsableInSimulation: InteractionActionUsable = {
	copy: false,
	paste: false,
	cut: false,
	delete: false,
	undo: false,
	redo: false,
	zoom100: true,
	zoomIn: true,
	zoomOut: true,
	fullscreen: true,
	connWireMode: false,
	wireMode: false,
	selectMode: false,
	cutSelectMode: false,
	newComp: false,
	newProj: false,
	openProj: false,
	eraserMode: false,
	textMode: false,
	save: false,
	share: true,
	export: true,
	editDropdown: false,
	exportImage: false,
	enterSim: false,
	leaveSim: true
};

export function checkActionUsable(action: InteractionAction): boolean {
	const currentWorkMode = getStaticDI(WorkModeService).currentWorkMode;
	if (currentWorkMode === 'simulation') {
		return actionUsableInSimulation[action];
	} else {
		return actionUsableInEditor[action]
	}
}
