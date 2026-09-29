import { LogOut, Mail, Bell, Hash } from 'lucide-react';
import type { User, SlackStatus } from '../../types';
import { useState, useEffect } from 'react';
import api from '../../api/client';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);

  useEffect(() => {
    fetchSlackStatus();
  }, []);

  const fetchSlackStatus = async () => {
    try {
      const { data } = await api.get('/slack/status');
      setSlackStatus(data);
    } catch {
      // Slack status check failed — not critical
    }
  };

  const handleSlackConnect = () => {
    window.location.href = '/api/slack/connect';
  };

  const handleSlackDisconnect = async () => {
    try {
      await api.post('/slack/disconnect');
      setSlackStatus({ connected: false, hasWebhook: false, hasToken: false });
    } catch {
      // Ignore
    }
  };

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 32px',
      background: 'var(--color-bg-secondary)',
      borderBottom: '1px solid var(--color-border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, var(--color-accent), #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 16px var(--color-accent-glow)',
        }}>
          <Mail size={20} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
            OutBox
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', letterSpacing: '0.05em' }}>
            Email Scheduler
          </p>
        </div>
      </div>

      {/* Right section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Slack Connect */}
        {slackStatus?.connected ? (
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleSlackDisconnect}
            style={{ gap: '6px' }}
          >
            <Hash size={14} />
            <span style={{ color: 'var(--color-success)' }}>Slack Connected</span>
          </button>
        ) : (
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleSlackConnect}
            style={{ gap: '6px' }}
          >
            <Hash size={14} />
            Connect Slack
          </button>
        )}

        {/* Notifications */}
        <button className="btn btn-icon btn-ghost" style={{ position: 'relative' }}>
          <Bell size={18} />
        </button>

        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '2px solid var(--color-border)',
              }}
            />
          ) : (
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 700,
              color: 'white',
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {user.name}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {user.email}
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          className="btn btn-icon btn-ghost"
          onClick={onLogout}
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
