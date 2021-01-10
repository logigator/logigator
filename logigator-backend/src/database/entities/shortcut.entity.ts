import {Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique} from 'typeorm';
import {User} from './user.entity';
import {Exclude, Expose} from 'class-transformer';

@Exclude()
@Entity()
@Unique(['name', 'user'])
export class Shortcut {

	@PrimaryGeneratedColumn('uuid')
	id: string;

	// enum?
	@Expose()
	@Column({nullable: false})
	name: string;

	@Expose()
	@Column({nullable: false})
	keyCode: string;

	@Expose()
	@Column({default: false, nullable: false})
	shift: boolean;

	@Expose()
	@Column({default: false, nullable: false})
	ctrl: boolean;

	@Expose()
	@Column({default: false, nullable: false})
	alt: boolean;

	@ManyToOne(type => User, object => object.shortcuts, {nullable: false, onDelete: 'CASCADE', onUpdate: 'CASCADE'})
	user: Promise<User>;
}
