import {Body, Get, JsonController, Post, UseBefore} from "routing-controllers";
import {CheckAuthenticatedApiMiddleware} from "../../middleware/auth/api-guards/check-authenticated-api.middleware";
import {Create} from "../../models/request/api/project/create";

@JsonController('/api/project')
export class ProjectController {

	@Get('/all-info')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public getAllInfo() {
		return {
			test: 'asdsad'
		};
	}

	@Post('/create')
	public create(@Body() pro: Create) {
		return pro;
	}

}
