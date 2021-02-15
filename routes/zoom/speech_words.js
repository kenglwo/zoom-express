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

// TODO: fetch the latest meeting_info, recog_start
const fetchLatestMeeting = `
  select
    meeting_id,
    datetime_start_recog
  from
    meeting_info
  order by datetime_start_recog desc
  limit 1
`
// TODO: insert into speech_words
const insertSpeechWords = `
  insert into speech_words(
    meeting_id,
    datetime_start_recog,
    word,
    offset_time_start,
    offset_time_end
  ) values ($1, $2, $3, $4, $5)
`

router.post('/', function(req, res) {
  const words = req.body.words;

  (async () => {
    const client = await pool.connect();

    try {
        const result = await client.query(fetchLatestMeeting);
        const meeting_id = result.rows[0].meeting_id;
        const datetime_start_recog = new Date(result.rows[0].datetime_start_recog);

        for (word of words){
          await client.query(insertSpeechWords, [meeting_id, datetime_start_recog, word.word, word.offset_time_start, word.offset_time_end])
        }

    } finally {
      client.release();
    }

    res.send("API success: speech_text")
  })().catch(e => console.log(e.stack));
});

module.exports = router;