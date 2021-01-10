import {Controller, CurrentUser, Get, Param, UseBefore} from 'routing-controllers';
import {CheckAuthenticatedFrontMiddleware} from '../../../middleware/auth/frontend-guards/check-authenticated-front.middleware';
import {User} from '../../../database/entities/user.entity';
import {Redirect, RedirectFunction} from '../../../decorator/redirect.decorator';
import {ShareCloningService} from '../../../services/share-cloning.service';

@Controller('/community/clone')
export class CommunityCloneController {

	constructor(private shareCloningService: ShareCloningService) {}

	@Get('/project/:link')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async project(@Param('link') link: string, @CurrentUser() user: User, @Redirect() redirect: RedirectFunction) {
		await this.shareCloningService.cloneProject(link, user);
		return redirect({target: '/my/projects'});
	}

	@Get('/component/:link')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async component(@Param('link') link: string, @CurrentUser() user: User, @Redirect() redirect: RedirectFunction) {
		await this.shareCloningService.cloneComponent(link, user);
		return redirect({target: '/my/components'});
	}

}
