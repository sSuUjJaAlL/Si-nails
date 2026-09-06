import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Table } from '../components/Table';
import { api, ApiError } from '../services/api';
import { formatDateNp, formatNrs } from '../utils/format';

type EntryClient = {
  id: string;
  name: string;
  visits: number;
  totalSpent: number;
  lastVisit: string;
  lastService: string;
  lastEmployee: string;
  lastPaymentType: 'CASH' | 'ONLINE';
};

export function ClientsPage() {
  const [rows, setRows] = useState<EntryClient[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (q = query) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('search', q.trim());
      const qs = params.toString();
      const res = await api.get<{ data: EntryClient[] }>(
        `/api/reports/entry-clients${qs ? `?${qs}` : ''}`
      );
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load clients');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">From employee entries</p>
          <h1>Clients</h1>
          <p className="muted">
            Every client name employees enter in Entries appears here automatically.
          </p>
        </div>
        <Link to="/admin/dashboard" className="text-link">
          View live activity →
        </Link>
      </div>

      <div className="filters-bar">
        <Input
          placeholder="Search client name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setQuery(search);
              void load(search);
            }
          }}
        />
        <Button
          variant="secondary"
          onClick={() => {
            setQuery(search);
            void load(search);
          }}
        >
          Search
        </Button>
        <Button variant="secondary" onClick={() => void load(query)}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState title="Could not load clients" description={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="When an employee adds a client/service entry, that client will show up here."
        />
      ) : (
        <Table
          columns={[
            { key: 'name', header: 'Client Name', render: (c) => c.name },
            { key: 'visits', header: 'Visits', render: (c) => String(c.visits) },
            { key: 'spent', header: 'Total Spent', render: (c) => formatNrs(c.totalSpent) },
            {
              key: 'last',
              header: 'Last Visit',
              render: (c) => formatDateNp(c.lastVisit),
            },
            { key: 'service', header: 'Last Service', render: (c) => c.lastService },
            { key: 'employee', header: 'Last Employee', render: (c) => c.lastEmployee },
            {
              key: 'pay',
              header: 'Last Payment',
              render: (c) => <Badge type={c.lastPaymentType} />,
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          mobileCard={(c) => (
            <>
              <strong>{c.name}</strong>
              <p>
                {c.visits} visits · {formatNrs(c.totalSpent)}
              </p>
              <p>
                Last: {formatDateNp(c.lastVisit)} · {c.lastService} · {c.lastEmployee}
              </p>
            </>
          )}
        />
      )}
    </div>
  );
}
