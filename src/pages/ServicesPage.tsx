import { FormEvent, useEffect, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../services/api';
import type { Service } from '../types';
import { formatNrs } from '../utils/format';

export function ServicesPage() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Service | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: Service[] }>('/api/services');
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load services');
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
    setPrice('');
    setActive(true);
    setModalOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setName(s.name);
    setPrice(String(s.defaultPrice));
    setActive(s.active);
    setModalOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { name, defaultPrice: Number(price), active };
      if (editing) {
        await api.put(`/api/services/${editing.id}`, body);
        showToast('Service updated successfully.');
      } else {
        await api.post('/api/services', body);
        showToast('Service created successfully.');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not save service', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: Service) => {
    try {
      await api.put(`/api/services/${s.id}`, {
        name: s.name,
        defaultPrice: s.defaultPrice,
        active: !s.active,
      });
      showToast(s.active ? 'Service deactivated.' : 'Service activated.');
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update service', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await api.delete<{ message: string }>(`/api/services/${deleting.id}`);
      showToast(res.message || 'Service deleted successfully.');
      setDeleting(null);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not delete service', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Services</h1>
        </div>
        {isAdmin && <Button onClick={openCreate}>+ Add Service</Button>}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState title="Could not load services" description={error} />
      ) : rows.length === 0 ? (
        <EmptyState title="No services found." />
      ) : (
        <Table
          columns={[
            { key: 'name', header: 'Service', render: (s) => s.name },
            { key: 'price', header: 'Default Price', render: (s) => formatNrs(s.defaultPrice) },
            {
              key: 'status',
              header: 'Status',
              render: (s) => <Badge type={s.active ? 'ACTIVE' : 'INACTIVE'} />,
            },
            {
              key: 'actions',
              header: 'Actions',
              className: 'actions-col',
              render: (s) =>
                isAdmin ? (
                  <div className="row-actions">
                    <button type="button" onClick={() => openEdit(s)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => void toggleActive(s)}>
                      {s.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className="danger-text" onClick={() => setDeleting(s)}>
                      Delete
                    </button>
                  </div>
                ) : (
                  <span className="muted">View only</span>
                ),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          mobileCard={(s) => (
            <>
              <div className="mobile-card-top">
                <strong>{s.name}</strong>
                <Badge type={s.active ? 'ACTIVE' : 'INACTIVE'} />
              </div>
              <p>{formatNrs(s.defaultPrice)}</p>
              {isAdmin && (
                <div className="row-actions">
                  <button type="button" onClick={() => openEdit(s)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => void toggleActive(s)}>
                    {s.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              )}
            </>
          )}
        />
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Service' : 'Add Service'}
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
          <Input label="Service name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="Default price (NRs)"
            type="number"
            min={1}
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <label className="checkbox-field">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message="Are you sure you want to delete this service?"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        loading={busy}
      />
    </div>
  );
}
