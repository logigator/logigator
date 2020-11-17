import {Entity, JoinColumn, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Exclude} from 'class-transformer';
import {Project} from './project.entity';

@Exclude({toPlainOnly: true})
@Entity()
export class ProjectPreviewDark extends PersistedResource {

	public mimeType = 'image/png';

	@OneToOne(type => Project, project => project.previewDark)
	@JoinColumn()
	project: Promise<Project>

}
