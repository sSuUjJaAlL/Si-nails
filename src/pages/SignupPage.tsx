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

export function SignupPage() {
  const { user, loading, setupRequired, signup, checkSetup } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
  if (user) return <Navigate to={dashboardPath(user.role)} replace />;
  if (setupRequired) return <Navigate to="/setup" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const created = await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      showToast('Account created successfully.');
      navigate(dashboardPath(created.role));
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Signup failed', 'error');
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
          <h1>Create account</h1>
          <p className="login-sub">Register as a studio user. Admin role cannot be selected here.</p>

          <Input label="Full Name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="password-field">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <Input
            label="Confirm Password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Button type="submit" disabled={submitting} className="login-submit">
            {submitting ? 'Creating…' : 'Sign up'}
          </Button>

          <p className="auth-footer-note">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
