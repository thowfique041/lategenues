import { createContext, useContext, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('lg_user') || 'null'));
  const login = async (email, password) => {
    const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('lg_token', result.token);
    localStorage.setItem('lg_user', JSON.stringify(result.user));
    setUser(result.user);
  };
  const register = async (details) => {
    const result = await api('/auth/register', { method: 'POST', body: JSON.stringify(details) });
    localStorage.setItem('lg_token', result.token);
    localStorage.setItem('lg_user', JSON.stringify(result.user));
    setUser(result.user);
  };
  const logout = () => { localStorage.removeItem('lg_token'); localStorage.removeItem('lg_user'); setUser(null); };
  const updateUser = (nextUser) => { localStorage.setItem('lg_user', JSON.stringify(nextUser)); setUser(nextUser); };
  return <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>{children}</AuthContext.Provider>;
}
