import {IsEmail, IsString, Length} from 'class-validator';

export class Create {

	@IsString()
	@Length(1, 10)
	name: string;

	@IsEmail()
	email: string

}
