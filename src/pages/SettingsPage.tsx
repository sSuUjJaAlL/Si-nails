import { Link } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import { useAuth } from '../context/AuthContext';

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Settings</h1>
        </div>
        <Link to="/admin/profile" className="text-link">
          Edit profile →
        </Link>
      </div>

      <section className="panel settings-panel">
        <div className="settings-brand">
          <img src={logo} alt="SiNails" />
          <div>
            <h2>SiNails Studio</h2>
            <p>Luxury minimalist nail studio management</p>
          </div>
        </div>

        <dl className="detail-list">
          <div>
            <dt>Timezone</dt>
            <dd>Asia/Kathmandu</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>NRs (Nepalese Rupee)</dd>
          </div>
          <div>
            <dt>Date format</dt>
            <dd>06 Sep 2026</dd>
          </div>
          <div>
            <dt>Time format</dt>
            <dd>10:30 AM</dd>
          </div>
          <div>
            <dt>Signed in as</dt>
            <dd>
              {user?.name} ({user?.email})
            </dd>
          </div>
        </dl>

        <p className="muted settings-note">
          Studio preferences are fixed for Nepal operations. Manage accounts from the Users
          page. Maximum 2 admin accounts are allowed.
        </p>
      </section>
    </div>
  );
}
