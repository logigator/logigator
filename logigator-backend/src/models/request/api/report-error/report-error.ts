import {IsNotEmpty, IsOptional, IsString} from 'class-validator';

export class ReportError {

	@IsString()
	@IsNotEmpty()
	message: string;

	@IsString()
	@IsNotEmpty()
	stack: string;

	@IsString()
	@IsOptional()
	userMessage: string;

}
