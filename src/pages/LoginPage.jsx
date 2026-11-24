// One page for both "Log in" and "Create account" (mode="login" | "register")
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../api/httpClient.js';
import { LogoFull } from '../components/Logo.jsx';
import Footer from '../components/Footer.jsx';

export default function LoginPage({ mode }) {
  const isRegister = mode === 'register';
  const { user, login, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const updateField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsBusy(true);
    try {
      if (isRegister) await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="page-center">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo"><LogoFull width={190} /></div>
        <h1>{isRegister ? 'Create your account' : 'Log in'}</h1>
        <p className="muted">Save, organize and send API requests.</p>

        {isRegister && (
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={updateField('name')} required autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={updateField('email')} required autoComplete="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={updateField('password')}
            required
            minLength={6}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
        </label>

        {error && <p className="field-error">{error}</p>}

        <button className="btn btn-primary btn-block" disabled={isBusy}>
          {isBusy ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
        </button>

        <p className="muted small">
          {isRegister ? 'Already have an account? ' : 'New here? '}
          <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Create an account'}</Link>
        </p>
      </form>
      <Footer className="app-footer-floating" />
    </div>
  );
}
