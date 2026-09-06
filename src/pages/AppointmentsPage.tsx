import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { Select } from '../components/Select';
import { Table } from '../components/Table';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../services/api';
import type {
  Appointment,
  AppointmentStatus,
  Client,
  Paginated,
  PaymentType,
} from '../types';
import { formatDateNp, formatNrs, formatTimeDisplay, todayInputValue } from '../utils/format';

type FormState = {
  date: string;
  time: string;
  clientId: string;
  newClientName: string;
  newClientPhone: string;
  useNewClient: boolean;
  serviceName: string;
  amount: string;
  paymentType: PaymentType | '';
  status: AppointmentStatus;
};

const emptyForm = (): FormState => ({
  date: todayInputValue(),
  time: '10:30',
  clientId: '',
  newClientName: '',
  newClientPhone: '',
  useNewClient: true,
  serviceName: '',
  amount: '',
  paymentType: 'CASH',
  status: 'PENDING',
});

const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function statusLabel(s: AppointmentStatus) {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label || s;
}

export function AppointmentsPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Appointment[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [deleting, setDeleting] = useState<Appointment | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sort: 'newest',
      });
      if (search.trim()) params.set('search', search.trim());
      if (date) params.set('date', date);
      if (status) params.set('status', status);
      if (employeeId) params.set('employeeId', employeeId);

      const res = await api.get<Paginated<Appointment>>(`/api/appointments?${params}`);
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const [cli, emp] = await Promise.all([
          api.get<Paginated<Client>>('/api/clients?limit=100'),
          api.get<{ data: Array<{ id: string; name: string }> }>('/api/appointments/employees'),
        ]);
        setClients(cli.data);
        setEmployees(emp.data);
      } catch {
        /* page load surfaces errors */
      }
    })();
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, date, status, employeeId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (a: Appointment) => {
    setEditing(a);
    setForm({
      date: a.date,
      time: a.time,
      clientId: a.client.id,
      newClientName: '',
      newClientPhone: '',
      useNewClient: false,
      serviceName: a.service.name,
      amount: String(a.amount),
      paymentType: a.paymentType,
      status: a.status || 'PENDING',
    });
    setModalOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.paymentType) {
      showToast('Payment type is required', 'error');
      return;
    }
    if (!form.serviceName.trim()) {
      showToast('Service is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        date: form.date,
        time: form.time,
        serviceName: form.serviceName.trim(),
        amount: Number(form.amount),
        paymentType: form.paymentType,
        status: form.status,
        ...(form.useNewClient
          ? { newClient: { name: form.newClientName, phone: form.newClientPhone || undefined } }
          : { clientId: form.clientId }),
      };

      if (editing) {
        await api.put(`/api/appointments/${editing.id}`, body);
        showToast('Appointment updated successfully.');
      } else {
        await api.post('/api/appointments', body);
        showToast('Appointment added successfully.');
      }
      setModalOpen(false);
      await load();
      const cli = await api.get<Paginated<Client>>('/api/clients?limit=100');
      setClients(cli.data);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not save appointment', 'error');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (a: Appointment, next: AppointmentStatus) => {
    try {
      await api.put(`/api/appointments/${a.id}`, {
        date: a.date,
        time: a.time,
        clientId: a.client.id,
        serviceName: a.service.name,
        amount: a.amount,
        paymentType: a.paymentType,
        status: next,
      });
      showToast(`Marked as ${statusLabel(next)}.`);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update status', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await api.delete(`/api/appointments/${deleting.id}`);
      showToast('Appointment deleted successfully.');
      setDeleting(null);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not delete', 'error');
    } finally {
      setDeletingBusy(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'date',
        header: 'Date',
        render: (a: Appointment) => formatDateNp(a.date),
      },
      {
        key: 'time',
        header: 'Time',
        render: (a: Appointment) => formatTimeDisplay(a.time),
      },
      {
        key: 'client',
        header: 'Client',
        render: (a: Appointment) => a.client.name,
      },
      {
        key: 'service',
        header: 'Service',
        render: (a: Appointment) => a.service.name,
      },
      {
        key: 'employee',
        header: 'Employee',
        render: (a: Appointment) => a.employee?.name || a.createdBy?.name || '—',
      },
      {
        key: 'status',
        header: 'Status',
        render: (a: Appointment) => (
          <span className={`status-pill status-${(a.status || 'PENDING').toLowerCase()}`}>
            {statusLabel(a.status || 'PENDING')}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        className: 'actions-col',
        render: (a: Appointment) => (
          <div className="row-actions">
            <Select
              value={a.status || 'PENDING'}
              onChange={(e) => void changeStatus(a, e.target.value as AppointmentStatus)}
              options={STATUS_OPTIONS}
              aria-label="Change status"
            />
            <button type="button" onClick={() => openEdit(a)}>
              Edit
            </button>
            <button type="button" className="danger-text" onClick={() => setDeleting(a)}>
              Delete
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Scheduling</p>
          <h1>Appointments</h1>
          <p className="muted">All studio appointments from every employee.</p>
        </div>
        <Button onClick={openCreate}>+ Add Appointment</Button>
      </div>

      <div className="filters-bar">
        <Input
          placeholder="Search client, service, employee"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              void load();
            }
          }}
        />
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setPage(1);
            setDate(e.target.value);
          }}
        />
        <Select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          placeholder="All statuses"
          options={STATUS_OPTIONS}
        />
        <Select
          value={employeeId}
          onChange={(e) => {
            setPage(1);
            setEmployeeId(e.target.value);
          }}
          placeholder="All employees"
          options={employees.map((e) => ({ value: e.id, label: e.name }))}
        />
        <Button
          variant="secondary"
          onClick={() => {
            setPage(1);
            void load();
          }}
        >
          Search
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setSearch('');
            setDate('');
            setStatus('');
            setEmployeeId('');
            setPage(1);
          }}
        >
          Clear
        </Button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState title="Could not load appointments" description={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No appointments found."
          description="Add an appointment or adjust filters."
          actionLabel="+ Add Appointment"
          onAction={openCreate}
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            mobileCard={(a) => (
              <>
                <div className="mobile-card-top">
                  <strong>{a.client.name}</strong>
                  <span className={`status-pill status-${(a.status || 'PENDING').toLowerCase()}`}>
                    {statusLabel(a.status || 'PENDING')}
                  </span>
                </div>
                <p>
                  {formatDateNp(a.date)} · {formatTimeDisplay(a.time)}
                </p>
                <p>
                  {a.service.name} · {a.employee?.name || a.createdBy?.name || '—'} ·{' '}
                  {formatNrs(a.amount)}
                </p>
                <div className="row-actions">
                  <button type="button" onClick={() => openEdit(a)}>
                    Edit
                  </button>
                  <button type="button" className="danger-text" onClick={() => setDeleting(a)}>
                    Delete
                  </button>
                </div>
              </>
            )}
          />
          <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
        </>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Appointment' : 'Add Appointment'}
        onClose={() => setModalOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void onSubmit({ preventDefault() {} } as FormEvent)} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          <Input
            label="Date"
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Input
            label="Time"
            type="time"
            required
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
          />

          <div className="field span-2">
            <div className="inline-toggle">
              <span className="field-label">Client</span>
              <button
                type="button"
                className="text-btn"
                onClick={() => setForm({ ...form, useNewClient: !form.useNewClient })}
              >
                {form.useNewClient ? 'Select existing client' : 'Add new client'}
              </button>
            </div>
            {form.useNewClient ? (
              <div className="form-grid tight">
                <Input
                  label="Client name"
                  required
                  value={form.newClientName}
                  onChange={(e) => setForm({ ...form, newClientName: e.target.value })}
                />
                <Input
                  label="Phone"
                  value={form.newClientPhone}
                  onChange={(e) => setForm({ ...form, newClientPhone: e.target.value })}
                />
              </div>
            ) : (
              <Select
                required
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                placeholder="Select client"
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
              />
            )}
          </div>

          <Input
            label="Service"
            required
            placeholder="e.g. Facial, Nails, Haircut"
            value={form.serviceName}
            onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
          />
          <Input
            label="Amount (NPR)"
            type="number"
            min={1}
            step="1"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <Select
            label="Payment Type"
            required
            value={form.paymentType}
            onChange={(e) => setForm({ ...form, paymentType: e.target.value as PaymentType })}
            options={[
              { value: 'CASH', label: 'Cash' },
              { value: 'ONLINE', label: 'Online' },
            ]}
          />
          <Select
            label="Status"
            required
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as AppointmentStatus })}
            options={STATUS_OPTIONS}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message="Are you sure you want to delete this appointment?"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        loading={deletingBusy}
      />
    </div>
  );
}
