import {Controller, Get, NotFoundError, Param, QueryParam, Render, Res} from 'routing-controllers';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {UserRepository} from '../../../database/repositories/user.repository';
import {TranslationService} from '../../../services/translation.service';
import {Preferences} from '../../../decorator/preferences.decorator';
import {UserPreferences} from '../../../models/user-preferences';
import {setTitle} from '../../../functions/set-title';
import {Response} from 'express';

@Controller('/community/user')
export class CommunityUserController {

	constructor(
		@InjectRepository() private userRepo: UserRepository,
		private translationService: TranslationService
	) {}

	@Get('/:id')
	@Render('community-user')
	public async user(@Param('id') id: string, @QueryParam('tab') tab: string, @Preferences() preferences: UserPreferences, @Res() response: Response) {
		const user = await this.userRepo.findOne({
			where: {
				id
			}
		});
		if (!user)
			throw new NotFoundError('ResourceNotFound');

		setTitle(response, 'Logigator - ' + user.username);

		tab = tab ?? 'projects';

		return {
			...user,
			userImage: user.image?.publicUrl ?? '/assets/default-user.svg',
			memberSince: this.translationService.dateFormatDate(user.memberSince, preferences.lang),
			componentsLink: '/community/user/' + id + '?tab=components',
			projectsLink: '/community/user/' + id + '?tab=projects',
			staredProjectsLink: '/community/user/' + id + '?tab=staredComponents',
			staredComponentsLink: '/community/user/' + id + '?tab=staredProjects',
			currentTab: tab
		};
	}

}
