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

gulp.task('js:global', function() {
	return gulp.src([path.join(__dirname, 'resources/private/js/bem.js'), path.join(__dirname, 'resources/private/js/global.js')])
		.pipe(sourceMaps.init())
		.pipe(concat('global.js'))
		.pipe(babel({
			presets: ['@babel/env']
		}))
		.on('error', function(err) {
			console.error(err.message);
			this.emit('end');
		})
		.pipe(terser())
		.pipe(sourceMaps.write('./'))
		.pipe(gulp.dest(path.join(__dirname, 'resources/public/js')));
});

gulp.task('js', gulp.parallel(['js:global']));

gulp.task('js:watch', function () {
	gulp.watch(path.join(__dirname, 'resources/private/js/**/*.js'), (done) => {
		gulp.series(['js'])(done);
	});
});

gulp.task('watch', gulp.parallel(['scss:watch', 'js:watch']));
