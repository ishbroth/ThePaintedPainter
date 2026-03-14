import type { SpecialtyReferral as SpecialtyReferralType } from '../../lib/types';

interface SpecialtyReferralProps {
  referrals: SpecialtyReferralType[];
}

const SpecialtyReferral = ({ referrals }: SpecialtyReferralProps) => {
  if (referrals.length === 0) return null;

  return (
    <div className="estimator-specialty-referrals">
      <h4 className="estimator-specialty-title">Specialty Work Notices</h4>
      {referrals.map((referral, index) => (
        <div
          key={index}
          className={`estimator-specialty-card ${referral.severity}`}
        >
          <span className="estimator-specialty-icon">
            {referral.severity === 'critical' ? '!!' : referral.severity === 'warning' ? '!' : 'i'}
          </span>
          <div>
            <strong>{formatType(referral.type)}</strong>
            <p>{referral.reason}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

function formatType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default SpecialtyReferral;
