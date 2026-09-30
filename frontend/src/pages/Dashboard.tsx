import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCcw, Search, BarChart3, Clock, Send, AlertTriangle, Layers } from 'lucide-react';
import Header from '../components/layout/Header';
import EmailTable from '../components/EmailTable';
import ComposeEmail from '../components/ComposeEmail';
import type { User, Email, QueueStats } from '../types';
import api from '../api/client';
import toast from 'react-hot-toast';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

type TabType = 'scheduled' | 'sent';

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="surface-card animate-fade-in" style={{
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      flex: 1,
      minWidth: '160px',
      transition: 'all 0.2s ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.borderColor = 'var(--color-border-focus)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.borderColor = 'var(--color-border)';
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)' }}>
        {icon}
        <span style={{ fontSize: '13px', fontWeight: 500 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '32px', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduledPage, setScheduledPage] = useState(1);
  const [sentPage, setSentPage] = useState(1);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [sentTotal, setSentTotal] = useState(0);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduledRes, sentRes, statsRes] = await Promise.all([
        api.get('/emails/scheduled', { params: { page: scheduledPage, limit: 20 } }),
        api.get('/emails/sent', { params: { page: sentPage, limit: 20 } }),
        api.get('/emails/stats'),
      ]);

      setScheduledEmails(scheduledRes.data.emails);
      setScheduledTotal(scheduledRes.data.total);
      setSentEmails(sentRes.data.emails);
      setSentTotal(sentRes.data.total);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  }, [scheduledPage, sentPage]);

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 10000);
    return () => clearInterval(interval);
  }, [fetchEmails]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slackStatus = params.get('slack');
    if (slackStatus === 'connected') {
      toast.success('Slack connected successfully');
      window.history.replaceState({}, '', '/dashboard');
    } else if (slackStatus === 'error') {
      toast.error('Failed to connect Slack');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchEmails();
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/search', {
        params: { q: searchQuery, status: activeTab === 'sent' ? 'SENT' : 'SCHEDULED' },
      });
      if (activeTab === 'scheduled') {
        setScheduledEmails(data.results);
        setScheduledTotal(data.total);
      } else {
        setSentEmails(data.results);
        setSentTotal(data.total);
      }
    } catch {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const currentEmails = activeTab === 'scheduled' ? scheduledEmails : sentEmails;
  const currentTotal = activeTab === 'scheduled' ? scheduledTotal : sentTotal;
  const currentPage = activeTab === 'scheduled' ? scheduledPage : sentPage;
  const setCurrentPage = activeTab === 'scheduled' ? setScheduledPage : setSentPage;
  const totalPages = Math.ceil(currentTotal / 20);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header user={user} onLogout={onLogout} />

      <main style={{ flex: 1, padding: '40px 32px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        
        {/* Hero Section */}
        <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
              Emails
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)' }}>
              Manage and monitor your outbound email pipeline.
            </p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setShowCompose(true)}>
            <Plus size={18} />
            Compose New Email
          </button>
        </div>

        {/* Stats Row */}
        {stats && (
          <div style={{ display: 'flex', gap: '20px', marginBottom: '48px', flexWrap: 'wrap' }}>
            <StatCard icon={<Layers size={16} color="var(--color-info)" />} label="Delayed" value={stats.delayed} />
            <StatCard icon={<Clock size={16} color="var(--color-warning)" />} label="Waiting" value={stats.waiting} />
            <StatCard icon={<BarChart3 size={16} color="var(--color-accent)" />} label="Active" value={stats.active} />
            <StatCard icon={<Send size={16} color="var(--color-success)" />} label="Completed" value={stats.completed} />
            <StatCard icon={<AlertTriangle size={16} color="var(--color-error)" />} label="Failed" value={stats.failed} />
          </div>
        )}

        {/* List Section */}
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Email Activity
          </h2>
        </div>
        
        <div className="surface-card" style={{ padding: '0', overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-card)'
          }}>
            <div className="tab-list">
              <button
                className={`tab ${activeTab === 'scheduled' ? 'tab-active' : ''}`}
                onClick={() => { setActiveTab('scheduled'); setSearchQuery(''); }}
              >
                Scheduled
                <span style={{ 
                  marginLeft: '8px', 
                  fontSize: '11px', 
                  fontWeight: 600,
                  padding: '2px 8px', 
                  borderRadius: '12px', 
                  background: activeTab === 'scheduled' ? 'var(--color-border)' : 'transparent',
                  color: activeTab === 'scheduled' ? 'var(--color-text-primary)' : 'var(--color-text-muted)'
                }}>
                  {scheduledTotal}
                </span>
              </button>
              <button
                className={`tab ${activeTab === 'sent' ? 'tab-active' : ''}`}
                onClick={() => { setActiveTab('sent'); setSearchQuery(''); }}
              >
                Sent
                <span style={{ 
                  marginLeft: '8px', 
                  fontSize: '11px', 
                  fontWeight: 600,
                  padding: '2px 8px', 
                  borderRadius: '12px', 
                  background: activeTab === 'sent' ? 'var(--color-border)' : 'transparent',
                  color: activeTab === 'sent' ? 'var(--color-text-primary)' : 'var(--color-text-muted)'
                }}>
                  {sentTotal}
                </span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type="text"
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  style={{ paddingLeft: '36px', width: '280px', height: '36px', borderRadius: 'var(--radius-md)' }}
                />
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)',
                  }}
                />
              </div>
              <button className="btn btn-secondary btn-icon" onClick={fetchEmails} title="Refresh" style={{ height: '36px', width: '36px' }}>
                <RefreshCcw size={14} />
              </button>
            </div>
          </div>

          <EmailTable emails={currentEmails} loading={loading} type={activeTab} />
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            marginTop: '24px',
          }}>
            <button
              className="btn btn-sm btn-ghost"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </button>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn btn-sm btn-ghost"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        )}
      </main>

      {showCompose && (
        <ComposeEmail
          onClose={() => setShowCompose(false)}
          onScheduled={fetchEmails}
        />
      )}
    </div>
  );
}
