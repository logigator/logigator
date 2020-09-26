import {ProjectElement} from './project-element';
import {IsArray, ValidateNested} from 'class-validator';
import {Type} from 'class-transformer';

export class ProjectFile {
	@IsArray()
	@ValidateNested({each: true})
	@Type(() => ProjectElement)
	elements: ProjectElement[];
}
