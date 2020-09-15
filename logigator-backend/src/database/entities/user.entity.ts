import {Check, Column, Entity, ManyToMany, OneToMany, PrimaryGeneratedColumn} from 'typeorm';
import {Shortcut} from "./shortcut.entity";
import {Project} from "./project.entity";
import {Component} from "./component.entity";
import {Link} from "./link.entity";

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
}
