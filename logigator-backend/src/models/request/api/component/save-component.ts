import {
	IsArray,
	IsBoolean,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Length,
	NotContains,
	ValidateNested
} from 'class-validator';
import {Type} from 'class-transformer';
import {ProjectElement} from '../project-element';
import {ProjectMapping} from '../project-mapping';

export class SaveComponent {
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

	@IsInt()
	numInputs: number;

	@IsInt()
	numOutputs: number;

	@IsArray()
	@IsString({each: true})
	@Length(0, 5, {each: true})
	@NotContains(',', {each: true})
	labels: string[]
}
