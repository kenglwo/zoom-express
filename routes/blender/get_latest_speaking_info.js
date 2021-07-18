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

router.get('/', function(req, res) {

    const fetchLatestSpeakingInfo = `
    select
      datetime_start,
      active_at_offset,
      attendee_name,
      word_count,
      speak_duration,
      sentiment_score,
      sentiment_magnitude
    from
      attendee_speaking_data2
    -- where
    -- 	active_at > now() + '-1 minutes' 
    order by
      datetime_start desc, active_at desc
    limit 5
    ; 
    `;

    (async () => {
      const client = await pool.connect();
      // let api_output = [];
      try {
          const result = await client.query(fetchLatestSpeakingInfo);
          console.log(result.rows)
          res.json(result.rows)
      } finally {
        client.release();
      }

    })().catch(e => console.log(e.stack));
});

module.exports = router;
