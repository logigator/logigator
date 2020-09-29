import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {User} from './user.entity';
import {Exclude, Expose} from 'class-transformer';

@Exclude()
@Entity()
export class Shortcut {

	@PrimaryGeneratedColumn('uuid')
	id: string;

	// enum?
	@Expose()
	@Column()
	name: string;

	@Expose()
	@Column()
	keyCode: string;

	@Expose()
	@Column({default: false})
	shift: boolean;

	@Expose()
	@Column({default: false})
	ctrl: boolean;

	@Expose()
	@Column({default: false})
	alt: boolean;

	@ManyToOne(type => User, object => object.shortcuts)
	user: Promise<User>;
}
