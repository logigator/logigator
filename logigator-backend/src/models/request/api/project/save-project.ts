import {IsArray, IsNotEmpty, IsString, ValidateNested} from 'class-validator';
import {Type} from 'class-transformer';
import {ProjectElement} from './project-element';
import {ProjectMapping} from './project-mapping';

export class SaveProject {
	@IsString()
	@IsNotEmpty()
	oldHash: string;

	@IsArray()
	@ValidateNested({each: true})
	@Type(() => ProjectMapping)
	mappings: ProjectMapping[];

	@IsArray()
	@ValidateNested({each: true})
	@Type(() => ProjectElement)
	elements: ProjectElement[];
}
