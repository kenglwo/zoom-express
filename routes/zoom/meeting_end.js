require('dotenv').config();
var express = require('express');
var router = express.Router();
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
    console.log(req.body);
    const datetimeEnd = new Date(req.body.datetime_end)

    const fetchLatestMeetingInfo = `
      select
        meeting_id,
        datetime_start
      from
        meeting_info
      order by
        datetime_start desc
      limit 1
    `;

    const updateMeetingInfo = `
      update meeting_info
      set
        datetime_end=$1,
        duration_seconds=$2
      where
        meeting_id=$3
        and datetime_start=$4
    `;

    (async () => {
      const client = await pool.connect();

      try {
          const result = await client.query(fetchLatestMeetingInfo);
          const meetingID = result.rows[0].meeting_id;
          const datetimeStart = result.rows[0].datetime_start;

          const duration = (datetimeEnd - datetimeStart) / 1000; // seconds

          const meetingInfo = [datetimeEnd, duration, meetingID, datetimeStart];
          await client.query(updateMeetingInfo, meetingInfo);
      } finally {
        client.release();
      }

      // res.send("API success: speech_text")
    })().catch(e => console.log(e.stack));

    // res.send('API Success: meeting_end');
});

module.exports = router;
