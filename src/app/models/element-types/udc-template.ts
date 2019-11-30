import {ElementType} from './element-type';
import {ProjectsService} from '../../services/projects/projects.service';

export const udcTemplate: Partial<ElementType> = {
	category: 'user',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	isRotatable: true,
	rotation: 0,

	width: 3,

	edit: (typeId: number, id: number, projectsSer: ProjectsService) => {
		projectsSer.openComponent(typeId);
	},
	canEditType: true,

	labels: ['ds'],
	calcLabels() {
		return this.labels;
	}
};
