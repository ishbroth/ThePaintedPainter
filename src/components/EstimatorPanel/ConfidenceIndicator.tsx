interface ConfidenceIndicatorProps {
  level: 'low' | 'medium' | 'high';
}

const ConfidenceIndicator = ({ level }: ConfidenceIndicatorProps) => {
  const dots = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  const label = level === 'high' ? 'High' : level === 'medium' ? 'Medium' : 'Low';

  return (
    <div className="estimator-confidence">
      <span className="estimator-confidence-label">{label} Confidence</span>
      <div className="estimator-confidence-dots">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`estimator-confidence-dot ${i <= dots ? 'active' : ''}`}
          />
        ))}
      </div>
    </div>
  );
};

export default ConfidenceIndicator;
