const { Server } = require('socket.io');
const config = require('./config');
const { verifyToken } = require('./middleware/auth');
const { openTranscriber } = require('./services/transcriber');
const { parseIntent } = require('./services/intentParser');
const { executeIntent, applyPending } = require('./services/voiceCommand');
const { isValidTimeZone } = require('./utils/time');

const MUTATING = new Set(['created', 'updated', 'deleted']);
const MAX_COMMANDS_PER_MINUTE = 30;

/*
 * Socket events
 *   client -> server:  voice:start {timezone} | voice:audio <bytes> | voice:stop
 *                      voice:text {text, timezone}   (typed fallback)
 *                      voice:select {taskId}          (answer to a "which one?" question)
 *   server -> client:  voice:interim {transcript} | voice:result {...} | voice:lowconfidence {...}
 *                      voice:error {message} | tasks:changed   (broadcast to the user's other tabs)
 */
function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigins },
    maxHttpBufferSize: 1e6,
    pingInterval: 10000, // heartbeat: detect dead connections quickly
    pingTimeout: 8000,
  });

  io.use((socket, next) => {
    try {
      socket.data.userId = verifyToken(socket.handshake.auth?.token).sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);
    socket.data.timezone = 'UTC';
    socket.data.pending = null;

    let transcriber = null;
    const hits = [];

    const allowed = () => {
      const now = Date.now();
      while (hits.length && now - hits[0] > 60000) hits.shift();
      if (hits.length >= MAX_COMMANDS_PER_MINUTE) return false;
      hits.push(now);
      return true;
    };

    const setTimezone = (tz) => {
      if (isValidTimeZone(tz)) socket.data.timezone = tz;
    };

    const emitResult = ({ transcript, confidence, intent, result, timings }) => {
      const { pending, ...publicResult } = result; // pending intent stays server-side
      socket.data.pending = result.type === 'clarify' ? pending : null;
      socket.emit('voice:result', {
        transcript,
        confidence,
        intent,
        result: publicResult,
        timings: { ...timings, totalMs: Object.values(timings).reduce((a, b) => a + b, 0) },
      });
      if (MUTATING.has(result.type)) io.to(`user:${userId}`).emit('tasks:changed');
    };

    const handleTranscript = async ({ transcript, confidence, sttMs }) => {
      if (!allowed()) return socket.emit('voice:error', { message: 'Too many commands. Wait a moment.' });
      if (!transcript) return socket.emit('voice:error', { message: "I didn't catch anything. Try again." });
      if (confidence !== null && confidence < config.minConfidence) {
        return socket.emit('voice:lowconfidence', { transcript, confidence });
      }
      const tz = socket.data.timezone;
      const t1 = Date.now();
      const intent = await parseIntent(transcript, { timezone: tz });
      const llmMs = Date.now() - t1;
      const t2 = Date.now();
      const result = await executeIntent(userId, intent, { timezone: tz });
      const actionMs = Date.now() - t2;
      emitResult({ transcript, confidence, intent, result, timings: { sttMs, llmMs, actionMs } });
    };

    const guard = (fn) => async (...args) => {
      try {
        await fn(...args);
      } catch (err) {
        console.error('Voice pipeline error:', err);
        socket.emit('voice:error', { message: 'Something went wrong processing that command.' });
      }
    };

    socket.on('voice:start', (payload = {}) => {
      transcriber?.close();
      setTimezone(payload.timezone);
      if (!config.deepgramKey) {
        return socket.emit('voice:error', { message: 'DEEPGRAM_API_KEY is not configured on the server.' });
      }
      transcriber = openTranscriber({
        onInterim: (transcript) => socket.emit('voice:interim', { transcript }),
        onError: () => socket.emit('voice:error', { message: 'Speech recognition failed.' }),
      });
    });

    socket.on('voice:audio', (chunk) => {
      if (transcriber && chunk) transcriber.send(Buffer.from(chunk));
    });

    socket.on(
      'voice:stop',
      guard(async () => {
        const session = transcriber;
        transcriber = null;
        if (!session) return;
        const started = Date.now();
        const { transcript, confidence } = await session.finish();
        await handleTranscript({ transcript, confidence, sttMs: Date.now() - started });
      })
    );

    // Typed fallback: same pipeline, minus speech-to-text.
    socket.on(
      'voice:text',
      guard(async ({ text, timezone } = {}) => {
        setTimezone(timezone);
        await handleTranscript({ transcript: String(text || '').trim().slice(0, 500), confidence: null, sttMs: 0 });
      })
    );

    socket.on(
      'voice:select',
      guard(async ({ taskId } = {}) => {
        const intent = socket.data.pending;
        if (!intent) return socket.emit('voice:error', { message: 'Nothing is waiting for a choice.' });
        const t = Date.now();
        const result = await applyPending(userId, intent, taskId, { timezone: socket.data.timezone });
        emitResult({ transcript: '', confidence: null, intent, result, timings: { sttMs: 0, llmMs: 0, actionMs: Date.now() - t } });
      })
    );

    socket.on('disconnect', () => transcriber?.close());
  });

  return io;
}

module.exports = { attachSocket };
