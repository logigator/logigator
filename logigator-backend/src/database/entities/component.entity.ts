import {
	BeforeRemove,
	Column,
	CreateDateColumn,
	Entity,
	Generated,
	getCustomRepository, JoinTable, ManyToMany,
	ManyToOne,
	OneToMany,
	OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn
} from 'typeorm';
import {User} from './user.entity';
import {ComponentFile} from './component-file.entity';
import {ComponentFileRepository} from '../repositories/component-file.repository';
import {ComponentDependency} from './component-dependency.entity';
import {ProjectDependency} from './project-dependency.entity';
import {Exclude, Expose} from 'class-transformer';
import {ComponentPreviewDark} from './component-preview-dark.entity';
import {ComponentPreviewLight} from './component-preview-light.entity';

@Exclude({toPlainOnly: true})
@Entity()
export class Component {

	@Expose()
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Expose()
	@Column({length: 20, nullable: false})
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
	@OneToOne(type => ComponentFile, componentFile => componentFile.component, {cascade: true, eager: true})
	elementsFile: ComponentFile;

	@Expose()
	@Column({length: 5, nullable: false})
	symbol: string;

	@Expose()
	@Column({nullable: false, default: 0})
	numInputs: number;

	@Expose()
	@Column({nullable: false, default: 0})
	numOutputs: number;

	@Expose()
	@Column('simple-array', {nullable: false})
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

	@ManyToOne(type => User, object => object.components, {nullable: false, onUpdate: 'CASCADE', onDelete: 'CASCADE'})
	user: Promise<User>;

	@Expose({name: 'user', groups: ['detailed']})
	private __user__: User;

	@Expose()
	@OneToOne(type => ComponentPreviewDark, previewDark => previewDark.component, {cascade: true, eager: true})
	previewDark: ComponentPreviewDark;

	@Expose()
	@OneToOne(type => ComponentPreviewLight, previewLight => previewLight.component, {cascade: true, eager: true})
	previewLight: ComponentPreviewLight;

	@Expose({groups: ['showShareLinks']})
	@Column({nullable: false})
	@Generated('uuid')
	link: string;

	@Expose()
	@Column({default: false, nullable: false})
	public: boolean;

	@ManyToOne(type => Component, object => object.forks, {nullable: true, onDelete: 'SET NULL'})
	forkedFrom: Promise<Component>;

	@Expose({name: 'forkedFrom'})
	private __forkedFrom__: Component;

	@OneToMany(type => Component, object => object.forkedFrom)
	forks: Promise<Component[]>;

	@Expose({name: 'forks', groups: ['detailed']})
	private __forks__: Component[];

	@ManyToMany(() => User, user => user.staredComponents)
	@JoinTable()
	stargazers: Promise<User[]>;

	stargazersCount: number;

	@BeforeRemove()
	private async removeFile() {
		if (this.elementsFile)
			await getCustomRepository(ComponentFileRepository).remove(this.elementsFile);
	}
}
