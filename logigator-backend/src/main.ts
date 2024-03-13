import 'reflect-metadata';
import {useContainer as useContainerRC, useExpressServer} from 'routing-controllers';
import {createConnection, useContainer as typeOrmUseContainer, ConnectionOptions} from 'typeorm';
import {useContainer as classValidatorUseContainer} from 'class-validator';
import express, {static as expressStatic, Request} from 'express';
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
import {DefaultPreferencesMiddleware} from './middleware/global/default-preferences.middleware';
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
import {MyProjectsController} from './controller/frontend/my/my-projects.controller';
import {MyComponentsController} from './controller/frontend/my/my-components.controller';
import {ComponentController} from './controller/api/component.controller';
import {MyAccountController} from './controller/frontend/my/my-account.controller';
import {ShareController} from './controller/api/share.controller';
import {AuthPagesController} from './controller/frontend/auth-pages.controller';
import {UserController} from './controller/api/user.controller';
import {DownloadController} from './controller/frontend/download.controller';
import {ExamplesController} from './controller/frontend/examples.controller';
import {CommunityController} from './controller/frontend/community/community.controller';
import {CommunityProjCompController} from './controller/frontend/community/community-proj-comp.controller';
import {CommunityCloneController} from './controller/frontend/community/community-clone.controller';
import {CommunityUserController} from './controller/frontend/community/community-user.controller';
import {ReportErrorController} from './controller/api/report-error.controller';
import { TrailingSlashMiddleware } from './middleware/global/trailing-slash.middleware';

useContainerRC(Container);
typeOrmUseContainer(Container);
classValidatorUseContainer(Container);

async function bootstrap() {
	const configService = Container.get(ConfigService);

	const environment = configService.getConfig<any>('environment');
	process.env.NODE_ENV = environment.context;

	await createConnection(configService.getConfig<ConnectionOptions>('ormconfig'));

	const app = express();

	if (environment.context === 'production') {
		app.set('env', 'production');
		app.set('view cache', true);
	}

	app.use(compression());

	app.get(configService.getConfig('domains').editor + '/index.html', (req, res) => {
		res.redirect(configService.getConfig('domains').editor + '/', 301);
	});

	app.use(configService.getConfig('domains').editor, expressStatic(path.join(configService.projectRootPath, configService.getConfig('environment').editor), {
		cacheControl: true,
		immutable: true,
		maxAge: '90d',
		index: false
	}));

	app.use(configService.getConfig('domains').editor, (req, res) => {
		res.sendFile(path.join(configService.projectRootPath, configService.getConfig('environment').editor, 'index.html'));
	});

	app.use(expressStatic(path.join(configService.projectRootPath, 'resources', 'public'), {
		cacheControl: true,
		immutable: true,
		maxAge: '90d',
		index: false
	}));

	await Container.get(RedisService).init();

	app.use(cookieParser(configService.getConfig('session').secret));
	app.use(session({
		secret: configService.getConfig('session').secret,
		resave: false,
		saveUninitialized: false,
		unset: 'destroy',
		store: new (connectRedis(session))({ client: Container.get(RedisService).redisClient }),
		cookie: {
			maxAge: configService.getConfig('session').maxAge
		}
	}));
	Container.get(PassportConfigService).setupPassport();
	app.use(passport.initialize());
	app.use(passport.session());

	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(bodyParser.json({limit: '10mb'}));

	app.use((req, res, next) => {
		res.set('Cache-Control', 'no-cache, max-age=0, must-revalidate');
		next();
	});

	app.engine('hbs', exphbs.create({
		extname: '.hbs',
		layoutsDir: path.join(configService.projectRootPath, 'resources', 'private', 'templates', 'layouts'),
		partialsDir: path.join(configService.projectRootPath, 'resources', 'private', 'templates', 'partials'),
		defaultLayout: 'default',
		helpers: handlebarsHelpers
	}).engine);

	app.set('views', path.join(configService.projectRootPath, 'resources', 'private', 'templates', 'views'));
	app.set('view engine', 'hbs');
	app.set('etag', true);

	useExpressServer(app, {
		controllers: [
			HomeController,
			ImprintController,
			PrivacyPolicyController,
			FeaturesController,
			MyProjectsController,
			MyComponentsController,
			MyAccountController,
			AuthController,
			AuthPagesController,
			VerifyEmailController,
			PreferencesController,
			ProjectController,
			ComponentController,
			ShareController,
			UserController,
			DownloadController,
			ExamplesController,
			CommunityController,
			CommunityProjCompController,
			CommunityCloneController,
			CommunityUserController,
			ReportErrorController
		],
		middlewares: [
			TrailingSlashMiddleware,
			DefaultPreferencesMiddleware,
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
		development: environment.context === 'development',
		cors: false,
		defaultErrorHandler: false,
		currentUserChecker: action => (action.request as Request).user
	});

	const server = app.listen(environment.port, () => {
		console.log('App started successfully');
	});

	for (const signal of ['SIGINT', 'SIGTERM']) {
		process.on(signal, () => {
			console.log(`Received ${signal}: closing HTTP server..`);
			server.close(() => {
				process.exit(0);
			});
		});
	}
}

bootstrap();
