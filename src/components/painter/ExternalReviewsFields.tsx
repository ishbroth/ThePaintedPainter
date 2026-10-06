import { EXTERNAL_SOURCES, type ExternalFormValue, type ExternalSource } from '../../lib/externalReviews';

/**
 * Optional links to a painter's existing reviews (Google / Yelp / Facebook), plus the
 * rating and review count shown there. Customers see these as "painter-reported"
 * ratings next to a link they can follow to verify.
 */
export default function ExternalReviewsFields({
  value,
  onChange,
  inputClass,
  labelClass,
  inputStyle,
  labelStyle,
}: {
  value: ExternalFormValue;
  onChange: (next: ExternalFormValue) => void;
  inputClass?: string;
  labelClass?: string;
  inputStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
}) {
  const set = (key: ExternalSource, field: 'url' | 'rating' | 'count', v: string) =>
    onChange({ ...value, [key]: { ...value[key], [field]: v } });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>
        Optional. Link the pages where customers already review you, and enter the star rating and number of reviews shown
        there. Customers see these next to a link they can follow to check.
      </p>
      {EXTERNAL_SOURCES.map((s) => (
        <div key={s.key} style={{ display: 'grid', gap: 8 }}>
          <div>
            <label className={labelClass} style={labelStyle}>{s.label} reviews link</label>
            <input
              type="url"
              className={inputClass}
              style={inputStyle}
              value={value[s.key].url}
              onChange={(e) => set(s.key, 'url', e.target.value)}
              placeholder={s.placeholder}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label className={labelClass} style={labelStyle}>{s.label} average rating (0–5)</label>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                className={inputClass}
              style={inputStyle}
                value={value[s.key].rating}
                onChange={(e) => set(s.key, 'rating', e.target.value)}
                placeholder="e.g. 4.8"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Number of {s.label} reviews</label>
              <input
                type="number"
                min={0}
                step={1}
                className={inputClass}
              style={inputStyle}
                value={value[s.key].count}
                onChange={(e) => set(s.key, 'count', e.target.value)}
                placeholder="e.g. 120"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
