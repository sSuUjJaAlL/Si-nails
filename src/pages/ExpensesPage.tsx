import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { Table } from '../components/Table';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../services/api';
import type { Expense, ExpenseCategory } from '../types';
import { formatDateNp, formatNrs, todayInputValue } from '../utils/format';

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'FOOD', label: 'Food' },
  { value: 'TRANSPORTATION', label: 'Transportation' },
  { value: 'SUPPLIES', label: 'Supplies' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'RENT', label: 'Rent' },
  { value: 'OTHER', label: 'Other' },
];

function categoryLabel(c: ExpenseCategory) {
  return CATEGORY_OPTIONS.find((o) => o.value === c)?.label || c;
}

type ExpenseUser = { id: string; name: string; email: string };

type FormState = {
  description: string;
  category: ExpenseCategory | '';
  amount: string;
  date: string;
  userId: string;
};

const emptyForm = (): FormState => ({
  description: '',
  category: '',
  amount: '',
  date: todayInputValue(),
  userId: '',
});

export function ExpensesPage() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<ExpenseUser[]>([]);
  const [filterUserId, setFilterUserId] = useState('');
  const [formUserId, setFormUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get<{ data: ExpenseUser[] }>('/api/expenses/users');
      setUsers(res.data);
    } catch {
      setUsers([]);
    }
  }, [isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (isAdmin && filterUserId) params.set('userId', filterUserId);
      const qs = params.toString();
      const res = await api.get<{
        data: Expense[];
        summary: { totalExpenses: number; count: number };
      }>(`/api/expenses${qs ? `?${qs}` : ''}`);
      setRows(res.data);
      setTotal(res.summary.totalExpenses);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load expenses');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, filterUserId]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.category) {
      showToast('Category is required', 'error');
      return;
    }
    if (isAdmin && !formUserId) {
      showToast('Select a user account for this expense', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/expenses', {
        description: form.description.trim(),
        category: form.category,
        amount: Number(form.amount),
        date: form.date,
        ...(isAdmin ? { userId: formUserId } : {}),
      });
      showToast('Expense added successfully.');
      setForm({ ...emptyForm(), userId: formUserId });
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not add expense', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: Expense) => {
    setEditing(row);
    setEditForm({
      description: row.description,
      category: row.category,
      amount: String(row.amount),
      date: row.date,
      userId: row.userId,
    });
  };

  const onEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editForm.category) return;
    setSaving(true);
    try {
      await api.put(`/api/expenses/${editing.id}`, {
        description: editForm.description.trim(),
        category: editForm.category,
        amount: Number(editForm.amount),
        date: editForm.date,
      });
      showToast('Expense updated successfully.');
      setEditing(null);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update expense', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/api/expenses/${deleting.id}`);
      showToast('Expense deleted successfully.');
      setDeleting(null);
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not delete', 'error');
    } finally {
      setBusy(false);
    }
  };

  const selectedUserName =
    users.find((u) => u.id === (filterUserId || formUserId))?.name ||
    (filterUserId ? rows[0]?.userName : '');

  const totalLabel = isAdmin
    ? filterUserId
      ? `${selectedUserName || 'User'}'s Total Expenses`
      : 'Total User Expenses'
    : 'My Total Expenses';

  const columns = useMemo(() => {
    const cols: Array<{
      key: string;
      header: string;
      className?: string;
      render: (r: Expense) => ReactNode;
    }> = [];

    if (isAdmin) {
      cols.push({ key: 'user', header: 'User', render: (r) => r.userName });
    }
    cols.push(
      { key: 'description', header: 'Expense', render: (r) => r.description },
      { key: 'category', header: 'Category', render: (r) => categoryLabel(r.category) },
      { key: 'amount', header: 'Amount', render: (r) => formatNrs(r.amount) },
      { key: 'date', header: 'Date', render: (r) => formatDateNp(r.date) }
    );
    if (isAdmin) {
      cols.push({
        key: 'addedBy',
        header: 'Added By',
        render: (r) =>
          r.createdByRole === 'ADMIN' ? `Admin (${r.createdByName})` : r.createdByName,
      });
    }
    cols.push({
      key: 'actions',
      header: 'Action',
      className: 'actions-col',
      render: (r) => (
        <div className="row-actions">
          <button type="button" onClick={() => openEdit(r)}>
            Edit
          </button>
          <button type="button" className="danger-text" onClick={() => setDeleting(r)}>
            Delete
          </button>
        </div>
      ),
    });
    return cols;
  }, [isAdmin]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">{isAdmin ? 'Business tracking' : 'My finances'}</p>
          <h1>Expenses</h1>
          <p className="muted">
            {isAdmin
              ? 'Add and monitor expenses for user/business accounts. Admins do not have a personal expense account.'
              : 'Track your own expenses only.'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>{isAdmin ? 'Add Expense For User' : 'Add Expense'}</h2>
        </div>
        <form className="form-grid" onSubmit={(e) => void onAdd(e)}>
          {isAdmin && (
            <Select
              label="Select User"
              required
              value={formUserId}
              onChange={(e) => setFormUserId(e.target.value)}
              placeholder="Select user account"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
            />
          )}
          <Input
            label="Expense"
            required
            placeholder="e.g. Petrol"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Select
            label="Category"
            required
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
            placeholder="Select category"
            options={CATEGORY_OPTIONS}
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
          <Input
            label="Date"
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <div className="field" style={{ alignSelf: 'end' }}>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </section>

      {isAdmin && (
        <div className="filters-bar">
          <Select
            label="View expenses for"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            placeholder="All Users"
            options={users.map((u) => ({ value: u.id, label: u.name }))}
          />
        </div>
      )}

      <div className="stat-grid three" style={{ marginBottom: '1rem' }}>
        <div className="stat-card">
          <p>{totalLabel}</p>
          <strong>{formatNrs(total)}</strong>
        </div>
        <div className="stat-card">
          <p>Records</p>
          <strong>{rows.length}</strong>
        </div>
        {!isAdmin && (
          <div className="stat-card">
            <p>Account</p>
            <strong>{user?.name || '—'}</strong>
          </div>
        )}
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>{isAdmin ? 'User Expenses' : 'My Expenses'}</h2>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <EmptyState title="Could not load expenses" description={error} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No expenses yet"
            description={
              isAdmin
                ? 'Select a user and add an expense, or wait for users to add their own.'
                : 'Add your first expense using the form above.'
            }
          />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            mobileCard={(r) => (
              <>
                <div className="mobile-card-top">
                  <strong>{r.description}</strong>
                  <span>{formatNrs(r.amount)}</span>
                </div>
                {isAdmin && <p>User: {r.userName}</p>}
                <p>
                  {categoryLabel(r.category)} · {formatDateNp(r.date)}
                  {isAdmin ? ` · Added by ${r.createdByName}` : ''}
                </p>
                <div className="row-actions">
                  <button type="button" onClick={() => openEdit(r)}>
                    Edit
                  </button>
                  <button type="button" className="danger-text" onClick={() => setDeleting(r)}>
                    Delete
                  </button>
                </div>
              </>
            )}
          />
        )}
      </section>

      <Modal
        open={!!editing}
        title="Edit Expense"
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void onEdit({ preventDefault() {} } as FormEvent)} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form className="form-grid" onSubmit={(e) => void onEdit(e)}>
          <Input
            label="Expense"
            required
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          />
          <Select
            label="Category"
            required
            value={editForm.category}
            onChange={(e) => setEditForm({ ...editForm, category: e.target.value as ExpenseCategory })}
            options={CATEGORY_OPTIONS}
          />
          <Input
            label="Amount (NPR)"
            type="number"
            min={1}
            required
            value={editForm.amount}
            onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
          />
          <Input
            label="Date"
            type="date"
            required
            value={editForm.date}
            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        message="Are you sure you want to delete this expense?"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        loading={busy}
      />
    </div>
  );
}
