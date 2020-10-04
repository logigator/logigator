import {IsOptional, IsString} from 'class-validator';

export class ShareProject {

	@IsOptional()
	@IsString()
	public: string;
}
