import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {User} from "./user.entity";
import {IsBoolean} from "class-validator";

@Entity()
export class Shortcut {

	@PrimaryGeneratedColumn('uuid')
	id: string;

	// enum?
	@Column()
	name: string;

	@Column()
	keyCode: string;

	@Column({default: false})
	shift: boolean;

	@Column({default: false})
	ctrl: boolean;

	@Column({default: false})
	alt: boolean;

	@ManyToOne(type => User, object => object.shortcuts)
	user: User;
}
