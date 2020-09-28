import {Entity, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Project} from './project.entity';
import {Exclude} from 'class-transformer';

@Entity()
export class ProjectFile extends PersistedResource {

	@Exclude()
	public get publicUrl() {
		return super.publicUrl;
	}

	@OneToOne(type => Project, project => project.projectFile)
	project: Promise<Project>

}
