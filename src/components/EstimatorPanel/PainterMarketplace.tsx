import { useState } from 'react';
import type { EstimateBreakdown, EstimatorContext } from '../../lib/types';
import type { PainterMatch } from '../../lib/painterPricingEngine';
import { formatCurrency } from '../../lib/estimateEngine';

interface PainterMarketplaceProps {
  aiEstimate: EstimateBreakdown;
  guaranteedPrice: number;
  eligiblePainterCount: number;
  painterMatches: PainterMatch[];
  context: EstimatorContext;
  onSelectGuaranteed: () => void;
  onSelectPainter: (painterId: string) => void;
}

const PainterMarketplace = ({
  aiEstimate,
  guaranteedPrice,
  eligiblePainterCount,
  painterMatches,
  context,
  onSelectGuaranteed,
  onSelectPainter,
}: PainterMarketplaceProps) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showAllPainters, setShowAllPainters] = useState(false);

  const displayedPainters = showAllPainters ? painterMatches : painterMatches.slice(0, 3);

  return (
    <div style={{ marginTop: 30 }}>
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: 25 }}>
        <h3 style={{ fontFamily: "'Cabin', sans-serif", fontSize: '1.2rem', color: '#fff', marginBottom: 8 }}>
          Choose Your Painter
        </h3>
        <p style={{ color: '#999', fontSize: '0.85rem' }}>
          Pick a guaranteed price or choose a specific painting company
        </p>
      </div>

      {/* Guaranteed Price Card */}
      <div
        onClick={() => {
          setSelectedOption('guaranteed');
          onSelectGuaranteed();
        }}
        style={{
          background: selectedOption === 'guaranteed' ? '#1a3a2a' : '#222',
          border: selectedOption === 'guaranteed' ? '2px solid #4ade80' : '2px solid #333',
          borderRadius: 10,
          padding: 20,
          marginBottom: 20,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                background: '#4ade80',
                color: '#000',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}>
                Best Value
              </span>
              <span style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.85rem' }}>
                Guaranteed Price
              </span>
            </div>
            <p style={{ color: '#aaa', fontSize: '0.8rem', lineHeight: 1.5, marginTop: 6 }}>
              Any qualified painter in our network will do the job at this price.
              {eligiblePainterCount > 1 && ` ${eligiblePainterCount} painters available.`}
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ade80' }}>
              {formatCurrency(guaranteedPrice)}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#777' }}>
              AI estimate: {formatCurrency(aiEstimate.total)}
            </div>
          </div>
        </div>
        {selectedOption === 'guaranteed' && (
          <div style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid #333',
            color: '#4ade80',
            fontSize: '0.8rem',
          }}>
            Selected! Your project details will be sent to all eligible painters in our network.
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ textAlign: 'center', margin: '20px 0', color: '#555', fontSize: '0.8rem' }}>
        — or choose a specific painter —
      </div>

      {/* Painter Cards */}
      {displayedPainters.map((match) => (
        <div
          key={match.painter.id}
          onClick={() => {
            setSelectedOption(match.painter.id);
            onSelectPainter(match.painter.id);
          }}
          style={{
            background: selectedOption === match.painter.id ? '#1a2a3a' : '#222',
            border: selectedOption === match.painter.id ? '2px solid #74b9ff' : '1px solid #333',
            borderRadius: 10,
            padding: 18,
            marginBottom: 12,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Painter Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
                  {match.painter.companyName}
                </span>
                {match.matchScore >= 80 && (
                  <span style={{
                    background: '#74b9ff',
                    color: '#000',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 3,
                  }}>
                    TOP MATCH
                  </span>
                )}
              </div>
              <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: 6 }}>
                {match.painter.city}, {match.painter.state} &middot; {match.painter.yearsInBusiness} yrs experience
                {match.painter.crewSize > 1 ? ` \u00B7 ${match.painter.crewSize}-person crew` : ''}
              </p>

              {/* Credentials */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                {match.painter.hasLicense && (
                  <span style={badgeStyle}>Licensed</span>
                )}
                {match.painter.isInsured && (
                  <span style={badgeStyle}>Insured</span>
                )}
                {match.painter.isBonded && (
                  <span style={badgeStyle}>Bonded</span>
                )}
                {match.painter.offersWarranty && (
                  <span style={badgeStyle}>Warranty</span>
                )}
                {match.painter.certifications.map((cert) => (
                  <span key={cert} style={badgeStyle}>{cert}</span>
                ))}
              </div>
            </div>

            {/* Price */}
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 15 }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#74b9ff' }}>
                {formatCurrency(match.estimatedPrice)}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#666' }}>
                {formatCurrency(match.priceRange.low)} - {formatCurrency(match.priceRange.high)}
              </div>
            </div>
          </div>

          {selectedOption === match.painter.id && (
            <div style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid #333',
              color: '#74b9ff',
              fontSize: '0.8rem',
            }}>
              Selected! Your project details and photos will be sent directly to {match.painter.companyName}.
            </div>
          )}
        </div>
      ))}

      {/* Show More */}
      {painterMatches.length > 3 && !showAllPainters && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAllPainters(true);
          }}
          style={{
            width: '100%',
            padding: '10px',
            background: 'transparent',
            border: '1px solid #444',
            color: '#888',
            fontSize: '0.8rem',
            cursor: 'pointer',
            borderRadius: 6,
            marginBottom: 12,
          }}
        >
          Show {painterMatches.length - 3} more painters
        </button>
      )}

      {/* No Painters Message */}
      {painterMatches.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 30,
          color: '#666',
          fontSize: '0.85rem',
        }}>
          <p>No painters currently registered in your area.</p>
          <p style={{ marginTop: 8 }}>
            The guaranteed price is based on our AI estimate and network rates.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <p style={{
        color: '#555',
        fontSize: '0.7rem',
        textAlign: 'center',
        marginTop: 20,
        lineHeight: 1.5,
      }}>
        Estimated painter prices are calculated from each company's baseline rates and may vary
        after an on-site assessment. The Guaranteed Price is honored by participating painters.
      </p>
    </div>
  );
};

const badgeStyle: React.CSSProperties = {
  fontSize: '0.6rem',
  color: '#aaa',
  border: '1px solid #444',
  padding: '1px 5px',
  borderRadius: 3,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

export default PainterMarketplace;
