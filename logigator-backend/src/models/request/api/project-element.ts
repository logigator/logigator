import {
	ArrayMaxSize, ArrayMinSize,
	IsArray,
	IsInt,
	IsNumber,
	IsOptional,
	MaxLength,
	Min
} from 'class-validator';

export class ProjectElement {

	/**
	 * typeId
	 */
	@IsInt()
	t: number;

	/**
	 * number of outputs
	 */
	@IsOptional()
	@IsInt()
	o: number;

	/**
	 * number of inputs
	 */
	@IsOptional()
	@IsInt()
	i: number;

	/**
	 * Position
	 */
	@ArrayMinSize(2)
	@ArrayMaxSize(2)
	@IsInt({each: true})
	p: number[];

	/**
	 * end-position
	 */
	@IsOptional()
	@ArrayMinSize(2)
	@ArrayMaxSize(2)
	@IsInt({each: true})
	q: number[];

	/**
	 * rotation
	 */
	@IsOptional()
	@IsInt()
	r: number;

	/**
	 * numerical data
	 */
	@IsOptional()
	@ArrayMaxSize(64)
	@IsNumber({}, {each: true})
	n: number[];

	/**
	 * string data
	 */
	@IsOptional()
	@MaxLength(32768)
	s: string;

	/**
	 * negated input-port indices (0-based within the input group)
	 */
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(256)
	@IsInt({each: true})
	@Min(0, {each: true})
	negInputs: number[];

	/**
	 * negated output-port indices (0-based within the output group)
	 */
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(256)
	@IsInt({each: true})
	@Min(0, {each: true})
	negOutputs: number[];
}
