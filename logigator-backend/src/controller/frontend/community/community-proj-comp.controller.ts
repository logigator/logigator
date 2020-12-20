import {Controller, CurrentUser, Get, NotFoundError, Param, Render, Req, Res, UseBefore} from 'routing-controllers';
import {ConfigService} from '../../../services/config.service';
import {TranslationService} from '../../../services/translation.service';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../../database/repositories/project.repository';
import {ComponentRepository} from '../../../database/repositories/component.repository';
import {Preferences} from '../../../decorator/preferences.decorator';
import {UserPreferences} from '../../../models/user-preferences';
import {CheckAuthenticatedFrontMiddleware} from '../../../middleware/auth/frontend-guards/check-authenticated-front.middleware';
import {User} from '../../../database/entities/user.entity';
import {UserRepository} from '../../../database/repositories/user.repository';
import {Redirect, RedirectFunction} from '../../../decorator/redirect.decorator';
import {Request, Response} from 'express';
import {setTitle} from '../../../functions/set-title';

@Controller('/community')
export class CommunityProjCompController {

	constructor(
		private configService: ConfigService,
		private translationService: TranslationService,
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private componentRepo: ComponentRepository,
		@InjectRepository() private userRepo: UserRepository
	) {}

	@Get('/project/:link')
	@Render('community-proj-comp')
	public async project(@Param('link') link: string, @Preferences() preferences: UserPreferences, @CurrentUser() currentUser: User, @Req() request: Request, @Res() response: Response) {
		const project = await this.projectRepo.getProjectWithStargazersCountByLink(link);
		if (!project)
			throw new NotFoundError();

		setTitle(response, 'Logigator - ' + project.name);

		const user = await project.user;

		let isStared = false;
		if (request.isAuthenticated()) {
			isStared = await this.projectRepo.hasUserStaredProject(project, currentUser);
		}

		return {
			...project,
			previewDark: project.previewDark?.publicUrl ?? '/assets/default-preview.svg',
			previewLight: project.previewLight?.publicUrl ?? '/assets/default-preview.svg',
			editorUrl: this.configService.getConfig('domains').editor + '/share/' + project.link,
			cloneUrl: '/community/clone/' + project.link,
			starUnstarUrl: '/community/toggleStar/project/' + project.link,
			stargazers: '/community/project/' + project.link + '/stargazers',
			username: user.username,
			userImage: user.image?.publicUrl ?? '/assets/default-user.svg',
			userUrl: 'community/user/' + user.id,
			isStared
		};
	}

	@Get('/component/:link')
	@Render('community-proj-comp')
	public async component(@Param('link') link: string, @Preferences() preferences: UserPreferences, @CurrentUser() currentUser: User, @Req() request: Request, @Res() response: Response) {
		const comp = await this.componentRepo.getComponentWithStargazersCountByLink(link);
		if (!comp)
			throw new NotFoundError();

		setTitle(response, 'Logigator - ' + comp.name);

		const user = await comp.user;

		let isStared = false;
		if (request.isAuthenticated()) {
			isStared = await this.componentRepo.hasUserStaredComponent(comp, currentUser);
		}

		return {
			...comp,
			previewDark: comp.previewDark?.publicUrl ?? '/assets/default-preview.svg',
			previewLight: comp.previewLight?.publicUrl ?? '/assets/default-preview.svg',
			editorUrl: this.configService.getConfig('domains').editor + '/share/' + comp.link,
			starUnstarUrl: '/community/toggleStar/component/' + comp.link,
			cloneUrl: '/community/clone/' + comp.link,
			stargazers: '/community/component/' + comp.link + '/stargazers',
			username: user.username,
			userImage: user.image?.publicUrl ?? '/assets/default-user.svg',
			userUrl: 'community/user/' + user.id,
			stars: 10,
			isStared
		};
	}

	@Get('/toggleStar/project/:link')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async toggleStarProject(@Param('link') link: string, @CurrentUser() user: User, @Redirect() redirect: RedirectFunction) {
		const toToggle = (await this.projectRepo.findOne({
			where: {
				link
			}
		}));
		if (!toToggle)
			throw new NotFoundError();

		const staredProjects = await user.staredProjects;
		const filteredProjects = staredProjects.filter(p => p.id !== toToggle.id);

		if (filteredProjects.length === staredProjects.length) {
			staredProjects.push(toToggle);
			user.staredProjects = Promise.resolve(staredProjects);
		} else {
			user.staredProjects = Promise.resolve(filteredProjects);
		}
		await this.userRepo.save(user);

		return redirect();
	}

	@Get('/toggleStar/component/:link')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async toggleStarComponent(@Param('link') link: string, @CurrentUser() user: User, @Redirect() redirect: RedirectFunction) {
		const toToggle = (await this.componentRepo.findOne({
			where: {
				link
			}
		}));
		if (!toToggle)
			throw new NotFoundError();

		const staredComps = await user.staredComponents;
		const filteredComps = staredComps.filter(p => p.id !== toToggle.id);

		if (filteredComps.length === staredComps.length) {
			staredComps.push(toToggle);
			user.staredComponents = Promise.resolve(staredComps);
		} else {
			user.staredComponents = Promise.resolve(filteredComps);
		}
		await this.userRepo.save(user);

		return redirect();
	}

}
