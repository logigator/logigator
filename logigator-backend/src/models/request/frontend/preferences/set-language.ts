import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { availableLanguages, LanguageCode } from '../../../../i18n';

export class SetLanguage {

	@IsString()
	@IsNotEmpty()
	@IsIn(availableLanguages)
	lang: LanguageCode

}
