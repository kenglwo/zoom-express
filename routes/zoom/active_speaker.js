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

const fetchLatestMeetingInfo = `
select 
  meeting_id,
  datetime_start,
  datetime_start_recog
from 
  meeting_info
order by 
  datetime_start_recog desc
limit 1
`;

const insertActiveSpeakergData = `
insert into attendee_speaking_data2 (
  attendee_name,
  meeting_id,
  datetime_start,
  datetime_start_recog,
  active_at,
  active_at_offset
  ) values($1, $2, $3, $4, $5, $6)
  `;

  const fetchPrevSpeakerInfo = `
    select
      attendee_name,
      active_at,
      active_at_offset
    from
      attendee_speaking_data2
    where
      datetime_start_recog=$1
    order by
      active_at desc
    limit 1
  `;

  const aggPrevSpeaker = `
    select
      array_agg(
        word
        order by offset_time_start asc
       ) as agg_word,
       array_agg(
         offset_time_start
         order by offset_time_start asc
       ) as agg_start,
       array_agg(
         offset_time_end
         order by offset_time_end asc
       ) as agg_end
    from
      speech_words
    where
      datetime_start_recog = $1
      and offset_time_end > $2 -- previous speaker's offset start time
      and offset_time_end < $3 -- new active speaker's offset start time
  `;

  const updatePrevSpeakerData = `
    update attendee_speaking_data2
    set
        transcript=$1,
        word_count=$2,
        speak_offset_start=$3,
        speak_offset_end=$4,
        speak_duration=$5,
        sentiment_score=$6,
        sentiment_magnitude=$7
    where
      attendee_name=$8
      and active_at=$9
  `

router.post('/', function(req, res) {

    const active_speaker_name = req.body.active_speaker_name;
    let active_at = req.body.timestamp;

    (async () => {
      const client = await pool.connect();

      try {

        const result = await client.query(fetchLatestMeetingInfo);
        const meeting_id = result.rows[0].meeting_id;
        const datetime_start = result.rows[0].datetime_start;
        let datetime_start_recog = result.rows[0].datetime_start_recog;
        active_at = new Date(active_at);
        datetime_start_recog = new Date(datetime_start_recog);
        const new_speaker_start_offset = (active_at - datetime_start_recog) / 1000;

        // ==============================================
        // TODO: aggregate the previous speaker's transcript 
        const result2 = await client.query(fetchPrevSpeakerInfo, [datetime_start_recog]);

        // if this is not the first active speaker
        if (result2.rows.length > 0){
          const attendee_name = result2.rows[0].attendee_name;
          let prev_speaker_start_offset = result2.rows[0].active_at_offset;
          const prev_speaker_active_at = result2.rows[0].active_at;
          // if (result2.rows[0].active_at < datetime_start_recog){
          //   prev_speaker_start_offset = 0;
          // }

          console.log('============================')
          console.log(`prev speaker name: ${attendee_name}`);
          console.log(`prev speaker active_at_offset: ${prev_speaker_start_offset}`);
          console.log(`new speaker active_at_offset: ${new_speaker_start_offset}`);

          // word < new_speaker_start_offset
          const result3 = await client.query(aggPrevSpeaker, [datetime_start_recog, prev_speaker_start_offset, new_speaker_start_offset]);
          const words = result3.rows[0].agg_word;
          const elapsed_time_start = result3.rows[0].agg_start[0];
          const elapsed_time_end = result3.rows[0].agg_end.slice(-1)[0];
          const speak_duration = ( elapsed_time_end - elapsed_time_start ).toFixed(1);

          console.log(`speak_start: ${elapsed_time_start}`);
          console.log(`speak_end: ${elapsed_time_end}`);
          console.log(`speak_duration: ${speak_duration}`);


          if (words !== null){
            const transcript = words.join(' ');
            const word_count = transcript.split(' ').length;
            console.log(`transcript: ${transcript}`);
            console.log(`word_count: ${word_count}`);

            // sentiment analysis
            // Imports the Google Cloud client library
            const language = require('@google-cloud/language');

            // Creates a client
            const sa_client = new language.LanguageServiceClient();

            const text = 'Your text to analyze, e.g. Hello, world!';

            const document = {
              content: text,
              type: 'PLAIN_TEXT',
            };

            const [result] = await sa_client.analyzeSentiment({document});

            const sentiment = result.documentSentiment;
            const sentiment_score = sentiment.score.toFixed(2);
            const sentiment_magnitude = sentiment.magnitude.toFixed(2);
            console.log(`sentiment_score: ${sentiment.score}`);
            console.log(`sentiment_magnitude: ${sentiment.magnitude}`);

            const result3 = await client.query(updatePrevSpeakerData, [transcript, word_count, elapsed_time_start, elapsed_time_end, speak_duration, sentiment_score, sentiment_magnitude, attendee_name, prev_speaker_active_at]);
          } else {
            console.log('!!!!!!!!! no words !!!!!!!!!!!!');
          }
          console.log("")
        } else {
          console.log('##### first speaker #########')
        }

        // ==============================================
        // add new active speaker's info
        const activeSpeakerData = [active_speaker_name, meeting_id, datetime_start, datetime_start_recog, active_at, new_speaker_start_offset]
        await client.query(insertActiveSpeakergData, activeSpeakerData);

        res.send('API Success: active_speaker');
      } finally {
        client.release();
      }
    })().catch(e => console.log(e.stack))
});

module.exports = router;
