import {Entity, JoinColumn, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Exclude} from 'class-transformer';
import {Project} from './project.entity';

@Exclude({toPlainOnly: true})
@Entity()
export class ProjectPreviewDark extends PersistedResource {

	public mimeType = 'image/png';
	_cacheable = true;

	@OneToOne(type => Project, project => project.previewDark, {onUpdate: 'CASCADE', onDelete: 'CASCADE'})
	@JoinColumn()
	project: Promise<Project>

}
