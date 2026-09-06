import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Table } from '../components/Table';
import { api, ApiError } from '../services/api';
import type { BusinessReport } from '../types';
import { formatDateNp, formatNrs, todayInputValue } from '../utils/format';

type Period = 'today' | 'week' | 'month' | 'custom';

const PIE_COLORS = ['#c45c7a', '#5b7c99'];

function startOfWeekInput() {
  const today = todayInputValue();
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  dt.setUTCDate(dt.getUTCDate() - diff);
  return dt.toISOString().slice(0, 10);
}

function startOfMonthInput() {
  const today = todayInputValue();
  return `${today.slice(0, 8)}01`;
}

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month');
  const [from, setFrom] = useState(startOfMonthInput);
  const [to, setTo] = useState(todayInputValue);
  const [data, setData] = useState<BusinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const applyPeriod = (p: Period) => {
    setPeriod(p);
    const today = todayInputValue();
    if (p === 'today') {
      setFrom(today);
      setTo(today);
    } else if (p === 'week') {
      setFrom(startOfWeekInput());
      setTo(today);
    } else if (p === 'month') {
      setFrom(startOfMonthInput());
      setTo(today);
    }
  };

  const load = async (rangeFrom = from, rangeTo = to, p = period) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ from: rangeFrom, to: rangeTo });
      if (p !== 'custom') params.set('period', p);
      const res = await api.get<{ data: BusinessReport }>(`/api/reports/business?${params}`);
      setData(res.data);
      setFrom(res.data.range.from);
      setTo(res.data.range.to);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load reports');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Cash', value: data.summary.cashRevenue },
      { name: 'Online', value: data.summary.onlineRevenue },
    ].filter((x) => x.value > 0);
  }, [data]);

  const chartLabel = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${Number(d)}/${Number(m)}`;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Business insights</p>
          <h1>Reports</h1>
          <p className="muted">Revenue and service performance from employee entries.</p>
        </div>
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="filters-bar report-period-bar">
        {(['today', 'week', 'month', 'custom'] as Period[]).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={period === p ? 'primary' : 'secondary'}
            onClick={() => {
              if (p === 'custom') {
                setPeriod('custom');
                return;
              }
              applyPeriod(p);
              const today = todayInputValue();
              const f =
                p === 'today' ? today : p === 'week' ? startOfWeekInput() : startOfMonthInput();
              void load(f, today, p);
            }}
          >
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom'}
          </Button>
        ))}
        <Input
          label="From"
          type="date"
          value={from}
          onChange={(e) => {
            setPeriod('custom');
            setFrom(e.target.value);
          }}
        />
        <Input
          label="To"
          type="date"
          value={to}
          onChange={(e) => {
            setPeriod('custom');
            setTo(e.target.value);
          }}
        />
        <Button
          onClick={() => {
            setPeriod('custom');
            void load(from, to, 'custom');
          }}
        >
          Apply
        </Button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState title="Could not load reports" description={error} />
      ) : !data ? null : (
        <>
          <p className="eyebrow">
            {formatDateNp(data.range.from)}
            {data.range.from !== data.range.to ? ` – ${formatDateNp(data.range.to)}` : ''}
          </p>
          <div className="stat-grid">
            <div className="stat-card">
              <p>Total Revenue</p>
              <strong>{formatNrs(data.summary.totalRevenue)}</strong>
            </div>
            <div className="stat-card">
              <p>Total Clients</p>
              <strong>{data.summary.totalClients}</strong>
            </div>
            <div className="stat-card">
              <p>Total Services</p>
              <strong>{data.summary.totalServices}</strong>
            </div>
            <div className="stat-card">
              <p>Cash Payments</p>
              <strong>{formatNrs(data.summary.cashRevenue)}</strong>
            </div>
            <div className="stat-card">
              <p>Online Payments</p>
              <strong>{formatNrs(data.summary.onlineRevenue)}</strong>
            </div>
            <div className="stat-card">
              <p>Total Appointments</p>
              <strong>{data.summary.totalAppointments}</strong>
            </div>
          </div>

          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-header">
                <h2>Revenue over time</h2>
              </div>
              {data.chart.length === 0 ? (
                <EmptyState title="No revenue in this period" />
              ) : (
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={data.chart}>
                      <defs>
                        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#c45c7a" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#c45c7a" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ead9df" />
                      <XAxis dataKey="date" tickFormatter={chartLabel} tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} width={56} />
                      <Tooltip
                        formatter={(v: number) => formatNrs(v)}
                        labelFormatter={(l) => formatDateNp(String(l))}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#c45c7a"
                        fill="url(#revFill)"
                        strokeWidth={2}
                        name="Revenue"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Payment breakdown</h2>
              </div>
              {pieData.length === 0 ? (
                <EmptyState title="No payments in this period" />
              ) : (
                <div className="chart-box pie-box">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatNrs(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="pie-legend">
                    <li>
                      <span className="dot cash" /> Cash {formatNrs(data.summary.cashRevenue)}
                    </li>
                    <li>
                      <span className="dot online" /> Online {formatNrs(data.summary.onlineRevenue)}
                    </li>
                    <li className="legend-total">
                      Total {formatNrs(data.summary.totalRevenue)}
                    </li>
                  </ul>
                </div>
              )}
            </section>
          </div>

          <section className="panel">
            <div className="panel-header">
              <h2>Service performance</h2>
              <span className="muted">Grouped by service type (case-insensitive)</span>
            </div>
            {data.servicePerformance.length === 0 ? (
              <EmptyState title="No services recorded in this period" />
            ) : (
              <Table
                columns={[
                  { key: 'name', header: 'Service', render: (r) => r.name },
                  {
                    key: 'bookings',
                    header: 'Number of Bookings',
                    render: (r) => String(r.bookings),
                  },
                  {
                    key: 'revenue',
                    header: 'Revenue',
                    render: (r) => formatNrs(r.revenue),
                  },
                ]}
                rows={data.servicePerformance}
                rowKey={(r) => r.name}
                mobileCard={(r) => (
                  <>
                    <strong>{r.name}</strong>
                    <p>
                      {r.bookings} bookings · {formatNrs(r.revenue)}
                    </p>
                  </>
                )}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
