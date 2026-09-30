import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    // The backend set a secure HTTP-only cookie.
    // We just redirect to the dashboard. The useAuth hook will fetch /api/auth/me automatically.
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg-primary)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner spinner-lg" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          Authenticating...
        </p>
      </div>
    </div>
  );
}
