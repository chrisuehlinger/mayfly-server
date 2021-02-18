const gulp = require('gulp');
const nodemon = require('gulp-nodemon');
const livereload = require('gulp-livereload');


gulp.task('develop', gulp.series((done) => {
  livereload.listen();
  return nodemon({
    script: 'bin/www',
    ext: 'js ejs coffee',
    stdout: false,
    done: done
  }).on('readable', function () {
    this.stdout.on('data', (chunk) => {
      if (/^Express server listening on port/.test(chunk)) {
        livereload.changed(__dirname);
      }
    });
    this.stdout.pipe(process.stdout);
    this.stderr.pipe(process.stderr);
  });
}));

gulp.task('default', gulp.series('develop'));