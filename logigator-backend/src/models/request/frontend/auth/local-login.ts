import {IsNotEmpty, IsString} from 'class-validator';

export class LocalLogin{

	@IsString()
	@IsNotEmpty()
	email: string;

	@IsString()
	@IsNotEmpty()
	password: string;

}
