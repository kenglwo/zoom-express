require('dotenv').config();
const express = require('express');
const router = express.Router();
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

router.post('/', function(req, res) {

    const active_speaker_name = req.body.active_speaker_name;
    const timestamp = req.body.timestamp;

    // TODO: save the data to DB
    (async () => {
      const client = await pool.connect();

      const fetchLatestMeetingInfo = 'select meeting_id, datetime_start from attendee_info where attendee_name = $1 order by datetime_start desc limit 1';

      const insertActiveSpeakergData = `
        insert into attendee_speaking_data (
          attendee_name,
          meeting_id,
          datetime_start,
          timestamp
         ) values($1, $2, $3, $4)
         `
      try {
          const result = await client.query(fetchLatestMeetingInfo, [active_speaker_name]);
          const activeSpeakerData = [active_speaker_name, result.rows[0].meeting_id, result.rows[0].datetime_start, timestamp];
          await client.query(insertActiveSpeakergData, activeSpeakerData);
          res.send('API Success: active_speaker');
      } finally {
        client.release();
      }
    })().catch(e => console.log(e.stack))
});

module.exports = router;
