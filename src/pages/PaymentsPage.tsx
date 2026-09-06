import { useEffect, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Pagination } from '../components/Pagination';
import { Select } from '../components/Select';
import { Table } from '../components/Table';
import { api, ApiError } from '../services/api';
import type { Paginated, PaymentRow, PaymentType } from '../types';
import { formatDateNp, formatNrs, formatTimeDisplay } from '../utils/format';

type PaymentsResponse = Paginated<PaymentRow> & {
  summary: { totalRevenue: number; cashRevenue: number; onlineRevenue: number };
};

export function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState({ totalRevenue: 0, cashRevenue: 0, onlineRevenue: 0 });
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (opts?: { page?: number; search?: string }) => {
    const p = opts?.page ?? page;
    const q = opts?.search ?? query;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (q.trim()) params.set('search', q.trim());
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (paymentType) params.set('paymentType', paymentType);
      const res = await api.get<PaymentsResponse>(`/api/payments?${params}`);
      setRows(res.data);
      setSummary(res.summary);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load payments');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, from, to, paymentType, query]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Finance</p>
          <h1>Payments</h1>
          <p className="muted">All cash and online payments from employee entries.</p>
        </div>
        <Button variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <div className="stat-grid three">
        <div className="stat-card">
          <p>Total Revenue</p>
          <strong>{formatNrs(summary.totalRevenue)}</strong>
        </div>
        <div className="stat-card">
          <p>Cash</p>
          <strong>{formatNrs(summary.cashRevenue)}</strong>
        </div>
        <div className="stat-card">
          <p>Online</p>
          <strong>{formatNrs(summary.onlineRevenue)}</strong>
        </div>
      </div>

      <div className="filters-bar">
        <Input
          placeholder="Search client, service, employee"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              setQuery(search);
            }
          }}
        />
        <Input
          type="date"
          value={from}
          onChange={(e) => {
            setPage(1);
            setFrom(e.target.value);
          }}
          aria-label="From date"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => {
            setPage(1);
            setTo(e.target.value);
          }}
          aria-label="To date"
        />
        <Select
          value={paymentType}
          onChange={(e) => {
            setPage(1);
            setPaymentType(e.target.value);
          }}
          placeholder="All payment types"
          options={[
            { value: 'CASH', label: 'Cash' },
            { value: 'ONLINE', label: 'Online' },
          ]}
        />
        <Button
          variant="secondary"
          onClick={() => {
            setPage(1);
            setQuery(search);
          }}
        >
          Search
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setSearch('');
            setQuery('');
            setFrom('');
            setTo('');
            setPaymentType('');
            setPage(1);
          }}
        >
          Clear
        </Button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState title="Could not load payments" description={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No payments found"
          description="When employees save entries with amounts, they appear here."
        />
      ) : (
        <>
          <Table
            columns={[
              { key: 'date', header: 'Date', render: (r) => formatDateNp(r.date) },
              { key: 'time', header: 'Time', render: (r) => formatTimeDisplay(r.time) },
              { key: 'client', header: 'Client', render: (r) => r.clientName },
              { key: 'employee', header: 'Employee', render: (r) => r.employeeName },
              { key: 'service', header: 'Service', render: (r) => r.serviceType },
              { key: 'amount', header: 'Amount', render: (r) => formatNrs(r.amount) },
              {
                key: 'payment',
                header: 'Payment Type',
                render: (r) => <Badge type={r.paymentType as PaymentType} />,
              },
            ]}
            rows={rows}
            rowKey={(r) => r.id}
            mobileCard={(r) => (
              <>
                <div className="mobile-card-top">
                  <strong>{r.clientName}</strong>
                  <Badge type={r.paymentType} />
                </div>
                <p>
                  {formatDateNp(r.date)} · {formatTimeDisplay(r.time)} · {r.employeeName}
                </p>
                <p>
                  {r.serviceType} · {formatNrs(r.amount)}
                </p>
              </>
            )}
          />
          <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
