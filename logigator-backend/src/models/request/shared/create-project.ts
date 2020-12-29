import {IsNotEmpty, IsOptional, IsString, MaxLength} from 'class-validator';

export class CreateProject {

	@IsString()
	@IsNotEmpty()
	@MaxLength(20)
	name: string;

	@IsString()
	@IsOptional()
	@MaxLength(2048)
	description: string;

	@IsOptional()
	@IsString()
	public: string;

}
