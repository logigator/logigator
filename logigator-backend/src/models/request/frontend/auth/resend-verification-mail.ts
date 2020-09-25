import {IsNotEmpty, IsString} from 'class-validator';

export class ResendVerificationMail {

	@IsString()
	@IsNotEmpty()
	email: string;

	@IsString()
	@IsNotEmpty()
	password: string;

}
