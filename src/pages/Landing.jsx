import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { translations } from "../translations.ts";
import "../styles/landing.css";

function formatIqd(value) {
  return `IQD ${new Intl.NumberFormat("en-US").format(Number(value ?? 0))}`;
}

const LOCALES = ["ku", "ar", "en"];

export default function Landing() {
  const [locale, setLocale] = useState("ku");
  const [filter, setFilter] = useState("all");
  const [openFaq, setOpenFaq] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [email, setEmail] = useState("");
  const [formMessage, setFormMessage] = useState("");

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

  const t = translations[locale];

  const [livePackages, setLivePackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadPackages() {
      const { data, error } = await getSupabase()
        .from("packages")
        .select("id, title, title_ar, title_en, overview, overview_ar, overview_en, price_iqd, days, nights, transport, carrier, acc_stars, hotel, distance_haram, room, meals, includes, image_url, departure_date, return_date, capacity, seats_reserved, companies(name, name_ar, name_en, rating)")
        .eq("lifecycle_status", "published")
        .order("departure_date", { ascending: true });
      if (!active) return;
      if (!error && data) setLivePackages(data);
      setPackagesLoading(false);
    }
    loadPackages();
    return () => {
      active = false;
    };
  }, []);

  const packages = useMemo(
    () =>
      livePackages.map((p) => ({
        ...p,
        localTitle: (locale === "ar" ? p.title_ar : locale === "en" ? p.title_en : null) || p.title,
        localOverview: (locale === "ar" ? p.overview_ar : locale === "en" ? p.overview_en : null) || p.overview,
        agencyName: (locale === "ar" ? p.companies?.name_ar : locale === "en" ? p.companies?.name_en : null) || p.companies?.name || "Tawaf",
        agencyRating: p.companies?.rating ? Number(p.companies.rating).toFixed(1) : null,
        isAir: p.transport === "plane" || p.transport === "air",
        seatsLeft: p.capacity != null ? Math.max(0, p.capacity - (p.seats_reserved ?? 0)) : null,
      })),
    [livePackages, locale]
  );

  const visiblePackages = useMemo(() => {
    return packages.filter((p) => {
      if (filter === "air") return p.isAir;
      if (filter === "coach") return !p.isAir;
      if (filter === "five") return Number(p.acc_stars) === 5;
      return true;
    });
  }, [packages, filter]);

  const faqs = [
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
    { q: t.faq3Q, a: t.faq3A },
    { q: t.faq4Q, a: t.faq4A },
  ];

  const steps = [
    { n: "٠١", title: t.step1Title, copy: t.step1Desc },
    { n: "٠٢", title: t.step2Title, copy: t.step2Desc },
    { n: "٠٣", title: t.step3Title, copy: t.step3Desc },
    { n: "٠٤", title: t.step4Title, copy: t.step4Desc },
  ];

  const filterDefs = [
    ["all", t.allPackagesFilter],
    ["air", t.byAirFilter],
    ["coach", t.byCoachFilter],
    ["five", t.fiveStarFilter],
  ];

  function submitEarlyAccess(e) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setFormMessage(t.openingEmailApp);
    window.location.href = `mailto:hello@tawaf.app?subject=Tawaf%20early%20access&body=${encodeURIComponent(value)}`;
    setTimeout(() => setFormMessage(""), 2500);
  }

  const dir = locale === "en" ? "ltr" : "rtl";
  const arrow = locale === "en" ? "→" : "←";

  return (
    <main className="landing" dir={dir} lang={locale}>
      <div id="hero-pattern" aria-hidden="true" />

      <nav className="top-nav" id="top">
        <a href="#top" className="brand">
          <img src="/brand/tawaf-logo.png" alt="Tawaf" />
          <span>
            <span className="brand-kurdish">تەواف</span>
            <span className="brand-tag">TAWAF · UMRAH MARKETPLACE</span>
          </span>
        </a>
        <div className="nav-links">
          <a href="#packages">{t.packages}</a>
          <a href="#features">{t.marketplace}</a>
          <a href="#steps">{t.howItWorks}</a>
          <a href="#roles">{t.forAgencies}</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
          <Link to="/sign-in" className="btn btn-primary">{t.signIn}</Link>
        </div>
      </nav>

      <section className="hero">
        <div>
          <div className="hero-eyebrow"><span className="rule" />{t.availability}</div>
          <h1>{t.heroTitlePart1}<br /><span style={{ color: "var(--green)" }}>{t.heroTitlePart2}</span></h1>
          <p className="lede">{t.heroLede}</p>
          <div className="hero-cta-row">
            <a href="#packages" className="btn btn-primary">{t.exploreTawaf} {arrow}</a>
            <a href="#steps" className="hero-link">{t.seeHowItWorks}</a>
          </div>
          <div className="hero-stats">
            <div><div className="num">{t.languagesCount}</div><div className="lbl">{t.journeyInYourLanguage}</div></div>
            <div><div className="num">{t.marketplaceCount}</div><div className="lbl">{t.marketplaceTrust}</div></div>
            <div><div className="num">٢٤/٧</div><div className="lbl">{t.tripAccessCount}</div></div>
          </div>
        </div>
        <div className="hero-photo-wrap">
          <div className="hero-photo">
            <div className="img-slot"><span>وێنەی حەرەم / کەعبە</span></div>
          </div>
          <div className="hero-verified">
            <span className="tick">✓</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{t.verifiedUmrahOperators}</div>
              <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 2 }}>{t.verifiedOperator}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="badge-strip">
        <div><span className="ico">✓</span><div><div className="t">{t.trust1Title}</div><div className="s">{t.trust1Desc}</div></div></div>
        <div><span className="ico">◈</span><div><div className="t">{t.trust2Title}</div><div className="s">{t.trust2Desc}</div></div></div>
        <div><span className="ico">◉</span><div><div className="t">{t.trust3Title}</div><div className="s">{t.trust3Desc}</div></div></div>
        <div><span className="ico">ع</span><div><div className="t">{t.trust4Title}</div><div className="s">{t.trust4Desc}</div></div></div>
      </section>

      <section id="packages" className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t.explorerEyebrow}</div>
            <h2>{t.explorerTitle}</h2>
          </div>
          <p>{t.explorerDesc}</p>
        </div>
        <div className="filter-row">
          {filterDefs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip${filter === value ? " is-active" : ""}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
          <span className="filter-count">{visiblePackages.length} {t.packageCount}</span>
        </div>
        <div className="pkg-grid">
          {visiblePackages.map((p) => (
            <article className="card pkg-card" key={p.id}>
              <div className="pkg-photo">
                {p.image_url
                  ? <img src={p.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div className="img-slot"><span>{p.hotel || p.localTitle}</span></div>}
              </div>
              <div className="pkg-body">
                <div className="pkg-top">
                  <span>{p.agencyName} · ✓ {t.verifiedOperator}</span>
                  {p.agencyRating && <span>{p.agencyRating} ★</span>}
                </div>
                <h3 className="pkg-title">{p.localTitle}</h3>
                <div className="pkg-meta">
                  {p.days} {t.days} · {p.isAir ? t.byAir : t.byCoach}
                  {p.hotel ? ` · ${p.hotel}` : ""}
                  {p.distance_haram ? ` · ${p.distance_haram}` : ""}
                  {p.departure_date ? ` · ${p.departure_date}` : ""}
                </div>
                <div className="pkg-foot">
                  <div><div className="per">{t.fromPerson}</div><div className="price">{formatIqd(p.price_iqd)}</div></div>
                  <button
                    type="button"
                    onClick={() => setSelectedPackage(p)}
                    style={{ fontSize: 13, fontWeight: 700, color: "var(--green)", background: "none", border: 0, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {t.viewPackage} {arrow}
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!packagesLoading && !visiblePackages.length && (
            <p style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--muted)", fontSize: 15, padding: "40px 0" }}>
              {locale === "en" ? "No upcoming trips right now — check back soon." : locale === "ar" ? "لا توجد رحلات قادمة حالياً — عد قريباً." : "لە ئێستادا هیچ گەشتێکی داهاتوو نییە — بەم زووانە سەردان بکەرەوە."}
            </p>
          )}
          {packagesLoading && (
            <p style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--muted)", fontSize: 15, padding: "40px 0" }}>
              {locale === "en" ? "Loading trips…" : locale === "ar" ? "جارٍ تحميل الرحلات…" : "گەشتەکان باردەکرێن…"}
            </p>
          )}
        </div>
      </section>

      <section id="features" className="section" style={{ paddingTop: 120 }}>
        <div className="feature-head">
          <div className="eyebrow">{t.featureEyebrow}</div>
          <h2>{t.featureTitle}</h2>
          <p>{t.featureDesc}</p>
        </div>
        <div className="feature-grid">
          <div><div className="n">٠١</div><h3>{t.feature1Title}</h3><p>{t.feature1Desc}</p></div>
          <div><div className="n">٠٢</div><h3>{t.feature2Title}</h3><p>{t.feature2Desc}</p></div>
          <div><div className="n">٠٣</div><h3>{t.feature3Title}</h3><p>{t.feature3Desc}</p></div>
        </div>
      </section>

      <section id="steps" className="steps-section">
        <div>
          <div className="eyebrow">{t.howItWorksEyebrow}</div>
          <h2>{t.howItWorksTitle}</h2>
          <p>{t.howItWorksDesc}</p>
          <a href="#cta" className="btn" style={{ background: "var(--cream)", color: "var(--green-deep)" }}>{t.joinEarlyList} {arrow}</a>
        </div>
        <div>
          {steps.map((s) => (
            <div className="step-row" key={s.n}>
              <span className="step-num">{s.n}</span>
              <div><h3>{s.title}</h3><p>{s.copy}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="roles" className="roles-section">
        <div className="head">
          <div className="eyebrow">{t.platformEyebrow}</div>
          <h2>{t.platformTitle}</h2>
        </div>
        <div className="roles-grid">
          <article className="role-card role-traveller">
            <div className="tag">{t.rolePilgrimLabel}</div>
            <h3>{t.rolePilgrimTitle}</h3>
            <p>{t.rolePilgrimDesc}</p>
            <div className="item">✓ {t.rolePilgrimItem1}</div>
            <div className="item">✓ {t.rolePilgrimItem2}</div>
            <div className="item">✓ {t.rolePilgrimItem3}</div>
          </article>
          <article className="role-card role-company">
            <div className="tag">{t.roleAgencyLabel}</div>
            <h3>{t.roleAgencyTitle}</h3>
            <p>{t.roleAgencyDesc}</p>
            <div className="item">✓ {t.roleAgencyItem1}</div>
            <div className="item">✓ {t.roleAgencyItem2}</div>
            <div className="item">✓ {t.roleAgencyItem3}</div>
            <Link to="/sign-in" className="more" style={{ color: "#f0d28b" }}>{t.openCompanyPortal} {arrow}</Link>
          </article>
          <article className="role-card role-admin">
            <div className="tag">{t.roleAdminLabel}</div>
            <h3>{t.roleAdminTitle}</h3>
            <p>{t.roleAdminDesc}</p>
            <div className="item">✓ {t.roleAdminItem1}</div>
            <div className="item">✓ {t.roleAdminItem2}</div>
            <div className="item">✓ {t.roleAdminItem3}</div>
            <Link to="/sign-in" className="more" style={{ color: "#9a7526" }}>{t.openAdminControl} {arrow}</Link>
          </article>
        </div>
      </section>

      <section className="lang-section">
        <div>
          <div className="eyebrow">{t.langSectionEyebrow}</div>
          <h2>{t.langSectionTitle}</h2>
          <p>{t.langSectionDesc}</p>
          <div className="lang-chips">
            <button type="button" className={`lang-chip${locale === "ku" ? " active" : ""}`} onClick={() => changeLocale("ku")}>کوردی</button>
            <button type="button" className={`lang-chip${locale === "ar" ? " active" : ""}`} onClick={() => changeLocale("ar")}>العربية</button>
            <button type="button" className={`lang-chip${locale === "en" ? " active" : ""}`} dir="ltr" onClick={() => changeLocale("en")}>English</button>
          </div>
        </div>
        <div className="lang-circle-wrap">
          <div className="lang-circle">
            <div className="ring1" />
            <div className="ring2" />
            <span className="en">English</span>
            <span className="ar">عربي</span>
            <span className="ku">کوردی</span>
          </div>
        </div>
      </section>

      <section className="faq-section">
        <div>
          <div className="eyebrow">{t.faqEyebrow}</div>
          <h2>{t.faqTitle}</h2>
          <p>{t.faqDesc}</p>
        </div>
        <div className="faq-list">
          {faqs.map((f, i) => (
            <article className={`faq-item${openFaq === i ? " is-open" : ""}`} key={f.q}>
              <button type="button" className="faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                <span>{f.q}</span>
                <i className="ic">{openFaq === i ? "−" : "+"}</i>
              </button>
              {openFaq === i && <p className="faq-a">{f.a}</p>}
            </article>
          ))}
        </div>
      </section>

      <section id="cta" className="cta-section">
        <div className="cta-ring" aria-hidden="true" />
        <img className="logo" src="/brand/tawaf-logo.png" alt="Tawaf" />
        <div className="eyebrow">{t.finalCtaEyebrow}</div>
        <h2>{t.finalCtaTitle}</h2>
        <p>{t.finalCtaDesc}</p>
        <form className="cta-form" onSubmit={submitEarlyAccess}>
          <input
            type="email"
            required
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit">{t.getEarlyAccess}</button>
        </form>
        <div className="form-message">{formMessage || t.noSpam}</div>
      </section>

      <footer className="site-footer">
        <div className="footer-top">
          <a href="#top" style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <img src="/brand/tawaf-logo.png" alt="" />
            <span>
              <span className="kurdish">تەواف</span>
              <span className="tag">UMRAH MARKETPLACE</span>
            </span>
          </a>
          <p className="tagline">{t.footerDesc}</p>
        </div>
        <div className="footer-bottom">
          <span>{t.footerCopyright}</span>
          <nav className="footer-nav">
            <a href="#packages">{t.packages}</a>
            <a href="#features">{t.marketplace}</a>
            <a href="#roles">{t.forAgencies}</a>
            <a href="mailto:hello@tawaf.app">{t.contact}</a>
          </nav>
        </div>
      </footer>

      {selectedPackage && (
        <div className="pkg-modal-scrim" onClick={() => setSelectedPackage(null)}>
          <article className="pkg-modal" dir={dir} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="pkg-modal-close" aria-label="Close" onClick={() => setSelectedPackage(null)}>
              <X size={18} />
            </button>
            <div className="eyebrow">✓ {t.verifiedPackage}</div>
            <h3>{selectedPackage.localTitle}</h3>
            <p className="pkg-modal-agency">
              {selectedPackage.agencyName}
              {selectedPackage.agencyRating ? ` · ${selectedPackage.agencyRating} ★` : ""}
            </p>
            {selectedPackage.localOverview && <p className="pkg-modal-summary">{selectedPackage.localOverview}</p>}
            <div className="pkg-modal-grid">
              <div><small>{t.duration}</small><b>{t.daysNights.replace("{days}", String(selectedPackage.days ?? "—")).replace("{nights}", String(selectedPackage.nights ?? "—"))}</b></div>
              <div><small>{t.transport}</small><b>{selectedPackage.isAir ? t.byAir : t.byCoach}{selectedPackage.carrier ? ` · ${selectedPackage.carrier}` : ""}</b></div>
              {selectedPackage.hotel && <div><small>{locale === "en" ? "Hotel" : locale === "ar" ? "الفندق" : "هۆتێل"}</small><b>{selectedPackage.hotel}{selectedPackage.distance_haram ? ` · ${selectedPackage.distance_haram}` : ""}</b></div>}
              {selectedPackage.meals && <div><small>{t.meals}</small><b>{selectedPackage.meals}</b></div>}
              {selectedPackage.departure_date && <div><small>{locale === "en" ? "Departure" : locale === "ar" ? "المغادرة" : "بەڕێکەوتن"}</small><b>{selectedPackage.departure_date}</b></div>}
              {selectedPackage.seatsLeft != null && <div><small>{locale === "en" ? "Seats left" : locale === "ar" ? "المقاعد المتبقية" : "شوێنی ماوە"}</small><b>{selectedPackage.seatsLeft}</b></div>}
            </div>
            {Array.isArray(selectedPackage.includes) && selectedPackage.includes.length > 0 && (
              <div className="pkg-modal-inclusions">
                <small>{t.whatsIncluded}</small>
                <div>
                  {selectedPackage.includes.map((item) => (
                    <span key={item}>✓ {item}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="pkg-modal-foot">
              <div><small>{t.fromPerson}</small><b>{formatIqd(selectedPackage.price_iqd)}</b></div>
              <a className="btn btn-primary" href="#cta" onClick={() => setSelectedPackage(null)}>
                {locale === "en" ? "Book in the Tawaf app" : locale === "ar" ? "احجز عبر تطبيق طواف" : "لە ئەپی تەواف حیجز بکە"}
              </a>
            </div>
          </article>
        </div>
      )}
    </main>
  );
}
