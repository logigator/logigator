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
import {Shortcut} from "./shortcut.entity";
import {Project} from "./project.entity";
import {Component} from "./component.entity";
import {Link} from "./link.entity";
import {ProfilePicture} from "./profile-picture.entity";
import {ProfilePictureRepository} from '../repositories/profile-picture.repository';

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

	@Column({
		type: 'enum',
		enum: ['local', 'google', 'twitter']
	})
	loginType: 'local'|'google'|'twitter';

	@OneToOne(type => ProfilePicture, image => image.user, {eager: true, cascade: true})
	image: ProfilePicture;

	@Column({default: false})
	localEmailVerified: boolean;

	@OneToMany(type => Shortcut, object => object.user, {cascade: true})
	shortcuts: Shortcut[];

	@OneToMany(type => Project, object => object.user, {cascade: true})
	projects: Project[];

	@OneToMany(type => Component, object => object.user, {cascade: true})
	components: Component[];

	@ManyToMany(type => Link, object => object.permits)
	permittedLinks: Link[];

	@BeforeRemove()
	private async removeImage() {
		await getCustomRepository(ProfilePictureRepository).remove(this.image);
	}

}
