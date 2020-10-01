import {
	BeforeRemove,
	Column,
	CreateDateColumn,
	Entity,
	Generated,
	getCustomRepository,
	ManyToOne,
	OneToMany,
	OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn
} from 'typeorm';
import {User} from './user.entity';
import {ProjectFile} from './project-file.entity';
import {ProjectFileRepository} from '../repositories/project-file.repository';
import {ProjectDependency} from './project-dependency.entity';
import {Exclude, Expose} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
export class Project {

	@Expose()
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Expose()
	@Column({nullable: false})
	name: string;

	@Expose()
	@Column({length: 2048, default: '', nullable: false})
	description: string;

	@Expose()
	@CreateDateColumn()
	createdOn: Date;

	@Expose()
	@UpdateDateColumn()
	lastEdited: Date;

	@Expose()
	@OneToOne(type => ProjectFile, projectFile => projectFile.project, {cascade: true, eager: true})
	projectFile: ProjectFile;

	@ManyToOne(type => User, object => object.projects, {nullable: false})
	user: Promise<User>;

	@Expose({name: 'user', groups: ['detailed']})
	private __user__: User;

	@Expose({groups: ['showShareLinks']})
	@Column()
	@Generated('uuid')
	link: string;

	@Expose()
	@Column({default: false, nullable: false})
	public: boolean;

	@ManyToOne(type => Project, object => object.forks, {nullable: true})
	forkedFrom: Promise<Project>;

	@Expose({name: 'forkedFrom'})
	private __forkedFrom__: Project;

	@OneToMany(type => Project, object => object.forkedFrom)
	forks: Promise<Project[]>;

	@Expose({name: 'forks', groups: ['detailed']})
	private __forks__: Project[];

	@OneToMany(type => ProjectDependency, object => object.dependent, {cascade: true})
	dependencies: Promise<ProjectDependency[]>;

	@Expose({name: 'dependencies', groups: ['detailed']})
	private __dependencies__: ProjectDependency[];

	@BeforeRemove()
	private async removeFile() {
		if (this.projectFile)
			await getCustomRepository(ProjectFileRepository).remove(this.projectFile);
	}
}
