import { useState } from 'react';
import { api } from './api.js';

export default function AuthForm({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = mode === 'login' ? { email: form.email, password: form.password } : form;
      const data = await api(`/auth/${mode}`, { method: 'POST', body });
      onAuth(data.token, data.user);
    } catch (err) {
      setError(err.details?.[0]?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <h1>Say it. It's done.</h1>
      <p className="lede">Speak your tasks and they land on your list.</p>
      <form onSubmit={submit}>
        {mode === 'register' && (
          <label>Name<input value={form.name} onChange={set('name')} required autoComplete="name" /></label>
        )}
        <label>Email<input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
        <label>
          Password
          <input type="password" minLength={8} value={form.password} onChange={set('password')} required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{mode === 'login' ? 'Log in' : 'Create account'}</button>
      </form>
      <button className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
      </button>
    </main>
  );
}
