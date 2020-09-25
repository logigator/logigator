import {IsArray, IsDefined, IsInt, ValidateNested} from 'class-validator';
import {ProjectFile} from './project-file';

export class SaveProject {
	@IsDefined()
	@ValidateNested()
	project: ProjectFile;

	@IsInt()
	version: number;
}
