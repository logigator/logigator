import {ElementType} from './element-type';
import {ProjectsService} from '../../services/projects/projects.service';

export const udcTemplate: Partial<ElementType> = {
	category: 'user',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	isRotatable: true,
	rotation: 0,

	width: () => 3,
	height(element? ) {
		return element ? Math.max(element.numInputs, element.numOutputs) : Math.max(this.numInputs, this.numOutputs);
	},

	edit: (typeId: number, id: number, projectsSer: ProjectsService) => {
		// projectsSer.openComponent(typeId);
	},
	canEditType: true,

	labels: [],
	calcLabels() {
		return this.labels;
	}
};
