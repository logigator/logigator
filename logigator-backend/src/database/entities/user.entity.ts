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

@Entity()
@Check(`(login_type = 'local' and password is not null) or (login_type != 'local')`)
export class User {

	@Exclude()
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({nullable: false})
	username: string;

	@Expose({groups: ['privateUserData']})
	@Column({unique: true, nullable: false})
	email: string;

	@Exclude()
	@Column({nullable: true})
	password: string;

	@Exclude()
	@Column({nullable: true, unique: true})
	googleUserId: string;

	@Exclude()
	@Column({nullable: true, unique: true})
	twitterUserId: string;

	@Exclude()
	@Column({nullable: true})
	localEmailVerificationCode: string;

	@OneToOne(type => ProfilePicture, image => image.user, {cascade: true, eager: true})
	image: ProfilePicture;

	@Expose({groups: ['privateUserData']})
	@OneToMany(type => Shortcut, object => object.user, {cascade: true})
	shortcuts: Promise<Shortcut[]>;

	@Expose({groups: ['privateUserData', 'extendedUserData']})
	@Transform(x => {
		if (x instanceof Array)
			return (x as Project[]).filter(p => p.public);
		return x;
	}, {toPlainOnly: true, groups: ['extendedUserData']})
	@OneToMany(type => Project, object => object.user, {cascade: true})
	projects: Promise<Project[]>;

	@Expose({groups: ['privateUserData', 'extendedUserData']})
	@Transform(x => {
		if (x instanceof Array)
			return (x as Component[]).filter(p => p.public);
		return x;
	}, {toPlainOnly: true, groups: ['extendedUserData']})
	@OneToMany(type => Component, object => object.user, {cascade: true})
	components: Promise<Component[]>;

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
