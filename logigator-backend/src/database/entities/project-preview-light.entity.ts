import {Entity, JoinColumn, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Exclude} from 'class-transformer';
import {Project} from './project.entity';

@Exclude({toPlainOnly: true})
@Entity()
export class ProjectPreviewLight extends PersistedResource {

	public mimeType = 'image/png';
	_cacheable = true;

	@OneToOne(type => Project, project => project.previewLight)
	@JoinColumn()
	project: Promise<Project>

}
