import {ElementType} from './element-type';
import {environment} from '../../../environments/environment';
import {Project} from '../project';
import {getStaticDI} from '../get-di';
import {ProjectsService} from '../../services/projects/projects.service';

export const udcTemplate: Partial<ElementType> = {
	category: 'user',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	isRotatable: true,
	rotation: 0,

	width: environment.componentWidth,

	edit: (typeId: number, id: number, projectsSer: ProjectsService) => {
		projectsSer.openComponent(typeId);
	},
	canEditType: true
};
