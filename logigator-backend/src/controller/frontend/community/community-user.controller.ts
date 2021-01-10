import {
	Controller,
	Get,
	NotFoundError,
	Param,
	QueryParams,
	Render,
	Res,
	ResponseClassTransformOptions
} from 'routing-controllers';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {UserRepository} from '../../../database/repositories/user.repository';
import {TranslationService} from '../../../services/translation.service';
import {Preferences} from '../../../decorator/preferences.decorator';
import {UserPreferences} from '../../../models/user-preferences';
import {setTitle} from '../../../functions/set-title';
import {Response} from 'express';
import {UserTab} from '../../../models/request/frontend/community/user/user-tab';
import {ProjectRepository} from '../../../database/repositories/project.repository';
import {ComponentRepository} from '../../../database/repositories/component.repository';
import {User} from '../../../database/entities/user.entity';
import {Page} from '../../../database/repositories/pageable.repository';
import {Project} from '../../../database/entities/project.entity';
import {Component} from '../../../database/entities/component.entity';

@Controller('/community/user')
export class CommunityUserController {

	constructor(
		@InjectRepository() private userRepo: UserRepository,
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private compRepo: ComponentRepository,
		private translationService: TranslationService
	) {}

	@Get('/:id')
	@Render('community-user')
	@ResponseClassTransformOptions({
		groups: ['showShareLinks']
	})
	public async user(@Param('id') id: string, @QueryParams() params: UserTab, @Preferences() preferences: UserPreferences, @Res() response: Response) {
		const user = await this.userRepo.findOne({
			where: {
				id
			}
		});
		if (!user)
			throw new NotFoundError('ResourceNotFound');

		setTitle(response, 'Logigator - ' + user.username);

		const tab = params.tab ?? 'projects';

		return {
			...user,
			userImage: user.image?.publicUrl ?? '/assets/default-user.svg',
			memberSince: this.translationService.dateFormatDate(user.memberSince, preferences.lang),
			componentsLink: '/community/user/' + id + '?tab=components',
			projectsLink: '/community/user/' + id + '?tab=projects',
			staredProjectsLink: '/community/user/' + id + '?tab=staredComponents',
			staredComponentsLink: '/community/user/' + id + '?tab=staredProjects',
			currentTab: tab,
			...(await this.getPage(user, tab, params.page)),
			viewScript: 'community-user'
		};
	}

	@Get('/:id/page')
	@Render('community-user-page')
	@ResponseClassTransformOptions({
		groups: ['showShareLinks']
	})
	public async page(@Param('id') id: string, @QueryParams() params: UserTab) {
		const user = await this.userRepo.findOne({
			where: {
				id
			}
		});
		if (!user)
			throw new NotFoundError('ResourceNotFound');

		const tab = params.tab ?? 'projects';

		return {
			...(await this.getPage(user, tab, params.page)),
			layout: false
		};
	}

	private async getPage(user: User, tab: string, pageNumber: number): Promise<any> {
		let page: Page<Project | Component>;
		let type: string;
		switch (tab) {
			case 'components':
				type = 'component';
				page = await this.compRepo.getComponentPageForUser(pageNumber ?? 0, 12, user, undefined, true);
				break;
			case 'projects':
				type = 'project';
				page = await this.projectRepo.getProjectPageForUser(pageNumber ?? 0, 12, user, undefined, true);
				break;
			case 'staredComponents':
				page = await this.compRepo.getComponentsStaredByUser(pageNumber ?? 0, 12, user);
				type = 'component';
				break;
			case 'staredProjects':
				page = await this.projectRepo.getProjectsStaredByUser(pageNumber ?? 0, 12, user);
				type = 'project';
				break;
		}

		return {
			entries: page.entries.map(entry => {
				entry.link = 'community/' + type  + '/' + entry.link;
				(entry as any).previewDark = entry.previewDark?.publicUrl ?? '/assets/default-preview.svg';
				(entry as any).previewLight = entry.previewLight?.publicUrl ?? '/assets/default-preview.svg';
				return entry;
			}),
			currentPage: page.page,
			totalPages: page.total
		};
	}

}
