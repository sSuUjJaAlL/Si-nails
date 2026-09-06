import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { dashboardPath } from '../utils/paths';

export function LoginPage() {
  const { user, loading, login, setupRequired, checkSetup } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        await checkSetup();
      } finally {
        setReady(true);
      }
    })();
  }, [checkSetup]);

  if (loading || !ready) return <LoadingSpinner label="Preparing studio…" />;
  if (setupRequired) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to={dashboardPath(user.role)} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const loggedIn = await login(email.trim(), password);
      showToast('Welcome back to SiNails Studio.');
      navigate(dashboardPath(loggedIn.role));
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Login failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-brand">
        <div className="login-brand-inner">
          <img src={logo} alt="SiNails" className="login-logo" />
          <p className="login-tagline">Beautiful nails. Beautiful moments.</p>
          <div className="login-ornament" aria-hidden="true" />
        </div>
      </section>

      <section className="login-form-panel">
        <form className="login-form" onSubmit={(e) => void onSubmit(e)}>
          <p className="eyebrow">SiNails Studio</p>
          <h1>Welcome back</h1>
          <p className="login-sub">Sign in to manage appointments and studio records.</p>

          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="password-field">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <p className="forgot-placeholder">Forgot password? Contact your studio administrator.</p>

          <Button type="submit" disabled={submitting} className="login-submit">
            {submitting ? 'Signing in…' : 'Login'}
          </Button>

          {setupRequired ? (
            <p className="auth-footer-note">
              First time setup? <Link to="/setup">Create Admin Account</Link>
            </p>
          ) : (
            <p className="auth-footer-note">
              New here? <Link to="/signup">Create a user account</Link>
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
