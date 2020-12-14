import {
	ArrayMaxSize, ArrayMinSize,
	IsInt,
	IsNumber,
	IsOptional,
	MaxLength
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
}
