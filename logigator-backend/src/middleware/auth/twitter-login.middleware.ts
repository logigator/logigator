import {ExpressMiddlewareInterface} from 'routing-controllers';
import {Request, Response} from 'express';
import passport from 'passport';
import {ConfigService} from '../../services/config.service';
import {Container} from 'typedi';

export class TwitterLoginMiddleware implements ExpressMiddlewareInterface {

	private configService = Container.get(ConfigService);

	use(request: Request, response: Response, next: (err?: any) => any): any {
		passport.authenticate('twitter', {
			callbackURL: this.configService.getConfig('passport').twitter.callbackURL + '?state=' + request.query.form
		} as any)(request, response, next);
	}
}
