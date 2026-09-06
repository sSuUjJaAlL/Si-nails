import { FormEvent, useEffect, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { Table } from '../components/Table';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../services/api';
import type { Role, User, UserStatus } from '../types';
import { formatDateNp } from '../utils/format';

type UsersResponse = {
  data: User[];
  meta: { adminCount: number; maxAdmins: number; canCreateAdmin: boolean };
};

export function UsersPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<User[]>([]);
  const [meta, setMeta] = useState({ adminCount: 0, maxAdmins: 2, canCreateAdmin: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('USER');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<UsersResponse>('/api/users');
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setRole('USER');
    setStatus('ACTIVE');
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setName(u.name);
    setEmail(u.email);
    setPassword('');
    setConfirmPassword('');
    setRole(u.role);
    setStatus(u.status);
    setModalOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if ((!editing || password) && password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const body: Record<string, unknown> = { name, email, status, role };
        if (password) body.password = password;
        await api.put(`/api/users/${editing.id}`, body);
        showToast('User updated successfully.');
      } else {
        if (!password) {
          showToast('Password is required', 'error');
          setSaving(false);
          return;
        }
        await api.post('/api/users', {
          name,
          email,
          password,
          confirmPassword,
          status,
          role,
        });
        showToast(role === 'ADMIN' ? 'Admin account created successfully.' : 'User created successfully.');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not save user', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u: User) => {
    try {
      await api.put(`/api/users/${u.id}`, {
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      showToast(u.status === 'ACTIVE' ? 'User deactivated.' : 'User activated.');
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update user', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await api.delete<{ message: string }>(`/api/users/${deleting.id}`);
      showToast(res.message || 'User deleted successfully.');
      setDeleting(null);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not delete user', 'error');
    } finally {
      setBusy(false);
    }
  };

  const canDelete = (u: User) => !(u.role === 'ADMIN' && meta.adminCount <= 1);
  const roleOptions = () => {
    if (editing?.role === 'ADMIN') {
      return [
        { value: 'ADMIN', label: 'Admin' },
        { value: 'USER', label: 'User' },
      ];
    }
    if (meta.canCreateAdmin) {
      return [
        { value: 'USER', label: 'User' },
        { value: 'ADMIN', label: 'Admin' },
      ];
    }
    return [{ value: 'USER', label: 'User' }];
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Users</h1>
          <p className="muted">
            Admins: {meta.adminCount} / {meta.maxAdmins}
            {!meta.canCreateAdmin ? ' · Admin limit reached' : ''}
          </p>
        </div>
        <Button onClick={openCreate}>+ Add User</Button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState title="Could not load users" description={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="No users found." />
      ) : (
        <Table
          columns={[
            { key: 'name', header: 'Name', render: (u) => u.name },
            { key: 'email', header: 'Email', render: (u) => u.email },
            { key: 'role', header: 'Role', render: (u) => <Badge type={u.role} /> },
            { key: 'status', header: 'Status', render: (u) => <Badge type={u.status} /> },
            {
              key: 'created',
              header: 'Created Date',
              render: (u) => (u.createdAt ? formatDateNp(u.createdAt) : '—'),
            },
            {
              key: 'actions',
              header: 'Actions',
              className: 'actions-col',
              render: (u) => (
                <div className="row-actions">
                  <button type="button" onClick={() => openEdit(u)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => void toggleStatus(u)}>
                    {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className="danger-text"
                    disabled={!canDelete(u)}
                    title={
                      !canDelete(u)
                        ? 'You cannot delete the only administrator account.'
                        : 'Delete'
                    }
                    onClick={() => canDelete(u) && setDeleting(u)}
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          mobileCard={(u) => (
            <>
              <div className="mobile-card-top">
                <strong>{u.name}</strong>
                <Badge type={u.status} />
              </div>
              <p>{u.email}</p>
              <Badge type={u.role} />
              <div className="row-actions">
                <button type="button" onClick={() => openEdit(u)}>
                  Edit
                </button>
              </div>
            </>
          )}
        />
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit User' : 'Add User'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save({ preventDefault() {} } as FormEvent)} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form className="form-grid" onSubmit={(e) => void save(e)}>
          <Input label="Full Name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label={editing ? 'New password (optional)' : 'Password'}
            type="password"
            required={!editing}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Confirm Password"
            type="password"
            required={!editing || !!password}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            options={roleOptions()}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as UserStatus)}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
          />
          {!meta.canCreateAdmin && role === 'USER' && (
            <p className="muted span-2">Admin limit ({meta.maxAdmins}) reached. New accounts must be USER.</p>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message="Are you sure you want to delete this user?"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        loading={busy}
      />
    </div>
  );
}
