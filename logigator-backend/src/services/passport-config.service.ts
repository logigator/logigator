import {Service} from "typedi";
import passport from "passport";
import {OAuth2Strategy} from 'passport-google-oauth'
import {ConfigService} from "./config.service";
import {User} from "../database/entities/user.entity";
import {UserService} from "./user.service";

@Service()
export class PassportConfigService {

	constructor(private configService: ConfigService, private userService: UserService) {}

	public setupPassport() {
		this.setupGoogle();
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
}
