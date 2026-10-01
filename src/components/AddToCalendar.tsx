import { downloadIcs, googleCalendarUrl, type CalendarEvent } from '../lib/calendar';

/** Two small links: native calendar (.ics, with a day-before alert) and Google Calendar. */
export default function AddToCalendar({ event }: { event: CalendarEvent }) {
  const linkStyle: React.CSSProperties = { color: 'var(--accent-blue)', fontSize: '0.8rem', cursor: 'pointer', background: 'none', border: 'none', padding: 0 };
  return (
    <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" style={linkStyle} onClick={() => downloadIcs(event)}>
        📅 Add to calendar
      </button>
      <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" style={linkStyle}>
        Google Calendar
      </a>
    </span>
  );
}
