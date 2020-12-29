import {
	BeforeRemove,
	Column,
	CreateDateColumn,
	Entity,
	Generated,
	getCustomRepository, ManyToMany,
	ManyToOne,
	OneToMany,
	OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
	JoinTable
} from 'typeorm';
import {User} from './user.entity';
import {ProjectFile} from './project-file.entity';
import {ProjectFileRepository} from '../repositories/project-file.repository';
import {ProjectDependency} from './project-dependency.entity';
import {Exclude, Expose} from 'class-transformer';
import {ProjectPreviewDark} from './project-preview-dark.entity';
import {ProjectPreviewLight} from './project-preview-light.entity';

@Exclude({toPlainOnly: true})
@Entity()
export class Project {

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
	@OneToOne(type => ProjectFile, projectFile => projectFile.project, {cascade: true, eager: true})
	elementsFile: ProjectFile;

	@ManyToOne(type => User, object => object.projects, {nullable: false, onDelete: 'CASCADE', onUpdate: 'CASCADE'})
	user: Promise<User>;

	@Expose({name: 'user', groups: ['detailed']})
	private __user__: User;

	@Expose()
	@OneToOne(type => ProjectPreviewDark, previewDark => previewDark.project, {cascade: true, eager: true})
	previewDark: ProjectPreviewDark;

	@Expose()
	@OneToOne(type => ProjectPreviewLight, previewLight => previewLight.project, {cascade: true, eager: true})
	previewLight: ProjectPreviewLight;

	@Expose({groups: ['showShareLinks']})
	@Column({nullable: false})
	@Generated('uuid')
	link: string;

	@Expose()
	@Column({default: false, nullable: false})
	public: boolean;

	@ManyToOne(type => Project, object => object.forks, {nullable: true, onDelete: 'SET NULL'})
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

	@ManyToMany(() => User, user => user.staredProjects)
	@JoinTable()
	stargazers: Promise<User[]>

	stargazersCount: number;

	@BeforeRemove()
	private async removeFile() {
		if (this.elementsFile)
			await getCustomRepository(ProjectFileRepository).remove(this.elementsFile);
	}
}
