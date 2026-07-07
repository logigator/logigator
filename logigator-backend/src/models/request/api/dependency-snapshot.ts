import {
	IsArray,
	IsInt,
	IsOptional,
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

	/**
	 * Additive, optional — the id of the **local** (browser) library master this
	 * copy was frozen from, for a custom that was not uploaded to the cloud (so
	 * `ProjectMapping.id` is empty and no dependency row exists). Stored verbatim
	 * in the circuit blob and echoed back on read; the server never resolves it,
	 * validates ownership, or creates a dependency row from it. It lets the editor
	 * re-link an embedded local custom to the author's own local library so it
	 * stays editable there; on any other device it is simply an unknown id and the
	 * component remains an embedded copy. Kept lenient (a stored hint, not a
	 * reference) so a malformed value never blocks the save.
	 */
	@IsOptional()
	@IsString()
	@MaxLength(36)
	localId?: string;

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
