import {IsNotEmpty, IsString, Matches, MaxLength, MinLength} from 'class-validator';

export class CreateProject {

	@IsString()
	@IsNotEmpty()
	@MaxLength(20)
	name: string;

	@IsString()
	@MaxLength(2048)
	description: string

}
