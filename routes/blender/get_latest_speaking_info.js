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
        meeting_id,
        to_char(datetime_start, 'YYYY-MM-DD HH24:MI:SS') as datetime_start,
        attendee_id,
        attendee_name,
        is_host
      from 
        attendee_info
      where datetime_start = (
        select 
          max(datetime_start)
        from
          attendee_info
      );
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
