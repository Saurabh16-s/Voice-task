import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SERVER } from './api.js';

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Owns the Socket.io connection and the push-to-talk microphone pipeline:
// MediaRecorder -> 250ms audio chunks -> WebSocket -> server -> Deepgram -> intent -> task update.
export function useVoice({ token, onTasksChanged, onUnauthorized }) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | listening | processing
  const [interim, setInterim] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState(null);
  const [lowConfidence, setLowConfidence] = useState(null);

  const socketRef = useRef(null);
  const recorderRef = useRef(null);
  const queueRef = useRef(Promise.resolve());
  const changedRef = useRef(onTasksChanged);
  const unauthorizedRef = useRef(onUnauthorized);
  changedRef.current = onTasksChanged;
  unauthorizedRef.current = onUnauthorized;

  useEffect(() => {
    const socket = io(SERVER || undefined, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      changedRef.current?.(); // resync after (re)connecting
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      setConnected(false);
      if (err.message === 'unauthorized') unauthorizedRef.current?.();
    });
    socket.on('tasks:changed', () => changedRef.current?.());
    socket.on('voice:interim', ({ transcript }) => setInterim(transcript));
    socket.on('voice:result', (payload) => {
      setStatus('idle');
      setInterim('');
      setError('');
      setLowConfidence(null);
      setResult(payload);
      setCandidates(payload.result.type === 'clarify' ? payload.result.candidates : null);
    });
    socket.on('voice:lowconfidence', (payload) => {
      setStatus('idle');
      setLowConfidence(payload);
    });
    socket.on('voice:error', ({ message }) => {
      setStatus('idle');
      setInterim('');
      setError(message);
    });

    return () => socket.disconnect();
  }, [token]);

  const reset = () => {
    setError('');
    setResult(null);
    setCandidates(null);
    setLowConfidence(null);
    setInterim('');
  };

  const start = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket?.connected || status !== 'idle') return;
    reset();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      setError('Microphone access was blocked. Allow it in your browser settings.');
      return;
    }
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    queueRef.current = Promise.resolve();

    recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      // Chain so chunks reach the server in order.
      queueRef.current = queueRef.current
        .then(() => e.data.arrayBuffer())
        .then((buf) => socket.emit('voice:audio', buf));
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      queueRef.current.then(() => socket.emit('voice:stop'));
    };

    socket.emit('voice:start', { timezone });
    recorder.start(250);
    setStatus('listening');
  }, [status]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      setStatus('processing');
    }
  }, []);

  const sendText = useCallback((text) => {
    if (!text.trim()) return;
    reset();
    setStatus('processing');
    socketRef.current?.emit('voice:text', { text, timezone });
  }, []);

  const selectTask = useCallback((taskId) => {
    setCandidates(null);
    setStatus('processing');
    socketRef.current?.emit('voice:select', { taskId });
  }, []);

  return { connected, status, interim, result, error, candidates, lowConfidence, start, stop, sendText, selectTask };
}
