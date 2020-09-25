import {IsInt} from 'class-validator';

export class ProjectElementPos {
	@IsInt()
	x: number;

	@IsInt()
	y: number;
}
