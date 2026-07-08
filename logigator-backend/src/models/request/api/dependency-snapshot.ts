import {
	IsArray,
	IsInt,
	IsString,
	Length,
	MaxLength,
	ValidateNested
} from 'class-validator';
import {Type} from 'class-transformer';
import {ProjectElement} from './project-element';

/**
 * A frozen copy of a custom dependency's circuit, embedded in a project/component
 * save so the saved document is self-contained (additive — old clients omit it).
 * The summary fields are the values as placed, deliberately kept alongside the
 * frozen `elements` so a stale instance renders at its own port count regardless
 * of later master edits.
 */
export class DependencySnapshot {

	@IsInt()
	version: number;

	@IsString()
	@MaxLength(20)
	name: string;

	@IsString()
	@MaxLength(5)
	symbol: string;

	@IsString()
	@MaxLength(2048)
	description: string;

	@IsInt()
	numInputs: number;

	@IsInt()
	numOutputs: number;

	@IsArray()
	@IsString({each: true})
	@Length(0, 5, {each: true})
	labels: string[];

	@IsArray()
	@ValidateNested({each: true})
	@Type(() => ProjectElement)
	elements: ProjectElement[];
}
