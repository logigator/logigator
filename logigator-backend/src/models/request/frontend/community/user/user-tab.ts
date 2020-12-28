import {IsIn, IsInt, IsOptional} from 'class-validator';

export class UserTab {

	@IsOptional()
	@IsInt()
	page: number;

	@IsOptional()
	@IsIn(['components', 'projects', 'staredProjects', 'staredComponents'])
	tab: 'components' | 'projects' | 'staredProjects' | 'staredComponents';

}
