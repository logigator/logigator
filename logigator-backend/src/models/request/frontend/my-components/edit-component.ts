import {IsNotEmpty, IsOptional, IsString, MaxLength} from 'class-validator';

export class EditComponent {

	@IsString()
	@IsNotEmpty()
	@MaxLength(20)
	name: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(5)
	symbol: string;

	@IsOptional()
	@IsString()
	@MaxLength(2048)
	description: string;
}
