import {HelperDelegate, createFrame, HelperOptions} from 'handlebars';

export function infoPopupDataScopeHelper(): HelperDelegate {
	return function(options: HelperOptions) {
		const data = createFrame(options.data);
		data.infoPopupData = this.infoPopup.data;
		return options.fn(this, {data: data});
	};
}
