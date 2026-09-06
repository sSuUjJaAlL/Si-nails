import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { api, ApiError } from '../services/api';
import type { PaymentType } from '../types';
import { formatDateNp, formatNrs, formatTimeDisplay, todayInputValue } from '../utils/format';

type ActivityEntry = {
  id: string;
  date: string;
  time: string;
  clientName: string;
  serviceType: string;
  amount: number;
  paymentType: PaymentType;
  employeeId: string;
  employeeName: string;
};

type ActivityData = {
  date: string;
  summary: {
    totalClients: number;
    totalServices: number;
    totalRevenue: number;
    cashRevenue: number;
    onlineRevenue: number;
  };
  entries: ActivityEntry[];
  recent: ActivityEntry[];
};

function EntriesTable({
  rows,
  showDate = false,
}: {
  rows: ActivityEntry[];
  showDate?: boolean;
}) {
  return (
    <div className="sheet-wrap activity-sheet">
      <table className="sheet-table">
        <thead>
          <tr>
            {showDate && <th>Date</th>}
            <th>Time</th>
            <th>Employee</th>
            <th>Client Name</th>
            <th>Service Type</th>
            <th>Amount (NPR)</th>
            <th>Payment Type</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="sheet-row">
              {showDate && <td>{formatDateNp(row.date)}</td>}
              <td>{formatTimeDisplay(row.time)}</td>
              <td>{row.employeeName}</td>
              <td>{row.clientName}</td>
              <td>{row.serviceType}</td>
              <td className="sheet-amount-cell">{formatNrs(row.amount)}</td>
              <td>
                <span className={`sheet-pay badge-${row.paymentType.toLowerCase()}`}>
                  {row.paymentType === 'CASH' ? 'Cash' : 'Online'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminDashboardPage() {
  const [date, setDate] = useState(todayInputValue());
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState('');

  const load = useCallback(async (selectedDate: string, soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ date: selectedDate });
      const res = await api.get<{ data: ActivityData }>(`/api/reports/activity?${params}`);
      setData({
        ...res.data,
        recent: res.data.recent || [],
      });
      setLastSynced(new Date().toLocaleTimeString('en-NP', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard');
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load(date, true);
    }, 15000);
    return () => window.clearInterval(id);
  }, [date, load]);

  useEffect(() => {
    const onFocus = () => void load(date, true);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(date, true);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [date, load]);

  const isToday = date === todayInputValue();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Owner live feed</p>
          <h1>Live Activity</h1>
          <p className="muted">
            Everything employees enter shows here from the database
            {lastSynced ? ` · synced ${lastSynced}` : ''}.
          </p>
        </div>
        <div className="quick-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDate(todayInputValue())}
            disabled={isToday}
          >
            Today
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Select date"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => void load(date, true)}
            disabled={refreshing || loading}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState title="Could not load activity" description={error} />
      ) : !data ? null : (
        <>
          <p className="eyebrow" style={{ marginTop: '0.25rem' }}>
            {isToday ? "TODAY'S SUMMARY" : `SUMMARY · ${formatDateNp(date)}`}
          </p>
          <div className="stat-grid">
            <div className="stat-card">
              <p>Total Clients</p>
              <strong>{data.summary.totalClients}</strong>
            </div>
            <div className="stat-card">
              <p>Total Services</p>
              <strong>{data.summary.totalServices}</strong>
            </div>
            <div className="stat-card">
              <p>Total Revenue</p>
              <strong>{formatNrs(data.summary.totalRevenue)}</strong>
            </div>
            <div className="stat-card">
              <p>Cash</p>
              <strong>{formatNrs(data.summary.cashRevenue)}</strong>
            </div>
            <div className="stat-card">
              <p>Online</p>
              <strong>{formatNrs(data.summary.onlineRevenue)}</strong>
            </div>
          </div>

          <section className="panel">
            <div className="panel-header">
              <h2>{isToday ? "Today's entries" : `Entries · ${formatDateNp(date)}`}</h2>
              <span className="muted">{data.entries.length} record(s)</span>
            </div>

            {data.entries.length === 0 ? (
              <EmptyState
                title="No entries for this date"
                description="When employees add records in Entries, they appear here immediately after Refresh."
              />
            ) : (
              <EntriesTable rows={data.entries} />
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Latest from all employees</h2>
              <span className="muted">Most recent {data.recent.length}</span>
            </div>
            {data.recent.length === 0 ? (
              <EmptyState
                title="No employee entries yet"
                description="Ask a user to add a client/service row on Entries — it will show here."
              />
            ) : (
              <EntriesTable rows={data.recent} showDate />
            )}
          </section>
        </>
      )}
    </div>
  );
}
