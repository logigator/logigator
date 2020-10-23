import {
	IsArray,
	IsEmail,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	MinLength,
	ValidateNested
} from 'class-validator';
import {Type} from 'class-transformer';
import {Shortcut} from './shortcut';
import {UniqueProperty} from '../../../../validators/unique-property.validator';

export class UpdateUser {
	@IsOptional()
	@IsString()
	@MinLength(2)
	@MaxLength(20)
	@Matches(/^[a-zA-Z0-9_-]+$/)
	username: string;

	@IsOptional()
	@IsNotEmpty()
	@MinLength(8)
	@Matches(/^(?=.*[A-Za-z])(?=.*[0-9]).*$/)
	password: string;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	current_password: string;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@IsEmail()
	email: string;

	@IsOptional()
	@IsArray()
	@ValidateNested({each: true})
	@Type(() => Shortcut)
	@UniqueProperty('name')
	shortcuts: Shortcut[];
}
