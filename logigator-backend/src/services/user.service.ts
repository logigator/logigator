import {Service} from 'typedi';
import {User} from '../database/entities/user.entity';
import {Profile as GoogleProfile} from 'passport-google-oauth';
import {Profile as TwitterProfile} from 'passport-twitter';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {UserRepository} from '../database/repositories/user.repository';
import {ProfilePictureRepository} from '../database/repositories/profile-picture.repository';
import {hash, compare} from 'bcrypt';
import {FormDataError} from '../errors/form-data.error';
import {EmailService} from './email.service';

@Service()
export class UserService {

	private readonly PASSWORD_SALT_ROUNDS = 9;

	constructor(
		@InjectRepository() private userRepo: UserRepository,
		@InjectRepository() private profilePictureRepo: ProfilePictureRepository,
		private emailService: EmailService
	) {}

	public async findOrCreateGoogleUser(profile: GoogleProfile): Promise<User> {
		let user = await this.userRepo.findOne({
			googleUserId: profile.id
		});

		if (user) {
			user.username = profile.displayName;
			user.image = await this.profilePictureRepo.importFromUrlIfChanged(profile.photos[0].value, user.image);
			return this.userRepo.save(user);
		}
		const existingUser = await this.userRepo.findOne({
			email: profile.emails[0].value
		});
		if (existingUser) {
			throw new FormDataError({}, undefined, 'emailTaken', 'auth_local-login');
		}

		user = this.userRepo.create();
		user.email = profile.emails[0].value;
		user.localEmailVerified = true;
		user.username = profile.displayName;
		user.googleUserId = profile.id;
		user.image = await this.profilePictureRepo.importFromUrl(profile.photos[0].value);

		return this.userRepo.save(user);
	}

	public async findOrCreateTwitterUser(profile: TwitterProfile): Promise<User> {
		let user = await this.userRepo.findOne({
			twitterUserId: profile.id
		});
		if (user) {
			user.username = profile.displayName;
			user.image = await this.profilePictureRepo.importFromUrlIfChanged(profile.photos[0].value, user.image);
			return this.userRepo.save(user);
		}
		const existingUser = await this.userRepo.findOne({
			email: profile.emails[0].value
		});
		if (existingUser) {
			throw new FormDataError({}, undefined, 'emailTaken', 'auth_local-login');
		}

		user = this.userRepo.create();
		user.email = profile.emails[0].value;
		user.localEmailVerified = true;
		user.username = profile.displayName;
		user.twitterUserId = profile.id;
		user.image = await this.profilePictureRepo.importFromUrl(profile.photos[0].value);

		return this.userRepo.save(user);
	}

	/**
	 * @return true on success, false on error (email already in use)
	 */
	public async createLocalUser(username: string, email: string, password: string, currentLang: string): Promise<boolean> {
		const user = await this.userRepo.findOne({
			email: email
		});
		if (user)
			return false;

		const newUser = this.userRepo.create();
		newUser.email = email;
		newUser.username = username;
		newUser.password = await hash(password, this.PASSWORD_SALT_ROUNDS);
		// TODO: gen verification token
		await this.userRepo.save(newUser);
		try {
			await this.sendVerificationMail(newUser, currentLang);
		} catch (error) {
			throw new Error('verification_mail');
		}
		return true;
	}

	public async validateLocalUser(email: string, password: string): Promise<User> {
		const user = await this.userRepo.findOne({
			email: email
		});
		if (!user?.password) {
			throw new FormDataError({email, password}, 'email', 'noUser');
		}
		if (!(await compare(password, user.password))) {
			throw new FormDataError({email, password}, 'password', 'invalid');
		}
		if (!user.localEmailVerified) {
			throw new FormDataError({email, password}, 'email', 'notVerified');
		}
		return user;
	}

	private async sendVerificationMail(user: User, lang: string) {
		await this.emailService.sendMail('noreply', user.email, 'Test mail', '<p>Test 123</p>');
	}

	public async getUserById(id: string): Promise<User> {
		return this.userRepo.findOne(id);
	}

}
