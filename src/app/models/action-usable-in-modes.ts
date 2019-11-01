import {WorkModeService} from '../services/work-mode/work-mode.service';
import {InteractionAction, InteractionActionUsableInSimulation} from './interaction-action';
import {getStaticDI} from './get-di';

const actionUsableInSimulation: InteractionActionUsableInSimulation = {
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
	newComp: false,
	newProj: false,
	openProj: false,
	textMode: false,
	save: false,
	share: true,
	export: true,
	editDropdown: false
};

export function checkActionUsable(action: InteractionAction): boolean {
	if (getStaticDI(WorkModeService).currentWorkMode === 'simulation') {
		return actionUsableInSimulation[action];
	}
	return true;
}
