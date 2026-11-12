const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const config = require('../config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One live Deepgram streaming session per push-to-talk press.
// The browser sends compressed audio chunks (webm/opus or mp4); Deepgram detects the container.
function openTranscriber({ onInterim, onError } = {}) {
  const deepgram = createClient(config.deepgramKey);
  const connection = deepgram.listen.live({
    model: 'nova-2',
    language: 'en',
    smart_format: true,
    punctuate: true,
    interim_results: true,
  });

  const finals = [];
  const confidences = [];
  let isOpen = false;
  let isClosed = false;
  const backlog = [];

  const opened = new Promise((resolve) => {
    connection.on(LiveTranscriptionEvents.Open, () => {
      isOpen = true;
      backlog.splice(0).forEach((chunk) => connection.send(chunk));
      resolve();
    });
  });

  const closed = new Promise((resolve) => {
    connection.on(LiveTranscriptionEvents.Close, () => {
      isClosed = true;
      resolve();
    });
    connection.on(LiveTranscriptionEvents.Error, (err) => {
      console.error('Deepgram error:', err?.message || err);
      onError?.(err);
      resolve();
    });
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const alt = data?.channel?.alternatives?.[0];
    if (!alt || !alt.transcript) return;
    if (data.is_final) {
      finals.push(alt.transcript);
      if (typeof alt.confidence === 'number') confidences.push(alt.confidence);
    }
    const live = data.is_final ? finals.join(' ') : [...finals, alt.transcript].join(' ');
    onInterim?.(live.trim());
  });

  const requestClose = () => {
    if (typeof connection.requestClose === 'function') connection.requestClose();
    else connection.finish();
  };

  return {
    send(chunk) {
      if (isClosed) return;
      if (isOpen) connection.send(chunk);
      else backlog.push(chunk);
    },
    // Ask Deepgram to flush remaining audio, then resolve with the final transcript.
    async finish() {
      await Promise.race([opened, sleep(3000)]);
      if (!isClosed) requestClose();
      await Promise.race([closed, sleep(3000)]);
      const confidence = confidences.length
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : null;
      return { transcript: finals.join(' ').trim(), confidence };
    },
    close() {
      if (isClosed) return;
      try {
        requestClose();
      } catch {
        /* already closed */
      }
    },
  };
}

module.exports = { openTranscriber };
