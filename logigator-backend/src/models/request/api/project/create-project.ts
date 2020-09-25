import {IsNotEmpty, IsString, MaxLength} from 'class-validator';

export class CreateProject {

	@IsString()
	@IsNotEmpty()
	@MaxLength(20)
	name: string;

	@IsString()
	@MaxLength(2048)
	description: string

}
