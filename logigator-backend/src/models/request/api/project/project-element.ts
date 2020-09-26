import {
	ArrayMaxSize,
	IsDefined,
	IsInt,
	IsNumber,
	IsOptional,
	MaxLength
} from 'class-validator';

export class ProjectElement {
	/**
	 * id
	 */
	@IsInt()
	c: number;

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
	@IsDefined()
	@ArrayMaxSize(2)
	@IsInt({each: true})
	p: number[];

	/**
	 * end-position
	 */
	@IsOptional()
	@ArrayMaxSize(2)
	@IsInt({each: true})
	q: number[];

	/**
	 * rotation
	 */
	@IsInt()
	r: number;

	@IsOptional()
	@IsInt()
	plugIndex: number;

	@IsOptional()
	@ArrayMaxSize(64)
	@IsNumber({}, {each: true})
	options: number[];

	/**
	 * optional data
	 */
	@IsOptional()
	@MaxLength(32768)
	d: string;
}
