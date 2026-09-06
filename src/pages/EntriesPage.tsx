import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import { api, ApiError } from '../services/api';
import type { PaymentType } from '../types';
import { todayInputValue } from '../utils/format';

export type ServiceEntry = {
  id: string;
  date: string;
  time: string;
  clientName: string;
  serviceType: string;
  amount: number;
  paymentType: PaymentType;
  employeeId: string;
};

type Draft = {
  date: string;
  time: string;
  clientName: string;
  serviceType: string;
  amount: string;
  paymentType: PaymentType | '';
};

const emptyDraft = (): Draft => ({
  date: todayInputValue(),
  time: '10:30',
  clientName: '',
  serviceType: '',
  amount: '',
  paymentType: '',
});

function rowToDraft(row: ServiceEntry): Draft {
  return {
    date: row.date,
    time: row.time,
    clientName: row.clientName,
    serviceType: row.serviceType,
    amount: String(row.amount),
    paymentType: row.paymentType,
  };
}

function formatAmountDisplay(amount: number) {
  return `Rs ${amount.toLocaleString('en-NP')}`;
}

function formatTimeLabel(time: string) {
  const [hStr, mStr = '00'] = time.split(':');
  let h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${mStr} ${period}`;
}

export function EntriesPage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<ServiceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ServiceEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: ServiceEntry[] }>('/api/entries');
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startAdd = () => {
    setEditingId('new');
    setDraft(emptyDraft());
  };

  const startEdit = (row: ServiceEntry) => {
    setEditingId(row.id);
    setDraft(rowToDraft(row));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft());
  };

  const save = async () => {
    if (!draft.date || !draft.time || !draft.clientName.trim() || !draft.serviceType.trim()) {
      showToast('Please fill Date, Time, Client Name, and Service Type.', 'error');
      return;
    }
    if (!draft.paymentType) {
      showToast('Payment Type is required.', 'error');
      return;
    }
    const amount = Number(draft.amount);
    if (!amount || amount <= 0) {
      showToast('Amount must be greater than 0.', 'error');
      return;
    }

    setSaving(true);
    try {
      const body = {
        date: draft.date,
        time: draft.time,
        clientName: draft.clientName.trim(),
        serviceType: draft.serviceType.trim(),
        amount,
        paymentType: draft.paymentType,
      };

      if (editingId === 'new') {
        await api.post('/api/entries', body);
        showToast('Entry added successfully.');
      } else if (editingId) {
        await api.put(`/api/entries/${editingId}`, body);
        showToast('Entry updated successfully.');
      }
      setEditingId(null);
      setDraft(emptyDraft());
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not save entry', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/api/entries/${deleting.id}`);
      showToast('Entry deleted successfully.');
      setDeleting(null);
      if (editingId === deleting.id) cancelEdit();
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not delete entry', 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const updateDraft = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const renderEditorCells = () => (
    <>
      <td>
        <input
          className="sheet-input"
          type="date"
          value={draft.date}
          onChange={(e) => updateDraft({ date: e.target.value })}
        />
      </td>
      <td>
        <input
          className="sheet-input"
          type="time"
          value={draft.time}
          onChange={(e) => updateDraft({ time: e.target.value })}
        />
      </td>
      <td>
        <input
          className="sheet-input"
          type="text"
          placeholder="Client name"
          value={draft.clientName}
          onChange={(e) => updateDraft({ clientName: e.target.value })}
        />
      </td>
      <td>
        <input
          className="sheet-input"
          type="text"
          placeholder="e.g. Gel Extension"
          value={draft.serviceType}
          onChange={(e) => updateDraft({ serviceType: e.target.value })}
        />
      </td>
      <td>
        <div className="sheet-amount">
          <span>Rs</span>
          <input
            className="sheet-input"
            type="number"
            min={1}
            step={1}
            placeholder="0"
            value={draft.amount}
            onChange={(e) => updateDraft({ amount: e.target.value })}
          />
        </div>
      </td>
      <td>
        <select
          className="sheet-input sheet-select"
          value={draft.paymentType}
          onChange={(e) => updateDraft({ paymentType: e.target.value as PaymentType | '' })}
        >
          <option value="">Select</option>
          <option value="CASH">Cash</option>
          <option value="ONLINE">Online</option>
        </select>
      </td>
      <td className="sheet-actions">
        <button type="button" className="sheet-btn save" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="sheet-btn" onClick={cancelEdit} disabled={saving}>
          Cancel
        </button>
      </td>
    </>
  );

  return (
    <div className="page entries-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Daily records</p>
          <h1>Entries</h1>
          <p className="muted">Enter client, service, and payment details in the table.</p>
        </div>
        <Button onClick={startAdd} disabled={editingId !== null}>
          + Add Entry
        </Button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState title="Could not load entries" description={error} />
      ) : (
        <div className="sheet-wrap">
          <table className="sheet-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Client Name</th>
                <th>Service Type</th>
                <th>Amount (NPR)</th>
                <th>Payment Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {editingId === 'new' && <tr className="sheet-row editing">{renderEditorCells()}</tr>}

              {rows.length === 0 && editingId !== 'new' ? (
                <tr>
                  <td colSpan={7} className="sheet-empty">
                    No entries yet. Click “+ Add Entry” to start.
                  </td>
                </tr>
              ) : (
                rows.map((row) =>
                  editingId === row.id ? (
                    <tr key={row.id} className="sheet-row editing">
                      {renderEditorCells()}
                    </tr>
                  ) : (
                    <tr key={row.id} className="sheet-row">
                      <td>{row.date}</td>
                      <td>{formatTimeLabel(row.time)}</td>
                      <td>{row.clientName}</td>
                      <td>{row.serviceType}</td>
                      <td className="sheet-amount-cell">{formatAmountDisplay(row.amount)}</td>
                      <td>
                        <span className={`sheet-pay badge-${row.paymentType.toLowerCase()}`}>
                          {row.paymentType === 'CASH' ? 'Cash' : 'Online'}
                        </span>
                      </td>
                      <td className="sheet-actions">
                        <button
                          type="button"
                          className="sheet-btn"
                          onClick={() => startEdit(row)}
                          disabled={editingId !== null}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="sheet-btn danger"
                          onClick={() => setDeleting(row)}
                          disabled={editingId !== null}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        message="Are you sure you want to delete this entry?"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        loading={deleteBusy}
      />
    </div>
  );
}
