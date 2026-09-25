import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { createDepositCheckout } from '../lib/payments/stripe';

interface JobDetails {
  jobId: string;
  status: string;
  guaranteedPrice: number;
  depositAmount: number;
  depositStatus: string;
  painter: {
    companyName: string;
    ownerName: string;
    email: string;
    phone: string;
  } | null;
}

const currency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const ConfirmJob = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const paymentStatus = searchParams.get('payment');

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing confirmation link. Please use the link from your email.');
      setLoading(false);
      return;
    }

    fetch(`${supabaseUrl}/functions/v1/get-job-by-token?token=${encodeURIComponent(token)}`, {
      headers: { Authorization: `Bearer ${supabaseAnonKey}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load job details');
        setJob(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load job details'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleConfirmAndPay = async () => {
    if (!job || !token) return;
    setPaying(true);
    setError('');
    try {
      const url = await createDepositCheckout(
        job.jobId,
        token,
        job.guaranteedPrice,
        job.painter?.companyName || 'your painter',
      );
      if (!url) {
        setError('Payment setup is still in progress — we\'ll be in touch shortly to collect the deposit.');
        return;
      }
      window.location.href = url;
    } catch {
      setError('Something went wrong starting checkout. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <div className="confirm-job-page"><p>Loading job details…</p></div>;
  }

  if (error && !job) {
    return (
      <div className="confirm-job-page">
        <h1>Confirm Your Job</h1>
        <p style={{ color: '#e74c3c' }}>{error}</p>
      </div>
    );
  }

  if (!job) return null;

  const alreadyPaid = job.depositStatus === 'paid';

  return (
    <div className="confirm-job-page" style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px' }}>
      <h1>Your painter accepted the job!</h1>

      {paymentStatus === 'cancelled' && (
        <p style={{ color: '#f5a623' }}>Payment was cancelled — you can try again below.</p>
      )}

      {alreadyPaid ? (
        <p style={{ color: '#2ecc71' }}>
          Deposit received — {job.painter?.companyName} has your full contact details and will be in touch to schedule the work.
        </p>
      ) : (
        <>
          <div style={{ background: '#1f2937', borderRadius: 12, padding: 24, margin: '20px 0' }}>
            <h2 style={{ marginTop: 0 }}>{job.painter?.companyName}</h2>
            <p>{job.painter?.ownerName}</p>
            <p>
              Email: <a href={`mailto:${job.painter?.email}`}>{job.painter?.email}</a>
              <br />
              Phone: <a href={`tel:${job.painter?.phone}`}>{job.painter?.phone}</a>
            </p>
          </div>

          <p>Job price: <strong>{currency(job.guaranteedPrice)}</strong></p>
          <p>Deposit due now: <strong>{currency(job.depositAmount)}</strong></p>

          {error && <p style={{ color: '#e74c3c' }}>{error}</p>}

          <button
            onClick={handleConfirmAndPay}
            disabled={paying}
            style={{
              marginTop: 12,
              padding: '12px 24px',
              background: '#74b9ff',
              color: '#0b1620',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: paying ? 'not-allowed' : 'pointer',
            }}
          >
            {paying ? 'Starting checkout…' : 'Confirm & Pay Deposit'}
          </button>
        </>
      )}
    </div>
  );
};

export default ConfirmJob;
