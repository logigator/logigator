import {Service} from 'typedi';
import passport from 'passport';
import {OAuth2Strategy} from 'passport-google-oauth';
import {ConfigService} from './config.service';
import {User} from '../database/entities/user.entity';
import {UserService} from './user.service';
import {Strategy as TwitterStrategy} from 'passport-twitter';
import {Strategy as LocalStrategy} from 'passport-local';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {UserRepository} from '../database/repositories/user.repository';
import {FormDataError} from '../errors/form-data.error';
import {Request} from 'express';

@Service()
export class PassportConfigService {

	constructor(
		private configService: ConfigService,
		private userService: UserService,
		@InjectRepository() private userRepo: UserRepository
	) {}

	public setupPassport() {
		this.setupGoogle();
		this.setupTwitter();
		this.setupLocal();
		this.setupSessions();
	}

	private setupSessions() {
		passport.serializeUser((user: User, done) => {
			done(null, user.id);
		});
		passport.deserializeUser(async (id: string, done) => {
			const user = await this.userRepo.findOne(id);
			done(null, user);
		});
	}

	private setupGoogle() {
		passport.use(new OAuth2Strategy({
			...this.configService.getConfig('passport').google,
			passReqToCallback: true
		},
		async (request, accessToken, refreshToken, profile, done) => {
			if (request.isAuthenticated()) {
				try {
					request.res.locals.connectedAccounts = true;
					const user = await this.userService.connectGoogle(request.user, profile);
					done(null, user, {connectedAccounts: true});
					return;
				} catch (e) {
					done(new FormDataError({}, undefined, 'unknown', 'my_account_security_connect-account'));
					return;
				}
			}

			try {
				const user = await this.userService.findOrCreateGoogleUser(profile);
				done(null, user);
			} catch (error) {
				const formName = this.getOauthErrorFormName(request);
				if (error.message === 'emailTaken') {
					done(new FormDataError({}, undefined, 'emailTaken', formName));
				} else {
					done(new FormDataError({}, undefined, 'unknown', formName));
				}
			}
		}
		));
	}

	private setupTwitter() {
		passport.use(new TwitterStrategy(
			{
				...this.configService.getConfig('passport').twitter,
				includeEmail: true,
				includeEntities: false,
				includeStatus: false,
				forceLogin: true,
				passReqToCallback: true
			},
			async (request, accessToken, refreshToken, profile, done) => {
				if (request.isAuthenticated()) {
					try {
						request.res.locals.connectedAccounts = true;
						const user = await this.userService.connectTwitter(request.user, profile);
						done(null, user, {connectedAccounts: true});
						return;
					} catch (e) {
						done(new FormDataError({}, undefined, 'unknown', 'my_account_security_connect-account'));
						return;
					}
				}

				try {
					const user = await this.userService.findOrCreateTwitterUser(profile);
					done(null, user);
				} catch (error) {
					const formName = this.getOauthErrorFormName(request);
					if (error.message === 'emailTaken') {
						done(new FormDataError({}, undefined, 'emailTaken', formName));
					} else {
						done(new FormDataError({}, undefined, 'unknown', formName));
					}
				}
			}
		));
	}

	private setupLocal() {
		passport.use(new LocalStrategy(
			{
				passwordField: 'password',
				usernameField: 'email'
			},
			async (email, password, done) => {
				try {
					const user = await this.userService.validateLocalUser(email, password);
					done(null, user);
				} catch (error) {
					done(error);
				}
			}
		));
	}

	private getOauthErrorFormName(request: Request): string {
		switch (request.query.state) {
			case 'login-page':
				return 'auth_local-login-page';
			case 'login-electron':
				return 'auth_local-login-electron';
			case 'register-page':
				return 'auth_local-register-page';
			case 'register':
				return 'auth_local-register';
			default:
				return 'auth_local-login';
		}
	}
}
