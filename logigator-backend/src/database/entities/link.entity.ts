import {
	Check,
	Column,
	Entity,
	JoinColumn,
	JoinTable,
	ManyToMany,
	OneToOne,
	PrimaryGeneratedColumn
} from 'typeorm';
import {Project} from "./project.entity";
import {Component} from "./component.entity";
import {User} from "./user.entity";

@Entity()
@Check(`(project is not null and component is null) or (project is null and component is not null)`)
export class Link {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	isPublic: boolean;

	@OneToOne(type => Project, object => object.link, {nullable: true})
	@JoinColumn()
	project: Project;

	@OneToOne(type => Component, object => object.link, {nullable: true})
	@JoinColumn()
	component: Component;

	@ManyToMany(type => User, object => object.permittedLinks)
	@JoinTable()
	permits: User[];
}
