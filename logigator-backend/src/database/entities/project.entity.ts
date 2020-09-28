import {
	BeforeRemove,
	Column,
	CreateDateColumn,
	Entity, Generated, getCustomRepository, JoinColumn,
	ManyToOne,
	OneToMany, OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn
} from 'typeorm';
import {User} from './user.entity';
import {ProjectFile} from './project-file.entity';
import {ProjectFileRepository} from '../repositories/project-file.repository';
import {ProjectDependency} from './project-dependency.entity';
import {Expose} from 'class-transformer';

@Entity()
export class Project {

	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({nullable: false})
	name: string;

	@Column({length: 2048, default: '', nullable: false})
	description: string;

	@CreateDateColumn()
	createdOn: Date;

	@UpdateDateColumn()
	lastEdited: Date;

	@OneToOne(type => ProjectFile, projectFile => projectFile.project, {cascade: true, eager: true})
	@JoinColumn()
	projectFile: ProjectFile;

	@ManyToOne(type => User, object => object.projects, {nullable: false})
	user: Promise<User>;

	@Expose({groups: ['showShareLinks']})
	@Column()
	@Generated('uuid')
	link: string;

	@Column({default: false, nullable: false})
	public: boolean;

	@ManyToOne(type => Project, object => object.forks, {nullable: true})
	forkedFrom: Promise<Project>;

	@OneToMany(type => Project, object => object.forkedFrom)
	forks: Promise<Project[]>;

	@OneToMany(type => ProjectDependency, object => object.dependent, {cascade: true})
	dependencies: Promise<ProjectDependency[]>;

	@BeforeRemove()
	private async removeFile() {
		if (this.projectFile)
			await getCustomRepository(ProjectFileRepository).remove(this.projectFile);
	}
}
