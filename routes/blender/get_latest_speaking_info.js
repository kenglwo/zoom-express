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
  const update_interval_seconds = req.query.update_interval_seconds;

  // const fetchLatestSpeakingInfo = `
  //   select
  //     attendee_name,
  //     word_count,
  //     speak_duration,
  //     sentiment_score,
  //     sentiment_magnitude
  //   from
  //     attendee_speaking_data2
  //   where
  //   	active_at > now() - interval '${update_interval_seconds} seconds' 
  //   order by
  //     active_at desc
  //   limit 5
  // `;

  const fetchLatestSpeakingInfo = `
    select
      attendee_name,
      sum(word_count) as word_count_sum,
      sum(speak_duration) as speak_duration_sum,
      avg(sentiment_score) as sentiment_score_avg,
      avg(sentiment_magnitude) as sentiment_magnitude_avg
    from
      attendee_speaking_data2
    where
    	active_at > now() - interval '${update_interval_seconds} seconds' 
    group by 
      attendee_name
    limit 5
  `;

  (async () => {
    const client = await pool.connect();
    const param = [update_interval_seconds];
    try {
        const result = await client.query(fetchLatestSpeakingInfo);
        const output = result.rows.filter(d => (d.word_count !== null));
        console.log(output)
        res.json(result.rows);
    } finally {
      client.release();
    }

  })().catch(e => console.log(e.stack));
});

module.exports = router;
