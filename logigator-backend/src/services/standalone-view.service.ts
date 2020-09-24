import {Service} from 'typedi';
import * as path from 'path';
import * as fs from 'fs/promises';
import {ConfigService} from './config.service';
import {compile} from 'handlebars';
import {TranslationService} from './translation.service';
import {handlebarsHelpers} from '../handlebars-helper/helpers';

@Service()
export class StandaloneViewService {

	private readonly VIEW_DIR: string;

	private _viewCache = new Map<string, HandlebarsTemplateDelegate>();

	constructor(private configService: ConfigService, private translationService: TranslationService) {
		this.VIEW_DIR = path.join(path.join(configService.projectRootPath, 'resources', 'templates', 'standalone'));
	}

	public async renderView(view: string, data: any, lang = 'en'): Promise<string> {
		let template: HandlebarsTemplateDelegate;
		if (this._viewCache.has(view)) {
			template = this._viewCache.get(view);
		} else {
			const viewFile = (await fs.readFile(path.join(this.VIEW_DIR, `${view}.hbs`))).toString();
			template = compile(viewFile);
			this._viewCache.set(view, template);
		}

		return template({
			...data,
			i18n: this.translationService.getTranslations(lang)
		}, {
			helpers: handlebarsHelpers
		});
	}

}
