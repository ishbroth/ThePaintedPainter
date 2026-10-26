import { Link, useParams } from 'react-router-dom';
import ContractWorkspace from '../../components/contracts/ContractWorkspace';

/** One project's contract, for the customer: read it, accept it or a painter's change notice, or decline with a note. */
export default function CustomerContract() {
  const { jobId } = useParams<{ jobId: string }>();
  if (!jobId) return null;
  return (
    <div className="max-w-4xl">
      <Link to="/customer/dashboard/projects" style={{ color: 'var(--accent-blue)', fontSize: '0.9rem' }}>← Back to My Projects</Link>
      <h1 className="text-3xl font-bold text-[var(--text-primary)] mt-2 mb-4">Contract</h1>
      <ContractWorkspace auth={{ kind: 'session', jobId }} />
    </div>
  );
}
