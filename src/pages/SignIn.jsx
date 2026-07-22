import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { translations } from "../translations.ts";
import "../styles/sign-in.css";

const LOCALES = ["ku", "ar", "en"];

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");
  const [locale, setLocale] = useState("ku");
  // "signin" | "register" | "submitted"
  const [mode, setMode] = useState("signin");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");

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

  // The dashboard bounces unapproved companies back here; explain why rather
  // than dropping them on a blank sign-in form.
  useEffect(() => {
    const blocked = location.state?.blocked;
    if (!blocked) return;
    const copy = translations[locale];
    setMessage(
      blocked === "rejected" ? copy.authRejected
        : blocked === "suspended" ? copy.authSuspended
        : copy.authPendingApproval,
    );
  }, [location.state, locale]);

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

    // Agencies stay locked out until an admin approves them. `needs_changes` is
    // deliberately allowed through: that state exists so the company can come in,
    // fix what the admin flagged and resubmit. Companies without an owned row
    // (staff on someone else's company) are not gated here.
    if (profile.role === "agency") {
      const { data: company } = await supabase
        .from("companies")
        .select("verification_status")
        .eq("owner_id", data.user.id)
        .maybeSingle();

      const blocked = {
        pending: t.authPendingApproval,
        rejected: t.authRejected,
        suspended: t.authSuspended,
      };
      const blockedMessage = company ? blocked[company.verification_status] : undefined;

      if (blockedMessage) {
        await supabase.auth.signOut();
        setMessage(blockedMessage);
        setLoading(false);
        return;
      }
    }

    navigate("/dashboard", { replace: true });
  }

  async function register(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // handle_new_user() reads this metadata to create the profile with role
      // 'agency' instead of the default 'client'.
      options: { data: { role: "agency", full_name: contactName.trim(), phone: phone.trim() } },
    });

    if (error || !data.user) {
      setMessage(error?.message ?? t.authRegisterFailed);
      setLoading(false);
      return;
    }

    // The company row must be written while the signUp session is still active,
    // since RLS requires owner_id = auth.uid(). If the project ever turns email
    // confirmation on, signUp returns no session and we cannot insert here.
    if (!data.session) {
      setMode("submitted");
      setLoading(false);
      return;
    }

    const { error: companyError } = await supabase.from("companies").insert({
      owner_id: data.user.id,
      name: companyName.trim(),
      phone: phone.trim() || null,
      // Explicit: the column defaults to 'draft', which the admin queue does not
      // show. It must be 'pending' to reach the review list.
      verification_status: "pending",
      status: "pending",
      submitted_at: new Date().toISOString(),
    });

    await supabase.auth.signOut();

    if (companyError) {
      setMessage(companyError.message ?? t.authRegisterFailed);
      setLoading(false);
      return;
    }

    setMode("submitted");
    setPassword("");
    setLoading(false);
  }

  function switchMode(next) {
    setMode(next);
    setMessage("");
    setPassword("");
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
        {mode === "submitted" ? (
          <div className="signin-form-wrap">
            <span className="signin-icon"><CheckCircle2 size={20} /></span>
            <div className="eyebrow">{t.authSecureWorkspace}</div>
            <h2>{t.authRegisterDone}</h2>
            <p>{t.authRegisterDoneBody}</p>
            <button type="button" className="signin-submit" onClick={() => switchMode("signin")}>
              <BackArrow size={17} /> {t.authBackToSignIn}
            </button>
          </div>
        ) : (
        <div className="signin-form-wrap">
          <span className="signin-icon">{mode === "register" ? <Building2 size={20} /> : <LockKeyhole size={20} />}</span>
          <div className="eyebrow">{t.authSecureWorkspace}</div>
          <h2>{mode === "register" ? t.authRegisterTitle : t.authWelcomeBack}</h2>
          <p>{mode === "register" ? t.authRegisterSubtitle : t.authSignInSubtitle}</p>
          <form onSubmit={mode === "register" ? register : signIn} style={{ display: "grid", gap: 18 }}>
            {mode === "register" && (
              <>
                <div>
                  <label htmlFor="portal-company" className="field-label">{t.authCompanyNameLabel}</label>
                  <input
                    id="portal-company" type="text" required
                    value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={t.authCompanyNamePh} className="field-input"
                    disabled={checking || loading}
                  />
                </div>
                <div>
                  <label htmlFor="portal-contact" className="field-label">{t.authContactNameLabel}</label>
                  <input
                    id="portal-contact" type="text" required autoComplete="name"
                    value={contactName} onChange={(e) => setContactName(e.target.value)}
                    placeholder={t.authContactNamePh} className="field-input"
                    disabled={checking || loading}
                  />
                </div>
                <div>
                  <label htmlFor="portal-phone" className="field-label">{t.authPhoneLabel}</label>
                  <input
                    id="portal-phone" type="tel" required autoComplete="tel"
                    value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder={t.authPhonePh} dir="ltr" className="field-input"
                    style={{ textAlign: "left" }} disabled={checking || loading}
                  />
                </div>
              </>
            )}
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
              <label htmlFor="portal-password" className="field-label">{mode === "register" ? t.authCreatePasswordLabel : t.authPasswordLabel}</label>
              <div className="pw-field">
                <input
                  id="portal-password" type={showPassword ? "text" : "password"} required minLength={6}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
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
                <><LoaderCircle className="spin" size={18} /> {mode === "register" ? t.authRegisterLoading : t.authSecuringWorkspace}</>
              ) : (
                <>{mode === "register" ? t.authRegisterButton : t.authSignInButton} <SubmitArrow size={17} /></>
              )}
            </button>
          </form>
          <p className="signin-help">
            {mode === "register" ? t.authHaveAccount : t.authNeedAccess}
            <button
              type="button"
              onClick={() => switchMode(mode === "register" ? "signin" : "register")}
              style={{ border: 0, padding: 0, background: "transparent", color: "var(--green)", fontWeight: 700, font: "inherit", cursor: "pointer" }}
            >
              {mode === "register" ? t.authSignInLink : t.authRegisterLink}
            </button>
          </p>
        </div>
        )}
        <p className="signin-legal">{t.authLegal}</p>
      </section>
    </main>
  );
}
