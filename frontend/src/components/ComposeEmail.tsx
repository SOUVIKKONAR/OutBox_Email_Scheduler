import { useState, useRef, useCallback } from 'react';
import { X, Upload, Send, Clock, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';

interface ComposeEmailProps {
  onClose: () => void;
  onScheduled: () => void;
}

export default function ComposeEmail({ onClose, onScheduled }: ComposeEmailProps) {
  const [fromEmail, setFromEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [delayBetween, setDelayBetween] = useState('2000');
  const [senderLabel, setSenderLabel] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [singleRecipient, setSingleRecipient] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFileForEmails = useCallback(async (file: File) => {
    const text = await file.text();
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const found = text.match(emailRegex) || [];
    const unique = [...new Set(found)];
    setRecipients(unique);
    if (unique.length > 0) {
      toast.success(`Parsed ${unique.length} email addresses`);
    } else {
      toast.error('No valid emails found in file');
    }
  }, []);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      parseFileForEmails(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      parseFileForEmails(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromEmail || !subject || !body || !scheduledAt) {
      toast.error('Please fill in all required fields');
      return;
    }

    const allRecipients = [...recipients];
    if (singleRecipient.trim()) {
      allRecipients.push(...singleRecipient.split(/[,;\n]+/).map(e => e.trim()).filter(e => e.includes('@')));
    }

    if (allRecipients.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }

    setLoading(true);

    try {
      if (allRecipients.length === 1) {
        await api.post('/emails/schedule', {
          fromEmail,
          toEmail: allRecipients[0],
          subject,
          body,
          scheduledAt: new Date(scheduledAt).toISOString(),
          senderLabel,
        });
      } else {
        const formData = new FormData();
        formData.append('fromEmail', fromEmail);
        formData.append('subject', subject);
        formData.append('body', body);
        formData.append('scheduledAt', new Date(scheduledAt).toISOString());
        formData.append('delayBetweenEmailsMs', delayBetween);
        formData.append('senderLabel', senderLabel);
        formData.append('recipients', JSON.stringify(allRecipients));
        if (file) {
          formData.append('file', file);
        }

        await api.post('/emails/schedule-bulk', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success(`${allRecipients.length} email(s) scheduled successfully`);
      onScheduled();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to schedule emails');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', padding: '0' }}>
        
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '20px 24px',
          borderBottom: '1px solid var(--color-border)'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Compose Email
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Schedule a campaign or send a single message
            </p>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* 1. Sender Section */}
            <section>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>Sender</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="label">From Email *</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="you@example.com"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Sender Label</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. Newsletter, Marketing"
                    value={senderLabel}
                    onChange={(e) => setSenderLabel(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <div style={{ height: '1px', background: 'var(--color-border)' }} />

            {/* 2. Recipients Section */}
            <section>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>Recipients</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.xlsx"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  {file ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', background: 'var(--color-bg-elevated)', borderRadius: '8px' }}>
                          <FileText size={20} color="var(--color-text-secondary)" />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                            {file.name}
                          </p>
                          {recipients.length > 0 ? (
                            <p style={{ fontSize: '12px', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <CheckCircle2 size={12} /> {recipients.length} addresses detected
                            </p>
                          ) : (
                            <p style={{ fontSize: '12px', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <AlertCircle size={12} /> No valid addresses found
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-icon btn-ghost"
                        onClick={(e) => { e.stopPropagation(); setFile(null); setRecipients([]); }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Upload size={24} color="var(--color-text-muted)" />
                      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        Drag a CSV file here or <span style={{ color: 'var(--color-text-primary)', fontWeight: 500, textDecoration: 'underline' }}>browse</span>
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Manual Entry</label>
                  <textarea
                    className="input"
                    placeholder="Enter emails separated by commas"
                    value={singleRecipient}
                    onChange={(e) => setSingleRecipient(e.target.value)}
                    style={{ minHeight: '60px' }}
                  />
                </div>
              </div>
            </section>

            <div style={{ height: '1px', background: 'var(--color-border)' }} />

            {/* 3. Content Section */}
            <section>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>Message</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="label">Subject *</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="What is this about?"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Body *</label>
                  <textarea
                    className="input"
                    placeholder="Write your email content..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    style={{ minHeight: '140px', fontFamily: 'var(--font-mono, monospace)', fontSize: '12px' }}
                  />
                </div>
              </div>
            </section>

            <div style={{ height: '1px', background: 'var(--color-border)' }} />

            {/* 4. Scheduling Section */}
            <section>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>Scheduling</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--color-bg-elevated)', padding: '16px', borderRadius: '8px' }}>
                <div>
                  <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> Start Time *
                  </label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Delay Between</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      type="number"
                      min="500"
                      value={delayBetween}
                      onChange={(e) => setDelayBetween(e.target.value)}
                      style={{ paddingRight: '36px' }}
                    />
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--color-text-muted)' }}>ms</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '16px 24px', 
            background: 'var(--color-bg-secondary)', 
            borderTop: '1px solid var(--color-border)',
            borderBottomLeftRadius: 'var(--radius-xl)',
            borderBottomRightRadius: 'var(--radius-xl)'
          }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              * Required fields
            </span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Schedule {recipients.length > 0 ? `${recipients.length} Emails` : 'Email'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
