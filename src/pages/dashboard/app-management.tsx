/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * App management — the administrator's control over what the Tawaf app's home
 * screen shows and in which order.
 *
 * Everything here writes to tables the Flutter app already reads:
 *   home_sections        → the order, visibility and item cap of each block
 *   home_ads             → the sponsors carousel at the top of the home screen
 *   companies.is_promoted→ which agencies lead the "Top agencies" row
 *   packages.is_featured → which trips lead the curated trips list
 *
 * Nothing here is app-only styling: a change saved on this page is what the
 * next client to open the app (or pull to refresh) will see.
 */

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  LayoutTemplate,
  Link2,
  Plane,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import TawafLoadingSpinner from "@/components/TawafLoadingSpinner";
import "../../styles/app-management.css";

type Locale = "ku" | "ar" | "en";
type RunAction = (id: string, action: () => any, success: string) => Promise<any>;

export type HomeAd = {
  id: string;
  company_id: string | null;
  package_id: string | null;
  title: string;
  title_ar: string | null;
  title_en: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type HomeSectionRow = {
  key: string;
  sort_order: number;
  is_visible: boolean;
  max_items: number | null;
};

/** One hand-placed position for a promoted agency or a featured trip. */
export type HomeRankRow = {
  id: string;
  company_id: string | null;
  package_id: string | null;
  sort_order: number;
};

// Anything the administrator has not placed sorts after everything they have.
const UNPLACED = Number.MAX_SAFE_INTEGER;

type CompanyLike = {
  id: string;
  name: string;
  location: string | null;
  logo_url: string | null;
  rating: number | null;
  reviews: number | null;
  pilgrims_served?: number | null;
  is_promoted: boolean;
  is_verified: boolean;
  status: string;
  verification_status: string;
  created_at: string;
};

type TripLike = {
  id: string;
  company_id: string;
  title: string;
  image_url: string | null;
  price_iqd: number;
  departure_date: string | null;
  capacity: number | null;
  seats_reserved: number | null;
  lifecycle_status: string;
  is_featured: boolean;
  created_at: string;
};

type Props = {
  homeAds: HomeAd[];
  homeSections: HomeSectionRow[];
  homeRank: HomeRankRow[];
  companies: CompanyLike[];
  trips: TripLike[];
  busy: string;
  runAction: RunAction;
  locale: Locale;
};

// Mirrors HomeSection in the Flutter app (lib/models/home_section_model.dart)
// and the seed in supabase/home-layout.sql. A key missing from any of the three
// is simply not rendered — adding a section means adding it in all three.
const HOME_SECTIONS: Array<{
  key: string;
  ku: string;
  ar: string;
  en: string;
  noteKu: string;
  noteAr: string;
  noteEn: string;
  capped: boolean;
}> = [
  {
    key: "prayer_times",
    ku: "کاتەکانی نوێژ", ar: "أوقات الصلاة", en: "Prayer times",
    noteKu: "کاتی نوێژی شاری بەکارهێنەر.",
    noteAr: "أوقات الصلاة حسب مدينة المستخدم.",
    noteEn: "Prayer times for the client's city.",
    capped: false,
  },
  {
    key: "active_booking",
    ku: "حیجزی چالاک", ar: "الحجز النشط", en: "Active booking",
    noteKu: "تەنها بۆ ئەو بەکارهێنەرانەی حیجزێکی چالاکیان هەیە.",
    noteAr: "يظهر فقط لمن لديه حجز نشط.",
    noteEn: "Only shown to clients with a live booking.",
    capped: false,
  },
  {
    key: "carousel",
    ku: "سلایدەری ڕیکلام", ar: "شريط الإعلانات", en: "Sponsors carousel",
    noteKu: "ئەگەر هیچ ڕیکلامێک چالاک نەبێت، باشترین گەشت شوێنەکەی دەگرێتەوە.",
    noteAr: "بدون إعلانات نشطة تظهر أفضل رحلة مكانها.",
    noteEn: "With no active slides the strongest trip takes the slot.",
    capped: true,
  },
  {
    key: "categories",
    ku: "بەشە خێراکان", ar: "الفئات السريعة", en: "Quick categories",
    noteKu: "دوگمە خێراکانی گەڕان.",
    noteAr: "أزرار البحث السريع.",
    noteEn: "Quick search shortcuts.",
    capped: false,
  },
  {
    key: "agencies",
    ku: "باشترین کۆمپانیاکان", ar: "أفضل الشركات", en: "Top agencies",
    noteKu: "ڕیزبەندی: پرۆمۆتکراوەکان، پاشان هەڵسەنگاندن.",
    noteAr: "الترتيب: المروَّجة أولاً ثم التقييم.",
    noteEn: "Ordered by promotion, then reputation.",
    capped: true,
  },
  {
    key: "trips",
    ku: "گەشتە هەڵبژێردراوەکان", ar: "الرحلات المختارة", en: "Curated trips",
    noteKu: "ڕیزبەندی: تایبەتکراوەکان، پاشان هەڵسەنگاندن.",
    noteAr: "الترتيب: المميزة أولاً ثم التقييم.",
    noteEn: "Ordered by featured, then reputation.",
    capped: true,
  },
];

const SECTION_META = new Map(HOME_SECTIONS.map((item) => [item.key, item]));

const formatIqd = (value: number) =>
  `${new Intl.NumberFormat("en-US").format(Math.round(value))} IQD`;

/** An agency the app is willing to show a client at all. */
function isCompanyEligible(company: CompanyLike) {
  return (
    company.is_verified &&
    company.status === "active" &&
    company.verification_status === "approved"
  );
}

/**
 * A trip the app is willing to show. Mirrors _isOfferBookable in the Flutter
 * provider: published, priced, titled, seats left, and not already departed.
 */
function isTripBookable(trip: TripLike, today: string) {
  if (trip.lifecycle_status !== "published") return false;
  if (!trip.price_iqd || trip.price_iqd <= 0) return false;
  if (!trip.title.trim()) return false;
  if (trip.capacity != null && trip.capacity - (trip.seats_reserved ?? 0) <= 0) return false;
  if (!trip.departure_date) return false;
  return trip.departure_date >= today;
}

export default function AppManagementWorkspace({
  homeAds,
  homeSections,
  homeRank,
  companies,
  trips,
  busy,
  runAction,
  locale,
}: Props) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const [tab, setTab] = useState<"layout" | "carousel" | "agencies" | "trips">("layout");

  const today = new Date().toISOString().slice(0, 10);
  const companyById = useMemo(
    () => new Map(companies.map((item) => [item.id, item])),
    [companies],
  );

  // Where the administrator has placed each promoted agency / featured trip.
  const companyRank = useMemo(
    () => new Map(homeRank.filter((row) => row.company_id).map((row) => [row.company_id!, row.sort_order])),
    [homeRank],
  );
  const tripRank = useMemo(
    () => new Map(homeRank.filter((row) => row.package_id).map((row) => [row.package_id!, row.sort_order])),
    [homeRank],
  );

  // The same eligibility + ranking the app applies, so this page previews the
  // real result rather than a guess. The one thing it cannot mirror is the
  // client's own city, which lifts nearby agencies a rung — called out in the
  // copy rather than faked here.
  const rankedTrips = useMemo(() => {
    const eligible = trips.filter((trip) => {
      const company = companyById.get(trip.company_id);
      return company != null && isCompanyEligible(company) && isTripBookable(trip, today);
    });
    return eligible.sort((a, b) => {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      if (a.is_featured && b.is_featured) {
        const pinned = (tripRank.get(a.id) ?? UNPLACED) - (tripRank.get(b.id) ?? UNPLACED);
        if (pinned !== 0) return pinned;
      }
      const aDate = a.departure_date ?? "9999-12-31";
      const bDate = b.departure_date ?? "9999-12-31";
      if (aDate !== bDate) return aDate < bDate ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
  }, [trips, companyById, today, tripRank]);

  const rankedCompanies = useMemo(() => {
    const withTrips = new Set(rankedTrips.map((trip) => trip.company_id));
    return companies.filter(isCompanyEligible).sort((a, b) => {
      // A promotion outranks every heuristic below it, including "has a live
      // trip" — this mirrors _compareCompanies in the app's provider.
      if (a.is_promoted !== b.is_promoted) return a.is_promoted ? -1 : 1;
      if (a.is_promoted && b.is_promoted) {
        const pinned = (companyRank.get(a.id) ?? UNPLACED) - (companyRank.get(b.id) ?? UNPLACED);
        if (pinned !== 0) return pinned;
      }
      const aLive = withTrips.has(a.id);
      const bLive = withTrips.has(b.id);
      if (aLive !== bLive) return aLive ? -1 : 1;
      const aReviewed = (a.reviews ?? 0) > 0;
      const bReviewed = (b.reviews ?? 0) > 0;
      if (aReviewed !== bReviewed) return aReviewed ? -1 : 1;
      const rating = Number(b.rating ?? 0) - Number(a.rating ?? 0);
      if (rating !== 0) return rating;
      const reviews = (b.reviews ?? 0) - (a.reviews ?? 0);
      if (reviews !== 0) return reviews;
      const served = (b.pilgrims_served ?? 0) - (a.pilgrims_served ?? 0);
      if (served !== 0) return served;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [companies, rankedTrips, companyRank]);

  // Rows the server has, merged over the known set, so a table that predates a
  // new section key still renders every block in a sensible place.
  const layout = useMemo(() => {
    const byKey = new Map(homeSections.map((row) => [row.key, row]));
    return HOME_SECTIONS.map((meta, index) => {
      const row = byKey.get(meta.key);
      return {
        key: meta.key,
        sort_order: row?.sort_order ?? index,
        is_visible: row?.is_visible ?? true,
        max_items: row?.max_items ?? null,
        missing: row == null,
      };
    }).sort((a, b) => (a.sort_order === b.sort_order ? a.key.localeCompare(b.key) : a.sort_order - b.sort_order));
  }, [homeSections]);

  const activeAds = useMemo(
    () =>
      [...homeAds]
        .filter((ad) => ad.is_active)
        .sort((a, b) => (a.sort_order === b.sort_order ? b.created_at.localeCompare(a.created_at) : a.sort_order - b.sort_order)),
    [homeAds],
  );
  const orderedAds = useMemo(
    () =>
      [...homeAds].sort((a, b) => (a.sort_order === b.sort_order ? b.created_at.localeCompare(a.created_at) : a.sort_order - b.sort_order)),
    [homeAds],
  );

  const sectionLimit = (key: string) => layout.find((item) => item.key === key)?.max_items ?? null;
  const capped = <T,>(list: T[], key: string) => {
    const limit = sectionLimit(key);
    return limit == null ? list : list.slice(0, limit);
  };

  /** Rewrites sort_order across a whole list so ties can never re-shuffle. */
  async function persistOrder(table: "home_sections" | "home_ads", ids: string[]) {
    const supabase = getSupabase();
    const column = table === "home_sections" ? "key" : "id";
    const results = await Promise.all(
      ids.map((id, index) => supabase.from(table).update({ sort_order: index }).eq(column, id)),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    return null;
  }

  /**
   * Records where the administrator put each promoted agency / featured trip.
   * Positions are rewritten from 0 every time, so no gap or duplicate can
   * survive a reorder. Rows for records that are no longer promoted stay put
   * and are simply ignored, which restores their old slot if promoted again.
   */
  async function persistRank(kind: "company" | "package", ids: string[]) {
    const column = kind === "company" ? "company_id" : "package_id";
    const { error } = await getSupabase()
      .from("home_rank")
      .upsert(ids.map((id, index) => ({ [column]: id, sort_order: index })), { onConflict: column });
    if (error) throw error;
    return null;
  }

  function moveSection(key: string, direction: -1 | 1) {
    const order = layout.map((item) => item.key);
    const from = order.indexOf(key);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    void runAction(
      `section-move-${key}`,
      async () => {
        // A section the seed never inserted has no row to update yet.
        const known = new Set(homeSections.map((row) => row.key));
        const missing = order.filter((item) => !known.has(item));
        if (missing.length) {
          const inserted = await getSupabase().from("home_sections").insert(
            missing.map((item) => ({ key: item, sort_order: order.indexOf(item) })),
          );
          if (inserted.error) throw inserted.error;
        }
        return persistOrder("home_sections", order);
      },
      tr("ڕیزبەندی شاشەی سەرەکی نوێکرایەوە.", "تم تحديث ترتيب الشاشة الرئيسية.", "Home screen order updated."),
    );
  }

  function setSectionVisible(key: string, visible: boolean) {
    void runAction(
      `section-visible-${key}`,
      () =>
        getSupabase()
          .from("home_sections")
          .upsert({ key, is_visible: visible, sort_order: layout.findIndex((item) => item.key === key) }, { onConflict: "key" }),
      visible
        ? tr("بەشەکە پیشان دەدرێت.", "تم إظهار القسم.", "Section is now shown.")
        : tr("بەشەکە شاردرایەوە.", "تم إخفاء القسم.", "Section is now hidden."),
    );
  }

  function setSectionLimit(key: string, limit: number | null) {
    void runAction(
      `section-limit-${key}`,
      () =>
        getSupabase()
          .from("home_sections")
          .upsert({ key, max_items: limit, sort_order: layout.findIndex((item) => item.key === key) }, { onConflict: "key" }),
      tr("ژمارەی بڕگەکان نوێکرایەوە.", "تم تحديث عدد العناصر.", "Item count updated."),
    );
  }

  return (
    <>
      <div className="portal-page-heading">
        <div>
          <p>{tr("بەڕێوەبردنی ئەپ", "إدارة التطبيق", "App management")}</p>
          <h1>{tr("شاشەی سەرەکی ئەپ", "الشاشة الرئيسية للتطبيق", "App home screen")}</h1>
          <span>
            {tr(
              "سلایدەری ڕیکلام، باشترین کۆمپانیا و گەشتەکان و ڕیزبەندی شاشەی سەرەکی. هەر گۆڕانکارییەک ڕاستەوخۆ دەچێتە ناو ئەپەکە.",
              "شريط الإعلانات، أفضل الشركات والرحلات، وترتيب الشاشة الرئيسية. كل تغيير ينتقل مباشرة إلى التطبيق.",
              "The sponsors carousel, the top agencies and trips, and the order of the home screen. Every change goes straight to the app.",
            )}
          </span>
        </div>
      </div>

      <nav className="app-mgmt-tabs" role="tablist" aria-label={tr("بەشەکانی بەڕێوەبردنی ئەپ", "أقسام إدارة التطبيق", "App management sections")}>
        {([
          ["layout", LayoutTemplate, tr("ڕیزبەندی", "الترتيب", "Layout")],
          ["carousel", ImageIcon, tr("سلایدەر", "الإعلانات", "Carousel")],
          ["agencies", Building2, tr("باشترین کۆمپانیاکان", "أفضل الشركات", "Top agencies")],
          ["trips", Plane, tr("باشترین گەشتەکان", "أفضل الرحلات", "Top trips")],
        ] as Array<[typeof tab, any, string]>).map(([id, Icon, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      <div className="app-mgmt-grid">
        <div className="app-mgmt-main">
          {tab === "layout" && (
            <LayoutPanel
              layout={layout}
              locale={locale}
              busy={busy}
              onMove={moveSection}
              onVisible={setSectionVisible}
              onLimit={setSectionLimit}
            />
          )}
          {tab === "carousel" && (
            <CarouselPanel
              ads={orderedAds}
              companies={companies}
              trips={trips}
              locale={locale}
              busy={busy}
              runAction={runAction}
              persistOrder={persistOrder}
            />
          )}
          {tab === "agencies" && (
            <PromotionPanel
              locale={locale}
              busy={busy}
              runAction={runAction}
              ranked={rankedCompanies}
              limit={sectionLimit("agencies")}
            />
          )}
          {tab === "trips" && (
            <FeaturePanel
              locale={locale}
              busy={busy}
              runAction={runAction}
              ranked={rankedTrips}
              companyById={companyById}
              limit={sectionLimit("trips")}
            />
          )}
        </div>

        <HomePreview
          layout={layout}
          ads={capped(activeAds, "carousel")}
          companies={capped(rankedCompanies, "agencies")}
          trips={capped(rankedTrips, "trips")}
          locale={locale}
        />
      </div>
    </>
  );
}

/* ── Layout ─────────────────────────────────────────────────────────────── */

function LayoutPanel({
  layout,
  locale,
  busy,
  onMove,
  onVisible,
  onLimit,
}: {
  layout: Array<{ key: string; is_visible: boolean; max_items: number | null }>;
  locale: Locale;
  busy: string;
  onMove: (key: string, direction: -1 | 1) => void;
  onVisible: (key: string, visible: boolean) => void;
  onLimit: (key: string, limit: number | null) => void;
}) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);

  return (
    <section className="portal-panel app-mgmt-panel">
      <header className="app-mgmt-panel-head">
        <span><LayoutTemplate size={17} /></span>
        <div>
          <b>{tr("ڕیزبەندی شاشەی سەرەکی", "ترتيب الشاشة الرئيسية", "Home screen order")}</b>
          <small>
            {tr(
              "بەشەکان ڕیز بکە، بیانشارەوە، یان ژمارەی کارتەکان دیاری بکە.",
              "رتّب الأقسام أو أخفها أو حدد عدد البطاقات.",
              "Reorder the blocks, hide them, or cap how many cards each shows.",
            )}
          </small>
        </div>
      </header>

      <ol className="app-mgmt-sections">
        {layout.map((item, index) => {
          const meta = SECTION_META.get(item.key);
          if (!meta) return null;
          const rowBusy = busy.startsWith(`section-`) && busy.endsWith(item.key);
          return (
            <li key={item.key} className={item.is_visible ? "" : "is-hidden"}>
              <span className="app-mgmt-grip"><GripVertical size={15} /><i>{index + 1}</i></span>

              <div className="app-mgmt-section-text">
                <b>{locale === "ku" ? meta.ku : locale === "ar" ? meta.ar : meta.en}</b>
                <small>{locale === "ku" ? meta.noteKu : locale === "ar" ? meta.noteAr : meta.noteEn}</small>
              </div>

              {meta.capped && (
                <label className="app-mgmt-limit">
                  <small>{tr("ژمارە", "العدد", "Show")}</small>
                  <select
                    value={item.max_items ?? ""}
                    disabled={Boolean(rowBusy)}
                    onChange={(event) => onLimit(item.key, event.target.value === "" ? null : Number(event.target.value))}
                  >
                    <option value="">{tr("هەموو", "الكل", "All")}</option>
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
              )}

              <div className="app-mgmt-section-actions">
                <button
                  type="button"
                  title={item.is_visible ? tr("شاردنەوە", "إخفاء", "Hide") : tr("پیشاندان", "إظهار", "Show")}
                  aria-label={item.is_visible ? tr("شاردنەوە", "إخفاء", "Hide") : tr("پیشاندان", "إظهار", "Show")}
                  className={item.is_visible ? "is-on" : ""}
                  disabled={Boolean(rowBusy)}
                  onClick={() => onVisible(item.key, !item.is_visible)}
                >
                  {busy === `section-visible-${item.key}` ? <TawafLoadingSpinner size={13} /> : item.is_visible ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button
                  type="button"
                  title={tr("بەرەو سەرەوە", "لأعلى", "Move up")}
                  aria-label={tr("بەرەو سەرەوە", "لأعلى", "Move up")}
                  disabled={index === 0 || Boolean(rowBusy)}
                  onClick={() => onMove(item.key, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  title={tr("بەرەو خوارەوە", "لأسفل", "Move down")}
                  aria-label={tr("بەرەو خوارەوە", "لأسفل", "Move down")}
                  disabled={index === layout.length - 1 || Boolean(rowBusy)}
                  onClick={() => onMove(item.key, 1)}
                >
                  <ArrowDown size={15} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="app-mgmt-note">
        {tr(
          "بەکارهێنەرەکان ڕیزبەندییە نوێیەکە دەبینن کاتێک ئەپەکە دەکەنەوە یان لیستەکە نوێ دەکەنەوە.",
          "يرى المستخدمون الترتيب الجديد عند فتح التطبيق أو تحديث القائمة.",
          "Clients pick up the new order when they open the app or pull to refresh.",
        )}
      </p>
    </section>
  );
}

/* ── Carousel / sponsors ────────────────────────────────────────────────── */

function CarouselPanel({
  ads,
  companies,
  trips,
  locale,
  busy,
  runAction,
  persistOrder,
}: {
  ads: HomeAd[];
  companies: CompanyLike[];
  trips: TripLike[];
  locale: Locale;
  busy: string;
  runAction: RunAction;
  persistOrder: (table: "home_ads", ids: string[]) => Promise<null>;
}) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [linkKind, setLinkKind] = useState<"trip" | "company" | "none">("trip");
  const [linkId, setLinkId] = useState("");

  const publishedTrips = useMemo(
    () => trips.filter((trip) => trip.lifecycle_status === "published"),
    [trips],
  );
  const eligibleCompanies = useMemo(() => companies.filter(isCompanyEligible), [companies]);
  const companyById = useMemo(() => new Map(companies.map((item) => [item.id, item])), [companies]);
  const tripById = useMemo(() => new Map(trips.map((item) => [item.id, item])), [trips]);

  function resetForm() {
    setTitle(""); setTitleAr(""); setTitleEn("");
    setLinkKind("trip"); setLinkId("");
    setFormOpen(false);
  }

  async function createSlide() {
    const name = title.trim();
    if (!name) return;
    const linkedTrip = linkKind === "trip" ? tripById.get(linkId) : undefined;
    const result = await runAction(
      "ad-create",
      () =>
        getSupabase().from("home_ads").insert({
          title: name,
          title_ar: titleAr.trim() || null,
          title_en: titleEn.trim() || null,
          // A trip link carries its agency too, so the app can show the badge
          // even when the administrator only picked the trip.
          package_id: linkKind === "trip" ? linkId || null : null,
          company_id: linkKind === "company" ? linkId || null : linkedTrip?.company_id ?? null,
          sort_order: ads.length,
        }),
      tr("سلایدەکە زیادکرا.", "تمت إضافة الشريحة.", "Slide added."),
    );
    if (result) resetForm();
  }

  function uploadImage(ad: HomeAd, file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 6 * 1024 * 1024) {
      void runAction(
        `ad-image-${ad.id}`,
        () => { throw new Error(tr("وێنەی JPG، PNG یان WebP هەڵبژێرە کە لە ٦ مێگابایت بچووکترە.", "اختر صورة JPG أو PNG أو WebP أصغر من 6 ميغابايت.", "Choose a JPG, PNG or WebP image smaller than 6 MB.")); },
        "",
      );
      return;
    }
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    void runAction(
      `ad-image-${ad.id}`,
      async () => {
        // Same bucket and folder the Flutter admin screen uses, so a slide
        // uploaded from either surface lands in one place.
        const path = `ads/${ad.id}.${extension}`;
        const uploaded = await getSupabase().storage
          .from("package-images")
          .upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: true });
        if (uploaded.error) throw uploaded.error;
        const { data } = getSupabase().storage.from("package-images").getPublicUrl(path);
        return getSupabase()
          .from("home_ads")
          .update({ image_url: `${data.publicUrl}?v=${Date.now()}` })
          .eq("id", ad.id);
      },
      tr("وێنەکە بارکرا.", "تم رفع الصورة.", "Image uploaded."),
    );
  }

  function move(ad: HomeAd, direction: -1 | 1) {
    const order = ads.map((item) => item.id);
    const from = order.indexOf(ad.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    void runAction(
      `ad-move-${ad.id}`,
      () => persistOrder("home_ads", order),
      tr("ڕیزبەندی سلایدەکان نوێکرایەوە.", "تم تحديث ترتيب الشرائح.", "Slide order updated."),
    );
  }

  return (
    <section className="portal-panel app-mgmt-panel">
      <header className="app-mgmt-panel-head">
        <span><ImageIcon size={17} /></span>
        <div>
          <b>{tr("سلایدەری ڕیکلام", "شريط الإعلانات", "Sponsors carousel")}</b>
          <small>
            {tr(
              "لەسەرەوەی شاشەی سەرەکی هەر ٤ چرکە دەسوڕێتەوە. تەنها سلایدە چالاکەکان دەردەکەون.",
              "يتبدّل كل 4 ثوانٍ أعلى الشاشة الرئيسية. تظهر الشرائح النشطة فقط.",
              "Rotates every 4 seconds at the top of the home screen. Only active slides appear.",
            )}
          </small>
        </div>
        <button type="button" className="portal-primary-button" onClick={() => setFormOpen((open) => !open)}>
          {formOpen ? <X size={14} /> : <Plus size={14} />} {formOpen ? tr("پاشگەزبوونەوە", "إلغاء", "Cancel") : tr("سلایدی نوێ", "شريحة جديدة", "New slide")}
        </button>
      </header>

      {formOpen && (
        <div className="app-mgmt-form">
          <label>
            <small>{tr("ناونیشان (کوردی)", "العنوان (كردي)", "Title (Kurdish)")}</small>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={tr("عومرەی زێڕین", "عمرة ذهبية", "Golden Umrah")} />
          </label>
          <label>
            <small>{tr("ناونیشان (عەرەبی)", "العنوان (عربي)", "Title (Arabic)")}</small>
            <input value={titleAr} onChange={(event) => setTitleAr(event.target.value)} />
          </label>
          <label>
            <small>{tr("ناونیشان (ئینگلیزی)", "العنوان (إنجليزي)", "Title (English)")}</small>
            <input value={titleEn} onChange={(event) => setTitleEn(event.target.value)} />
          </label>
          <label>
            <small>{tr("کرتەکردن دەیباتە", "النقر يفتح", "Tapping opens")}</small>
            <select
              value={linkKind}
              onChange={(event) => { setLinkKind(event.target.value as any); setLinkId(""); }}
            >
              <option value="trip">{tr("گەشتێک", "رحلة", "A trip")}</option>
              <option value="company">{tr("کۆمپانیایەک", "شركة", "An agency")}</option>
              <option value="none">{tr("هیچ", "لا شيء", "Nothing")}</option>
            </select>
          </label>
          {linkKind !== "none" && (
            <label className="app-mgmt-form-wide">
              <small>{linkKind === "trip" ? tr("گەشت", "الرحلة", "Trip") : tr("کۆمپانیا", "الشركة", "Agency")}</small>
              <select value={linkId} onChange={(event) => setLinkId(event.target.value)}>
                <option value="">{tr("هەڵبژێرە…", "اختر…", "Select…")}</option>
                {linkKind === "trip"
                  ? publishedTrips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title} — {companyById.get(trip.company_id)?.name ?? "—"}
                    </option>
                  ))
                  : eligibleCompanies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
              </select>
            </label>
          )}
          <div className="app-mgmt-form-actions">
            <button type="button" className="portal-secondary-button" onClick={resetForm}>
              {tr("پاشگەزبوونەوە", "إلغاء", "Cancel")}
            </button>
            <button
              type="button"
              className="portal-primary-button"
              onClick={createSlide}
              disabled={!title.trim() || (linkKind !== "none" && !linkId) || busy === "ad-create"}
            >
              {busy === "ad-create" ? <TawafLoadingSpinner size={14} /> : <Check size={14} />} {tr("زیادکردن", "إضافة", "Add slide")}
            </button>
          </div>
          <p className="app-mgmt-note app-mgmt-form-wide">
            {tr(
              "دوای زیادکردن وێنەکەی بار بکە — بێ وێنە سلایدەکە بە ڕەنگی بنەڕەت دەردەکەوێت.",
              "بعد الإضافة ارفع الصورة — بدونها تظهر الشريحة بخلفية افتراضية.",
              "Upload the image after adding — without one the slide falls back to a plain panel.",
            )}
          </p>
        </div>
      )}

      {!ads.length ? (
        <div className="app-mgmt-empty">
          <span><ImageIcon size={22} /></span>
          <b>{tr("هیچ سلایدێک نییە", "لا توجد شرائح", "No slides yet")}</b>
          <p>
            {tr(
              "بەبێ سلایدی چالاک، باشترین گەشتی بازاڕ شوێنی سلایدەکە دەگرێتەوە.",
              "بدون شريحة نشطة، تظهر أفضل رحلة في السوق مكان الشريط.",
              "With no active slide, the marketplace's strongest trip fills the slot.",
            )}
          </p>
        </div>
      ) : (
        <ul className="app-mgmt-ads">
          {ads.map((ad, index) => {
            const trip = ad.package_id ? tripById.get(ad.package_id) : undefined;
            const company = ad.company_id ? companyById.get(ad.company_id) : undefined;
            const rowBusy = busy.startsWith("ad-") && busy.endsWith(ad.id);
            return (
              <li key={ad.id} className={ad.is_active ? "" : "is-off"}>
                <div className="app-mgmt-ad-thumb" style={ad.image_url ? { backgroundImage: `url("${ad.image_url}")` } : undefined}>
                  {!ad.image_url && <ImageIcon size={19} />}
                  <label title={tr("بارکردنی وێنە", "رفع صورة", "Upload image")}>
                    {busy === `ad-image-${ad.id}` ? <TawafLoadingSpinner size={14} /> : <Upload size={14} />}
                    {/* Clearing the input lets the same file be re-picked
                        after a failed upload. */}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        uploadImage(ad, file);
                      }}
                    />
                  </label>
                </div>

                <div className="app-mgmt-ad-text">
                  <b>{ad.title}</b>
                  <small>
                    {trip
                      ? <><Link2 size={11} /> {trip.title}</>
                      : company
                        ? <><Building2 size={11} /> {company.name}</>
                        : tr("بێ بەستەر", "بدون رابط", "No link")}
                  </small>
                  <i className="app-mgmt-ad-pos">#{index + 1}</i>
                </div>

                <div className="app-mgmt-section-actions">
                  <button
                    type="button"
                    className={ad.is_active ? "is-on" : ""}
                    title={ad.is_active ? tr("ناچالاککردن", "تعطيل", "Deactivate") : tr("چالاککردن", "تفعيل", "Activate")}
                    aria-label={ad.is_active ? tr("ناچالاککردن", "تعطيل", "Deactivate") : tr("چالاککردن", "تفعيل", "Activate")}
                    disabled={Boolean(rowBusy)}
                    onClick={() =>
                      runAction(
                        `ad-active-${ad.id}`,
                        () => getSupabase().from("home_ads").update({ is_active: !ad.is_active }).eq("id", ad.id),
                        ad.is_active
                          ? tr("سلایدەکە ناچالاک کرا.", "تم تعطيل الشريحة.", "Slide deactivated.")
                          : tr("سلایدەکە چالاک کرا.", "تم تفعيل الشريحة.", "Slide activated."),
                      )
                    }
                  >
                    {busy === `ad-active-${ad.id}` ? <TawafLoadingSpinner size={13} /> : ad.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button type="button" title={tr("بەرەو سەرەوە", "لأعلى", "Move up")} aria-label={tr("بەرەو سەرەوە", "لأعلى", "Move up")} disabled={index === 0 || Boolean(rowBusy)} onClick={() => move(ad, -1)}>
                    <ArrowUp size={15} />
                  </button>
                  <button type="button" title={tr("بەرەو خوارەوە", "لأسفل", "Move down")} aria-label={tr("بەرەو خوارەوە", "لأسفل", "Move down")} disabled={index === ads.length - 1 || Boolean(rowBusy)} onClick={() => move(ad, 1)}>
                    <ArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    title={tr("سڕینەوە", "حذف", "Delete")}
                    aria-label={tr("سڕینەوە", "حذف", "Delete")}
                    disabled={Boolean(rowBusy)}
                    onClick={() => {
                      if (!window.confirm(tr("ئەم سلایدە بسڕدرێتەوە؟", "حذف هذه الشريحة؟", "Delete this slide?"))) return;
                      void runAction(
                        `ad-delete-${ad.id}`,
                        () => getSupabase().from("home_ads").delete().eq("id", ad.id),
                        tr("سلایدەکە سڕدرایەوە.", "تم حذف الشريحة.", "Slide deleted."),
                      );
                    }}
                  >
                    {busy === `ad-delete-${ad.id}` ? <TawafLoadingSpinner size={13} /> : <Trash2 size={15} />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ── Top agencies ───────────────────────────────────────────────────────── */

function PromotionPanel({
  ranked,
  liveTripCompanyIds,
  limit,
  locale,
  busy,
  runAction,
  persistRank,
}: {
  ranked: CompanyLike[];
  liveTripCompanyIds: Set<string>;
  limit: number | null;
  locale: Locale;
  busy: string;
  runAction: RunAction;
  persistRank: (kind: "company" | "package", ids: string[]) => Promise<null>;
}) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const [query, setQuery] = useState("");

  // `ranked` already leads with the promoted block in the administrator's own
  // order, so splitting it here keeps this editor and the app in step.
  const promoted = ranked.filter((company) => company.is_promoted);
  const rest = ranked.filter(
    (company) =>
      !company.is_promoted &&
      (!query.trim() || `${company.name} ${company.location ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())),
  );

  function move(company: CompanyLike, direction: -1 | 1) {
    const order = promoted.map((item) => item.id);
    const from = order.indexOf(company.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    void runAction(
      `agency-order-${company.id}`,
      () => persistRank("company", order),
      tr("ڕیزبەندی کۆمپانیاکان نوێکرایەوە.", "تم تحديث ترتيب الشركات.", "Agency order updated."),
    );
  }

  return (
    <section className="portal-panel app-mgmt-panel">
      <header className="app-mgmt-panel-head">
        <span><Building2 size={17} /></span>
        <div>
          <b>{tr("باشترین کۆمپانیاکان", "أفضل الشركات", "Top agencies")}</b>
          <small>
            {tr(
              `${promoted.length} کۆمپانیای پرۆمۆتکراو. بە هەمان ئەم ڕیزبەندییە لە ئەپدا دەردەکەون.`,
              `${promoted.length} شركة مروَّجة. تظهر في التطبيق بنفس هذا الترتيب.`,
              `${promoted.length} promoted. They lead the row in exactly the order you set here.`,
            )}
          </small>
        </div>
      </header>

      <div className="app-mgmt-pinned">
        <header>
          <Star size={13} fill="currentColor" />
          {tr("ڕیزبەندی لە ئەپدا", "الترتيب داخل التطبيق", "Order on the home screen")}
        </header>
        {!promoted.length ? (
          <p className="app-mgmt-pinned-empty">
            {tr(
              "هێشتا هیچ کۆمپانیایەک پرۆمۆت نەکراوە — لە لیستی خوارەوە هەڵیانبژێرە.",
              "لم يتم ترويج أي شركة بعد — اخترها من القائمة أدناه.",
              "Nothing promoted yet — pick agencies from the list below.",
            )}
          </p>
        ) : (
          <ol className="app-mgmt-pinned-list">
            {promoted.map((company, index) => {
              const rowBusy = busy === `agency-order-${company.id}` || busy === `promote-${company.id}`;
              const onHome = limit == null || index < limit;
              return (
                <li key={company.id} className={onHome ? "" : "is-out"}>
                  <i className="app-mgmt-pos">{index + 1}</i>
                  <div className="app-mgmt-avatar">
                    {company.logo_url ? <img src={company.logo_url} alt="" /> : company.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="app-mgmt-rank-text">
                    <b>{company.name}</b>
                    <small>
                      {company.location || "—"} · ★ {Number(company.rating ?? 0).toFixed(1)} ({company.reviews ?? 0})
                      {!liveTripCompanyIds.has(company.id) && (
                        <em> · {tr("گەشتی چالاکی نییە", "لا توجد رحلة نشطة", "no live trip")}</em>
                      )}
                      {!onHome && <em> · {tr("دەرەوەی سنووری پیشاندان", "خارج حد العرض", "past the item cap")}</em>}
                    </small>
                  </div>
                  <div className="app-mgmt-section-actions">
                    <button type="button" title={tr("بەرەو سەرەوە", "لأعلى", "Move up")} aria-label={tr("بەرەو سەرەوە", "لأعلى", "Move up")} disabled={index === 0 || rowBusy} onClick={() => move(company, -1)}>
                      {busy === `agency-order-${company.id}` ? <TawafLoadingSpinner size={13} /> : <ArrowUp size={15} />}
                    </button>
                    <button type="button" title={tr("بەرەو خوارەوە", "لأسفل", "Move down")} aria-label={tr("بەرەو خوارەوە", "لأسفل", "Move down")} disabled={index === promoted.length - 1 || rowBusy} onClick={() => move(company, 1)}>
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      title={tr("لابردنی پرۆمۆشن", "إزالة الترويج", "Remove promotion")}
                      aria-label={tr("لابردنی پرۆمۆشن", "إزالة الترويج", "Remove promotion")}
                      disabled={rowBusy}
                      onClick={() =>
                        runAction(
                          `promote-${company.id}`,
                          () => getSupabase().rpc("admin_set_company_promoted", { p_company_id: company.id, p_value: false }),
                          tr("پرۆمۆشن لابرا.", "تمت إزالة الترويج.", "Promotion removed."),
                        )
                      }
                    >
                      {busy === `promote-${company.id}` ? <TawafLoadingSpinner size={13} /> : <X size={15} />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="app-mgmt-search">
        <Search size={15} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("گەڕان بۆ کۆمپانیا…", "ابحث عن شركة…", "Search agencies…")} />
      </div>

      {!rest.length ? (
        <div className="app-mgmt-empty">
          <span><Building2 size={22} /></span>
          <b>{tr("هیچ کۆمپانیایەکی تر نییە", "لا توجد شركات أخرى", "No other agencies")}</b>
          <p>{tr("تەنها کۆمپانیا پەسەندکراوەکان لێرە دەردەکەون.", "تظهر هنا الشركات المعتمدة فقط.", "Only approved, active agencies appear here.")}</p>
        </div>
      ) : (
        <ul className="app-mgmt-rank">
          {rest.map((company) => (
            <li key={company.id}>
              <i className="app-mgmt-pos is-out">{ranked.indexOf(company) + 1}</i>
              <div className="app-mgmt-avatar">
                {company.logo_url ? <img src={company.logo_url} alt="" /> : company.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="app-mgmt-rank-text">
                <b>{company.name}</b>
                <small>{company.location || "—"} · ★ {Number(company.rating ?? 0).toFixed(1)} ({company.reviews ?? 0})</small>
              </div>
              <button
                type="button"
                className="app-mgmt-pick"
                disabled={busy === `promote-${company.id}`}
                onClick={() =>
                  runAction(
                    `promote-${company.id}`,
                    () => getSupabase().rpc("admin_set_company_promoted", { p_company_id: company.id, p_value: true }),
                    tr("کۆمپانیاکە پرۆمۆت کرا.", "تم ترويج الشركة.", "Agency promoted."),
                  )
                }
              >
                {busy === `promote-${company.id}` ? <TawafLoadingSpinner size={13} /> : <Star size={14} />}
                {tr("پرۆمۆتکردن", "ترويج", "Promote")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="app-mgmt-note">
        {tr(
          "کۆمپانیا پرۆمۆتکراوەکان بە ڕیزبەندی تۆ دەردەکەون. ئەوانی خوارەوە بەپێی هەڵسەنگاندن و شاری بەکارهێنەر ڕیز دەکرێن.",
          "الشركات المروَّجة تظهر بترتيبك أنت. أما البقية فتُرتَّب حسب التقييم ومدينة المستخدم.",
          "Promoted agencies appear in your order. Everything below is ranked by reputation and the client's own city.",
        )}
      </p>
    </section>
  );
}

/* ── Top trips ──────────────────────────────────────────────────────────── */

function FeaturePanel({
  ranked,
  companyById,
  limit,
  locale,
  busy,
  runAction,
  persistRank,
}: {
  ranked: TripLike[];
  companyById: Map<string, CompanyLike>;
  limit: number | null;
  locale: Locale;
  busy: string;
  runAction: RunAction;
  persistRank: (kind: "company" | "package", ids: string[]) => Promise<null>;
}) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const [query, setQuery] = useState("");

  const featured = ranked.filter((trip) => trip.is_featured);
  const rest = ranked.filter(
    (trip) =>
      !trip.is_featured &&
      (!query.trim() || `${trip.title} ${companyById.get(trip.company_id)?.name ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())),
  );

  function move(trip: TripLike, direction: -1 | 1) {
    const order = featured.map((item) => item.id);
    const from = order.indexOf(trip.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    void runAction(
      `trip-order-${trip.id}`,
      () => persistRank("package", order),
      tr("ڕیزبەندی گەشتەکان نوێکرایەوە.", "تم تحديث ترتيب الرحلات.", "Trip order updated."),
    );
  }

  return (
    <section className="portal-panel app-mgmt-panel">
      <header className="app-mgmt-panel-head">
        <span><Plane size={17} /></span>
        <div>
          <b>{tr("باشترین گەشتەکان", "أفضل الرحلات", "Top trips")}</b>
          <small>
            {tr(
              `${featured.length} گەشتی تایبەتکراو. تەنها گەشتە بڵاوکراوەکانی داهاتوو کە جێگایان ماوە لێرە دەردەکەون.`,
              `${featured.length} رحلة مميزة. تظهر هنا الرحلات المنشورة القادمة التي ما زالت بها مقاعد فقط.`,
              `${featured.length} featured. Only published trips with seats left and a future departure appear here.`,
            )}
          </small>
        </div>
      </header>

      <div className="app-mgmt-pinned">
        <header>
          <Sparkles size={13} />
          {tr("ڕیزبەندی لە ئەپدا", "الترتيب داخل التطبيق", "Order on the home screen")}
        </header>
        {!featured.length ? (
          <p className="app-mgmt-pinned-empty">
            {tr(
              "هێشتا هیچ گەشتێک تایبەت نەکراوە — لە لیستی خوارەوە هەڵیانبژێرە.",
              "لم يتم تمييز أي رحلة بعد — اخترها من القائمة أدناه.",
              "Nothing featured yet — pick trips from the list below.",
            )}
          </p>
        ) : (
          <ol className="app-mgmt-pinned-list">
            {featured.map((trip, index) => {
              const rowBusy = busy === `trip-order-${trip.id}` || busy === `feature-${trip.id}`;
              const onHome = limit == null || index < limit;
              return (
                <li key={trip.id} className={onHome ? "" : "is-out"}>
                  <i className="app-mgmt-pos">{index + 1}</i>
                  <div className="app-mgmt-avatar is-wide" style={trip.image_url ? { backgroundImage: `url("${trip.image_url}")` } : undefined}>
                    {!trip.image_url && <Plane size={15} />}
                  </div>
                  <div className="app-mgmt-rank-text">
                    <b>{trip.title}</b>
                    <small>
                      {companyById.get(trip.company_id)?.name ?? "—"} · {formatIqd(trip.price_iqd)}
                      {trip.departure_date ? ` · ${trip.departure_date}` : ""}
                      {!onHome && <em> · {tr("دەرەوەی سنووری پیشاندان", "خارج حد العرض", "past the item cap")}</em>}
                    </small>
                  </div>
                  <div className="app-mgmt-section-actions">
                    <button type="button" title={tr("بەرەو سەرەوە", "لأعلى", "Move up")} aria-label={tr("بەرەو سەرەوە", "لأعلى", "Move up")} disabled={index === 0 || rowBusy} onClick={() => move(trip, -1)}>
                      {busy === `trip-order-${trip.id}` ? <TawafLoadingSpinner size={13} /> : <ArrowUp size={15} />}
                    </button>
                    <button type="button" title={tr("بەرەو خوارەوە", "لأسفل", "Move down")} aria-label={tr("بەرەو خوارەوە", "لأسفل", "Move down")} disabled={index === featured.length - 1 || rowBusy} onClick={() => move(trip, 1)}>
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      title={tr("لابردنی تایبەتکردن", "إزالة التمييز", "Unfeature")}
                      aria-label={tr("لابردنی تایبەتکردن", "إزالة التمييز", "Unfeature")}
                      disabled={rowBusy}
                      onClick={() =>
                        runAction(
                          `feature-${trip.id}`,
                          () => getSupabase().rpc("admin_set_package_featured", { p_package_id: trip.id, p_value: false }),
                          tr("تایبەتکردن لابرا.", "تمت إزالة التمييز.", "Trip unfeatured."),
                        )
                      }
                    >
                      {busy === `feature-${trip.id}` ? <TawafLoadingSpinner size={13} /> : <X size={15} />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="app-mgmt-search">
        <Search size={15} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("گەڕان بۆ گەشت…", "ابحث عن رحلة…", "Search trips…")} />
      </div>

      {!rest.length ? (
        <div className="app-mgmt-empty">
          <span><Plane size={22} /></span>
          <b>{tr("هیچ گەشتێکی تری گونجاو نییە", "لا توجد رحلات مؤهلة أخرى", "No other eligible trips")}</b>
          <p>{tr("گەشتەکان دەبێت بڵاوکرابنەوە و ڕۆژی بەڕێکەوتنیان نەڕۆیشتبێت.", "يجب أن تكون الرحلة منشورة ولم يمر تاريخ مغادرتها.", "A trip must be published with a departure date still ahead.")}</p>
        </div>
      ) : (
        <ul className="app-mgmt-rank">
          {rest.map((trip) => (
            <li key={trip.id}>
              <i className="app-mgmt-pos is-out">{ranked.indexOf(trip) + 1}</i>
              <div className="app-mgmt-avatar is-wide" style={trip.image_url ? { backgroundImage: `url("${trip.image_url}")` } : undefined}>
                {!trip.image_url && <Plane size={15} />}
              </div>
              <div className="app-mgmt-rank-text">
                <b>{trip.title}</b>
                <small>
                  {companyById.get(trip.company_id)?.name ?? "—"} · {formatIqd(trip.price_iqd)}
                  {trip.departure_date ? ` · ${trip.departure_date}` : ""}
                </small>
              </div>
              <button
                type="button"
                className="app-mgmt-pick"
                disabled={busy === `feature-${trip.id}`}
                onClick={() =>
                  runAction(
                    `feature-${trip.id}`,
                    () => getSupabase().rpc("admin_set_package_featured", { p_package_id: trip.id, p_value: true }),
                    tr("گەشتەکە تایبەت کرا.", "تم تمييز الرحلة.", "Trip featured."),
                  )
                }
              >
                {busy === `feature-${trip.id}` ? <TawafLoadingSpinner size={13} /> : <Sparkles size={14} />}
                {tr("تایبەتکردن", "تمييز", "Feature")}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="app-mgmt-note">
        {tr(
          "گەشتە تایبەتکراوەکان بە ڕیزبەندی تۆ دەردەکەون. ئەوانی خوارەوە بەپێی هەڵسەنگاندن و بەرواری بەڕێکەوتن ڕیز دەکرێن.",
          "الرحلات المميزة تظهر بترتيبك أنت. أما البقية فتُرتَّب حسب التقييم وتاريخ المغادرة.",
          "Featured trips appear in your order. Everything below is ranked by reputation and departure date.",
        )}
      </p>
    </section>
  );
}

/* ── Phone preview ──────────────────────────────────────────────────────── */

function HomePreview({
  layout,
  ads,
  companies,
  trips,
  locale,
}: {
  layout: Array<{ key: string; is_visible: boolean }>;
  ads: HomeAd[];
  companies: CompanyLike[];
  trips: TripLike[];
  locale: Locale;
}) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const visible = layout.filter((item) => item.is_visible);
  const adTitle = (ad: HomeAd) =>
    (locale === "en" ? ad.title_en : locale === "ar" ? ad.title_ar : null) || ad.title;

  return (
    <aside className="app-mgmt-preview">
      <header>
        <Smartphone size={14} /> {tr("پێشبینینی شاشەی سەرەکی", "معاينة الشاشة الرئيسية", "Home screen preview")}
      </header>

      <div className="app-mgmt-phone">
        <div className="app-mgmt-phone-screen">
          {!visible.length && (
            <p className="app-mgmt-phone-empty">{tr("هەموو بەشەکان شاردراونەتەوە.", "جميع الأقسام مخفية.", "Every section is hidden.")}</p>
          )}

          {visible.map((item) => {
            const meta = SECTION_META.get(item.key);
            const label = meta ? (locale === "ku" ? meta.ku : locale === "ar" ? meta.ar : meta.en) : item.key;

            if (item.key === "prayer_times") {
              return (
                <div className="pv-prayer" key={item.key}>
                  {["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].map((name) => (
                    <span key={name}><i /><small>{name}</small></span>
                  ))}
                </div>
              );
            }
            if (item.key === "active_booking") {
              return (
                <div className="pv-booking" key={item.key}>
                  <b>{tr("حیجزی چالاک", "الحجز النشط", "Active booking")}</b>
                  <small>{tr("تەنها بۆ ئەوانەی حیجزیان هەیە", "لمن لديه حجز فقط", "Only for clients with a booking")}</small>
                </div>
              );
            }
            if (item.key === "carousel") {
              return (
                <div className="pv-carousel" key={item.key}>
                  <div className="pv-slide" style={ads[0]?.image_url ? { backgroundImage: `url("${ads[0].image_url}")` } : undefined}>
                    <span>{ads.length ? adTitle(ads[0]) : tr("باشترین گەشت", "أفضل رحلة", "Strongest trip")}</span>
                  </div>
                  {ads.length > 1 && (
                    <div className="pv-dots">{ads.slice(0, 6).map((ad, index) => <i key={ad.id} className={index === 0 ? "on" : ""} />)}</div>
                  )}
                </div>
              );
            }
            if (item.key === "categories") {
              return (
                <div className="pv-chips" key={item.key}>
                  {[tr("نزیک لە حەرەم", "قرب الحرم", "Near Haram"), tr("٥ ئەستێرە", "5 نجوم", "5 star"), tr("فڕۆکە", "طيران", "Flight"), tr("نرخی کەم", "الأرخص", "Best price")].map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                </div>
              );
            }
            if (item.key === "agencies") {
              return (
                <div className="pv-block" key={item.key}>
                  <h4>{label}</h4>
                  <div className="pv-row">
                    {companies.slice(0, 4).map((company) => (
                      <div className="pv-agency" key={company.id}>
                        <span>{company.logo_url ? <img src={company.logo_url} alt="" /> : company.name.slice(0, 2).toUpperCase()}</span>
                        <small>{company.name}</small>
                        {company.is_promoted && <i className="pv-flag"><Star size={8} fill="currentColor" /></i>}
                      </div>
                    ))}
                    {!companies.length && <p className="pv-none">{tr("هیچ کۆمپانیایەک نییە", "لا توجد شركات", "No agencies yet")}</p>}
                  </div>
                </div>
              );
            }
            if (item.key !== "trips") return null;
            return (
              <div className="pv-block" key={item.key}>
                <h4>{label}</h4>
                <div className="pv-trips">
                  {trips.slice(0, 3).map((trip) => (
                    <div className="pv-trip" key={trip.id}>
                      <span style={trip.image_url ? { backgroundImage: `url("${trip.image_url}")` } : undefined} />
                      <div>
                        <b>{trip.title}</b>
                        <small>{formatIqd(trip.price_iqd)}</small>
                      </div>
                      {trip.is_featured && <i className="pv-flag"><Sparkles size={8} /></i>}
                    </div>
                  ))}
                  {!trips.length && <p className="pv-none">{tr("هیچ گەشتێک نییە", "لا توجد رحلات", "No trips yet")}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="app-mgmt-note">
        {tr(
          "پێشبینینێکی نزیکە — ئەپەکە هەروەها شاری بەکارهێنەر لەبەرچاو دەگرێت.",
          "معاينة تقريبية — التطبيق يأخذ مدينة المستخدم بالحسبان أيضاً.",
          "A close approximation — the app also weighs each client's own city.",
        )}
      </p>
    </aside>
  );
}
