import {IsInt, IsUUID} from 'class-validator';

export class ProjectMapping {
	@IsUUID()
	id: string;

	@IsInt()
	model: number;
}
