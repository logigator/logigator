/* eslint-disable */

const gulp = require('gulp');
const sass = require('gulp-sass');
const path = require('path');
const babel = require('gulp-babel');
const terser = require('gulp-terser');
const concat = require('gulp-concat');
const cleanCSS = require('gulp-clean-css');
const sourceMaps = require('gulp-sourcemaps');
const rename = require("gulp-rename");


gulp.task('scss:layouts', function() {
	return gulp.src(path.join(__dirname, 'resources/private/scss/layouts/**/*.scss').replace(/\\/g, '/'))
		.pipe(sass().on('error', sass.logError))
		.pipe(cleanCSS({level: 2}))
		.pipe(gulp.dest(path.join(__dirname, 'resources/public/css/layouts').replace(/\\/g, '/')));

});

gulp.task('scss:views', function() {
	return gulp.src(path.join(__dirname, 'resources/private/scss/views/**/*.scss').replace(/\\/g, '/'))
		.pipe(sass().on('error', sass.logError))
		.pipe(cleanCSS({level: 2}))
		.pipe(gulp.dest(path.join(__dirname, 'resources/public/css/views').replace(/\\/g, '/')));
});

gulp.task('scss', gulp.parallel(['scss:layouts', 'scss:views']));

gulp.task('scss:watch', function () {
	gulp.watch(path.join(__dirname, 'resources/private/scss/**/*.scss').replace(/\\/g, '/'), (done) => {
		gulp.series(['scss'])(done);
	});
});

gulp.task('js:global-modern', function() {
	return gulp.src([
		path.join(__dirname, 'resources/private/js/bem.js').replace(/\\/g, '/'),
		path.join(__dirname, 'resources/private/js/global-functions.js').replace(/\\/g, '/'),
		path.join(__dirname, 'resources/private/js/global.js').replace(/\\/g, '/')
	]).pipe(sourceMaps.init())
		.pipe(concat('global-es2015.js'))
		.pipe(babel({
			presets: [
				['@babel/env', {
					targets: {
						browsers: [
							'Edge >= 16',
							'Firefox >= 60',
							'Chrome >= 61',
							'Safari >= 11',
							'Opera >= 48'
						]
					}
			}]
			],
		}))
		.on('error', function(err) {
			console.error(err.message);
			this.emit('end');
		})
		.pipe(terser({
			ecma: 2015
		}))
		.pipe(sourceMaps.write('./'))
		.pipe(gulp.dest(path.join(__dirname, 'resources/public/js').replace(/\\/g, '/')));
});

gulp.task('js:views-modern', function() {
	return gulp.src(path.join(__dirname, 'resources/private/js/views/**/*.js').replace(/\\/g, '/'))
		.pipe(sourceMaps.init())
		.pipe(rename({suffix: '-es2015'}))
		.pipe(babel({
			presets: [
				['@babel/env', {
					targets: {
						browsers: [
							'Edge >= 16',
							'Firefox >= 60',
							'Chrome >= 61',
							'Safari >= 11',
							'Opera >= 48'
						]
					}
				}]
			],
		}))
		.on('error', function(err) {
			console.error(err.message);
			this.emit('end');
		})
		.pipe(terser({
			ecma: 2015
		}))
		.pipe(sourceMaps.write('./'))
		.pipe(gulp.dest(path.join(__dirname, 'resources/public/js/views').replace(/\\/g, '/')));
});

gulp.task('js-modern', gulp.parallel(['js:global-modern', 'js:views-modern']));

gulp.task('js:global-legacy', function() {
	return gulp.src([
		path.join(__dirname, 'node_modules', 'core-js-bundle', 'minified.js').replace(/\\/g, '/'),
		path.join(__dirname, 'node_modules', 'regenerator-runtime', 'runtime.js').replace(/\\/g, '/'),
		path.join(__dirname, 'resources/private/js/bem.js').replace(/\\/g, '/'),
		path.join(__dirname, 'resources/private/js/global-functions.js').replace(/\\/g, '/'),
		path.join(__dirname, 'resources/private/js/global.js').replace(/\\/g, '/')
	]).pipe(sourceMaps.init())
		.pipe(concat('global-es5.js'))
		.pipe(babel({
			presets: [
				['@babel/env', {
					targets: {
						browsers: [
							'> 0.5%',
						]
					}
				}]
			],
		}))
		.on('error', function(err) {
			console.error(err.message);
			this.emit('end');
		})
		.pipe(terser({
			ecma: 5,
			safari10: true
		}))
		.pipe(sourceMaps.write('./'))
		.pipe(gulp.dest(path.join(__dirname, 'resources/public/js').replace(/\\/g, '/')));
});

gulp.task('js:views-legacy', function() {
	return gulp.src(path.join(__dirname, 'resources/private/js/views/**/*.js').replace(/\\/g, '/'))
		.pipe(sourceMaps.init())
		.pipe(rename({suffix: '-es5'}))
		.pipe(babel({
			presets: [
				['@babel/env', {
					targets: {
						browsers: [
							'> 0.5%',
						]
					}
				}]
			],
		}))
		.on('error', function(err) {
			console.error(err.message);
			this.emit('end');
		})
		.pipe(terser({
			ecma: 5,
			safari10: true
		}))
		.pipe(sourceMaps.write('./'))
		.pipe(gulp.dest(path.join(__dirname, 'resources/public/js/views').replace(/\\/g, '/')));
});

gulp.task('js-legacy', gulp.parallel(['js:global-legacy', 'js:views-legacy']));

gulp.task('js:watch', function () {
	gulp.watch(path.join(__dirname, 'resources/private/js/**/*.js').replace(/\\/g, '/'), (done) => {
		gulp.series(['js-modern'])(done);
	});
});

gulp.task('watch', gulp.parallel(['scss:watch', 'js:watch']));

gulp.task('dist-for-prod', gulp.parallel(['scss', 'js-legacy', 'js-modern']));
