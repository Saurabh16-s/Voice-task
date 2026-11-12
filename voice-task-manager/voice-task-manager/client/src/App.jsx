import { useCallback, useState } from 'react';
import AuthForm from './AuthForm.jsx';
import Dashboard from './Dashboard.jsx';

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

export default function App() {
  const [token, setToken] = useState(() => read('token'));
  const [user, setUser] = useState(() => { try { return JSON.parse(read('user')); } catch { return null; } });

  const login = (t, u) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  };
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  return token ? <Dashboard token={token} user={user} onLogout={logout} /> : <AuthForm onAuth={login} />;
}
