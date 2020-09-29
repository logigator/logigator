import {
	BeforeRemove,
	Column,
	CreateDateColumn,
	Entity, Generated, getCustomRepository, JoinColumn,
	ManyToOne,
	OneToMany, OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn, VersionColumn
} from 'typeorm';
import {User} from './user.entity';
import {ComponentFile} from './component-file.entity';
import {ComponentFileRepository} from '../repositories/component-file.repository';
import {ComponentDependency} from './component-dependency.entity';
import {ProjectDependency} from './project-dependency.entity';
import {Exclude, Expose} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
export class Component {

	@Expose()
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Expose()
	@Column()
	name: string;

	@Expose()
	@Column({length: 2048, default: ''})
	description: string;

	@Expose()
	@CreateDateColumn()
	createdOn: Date;

	@Expose()
	@UpdateDateColumn()
	lastEdited: Date;

	@Expose()
	@OneToOne(type => ComponentFile, componentFile => componentFile.component, {cascade: true, eager: true})
	@JoinColumn()
	componentFile: ComponentFile;

	@Expose()
	@Column({length: 10})
	symbol: string;

	@Expose()
	@Column()
	numInputs: number;

	@Expose()
	@Column()
	numOutputs: number;

	@Expose()
	@Column('simple-array')
	labels: string[];

	@OneToMany(type => ComponentDependency, object => object.dependent)
	dependencies: Promise<ComponentDependency[]>;

	@Expose({name: 'dependencies', groups: ['detailed']})
	private __dependencies__: ComponentDependency[];

	@OneToMany(type => ComponentDependency, object => object.dependency)
	dependencyForComponents: Promise<ComponentDependency[]>;

	@Expose({name: 'dependencyForComponents', groups: ['detailed']})
	private __dependencyForComponents__: ComponentDependency[];

	@OneToMany(type => ProjectDependency, object => object.dependency)
	dependencyForProjects: Promise<ProjectDependency[]>;

	@Expose({name: 'dependencyForProjects', groups: ['detailed']})
	private __dependencyForProjects__: ProjectDependency[];

	@ManyToOne(type => User, object => object.components)
	user: Promise<User>;

	@Expose({groups: ['showShareLinks']})
	@Column({nullable: false})
	@Generated('uuid')
	link: string;

	@Expose()
	@Column({default: false, nullable: false})
	public: boolean;

	@ManyToOne(type => Component, object => object.forks, {nullable: true})
	forkedFrom: Promise<Component>;

	@Expose({name: 'forkedFrom'})
	private __forkedFrom__: Component;

	@OneToMany(type => Component, object => object.forkedFrom)
	forks: Promise<Component[]>;

	@Expose({name: 'forks', groups: ['detailed']})
	private __forks__: Component[];

	@BeforeRemove()
	private async removeFile() {
		if (this.componentFile)
			await getCustomRepository(ComponentFileRepository).remove(this.componentFile);
	}
}
