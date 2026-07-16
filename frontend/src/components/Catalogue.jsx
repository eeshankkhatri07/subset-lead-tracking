import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, ChevronRight, Package, User } from 'lucide-react';
import { API_BASE } from '../config';

const PEN_PRODUCTS = [
  {
    id: 'zenith-fountain',
    name: 'The Zenith Gold Fountain',
    category: 'Heritage Fountain Series',
    tagline: 'Hand-ground 18K Gold Nib & Cured Celluloid Body',
    description: 'Designed for the connoisseur, the Zenith combines century-old manufacturing traditions with modern balance dynamics. Crafted for timeless signatures.',
    price: '$249.00',
    color: '#FFD700',
    gradient: 'linear-gradient(135deg, #e5c060 0%, #9e782f 100%)',
    specs: {
      nib: '18K Monotone Gold (Fine/Medium)',
      system: 'Piston & Converter Dual System',
      material: 'Polished Italian Resin & Brass Cores',
      weight: '32 grams (Cap posted)'
    }
  },
  {
    id: 'aerotech-rollerball',
    name: 'The Aerotech Titanium',
    category: 'Precision Engineered Series',
    tagline: 'Aerospace-grade Titanium Body & Tungsten Ball',
    description: 'CNC milled from single billets of grade-5 titanium, the Aerotech is built for lifetime durability. Features our proprietary smooth-glide rollerball feed.',
    price: '$180.00',
    color: '#00f2fe',
    gradient: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
    specs: {
      nib: '0.7mm Ceramic Tungsten Ball',
      system: 'Refillable Pilot G2 Standard',
      material: 'Sandblasted Grade-5 Titanium',
      weight: '41 grams (Heavy weighted)'
    }
  },
  {
    id: 'synergy-ballpoint',
    name: 'The Synergy Carbon',
    category: 'Contemporary Active Series',
    tagline: 'Woven Carbon Fiber Casing & Oil-Gel Hybrid Ink',
    description: 'Perfectly balanced daily writer combining ultra-light aerospace carbon fiber with knurled grip textures. Zero drag, zero skipping.',
    price: '$95.00',
    color: '#e11d48',
    gradient: 'linear-gradient(135deg, #e11d48 0%, #9f1239 100%)',
    specs: {
      nib: '1.0mm Stainless Steel Needle',
      system: 'Subset Pressurized Hybrid Refill',
      material: '3K Twill Carbon Fiber & Matte Chrome',
      weight: '21 grams (Ultra light)'
    }
  }
];

