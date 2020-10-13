import {ElementType} from '../element-type';
import {ProjectsService} from '../../../services/projects/projects.service';
import {TextComponent} from '../../../components/popup-contents/text/text.component';
import {getStaticDI} from '../../get-di';
import {ElementTypeId} from '../element-type-ids';
import {PopupService} from '@logigator/logigator-shared-comps';

export const text: ElementType = {
	id: ElementTypeId.TEXT,

	name: 'ELEMENT_TYPE.BASIC.TEXT.NAME',

	category: 'basic',

	symbol: '',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: false,

	description: 'ELEMENT_TYPE.BASIC.TEXT.DESCRIPTION',

	isRotatable: false,
	rotation: 0,

	numOutputs: 0,

	numInputs: 0,
	minInputs: 0,
	maxInputs: 0,

	width: () => undefined,
	height: () => undefined,

	edit: async (typeId: number, id: number, projectsSer: ProjectsService) => {
		const oText = projectsSer.currProject.currState.getElementById(id).data as TextData;
		const nText = await getStaticDI(PopupService).showPopup(TextComponent, 'POPUP.TEXT.TITLE', false, oText);
		if (nText === oText || nText === undefined) return;
		projectsSer.currProject.setData(id, nText);
	},
	canEditType: false
};

export type TextData = string;
