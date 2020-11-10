import {IsNotEmpty, IsOptional, IsString} from 'class-validator';


export class DeleteDelete {

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	password: string;

}
