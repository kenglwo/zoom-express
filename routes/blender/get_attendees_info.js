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

    const fetchLatestAttendeesInfo = `
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
      let api_output = {
        "meeting_id": "",
        "datetime_start": "",
        "attendees_list": []
      }
      try {
          const result = await client.query(fetchLatestAttendeesInfo);
          // console.log(result.rows)
          api_output["meeting_id"] = result.rows[0]["meeting_id"];
          api_output["datetime_start"] = result.rows[0]["datetime_start"];
          for ( d of result.rows ){
            attendee_info = {
              "attendee_id": d["attendee_id"],
              "attendee_name": d["attendee_name"],
              "is_host": d["is_host"]
            }
            api_output["attendees_list"].push(attendee_info);
          }
          res.send(api_output)
      } finally {
        client.release();
      }

    })().catch(e => console.log(e.stack));
});

module.exports = router;
