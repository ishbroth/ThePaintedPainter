import { fmtRange } from '../../lib/dates';
import { money, type ContractVersion, type ContractView } from '../../lib/contracts';

/**
 * One version of the contract, laid out as a document: parties, the standard sections, the price table, and the signature block.
 * Printing the page (or "Save as PDF" in the print dialog) prints only this.
 */
export default function ContractDocument({ view, version }: { view: ContractView; version: ContractVersion }) {
  const { parties } = view;
  const t = version.terms;
  const accepted = version.status === 'accepted';
  const customerLine = [parties.customer.name, parties.customer.address].filter(Boolean).join(', ');
  const painterLine = [parties.painter.companyName, parties.painter.ownerName ? `(${parties.painter.ownerName})` : ''].filter(Boolean).join(' ');

  return (
    <article className="contract-print" style={{ background: '#fff', color: '#1a1a1a', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 30px', lineHeight: 1.6, fontSize: '0.93rem' }}>
      <h2 style={{ margin: '0 0 2px', fontSize: '1.35rem', textAlign: 'center' }}>Painting Services Agreement</h2>
      <p style={{ margin: '0 0 18px', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
        {t.project.label} · Version {version.version}
        {version.status === 'draft' ? ' (draft, not yet sent)' : version.status === 'sent' ? ' (waiting for the customer)' : ''}
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18, fontSize: '0.9rem' }}>
        <tbody>
          <tr>
            <td style={{ padding: '4px 10px 4px 0', color: '#6b7280', width: '22%', verticalAlign: 'top' }}>Customer</td>
            <td style={{ padding: '4px 0' }}>{customerLine || t.customerFirstName}{!parties.customer.address && view.role === 'painter' ? ' (full name and address are shown once the deposit is paid)' : ''}</td>
          </tr>
          <tr>
            <td style={{ padding: '4px 10px 4px 0', color: '#6b7280', verticalAlign: 'top' }}>Painter</td>
            <td style={{ padding: '4px 0' }}>{painterLine}</td>
          </tr>
          {parties.painter.email && (
            <tr>
              <td style={{ padding: '4px 10px 4px 0', color: '#6b7280' }}>Painter contact</td>
              <td style={{ padding: '4px 0' }}>{parties.painter.email}{parties.painter.phone ? ` · ${parties.painter.phone}` : ''}</td>
            </tr>
          )}
          {t.schedule.start && (
            <tr>
              <td style={{ padding: '4px 10px 4px 0', color: '#6b7280' }}>Schedule</td>
              <td style={{ padding: '4px 0' }}>{fmtRange(t.schedule.start, t.schedule.end)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {t.sections.map((s) => (
        <section key={s.heading} style={{ marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>{s.heading}</h3>
          {s.heading.endsWith('Price and Payment') ? (
            <PriceTable version={version} />
          ) : (
            s.paragraphs.map((p, i) => <p key={i} style={{ margin: '0 0 6px', whiteSpace: 'pre-wrap' }}>{p}</p>)
          )}
        </section>
      ))}

      <div style={{ marginTop: 22, paddingTop: 14, borderTop: '1px solid #d1d5db', fontSize: '0.9rem' }}>
        {accepted ? (
          <>
            <p style={{ margin: '0 0 2px' }}><strong>Accepted electronically</strong> by <strong>{version.acceptedName}</strong> on {version.respondedAt ? new Date(version.respondedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : ''}.</p>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>Customer's typed name is their legal signature. Contract text version {t.textVersion}.</p>
          </>
        ) : version.status === 'declined' ? (
          <p style={{ margin: 0 }}><strong>Declined</strong> by the customer{version.respondedAt ? ` on ${new Date(version.respondedAt).toLocaleDateString('en-US', { dateStyle: 'long' })}` : ''}.{version.customerNote ? ` Their note: “${version.customerNote}”` : ''}</p>
        ) : version.status === 'superseded' ? (
          <p style={{ margin: 0, color: '#6b7280' }}>This version was replaced by a later one.</p>
        ) : (
          <p style={{ margin: 0, color: '#6b7280' }}>Not yet accepted. The customer accepts by typing their name and selecting “I accept”.</p>
        )}
      </div>
    </article>
  );
}

function PriceTable({ version }: { version: ContractVersion }) {
  const t = version.terms;
  const totals = version.totals;
  const cell: React.CSSProperties = { padding: '5px 0', borderBottom: '1px solid #eef0f3' };
  return (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0 8px', fontSize: '0.9rem' }}>
        <tbody>
          {t.price.lines.map((l, i) => (
            <tr key={i}><td style={cell}>{l.description}</td><td style={{ ...cell, textAlign: 'right' }}>{money(l.amount)}</td></tr>
          ))}
          {(version.painterTerms.changeOrders ?? []).map((c, i) => (
            <tr key={`c${i}`}><td style={cell}>Change: {c.description}</td><td style={{ ...cell, textAlign: 'right' }}>{c.amount < 0 ? '−' : ''}{money(Math.abs(c.amount))}</td></tr>
          ))}
          <tr><td style={{ ...cell, fontWeight: 700 }}>Contract price</td><td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{money(totals.total)}</td></tr>
          <tr><td style={cell}>Deposit paid through The Painted Painter</td><td style={{ ...cell, textAlign: 'right' }}>{money(totals.deposit)}</td></tr>
          <tr><td style={{ ...cell, fontWeight: 700 }}>Balance paid directly to the painter</td><td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{money(totals.balance)}</td></tr>
        </tbody>
      </table>
      <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#4b5563' }}>
        The deposit secures the booking and is credited toward the contract price. The balance, and any accepted change, is paid directly to the painter when the work is complete unless the two of you agree otherwise in writing.
      </p>
    </>
  );
}
