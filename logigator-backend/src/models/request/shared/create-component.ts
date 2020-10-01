import {IsNotEmpty, IsString, MaxLength} from 'class-validator';

export class CreateComponent {

	@IsString()
	@IsNotEmpty()
	@MaxLength(20)
	name: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(5)
	symbol: string

	@IsString()
	@MaxLength(2048)
	description: string

}
