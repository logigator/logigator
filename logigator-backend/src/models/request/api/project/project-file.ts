import {ProjectElement} from './project-element';
import {IsArray, IsDefined, ValidateNested} from 'class-validator';
import {ProjectMapping} from './project-mapping';

export class ProjectFile {
	@IsArray()
	@IsDefined({each: true})
	@ValidateNested({each: true})
	elements: ProjectElement[];

	@IsArray()
	@IsDefined({each: true})
	@ValidateNested({each: true})
	mappings: ProjectMapping[];
}
