import { format } from 'date-fns';
import { ExternalLink, Inbox } from 'lucide-react';
import type { Email } from '../types';

interface EmailTableProps {
  emails: Email[];
  loading: boolean;
  type: 'scheduled' | 'sent';
}

function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, string> = {
    SCHEDULED: 'badge-scheduled',
    QUEUED: 'badge-queued',
    SENDING: 'badge-sending',
    SENT: 'badge-sent',
    FAILED: 'badge-failed',
    RATE_LIMITED: 'badge-rate-limited',
  };

  const dotColors: Record<string, string> = {
    SCHEDULED: 'var(--color-info)',
    QUEUED: 'var(--color-accent)',
    SENDING: 'var(--color-warning)',
    SENT: 'var(--color-success)',
    FAILED: 'var(--color-error)',
    RATE_LIMITED: 'var(--color-warning)',
  };

  return (
    <span className={`badge ${statusMap[status] || 'badge-scheduled'}`}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: dotColors[status] || 'var(--color-info)',
        display: 'inline-block',
      }} />
      {status.replace('_', ' ')}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      <td><div className="skeleton" style={{ height: '14px', width: '180px' }} /></td>
      <td><div className="skeleton" style={{ height: '14px', width: '220px' }} /></td>
      <td><div className="skeleton" style={{ height: '14px', width: '140px' }} /></td>
      <td><div className="skeleton" style={{ height: '24px', width: '80px', borderRadius: '99px' }} /></td>
      <td><div className="skeleton" style={{ height: '14px', width: '60px' }} /></td>
    </tr>
  );
}

export default function EmailTable({ emails, loading, type }: EmailTableProps) {
  if (loading) {
    return (
      <div className="animate-fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Subject</th>
              <th>{type === 'sent' ? 'Sent At' : 'Scheduled At'}</th>
              <th>Status</th>
              <th>Preview</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </tbody>
        </table>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-state-icon">
          <Inbox size={36} />
        </div>
        <p className="empty-state-title">
          {type === 'sent' ? 'No sent emails yet' : 'No scheduled emails'}
        </p>
        <p className="empty-state-text">
          {type === 'sent'
            ? 'Emails will appear here once they have been sent successfully.'
            : 'Schedule your first email to get started. They will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Recipient</th>
            <th>Subject</th>
            <th>{type === 'sent' ? 'Sent At' : 'Scheduled At'}</th>
            <th>From</th>
            <th>Status</th>
            <th>Preview</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((email, index) => (
            <tr
              key={email.id}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <td>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                  {email.toEmail}
                </span>
              </td>
              <td>
                <span className="truncate" style={{ maxWidth: '280px', display: 'inline-block' }}>
                  {email.subject}
                </span>
              </td>
              <td>
                <span style={{ fontSize: '13px' }}>
                  {type === 'sent' && email.sentAt
                    ? format(new Date(email.sentAt), 'MMM dd, yyyy HH:mm')
                    : format(new Date(email.scheduledAt), 'MMM dd, yyyy HH:mm')}
                </span>
              </td>
              <td>
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  {email.fromEmail}
                </span>
              </td>
              <td>
                <StatusBadge status={email.status} />
              </td>
              <td>
                {email.etherealUrl ? (
                  <a
                    href={email.etherealUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-ghost"
                    style={{ gap: '4px', fontSize: '12px', color: 'var(--color-accent)' }}
                  >
                    <ExternalLink size={12} /> View
                  </a>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
