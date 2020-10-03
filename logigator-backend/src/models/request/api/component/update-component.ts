import {IsNotEmpty, IsOptional, IsString, MaxLength} from 'class-validator';

export class UpdateComponent {

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
	@IsString()
	@IsNotEmpty()
	@MaxLength(5)
	symbol: string;
}
