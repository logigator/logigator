import {IsArray, IsInt, IsNotEmpty, IsPositive, IsString, Length, MaxLength, ValidateNested} from 'class-validator';
import {Type} from 'class-transformer';
import {ProjectElement} from '../project-element';
import {ProjectMapping} from '../project-mapping';

export class SaveComponent {
	@IsString()
	@IsNotEmpty()
	oldHash: string;

	@IsArray()
	@ValidateNested({each: true})
	@Type(() => ProjectMapping)
	dependencies: ProjectMapping[];

	@IsArray()
	@ValidateNested({each: true})
	@Type(() => ProjectElement)
	elements: ProjectElement[];

	@IsInt()
	@IsPositive()
	numInputs: number;

	@IsInt()
	@IsPositive()
	numOutputs: number;

	@IsArray()
	@IsString({each: true})
	@Length(0, 4, {each: true})
	labels: string[]
}
