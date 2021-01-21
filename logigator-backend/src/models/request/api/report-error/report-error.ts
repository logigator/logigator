import {IsNotEmpty, IsOptional, IsString, MaxLength} from 'class-validator';

export class ReportError {

	@IsString()
	@IsNotEmpty()
	@MaxLength(256)
	message: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(4096)
	stack: string;

	@IsString()
	@IsOptional()
	@MaxLength(512)
	userMessage: string;

}
