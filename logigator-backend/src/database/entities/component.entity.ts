import {
	Column,
	CreateDateColumn,
	Entity,
	ManyToOne,
	OneToMany, OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn, VersionColumn
} from 'typeorm';
import {User} from './user.entity';
import {Link} from './link.entity';


@Entity()
export class Component {

	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column()
	name: string;

	@Column({length: 2048, default: ''})
	description: string;

	@CreateDateColumn()
	createdOn: Date;

	@UpdateDateColumn()
	lastEdited: Date;

	@Column()
	symbol: string;

	@Column()
	numInputs: number;

	@Column()
	numOutputs: number;

	@Column({length: 3072})
	labels: string;

	@ManyToOne(type => User, object => object.components)
	user: User;

	@OneToOne(type => Link, object => object.component, {nullable: true})
	link: Link;

	@ManyToOne(type => Component, object => object.forks, {nullable: true})
	forkedFrom: Component;

	@OneToMany(type => Component, object => object.forkedFrom)
	forks: Component[];

	@VersionColumn()
	version: number;
}
