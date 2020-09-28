import {IsArray, IsDefined, IsInt, IsNotEmpty, IsString, ValidateNested} from 'class-validator';
import {ProjectFile} from './project-file';
import {Type} from 'class-transformer';

export class SaveProject {
	@IsDefined()
	@ValidateNested()
	@Type(() => ProjectFile)
	project: ProjectFile;

	@IsString()
	@IsNotEmpty()
	oldHash: string;
}
