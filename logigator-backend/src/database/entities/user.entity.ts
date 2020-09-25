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

@Entity()
@Check(`(login_type = 'local' and password is not null) or (login_type != 'local')`)
export class User {

	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({nullable: false})
	username: string;

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

	@OneToOne(type => ProfilePicture, image => image.user, {cascade: true, eager: true})
	image: ProfilePicture;

	@OneToMany(type => Shortcut, object => object.user, {cascade: true})
	shortcuts: Promise<Shortcut[]>;

	@OneToMany(type => Project, object => object.user, {cascade: true})
	projects: Promise<Project[]>;

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
