import {IsInt, IsOptional, IsString, MaxLength, ValidateNested} from 'class-validator';
import {ReportProject} from './report-project';
import {Type} from 'class-transformer';

export class ReportError {

	@IsOptional()
	@IsInt()
	line: string;

	@IsOptional()
	@IsInt()
	col: string;

	@IsOptional()
	@IsString()
	@MaxLength(256)
	file: string;

	@IsOptional()
	@IsString()
	@MaxLength(256)
	message: string;

	@IsOptional()
	@IsString()
	@MaxLength(4096)
	stack: string;

	@IsOptional()
	@IsString()
	@MaxLength(512)
	userMessage: string;

	@IsOptional()
	@ValidateNested()
	@Type(() => ReportProject)
	project: ReportProject;
}
