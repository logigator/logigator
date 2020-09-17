import 'reflect-metadata';
import {useContainer as useContainerRC, useExpressServer} from 'routing-controllers';
import {createConnection, useContainer as typeOrmUseContainer, ConnectionOptions} from 'typeorm';
import {useContainer as classValidatorUseContainer} from 'class-validator';
import express, {urlencoded, static as expressStatic} from 'express';
import {Container} from 'typedi';
import * as exphbs from 'express-handlebars';
import {HomeController} from './controller/frontend/home.controller';
import {ConfigService} from './services/config.service';
import * as path from 'path';
import {AuthController} from './controller/frontend/auth.controller';
import flash from 'express-flash';
import passport from 'passport';
import session from 'express-session';
import {PassportConfigService} from './services/passport-config.service';
import cookieParser from 'cookie-parser';
import {ErrorHandlerMiddleware} from './middleware/error-handler.middleware';
import {ProjectController} from './controller/api/project.controller';
import {NotFoundController} from './controller/not-found.controller';

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
		layoutsDir: path.join(__dirname, '..', 'resources', 'private', 'templates', 'layouts'),
		partialsDir: path.join(__dirname, '..', 'resources', 'private', 'templates', 'partials'),
		defaultLayout: 'default'
	}).engine);
	app.set('views', path.join(__dirname, '..', 'resources', 'private', 'templates', 'views'));
	app.set('view engine', 'hbs');

	app.use(urlencoded({ extended: false }));
	app.use(flash());
	app.use(cookieParser());
	app.use(session({
		secret: 'test',
		resave: false,
		saveUninitialized: false
	}));
	Container.get(PassportConfigService).setupPassport();
	app.use(passport.initialize());
	app.use(passport.session());

	app.use(expressStatic(path.join(__dirname, '..', 'resources', 'public')));
	useExpressServer(app, {
		controllers: [
			HomeController,
			AuthController,
			ProjectController,
			NotFoundController
		],
		middlewares: [ErrorHandlerMiddleware],
		development: appContext === 'development',
		defaultErrorHandler: false,
		currentUserChecker: action => action.request.user
	});

	app.listen(80, () => {
		console.log('App started successfully');
	});
}

bootstrap();
