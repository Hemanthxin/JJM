"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* ---- inline icons (no external deps) ---- */
// JJM emblem: water drop containing a tap, with ripple lines (matches the badge in the design)
const Emblem = ({ s = 40, c = "#1f6fe0", light = false }: { s?: number; c?: string; light?: boolean }) => {
  const stroke = light ? "#ffffff" : c;
  const fill = light ? "#ffffff" : "#2f8fe0";
  const r1 = light ? "#cfe6ff" : "#6db0ee";
  const r2 = light ? "#bcdcff" : "#9cc9f2";
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
      <path d="M24 6C24 6 13 18.5 13 27.5a11 11 0 0 0 22 0C35 18.5 24 6 24 6Z" fill={fill} fillOpacity={light ? 0.14 : 0.16} stroke={stroke} strokeWidth="2" />
      <path d="M18 26.5h6v-2h3.5v6H24v-2h-3a3 3 0 0 0-3 3" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 35.5c2.4 1.4 13.6 1.4 16 0" stroke={r1} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M19 38.5c1.6 1 9.4 1 11 0" stroke={r2} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};
const User = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>);
const Lock = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>);
const Eye = ({ off }: { off?: boolean }) => off
  ? (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s4-7 10-7c2 0 3.7.6 5.2 1.5M22 12s-4 7-10 7c-2 0-3.7-.6-5.2-1.5" /><path d="M3 3l18 18" /></svg>)
  : (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>);
const Arrow = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
const Check = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>);
const Bars = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cfe6ff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>);
const Pin = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cfe6ff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>);
const Shield = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cfe6ff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" /><path d="M9 12l2 2 4-4" /></svg>);
const People = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cfe6ff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><path d="M16 5.2A3 3 0 0 1 16 11M21 20c0-2.5-1.8-4.2-4-4.7" /></svg>);

const FEATURES = [
  { Icon: Bars, t: "Data-Driven Insights", d: "Track progress and outcomes with reliable data." },
  { Icon: Pin, t: "Interactive Analytics", d: "Explore trends across districts, blocks and schemes." },
  { Icon: Shield, t: "Secure & Reliable", d: "Role-based access with enterprise-grade security." },
  { Icon: People, t: "Better Decisions", d: "Empower stakeholders to make informed decisions." },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Login failed"); setLoading(false); return; }
      router.push(params.get("next") || "/dashboard");
      router.refresh();
    } catch (e: any) { setErr(e?.message || "Network error"); setLoading(false); }
  }

  return (
    <div className="login-page">
      <div className="login-inner">
        {/* LEFT — branding */}
        <div className="login-left">
          <div className="brand-row">
            <span className="brand-logo"><Emblem s={30} light /></span>
            <span className="brand-name">JJM</span>
          </div>
          <h2>SCSP/TSP</h2>
          <div className="title-big">Impact Evaluation<br />Dashboard</div>
          <hr className="title-rule" />
          <div className="karnataka">KARNATAKA</div>
          <p className="lead">Evidence-based insights on the impact of SCSP/TSP interventions under the Jal Jeevan Mission.</p>
          <div className="features">
            {FEATURES.map(({ Icon, t, d }) => (
              <div className="feature" key={t}>
                <span className="fi"><Icon /></span>
                <h4>{t}</h4>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — login card */}
        <div className="login-right">
          <form className="login-card" onSubmit={submit}>
            <div className="badge-ring"><div className="card-drop"><Emblem s={42} /></div></div>
            <div className="welcome">Welcome Back!</div>
            <hr className="welcome-rule" />
            <p className="card-sub">Sign in to access the JJM SCSP/TSP<br />Impact Evaluation Dashboard</p>

            <div className="field">
              <span className="lead-ic"><User /></span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" autoFocus />
            </div>
            <div className="field">
              <span className="lead-ic"><Lock /></span>
              <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
              <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label="Toggle password"><Eye off={show} /></button>
            </div>

            <button className="signin-btn" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
              <span className="go"><Arrow /></span>
            </button>

            <div className="login-err">{err}</div>

            <div className="secure-line"><span className="chk"><Check /></span> Secure access. Trusted data. Better outcomes.</div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-page" />}>
      <LoginForm />
    </Suspense>
  );
}
