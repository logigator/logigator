import {HelperDelegate, createFrame, HelperOptions} from 'handlebars';

export function successPopupDataScopeHelper(): HelperDelegate {
	return function(options: HelperOptions) {
		const data = createFrame(options.data);
		data.successPopupData = this.successPopup.data;
		return options.fn(this, {data: data});
	};
}
