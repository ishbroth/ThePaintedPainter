import { usePainterBusiness } from '../../lib/painterBusiness';

const card = 'bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl';

interface Track {
  kind: 'jobs' | 'reviews';
  title: string;
  icon: string;
  unit: (n: number) => string;
  hint: string;
}

const TRACKS: Track[] = [
  { kind: 'jobs', title: 'Jobs completed', icon: '\u{1F3C6}', unit: (n) => `${n} jobs completed`, hint: 'Mark jobs completed to climb.' },
  { kind: 'reviews', title: 'Reviews earned', icon: '⭐', unit: (n) => `${n} ${n === 1 ? 'review' : 'reviews'}`, hint: 'Reviews of 2 stars or more count.' },
];

export default function PainterRewards() {
  const { data, loading, error } = usePainterBusiness();

  if (loading) return <p className="text-[var(--text-secondary)]">Loading your rewards…</p>;
  if (error) return <p className="text-[var(--danger)]">{error}</p>;
  if (!data) return null;

  const { rewards } = data;
  const earnedAt = new Map(rewards.earned.map((a) => [`${a.kind}:${a.threshold}`, a.earned_at]));

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Rewards</h1>
      <p className="text-[var(--text-secondary)] mb-8">Earn achievements for the work you finish and the reviews you earn.</p>

      {TRACKS.map((t) => {
        const milestones = t.kind === 'jobs' ? rewards.jobMilestones : rewards.reviewMilestones;
        const count = t.kind === 'jobs' ? rewards.completedJobs : rewards.countedReviews;
        const next = milestones.find((m) => count < m);
        const prev = [...milestones].reverse().find((m) => count >= m) ?? 0;
        return (
          <section key={t.kind} className="mb-10">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t.title}</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {next ? `${count} of ${next} — ${next - count} to go` : `${count} — every badge earned!`}
              </p>
            </div>
            {next && (
              <div className="h-2 rounded-full bg-[var(--border)] mb-4 overflow-hidden" role="progressbar" aria-valuenow={count} aria-valuemax={next}>
                <div className="h-full bg-[var(--accent)]" style={{ width: `${Math.min(100, ((count - prev) / (next - prev)) * 100)}%` }} />
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {milestones.map((m) => {
                const when = earnedAt.get(`${t.kind}:${m}`);
                return (
                  <div
                    key={m}
                    className={`${card} p-4 text-center`}
                    style={when ? { borderColor: 'var(--accent)' } : { opacity: 0.55 }}
                  >
                    <div className="text-4xl mb-2" style={when ? undefined : { filter: 'grayscale(1)' }}>{t.icon}</div>
                    <p className="font-semibold text-[var(--text-primary)] text-sm">{t.unit(m)}</p>
                    <p className="text-xs text-[var(--text-faint)] mt-1">
                      {when ? `Earned ${new Date(when).toLocaleDateString()}` : 'Locked'}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-[var(--text-faint)] mt-3">{t.hint}</p>
          </section>
        );
      })}
    </div>
  );
}
