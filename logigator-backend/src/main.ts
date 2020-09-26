import 'reflect-metadata';
import {useContainer as useContainerRC, useExpressServer} from 'routing-controllers';
import {createConnection, useContainer as typeOrmUseContainer, ConnectionOptions} from 'typeorm';
import {useContainer as classValidatorUseContainer} from 'class-validator';
import express, {urlencoded, static as expressStatic, Request} from 'express';
import {Container} from 'typedi';
import * as exphbs from 'express-handlebars';
import {HomeController} from './controller/frontend/home.controller';
import {ConfigService} from './services/config.service';
import * as path from 'path';
import {AuthController} from './controller/frontend/auth.controller';
import passport from 'passport';
import session from 'express-session';
import {PassportConfigService} from './services/passport-config.service';
import cookieParser from 'cookie-parser';
import {ErrorHandlerMiddleware} from './middleware/global/error-handler.middleware';
import {ProjectController} from './controller/api/project.controller';
import connectRedis from 'connect-redis';
import {RedisService} from './services/redis.service';
import {PreferencesController} from './controller/frontend/preferences.controller';
import {NotFoundMiddleware} from './middleware/global/not-found.middleware';
import {DefaultSessionMiddleware} from './middleware/global/default-session.middleware';
import {GlobalViewDataMiddleware} from './middleware/global/global-view-data.middleware';
import {UserDataMiddleware} from './middleware/global/user-data.middleware';
import {handlebarsHelpers} from './handlebars-helper/helpers';
import {ImprintController} from './controller/frontend/imprint.controller';
import {PrivacyPolicyController} from './controller/frontend/privacy-policy.controller';
import compression from 'compression';
import {TranslationMiddleware} from './middleware/global/translation.middleware';
import {VerifyEmailController} from './controller/frontend/verify-email.controller';
import {FeaturesController} from './controller/frontend/features.controller';
import bodyParser from 'body-parser';

useContainerRC(Container);
typeOrmUseContainer(Container);
classValidatorUseContainer(Container);

async function bootstrap() {
	const configService = Container.get(ConfigService);

	const appContext = configService.getConfig<string>('app-context');
	process.env.NODE_ENV = appContext;

	await createConnection(configService.getConfig<ConnectionOptions>('ormconfig'));

	const app = express();

	if (appContext === 'production') {
		app.set('env', 'production');
		app.set('view cache', true);
	}

	app.engine('hbs', exphbs.create({
		extname: '.hbs',
		layoutsDir: path.join(configService.projectRootPath, 'resources', 'private', 'templates', 'layouts'),
		partialsDir: path.join(configService.projectRootPath, 'resources', 'private', 'templates', 'partials'),
		defaultLayout: 'default',
		helpers: handlebarsHelpers
	}).engine);
	app.set('views', path.join(configService.projectRootPath, 'resources', 'private', 'templates', 'views'));
	app.set('view engine', 'hbs');

	app.use(compression());
	app.use(urlencoded({ extended: false }));
	app.use(cookieParser());
	app.use(session({
		secret: configService.getConfig('session').secret,
		resave: false,
		saveUninitialized: false,
		unset: 'destroy',
		store: new (connectRedis(session))({ client: Container.get(RedisService).redisClient }),
		cookie: {
			maxAge: 1000 * 60 * 60 * 24 * 7 // one week
		}
	}));
	Container.get(PassportConfigService).setupPassport();
	app.use(passport.initialize());
	app.use(passport.session());

	app.use(expressStatic(path.join(configService.projectRootPath, 'resources', 'public')));
	app.use(bodyParser.json({limit: '10mb'}));
	useExpressServer(app, {
		controllers: [
			HomeController,
			ImprintController,
			PrivacyPolicyController,
			FeaturesController,
			AuthController,
			VerifyEmailController,
			PreferencesController,
			ProjectController
		],
		middlewares: [
			DefaultSessionMiddleware,
			TranslationMiddleware,
			GlobalViewDataMiddleware,
			UserDataMiddleware,
			NotFoundMiddleware,
			ErrorHandlerMiddleware
		],
		validation: {
			validationError: {
				target: false,
				value: false
			},
			whitelist: true,
			forbidNonWhitelisted: true
		},
		development: appContext === 'development',
		defaultErrorHandler: false,
		currentUserChecker: action => (action.request as Request).user
	});
	app.listen(3000, () => {
		console.log('App started successfully');
	});
}

bootstrap();
