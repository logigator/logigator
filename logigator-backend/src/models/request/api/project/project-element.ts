import {ProjectElementPos} from './project-element-pos';
import {
	IsArray,
	IsDefined,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	ValidateNested
} from 'class-validator';

export class ProjectElement {
	@IsInt()
	id: number;

	@IsInt()
	typeId: number;

	@IsOptional()
	@IsInt()
	numOutputs: number;

	@IsOptional()
	@IsInt()
	numInputs: number;

	@IsDefined()
	@ValidateNested()
	pos: ProjectElementPos;

	@IsOptional()
	@ValidateNested()
	endPos: ProjectElementPos;

	@IsInt()
	rotation: number;

	@IsOptional()
	@IsInt()
	plugIndex: number;

	@IsOptional()
	@IsArray()
	@IsNumber({}, {each: true})
	options: number[];

	@IsOptional()
	@IsString()
	data: string;
}
