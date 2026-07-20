import React, { useState, useEffect } from 'react';
import LeadForm from './components/LeadForm';
import Catalogue from './components/Catalogue';
import AdminDashboard from './components/AdminDashboard';
import { Shield, Laptop } from 'lucide-react';

function App() {
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'form';
  });

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const navigateTo = (newView) => {
    setView(newView);
    const newUrl = `${window.location.origin}${window.location.pathname}?view=${newView}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setView(params.get('view') || 'form');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleAdminAccess = () => {
    if (view === 'admin') {
      navigateTo('form');
    } else {
      setShowPinModal(true);
    }
  };

  const verifyPin = (e) => {
    e.preventDefault();
    if (pinInput === 'SIPL@2026*') {
      setPinError(false);
      setPinInput('');
      setShowPinModal(false);
      navigateTo('admin');
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  return (
    <div style={styles.appWrapper}>
      {view === 'form' && <LeadForm onNavigate={navigateTo} />}
      {view === 'catalogue' && <Catalogue onNavigate={navigateTo} />}
      {view === 'admin' && <AdminDashboard />}

      {/* Floating Toggle Admin Button */}
      <button 
        onClick={handleAdminAccess} 
        style={styles.adminToggleBtn} 
        title={view === 'admin' ? 'Return to Booth Form' : 'Access Admin Dashboard'}
      >
        {view === 'admin' ? (
          <>
            <Laptop size={18} />
            <span style={styles.btnLabel}>Booth Form</span>
          </>
        ) : (
          <>
            <Shield size={18} />
            <span style={styles.btnLabel}>Admin Panel</span>
          </>
        )}
      </button>

      {/* Admin PIN Validation Modal */}
      {showPinModal && (
        <div style={styles.modalOverlay}>
          <div className="glass-card animate-fade-in" style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <Shield size={36} color="var(--accent-primary)" />
              <h3 style={styles.modalTitle}>Coordinator Verification</h3>
              <p style={styles.modalSubtitle}>Please verify credentials to access administrative metrics.</p>
            </div>

            <form onSubmit={verifyPin} style={styles.modalForm}>
              <div className="input-group" style={{ marginBottom: '1.2rem' }}>
                <input 
                  type="password" 
                  className="input-field" 
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder=" "
                  id="admin_pin"
                  autoFocus
                />
                <label htmlFor="admin_pin" className="input-label">Enter Admin Passcode</label>
              </div>

              {pinError && (
                <p style={styles.errorText}>Invalid passcode. Please try again.</p>
              )}

              <div style={styles.modalActions}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowPinModal(false);
                    setPinError(false);
                    setPinInput('');
                  }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Authorize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  appWrapper: {
    minHeight: '100vh',
    position: 'relative'
  },
  adminToggleBtn: {
    position: 'fixed',
    bottom: '2rem',
    right: '2rem',
    zIndex: 999,
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.8rem 1.2rem',
    borderRadius: '30px',
    background: 'rgba(15, 14, 28, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(8px)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    fontFamily: 'var(--font-display)',
    fontSize: '0.85rem',
    fontWeight: '600'
  },
  btnLabel: {
    letterSpacing: '0.02em'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(4, 4, 10, 0.8)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000
  },
  modalCard: {
    width: '90%',
    maxWidth: '400px',
    background: 'rgba(15, 14, 28, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    textAlign: 'center',
    boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
  },
  modalHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.8rem',
    marginBottom: '1.8rem'
  },
  modalTitle: {
    fontSize: '1.3rem',
    fontWeight: '700',
    color: '#fff'
  },
  modalSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4'
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column'
  },
  errorText: {
    color: 'var(--accent-red)',
    fontSize: '0.8rem',
    marginBottom: '1rem',
    textAlign: 'left'
  },
  modalActions: {
    display: 'flex',
    gap: '1rem',
    marginTop: '0.5rem'
  }
};

export default App;
