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
      padding: '0 24px',
      height: '52px',
      background: 'var(--color-bg-secondary)',
      borderBottom: '1px solid var(--color-border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Left — Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Mail size={15} color="white" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
          }}>
            OutBox
          </span>
          <span style={{
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            fontWeight: 400,
          }}>
            Email Scheduler
          </span>
        </div>
      </div>

      {/* Right — Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Slack */}
        {slackStatus?.connected ? (
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleSlackDisconnect}
            style={{ gap: '6px', fontSize: '12px' }}
          >
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--color-success)',
              display: 'inline-block',
            }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>Slack</span>
          </button>
        ) : (
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleSlackConnect}
            style={{ gap: '6px', fontSize: '12px' }}
          >
            <Hash size={12} />
            <span>Connect Slack</span>
          </button>
        )}

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 4px' }} />

        {/* Notifications */}
        <button className="btn btn-icon btn-ghost" aria-label="Notifications">
          <Bell size={16} />
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 4px' }} />

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px' }}>
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              style={{ width: '26px', height: '26px', borderRadius: '50%' }}
            />
          ) : (
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 600,
              color: 'white',
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
              {user.name}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.2 }}>
              {user.email}
            </span>
          </div>
        </div>

        {/* Logout */}
        <button
          className="btn btn-icon btn-ghost"
          onClick={onLogout}
          title="Logout"
          aria-label="Logout"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}
