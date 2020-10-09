import {Entity, JoinColumn, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Project} from './project.entity';
import {Exclude} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
export class ProjectFile extends PersistedResource {

	public mimeType = 'application/json';

	@Exclude()
	public get publicUrl() {
		return super.publicUrl;
	}

	@OneToOne(type => Project, project => project.elementsFile)
	@JoinColumn()
	project: Promise<Project>

}
