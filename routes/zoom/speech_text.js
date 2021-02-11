require('dotenv').config();
const express = require('express');
const router = express.Router();
const path = require('path');
const {Pool, Client} = require('pg');

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT
})

pool.on('error', (err, client) => {
	console.error('Unexpected error on idle client', err);
	process.exit(-1);
});

router.get('/', function(req, res, next) {
  const url = path.join(__dirname, "..", 'public', 'index.html')
  res.sendFile(url)
  // res.render('index')
});

router.post('/', function(req, res) {
  const transcriptFromApi = req.body.transcript;
  const wordCount = req.body.word_count;
  const elapsedTimeStart = req.body.elapsed_time_start;
  const elapsedTimeEnd = req.body.elapsed_time_end;
  const speakDuration = req.body.speak_duration;
  const sentimentScore = req.body.sentiment_score;
  const sentimentMagnitude = req.body.sentiment_magnitude;
  const timestampFromApi = req.body.timestamp;

  // fetch the latest active speaker's timestamp
  const fetchLatestActiveSpeakerData = `
    select
      meeting_id,
      datetime_start,
      attendee_name,
      transcript,
      timestamp
    from
      attendee_speaking_data
    order by 
      timestamp desc
    limit 1
  `;

  // if transcript == null => update
  // if transcript != null => insert with the keeping active speaker

  const activeSpeakergDataQueryUpdate = `
    update attendee_speaking_data
    set
      transcript=$1,
      word_count=$2,
      elapsed_time_start=$3,
      elapsed_time_end=$4,
      speak_duration=$5,
      sentiment_score=$6,
      sentiment_magnitude=$7
    where
      timestamp=$8
    `;

  const activeSpeakergDataQueryInsert = `
    insert into attendee_speaking_data(
      meeting_id,
      datetime_start,
      attendee_name,
      timestamp,
      transcript,
      word_count,
      elapsed_time_start,
      elapsed_time_end,
      speak_duration,
      sentiment_score,
      sentiment_magnitude
    ) values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

  (async () => {
    const client = await pool.connect();

    try {
        const result = await client.query(fetchLatestActiveSpeakerData);
        const transcript = result.rows[0].transcript;
        const timestamp = result.rows[0].timestamp;

        if (transcript === null) { // change to new active speaker
          const activeSpeakerDataUpdate = [transcriptFromApi, wordCount, elapsedTimeStart, elapsedTimeEnd, speakDuration, sentimentScore, sentimentMagnitude, timestamp];
          await client.query(activeSpeakergDataQueryUpdate, activeSpeakerDataUpdate);
        } else { // the active speaker keep speaking...
          const meeting_id = result.rows[0].meeting_id;
          const datetime_start = result.rows[0].datetime_start;
          const attendee_name = result.rows[0].attendee_name;
          const activeSpeakerDataInsert = [meeting_id, datetime_start, attendee_name, timestampFromApi, transcriptFromApi, wordCount, elapsedTimeStart, elapsedTimeEnd, speakDuration, sentimentScore, sentimentMagnitude]
          await client.query(activeSpeakergDataQueryInsert, activeSpeakerDataInsert);
        }
    } finally {
      client.release();
    }

    res.send("API success: speech_text")
  })().catch(e => console.log(e.stack));
});

// module.exports = function (io) {
//     //Socket.IO
//     io.on('connection', function (socket) {
//         console.log('User has connected to Index');

//         socket.on('message',function(msg){
//           console.log('message: ' + msg);
//           io.emit('message', msg);
//         });
//     });
//     return router;
// };
module.exports = router;