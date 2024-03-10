import {Entity, JoinColumn, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Exclude} from 'class-transformer';
import {Project} from './project.entity';

@Exclude({toPlainOnly: true})
@Entity()
export class ProjectPreviewLight extends PersistedResource {

	public mimeType = 'image/png';
	protected _path = 'public/preview/light';
	protected _cacheable = true;

	@OneToOne(() => Project, project => project.previewLight, {onDelete: 'CASCADE', onUpdate: 'CASCADE'})
	@JoinColumn()
	project: Promise<Project>

}
