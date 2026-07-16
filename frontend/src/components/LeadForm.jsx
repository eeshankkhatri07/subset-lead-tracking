import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { API_BASE } from '../config';

/* ─────────────────────────────────────────
   Constellation canvas — particles + edges
───────────────────────────────────────── */
function Constellation() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx    = canvas.getContext('2d');
    let raf;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const N = 55;
    const MAX_DIST = 140;
    const pts = Array.from({ length: N }, () => ({
      x:  Math.random() * window.innerWidth,
      y:  Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r:  0.6 + Math.random() * 1.0,
      red: Math.random() > 0.68,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // edges
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_DIST) {
            const a = (1 - d / MAX_DIST) * 0.15;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = pts[i].red || pts[j].red
              ? `rgba(225,29,72,${a * 1.6})`
              : `rgba(255,255,255,${a * 0.8})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
      // dots
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.red
          ? 'rgba(225,29,72,0.65)'
          : 'rgba(255,255,255,0.35)';
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas ref={ref} style={{
      position: 'fixed', inset: 0,
      width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 0,
    }} />
  );
}

/* ─────────────────────────────────────────
   Form fields config
───────────────────────────────────────── */
const FIELDS = [
  { name: 'name',    label: 'Full Name',     type: 'text',  ac: 'name' },
  { name: 'phone',   label: 'Mobile Number', type: 'tel',   ac: 'tel' },
  { name: 'email',   label: 'Email Address', type: 'email', ac: 'email' },
  { name: 'company', label: 'Company Name',  type: 'text',  ac: 'organization' },
];

/* ─────────────────────────────────────────
   Main component
───────────────────────────────────────── */
export default function LeadForm({ onNavigate }) {
  const [form,    setForm]    = useState({ name:'', phone:'', email:'', company:'' });
  const [errors,  setErrors]  = useState({});
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [count,   setCount]   = useState(5);
  const [redirect,setRedirect]= useState('');

  const validate = () => {
    const e = {};
    if (!form.name.trim())    e.name    = 'Required';
    if (!form.phone.trim())   e.phone   = 'Required';
    else if (!/^\+?[\d\s\-]{8,15}$/.test(form.phone)) e.phone = 'Enter a valid number';
    if (!form.email.trim())   e.email   = 'Required';
    else if (!/\S+@\S+\.\S+/.test(form.email))         e.email = 'Enter a valid email';
    if (!form.company.trim()) e.company = 'Required';
    setErrors(e); return !Object.keys(e).length;
  };

  const onChange = ({ target: { name, value } }) => {
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/leads`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRedirect(data.redirectUrl || '');
      localStorage.setItem('subset_lead_id',   data.leadId);
      localStorage.setItem('subset_lead_name', form.name);
      setSuccess(true);
    } catch { alert('Something went wrong. Please try again.'); }
    finally  { setLoading(false); }
  };

  const go = () => redirect?.startsWith('http')
    ? (window.location.href = redirect)
    : onNavigate('catalogue');

  useEffect(() => {
    if (!success) return;
    const t = setInterval(() =>
      setCount(p => { if (p <= 1) { clearInterval(t); go(); return 0; } return p - 1; }), 1000);
    return () => clearInterval(t);
  }, [success, redirect]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── page ── */
        .lf-page {
          min-height: 100vh;
          background: #060606;
          display: flex; align-items: center; justify-content: center;
          padding: 2rem 1.25rem;
          font-family: 'Inter', sans-serif;
          position: relative; overflow: hidden;
        }

        /* ambient blobs — colour context */
        .lf-blob {
          position: fixed; border-radius: 50%;
          filter: blur(100px); pointer-events: none;
          will-change: transform;
        }
        .lf-blob-a {
          width: 50vw; height: 50vw;
          max-width: 560px; max-height: 560px;
          background: radial-gradient(circle, rgba(225,29,72,0.18) 0%, transparent 70%);
          top: -12%; left: -8%;
          animation: blobA 20s ease-in-out infinite alternate;
        }
        .lf-blob-b {
          width: 40vw; height: 40vw;
          max-width: 460px; max-height: 460px;
          background: radial-gradient(circle, rgba(159,18,57,0.13) 0%, transparent 70%);
          bottom: -12%; right: -8%;
          animation: blobB 26s ease-in-out infinite alternate;
        }
        @keyframes blobA {
          0%   { transform: translate(0,0)      scale(1);    }
          50%  { transform: translate(5vw,8vh)  scale(1.1);  }
          100% { transform: translate(-3vw,5vh) scale(0.95); }
        }
        @keyframes blobB {
          0%   { transform: translate(0,0)       scale(1);    }
          50%  { transform: translate(-6vw,-7vh) scale(1.08); }
          100% { transform: translate(4vw,-4vh)  scale(0.93); }
        }

        /* grain overlay */
        .lf-grain {
          position: fixed; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E");
          opacity: 0.028;
          pointer-events: none; z-index: 1;
        }

        /* ── card ── */
        .lf-card {
          width: 100%; max-width: 428px;
          background: rgba(12,12,12,0.85);
          border-radius: 22px;
          position: relative; z-index: 2;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.06),
            0 30px 80px rgba(0,0,0,0.7);
          overflow: hidden;
          animation: cardIn 0.6s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(22px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        /* animated red top border */
        .lf-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg,
            transparent 0%, #e11d48 30%, #ff6b9d 55%, #e11d48 70%, transparent 100%);
          background-size: 200% 100%;
          animation: borderSlide 4s linear infinite;
        }
        @keyframes borderSlide {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── logo strip ── */
        .lf-logo-strip {
          background: #fff;
          padding: 1.2rem 2.2rem;
          display: flex; align-items: center; justify-content: center;
        }
        .lf-logo-strip img { height: 46px; width: auto; display: block; }
        .lf-logo-text {
          font-weight: 800; font-size: 1.4rem;
          letter-spacing: -0.03em; color: #111;
        }
        .lf-logo-text em { color: #e11d48; font-style: normal; }

        /* ── body ── */
        .lf-body { padding: 1.8rem 2rem 2.2rem; }

        .lf-chip {
          display: inline-flex; align-items: center; gap: 0.35rem;
          background: rgba(225,29,72,0.07);
          border: 1px solid rgba(225,29,72,0.18);
          border-radius: 100px;
          padding: 0.28rem 0.75rem;
          font-size: 0.67rem; font-weight: 600;
          color: rgba(225,29,72,0.9);
          letter-spacing: 0.04em;
          margin-bottom: 1.4rem;
        }
        .lf-chip-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #e11d48;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(0.7); }
        }

        .lf-title {
          font-size: 1.25rem; font-weight: 700;
          color: #fff; letter-spacing: -0.025em;
          margin-bottom: 0.3rem; line-height: 1.25;
        }
        .lf-sub {
          font-size: 0.78rem; color: rgba(255,255,255,0.28);
          margin-bottom: 1.7rem; line-height: 1.6;
        }

        /* ── inputs ── */
        .lf-field { margin-bottom: 0.95rem; }
        .lf-label {
          display: block;
          font-size: 0.68rem; font-weight: 600;
          letter-spacing: 0.07em; text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          margin-bottom: 0.4rem;
        }
        .lf-input-wrap {
          position: relative;
        }
        .lf-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 11px;
          color: #fff; font-family: 'Inter', sans-serif;
          font-size: 0.9rem; font-weight: 400;
          padding: 0.75rem 1rem;
          outline: none;
          transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
          -webkit-appearance: none;
        }
        .lf-input::placeholder { color: rgba(255,255,255,0.16); }
        .lf-input:focus {
          border-color: rgba(225,29,72,0.55);
          background: rgba(225,29,72,0.04);
          box-shadow: 0 0 0 3px rgba(225,29,72,0.09);
        }
        .lf-input.has-error {
          border-color: rgba(239,68,68,0.45);
        }
        .lf-err {
          font-size: 0.68rem; color: #f87171;
          margin-top: 0.3rem; padding-left: 0.1rem;
        }

        /* ── submit ── */
        .lf-btn {
          width: 100%; margin-top: 1.3rem;
          background: #e11d48;
          border: none; border-radius: 11px;
          color: #fff; font-family: 'Inter', sans-serif;
          font-size: 0.92rem; font-weight: 600;
          padding: 0.88rem 1rem;
          cursor: pointer; display: flex;
          align-items: center; justify-content: center; gap: 0.5rem;
          letter-spacing: 0.01em;
          transition: background 0.18s, transform 0.16s, box-shadow 0.18s;
          box-shadow: 0 4px 22px rgba(225,29,72,0.35);
        }
        .lf-btn:hover:not(:disabled) {
          background: #be123c;
          transform: translateY(-1px);
          box-shadow: 0 8px 30px rgba(225,29,72,0.5);
        }
        .lf-btn:active:not(:disabled) { transform: translateY(0); }
        .lf-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .lf-spin { animation: _sp 0.8s linear infinite; }
        @keyframes _sp { to { transform: rotate(360deg); } }

        .lf-note {
          margin-top: 1.2rem;
          font-size: 0.65rem; color: rgba(255,255,255,0.13);
          text-align: center; line-height: 1.7;
        }

        /* ── success ── */
        .lf-success {
          text-align: center; padding: 2.4rem 2rem 2.6rem;
          animation: cardIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }
        .lf-s-icon {
          width: 66px; height: 66px; border-radius: 50%;
          background: rgba(0,230,118,0.07);
          border: 1px solid rgba(0,230,118,0.2);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1.2rem;
        }
        .lf-s-title {
          font-size: 1.2rem; font-weight: 700; color: #fff;
          letter-spacing: -0.02em; margin-bottom: 0.6rem;
        }
        .lf-s-msg {
          font-size: 0.8rem; color: rgba(255,255,255,0.32);
          line-height: 1.7; margin-bottom: 1.5rem;
        }
        .lf-s-msg strong { color: rgba(255,255,255,0.55); }
        .lf-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 1.3rem 0; }
        .lf-timer { font-size: 0.78rem; color: rgba(255,255,255,0.25); margin-bottom: 1.1rem; }
        .lf-timer strong { color: #e11d48; font-size: 0.95rem; font-weight: 700; }

        /* ── page footer ── */
        .lf-foot {
          position: fixed; bottom: 1rem; left: 0; right: 0;
          text-align: center; font-size: 0.62rem;
          color: rgba(255,255,255,0.08);
          pointer-events: none; z-index: 2;
          font-family: 'Inter', sans-serif;
        }
      `}</style>

      <div className="lf-page">
        {/* Constellation canvas */}
        <Constellation />

        {/* Ambient colour blobs */}
        <div className="lf-blob lf-blob-a" />
        <div className="lf-blob lf-blob-b" />

        {/* Grain overlay */}
        <div className="lf-grain" />

        {/* Card */}
        <div className="lf-card">
          {/* Animated gradient top border rendered via ::before */}

          {/* Logo */}
          <div className="lf-logo-strip">
            <img
              src="/logo-light.png"
              alt="Subset Industries Pvt. Ltd."
              onError={e => {
                e.target.style.display = 'none';
                document.getElementById('__lf_logo_text').style.display = 'block';
              }}
            />
            <span id="__lf_logo_text" style={{ display: 'none' }} className="lf-logo-text">
              SUB<em>SET</em>
            </span>
          </div>

          {!success ? (
            <div className="lf-body">
              {/* Live expo chip */}
              <div className="lf-chip">
                <span className="lf-chip-dot" />
                Paperworld Expo · Stall D44 · Hall 6, Bharat Mandapam · 30 Jul – 1 Aug
              </div>

              <h1 className="lf-title">Register for our catalogue</h1>
              <p className="lf-sub">Takes 10 seconds · We'll email you a copy instantly.</p>

              <form onSubmit={onSubmit} noValidate>
                {FIELDS.map(({ name, label, type, ac }) => (
                  <div className="lf-field" key={name}>
                    <label className="lf-label" htmlFor={name}>{label}</label>
                    <div className="lf-input-wrap">
                      <input
                        id={name} name={name} type={type} autoComplete={ac}
                        value={form[name]} onChange={onChange}
                        onFocus={() => setFocused(name)}
                        onBlur={() => setFocused(null)}
                        className={`lf-input${errors[name] ? ' has-error' : ''}`}
                        placeholder={`Your ${label.toLowerCase()}`}
                      />
                    </div>
                    {errors[name] && <p className="lf-err">⚠ {errors[name]}</p>}
                  </div>
                ))}

                <button type="submit" className="lf-btn" disabled={loading}>
                  {loading
                    ? <><Loader2 size={16} className="lf-spin" /> Registering…</>
                    : <>Access Catalogue <ArrowRight size={16} /></>
                  }
                </button>
              </form>

              <p className="lf-note">
                One-time outreach only · Your data is never shared.
              </p>
            </div>
          ) : (
            <div className="lf-success">
              <div className="lf-s-icon">
                <CheckCircle size={30} color="#00e676" />
              </div>
              <h2 className="lf-s-title">You're in, {form.name.split(' ')[0]}!</h2>
              <p className="lf-s-msg">
                Confirmation sent to <strong>{form.email}</strong>.<br />
                We'll take you to the catalogue right away.
              </p>
              <div className="lf-divider" />
              <p className="lf-timer">Redirecting in <strong>{count}</strong>s</p>
              <button className="lf-btn" onClick={go}>
                View Catalogue <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

        <p className="lf-foot">© 2025 Subset Industries Pvt. Ltd. · All rights reserved.</p>
      </div>
    </>
  );
}
