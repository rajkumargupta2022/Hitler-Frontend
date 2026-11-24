// Keeps the logged-in user available to every component via useAuth().
import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On page load: if we have a saved token, ask the server who we are
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  function saveSession({ token, user }) {
    localStorage.setItem('token', token);
    setUser(user);
  }

  const login = async (email, password) => saveSession(await authApi.login({ email, password }));
  const register = async (name, email, password) => saveSession(await authApi.register({ name, email, password }));

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
