import {IsInt, IsOptional, IsString, IsUUID, ValidateIf, ValidateNested} from 'class-validator';
import {Type} from 'class-transformer';
import {DependencySnapshot} from './dependency-snapshot';

export class ProjectMapping {
	/**
	 * The library master's id, or an empty string for a custom that only exists
	 * locally (never uploaded to the library). Empty-id mappings create no
	 * dependency row — they are carried solely by their embedded `snapshot`.
	 */
	@IsString()
	@ValidateIf(o => o.id !== '')
	@IsUUID()
	id: string;

	@IsInt()
	model: number;

	/**
	 * Additive — the frozen embedded circuit. Absent for non-custom dependencies
	 * and for old write clients (which render the always-latest library master).
	 */
	@IsOptional()
	@ValidateNested()
	@Type(() => DependencySnapshot)
	snapshot: DependencySnapshot;
}
