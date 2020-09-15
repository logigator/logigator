import {Get, JsonController, UseBefore} from "routing-controllers";
import {CheckAuthenticatedApiMiddleware} from "../../middleware/auth/api-guards/check-authenticated-api.middleware";

@JsonController('/api/project')
export class ProjectController {

	@Get('/all-info')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public getAllInfo() {
		return {
			test: 'asdsad'
		};
	}

}
