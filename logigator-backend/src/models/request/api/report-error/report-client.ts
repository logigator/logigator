import {IsBoolean, IsNumber, IsOptional, IsString, MaxLength} from 'class-validator';

/**
 * Structured client environment attached to a report by the newer editor.
 * Every field is optional so a client that omits the whole block — including
 * the legacy editor, which never sends it — still validates.
 */
export class ReportClient {

	@IsOptional()
	@IsString()
	@MaxLength(64)
	browser: string;

	@IsOptional()
	@IsString()
	@MaxLength(64)
	os: string;

	@IsOptional()
	@IsString()
	@MaxLength(64)
	renderingContext: string;

	@IsOptional()
	@IsString()
	@MaxLength(128)
	gpu: string;

	@IsOptional()
	@IsNumber()
	windowWidth: number;

	@IsOptional()
	@IsNumber()
	windowHeight: number;

	@IsOptional()
	@IsNumber()
	screenWidth: number;

	@IsOptional()
	@IsNumber()
	screenHeight: number;

	@IsOptional()
	@IsNumber()
	devicePixelRatio: number;

	@IsOptional()
	@IsString()
	@MaxLength(16)
	locale: string;

	@IsOptional()
	@IsString()
	@MaxLength(256)
	url: string;

	@IsOptional()
	@IsString()
	@MaxLength(64)
	workMode: string;

	@IsOptional()
	@IsBoolean()
	simulationRunning: boolean;

	@IsOptional()
	@IsBoolean()
	touch: boolean;
}
