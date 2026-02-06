import {IsEmail, IsNotEmpty, IsString} from 'class-validator';

export class SendPasswordResetMail {

	@IsString()
	@IsEmail()
	@IsNotEmpty()
	email: string;

}
