import {
	IsArray,
	IsInt,
	IsNotEmpty,
	IsString,
	Length,
	MaxLength,
	NotContains,
	ValidateNested
} from 'class-validator';
import {Type} from 'class-transformer';
import {ProjectElement} from '../project-element';

class ComponentInfo {
	@IsInt()
	id: number;

	@IsInt()
	numInputs: number;

	@IsInt()
	numOutputs: number;

	@IsArray()
	@IsString({each: true})
	@Length(0, 5, {each: true})
	@NotContains(',', {each: true})
	labels: string[]

	@IsString()
	@MaxLength(20)
	name: string;

	@IsString()
	@MaxLength(2048)
	description: string;

	@IsString()
	@MaxLength(5)
	symbol: string;
}

class Project {
	@IsString()
	@MaxLength(40)
	name: string;

	@IsArray()
	@ValidateNested({each: true})
	@Type(() => ProjectElement)
	elements: ProjectElement[];
}

class Component {
	@ValidateNested()
	@Type(() => ComponentInfo)
	info: ComponentInfo;

	@IsArray()
	@ValidateNested({each: true})
	@Type(() => ProjectElement)
	elements: ProjectElement[];
}

export class ReportProject {
	@ValidateNested()
	@Type(() => Project)
	project: Project;

	@IsArray()
	@ValidateNested({each: true})
	@Type(() => Component)
	components: Component[];
}
