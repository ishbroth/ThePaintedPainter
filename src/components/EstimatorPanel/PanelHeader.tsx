import { formatCurrency } from '../../lib/estimateEngine';

interface PanelHeaderProps {
  runningEstimate: number | null;
  confidenceLevel?: 'low' | 'medium' | 'high';
}

const PanelHeader = ({ runningEstimate, confidenceLevel }: PanelHeaderProps) => {
  return (
    <div className="estimator-header">
      <h2 className="estimator-title">AI Painting Estimator</h2>
      {runningEstimate !== null && runningEstimate > 0 && (
        <div className="estimator-running-estimate">
          <span className="estimator-estimate-badge">
            ~{formatCurrency(runningEstimate)}
          </span>
          {confidenceLevel && (
            <div className="estimator-header-dots">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`estimator-header-dot ${
                    i <= (confidenceLevel === 'high' ? 3 : confidenceLevel === 'medium' ? 2 : 1) ? 'active' : ''
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PanelHeader;
