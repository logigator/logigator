import {Service} from 'typedi';
import {User} from '../database/entities/user.entity';
import {Profile as GoogleProfile} from 'passport-google-oauth';
import {Profile as TwitterProfile} from 'passport-twitter';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {UserRepository} from '../database/repositories/user.repository';
import {ProfilePictureRepository} from '../database/repositories/profile-picture.repository';
import {compare, hash} from 'bcrypt';
import {FormDataError} from '../errors/form-data.error';
import {EmailService} from './email.service';
import {v4 as uuid} from 'uuid';
import {StandaloneViewService} from './standalone-view.service';
import {ConfigService} from './config.service';
import {TranslationService} from './translation.service';
import {RedisService} from './redis.service';
import {Transaction, TransactionRepository} from 'typeorm';
import {ComponentRepository} from '../database/repositories/component.repository';
import {ProjectRepository} from '../database/repositories/project.repository';

@Service()
export class UserService {

	private readonly PASSWORD_SALT_ROUNDS = 9;

	constructor(
		@InjectRepository() private userRepo: UserRepository,
		@InjectRepository() private profilePictureRepo: ProfilePictureRepository,
		private emailService: EmailService,
		private standaloneViewService: StandaloneViewService,
		private configService: ConfigService,
		private translationService: TranslationService,
		private redisService: RedisService
	) {}

	public async findOrCreateGoogleUser(profile: GoogleProfile): Promise<User> {
		let user = await this.userRepo.findOne({
			googleUserId: profile.id
		});

		if (user) {
			return user;
		}
		const existingUser = await this.userRepo.findOne({
			email: profile.emails[0].value
		});
		if (existingUser) {
			throw new Error('emailTaken');
		}

		user = this.userRepo.create();
		user.email = profile.emails[0].value;
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
			return user;
		}
		const existingUser = await this.userRepo.findOne({
			email: profile.emails[0].value
		});
		if (existingUser) {
			throw new Error('emailTaken');
		}

		user = this.userRepo.create();
		user.email = profile.emails[0].value;
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

		let newUser = this.userRepo.create();
		newUser.email = email;
		newUser.username = username;
		newUser.password = await hash(password, this.PASSWORD_SALT_ROUNDS);
		newUser.localEmailVerified = false;
		newUser = await this.userRepo.save(newUser);
		try {
			const code = await this.generateEmailVerificationCode(newUser.id, newUser.email);
			await this.sendRegisterVerificationMail(newUser, code, currentLang);
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

	public async resendVerificationMail(email: string, password: string, lang: string) {
		const user = await this.userRepo.findOne({
			email: email
		});
		if (!user?.password) {
			throw new FormDataError({email, password}, 'email', 'noUser', 'auth_local-login');
		}
		if (!(await compare(password, user.password))) {
			throw new FormDataError({email, password}, 'password', 'invalid', 'auth_local-login');
		}

		try {
			const code = await this.generateEmailVerificationCode(user.id, user.email);
			await this.sendRegisterVerificationMail(user, code, lang);
		} catch (error) {
			throw new Error('verification_mail');
		}

	}

	private async sendRegisterVerificationMail(user: User, code: string, lang: string) {
		const mail = await this.standaloneViewService.renderView('verification-mail-register', {
			username: user.username,
			verifyLink: `${this.configService.getConfig('domains').rootUrl}/verify-email/${code}`
		}, lang);
		await this.emailService.sendMail('noreply', user.email, this.translationService.getTranslation('MAILS.VERIFY_MAIL_REGISTER.SUBJECT', lang), mail);
	}

	private async sendEmailUpdateVerificationMail(username: string, newEmail: string, code: string, lang: string) {
		const mail = await this.standaloneViewService.renderView('verification-mail-email-update', {
			username: username,
			verifyLink: `${this.configService.getConfig('domains').rootUrl}/verify-email/${code}`
		}, lang);
		await this.emailService.sendMail('noreply', newEmail, this.translationService.getTranslation('MAILS.VERIFY_MAIL_EMAIL_UPDATE.SUBJECT', lang), mail);
	}

	private async generateEmailVerificationCode(userId: string, emailToVerify: string): Promise<string> {
		const code = uuid();
		await this.redisService.setObject(`verify-mail:${code}`, {
			userId: userId,
			email: emailToVerify
		}, 60 * 60);
		return code;
	}
	public async verifyEmail(code: string): Promise<void> {

		const verificationData = await  this.redisService.getObject(`verify-mail:${code}`);
		if (!(verificationData?.userId && verificationData?.email))
			throw new Error('verification_timeout');

		const user = await this.userRepo.findOne({
			id: verificationData.userId
		});

		if (!user)
			throw new Error('no_user');

		user.email = verificationData.email;
		user.localEmailVerified = true;
		await this.redisService.delete(`verify-mail:${code}`);
		await this.userRepo.save(user);
	}

	public updateUsername(user: User, newUsername: string): Promise<User> {
		user.username = newUsername.trim();
		return this.userRepo.save(user);
	}

	public async updateEmail(user: User, email: string, lang: string): Promise<boolean> {
		const existingUser = await this.userRepo.findOne({
			email: email
		});
		if (existingUser)
			return false;

		try {
			const code = await this.generateEmailVerificationCode(user.id, email);
			await this.sendEmailUpdateVerificationMail(user.username, email, code, lang);
		} catch (error) {
			throw new Error('verification_mail');
		}
		return true;
	}

	public async updatePassword(user: User, newPassword: string, currentPassword?: string): Promise<void> {
		if (user.password) {
			if (!(await compare(currentPassword, user.password))) {
				throw new Error('invalid_password');
			}
			user.password = await hash(newPassword, this.PASSWORD_SALT_ROUNDS);
			await this.userRepo.save(user);
			return;
		} else {
			user.password = await hash(newPassword, this.PASSWORD_SALT_ROUNDS);
			await this.userRepo.save(user);
			return;
		}
	}

	public connectTwitter(user: User, profile: TwitterProfile): Promise<User> {
		if (user.twitterUserId) {
			throw new Error('Already Connected');
		}
		user.twitterUserId = profile.id;
		return this.userRepo.save(user);
	}

	public connectGoogle(user: User, profile: GoogleProfile): Promise<User> {
		if (user.googleUserId) {
			throw new Error('Already Connected');
		}
		user.googleUserId = profile.id;
		return this.userRepo.save(user);
	}

	public async remove(user: User, password: string) {
		if (user.password) {
			if (!(await compare(password, user.password))) {
				throw new Error('invalid_password');
			}
		}
		await this.removeTransaction(user);
		await this.userRepo.remove(user);
	}

	@Transaction()
	private async removeTransaction(
		user: User,
		@TransactionRepository(ComponentRepository) compRepo?: ComponentRepository,
		@TransactionRepository(ProjectRepository) projRepo?: ProjectRepository,
		@TransactionRepository(UserRepository) userRepo?: UserRepository,
		@TransactionRepository(ProfilePictureRepository) profilePicRepo?: ProfilePictureRepository
	) {
		const components = await compRepo.find({
			where: {
				user
			}
		});
		await compRepo.remove(components);
		const projects = await projRepo.find({
			where: {
				user
			}
		});
		await projRepo.remove(projects);
		if (user.image) {
			await profilePicRepo.remove(user.image);
		}
	}

}
