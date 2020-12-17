import {Entity, JoinColumn, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {User} from './user.entity';
import {Exclude} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
export class ProfilePicture extends PersistedResource {

	_cacheable = true;

	@OneToOne(type => User, user => user.image, {onDelete: 'CASCADE', onUpdate: 'CASCADE'})
	@JoinColumn()
	user: Promise<User>;

}
