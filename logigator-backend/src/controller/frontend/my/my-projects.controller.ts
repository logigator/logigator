import {Controller, Get, QueryParam, Render, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../../middleware/action/set-title-middleware';
import {TranslationService} from '../../../services/translation.service';
import {CheckAuthenticatedFrontMiddleware} from '../../../middleware/auth/frontend-guards/check-authenticated-front.middleware';

@Controller('/my/projects')
export class MyProjectsController {


	constructor(private translationService: TranslationService) {}

	@Get('/')
	@Render('my-projects')
	@UseBefore(setTitleMiddleware('TITLE.PROJECTS'))
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public myProjects(@QueryParam('page') page: number) {
		return {
			items: [
				{
					id: 'asdsadasd-asdasdsadasd-asdasdasd',
					name: 'My Projeasdct',
					description: 'asdjaskjfhj asd asd asd',
					lastEdited: this.translationService.dateFormatDateTime(new Date(), 'en'),
					lastEditedShort: this.translationService.dateFormatDate(new Date(), 'en'),
					createdOn: this.translationService.dateFormatDateTime(new Date(), 'en'),
					numInputs: 2,
					numOutputs: 2,
					symbol: 'asd',
					previewImage: 'https://api.logigator.com/images/thumbnails/d884a93d-9256-458b-b6cc-3fffd8fc4bdf'
				},
				{
					id: 'asdsadasd-asdasdsadasd-asdasdasd',
					name: 'My Project',
					description: 'asdjaskjfhj asd asd asd',
					lastEdited: new Date(),
					createdOn: new Date(),
					numInputs: 2,
					numOutputs: 2,
					symbol: 'asd',
					previewImage: 'https://api.logigator.com/images/thumbnails/d884a93d-9256-458b-b6cc-3fffd8fc4bdf'

				},
				{
					id: 'asdsadasd-asdasdsadasd-asdasdasd',
					name: 'My Project',
					description: 'asdjaskjfhj asd asd asd',
					lastEdited: new Date(),
					createdOn: new Date(),
					previewImage: 'https://api.logigator.com/images/thumbnails/d884a93d-9256-458b-b6cc-3fffd8fc4bdf'
				},
				{
					id: 'asdsadasd-asdasdsadasd-asdasdasd',
					name: 'My Projeasdsadct',
					description: 'asdjaskjfhj asd asd asd',
					lastEdited: new Date(),
					createdOn: new Date(),
					previewImage: 'https://api.logigator.com/images/thumbnails/d884a93d-9256-458b-b6cc-3fffd8fc4bdf'
				},
				{
					id: 'asdsadasd-asdasdsadasd-asdasdasd',
					name: 'My',
					description: 'asdjaskjfhj asd asd asd',
					lastEdited: new Date(),
					createdOn: new Date(),
					previewImage: 'https://api.logigator.com/images/thumbnails/d884a93d-9256-458b-b6cc-3fffd8fc4bdf'
				},
				{
					id: 'asdsadasd-asdasdsadasd-asdasdasd',
					name: 'My Projecasdsadt',
					description: 'asdjaskjfhj asd asd asd',
					lastEdited: new Date(),
					createdOn: new Date(),
					previewImage: 'https://api.logigator.com/images/thumbnails/d884a93d-9256-458b-b6cc-3fffd8fc4bdf'
				}
			]
		};
	}
}
