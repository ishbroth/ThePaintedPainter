import { Link, useParams } from 'react-router-dom';
import ContractWorkspace from '../../components/contracts/ContractWorkspace';

/** One job's contract, for the painter: read it, add their own terms or document, send changes for the customer to accept. */
export default function PainterContract() {
  const { jobId } = useParams<{ jobId: string }>();
  if (!jobId) return null;
  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/painter/dashboard/projects" style={{ color: 'var(--accent-blue)', fontSize: '0.9rem' }}>← Back to My Projects</Link>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-2 mb-4">Contract</h1>
      <ContractWorkspace auth={{ kind: 'session', jobId }} />
    </div>
  );
}
