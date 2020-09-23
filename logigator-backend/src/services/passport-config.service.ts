import {Service} from 'typedi';
import passport from 'passport';
import {OAuth2Strategy} from 'passport-google-oauth';
import {ConfigService} from './config.service';
import {User} from '../database/entities/user.entity';
import {UserService} from './user.service';
import {Strategy as TwitterStrategy} from 'passport-twitter';
import {Strategy as LocalStrategy} from 'passport-local';

@Service()
export class PassportConfigService {

	constructor(private configService: ConfigService, private userService: UserService) {}

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
			const user = await this.userService.getUserById(id);
			done(null, user);
		});
	}

	private setupGoogle() {
		passport.use(new OAuth2Strategy(
			this.configService.getConfig('passport').google,
			async (accessToken, refreshToken, profile, done) => {
				const user = await this.userService.findOrCreateGoogleUser(profile);
				done(null, user, null);
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
				forceLogin: true
			},
			async (accessToken, refreshToken, profile, done) => {
				const user = await this.userService.findOrCreateTwitterUser(profile);
				done(null, user);
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
}
