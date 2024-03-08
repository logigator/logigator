import {
	MissingTranslationHandler,
	MissingTranslationHandlerParams
} from '@ngx-translate/core';

export class AppMissingTranslationHandler extends MissingTranslationHandler {
	handle(params: MissingTranslationHandlerParams): string {
		return params.key;
	}
}
