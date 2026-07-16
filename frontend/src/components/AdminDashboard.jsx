import React, { useState, useEffect } from 'react';
import { 
  Users, Mail, Settings, Shield, Download, Search, 
  RefreshCw, CheckCircle, XCircle, Clock, QrCode, Clipboard, FileText, Send 
} from 'lucide-react';
import { API_BASE } from '../config';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('leads'); 
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [config, setConfig] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    smtpSender: '',
    smsGateway: 'mock',
    twilioSid: '',
    twilioAuthToken: '',
    twilioNumber: '',
    catalogueUrl: '',
    emailTemplateSubject: '',
    emailTemplateBody: '',
    smsTemplateBody: ''
  });
  
  const [settingsStatus, setSettingsStatus] = useState({ type: '', message: '' });
  
  const [qrBaseUrl, setQrBaseUrl] = useState(() => {
    return `${window.location.protocol}//${window.location.host}/?view=form`;
  });

  const [testMailTarget, setTestMailTarget] = useState('');
  const [testPhoneTarget, setTestPhoneTarget] = useState('');
  const [testingMail, setTestingMail] = useState(false);
  const [testingSMS, setTestingSMS] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const leadsRes = await fetch(`${API_BASE}/api/leads`);
      const statsRes = await fetch(`${API_BASE}/api/stats`);
      const configRes = await fetch(`${API_BASE}/api/config`);
      const logsRes = await fetch(`${API_BASE}/api/logs`);

      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (configRes.ok) setConfig(await configRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsStatus({ type: 'info', message: 'Saving config...' });
    try {
      const res = await fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSettingsStatus({ type: 'success', message: 'Configuration saved successfully!' });
        setTimeout(() => setSettingsStatus({ type: '', message: '' }), 4000);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (err) {
      setSettingsStatus({ type: 'error', message: `Error: ${err.message}` });
    }
  };

  const handleSendTestNotification = async (type) => {
    const target = type === 'email' ? testMailTarget : testPhoneTarget;
    if (!target) {
      alert(`Please enter a valid destination ${type === 'email' ? 'email' : 'phone number'}.`);
      return;
    }

    if (type === 'email') setTestingMail(true);
    else setTestingSMS(true);

    try {
      const mockLead = {
        name: 'Test Visitor',
        company: 'Subset Testing Inc.',
        email: type === 'email' ? testMailTarget : 'test@subset.com',
        phone: type === 'sms' ? testPhoneTarget : '555-0199'
      };

      const endpoint = `${API_BASE}/api/leads`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockLead)
      });

      if (res.ok) {
        alert(`Test trigger sent! Check the logs/inbox. Re-fetching events...`);
        fetchData();
      } else {
        alert('Failed to send test dispatch. Check SMTP/Gateway configurations.');
      }
    } catch (err) {
      console.error(err);
      alert('Error triggered during mock post.');
    } finally {
      if (type === 'email') setTestingMail(false);
      else setTestingSMS(false);
    }
  };

  const exportCSV = () => {
    if (leads.length === 0) return;
    
    const headers = ['ID', 'Name', 'Phone', 'Email', 'Company', 'Registered At', 'Email Status', 'SMS Status', 'Interactions count'];
    const rows = leads.map(l => [
      l.id,
      `"${l.name.replace(/"/g, '""')}"`,
      l.phone,
      l.email,
      `"${l.company.replace(/"/g, '""')}"`,
      l.timestamp,
      l.status.email,
      l.status.sms,
      l.interactions.length
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `subset_expo_leads_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sendReportEmail = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/trigger-daily-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        alert('CSV Report successfully sent to sales@subsetpens.com!');
      } else {
        const data = await res.json();
        alert(`Failed to send report: ${data.details || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = 
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone.includes(searchTerm);
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'email-sent') return matchesSearch && l.status.email === 'sent';
    if (statusFilter === 'email-failed') return matchesSearch && l.status.email === 'failed';
    if (statusFilter === 'sms-sent') return matchesSearch && l.status.sms === 'sent';
    if (statusFilter === 'sms-failed') return matchesSearch && l.status.sms === 'failed';
    if (statusFilter === 'active') return matchesSearch && l.interactions.length > 0;
    return matchesSearch;
  });

  const getStatusIcon = (status) => {
    switch(status) {
      case 'sent':
        return <CheckCircle size={14} color="#00e676" style={styles.badgeIcon} />;
      case 'failed':
        return <XCircle size={14} color="#ff3366" style={styles.badgeIcon} />;
      default:
        return <Clock size={14} color="#ffab00" style={styles.badgeIcon} />;
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <Shield size={24} color="var(--accent-primary)" />
          <h1 style={styles.dashboardTitle}>Subset Industries Dashboard</h1>
          <span style={styles.liveIndicator}>LIVE TRACKING</span>
        </div>
        <div style={styles.headerActions}>
          <button onClick={fetchData} disabled={loading} className="btn btn-secondary" style={styles.actionBtn}>
            <RefreshCw size={16} className={loading ? 'spin-animation' : ''} /> Refresh
          </button>
          <button onClick={sendReportEmail} disabled={leads.length === 0} className="btn btn-secondary" style={styles.actionBtn}>
            <Send size={16} /> Email CSV Report
          </button>
          <button onClick={exportCSV} disabled={leads.length === 0} className="btn btn-primary" style={styles.actionBtn}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats Quickbar */}
      {stats && (
        <div style={styles.statsBar}>
          <div className="glass-card" style={styles.statCard}>
            <Users size={20} color="var(--accent-primary)" style={styles.statIcon} />
            <div style={styles.statInfo}>
              <span style={styles.statLabel}>Total Expo Leads</span>
              <span style={styles.statVal}>{stats.totalLeads}</span>
            </div>
          </div>
          <div className="glass-card" style={styles.statCard}>
            <FileText size={20} color="#ffffff" style={styles.statIcon} />
            <div style={styles.statInfo}>
              <span style={styles.statLabel}>Catalogue Engagements</span>
              <span style={styles.statVal}>{stats.totalInteractions}</span>
            </div>
          </div>
          <div className="glass-card" style={styles.statCard}>
            <CheckCircle size={20} color="#00e676" style={styles.statIcon} />
            <div style={styles.statInfo}>
              <span style={styles.statLabel}>Sample Requests</span>
              <span style={styles.statVal}>{stats.sampleRequests}</span>
            </div>
          </div>
          <div className="glass-card" style={styles.statCard}>
            <Mail size={20} color="#ffab00" style={styles.statIcon} />
            <div style={styles.statInfo}>
              <span style={styles.statLabel}>Email Delivery Rate</span>
              <span style={styles.statVal}>
                {stats.totalLeads > 0 
                  ? `${Math.round((stats.emailStats.sent / stats.totalLeads) * 100)}%`
                  : '0%'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={styles.tabContainer}>
        <button 
          onClick={() => setActiveTab('leads')}
          style={{ ...styles.tabButton, ...(activeTab === 'leads' ? styles.activeTab : {}) }}
        >
          <Users size={16} /> Leads List ({filteredLeads.length})
        </button>
        <button 
          onClick={() => setActiveTab('stats')}
          style={{ ...styles.tabButton, ...(activeTab === 'stats' ? styles.activeTab : {}) }}
        >
          <FileText size={16} /> Engagement Specs
        </button>
        <button 
          onClick={() => setActiveTab('qr')}
          style={{ ...styles.tabButton, ...(activeTab === 'qr' ? styles.activeTab : {}) }}
        >
          <QrCode size={16} /> Booth QR Setup
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          style={{ ...styles.tabButton, ...(activeTab === 'settings' ? styles.activeTab : {}) }}
        >
          <Settings size={16} /> Dispatch Setup
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          style={{ ...styles.tabButton, ...(activeTab === 'logs' ? styles.activeTab : {}) }}
        >
          <Clipboard size={16} /> Queue Logs
        </button>
      </div>

      {/* Tab Contents */}
      <div style={styles.tabContentContainer}>
        {/* LEADS LIST */}
        {activeTab === 'leads' && (
          <div className="glass-card animate-fade-in" style={styles.contentCard}>
            <div style={styles.tableFilterRow}>
              <div style={styles.searchWrapper}>
                <Search size={18} style={styles.searchIcon} />
                <input 
                  type="text" 
                  placeholder="Search name, email, company, number..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.tableSearchInput}
                />
              </div>
              
              <div style={styles.filterWrapper}>
                <span style={styles.filterLabel}>Filter By:</span>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)} 
                  style={styles.filterSelect}
                >
                  <option value="all">All Records</option>
                  <option value="email-sent">Email Sent</option>
                  <option value="email-failed">Email Failed</option>
                  <option value="sms-sent">SMS Sent</option>
                  <option value="sms-failed">SMS Failed</option>
                  <option value="active">Active Catalogue Users</option>
                </select>
              </div>
            </div>

            <div style={styles.tableScrollable}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>Lead Details</th>
                    <th style={styles.th}>Company</th>
                    <th style={styles.th}>Registered</th>
                    <th style={styles.th}>Mail Out</th>
                    <th style={styles.th}>SMS Out</th>
                    <th style={styles.th}>Catalogue Interactions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={styles.emptyTableTd}>No leads match the active filters.</td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => (
                      <tr key={lead.id} style={styles.tableBodyRow}>
                        <td style={styles.td}>
                          <div style={styles.leadMainCell}>
                            <span style={styles.leadNameText}>{lead.name}</span>
                            <span style={styles.leadContactText}>{lead.email} | {lead.phone}</span>
                          </div>
                        </td>
                        <td style={styles.td}>{lead.company}</td>
                        <td style={styles.td}>{new Date(lead.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.statusBadge, color: lead.status.email === 'sent' ? '#00e676' : lead.status.email === 'failed' ? '#ff3366' : '#ffab00' }}>
                            {getStatusIcon(lead.status.email)} {lead.status.email}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ ...styles.statusBadge, color: lead.status.sms === 'sent' ? '#00e676' : lead.status.sms === 'failed' ? '#ff3366' : '#ffab00' }}>
                            {getStatusIcon(lead.status.sms)} {lead.status.sms}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {lead.interactions.length === 0 ? (
                            <span style={styles.textMuted}>Registered only</span>
                          ) : (
                            <div style={styles.interactionList}>
                              {lead.interactions.map((it, idx) => (
                                <span key={idx} style={{ 
                                  ...styles.interactionTag,
                                  background: it.action === 'request_sample' ? 'rgba(0, 230, 118, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                                  borderColor: it.action === 'request_sample' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 255, 255, 0.1)'
                                }}>
                                  {it.action === 'request_sample' ? '🎁 Sample' : '👀 View'}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STATS DETAILS */}
        {activeTab === 'stats' && stats && (
          <div className="glass-card animate-fade-in" style={styles.contentCard}>
            <h2 style={styles.tabHeading}>Visitor Catalogue Interactions</h2>
            <p style={styles.tabSubheading}>Visual metrics detailing what products booth visitors are looking at.</p>
            
            <div style={styles.statsLayoutGrid}>
              <div style={styles.gaugeSection}>
                <h4 style={styles.sectionLabel}>Notification Performance</h4>
                <div style={styles.gaugeBlock}>
                  <div style={styles.barGraphRow}>
                    <div style={styles.barLabel}>Email Deliveries ({stats.emailStats.sent}/{stats.totalLeads})</div>
                    <div style={styles.barTrack}>
                      <div style={{ 
                        ...styles.barFill, 
                        background: 'linear-gradient(90deg, var(--accent-primary), #10b981)',
                        width: stats.totalLeads > 0 ? `${(stats.emailStats.sent / stats.totalLeads) * 100}%` : '0%' 
                      }} />
                    </div>
                  </div>
                  <div style={styles.barGraphRow}>
                    <div style={styles.barLabel}>SMS Deliveries ({stats.smsStats.sent}/{stats.totalLeads})</div>
                    <div style={styles.barTrack}>
                      <div style={{ 
                        ...styles.barFill, 
                        background: 'linear-gradient(90deg, #ffffff, #10b981)',
                        width: stats.totalLeads > 0 ? `${(stats.smsStats.sent / stats.totalLeads) * 100}%` : '0%' 
                      }} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.gaugeSection}>
                <h4 style={styles.sectionLabel}>Hourly Scan Activity</h4>
                <div style={styles.timelineChartFlex}>
                  {stats.timeline.length === 0 ? (
                    <div style={styles.emptyChart}>Waiting for scans...</div>
                  ) : (
                    stats.timeline.map((item, index) => (
                      <div key={index} style={styles.timelineCol}>
                        <div style={styles.barHeightLabel}>{item.count}</div>
                        <div style={{
                          ...styles.timelineBarFill,
                          height: `${Math.min(100, (item.count / Math.max(...stats.timeline.map(t=>t.count), 1)) * 80)}px`
                        }} />
                        <div style={styles.timelineHourLabel}>{item.time}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QR GENERATOR */}
        {activeTab === 'qr' && (
          <div className="glass-card animate-fade-in" style={styles.contentCard}>
            <div style={styles.qrGrid}>
              <div style={styles.qrDisplaySide}>
                <div style={styles.qrFrame}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrBaseUrl)}`}
                    alt="Booth Registration QR Code"
                    style={styles.qrImage}
                  />
                </div>
                <p style={styles.qrTip}>Point visitor cameras here to register.</p>
              </div>

              <div style={styles.qrControlSide}>
                <h2 style={styles.tabHeading}>Exhibition QR Configurator</h2>
                <p style={styles.tabSubheading}>Ensure the generated QR points to the address visitors can reach on their mobile networks.</p>

                <div className="input-group">
                  <input 
                    type="text" 
                    className="input-field" 
                    value={qrBaseUrl}
                    onChange={(e) => setQrBaseUrl(e.target.value)}
                    placeholder=" "
                    id="qr_url"
                  />
                  <label htmlFor="qr_url" className="input-label">Registration QR Link URL</label>
                </div>

                <div style={styles.alertBox}>
                  <strong>💡 Setup Pro-Tip:</strong> If visitors scan the QR code and the page does not load, verify that they are connected to the same local Wi-Fi, and change the URL above to match your laptop's Local IP Address (e.g. <code>http://192.168.1.15:5173/?view=form</code>).
                </div>

                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(qrBaseUrl);
                    alert('Copied URL to Clipboard!');
                  }}
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                >
                  Copy URL to Clipboard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SMTP & GATEWAY SETTINGS */}
        {activeTab === 'settings' && (
          <div className="glass-card animate-fade-in" style={styles.contentCard}>
            <form onSubmit={handleSaveSettings}>
              <h2 style={styles.tabHeading}>SMTP (Email) & SMS Gateways</h2>
              <p style={styles.tabSubheading}>Configure Titan/Outlook/Brevo credentials and SMS routing nodes.</p>

              {settingsStatus.message && (
                <div style={{
                  ...styles.statusMessageDiv,
                  borderColor: settingsStatus.type === 'success' ? '#10b981' : settingsStatus.type === 'error' ? '#ef4444' : 'var(--accent-primary)',
                  background: settingsStatus.type === 'success' ? 'rgba(16, 185, 129, 0.05)' : settingsStatus.type === 'error' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(225, 29, 72, 0.05)'
                }}>
                  {settingsStatus.message}
                </div>
              )}

              <div style={styles.settingsGrid}>
                {/* SMTP Sub-Grid */}
                <div style={styles.formSection}>
                  <h3 style={styles.formSectionHeading}>SMTP Outbound Setup</h3>
                  
                  <div style={styles.rowTwoCols}>
                    <div className="input-group">
                      <input 
                        type="text" 
                        className="input-field" 
                        value={config.smtpHost}
                        onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                        placeholder=" "
                        id="smtp_host"
                      />
                      <label htmlFor="smtp_host" className="input-label">SMTP Host (e.g., smtp-relay.brevo.com)</label>
                    </div>

                    <div className="input-group">
                      <input 
                        type="text" 
                        className="input-field" 
                        value={config.smtpPort}
                        onChange={(e) => setConfig({ ...config, smtpPort: e.target.value })}
                        placeholder=" "
                        id="smtp_port"
                      />
                      <label htmlFor="smtp_port" className="input-label">SMTP Port (usually 587 or 465)</label>
                    </div>
                  </div>

                  <div style={styles.rowTwoCols}>
                    <div className="input-group">
                      <input 
                        type="text" 
                        className="input-field" 
                        value={config.smtpUser}
                        onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
                        placeholder=" "
                        id="smtp_user"
                      />
                      <label htmlFor="smtp_user" className="input-label">SMTP Username (Your Email)</label>
                    </div>

                    <div className="input-group">
                      <input 
                        type="password" 
                        className="input-field" 
                        value={config.smtpPass}
                        onChange={(e) => setConfig({ ...config, smtpPass: e.target.value })}
                        placeholder=" "
                        id="smtp_pass"
                      />
                      <label htmlFor="smtp_pass" className="input-label">SMTP Password</label>
                    </div>
                  </div>

                  <div style={styles.rowTwoCols}>
                    <div className="input-group">
                      <input 
                        type="text" 
                        className="input-field" 
                        value={config.smtpSender}
                        onChange={(e) => setConfig({ ...config, smtpSender: e.target.value })}
                        placeholder=" "
                        id="smtp_sender"
                      />
                      <label htmlFor="smtp_sender" className="input-label">Sender Identity Display Label</label>
                    </div>

                    <div className="input-group">
                      <input 
                        type="text" 
                        className="input-field" 
                        value={config.catalogueUrl}
                        onChange={(e) => setConfig({ ...config, catalogueUrl: e.target.value })}
                        placeholder=" "
                        id="catalogue_url"
                      />
                      <label htmlFor="catalogue_url" className="input-label">Product Catalogue URL</label>
                    </div>
                  </div>
                </div>

                {/* SMS Sub-Grid */}
                <div style={styles.formSection}>
                  <h3 style={styles.formSectionHeading}>SMS Dispatcher Config</h3>

                  <div className="input-group">
                    <select 
                      className="input-field"
                      style={{ background: 'rgba(0,0,0,0.3)' }}
                      value={config.smsGateway}
                      onChange={(e) => setConfig({ ...config, smsGateway: e.target.value })}
                      id="sms_gateway"
                    >
                      <option value="mock">Simulated Dispatcher (Sandbox Log-only)</option>
                      <option value="twilio">Twilio API Node (Live Dispatch)</option>
                    </select>
                    <label htmlFor="sms_gateway" className="input-label">SMS Provider Gateway</label>
                  </div>

                  {config.smsGateway === 'twilio' && (
                    <div style={styles.animateOpen}>
                      <div style={styles.rowTwoCols}>
                        <div className="input-group">
                          <input 
                            type="text" 
                            className="input-field" 
                            value={config.twilioSid}
                            onChange={(e) => setConfig({ ...config, twilioSid: e.target.value })}
                            placeholder=" "
                            id="twilio_sid"
                          />
                          <label htmlFor="twilio_sid" className="input-label">Twilio Account SID</label>
                        </div>

                        <div className="input-group">
                          <input 
                            type="password" 
                            className="input-field" 
                            value={config.twilioAuthToken}
                            onChange={(e) => setConfig({ ...config, twilioAuthToken: e.target.value })}
                            placeholder=" "
                            id="twilio_token"
                          />
                          <label htmlFor="twilio_token" className="input-label">Twilio Auth Token</label>
                        </div>
                      </div>

                      <div className="input-group">
                        <input 
                          type="text" 
                          className="input-field" 
                          value={config.twilioNumber}
                          onChange={(e) => setConfig({ ...config, twilioNumber: e.target.value })}
                          placeholder=" "
                          id="twilio_num"
                        />
                        <label htmlFor="twilio_num" className="input-label">Twilio Outbound Sender Number</label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Templates section */}
              <div style={styles.formSection}>
                <h3 style={styles.formSectionHeading}>Auto-Responder Templates</h3>
                <p style={{ ...styles.tabSubheading, marginTop: '-0.8rem', marginBottom: '1.2rem' }}>
                  Inject placeholders like <code>{"{{name}}"}</code> and <code>{"{{company}}"}</code> to customize dynamic responses.
                </p>

                <div className="input-group">
                  <input 
                    type="text" 
                    className="input-field" 
                    value={config.emailTemplateSubject}
                    onChange={(e) => setConfig({ ...config, emailTemplateSubject: e.target.value })}
                    placeholder=" "
                    id="email_subj"
                  />
                  <label htmlFor="email_subj" className="input-label">Email Response Subject Line</label>
                </div>

                <div className="input-group">
                  <textarea 
                    className="input-field" 
                    rows="5"
                    style={{ minHeight: '120px', resize: 'vertical' }}
                    value={config.emailTemplateBody}
                    onChange={(e) => setConfig({ ...config, emailTemplateBody: e.target.value })}
                    placeholder=" "
                    id="email_body"
                  />
                  <label htmlFor="email_body" className="input-label">Email Message Body Text</label>
                </div>

                <div className="input-group">
                  <textarea 
                    className="input-field" 
                    rows="3"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    value={config.smsTemplateBody}
                    onChange={(e) => setConfig({ ...config, smsTemplateBody: e.target.value })}
                    placeholder=" "
                    id="sms_body"
                  />
                  <label htmlFor="sms_body" className="input-label">SMS Message Body Text</label>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '2rem' }}>
                Save Configurations
              </button>
            </form>

            {/* Test notification panel */}
            <div style={styles.testNotificationBlock}>
              <h3 style={styles.formSectionHeading}>Quick-Test Credentials</h3>
              <p style={styles.tabSubheading}>Dispatch a test post immediately to verify SMTP configuration channels.</p>
              
              <div style={styles.rowTwoCols}>
                <div style={styles.testChannelCol}>
                  <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                    <input 
                      type="email" 
                      className="input-field" 
                      placeholder=" "
                      value={testMailTarget}
                      onChange={(e) => setTestMailTarget(e.target.value)}
                      id="test_email"
                    />
                    <label htmlFor="test_email" className="input-label">Target Testing Email Address</label>
                  </div>
                  <button 
                    onClick={() => handleSendTestNotification('email')}
                    disabled={testingMail}
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '0.6rem 1rem', fontSize: '0.9rem' }}
                  >
                    <Send size={14} /> {testingMail ? 'Verifying SMTP...' : 'Send Test Mail'}
                  </button>
                </div>

                <div style={styles.testChannelCol}>
                  <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                    <input 
                      type="tel" 
                      className="input-field" 
                      placeholder=" "
                      value={testPhoneTarget}
                      onChange={(e) => setTestPhoneTarget(e.target.value)}
                      id="test_sms"
                    />
                    <label htmlFor="test_sms" className="input-label">Target Testing Phone Number</label>
                  </div>
                  <button 
                    onClick={() => handleSendTestNotification('sms')}
                    disabled={testingSMS}
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '0.6rem 1rem', fontSize: '0.9rem' }}
                  >
                    <Send size={14} /> {testingSMS ? 'Sending SMS...' : 'Send Test SMS'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="glass-card animate-fade-in" style={styles.contentCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={styles.tabHeading}>System Event Logs</h2>
                <p style={styles.tabSubheading}>Outgoing SMTP queues and Twilio pipeline logs.</p>
              </div>
              <button onClick={fetchData} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                Refresh Logs
              </button>
            </div>

            <div style={styles.logList}>
              {logs.length === 0 ? (
                <div style={styles.emptyLogs}>No events logged yet. Submit a form to trigger logs.</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} style={{
                    ...styles.logItem,
                    borderColor: log.status === 'success' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 51, 102, 0.15)',
                    background: log.status === 'success' ? 'rgba(0, 230, 118, 0.02)' : 'rgba(255, 51, 102, 0.02)'
                  }}>
                    <div style={styles.logHeader}>
                      <span style={{ 
                        ...styles.logBadgeType,
                        background: log.type === 'email' ? 'rgba(225, 29, 72, 0.08)' : 'rgba(255, 255, 255, 0.06)',
                        color: log.type === 'email' ? 'var(--accent-primary)' : '#ffffff'
                      }}>{log.type.toUpperCase()}</span>
                      <span style={styles.logTime}>{new Date(log.timestamp).toLocaleTimeString()} - {new Date(log.timestamp).toLocaleDateString()}</span>
                    </div>

                    <div style={styles.logMeta}>
                      <strong>Recipient:</strong> {log.recipient} | <strong>Status:</strong>{' '}
                      <span style={{ color: log.status === 'success' ? '#00e676' : '#ff3366', fontWeight: '700' }}>
                        {log.status.toUpperCase()}
                      </span>
                    </div>

                    <p style={styles.logMsgText}>{log.message}</p>
                    
                    {log.error && (
                      <div style={styles.logErrorBlock}>
                        <strong>Error trace:</strong> {log.error}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem 3rem',
    maxWidth: '1200px',
    margin: '0 auto',
    zIndex: 1,
    position: 'relative'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: '1.2rem'
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem'
  },
  dashboardTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#fff',
    letterSpacing: '-0.01em'
  },
  liveIndicator: {
    background: 'rgba(0, 230, 118, 0.1)',
    color: '#00e676',
    border: '1px solid rgba(0, 230, 118, 0.3)',
    borderRadius: '4px',
    padding: '0.2rem 0.5rem',
    fontSize: '0.65rem',
    fontWeight: '700',
    letterSpacing: '0.05em'
  },
  headerActions: {
    display: 'flex',
    gap: '0.8rem'
  },
  actionBtn: {
    padding: '0.6rem 1.2rem',
    fontSize: '0.9rem',
    height: '42px'
  },
  statsBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1.2rem',
    marginBottom: '2rem'
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '1.2rem 1.5rem',
    gap: '1.2rem',
    background: 'rgba(10, 10, 10, 0.55)'
  },
  statIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.02)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '10px'
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column'
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.2rem'
  },
  statVal: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'var(--font-display)'
  },
  tabContainer: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    marginBottom: '1.5rem',
    paddingBottom: '0.5rem'
  },
  tabButton: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.8rem 1.2rem',
    fontSize: '0.95rem',
    fontFamily: 'var(--font-display)',
    fontWeight: '500',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderRadius: '8px',
    transition: 'all 0.2s ease'
  },
  activeTab: {
    color: 'var(--accent-primary)',
    background: 'rgba(225, 29, 72, 0.08)'
  },
  tabContentContainer: {
    minHeight: '400px'
  },
  contentCard: {
    background: 'rgba(10, 10, 10, 0.4)',
    border: '1px solid rgba(255,255,255,0.04)',
    padding: '2rem'
  },
  tableFilterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    gap: '1rem'
  },
  searchWrapper: {
    position: 'relative',
    flex: 1,
    maxWidth: '450px'
  },
  searchIcon: {
    position: 'absolute',
    left: '1rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)'
  },
  tableSearchInput: {
    width: '100%',
    padding: '0.7rem 1rem 0.7rem 2.8rem',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid var(--glass-border)',
    borderRadius: '10px',
    color: 'var(--text-main)',
    outline: 'none',
    fontSize: '0.9rem'
  },
  filterWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem'
  },
  filterLabel: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)'
  },
  filterSelect: {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    padding: '0.6rem 1rem',
    color: 'var(--text-main)',
    fontSize: '0.85rem',
    outline: 'none'
  },
  tableScrollable: {
    width: '100%',
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
  },
  tableHeaderRow: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  },
  th: {
    padding: '1rem',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: '600'
  },
  tableBodyRow: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
    transition: 'background 0.2s',
    cursor: 'default'
  },
  td: {
    padding: '1.2rem 1rem',
    fontSize: '0.9rem',
    verticalAlign: 'middle'
  },
  emptyTableTd: {
    padding: '3rem',
    textAlign: 'center',
    color: 'var(--text-dark)',
    fontSize: '0.95rem'
  },
  leadMainCell: {
    display: 'flex',
    flexDirection: 'column'
  },
  leadNameText: {
    color: '#fff',
    fontWeight: '600'
  },
  leadContactText: {
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    marginTop: '0.2rem'
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.8rem',
    textTransform: 'capitalize',
    fontWeight: '500'
  },
  badgeIcon: {
    marginRight: '0.3rem'
  },
  textMuted: {
    color: 'var(--text-dark)',
    fontSize: '0.8rem'
  },
  interactionList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem'
  },
  interactionTag: {
    fontSize: '0.75rem',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    border: '1px solid'
  },
  tabHeading: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '0.3rem'
  },
  tabSubheading: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    marginBottom: '1.8rem'
  },
  statsLayoutGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2.5rem'
  },
  gaugeSection: {
    display: 'flex',
    flexDirection: 'column'
  },
  sectionLabel: {
    fontSize: '0.9rem',
    textTransform: 'uppercase',
    color: '#fff',
    letterSpacing: '0.05em',
    marginBottom: '1.2rem',
    borderLeft: '2px solid var(--accent-primary)',
    paddingLeft: '0.6rem'
  },
  gaugeBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    background: 'rgba(0,0,0,0.15)',
    padding: '1.8rem',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.02)'
  },
  barGraphRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem'
  },
  barLabel: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)'
  },
  barTrack: {
    width: '100%',
    height: '10px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '5px',
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    borderRadius: '5px',
    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  timelineChartFlex: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '180px',
    background: 'rgba(0,0,0,0.15)',
    padding: '1.8rem 1.8rem 1rem',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.02)'
  },
  emptyChart: {
    alignSelf: 'center',
    margin: '0 auto',
    color: 'var(--text-dark)',
    fontSize: '0.85rem'
  },
  timelineCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    flex: 1
  },
  barHeightLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  timelineBarFill: {
    width: '16px',
    background: 'var(--accent-gradient)',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.8s ease'
  },
  timelineHourLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-dark)',
    marginTop: '0.2rem'
  },
  qrGrid: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
    gap: '2.5rem',
    alignItems: 'center'
  },
  qrDisplaySide: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  qrFrame: {
    background: '#fff',
    padding: '1rem',
    borderRadius: '16px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    marginBottom: '1rem'
  },
  qrImage: {
    display: 'block',
    width: '200px',
    height: '200px'
  },
  qrTip: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)'
  },
  qrControlSide: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem'
  },
  alertBox: {
    background: 'rgba(225, 29, 72, 0.04)',
    border: '1px solid rgba(225, 29, 72, 0.12)',
    padding: '1rem 1.2rem',
    borderRadius: '10px',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: '1.5'
  },
  statusMessageDiv: {
    padding: '1rem',
    borderRadius: '10px',
    border: '1px solid',
    fontSize: '0.9rem',
    marginBottom: '1.5rem'
  },
  settingsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2.5rem',
    marginBottom: '2rem'
  },
  formSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  formSectionHeading: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '1.2rem',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    paddingBottom: '0.5rem'
  },
  rowTwoCols: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.2rem'
  },
  animateOpen: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    animation: 'fadeInUp 0.3s ease'
  },
  testNotificationBlock: {
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.03)',
    borderRadius: '16px',
    padding: '1.8rem',
    marginTop: '1rem'
  },
  testChannelCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem'
  },
  logList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
    maxHeight: '450px',
    overflowY: 'auto',
    paddingRight: '0.5rem'
  },
  emptyLogs: {
    padding: '3rem',
    textAlign: 'center',
    color: 'var(--text-dark)',
    fontSize: '0.9rem'
  },
  logItem: {
    border: '1px solid',
    borderRadius: '12px',
    padding: '1rem 1.2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logBadgeType: {
    fontSize: '0.7rem',
    fontWeight: '700',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    letterSpacing: '0.05em'
  },
  logTime: {
    fontSize: '0.75rem',
    color: 'var(--text-dark)'
  },
  logMeta: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)'
  },
  logMsgText: {
    fontSize: '0.85rem',
    color: 'var(--text-main)',
    lineHeight: '1.4'
  },
  logErrorBlock: {
    background: 'rgba(255, 51, 102, 0.05)',
    border: '1px solid rgba(255, 51, 102, 0.1)',
    borderRadius: '6px',
    padding: '0.6rem 0.8rem',
    fontSize: '0.75rem',
    color: '#ff3366',
    fontFamily: 'monospace',
    wordBreak: 'break-all'
  }
};
