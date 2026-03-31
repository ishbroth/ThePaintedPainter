import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PainterSignUp() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/painter-signup', { replace: true });
  }, [navigate]);

  return null;
}
