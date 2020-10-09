import {IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength} from 'class-validator';

export class UpdateProject {

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(20)
	name: string;

	@IsOptional()
	@IsString()
	@MaxLength(2048)
	description: string;

	@IsOptional()
	@IsBoolean()
	public: boolean;

	@IsOptional()
	@IsBoolean()
	updateLink: boolean;
}
