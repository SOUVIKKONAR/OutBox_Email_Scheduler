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

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="glass-card animate-fade-in" style={{
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flex: 1,
      minWidth: '180px',
    }}>
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: 'var(--radius-md)',
        background: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>
          {value}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          {label}
        </p>
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
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchEmails, 10000);
    return () => clearInterval(interval);
  }, [fetchEmails]);

  // Check URL params for Slack callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slackStatus = params.get('slack');
    if (slackStatus === 'connected') {
      toast.success('🎉 Slack connected successfully!');
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
      toast.error('Search failed — Elasticsearch may not be available');
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
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
      <Header user={user} onLogout={onLogout} />

      <main style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Stats Row */}
        {stats && (
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <StatCard icon={<Layers size={22} />} label="Delayed" value={stats.delayed} color="#42a5f5" />
            <StatCard icon={<Clock size={22} />} label="Waiting" value={stats.waiting} color="#ffa726" />
            <StatCard icon={<BarChart3 size={22} />} label="Active" value={stats.active} color="#6c5ce7" />
            <StatCard icon={<Send size={22} />} label="Completed" value={stats.completed} color="#00d2a0" />
            <StatCard icon={<AlertTriangle size={22} />} label="Failed" value={stats.failed} color="#ef5350" />
          </div>
        )}

        {/* Controls Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          {/* Tabs */}
          <div className="tab-list">
            <button
              className={`tab ${activeTab === 'scheduled' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('scheduled')}
            >
              <Clock size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Scheduled ({scheduledTotal})
            </button>
            <button
              className={`tab ${activeTab === 'sent' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('sent')}
            >
              <Send size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Sent ({sentTotal})
            </button>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type="text"
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                style={{ paddingLeft: '36px', width: '260px' }}
              />
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                }}
              />
            </div>

            {/* Refresh */}
            <button className="btn btn-secondary btn-sm" onClick={fetchEmails} title="Refresh">
              <RefreshCcw size={14} />
            </button>

            {/* Compose */}
            <button className="btn btn-primary" onClick={() => setShowCompose(true)}>
              <Plus size={16} />
              Compose Email
            </button>
          </div>
        </div>

        {/* Email Table */}
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <EmailTable emails={currentEmails} loading={loading} type={activeTab} />
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            marginTop: '20px',
          }}>
            <button
              className="btn btn-sm btn-secondary"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </button>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', padding: '0 12px' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn btn-sm btn-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        )}
      </main>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeEmail
          onClose={() => setShowCompose(false)}
          onScheduled={fetchEmails}
        />
      )}
    </div>
  );
}
