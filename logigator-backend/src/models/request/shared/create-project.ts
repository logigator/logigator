import {IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength} from 'class-validator';

export class CreateProject {

	@IsString()
	@IsNotEmpty()
	@MaxLength(20)
	name: string;

	@IsString()
	@IsOptional()
	@MaxLength(2048)
	description: string;

	@IsOptional()
	@IsString()
	public: string;

	/**
	 * Id of the project this upload is a fork of (a re-import of an exported
	 * fork). The server resolves the referenced project itself and links
	 * `forkedFrom` only when it exists — the claim grants attribution to the
	 * origin's real author, never a client-supplied name. Sent by the new
	 * editor only; absent on old-editor and HTML-form creates.
	 */
	@IsOptional()
	@IsUUID()
	forkedFrom: string;

}
