const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const app = express();
app.io = require('socket.io')();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

const indexRouter = require('./routes/index');
// const zoomSpeechTextRouter = require('./routes/zoom/speech_text')(app.io);
const zoomRecogStartRouter = require('./routes/zoom/recog_start');
// const zoomSpeechTextRouter = require('./routes/zoom/speech_text');
const zoomSpeechWordsRouter = require('./routes/zoom/speech_words');
const zoomAttendeesListRouter = require('./routes/zoom/attendees_list');
const zoomActiveSpeakerRouter = require('./routes/zoom/active_speaker');
const zoomMeetingEndRouter = require('./routes/zoom/meeting_end');

const blenderAttendeesInfoRouter = require('./routes/blender/get_attendees_info');
const blenderGetLatestSpeakingInfoRouter = require('./routes/blender/get_latest_speaking_info');

const testRouter = require('./routes/test');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/', indexRouter);
app.use('/api/zoom/recog_start', zoomRecogStartRouter);
// app.use('/api/zoom/speech_text', zoomSpeechTextRouter);
app.use('/api/zoom/speech_words', zoomSpeechWordsRouter);
app.use('/api/zoom/attendees_list', zoomAttendeesListRouter);
app.use('/api/zoom/active_speaker', zoomActiveSpeakerRouter);
app.use('/api/zoom/meeting_end', zoomMeetingEndRouter);

app.use('/api/blender/get_attendees_info', blenderAttendeesInfoRouter);
app.use('/api/blender/get_latest_speaking_info', blenderGetLatestSpeakingInfoRouter);

app.use('/api/test', testRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
