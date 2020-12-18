import {Controller, Get, Param, Render} from 'routing-controllers';
import {ConfigService} from '../../../services/config.service';
import {TranslationService} from '../../../services/translation.service';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../../database/repositories/project.repository';
import {ComponentRepository} from '../../../database/repositories/component.repository';
import {Preferences} from '../../../decorator/preferences.decorator';
import {UserPreferences} from '../../../models/user-preferences';

@Controller('/community')
export class CommunityProjCompController {

	constructor(
		private configService: ConfigService,
		private translationService: TranslationService,
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private componentRepo: ComponentRepository
	) {}

	@Get('/project/:link')
	@Render('community-proj-comp')
	public async project(@Param('link') link: string, @Preferences() preferences: UserPreferences) {
		return {};
	}

	@Get('/component/:link')
	@Render('community-proj-comp')
	public async component(@Param('link') link: string, @Preferences() preferences: UserPreferences) {
		return {};
	}

}
