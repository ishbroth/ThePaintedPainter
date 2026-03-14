import type { JobSummary as JobSummaryType } from '../../lib/types';

interface JobSummaryProps {
  summary: JobSummaryType;
}

const JobSummary = ({ summary }: JobSummaryProps) => {
  return (
    <div className="estimator-job-summary">
      <h4 className="estimator-job-summary-title">Job Details for Contractor</h4>

      <div className="estimator-job-section">
        <h5>Project Overview</h5>
        <ul>
          <li>Type: {summary.projectOverview.propertyType} - {summary.projectOverview.projectType}</li>
          {summary.projectOverview.squareFeet && <li>Square Feet: {summary.projectOverview.squareFeet.toLocaleString()}</li>}
          {summary.projectOverview.stories && <li>Stories: {summary.projectOverview.stories}</li>}
          {summary.projectOverview.yearBuilt && <li>Year Built: {summary.projectOverview.yearBuilt}</li>}
          <li>Location: {summary.projectOverview.location}</li>
        </ul>
      </div>

      {summary.interiorScope && (
        <div className="estimator-job-section">
          <h5>Interior Scope</h5>
          <ul>
            {summary.interiorScope.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.exteriorScope && (
        <div className="estimator-job-section">
          <h5>Exterior Scope</h5>
          <ul>
            {summary.exteriorScope.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.prepWork.length > 0 && (
        <div className="estimator-job-section">
          <h5>Prep Work</h5>
          <ul>
            {summary.prepWork.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.specialtyNeeds.length > 0 && (
        <div className="estimator-job-section">
          <h5>Specialty Needs</h5>
          <ul>
            {summary.specialtyNeeds.map((need, i) => (
              <li key={i}>{need.reason}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.accessNotes && (
        <div className="estimator-job-section">
          <h5>Access Notes</h5>
          <p>{summary.accessNotes}</p>
        </div>
      )}

      <div className="estimator-job-section">
        <h5>Estimate Range</h5>
        <p className="estimator-job-estimate">{summary.estimateRange}</p>
      </div>
    </div>
  );
};

export default JobSummary;
