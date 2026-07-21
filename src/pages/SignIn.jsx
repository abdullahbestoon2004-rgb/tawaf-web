import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import TawafLoadingSpinner from "@/components/TawafLoadingSpinner";
import { translations } from "../translations.ts";
import "../styles/sign-in.css";

const LOCALES = ["ku", "ar", "en"];

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");
  const [locale, setLocale] = useState("ku");

  useEffect(() => {
    const saved = localStorage.getItem("tawaf-locale");
    if (saved && LOCALES.includes(saved)) setLocale(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dir = locale === "en" ? "ltr" : "rtl";
    document.documentElement.lang = locale;
  }, [locale]);

  const changeLocale = (newLocale) => {
    setLocale(newLocale);
    localStorage.setItem("tawaf-locale", newLocale);
  };

  useEffect(() => {
    let active = true;
    async function checkSession() {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user) {
        navigate("/dashboard", { replace: true });
        return;
      }
      setChecking(false);
    }
    checkSession();
    return () => {
      active = false;
    };
  }, [navigate]);

  async function signIn(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      setMessage(error?.message ?? (locale === "en" ? "We could not sign you in." : locale === "ar" ? "تعذر تسجيل دخولك." : "نەمانتوانی بچینە ژوورەوە."));
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setMessage(locale === "en" ? "Your Tawaf profile could not be loaded. Please contact support." : locale === "ar" ? "تعذر تحميل ملف تعريف طواف الخاص بك. يرجى الاتصال بالدعم." : "پرۆفایلی تەوافت بارنەکرا. تکایە پەیوەندی بە پشتگیرییەوە بکە.");
      setLoading(false);
      return;
    }

    if (!["admin", "agency"].includes(profile.role)) {
      await supabase.auth.signOut();
      setMessage(
        locale === "en"
          ? "This workspace is for Tawaf companies and administrators. Pilgrim accounts continue in the mobile app."
          : locale === "ar"
          ? "مساحة العمل هذه مخصصة لشركات طواف والمشرفين. تستمر حسابات المعتمرين في تطبيق الهاتف المحمول."
          : "ئەم شوێنی کارە بۆ کۆمپانیاکان و بەڕێوەبەرانی تەوافە. ئەکاونتەکانی زیارەتکاران لە ئەپی مۆبایلدا بەردەوام دەبن."
      );
      setLoading(false);
      return;
    }

    navigate("/dashboard", { replace: true });
  }

  const t = translations[locale];
  const BackArrow = locale === "en" ? ArrowLeft : ArrowRight;
  const SubmitArrow = locale === "en" ? ArrowRight : ArrowLeft;

  return (
    <main className="signin-main" dir={locale === "en" ? "ltr" : "rtl"} lang={locale}>
      <section className="signin-side">
        <div className="signin-side-pattern" aria-hidden="true" />
        <Link to="/" className="signin-brand">
          <img src="/brand/tawaf-logo.png" alt="Tawaf" />
          <span>
            <span className="kurdish">تەواف</span>
            <span className="tag">{t.authTitle.substring(t.authTitle.indexOf("—") + 2)}</span>
          </span>
        </Link>
        <div className="signin-pitch">
          <div className="eyebrow">{t.authKicker}</div>
          <h1>{t.authHeader}</h1>
          <p>{t.authDesc}</p>
          <div className="signin-cards">
            <article>
              <span className="ic"><Building2 size={19} /></span>
              <div><div className="t">{t.authCompanyWorkspace}</div><div className="s">{t.authCompanyWorkspaceDesc}</div></div>
            </article>
            <article>
              <span className="ic"><ShieldCheck size={19} /></span>
              <div><div className="t">{t.authAdminControl}</div><div className="s">{t.authAdminControlDesc}</div></div>
            </article>
          </div>
        </div>
        <div className="signin-foot">
          <CheckCircle2 size={16} style={{ flex: "none", color: "#e4c278" }} />
          {t.authDatabaseProtected}
        </div>
      </section>

      <section className="signin-form-side">
        <div className="signin-form-top">
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <BackArrow size={16} /> {t.authBackToTawaf}
          </Link>
          <div className="locale-switch">
            {LOCALES.map((code) => (
              <button
                key={code}
                type="button"
                className={locale === code ? "is-active" : ""}
                onClick={() => changeLocale(code)}
              >
                {code === "ku" ? "کوردی" : code === "ar" ? "عربي" : "EN"}
              </button>
            ))}
          </div>
        </div>
        <div className="signin-form-wrap">
          <span className="signin-icon"><LockKeyhole size={20} /></span>
          <div className="eyebrow">{t.authSecureWorkspace}</div>
          <h2>{t.authWelcomeBack}</h2>
          <p>{t.authSignInSubtitle}</p>
          <form onSubmit={signIn} style={{ display: "grid", gap: 18 }}>
            <div>
              <label htmlFor="portal-email" className="field-label">{t.authEmailLabel}</label>
              <input
                id="portal-email" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" dir="ltr" className="field-input"
                style={{ textAlign: "left" }} disabled={checking || loading}
              />
            </div>
            <div>
              <label htmlFor="portal-password" className="field-label">{t.authPasswordLabel}</label>
              <div className="pw-field">
                <input
                  id="portal-password" type={showPassword ? "text" : "password"} required minLength={6}
                  autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.authPasswordPlaceholder} className="field-input"
                  style={locale === "en" ? { paddingRight: 48 } : { paddingLeft: 48 }}
                  disabled={checking || loading}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  style={locale === "en" ? { right: 8, left: "auto" } : undefined}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            {message && <p className="signin-message" role="alert">{message}</p>}
            <button type="submit" className="signin-submit" disabled={checking || loading}>
              {checking || loading ? (
                <><TawafLoadingSpinner size={18} /> {t.authSecuringWorkspace}</>
              ) : (
                <>{t.authSignInButton} <SubmitArrow size={17} /></>
              )}
            </button>
          </form>
          <p className="signin-help">
            {t.authNeedAccess}
            <a href="mailto:hello@tawaf.app?subject=Tawaf%20company%20portal%20access" style={{ color: "var(--green)", fontWeight: 700 }}>
              {t.authRequestAccess}
            </a>
          </p>
        </div>
        <p className="signin-legal">{t.authLegal}</p>
      </section>
    </main>
  );
}