export default function Catalogue({ onNavigate }) {
  const [leadId, setLeadId] = useState(null);
  const [leadName, setLeadName] = useState('');
  const [requestedSamples, setRequestedSamples] = useState({});
  const [submittingSample, setSubmittingSample] = useState(null);
  const [activePenIndex, setActivePenIndex] = useState(0);

  useEffect(() => {
    const storedId = localStorage.getItem('subset_lead_id');
    const storedName = localStorage.getItem('subset_lead_name');
    if (storedId) {
      setLeadId(storedId);
      setLeadName(storedName || 'Guest');
      
      fetch(`${API_BASE}/api/leads/${storedId}/interaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'view_catalogue', details: 'Opened main catalogue page' })
      }).catch(err => console.error('Failed to log catalogue view interaction', err));
    }
  }, []);

  const handleRequestSample = async (pen) => {
    if (!leadId) {
      alert('Please register first at the booth to request physical pen samples!');
      onNavigate('form');
      return;
    }

    setSubmittingSample(pen.id);
    try {
      const response = await fetch(`${API_BASE}/api/leads/${leadId}/interaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'request_sample',
          details: `Requested physical pen sample: ${pen.name}`
        })
      });

      if (response.ok) {
        setRequestedSamples(prev => ({ ...prev, [pen.id]: true }));
      } else {
        alert('Failed to submit sample request. Please try again.');
      }
    } catch (error) {
      console.error(error);
      alert('Network error requesting sample.');
    } finally {
      setSubmittingSample(null);
    }
  };

  const currentPen = PEN_PRODUCTS[activePenIndex];

  return (
    <div style={styles.container}>
      {/* Top Banner / Navbar */}
      <div style={styles.navbar}>
        <div style={styles.logoGroup} onClick={() => onNavigate('form')}>
          <img src="/logo-dark.png" alt="Subset" style={styles.brandNavbarLogo} />
        </div>
        
        {leadId ? (
          <div style={styles.badge}>
            <User size={14} style={{ marginRight: '0.4rem' }} />
            <span>Welcome, <strong>{leadName}</strong></span>
          </div>
        ) : (
          <button className="btn btn-secondary" onClick={() => onNavigate('form')} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            Register at Booth
          </button>
        )}
      </div>

      <div style={styles.mainContent}>
        {/* Left Side: Product Selector */}
        <div style={styles.sidebar}>
          <h2 style={styles.sidebarTitle}>Collection 2026</h2>
          <p style={styles.sidebarSubtitle}>Select a model to view technical specs & request booth test-writes.</p>
          
          <div style={styles.menu}>
            {PEN_PRODUCTS.map((pen, index) => (
              <div 
                key={pen.id} 
                onClick={() => {
                  setActivePenIndex(index);
                  if (leadId) {
                    fetch(`${API_BASE}/api/leads/${leadId}/interaction`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'view_item', details: `Inspected ${pen.name}` })
                    }).catch(e => console.error(e));
                  }
                }}
                style={{
                  ...styles.menuItem,
                  borderColor: index === activePenIndex ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                  background: index === activePenIndex ? 'rgba(255, 255, 255, 0.04)' : 'transparent'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={styles.menuItemCat}>{pen.category}</span>
                  <span style={{
                    ...styles.menuItemName,
                    color: index === activePenIndex ? '#fff' : 'var(--text-muted)'
                  }}>{pen.name}</span>
                </div>
                <ChevronRight size={16} color={index === activePenIndex ? 'var(--accent-primary)' : 'var(--text-dark)'} />
              </div>
            ))}
          </div>

          {!leadId && (
            <div className="glass-card" style={styles.registerInvite}>
              <Sparkles size={20} color="var(--accent-primary)" style={{ marginBottom: '0.5rem' }} />
              <h4>Request a Sample Pen</h4>
              <p>Register your details at our booth to try out these pens in person and request a free sample.</p>
              <button 
                onClick={() => onNavigate('form')} 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '0.6rem 1rem', fontSize: '0.85rem', marginTop: '0.8rem' }}
              >
                Register Now
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Immersive Spec Sheet & Actions */}
        <div className="glass-card" style={styles.detailPanel}>
          <div style={styles.detailHeader}>
            <span style={{ ...styles.categoryBadge, borderImage: `var(--accent-gradient) 1` }}>
              {currentPen.category}
            </span>
            <span style={styles.priceTag}>{currentPen.price}</span>
          </div>

          <h1 style={styles.penName}>{currentPen.name}</h1>
          <p style={styles.penTagline}>{currentPen.tagline}</p>
          
          {/* Simulated 3D Preview Frame / Drawing */}
          <div style={styles.penPreviewContainer}>
            <div style={{ ...styles.glowAura, background: `radial-gradient(circle, ${currentPen.color}15 0%, transparent 70%)` }} />
            
            {/* Elegant Mock Pen SVG Render */}
            <svg viewBox="0 0 400 60" style={styles.penSvg}>
              {currentPen.id === 'zenith-fountain' && (
                <path d="M 50 30 L 70 20 L 90 20 L 90 40 L 70 40 Z" fill={currentPen.color} stroke="#333" strokeWidth="1" />
              )}
              {currentPen.id !== 'zenith-fountain' && (
                <path d="M 60 30 L 80 25 L 90 25 L 90 35 L 80 35 Z" fill="#999" stroke="#333" strokeWidth="1" />
              )}
              
              <rect x="90" y="20" width="40" height="20" fill="#222" rx="2" stroke="#333" />
              {currentPen.id === 'synergy-ballpoint' && (
                <line x1="90" y1="20" x2="130" y2="40" stroke="#444" strokeWidth="1" strokeDasharray="2,2" />
              )}

              <rect x="130" y="18" width="160" height="24" fill={currentPen.id === 'synergy-ballpoint' ? '#111' : '#1a1a2e'} rx="4" stroke="#444" />
              
              <rect x="130" y="18" width="5" height="24" fill={currentPen.color} />
              <rect x="285" y="18" width="5" height="24" fill={currentPen.color} />

              <rect x="290" y="17" width="60" height="26" fill="#111" rx="4" stroke="#555" />
              <rect x="300" y="12" width="40" height="5" fill={currentPen.color} rx="1" />
            </svg>
            
            <span style={styles.previewCaption}>*Subset Industries CNC Handcrafted Precision Core</span>
          </div>

          <p style={styles.penDescription}>{currentPen.description}</p>

          <div style={styles.divider} />

          <h3 style={styles.sectionTitle}>Technical Specifications</h3>
          <div style={styles.specsGrid}>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Nib & Point</span>
              <span style={styles.specValue}>{currentPen.specs.nib}</span>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Ink Feed System</span>
              <span style={styles.specValue}>{currentPen.specs.system}</span>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Body Materials</span>
              <span style={styles.specValue}>{currentPen.specs.material}</span>
            </div>
            <div style={styles.specItem}>
              <span style={styles.specLabel}>Total Balance Weight</span>
              <span style={styles.specValue}>{currentPen.specs.weight}</span>
            </div>
          </div>

          <div style={styles.actions}>
            {requestedSamples[currentPen.id] ? (
              <div style={styles.sampleConfirmed}>
                <CheckCircle2 size={22} color="#00e676" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={styles.confirmedTitle}>Sample Request Received!</span>
                  <span style={styles.confirmedText}>Our booth representative will present your test pen shortly.</span>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => handleRequestSample(currentPen)}
                disabled={submittingSample === currentPen.id}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  background: currentPen.gradient,
                  boxShadow: `0 4px 15px ${currentPen.color}30`
                }}
              >
                <Package size={20} />
                {submittingSample === currentPen.id ? 'Processing...' : 'Request Booth Sample / Test Write'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem 3rem',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    zIndex: 1,
    maxWidth: '1200px',
    margin: '0 auto'
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: '1.2rem'
  },
  logoGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    cursor: 'pointer'
  },
  brandNavbarLogo: {
    height: '38px',
    width: 'auto',
    mixBlendMode: 'screen',
    display: 'block'
  },
  badge: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '30px',
    padding: '0.5rem 1.2rem',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    color: 'var(--text-main)'
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '350px 1fr',
    gap: '2.5rem',
    alignItems: 'start',
    flex: 1
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem'
  },
  sidebarTitle: {
    fontSize: '1.6rem',
    fontWeight: '700',
    color: '#fff'
  },
  sidebarSubtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    lineHeight: '1.5',
    marginBottom: '0.5rem'
  },
  menu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem'
  },
  menuItem: {
    border: '1px solid',
    borderRadius: '14px',
    padding: '1rem 1.2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out'
  },
  menuItemCat: {
    fontSize: '0.7rem',
    color: 'var(--text-dark)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: '600'
  },
  menuItemName: {
    fontSize: '0.95rem',
    fontWeight: '600',
    marginTop: '0.2rem'
  },
  registerInvite: {
    padding: '1.5rem',
    background: 'rgba(225, 29, 72, 0.03)',
    border: '1px solid rgba(225, 29, 72, 0.1)'
  },
  detailPanel: {
    background: 'rgba(10, 10, 10, 0.55)',
    border: '1px solid rgba(255, 255, 255, 0.05)'
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem'
  },
  categoryBadge: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    fontWeight: '700',
    color: 'var(--text-muted)',
    padding: '0.3rem 0.6rem',
    border: '1px solid transparent',
    letterSpacing: '0.05em'
  },
  priceTag: {
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    fontSize: '1.2rem',
    color: 'var(--text-main)'
  },
  penName: {
    fontSize: '2.2rem',
    fontWeight: '800',
    marginBottom: '0.5rem',
    color: '#fff',
    letterSpacing: '-0.02em'
  },
  penTagline: {
    fontSize: '1.05rem',
    color: 'var(--accent-primary)',
    marginBottom: '2rem',
    fontWeight: '500'
  },
  penPreviewContainer: {
    width: '100%',
    height: '140px',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: '2rem',
    overflow: 'hidden'
  },
  glowAura: {
    position: 'absolute',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    pointerEvents: 'none'
  },
  penSvg: {
    width: '80%',
    height: 'auto',
    zIndex: 1
  },
  previewCaption: {
    fontSize: '0.65rem',
    color: 'var(--text-dark)',
    textTransform: 'uppercase',
    marginTop: '0.5rem',
    letterSpacing: '0.05em',
    zIndex: 1
  },
  penDescription: {
    color: 'var(--text-muted)',
    lineHeight: '1.6',
    fontSize: '0.95rem',
    marginBottom: '1.8rem'
  },
  divider: {
    height: '1px',
    background: 'var(--glass-border)',
    margin: '1.8rem 0'
  },
  sectionTitle: {
    fontSize: '0.95rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    marginBottom: '1.2rem',
    fontWeight: '600'
  },
  specsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1.2rem',
    marginBottom: '2rem'
  },
  specItem: {
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(0,0,0,0.15)',
    padding: '0.8rem 1rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.02)'
  },
  specLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-dark)',
    marginBottom: '0.2rem',
    textTransform: 'uppercase',
    fontWeight: '600'
  },
  specValue: {
    fontSize: '0.9rem',
    color: '#fff',
    fontWeight: '500'
  },
  actions: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1rem'
  },
  sampleConfirmed: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    background: 'rgba(0, 230, 118, 0.08)',
    border: '1px solid rgba(0, 230, 118, 0.15)',
    padding: '1.2rem 1.5rem',
    borderRadius: '12px',
    width: '100%'
  },
  confirmedTitle: {
    color: '#00e676',
    fontWeight: '700',
    fontSize: '0.95rem'
  },
  confirmedText: {
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    marginTop: '0.1rem'
  }
};
