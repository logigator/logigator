import {
	BeforeRemove,
	Check,
	Column,
	Entity, getCustomRepository,
	ManyToMany,
	OneToMany,
	OneToOne,
	PrimaryGeneratedColumn
} from 'typeorm';
import {Shortcut} from './shortcut.entity';
import {Project} from './project.entity';
import {Component} from './component.entity';
import {ProfilePicture} from './profile-picture.entity';
import {ProfilePictureRepository} from '../repositories/profile-picture.repository';
import {ProjectRepository} from '../repositories/project.repository';
import {ComponentRepository} from '../repositories/component.repository';
import {Exclude, Expose, Transform} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
@Check(`(login_type = 'local' and password is not null) or (login_type != 'local')`)
export class User {

	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Expose()
	@Column({nullable: false})
	username: string;

	@Expose({groups: ['privateUserData']})
	@Column({unique: true, nullable: false})
	email: string;

	@Column({nullable: true})
	password: string;

	@Column({nullable: true, unique: true})
	googleUserId: string;

	@Column({nullable: true, unique: true})
	twitterUserId: string;

	@Column({nullable: true})
	localEmailVerificationCode: string;

	@Expose()
	@OneToOne(type => ProfilePicture, image => image.user, {cascade: true, eager: true})
	image: ProfilePicture;

	@OneToMany(type => Shortcut, object => object.user, {cascade: true})
	shortcuts: Promise<Shortcut[]>;

	@Expose({name: 'shortcuts', groups: ['privateUserData']})
	private __shortcuts__: Shortcut[];

	@OneToMany(type => Project, object => object.user, {cascade: true})
	projects: Promise<Project[]>;

	@Expose({name: 'projects', groups: ['privateUserData', 'extendedUserData']})
	@Transform((x: Project[]) => {
		return x ?? x.filter(p => p.public);
	}, {groups: ['extendedUserData']})
	private __projects__: Project[];

	@OneToMany(type => Component, object => object.user, {cascade: true})
	components: Promise<Component[]>;

	@Expose({name: 'components', groups: ['privateUserData', 'extendedUserData']})
	@Transform((x: Component[]) => {
		return x ?? x.filter(p => p.public);
	}, {groups: ['extendedUserData']})
	private __components__: Component[];

	@BeforeRemove()
	private async removeFile() {
		return Promise.all([
			getCustomRepository(ProjectRepository).remove(await this.projects),
			getCustomRepository(ComponentRepository).remove(await this.components),
			() => {
				if (this.image)
					return getCustomRepository(ProfilePictureRepository).remove(this.image);
				return Promise.resolve();
			}
		]);
	}

}
