#!/usr/bin/env python
import re
import sys
import time
import os
import datetime
import pprint
import requests
import pyaudio
from six.moves import queue

from google.cloud import speech
from google.cloud import speech_v1p1beta1
from google.cloud import language_v1


# Copyright 2019 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Google Cloud Speech API sample application using the streaming API.

NOTE: This module requires the dependencies `pyaudio` and `termcolor`.
To install using pip:

    pip install pyaudio
    pip install termcolor

Example usage:
    python transcribe_streaming_infinite.py
"""

# $env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\mars\Github\zoom-express\ambient-meeting-b4b55b07ce3e.json"
# [START speech_transcribe_infinite_streaming]

# Audio recording parameters
STREAMING_LIMIT = 240000  # 4 minutes
SAMPLE_RATE = 16000
CHUNK_SIZE = int(SAMPLE_RATE / 10)  # 100ms

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[0;33m"

offset_time_start = time.time()
new_connection_index = -1 

def get_current_time():
    """Return Current Time in MS."""

    return int(round(time.time() * 1000))


class ResumableMicrophoneStream:
    """Opens a recording stream as a generator yielding the audio chunks."""

    def __init__(self, rate, chunk_size):
        self._rate = rate
        self.chunk_size = chunk_size
        self._num_channels = 1
        self._buff = queue.Queue()
        self.closed = True
        self.start_time = get_current_time()
        self.restart_counter = 0
        self.audio_input = []
        self.last_audio_input = []
        self.result_end_time = 0
        self.is_final_end_time = 0
        self.final_request_end_time = 0
        self.bridging_offset = 0
        self.last_transcript_was_final = False
        self.new_stream = True
        self._audio_interface = pyaudio.PyAudio()
        self._audio_stream = self._audio_interface.open(
            format=pyaudio.paInt16,
            channels=self._num_channels,
            rate=self._rate,
            input=True,
            frames_per_buffer=self.chunk_size,
            # Run the audio stream asynchronously to fill the buffer object.
            # This is necessary so that the input device's buffer doesn't
            # overflow while the calling thread makes network requests, etc.
            stream_callback=self._fill_buffer,
        )

    def __enter__(self):

        self.closed = False
        return self

    def __exit__(self, type, value, traceback):

        self._audio_stream.stop_stream()
        self._audio_stream.close()
        self.closed = True
        # Signal the generator to terminate so that the client's
        # streaming_recognize method will not block the process termination.
        self._buff.put(None)
        self._audio_interface.terminate()

    def _fill_buffer(self, in_data, *args, **kwargs):
        """Continuously collect data from the audio stream, into the buffer."""

        self._buff.put(in_data)
        return None, pyaudio.paContinue

    def generator(self):
        """Stream Audio from microphone to API and to local buffer"""

        while not self.closed:
            data = []

            if self.new_stream and self.last_audio_input:

                chunk_time = STREAMING_LIMIT / len(self.last_audio_input)

                if chunk_time != 0:

                    if self.bridging_offset < 0:
                        self.bridging_offset = 0

                    if self.bridging_offset > self.final_request_end_time:
                        self.bridging_offset = self.final_request_end_time

                    chunks_from_ms = round(
                        (self.final_request_end_time - self.bridging_offset)
                        / chunk_time
                    )

                    self.bridging_offset = round(
                        (len(self.last_audio_input) - chunks_from_ms) * chunk_time
                    )

                    for i in range(chunks_from_ms, len(self.last_audio_input)):
                        data.append(self.last_audio_input[i])

                self.new_stream = False

            # Use a blocking get() to ensure there's at least one chunk of
            # data, and stop iteration if the chunk is None, indicating the
            # end of the audio stream.
            chunk = self._buff.get()
            self.audio_input.append(chunk)

            if chunk is None:
                return
            data.append(chunk)
            # Now consume whatever other data's still buffered.
            while True:
                try:
                    chunk = self._buff.get(block=False)

                    if chunk is None:
                        return
                    data.append(chunk)
                    self.audio_input.append(chunk)

                except queue.Empty:
                    break

            yield b"".join(data)


def listen_print_loop(responses, stream, new_connection_index):
    """Iterates through server responses and prints them.

    The responses passed is a generator that will block until a response
    is provided by the server.

    Each response may contain multiple results, and each result may contain
    multiple alternatives; for details, see https://goo.gl/tjCPAU.  Here we
    print only the transcription for the top alternative of the top result.

    In this case, responses are provided for interim results as well. If the
    response is an interim one, print a line feed at the end of it, to allow
    the next result to overwrite it, until the response is a final one. For the
    final one, print a newline to preserve the finalized transcription.
    """

    for response in responses:

        if get_current_time() - stream.start_time > STREAMING_LIMIT:
            stream.start_time = get_current_time()
            break

        if not response.results:
            continue

        result = response.results[0]


        if not result.alternatives:
            continue

        transcript = result.alternatives[0].transcript.strip()

        result_seconds = 0
        result_micros = 0

        if result.result_end_time.seconds:
            result_seconds = result.result_end_time.seconds

        if result.result_end_time.microseconds:
            result_micros = result.result_end_time.microseconds

        stream.result_end_time = int((result_seconds * 1000) + (result_micros / 1000))

        corrected_time = (
            stream.result_end_time
            - stream.bridging_offset
            + (STREAMING_LIMIT * stream.restart_counter)
        )
        # Display interim results, but with a carriage return at the end of the
        # line, so subsequent lines will overwrite them.

        if result.is_final:
            sys.stdout.write(GREEN)
            sys.stdout.write("\033[K")
            sys.stdout.write(str(corrected_time) + ": " + transcript + "\n")

            stream.is_final_end_time = stream.result_end_time
            stream.last_transcript_was_final = True

            if len(list(result.alternatives[0].words)) > 0:

                url = "http://localhost:3000/api/zoom/speech_words"
                words = result.alternatives[0].words
                words_json = []
                offset_time_now = time.time()
                offset_time_elasped = round(( offset_time_now - offset_time_start )/10, 1)
                for i, word in enumerate(words):
                    start = word.start_time.total_seconds() 
                    end = word.end_time.total_seconds() 

                    start2 = start + new_connection_index * 240 if new_connection_index > 0 else start
                    end2 = end + new_connection_index * 240 if new_connection_index > 0 else start


                    # data = {
                    #     "word": word.word,
                    #     "offset_time_start": start,
                    #     "offset_time_end": end
                    # }
                    data = {
                        "word": word.word,
                        "offset_time_start": start2,
                        "offset_time_end": end2
                    }
                    # data = {
                    #     "word": word.word,
                    #     "offset_time_start": offset_time_elasped + i/100,
                    #     "offset_time_end": offset_time_elasped + i/100
                    # }

                    words_json.append(data)
                    # print("word: {}, offset_time_start: {}, ?_offset: {}, true_offset: {}".format(word.word, offset_time_start, offset_time_elasped, word.start_time.total_seconds() ))
                    # print("word: {}, true_offset: {}, ?_offset: {}".format(word.word, data["offset_time_start"], ))
                    print("word: {}, true_offset: {}, ?_offset: {}".format(word.word, start, start2))

                # print(words_json)
                res = requests.post(url, json=words_json)

                # Exit recognition if any of the transcribed phrases could be
                # one of our keywords.
                # if re.search(r"\b(exit|quit)\b", transcript, re.I):
                #     sys.stdout.write(YELLOW)
                #     sys.stdout.write("Exiting...\n")
                #     stream.closed = True
                #     break

        else:
            sys.stdout.write(RED)
            sys.stdout.write("\033[K")
            sys.stdout.write(str(corrected_time) + ": " + transcript + "\r")

            stream.last_transcript_was_final = False


def main(new_connection_index):
    """start bidirectional streaming from microphone input to speech API"""

    # diarization_config = {
    #     "enable_speaker_diarization": True,
    #     "min_speaker_count": 1,
    #     "max_speaker_count": 6,
    # }

    # alternative_language_codes = ['zh'],
    client = speech_v1p1beta1.SpeechClient()
    config = speech_v1p1beta1.RecognitionConfig(
        encoding=speech_v1p1beta1.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=SAMPLE_RATE,
        language_code="en-US",
        max_alternatives=1,
        enable_word_time_offsets=True,
        use_enhanced=True,
        model="default",
    )
        # model="video",
        # diarization_config=diarization_config,

    streaming_config = speech_v1p1beta1.StreamingRecognitionConfig(
        config=config,
        interim_results=True,
        single_utterance=False
    )

    # send data of the start of the speech recognition
    import requests
    url = "http://localhost:3000/api/zoom/recog_start"
    now = datetime.datetime.now()
    recog_start = now.strftime('%Y-%m-%d %H:%M:%S')
    offset_time_start = time.time()
    data = {
        "recog_start": recog_start
    }
    res = requests.post(url, json=data)

    mic_manager = ResumableMicrophoneStream(SAMPLE_RATE, CHUNK_SIZE)
    print(mic_manager.chunk_size)
    sys.stdout.write(YELLOW)
    sys.stdout.write('\nListening, say "Quit" or "Exit" to stop.\n\n')
    sys.stdout.write("End (ms)       Transcript Results/Status\n")
    sys.stdout.write("=====================================================\n")

    with mic_manager as stream:

        while not stream.closed:
            new_connection_index += 1
            sys.stdout.write(YELLOW)
            sys.stdout.write(
                "\n" + str(STREAMING_LIMIT * stream.restart_counter) + ": NEW REQUEST\n"
            )
            print("#### new_connection_index: {}".format(new_connection_index))

            stream.audio_input = []
            audio_generator = stream.generator()

            requests = (
                speech_v1p1beta1.StreamingRecognizeRequest(audio_content=content)
                for content in audio_generator
            )

            responses = client.streaming_recognize(streaming_config, requests)

            # Now, put the transcription responses to use.
            listen_print_loop(responses, stream, new_connection_index)

            if stream.result_end_time > 0:
                stream.final_request_end_time = stream.is_final_end_time
            stream.result_end_time = 0
            stream.last_audio_input = []
            stream.last_audio_input = stream.audio_input
            stream.audio_input = []
            stream.restart_counter = stream.restart_counter + 1

            if not stream.last_transcript_was_final:
                sys.stdout.write("\n")
            stream.new_stream = True


if __name__ == "__main__":

    main(new_connection_index)

# [END speech_transcribe_infinite_streaming]