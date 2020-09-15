import {
	Column,
	CreateDateColumn,
	Entity,
	ManyToOne,
	OneToMany, OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn, VersionColumn
} from 'typeorm';
import {User} from "./user.entity";
import {Link} from "./link.entity";

@Entity()
export class Project {

	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({nullable: false})
	name: string;

	@Column({length: 2048, default: ''})
	description: string;

	@CreateDateColumn()
	createdOn: Date;

	@UpdateDateColumn()
	lastEdited: Date;

	@ManyToOne(type => User, object => object.projects)
	user: User;

	@OneToOne(type => Link, object => object.project, {nullable: true})
	link: Link;

	@ManyToOne(type => Project, object => object.forks, {nullable: true})
	forkedFrom: Project;

	@OneToMany(type => Project, object => object.forkedFrom)
	forks: Project[];

	@VersionColumn()
	version: number;
}
