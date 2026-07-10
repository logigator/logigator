import {IsInt, IsOptional, IsString, MaxLength, ValidateNested} from 'class-validator';
import {ReportProject} from './report-project';
import {ReportClient} from './report-client';
import {Type} from 'class-transformer';

export class ReportError {

	// Identifies the reporting client (e.g. `editor-v2`). Absent for the legacy
	// editor, which the controller then reports as `editor-v1`.
	@IsOptional()
	@IsString()
	@MaxLength(32)
	source: string;

	@IsOptional()
	@IsInt()
	line: string;

	@IsOptional()
	@IsInt()
	col: string;

	@IsOptional()
	@IsString()
	@MaxLength(512)
	file: string;

	@IsOptional()
	@IsString()
	@MaxLength(512)
	userAgent: string;

	@IsOptional()
	@IsString()
	@MaxLength(2048)
	message: string;

	@IsOptional()
	@IsString()
	@MaxLength(16384)
	stack: string;

	@IsOptional()
	@IsString()
	@MaxLength(512)
	userMessage: string;

	// Recent client-side log lines leading up to the report.
	@IsOptional()
	@IsString()
	@MaxLength(16384)
	logs: string;

	@IsOptional()
	@ValidateNested()
	@Type(() => ReportClient)
	client: ReportClient;

	@IsOptional()
	@ValidateNested()
	@Type(() => ReportProject)
	project: ReportProject;

	// A serialized project dump (native format) sent as an opaque JSON string.
	// The legacy `project` field stays untouched for backwards compatibility.
	@IsOptional()
	@IsString()
	@MaxLength(8_000_000)
	projectDump: string;
}
