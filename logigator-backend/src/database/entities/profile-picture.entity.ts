import {Entity, JoinColumn, OneToOne} from "typeorm";
import {PersistedResource} from "./persisted-resource.entity";
import {User} from "./user.entity";

@Entity()
export class ProfilePicture extends PersistedResource {

	@OneToOne(type => User, user => user.image)
	@JoinColumn()
	user: User;

}
