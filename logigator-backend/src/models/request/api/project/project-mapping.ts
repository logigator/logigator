import {IsInt} from 'class-validator';

export class ProjectMapping {
	@IsInt()
	database: number;

	@IsInt()
	model: number;
}
