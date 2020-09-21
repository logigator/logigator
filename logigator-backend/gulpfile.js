const gulp = require('gulp');
const sass = require('gulp-sass');
const path = require('path');
const babel = require('gulp-babel');
const terser = require('gulp-terser');
const concat = require('gulp-concat');
const sourceMaps = require('gulp-sourcemaps');


gulp.task('scss:layouts', function() {
	return gulp.src(path.join(__dirname, 'resources/private/scss/layouts/**/*.scss'))
		.pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
		.pipe(gulp.dest(path.join(__dirname, 'resources/public/css/layouts')));

});

gulp.task('scss:views', function() {
	return gulp.src(path.join(__dirname, 'resources/private/scss/views/**/*.scss'))
		.pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
		.pipe(gulp.dest(path.join(__dirname, 'resources/public/css/views')));
});

gulp.task('scss', gulp.parallel(['scss:layouts', 'scss:views']));

gulp.task('scss:watch', function () {
	gulp.watch(path.join(__dirname, 'resources/private/scss/**/*.scss'), (done) => {
		gulp.series(['scss'])(done);
	});
});

gulp.task('js:global-modern', function() {
	return gulp.src([
		path.join(__dirname, 'resources/private/js/bem.js'),
		path.join(__dirname, 'resources/private/js/global.js')
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
		.pipe(gulp.dest(path.join(__dirname, 'resources/public/js')));
});

gulp.task('js-modern', gulp.parallel(['js:global-modern']));

gulp.task('js:global-legacy', function() {
	return gulp.src([
		path.join(__dirname, 'node_modules', 'core-js-bundle', 'minified.js'),
		path.join(__dirname, 'node_modules', 'regenerator-runtime', 'runtime.js'),
		path.join(__dirname, 'resources/private/js/bem.js'),
		path.join(__dirname, 'resources/private/js/global.js')
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
		.pipe(gulp.dest(path.join(__dirname, 'resources/public/js')));
});

gulp.task('js-legacy', gulp.parallel(['js:global-legacy']));

gulp.task('js:watch', function () {
	gulp.watch(path.join(__dirname, 'resources/private/js/**/*.js'), (done) => {
		gulp.series(['js-modern'])(done);
	});
});

gulp.task('watch', gulp.parallel(['scss:watch', 'js:watch']));

gulp.task('dist-for-prod', gulp.parallel(['scss', 'js-legacy', 'js-modern']));
