import {IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested} from 'class-validator';
import {Type} from 'class-transformer';
import {ProjectElement} from '../project-element';
import {ProjectMapping} from '../project-mapping';

export class SaveProject {
	@IsString()
	@IsNotEmpty()
	oldHash: string;

	/** Set by the new editor; absent for old clients (treated as legacy). */
	@IsOptional()
	@IsBoolean()
	newFormat: boolean;

	@IsArray()
	@ValidateNested({each: true})
	@Type(() => ProjectMapping)
	dependencies: ProjectMapping[];

	@IsArray()
	@ValidateNested({each: true})
	@Type(() => ProjectElement)
	elements: ProjectElement[];
}
