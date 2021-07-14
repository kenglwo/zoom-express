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


router.post('/', function(req, res) {
  console.log(req.body);
  const recogStart = req.body.recog_start;
  console.log(`recogStart: ${recogStart}`);


  const fetchLatestMeeting = `
    select
      meeting_id,
      datetime_start
    from
      meeting_info
    order by datetime_start desc
    limit 1
  `

  const recogStartUpdate = `
    update meeting_info
    set 
      datetime_start_recog=$1
    where
      meeting_id=$2
      and datetime_start=$3
    `;

  (async () => {
    const client = await pool.connect();

    try {
        const result = await client.query(fetchLatestMeeting);
        const meetingID = result.rows[0].meeting_id;
        const datetimeStart = result.rows[0].datetime_start;

        await client.query(recogStartUpdate, [recogStart, meetingID, datetimeStart])

    } finally {
      client.release();
    }

    res.send("API success: speech_text")
  })().catch(e => console.log(e.stack));
});

module.exports = router;