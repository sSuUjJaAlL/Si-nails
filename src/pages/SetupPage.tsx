import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../services/api';
import { dashboardPath } from '../utils/paths';

export function SetupPage() {
  const { user, loading, setupRequired, completeSetup, checkSetup } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        await checkSetup();
      } finally {
        setChecking(false);
      }
    })();
  }, [checkSetup]);

  if (loading || checking) return <LoadingSpinner label="Checking studio setup…" />;
  if (user) return <Navigate to={dashboardPath(user.role)} replace />;
  if (setupRequired === false) return <Navigate to="/login" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await completeSetup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      showToast('Admin account created successfully.');
      navigate('/admin/dashboard');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Setup failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page setup-page">
      <section className="login-brand">
        <div className="login-brand-inner">
          <img src={logo} alt="SiNails" className="login-logo" />
          <p className="login-tagline">Welcome to SiNails Studio</p>
          <p className="setup-welcome">Let&apos;s set up your studio.</p>
          <div className="login-ornament" aria-hidden="true" />
        </div>
      </section>

      <section className="login-form-panel">
        <form className="login-form" onSubmit={(e) => void onSubmit(e)}>
          <p className="eyebrow">First-time setup</p>
          <h1>Set up your SiNails account</h1>
          <p className="login-sub">Create the studio administrator account to get started.</p>

          <Input
            label="Full Name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <Input
            label="Confirm Password"
            type={showPassword ? 'text' : 'password'}
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />

          <Button type="submit" disabled={submitting} className="login-submit">
            {submitting ? 'Creating…' : 'Create Admin Account'}
          </Button>

          <p className="auth-footer-note">
            Already set up? <Link to="/login">Go to login</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
