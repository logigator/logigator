import {Service} from 'typedi';
import {User} from '../database/entities/user.entity';
import {Profile as GoogleProfile} from 'passport-google-oauth';
import {Profile as TwitterProfile} from 'passport-twitter';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {UserRepository} from '../database/repositories/user.repository';
import {UnauthorizedError} from 'routing-controllers';
import {ProfilePictureRepository} from '../database/repositories/profile-picture.repository';

@Service()
export class UserService {

	constructor(
		@InjectRepository() private userRepo: UserRepository,
		@InjectRepository() private profilePictureRepo: ProfilePictureRepository
	) {}

	public async findOrCreateGoogleUser(profile: GoogleProfile): Promise<User> {
		let user = await this.userRepo.findOne({
			email: profile.emails[0].value
		});

		if (user) {
			if (user.loginType !== 'google') {
				throw new UnauthorizedError('EMAIL_TAKEN');
			}
			user.username = profile.displayName;
			user.image = await this.profilePictureRepo.importFromUrlIfChanged(profile.photos[0].value, user.image);
			return this.userRepo.save(user);
		}
		user = this.userRepo.create();
		user.loginType = 'google';
		user.email = profile.emails[0].value;
		user.localEmailVerified = true;
		user.username = profile.displayName;
		user.image = await this.profilePictureRepo.importFromUrl(profile.photos[0].value);

		return this.userRepo.save(user);
	}

	public async findOrCreateTwitterUser(profile: TwitterProfile): Promise<User> {
		let user = await this.userRepo.findOne({
			email: profile.emails[0].value
		});
		if (user) {
			if (user.loginType !== 'twitter') {
				throw new UnauthorizedError('EMAIL_TAKEN');
			}
			user.username = profile.displayName;
			user.image = await this.profilePictureRepo.importFromUrlIfChanged(profile.photos[0].value, user.image);
			return this.userRepo.save(user);
		}
		user = this.userRepo.create();
		user.loginType = 'twitter';
		user.email = profile.emails[0].value;
		user.localEmailVerified = true;
		user.username = profile.displayName;
		user.image = await this.profilePictureRepo.importFromUrl(profile.photos[0].value);

		return this.userRepo.save(user);
	}

	public async getUserById(id: string): Promise<User> {
		return this.userRepo.findOne(id);
	}

}