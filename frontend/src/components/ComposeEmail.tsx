import { useState, useRef, useCallback } from 'react';
import { X, Upload, Send, Clock, FileText } from 'lucide-react';
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
  const [hourlyLimit, setHourlyLimit] = useState('50');
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
    toast.success(`Found ${unique.length} email addresses`);
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
        // Single email
        await api.post('/emails/schedule', {
          fromEmail,
          toEmail: allRecipients[0],
          subject,
          body,
          scheduledAt: new Date(scheduledAt).toISOString(),
          senderLabel,
        });
      } else {
        // Bulk emails via FormData (for file upload support)
        const formData = new FormData();
        formData.append('fromEmail', fromEmail);
        formData.append('subject', subject);
        formData.append('body', body);
        formData.append('scheduledAt', new Date(scheduledAt).toISOString());
        formData.append('delayBetweenEmailsMs', delayBetween);
        formData.append('hourlyLimit', hourlyLimit);
        formData.append('senderLabel', senderLabel);
        formData.append('recipients', JSON.stringify(allRecipients));
        if (file) {
          formData.append('file', file);
        }

        await api.post('/emails/schedule-bulk', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success(`${allRecipients.length} email(s) scheduled successfully! 🚀`);
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              📨 Compose New Email
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Schedule emails to be sent at a specific time
            </p>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* From Email */}
          <div style={{ marginBottom: '16px' }}>
            <label className="label">From Email *</label>
            <input
              className="input"
              type="email"
              placeholder="sender@example.com"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              required
            />
          </div>

          {/* Sender Label */}
          <div style={{ marginBottom: '16px' }}>
            <label className="label">Sender Label</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Campaign-A, Marketing"
              value={senderLabel}
              onChange={(e) => setSenderLabel(e.target.value)}
            />
          </div>

          {/* Recipients */}
          <div style={{ marginBottom: '16px' }}>
            <label className="label">Recipients *</label>
            <textarea
              className="input"
              placeholder="Enter email addresses (comma or newline separated)"
              value={singleRecipient}
              onChange={(e) => setSingleRecipient(e.target.value)}
              style={{ minHeight: '70px' }}
            />
          </div>

          {/* CSV Upload */}
          <div style={{ marginBottom: '16px' }}>
            <label className="label">Or Upload CSV/Text File</label>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                  <FileText size={24} color="var(--color-accent)" />
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {file.name}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--color-success)' }}>
                      ✅ {recipients.length} email addresses detected
                    </p>
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
                <>
                  <Upload size={32} color="var(--color-text-muted)" style={{ marginBottom: '8px' }} />
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                    Drag & drop a file or <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>click to browse</span>
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Supports CSV, TXT files with email addresses
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Subject */}
          <div style={{ marginBottom: '16px' }}>
            <label className="label">Subject *</label>
            <input
              className="input"
              type="text"
              placeholder="Email subject line"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          {/* Body */}
          <div style={{ marginBottom: '16px' }}>
            <label className="label">Body *</label>
            <textarea
              className="input"
              placeholder="Write your email content here (HTML supported)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              style={{ minHeight: '120px' }}
            />
          </div>

          {/* Schedule Settings */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '12px',
            marginBottom: '24px',
            padding: '16px',
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}>
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
              <label className="label">Delay Between (ms)</label>
              <input
                className="input"
                type="number"
                min="500"
                value={delayBetween}
                onChange={(e) => setDelayBetween(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Hourly Limit</label>
              <input
                className="input"
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
              />
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                  Scheduling...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Schedule {recipients.length > 0 ? `${recipients.length} Emails` : 'Email'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
