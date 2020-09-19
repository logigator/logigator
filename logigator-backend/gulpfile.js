const gulp = require('gulp');
const sass = require('gulp-sass');
const path = require('path');


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

