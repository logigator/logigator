import {Entity, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {Project} from './project.entity';

@Entity()
export class ProjectFile extends PersistedResource {

	@OneToOne(type => Project, project => project.projectFile)
	project: Project

}
