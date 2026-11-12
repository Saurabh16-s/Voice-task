import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { useVoice } from './useVoice.js';
import TaskList from './TaskList.jsx';

export default function Dashboard({ token, user, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [text, setText] = useState('');

  const refresh = useCallback(async () => {
    try {
      setTasks((await api('/tasks', { token })).tasks);
    } catch (err) {
      if (err.status === 401) onLogout();
    }
  }, [token, onLogout]);

  const voice = useVoice({ token, onTasksChanged: refresh, onUnauthorized: onLogout });
  useEffect(() => { refresh(); }, [refresh]);

  const toggle = (t) =>
    api(`/tasks/${t._id}`, { token, method: 'PATCH', body: { status: t.status === 'done' ? 'todo' : 'done' } }).then(refresh);
  const remove = (t) => api(`/tasks/${t._id}`, { token, method: 'DELETE' }).then(refresh);

  const submitText = (e) => {
    e.preventDefault();
    voice.sendText(text);
    setText('');
  };

  const { status, result } = voice;
  const listening = status === 'listening';
  const t = result?.timings;

  return (
    <main className="dash">
      <header>
        <h1>Tasks</h1>
        <div className="who">
          <span className={`dot ${voice.connected ? 'on' : 'off'}`} title={voice.connected ? 'Connected' : 'Reconnecting'} />
          <span>{user?.name}</span>
          <button className="link" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <section className="voice" aria-live="polite">
        <button
          className={`mic ${listening ? 'live' : ''}`}
          onPointerDown={voice.start}
          onPointerUp={voice.stop}
          onPointerLeave={listening ? voice.stop : undefined}
          disabled={!voice.connected || status === 'processing'}
          aria-label="Hold to speak"
        >
          {listening ? 'Listening' : status === 'processing' ? 'Working' : 'Hold to speak'}
        </button>

        <p className="transcript">
          {voice.interim || result?.transcript || (voice.connected ? 'Try: "add call the bank tomorrow at 11"' : 'Reconnecting to the server')}
        </p>

        {voice.error && <p className="error" role="alert">{voice.error}</p>}
        {result && result.result.type !== 'clarify' && (
          <p className={result.result.type === 'error' ? 'error' : 'ok'}>{result.result.message}</p>
        )}
        {t && t.totalMs > 0 && (
          <p className="timings">
            {t.totalMs} ms total (speech {t.sttMs} / LLM {t.llmMs} / database {t.actionMs})
          </p>
        )}

        {voice.candidates && (
          <div className="clarify">
            <p>{result.result.message}</p>
            {voice.candidates.map((c) => (
              <button key={c._id} onClick={() => voice.selectTask(c._id)}>{c.title}</button>
            ))}
          </div>
        )}

        {voice.lowConfidence && (
          <div className="clarify">
            <p>I'm not sure I heard that right: "{voice.lowConfidence.transcript}". Edit it below and send.</p>
            <button onClick={() => setText(voice.lowConfidence.transcript)}>Edit what I said</button>
          </div>
        )}

        <form className="typed" onSubmit={submitText}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type a command" maxLength={500} />
          <button disabled={!voice.connected || !text.trim()}>Send</button>
        </form>
      </section>

      {result?.result.type === 'list' && (
        <section className="answer">
          <h2>{result.result.message}</h2>
          <TaskList tasks={result.result.tasks} onToggle={toggle} onDelete={remove} />
        </section>
      )}

      <section>
        <h2>All tasks</h2>
        <TaskList tasks={tasks} onToggle={toggle} onDelete={remove} />
      </section>
    </main>
  );
}
