import { Mail, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(108, 92, 231, 0.15) 0%, var(--color-bg-primary) 70%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow effects */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(108, 92, 231, 0.08) 0%, transparent 70%)',
        top: '-200px',
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, transparent 70%)',
        bottom: '-100px',
        right: '-100px',
        pointerEvents: 'none',
      }} />

      <div className="animate-slide-up" style={{
        textAlign: 'center',
        maxWidth: '480px',
        padding: '0 24px',
      }}>
        {/* Logo */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '80px',
          height: '80px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, var(--color-accent), #8b5cf6)',
          marginBottom: '32px',
          boxShadow: '0 0 40px var(--color-accent-glow)',
          animation: 'pulse-glow 3s ease-in-out infinite',
        }}>
          <Mail size={40} color="white" />
        </div>

        <h1 style={{
          fontSize: '42px',
          fontWeight: 800,
          background: 'linear-gradient(135deg, var(--color-text-primary) 30%, var(--color-accent))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '12px',
          lineHeight: 1.1,
        }}>
          OutBox
        </h1>

        <p style={{
          fontSize: '18px',
          color: 'var(--color-text-secondary)',
          marginBottom: '8px',
          fontWeight: 500,
        }}>
          Email Scheduler
        </p>

        <p style={{
          fontSize: '15px',
          color: 'var(--color-text-muted)',
          marginBottom: '40px',
          lineHeight: 1.6,
        }}>
          Schedule, manage, and track your email campaigns with
          powerful automation and real-time analytics.
        </p>

        {/* Google Sign In Button */}
        <button
          onClick={onLogin}
          className="btn btn-lg"
          style={{
            background: 'white',
            color: '#333',
            fontWeight: 600,
            fontSize: '15px',
            padding: '14px 32px',
            borderRadius: '12px',
            gap: '12px',
            width: '100%',
            maxWidth: '320px',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(-2px)';
            (e.target as HTMLElement).style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            (e.target as HTMLElement).style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.25)';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
          <ArrowRight size={16} />
        </button>

        <p style={{
          fontSize: '12px',
          color: 'var(--color-text-muted)',
          marginTop: '24px',
          lineHeight: 1.5,
        }}>
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
