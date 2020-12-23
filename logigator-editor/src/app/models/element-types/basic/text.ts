import {ElementType} from '../element-type';
import {ProjectsService} from '../../../services/projects/projects.service';
import {TextComponent} from '../../../components/popup-contents/text/text.component';
import {getStaticDI} from '../../get-di';
import {ElementTypeId} from '../element-type-ids';
import {PopupService} from '../../../services/popup/popup.service';
import {ElementRotation} from '../../element';
import {FontWidthService} from '../../../services/font-width/font-width.service';
import {environment} from '../../../../environments/environment';

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
	rotation: ElementRotation.Right,

	numOutputs: 0,

	numInputs: 0,
	minInputs: 0,
	maxInputs: 0,

	width(element) {
		if (!element)
			return 0;
		let longest = 0;
		for (const line of (element.data as TextData).split('\n')) {
			const length = Math.ceil(
				getStaticDI(FontWidthService).getTextWidth(line, `${environment.gridPixelWidth * element.options[0] / 8}px Roboto`) / 1.2 / environment.gridPixelWidth
			);
			longest = Math.max(longest, length);
		}
		return longest;
	},
	height(element) {
		return element ? (element.data as TextData).split('\n').length : 0; // TODO font size
	},

	options: [8],

	optionsConfig: [
		{
			name: 'ELEMENT_TYPE.BASIC.TEXT.TEXT_SIZE',
			min: 1,
			max: 64
		}
	],
	onOptionsChanged(element?) { // to recalculate size
		return;
	},

	edit: async (typeId: number, id: number, projectsSer: ProjectsService) => {
		const oText = projectsSer.currProject.currState.getElementById(id).data as TextData;
		const nText = await getStaticDI(PopupService).showPopup(TextComponent, 'POPUP.TEXT.TITLE', false, oText);
		if (nText === oText || nText === undefined) return;
		projectsSer.currProject.setData(id, nText);
	},
	canEditType: false
};

export type TextData = string;
