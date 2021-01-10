import {Entity, JoinColumn, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Project} from './project.entity';
import {Exclude} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
export class ProjectFile extends PersistedResource {

	public mimeType = 'application/json';
	protected _path = 'private/projects';


	@Exclude()
	public get publicUrl() {
		return super.publicUrl;
	}

	@OneToOne(type => Project, project => project.elementsFile, {onDelete: 'CASCADE', onUpdate: 'CASCADE'})
	@JoinColumn()
	project: Promise<Project>

}
