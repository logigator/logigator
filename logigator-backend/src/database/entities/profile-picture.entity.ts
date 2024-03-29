import {Entity, JoinColumn, OneToOne} from 'typeorm';
import {PersistedResource} from './persisted-resource.entity';
import {User} from './user.entity';
import {Exclude} from 'class-transformer';

@Exclude({toPlainOnly: true})
@Entity()
export class ProfilePicture extends PersistedResource {

	protected _path = 'public/profile';
	protected _cacheable = true;

	@OneToOne(() => User, user => user.image, {onDelete: 'CASCADE', onUpdate: 'CASCADE'})
	@JoinColumn()
	user: Promise<User>;

}
