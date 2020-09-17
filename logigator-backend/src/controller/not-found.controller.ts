import {Controller, Delete, Get, HttpCode, NotFoundError, Post, Put, Render, Req} from 'routing-controllers';
import {Request} from 'express';

@Controller()
export class NotFoundController {

	@Get('/api/*')
	@Post('/api/*')
	@Put('/api/*')
	@Delete('/api/*')
	apiNotFound(@Req() request: Request) {
		throw new NotFoundError(request.path + ' cannot be found on this server');
	}

	@HttpCode(404)
	@Get('*')
	@Render('not-found')
	frontendNotFound() {
		return {};
	}

}
