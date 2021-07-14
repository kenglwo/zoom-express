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
    const meeting_id = req.body.meeting_id;
    const datetime_start = req.body.datetime_start;
    const attendeesList = JSON.parse(req.body.attendees_list);
    const attendees_num = attendeesList.length;

    const attendeesListBlender = attendeesList.map((d) => {d.userName, d.isHost})

    let atteendeesListInfo = [];
    attendeesList.forEach(attendee => {
      const attendeeInfo = {
        attendee_id: attendee.userId,
        attendee_name: attendee.userName,
        is_host: attendee.isHost
      }
      atteendeesListInfo.push(attendeeInfo);
    });

    // save to DB
    (async () => {
      const client = await pool.connect();

      const insertMeetingInfo = 'insert into meeting_info(meeting_id, datetime_start, attendees_num) values($1, $2, $3)'
      const meetingInfo = [meeting_id, datetime_start, attendees_num]
      const insertAttendeeInfo = 'insert into attendee_info(meeting_id, datetime_start, attendee_id, attendee_name, is_host) values($1, $2, $3, $4, $5)'

      try {
          await client.query(insertMeetingInfo, meetingInfo)
          atteendeesListInfo.forEach(attendee => {
            (async () => {
              const attendeeInfo = [meeting_id, datetime_start, attendee.attendee_id, attendee.attendee_name, attendee.is_host]
              await client.query(insertAttendeeInfo, attendeeInfo)
            })().catch(e => console.log(e.stack))
          })
      } finally {
        client.release();
      }
    })().catch(e => console.log(e.stack))

});

module.exports = router;
