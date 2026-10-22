import { currency, usePainterBusiness, type BusinessCustomer } from '../../lib/painterBusiness';
import { fmtDate, fmtRange } from '../../lib/dates';

const card = 'bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={`${card} p-5`}>
      <p className="text-sm text-[var(--text-secondary)] mb-1">{label}</p>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      {sub && <p className="text-xs text-[var(--text-faint)] mt-1">{sub}</p>}
    </div>
  );
}

function monthLabel(key: string) {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' });
}

function IncomeChart({ months }: { months: { month: string; earned: number; jobs: number }[] }) {
  const max = Math.max(1, ...months.map((m) => m.earned));
  return (
    <div className="flex items-end gap-1.5 h-40" role="img" aria-label="Income by month for the last 12 months">
      {months.map((m) => (
        <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${monthLabel(m.month)}: ${currency(m.earned)} from ${m.jobs} job${m.jobs === 1 ? '' : 's'}`}>
          <div
            className="w-full rounded-t bg-[var(--accent)]"
            style={{ height: `${(m.earned / max) * 100}%`, minHeight: m.earned > 0 ? 3 : 1, opacity: m.earned > 0 ? 1 : 0.25 }}
          />
          <span className="text-[10px] text-[var(--text-faint)] mt-1">{monthLabel(m.month)}</span>
        </div>
      ))}
    </div>
  );
}

function CustomerRow({ c }: { c: BusinessCustomer }) {
  const unhappy = c.lowestRating === 1;
  return (
    <li className={`${card} p-4`} style={unhappy ? { borderColor: 'var(--danger)' } : undefined}>
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--text-primary)]">
            {c.name || 'Customer'}
            {c.jobs > 1 && <span className="ml-2 text-xs font-medium text-[var(--accent)]">Repeat customer</span>}
            {unhappy && <span className="ml-2 text-xs font-medium text-[var(--danger)]">Left a 1-star review — reach out</span>}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            {c.email && <a href={`mailto:${c.email}`} className="text-[var(--accent-blue)]">{c.email}</a>}
            {c.email && c.phone && ' · '}
            {c.phone && <a href={`tel:${c.phone}`} className="text-[var(--accent-blue)]">{c.phone}</a>}
          </p>
          {c.address && <p className="text-xs text-[var(--text-faint)]">{c.address}</p>}
        </div>
        <div className="text-right">
          <p className="font-bold text-[var(--text-primary)]">{currency(c.totalPaid)}</p>
          <p className="text-xs text-[var(--text-faint)]">
            {c.jobs} job{c.jobs === 1 ? '' : 's'}{c.lastJobAt ? ` · last ${fmtDate(c.lastJobAt.slice(0, 10))}` : ''}
          </p>
        </div>
      </div>
      {c.projects.length > 1 && (
        <ul className="mt-3 pt-3 border-t border-[var(--border)] space-y-1">
          {c.projects.map((p) => (
            <li key={p.id} className="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>{p.label || 'Painting job'} · {p.status === 'completed' ? 'completed' : 'upcoming'}{p.rating ? ` · ${p.rating}★` : ''}</span>
              <span>{currency(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function PainterBusiness() {
  const { data, error, loading } = usePainterBusiness();

  if (loading) return <p className="text-[var(--text-secondary)]">Loading your business…</p>;
  if (error) return <p className="text-[var(--danger)]">{error}</p>;
  if (!data) return null;

  const { income, schedule, customers } = data;
  const repeat = customers.filter((c) => c.jobs > 1).length;

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">My Business</h1>
      <p className="text-[var(--text-secondary)] mb-6">Your schedule, your customers, and what you've earned through The Painted Painter.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Earned this month" value={currency(income.thisMonth)} />
        <StatCard label="Earned this year" value={currency(income.yearToDate)} />
        <StatCard label="All-time earned" value={currency(income.totalEarned)} sub={`${income.completedJobs} completed job${income.completedJobs === 1 ? '' : 's'}${income.completedJobs ? ` · avg ${currency(income.averageJob)}` : ''}`} />
        <StatCard label="Booked, not yet paid out" value={currency(income.pipeline)} sub={`${schedule.length} upcoming job${schedule.length === 1 ? '' : 's'}`} />
      </div>

      <section className={`${card} p-6 mb-8`}>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Income, last 12 months</h2>
        <IncomeChart months={income.months} />
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Upcoming schedule</h2>
        {schedule.length === 0 ? (
          <div className={`${card} p-6 text-center text-[var(--text-faint)]`}>Nothing booked yet. Confirmed jobs appear here in date order.</div>
        ) : (
          <ul className="space-y-3">
            {schedule.map((j) => (
              <li key={j.id} className={`${card} p-4 flex justify-between gap-3 flex-wrap`}>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-primary)]">
                    {j.scheduledDate ? fmtRange(j.scheduledDate, j.scheduledEndDate) : 'Dates not set yet'}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">{j.label || 'Painting job'}{j.customerName ? ` — ${j.customerName}` : ''}</p>
                  <p className="text-xs text-[var(--text-faint)]">
                    {j.address}
                    {j.customerPhone && <> · <a href={`tel:${j.customerPhone}`} className="text-[var(--accent-blue)]">{j.customerPhone}</a></>}
                  </p>
                </div>
                <p className="font-bold text-[var(--text-primary)]">{currency(j.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">My customers</h2>
        <p className="text-sm text-[var(--text-faint)] mb-3">
          {customers.length} customer{customers.length === 1 ? '' : 's'}{repeat > 0 ? ` · ${repeat} repeat` : ''}
        </p>
        {customers.length === 0 ? (
          <div className={`${card} p-6 text-center text-[var(--text-faint)]`}>Customers show up here once they've paid their deposit.</div>
        ) : (
          <ul className="space-y-3">{customers.map((c, i) => <CustomerRow key={`${c.email ?? c.name}-${i}`} c={c} />)}</ul>
        )}
      </section>
    </div>
  );
}
