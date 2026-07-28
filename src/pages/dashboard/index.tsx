/* eslint-disable @typescript-eslint/no-explicit-any */

import "../../styles/portal.css";
import "../../styles/trips.css";
import "../../styles/portal-theme.css";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownRight,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Bell,
  BookOpenCheck,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  CreditCard,
  ChevronLeft,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Headphones,
  Hourglass,
  Languages,
  LayoutDashboard,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquareText,
  Plane,
  Plus,
  PhoneCall,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Star,
  TicketCheck,
  Upload,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useScrollLock } from "@/lib/use-scroll-lock";
import TawafLoadingSpinner from "@/components/TawafLoadingSpinner";
import CompanyTripsWorkspace from "./company-trips.tsx";
import AppManagementWorkspace from "./app-management.tsx";
import type { HomeAd, HomeSectionRow, HomeRankRow } from "./app-management.tsx";
import { dashboardTranslations } from "./translations.ts";

type Role = "admin" | "agency";
type RunAction = (id: string, action: () => any, success: string) => Promise<any>;
type AskReason = (title: string, options?: { optional?: boolean }) => Promise<string | null>;

// Freeze background page scroll while a full-screen overlay (modal/drawer) is
// mounted. Compensates for the scrollbar width so the page doesn't shift.
type PageId =
  | "overview"
  | "companies"
  | "trips"
  | "bookings"
  | "finance"
  | "support"
  | "messages"
  | "app"
  | "more";

type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: Role;
};

type Company = {
  id: string;
  owner_id: string;
  // A branch is a company whose parent_company_id points at its head office.
  // Null means this row is itself a head office (or a single-office agency).
  parent_company_id: string | null;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  location: string | null;
  about: string | null;
  about_ar: string | null;
  about_en: string | null;
  office_address: string | null;
  phone: string | null;
  whatsapp: string | null;
  office_hours: string | null;
  license_number: string | null;
  since: number | null;
  tags: string[] | null;
  banner_url: string | null;
  gallery_urls: string[] | null;
  intro_video_url: string | null;
  cancellation_policy: string | null;
  cancellation_policy_ar: string | null;
  cancellation_policy_en: string | null;
  accepted_payment_methods: string[] | null;
  rating: number | null;
  reviews: number | null;
  status: string;
  verification_status: string;
  verification_reason: string | null;
  is_verified: boolean;
  is_active: boolean;
  is_promoted: boolean;
  commission_rate: number | null;
  logo_url: string | null;
  // Tie-breaker in the app's "top agencies" ranking, mirrored on the App
  // management page so the preview matches what clients get.
  pilgrims_served: number | null;
  created_at: string;
};

type CompanyOwner = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type Trip = {
  id: string;
  company_id: string;
  title: string;
  price_iqd: number;
  days: number;
  nights: number;
  transport: string;
  acc_stars: number;
  image_url: string | null;
  lifecycle_status: string;
  review_reason: string | null;
  rejection_reason?: string | null;
  departure_date: string | null;
  return_date: string | null;
  capacity: number | null;
  seats_reserved: number | null;
  is_featured: boolean;
  is_published: boolean;
  created_at: string;
};

type TripChangeRequest = {
  id: string;
  package_id: string;
  company_id: string;
  request_type: "edit" | "pause" | "remove";
  status: "pending" | "approved" | "rejected" | "cancelled";
  requested_by: string;
  reviewed_by: string | null;
  before_snapshot: Record<string, any>;
  proposed_snapshot: Record<string, any>;
  changed_fields: string[];
  request_reason: string | null;
  review_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type Booking = {
  id: string;
  package_id: string;
  company_id: string;
  client_id: string;
  travellers: number;
  total_iqd: number;
  amount_paid_iqd: number;
  amount_due_now_iqd: number;
  // What the company actually keeps. Already selected by `select("*")` — it was
  // simply never surfaced, so agencies read gross and did the subtraction
  // themselves.
  payout_iqd: number | null;
  commission_iqd: number | null;
  commission_rate: number | null;
  operational_stage: string;
  status_reason: string | null;
  pay_method: string;
  pay_status: string;
  departure_date: string | null;
  contact_phone: string | null;
  note: string | null;
  room_label: string | null;
  room_occupancy: number | null;
  room_count: number | null;
  expires_at: string | null;
  created_at: string;
};

// booking_travellers has no company_id column; RLS ("read booking travellers")
// scopes a bare select to the caller's own bookings + their company's bookings,
// so we never filter these client-side by company.
type BookingTraveller = {
  id: string;
  booking_id: string;
  client_id: string;
  full_name: string;
  local_name: string | null;
  passport_no: string | null;
  date_of_birth: string | null;
  phone: string | null;
  gender: string | null;
  nationality: string | null;
  passport_expiry_date: string | null;
  is_lead: boolean;
  passport_image_path: string | null;
  selfie_image_path: string | null;
  document_status: string;
  document_reason: string | null;
  visa_status: string;
  visa_reference: string | null;
  visa_reason: string | null;
  transport_seat: string | null;
  created_at: string;
};

type TravellerDocument = {
  id: string;
  traveller_id: string;
  booking_id: string;
  company_id: string;
  kind: string;
  storage_path: string;
  storage_bucket: string;
  status: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type Commission = {
  id: string;
  booking_id: string;
  company_id: string;
  amount_iqd: number;
  status: string;
  created_at: string;
};

type Payment = {
  id: string;
  booking_id: string;
  company_id: string;
  amount_iqd: number;
  method: string;
  status: string;
  created_at: string;
};

type SupportMessage = {
  id: string;
  email: string | null;
  message: string;
  status: string | null;
  created_at: string;
};

type Inquiry = {
  id: string;
  subject?: string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at: string;
  inquiry_messages?: Array<{
    id: string;
    body: string;
    sender_id: string;
    created_at: string;
  }>;
};

type LedgerRow = {
  id: string;
  entry_type: string;
  amount_iqd: number;
  description: string | null;
  created_at: string;
};

type Payout = {
  id: string;
  amount_iqd: number;
  method: string | null;
  status: string;
  created_at: string;
};

type PortalData = {
  companies: Company[];
  companyOwners: CompanyOwner[];
  trips: Trip[];
  tripChangeRequests: TripChangeRequest[];
  bookings: Booking[];
  bookingTravellers: BookingTraveller[];
  travellerDocuments: TravellerDocument[];
  commissions: Commission[];
  payments: Payment[];
  support: SupportMessage[];
  inquiries: Inquiry[];
  ledger: LedgerRow[];
  payouts: Payout[];
  // Admin-only: what the app's home screen shows and in which order.
  homeAds: HomeAd[];
  homeSections: HomeSectionRow[];
  homeRank: HomeRankRow[];
};

const emptyData: PortalData = {
  companies: [],
  companyOwners: [],
  trips: [],
  tripChangeRequests: [],
  bookings: [],
  bookingTravellers: [],
  travellerDocuments: [],
  commissions: [],
  payments: [],
  support: [],
  inquiries: [],
  ledger: [],
  payouts: [],
  homeAds: [],
  homeSections: [],
  homeRank: [],
};

// No Bookings entry for admins: bookings are reached by drilling into the trip
// they belong to (Trips → trip → bookings, or Companies → company → trip →
// bookings), so a flat cross-marketplace booking list would be a second,
// competing way in.
const adminNavigation: Array<{ id: PageId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "trips", label: "Trips", icon: Plane },
  { id: "finance", label: "Finance", icon: CircleDollarSign },
  { id: "support", label: "Support", icon: Headphones },
  { id: "app", label: "App management", icon: Smartphone },
  { id: "more", label: "Settings", icon: Settings },
];

const companyNavigation: Array<{ id: PageId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "trips", label: "Trips", icon: Plane },
  { id: "bookings", label: "Bookings", icon: BookOpenCheck },
  { id: "messages", label: "Messages", icon: MessageSquareText },
  { id: "finance", label: "Money", icon: WalletCards },
  { id: "more", label: "Company profile", icon: Settings },
];

// Which branch the operator is working inside. Persisted so a refresh does not
// silently drop them back into the head office — acting on the wrong branch is
// the main hazard of a multi-branch workspace.
const ACTIVE_COMPANY_KEY = "tawaf-active-company";

// Mirrors lib/utils/iraqi_cities.dart in the Flutter app. The app ranks trips by
// the client's home city and has to alias-match free-text locations ("Erbil",
// "erbil", "هەولێر", …) back to one key; picking from this list writes the
// canonical English name so that matching always succeeds. Keep both lists in
// step — adding a city here means adding it there too.
const IRAQI_CITIES: Array<{ value: string; ku: string; ar: string; en: string }> = [
  { value: "Erbil", ku: "هەولێر", ar: "أربيل", en: "Erbil" },
  { value: "Sulaymaniyah", ku: "سلێمانی", ar: "السليمانية", en: "Sulaymaniyah" },
  { value: "Duhok", ku: "دهۆک", ar: "دهوك", en: "Duhok" },
  { value: "Halabja", ku: "هەڵەبجە", ar: "حلبجة", en: "Halabja" },
  { value: "Kirkuk", ku: "کەرکووک", ar: "كركوك", en: "Kirkuk" },
];

const cityLabel = (city: (typeof IRAQI_CITIES)[number], locale: "ku" | "ar" | "en") =>
  locale === "ku" ? city.ku : locale === "ar" ? city.ar : city.en;

// Wording for a desktop notification. Mirrors the app's notification screen so
// the same event reads the same on both surfaces.
function notificationCopy(type: string, arg: string | null, locale: "ku" | "ar" | "en") {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const subject = arg || tr("گەشتێک", "رحلة", "a trip");
  switch (type) {
    case "bookingRequested": return { title: tr("داواکاری حیجزی نوێ", "طلب حجز جديد", "New booking request"), body: subject };
    case "bookingConfirmed": return { title: tr("حیجز پشتڕاستکرایەوە", "تم تأكيد الحجز", "Booking confirmed"), body: subject };
    case "bookingCancelled": return { title: tr("حیجز هەڵوەشێندرایەوە", "تم إلغاء الحجز", "Booking cancelled"), body: subject };
    case "bookingReady": return { title: tr("گەشت ئامادەیە", "الرحلة جاهزة", "Trip is ready"), body: subject };
    case "documentsUploaded": return { title: tr("بەڵگەنامە بارکرا", "تم رفع مستندات", "Documents uploaded"), body: subject };
    case "documentsApproved": return { title: tr("بەڵگەنامەکان پەسەندکران", "تمت الموافقة على المستندات", "Documents approved"), body: subject };
    case "documentsRejected": return { title: tr("بەڵگەنامەکان ڕەتکرانەوە", "تم رفض المستندات", "Documents rejected"), body: subject };
    case "visaApproved": return { title: tr("ڤیزا پەسەندکرا", "تمت الموافقة على التأشيرة", "Visa approved"), body: subject };
    case "visaRejected": return { title: tr("ڤیزا ڕەتکرایەوە", "تم رفض التأشيرة", "Visa rejected"), body: subject };
    case "tripStarted": return { title: tr("گەشت دەستی پێکرد", "بدأت الرحلة", "Trip started"), body: subject };
    case "tripCompleted": return { title: tr("گەشت تەواوبوو", "اكتملت الرحلة", "Trip completed"), body: subject };
    case "announcement": return { title: tr("ڕاگەیاندنی تەواف", "إعلان من طواف", "Tawaf announcement"), body: subject };
    case "companyReview": return { title: tr("پێداچوونەوەی کۆمپانیا", "مراجعة الشركة", "Company review"), body: subject };
    case "packageSubmitted": return { title: tr("گەشتی نوێ بۆ پێداچوونەوە", "رحلة جديدة للمراجعة", "New trip to review"), body: subject };
    case "packageReview": return { title: tr("پێداچوونەوەی گەشت", "مراجعة الرحلة", "Trip review"), body: subject };
    default: return { title: "Tawaf", body: subject };
  }
}

// Desktop notifications for the dashboard. The browser's Notification API needs
// no keys or service worker as long as the tab is open, which pairs with the
// realtime subscriptions: a row lands, the operator is told even if the tab is
// in the background.
//
// Permission is requested once per browser. If it was denied we never ask again
// (the browser blocks repeat prompts anyway) and the workspace simply carries on
// showing the in-app badges.
function useBrowserNotifications(enabled: boolean, userId: string | undefined, locale: "ku" | "ar" | "en") {
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => {
    if (!enabled || !userId) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    let cancelled = false;
    // Asked on open, as soon as we know who is signed in.
    if (Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {});
    }

    const supabase = getSupabase();
    const channel = supabase.channel(`tawaf-web:desktop-notify:${userId}`);
    channel.on(
      "postgres_changes" as any,
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` } as any,
      (payload: any) => {
        if (cancelled || Notification.permission !== "granted") return;
        const row = payload?.new ?? {};
        const { title, body } = notificationCopy(String(row.type ?? ""), row.arg ?? null, localeRef.current);
        try {
          // tag collapses duplicates if the same row arrives twice.
          new Notification(title, { body, icon: "/brand/tawaf-icon.png", tag: String(row.id ?? "") });
        } catch {
          // Some browsers throw when constructing notifications outside a
          // service worker; the in-app badge is the fallback.
        }
      },
    );
    channel.subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [enabled, userId]);
}

type RealtimeWatch = { table: string; filter?: string };

// Live workspace. Two operators (and the pilgrim app) act on the same rows, so
// without this an admin approves a trip and the company keeps looking at a
// stale card until they hit refresh — the "Live data" badge in the topbar was
// decorative before this existed.
//
// The payload is deliberately ignored: we refetch through the normal loader,
// which re-applies RLS for the signed-in role rather than trusting a pushed row.
function useRealtimeSync(enabled: boolean, watches: RealtimeWatch[], onChange: () => void) {
  const handler = useRef(onChange);
  handler.current = onChange;
  // Only re-subscribe when the watch set actually changes, not on every render.
  const key = watches.map((item) => `${item.table}:${item.filter ?? ""}`).join("|");

  useEffect(() => {
    if (!enabled || !watches.length) return;
    const supabase = getSupabase();
    let timer: number | undefined;
    // One action touches several rows (booking + notification + commission), so
    // coalesce a burst into a single reload.
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => handler.current(), 400);
    };

    const channels = watches.map((item) => {
      const channel = supabase.channel(`tawaf-web:${item.table}:${item.filter ?? "all"}`);
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: item.table, ...(item.filter ? { filter: item.filter } : {}) } as any,
        schedule,
      );
      channel.subscribe();
      return channel;
    });

    return () => {
      window.clearTimeout(timer);
      // Stale channels would otherwise leak events across accounts/branches.
      channels.forEach((channel) => { void supabase.removeChannel(channel); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
}

const statusLabels: Record<string, string> = {
  pending_review: "Pending review",
  needs_changes: "Needs changes",
  awaiting_payment: "Awaiting payment",
  in_progress: "In progress",
  not_started: "Not started",
};

function titleCase(value: string) {
  return statusLabels[value] ?? value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

// Supabase/PostgREST errors are plain objects, not Error instances, so an
// `instanceof Error` check would discard the message the user needs to see.
function errorMessage(cause: unknown) {
  if (cause instanceof Error && cause.message) return cause.message;
  if (cause && typeof cause === "object") {
    const row = cause as { message?: string; details?: string; hint?: string };
    const text = [row.message, row.details, row.hint].filter(Boolean).join(" — ");
    if (text) return text;
  }
  return "That action could not be completed.";
}

function formatIqd(value: number | null | undefined, compact = false) {
  const amount = Number(value ?? 0);
  if (compact && amount >= 1_000_000_000) return `IQD ${(amount / 1_000_000_000).toFixed(1)}B`;
  if (compact && amount >= 1_000_000) return `IQD ${(amount / 1_000_000).toFixed(1)}M`;
  if (compact && amount >= 1_000) return `IQD ${(amount / 1_000).toFixed(0)}K`;
  return `IQD ${new Intl.NumberFormat("en-US").format(amount)}`;
}

function formatDate(value: string | null | undefined, includeYear = false) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(new Date(value));
}

/// Departure–return as one string. The year is printed once at the end when
/// both dates fall in the same year, so "01 Aug – 12 Aug 2026" rather than the
/// noisier "01 Aug 2026 – 12 Aug 2026".
///
/// `bookings` has no return date of its own; callers pass the one from the
/// booking's package, which is where the trip's itinerary actually lives.
function formatDateRange(from: string | null | undefined, to: string | null | undefined) {
  if (!from) return formatDate(from, true);
  if (!to) return formatDate(from, true);
  const sameYear = new Date(from).getFullYear() === new Date(to).getFullYear();
  return `${formatDate(from, !sameYear)} – ${formatDate(to, true)}`;
}

/// Nights between the two dates, or null when either is missing. Agencies price
/// and staff trips by night count, so it is worth showing where there is room.
function nightsBetween(from: string | null | undefined, to: string | null | undefined) {
  if (!from || !to) return null;
  const nights = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
  return nights > 0 ? nights : null;
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "Recently";
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.max(0, Math.floor(diff / 3_600_000));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

const tripChangeLabels: Record<string, string> = {
  title: "Trip title",
  title_ar: "Arabic title",
  title_en: "English title",
  overview: "Description",
  overview_ar: "Arabic description",
  overview_en: "English description",
  price_iqd: "Package price",
  days: "Duration",
  nights: "Hotel nights",
  transport: "Transport",
  carrier: "Carrier",
  acc_stars: "Hotel rating",
  image_url: "Cover image",
  capacity: "Capacity",
  departure_date: "Departure date",
  return_date: "Return date",
  package_tier: "Package tier",
  group_type: "Group type",
  season_tag: "Season",
  departure_airport: "Departure airport",
  airline_name: "Airline",
  flight_type: "Flight type",
  bus_between_cities: "Intercity bus",
  airport_transfers: "Airport transfers",
  transport_notes: "Transport notes",
  meals_per_day: "Meals per day",
  video_url: "Video",
  cancellation_policy: "Cancellation policy",
  deposit_iqd: "Deposit",
  non_refundable_deposit: "Deposit refundability",
  deposit_terms: "Deposit terms",
  itinerary: "Daily itinerary",
  pricing: "Pricing",
  hotels: "Hotels",
  inclusions: "Included services",
  lifecycle_status: "Trip status",
  trip_removal: "Trip removal",
};

function tripChangeValue(field: string, value: any) {
  if (value === null || value === undefined || value === "") return "Not set";
  if (field.endsWith("_iqd")) return formatIqd(Number(value));
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return "Updated details";
  const text = String(value);
  return text.length > 90 ? `${text.slice(0, 87)}…` : titleCase(text);
}

function statusTone(status: string) {
  if (["active", "approved", "published", "confirmed", "completed", "succeeded", "collected", "ready"].includes(status)) return "positive";
  if (["rejected", "cancelled", "failed", "suspended", "expired", "removed"].includes(status)) return "negative";
  if (["pending", "pending_review", "requested", "awaiting_payment", "owed", "under_review", "needs_changes"].includes(status)) return "warning";
  return "neutral";
}

type CompanyVerificationState = "pending" | "needs_changes" | "approved" | "suspended" | "rejected";

function companyVerificationState(company: Company): CompanyVerificationState {
  if (company.verification_status === "rejected" || company.status === "rejected") return "rejected";
  if (company.verification_status === "suspended" || company.status === "suspended" || !company.is_active) return "suspended";
  if (company.verification_status === "needs_changes") return "needs_changes";
  if (company.verification_status === "approved" && company.is_active) return "approved";
  return "pending";
}

function companyProfileCompletion(company: Company) {
  const fields = [
    company.name,
    company.license_number,
    company.location,
    company.office_address,
    company.phone,
    company.about,
    company.logo_url,
    company.banner_url,
    company.office_hours,
    company.accepted_payment_methods?.length,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function localizedCompanyStatus(status: string, locale?: "ku" | "ar" | "en") {
  if (!locale) return titleCase(status);
  const copy: Record<string, [string, string, string]> = {
    pending: ["چاوەڕێی پێداچوونەوە", "بانتظار المراجعة", "Pending review"],
    needs_changes: ["گۆڕانکاری پێویستە", "تعديلات مطلوبة", "Changes requested"],
    approved: ["پەسەندکراو", "معتمدة", "Approved"],
    suspended: ["ڕاگیراو", "معلقة", "Suspended"],
    rejected: ["ڕەتکراوە", "مرفوضة", "Rejected"],
  };
  const value = copy[status];
  return value ? value[locale === "ku" ? 0 : locale === "ar" ? 1 : 2] : titleCase(status);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  // Every company this account may act for. More than one means the agency runs
  // branches, and the workspace shows a switcher.
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [branchFormOpen, setBranchFormOpen] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [branchLocation, setBranchLocation] = useState("");
  const [data, setData] = useState<PortalData>(emptyData);
  const [page, setPage] = useState<PageId>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [reasonDialog, setReasonDialog] = useState<{
    title: string;
    optional: boolean;
    resolve: (value: string | null) => void;
  } | null>(null);

  const [locale, setLocale] = useState<"ku" | "ar" | "en">("ku");

  const askReason = useCallback((title: string, options?: { optional?: boolean }) => {
    return new Promise<string | null>((resolve) => {
      setReasonDialog({ title, optional: Boolean(options?.optional), resolve });
    });
  }, []);

  const closeReason = (value: string | null) => {
    reasonDialog?.resolve(value);
    setReasonDialog(null);
  };

  useEffect(() => {
    const saved = localStorage.getItem("tawaf-locale") as "ku" | "ar" | "en";
    if (saved && ["ku", "ar", "en"].includes(saved)) {
      setLocale(saved);
    }
  }, []);

  const changeLocale = (newLocale: "ku" | "ar" | "en") => {
    setLocale(newLocale);
    localStorage.setItem("tawaf-locale", newLocale);
  };

  useEffect(() => {
    document.documentElement.dir = locale === "en" ? "ltr" : "rtl";
    document.documentElement.lang = locale;
  }, [locale]);

  const getLabel = (id: PageId) => {
    if (locale === "ku") {
      switch (id) {
        case "overview": return "گشتی";
        case "companies": return "کۆمپانیاکان";
        case "trips": return "گەشتەکان";
        case "bookings": return "حیجزەکان";
        case "finance": return "دارایی / پارە";
        case "support": return "پشتگیری";
        case "messages": return "نامەکان";
        case "app": return "بەڕێوەبردنی ئەپ";
        case "more": return role === "admin" ? "زیاتر" : "پڕۆفایلی کۆمپانیا";
        default: return id;
      }
    }
    if (locale === "ar") {
      switch (id) {
        case "overview": return "نظرة عامة";
        case "companies": return "الشركات";
        case "trips": return "الرحلات";
        case "bookings": return "الحجوزات";
        case "finance": return "المالية";
        case "support": return "الدعم";
        case "messages": return "الرسائل";
        case "app": return "إدارة التطبيق";
        case "more": return role === "admin" ? "المزيد" : "ملف الشركة";
        default: return id;
      }
    }
    switch (id) {
      case "overview": return "Overview";
      case "companies": return "Companies";
      case "trips": return "Trips";
      case "bookings": return "Bookings";
      case "finance": return role === "admin" ? "Finance" : "Money";
      case "support": return "Support";
      case "messages": return "Messages";
      case "app": return "App management";
      case "more": return role === "admin" ? "More" : "Company profile";
      default: return id;
    }
  };

  const loadPortal = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError("");
      const supabase = getSupabase();

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          navigate("/sign-in", { replace: true });
          return;
        }

        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("id, role, full_name, phone")
          .eq("id", userData.user.id)
          .single();

        if (profileError || !profileRow || !["admin", "agency"].includes(profileRow.role)) {
          await supabase.auth.signOut();
          navigate("/sign-in", { replace: true });
          return;
        }

        const currentRole = profileRow.role as Role;
        const currentProfile: Profile = {
          id: profileRow.id,
          email: userData.user.email ?? "",
          full_name: profileRow.full_name ?? "",
          phone: profileRow.phone ?? "",
          role: currentRole,
        };

        setRole(currentRole);
        setProfile(currentProfile);

        if (currentRole === "admin") {
          const [
            companiesResult,
            tripsResult,
            tripChangesResult,
            bookingsResult,
            travellersResult,
            documentsResult,
            commissionsResult,
            paymentsResult,
            supportResult,
            homeAdsResult,
            homeSectionsResult,
            homeRankResult,
          ] = await Promise.all([
            supabase.from("companies").select("*").order("created_at", { ascending: false }),
            supabase.from("packages").select("*").order("created_at", { ascending: false }),
            supabase.from("trip_change_requests").select("*").order("created_at", { ascending: false }).limit(100),
            supabase.from("bookings").select("*").order("created_at", { ascending: false }),
            supabase.from("booking_travellers").select("*").order("created_at", { ascending: true }),
            supabase.from("traveller_documents").select("*").order("created_at", { ascending: false }),
            supabase.from("commissions").select("*").order("created_at", { ascending: false }),
            supabase.from("payments").select("*").order("created_at", { ascending: false }),
            supabase.from("support_messages").select("*").order("created_at", { ascending: false }),
            supabase.from("home_ads").select("*").order("sort_order", { ascending: true }),
            supabase.from("home_sections").select("*").order("sort_order", { ascending: true }),
            supabase.from("home_rank").select("*").order("sort_order", { ascending: true }),
          ]);

          const firstError = [
            companiesResult,
            tripsResult,
            tripChangesResult,
            bookingsResult,
            travellersResult,
            documentsResult,
            commissionsResult,
            paymentsResult,
            supportResult,
          ].find((result) => result.error)?.error;
          if (firstError) throw firstError;

          const companyRows = (companiesResult.data ?? []) as Company[];
          const ownerIds = Array.from(new Set(companyRows.map((item) => item.owner_id).filter(Boolean)));
          // Admin-only lookup. RLS still decides which profile rows may be
          // returned; a restrictive policy simply leaves the owner fallback ID.
          // Batch IDs so a large marketplace never exceeds PostgREST URL limits.
          const ownerChunks = Array.from({ length: Math.ceil(ownerIds.length / 100) }, (_, index) => ownerIds.slice(index * 100, (index + 1) * 100));
          const ownerResults = await Promise.all(ownerChunks.map((ids) => supabase.from("profiles").select("id, full_name, phone").in("id", ids)));
          const companyOwners = ownerResults.flatMap((result) => result.error ? [] : (result.data ?? [])) as CompanyOwner[];

          setCompany(null);
          setData({
            ...emptyData,
            companies: companyRows,
            companyOwners,
            trips: (tripsResult.data ?? []) as Trip[],
            tripChangeRequests: (tripChangesResult.data ?? []) as TripChangeRequest[],
            bookings: (bookingsResult.data ?? []) as Booking[],
            bookingTravellers: (travellersResult.data ?? []) as BookingTraveller[],
            travellerDocuments: (documentsResult.data ?? []) as TravellerDocument[],
            commissions: (commissionsResult.data ?? []) as Commission[],
            payments: (paymentsResult.data ?? []) as Payment[],
            support: (supportResult.data ?? []) as SupportMessage[],
            // Home-screen curation is deliberately outside the error check
            // above: it decorates one page, so an unreachable table must not
            // cost the operator the whole workspace.
            homeAds: (homeAdsResult.data ?? []) as HomeAd[],
            homeSections: (homeSectionsResult.data ?? []) as HomeSectionRow[],
            homeRank: (homeRankResult.data ?? []) as HomeRankRow[],
          });
        } else {
          // An owner can now hold a head office plus its branches, so this must
          // never use .maybeSingle() — that throws the moment a second row
          // exists. We gather every company this account can act for (owned,
          // branches of an owned head office, and staff memberships), then work
          // inside exactly one of them at a time.
          const [ownedResult, membershipResult] = await Promise.all([
            supabase.from("companies").select("*").eq("owner_id", currentProfile.id),
            supabase
              .from("agency_staff")
              .select("companies(*)")
              .eq("user_id", currentProfile.id)
              .eq("status", "active"),
          ]);
          if (ownedResult.error) throw ownedResult.error;
          if (membershipResult.error) throw membershipResult.error;

          const owned = (ownedResult.data ?? []) as Company[];
          const staffCompanies = ((membershipResult.data ?? []) as Array<{ companies: Company | null }>)
            .map((row) => row.companies)
            .filter(Boolean) as Company[];

          // Branches of a head office this account owns. RLS already allows it
          // (owns_company walks the parent), but they are not returned by the
          // owner_id query when each branch has its own owner row.
          const parentIds = owned.filter((item) => !item.parent_company_id).map((item) => item.id);
          let branchRows: Company[] = [];
          if (parentIds.length) {
            const branchResult = await supabase.from("companies").select("*").in("parent_company_id", parentIds);
            if (branchResult.error) throw branchResult.error;
            branchRows = (branchResult.data ?? []) as Company[];
          }

          const byId = new Map<string, Company>();
          [...owned, ...branchRows, ...staffCompanies].forEach((item) => byId.set(item.id, item));
          const accessible = Array.from(byId.values()).sort((a, b) => {
            // Head offices first, then branches alphabetically under them.
            const aParent = a.parent_company_id ?? a.id;
            const bParent = b.parent_company_id ?? b.id;
            if (aParent !== bParent) return aParent.localeCompare(bParent);
            if (!a.parent_company_id) return -1;
            if (!b.parent_company_id) return 1;
            return a.name.localeCompare(b.name);
          });
          setCompanies(accessible);

          // An unapproved company must not reach the workspace, however it got
          // here: fresh sign-in, a restored session, or a direct /dashboard link.
          // The sign-in form checks this too, but it is bypassed whenever a
          // session already exists, so this loader is the real gate.
          //
          // 'draft' and 'needs_changes' are deliberately allowed through: those
          // companies need to get in to complete their profile and use "Submit
          // for review" in the verification banner.
          //
          // With branches this must pick a USABLE company rather than simply the
          // first one: a newly created branch enters as 'pending', and signing
          // the owner out of their approved head office because of it would be
          // wrong. We only fall through to the sign-out gate when nothing the
          // account can reach is usable.
          const blockedStatuses = ["pending", "rejected", "suspended"];
          const usable = accessible.filter((item) => !blockedStatuses.includes(item.verification_status));
          const storedId = localStorage.getItem(ACTIVE_COMPANY_KEY);
          const companyRow: Company | null =
            usable.find((item) => item.id === storedId) ?? usable[0] ?? null;

          if (!companyRow) {
            const blocked = accessible[0];
            if (blocked) {
              await supabase.auth.signOut();
              navigate("/sign-in", { replace: true, state: { blocked: blocked.verification_status } });
              return;
            }
            setCompany(null);
            setData(emptyData);
            throw new Error("No company workspace is attached to this account.");
          }

          setCompany(companyRow);
          const [
            tripsResult,
            tripChangesResult,
            bookingsResult,
            travellersResult,
            documentsResult,
            commissionsResult,
            paymentsResult,
            inquiriesResult,
            ledgerResult,
            payoutsResult,
          ] = await Promise.all([
            supabase.from("packages").select("*").eq("company_id", companyRow.id).order("created_at", { ascending: false }),
            supabase.from("trip_change_requests").select("*").eq("company_id", companyRow.id).order("created_at", { ascending: false }).limit(100),
            supabase.from("bookings").select("*").eq("company_id", companyRow.id).order("created_at", { ascending: false }),
            // booking_travellers has no company_id; RLS scopes this to the company's bookings.
            supabase.from("booking_travellers").select("*").order("created_at", { ascending: true }),
            supabase.from("traveller_documents").select("*").eq("company_id", companyRow.id).order("created_at", { ascending: false }),
            supabase.from("commissions").select("*").eq("company_id", companyRow.id).order("created_at", { ascending: false }),
            supabase.from("payments").select("*").eq("company_id", companyRow.id).order("created_at", { ascending: false }),
            supabase.from("inquiries").select("*, inquiry_messages(*)").eq("agency_id", companyRow.id).order("updated_at", { ascending: false }),
            supabase.from("agency_ledger").select("*").eq("company_id", companyRow.id).order("created_at", { ascending: false }),
            supabase.from("payouts").select("*").eq("company_id", companyRow.id).order("created_at", { ascending: false }),
          ]);

          const firstError = [
            tripsResult,
            tripChangesResult,
            bookingsResult,
            travellersResult,
            documentsResult,
            commissionsResult,
            paymentsResult,
            inquiriesResult,
            ledgerResult,
            payoutsResult,
          ].find((result) => result.error)?.error;
          if (firstError) throw firstError;

          setData({
            ...emptyData,
            companies: [companyRow],
            trips: (tripsResult.data ?? []) as Trip[],
            tripChangeRequests: (tripChangesResult.data ?? []) as TripChangeRequest[],
            bookings: (bookingsResult.data ?? []) as Booking[],
            bookingTravellers: (travellersResult.data ?? []) as BookingTraveller[],
            travellerDocuments: (documentsResult.data ?? []) as TravellerDocument[],
            commissions: (commissionsResult.data ?? []) as Commission[],
            payments: (paymentsResult.data ?? []) as Payment[],
            inquiries: (inquiriesResult.data ?? []) as Inquiry[],
            ledger: (ledgerResult.data ?? []) as LedgerRow[],
            payouts: (payoutsResult.data ?? []) as Payout[],
          });
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The workspace could not be loaded.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    // The initial authenticated data load belongs to this route mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPortal();
  }, [loadPortal]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // What this workspace must react to. Admin oversees everything, so no row
  // filter (RLS still decides what reaches them); a company only listens to its
  // own rows so one busy agency does not wake every other workspace.
  const realtimeWatches: RealtimeWatch[] = useMemo(() => {
    if (!role) return [];
    if (role === "admin") {
      return [
        { table: "companies" }, { table: "packages" }, { table: "trip_change_requests" },
        { table: "bookings" }, { table: "booking_travellers" }, { table: "traveller_documents" },
        { table: "payments" }, { table: "commissions" }, { table: "support_messages" },
        { table: "home_ads" }, { table: "home_sections" }, { table: "home_rank" },
      ];
    }
    if (!company) return [];
    const mine = `company_id=eq.${company.id}`;
    return [
      { table: "companies", filter: `id=eq.${company.id}` },
      { table: "packages", filter: mine },
      { table: "trip_change_requests", filter: mine },
      { table: "bookings", filter: mine },
      { table: "traveller_documents", filter: mine },
      { table: "payments", filter: mine },
      { table: "commissions", filter: mine },
      { table: "inquiries", filter: `agency_id=eq.${company.id}` },
      // These two carry no company column; the refetch applies the real scoping.
      { table: "booking_travellers" },
      { table: "inquiry_messages" },
    ];
  }, [role, company?.id]);

  useRealtimeSync(!loading && Boolean(role), realtimeWatches, () => loadPortal(true));
  // Every signed-in role gets desktop notifications for their own feed — the
  // branch fan-out means a group owner is told about all their branches too.
  useBrowserNotifications(!loading && Boolean(role), profile?.id, locale);

  // Switching branch re-scopes the entire workspace, so it goes through the
  // normal loader rather than filtering client-side — every query below is
  // keyed on the active company id.
  function switchCompany(id: string) {
    if (id === company?.id) return;
    localStorage.setItem(ACTIVE_COMPANY_KEY, id);
    setPage("overview");
    loadPortal(true);
  }

  // Opening a branch office. The row is an ordinary company with
  // parent_company_id set, so it inherits nothing automatically: the insert
  // trigger forces it to 'pending' and Tawaf verifies it on its own licence,
  // exactly like a new agency. Only the head office may open one.
  async function createBranch(name: string, location: string) {
    const headOffice = companies.find((item) => !item.parent_company_id) ?? company;
    if (!headOffice) return;
    await runAction(
      "branch-create",
      () => getSupabase().from("companies").insert({
        name: name.trim(),
        location: location.trim() || null,
        parent_company_id: headOffice.id,
      }),
      locale === "ku"
        ? "لقەکە دروستکرا و نێردرا بۆ پشتڕاستکردنەوەی تەواف."
        : locale === "ar"
          ? "تم إنشاء الفرع وإرساله إلى طواف للتحقق."
          : "Branch created and sent to Tawaf for verification.",
    );
  }

  async function runAction(id: string, action: () => any, success: string) {
    setBusy(id);
    setError("");
    try {
      const result = await action();
      if (result?.error) throw result.error;
      setToast(success);
      await loadPortal(true);
      return result;
    } catch (cause) {
      setError(errorMessage(cause));
      return null;
    } finally {
      setBusy("");
    }
  }

  async function signOut() {
    setBusy("signout");
    await getSupabase().auth.signOut();
    navigate("/", { replace: true });
  }

  function changePage(nextPage: PageId) {
    setPage(nextPage);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Only the head office may open branches, and only its owner. A branch cannot
  // spawn sub-branches (the DB enforces one level regardless).
  const canAddBranch = Boolean(
    role === "agency" && company && !company.parent_company_id && company.owner_id === profile?.id,
  );
  const canSwitchBranch = companies.length > 1 || canAddBranch;

  const navigation = role === "admin" ? adminNavigation : companyNavigation;
  const badges: Partial<Record<PageId, number>> = role === "admin"
    ? {
      // "Changes requested" is waiting on the company, not on an admin.
      companies: data.companies.filter((item) => companyVerificationState(item) === "pending").length,
      trips: data.trips.filter((item) => item.lifecycle_status === "pending_review").length
        + data.tripChangeRequests.filter((item) => item.status === "pending").length,
      bookings: data.bookings.filter((item) => item.operational_stage === "requested").length,
      support: data.support.filter((item) => !item.status || item.status === "open").length,
    }
    : {
      // The company's actionable inbox: new requests + travellers whose uploaded
      // documents are still waiting for a verdict (the main daily queue).
      bookings: data.bookings.filter((item) => item.operational_stage === "requested").length
        + data.bookingTravellers.filter((item) => item.document_status === "under_review").length,
      messages: data.inquiries.filter((item) => item.status !== "closed").length,
    };

  // `id` rather than `page` keys these rows: since admins lost the Bookings
  // page, two admin rows now point at "trips".
  const notificationItems: Array<{ id: string; page: PageId; label: string; count: number }> = role === "admin"
    ? [
      { id: "companies", page: "companies", count: badges.companies ?? 0, label: locale === "en" ? "Company applications" : locale === "ar" ? "طلبات الشركات" : "داواکارییەکانی کۆمپانیا" },
      { id: "trips", page: "trips", count: badges.trips ?? 0, label: locale === "en" ? "Trips awaiting review" : locale === "ar" ? "رحلات بانتظار المراجعة" : "گەشتەکان بۆ پێداچوونەوە" },
      // Admins reach a booking by drilling into its trip, so this lands on Trips.
      { id: "bookings", page: "trips", count: badges.bookings ?? 0, label: locale === "en" ? "New booking requests" : locale === "ar" ? "طلبات حجز جديدة" : "داواکاری حیجزی نوێ" },
      { id: "support", page: "support", count: badges.support ?? 0, label: locale === "en" ? "Support messages" : locale === "ar" ? "رسائل الدعم" : "نامەکانی پشتیوانی" },
    ]
    : [
      { id: "bookings", page: "bookings", count: badges.bookings ?? 0, label: locale === "en" ? "New booking requests" : locale === "ar" ? "طلبات حجز جديدة" : "داواکاری حیجزی نوێ" },
      { id: "messages", page: "messages", count: badges.messages ?? 0, label: locale === "en" ? "Open conversations" : locale === "ar" ? "محادثات مفتوحة" : "گفتوگۆ کراوەکان" },
    ];

  const attentionItems = notificationItems.filter((item) => item.count > 0);
  const totalNotifications = attentionItems.reduce((sum, item) => sum + item.count, 0);
  const pageIcons: Partial<Record<PageId, LucideIcon>> = {
    companies: Building2,
    trips: Plane,
    bookings: BookOpenCheck,
    support: Headphones,
    messages: MessageSquareText,
  };

  if (loading) {
    return (
      <main className="portal-loading">
        <TawafLoadingSpinner size={96} />
        <p>Preparing your Tawaf workspace</p>
      </main>
    );
  }

  if (!role || !profile) return null;

  return (
    <main className="portal-shell">
      <aside className={`portal-sidebar ${role === "admin" ? "admin" : ""} ${mobileOpen ? "open" : ""}`}>
        <div className="portal-sidebar-head">
          <Link className="portal-brand" to="/">
            <img src="/brand/tawaf-logo.png" alt="" width={76} height={76} />
            <span>
              Tawaf
              <small>{role === "admin" ? "ADMIN CONTROL" : "COMPANY PORTAL"}</small>
            </span>
          </Link>
          <button className="portal-mobile-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        {role === "agency" && company && (
          <div className="portal-branch-wrap">
            {/* Only a multi-branch agency gets a switcher: a single-office
                manager should not be given a dropdown of one. */}
            <div
              className={`portal-company-card${canSwitchBranch ? " is-switchable" : ""}`}
              role={canSwitchBranch ? "button" : undefined}
              tabIndex={canSwitchBranch ? 0 : undefined}
              onClick={() => canSwitchBranch && setBranchMenuOpen((open) => !open)}
              onKeyDown={(event) => {
                if (canSwitchBranch && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  setBranchMenuOpen((open) => !open);
                }
              }}
            >
              <div className="portal-company-avatar">
                {company.logo_url ? (
                  <img src={company.logo_url} alt="" />
                ) : (
                  company.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <b>{company.name}</b>
                <small>
                  <span className={company.is_verified ? "online" : ""} />
                  {company.parent_company_id
                    ? (locale === "ku" ? "لق" : locale === "ar" ? "فرع" : "Branch")
                    : companies.length > 1
                      ? (locale === "ku" ? "نووسینگەی سەرەکی" : locale === "ar" ? "المكتب الرئيسي" : "Head office")
                      : company.is_verified ? "Verified company" : titleCase(company.verification_status)}
                </small>
              </div>
              {canSwitchBranch && <ChevronDown size={15} />}
            </div>

            {branchMenuOpen && canSwitchBranch && (
              <>
                <button type="button" className="portal-branch-scrim" aria-label="Close" onClick={() => setBranchMenuOpen(false)} />
                <div className="portal-branch-menu" role="listbox">
                  <small>{locale === "ku" ? "گۆڕینی لق" : locale === "ar" ? "تبديل الفرع" : "Switch branch"}</small>
                  {companies.map((item) => {
                    // A branch awaiting Tawaf's verdict cannot be worked in yet,
                    // so it is listed for visibility but not selectable.
                    const blocked = ["pending", "rejected", "suspended"].includes(item.verification_status);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        role="option"
                        aria-selected={item.id === company.id}
                        disabled={blocked}
                        className={`${item.id === company.id ? "is-active" : ""}${item.parent_company_id ? " is-branch" : ""}`}
                        onClick={() => { setBranchMenuOpen(false); switchCompany(item.id); }}
                      >
                        <span>
                          <b>{item.name}</b>
                          <small>{item.parent_company_id
                            ? (item.location || (locale === "ku" ? "لق" : locale === "ar" ? "فرع" : "Branch"))
                            : (locale === "ku" ? "نووسینگەی سەرەکی" : locale === "ar" ? "المكتب الرئيسي" : "Head office")}</small>
                        </span>
                        {item.id === company.id && <Check size={14} />}
                        {blocked && <i className="portal-branch-off">{titleCase(item.verification_status)}</i>}
                      </button>
                    );
                  })}

                  {canAddBranch && (
                    branchFormOpen ? (
                      <form
                        className="portal-branch-form"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          if (!branchName.trim()) return;
                          await createBranch(branchName, branchLocation);
                          setBranchName(""); setBranchLocation("");
                          setBranchFormOpen(false); setBranchMenuOpen(false);
                        }}
                      >
                        <input autoFocus value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder={locale === "ku" ? "ناوی لق" : locale === "ar" ? "اسم الفرع" : "Branch name"} />
                        <select value={branchLocation} onChange={(event) => setBranchLocation(event.target.value)}>
                          <option value="">{locale === "ku" ? "شار هەڵبژێرە" : locale === "ar" ? "اختر المدينة" : "Select city"}</option>
                          {IRAQI_CITIES.map((city) => (
                            <option key={city.value} value={city.value}>{cityLabel(city, locale)}</option>
                          ))}
                        </select>
                        <div>
                          <button type="button" onClick={() => setBranchFormOpen(false)}>{locale === "ku" ? "پاشگەزبوونەوە" : locale === "ar" ? "إلغاء" : "Cancel"}</button>
                          <button type="submit" className="primary" disabled={!branchName.trim() || !branchLocation || busy === "branch-create"}>
                            {busy === "branch-create" ? <TawafLoadingSpinner size={13} /> : <Check size={13} />} {locale === "ku" ? "دروستکردن" : locale === "ar" ? "إنشاء" : "Create"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button type="button" className="portal-branch-add" onClick={() => setBranchFormOpen(true)}>
                        <Plus size={14} /> {locale === "ku" ? "زیادکردنی لق" : locale === "ar" ? "إضافة فرع" : "Add branch"}
                      </button>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <nav className="portal-nav" aria-label="Dashboard navigation">
          <small>{locale === "en" ? "WORKSPACE" : locale === "ar" ? "مساحة العمل" : "شوێنی کار"}</small>
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={page === item.id ? "active" : ""}
                onClick={() => changePage(item.id)}
              >
                <Icon size={18} />
                <span>{getLabel(item.id)}</span>
                {!!badges[item.id] && <i>{badges[item.id]}</i>}
              </button>
            );
          })}
        </nav>

        <div className="portal-sidebar-foot">
          <div className="portal-user">
            <span>{(profile.full_name || profile.email).slice(0, 2).toUpperCase()}</span>
            <div>
              <b>{profile.full_name || "Tawaf user"}</b>
              <small>{profile.email}</small>
            </div>
          </div>
          <button type="button" className="portal-signout" onClick={signOut} disabled={busy === "signout"}>
            <LogOut size={16} /> {locale === "en" ? "Sign out" : locale === "ar" ? "تسجيل الخروج" : "چوونە دەرەوە"}
          </button>
        </div>
      </aside>

      {mobileOpen && <button className="portal-scrim" type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}

      <section className="portal-main">
        <header className="portal-topbar">
          <div className="portal-topbar-title">
            <button className="portal-menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div>
              <small>{role === "admin" ? (locale === "en" ? "Tawaf marketplace" : locale === "ar" ? "سوق طواف" : "بازاڕی تەواف") : company?.name}</small>
              <b>{getLabel(page)}</b>
            </div>
          </div>
          <div className="portal-topbar-actions">
            <button type="button" aria-label={locale === "en" ? "Refresh workspace" : locale === "ar" ? "تحديث مساحة العمل" : "نوێکردنەوەی شوێنی کار"} onClick={() => loadPortal(true)} disabled={refreshing}>
              <RefreshCw className={refreshing ? "spin" : ""} size={17} />
            </button>
            <div className="portal-bell-wrap">
              <button type="button" className={bellOpen ? "is-open" : ""} aria-label={locale === "en" ? "Notifications" : locale === "ar" ? "الإشعارات" : "ئاگادارکردنەوەکان"} onClick={() => setBellOpen((open) => !open)}>
                <Bell size={17} />
                {totalNotifications > 0 && <i data-count={totalNotifications > 9 ? "9+" : totalNotifications}>{totalNotifications > 9 ? "9+" : totalNotifications}</i>}
              </button>
              {bellOpen && (
                <>
                  <button type="button" className="portal-bell-scrim" aria-label="Close notifications" onClick={() => setBellOpen(false)} />
                  <div className="portal-bell-menu" role="menu">
                    <header className="portal-bell-head">
                      <span className="portal-bell-head-icon"><Bell size={15} /></span>
                      <div className="portal-bell-head-text">
                        <b>{locale === "en" ? "Notifications" : locale === "ar" ? "الإشعارات" : "ئاگادارکردنەوەکان"}</b>
                        <small>
                          {attentionItems.length
                            ? (locale === "en" ? `${totalNotifications} need your attention` : locale === "ar" ? `${totalNotifications} بحاجة إلى انتباهك` : `${totalNotifications} پێویستیان بە سەرنجی تۆیە`)
                            : (locale === "en" ? "You're all caught up" : locale === "ar" ? "لقد اطلعت على كل شيء" : "هەموو شتێکت بینیوە")}
                        </small>
                      </div>
                    </header>
                    {attentionItems.length ? (
                      <div className="portal-bell-list">
                        {attentionItems.map((item) => {
                          const Icon = pageIcons[item.page] ?? Bell;
                          return (
                            <button
                              type="button"
                              role="menuitem"
                              key={item.id}
                              onClick={() => {
                                setBellOpen(false);
                                changePage(item.page);
                              }}
                            >
                              <span className="portal-bell-item-icon"><Icon size={16} /></span>
                              <span className="portal-bell-item-label">{item.label}</span>
                              <i className="portal-bell-item-count">{item.count}</i>
                              <ArrowRight className="portal-bell-item-arrow" size={15} />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="portal-bell-empty">
                        <CheckCircle2 size={26} />
                        <p>{locale === "en" ? "No new alerts right now." : locale === "ar" ? "لا توجد تنبيهات جديدة الآن." : "هیچ ئاگادارکردنەوەیەکی نوێ نییە."}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="portal-user-top">{(profile.full_name || profile.email).slice(0, 2).toUpperCase()}</div>
          </div>
        </header>

        <div className="portal-content">
          {error && (
            <div className="portal-alert error">
              <button
                type="button"
                className="portal-alert-close"
                onClick={() => setError("")}
                aria-label={locale === "ku" ? "داخستن" : locale === "ar" ? "إغلاق" : "Dismiss"}
              >
                <X size={16} />
              </button>
              <p>{error}</p>
              <button type="button" onClick={() => setError("")}>Dismiss</button>
            </div>
          )}

          {role === "admin" ? (
            <AdminPages
              page={page}
              data={data}
              busy={busy}
              runAction={runAction}
              askReason={askReason}
              goTo={changePage}
              locale={locale}
              changeLocale={changeLocale}
            />
          ) : company ? (
            <CompanyPages
              page={page}
              data={data}
              company={company}
              companies={companies}
              switchCompany={switchCompany}
              profile={profile}
              busy={busy}
              runAction={runAction}
              askReason={askReason}
              goTo={changePage}
              locale={locale}
              changeLocale={changeLocale}
            />
          ) : (
            <EmptyState
              icon={Building2}
              title="No company workspace"
              text="This agency account is not attached to a company yet. Contact a Tawaf administrator to finish the setup."
            />
          )}
        </div>
      </section>

      {toast && (
        <div className="portal-toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}

      {reasonDialog && (
        <ReasonDialog
          title={reasonDialog.title}
          locale={locale}
          optional={reasonDialog.optional}
          onCancel={() => closeReason(null)}
          onSubmit={(value) => closeReason(value)}
        />
      )}
    </main>
  );
}

function ReasonDialog({
  title,
  locale,
  optional,
  onCancel,
  onSubmit,
}: {
  title: string;
  locale: "ku" | "ar" | "en";
  optional?: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  useScrollLock();
  return (
    <div className="portal-reason-scrim" onClick={onCancel}>
      <form
        className="portal-reason-dialog"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reason-dialog-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (optional || value.trim()) onSubmit(value.trim());
        }}
      >
        <h2 id="reason-dialog-title">{title}</h2>
        <textarea
          autoFocus
          rows={3}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={locale === "en" ? "Write a clear reason…" : locale === "ar" ? "اكتب سبباً واضحاً…" : "هۆکارێکی ڕوون بنووسە…"}
        />
        <div className="portal-reason-actions">
          <button type="button" className="portal-secondary-button" onClick={onCancel}>
            {locale === "en" ? "Cancel" : locale === "ar" ? "إلغاء" : "پاشگەزبوونەوە"}
          </button>
          <button type="submit" className="portal-primary-button" disabled={!optional && !value.trim()}>
            {optional && !value.trim()
              ? (locale === "en" ? "Continue without note" : locale === "ar" ? "متابعة بدون ملاحظة" : "بەبێ تێبینی بەردەوام بە")
              : (locale === "en" ? "Confirm" : locale === "ar" ? "تأكيد" : "پشتڕاستکردنەوە")}
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminPages({
  page,
  data,
  busy,
  runAction,
  askReason,
  goTo,
  locale,
  changeLocale,
}: {
  page: PageId;
  data: PortalData;
  busy: string;
  runAction: RunAction;
  askReason: AskReason;
  goTo: (page: PageId) => void;
  locale: "ku" | "ar" | "en";
  changeLocale: (val: "ku" | "ar" | "en") => void;
}) {
  if (page === "companies") return <AdminCompanies data={data} busy={busy} runAction={runAction} askReason={askReason} locale={locale} />;
  if (page === "trips") return <TripsPage role="admin" data={data} busy={busy} runAction={runAction} askReason={askReason} locale={locale} />;
  if (page === "finance") return <FinancePage role="admin" data={data} busy={busy} runAction={runAction} locale={locale} />;
  if (page === "support") return <SupportPage data={data} busy={busy} runAction={runAction} locale={locale} />;
  if (page === "app") return <AppManagementWorkspace homeAds={data.homeAds} homeSections={data.homeSections} homeRank={data.homeRank} companies={data.companies} trips={data.trips} busy={busy} runAction={runAction} locale={locale} />;
  if (page === "more") return <AdminMore locale={locale} changeLocale={changeLocale} busy={busy} runAction={runAction} />;
  return <AdminOverview data={data} goTo={goTo} locale={locale} />;
}

function CompanyPages({
  page,
  data,
  company,
  companies,
  switchCompany,
  profile,
  busy,
  runAction,
  askReason,
  goTo,
  locale,
  changeLocale,
}: {
  page: PageId;
  data: PortalData;
  company: Company;
  companies: Company[];
  switchCompany: (id: string) => void;
  profile: Profile;
  busy: string;
  runAction: RunAction;
  askReason: AskReason;
  goTo: (page: PageId) => void;
  locale: "ku" | "ar" | "en";
  changeLocale: (val: "ku" | "ar" | "en") => void;
}) {
  if (page === "trips") return <CompanyTripsWorkspace company={company} trips={data.trips} changeRequests={data.tripChangeRequests} bookings={data.bookings} bookingTravellers={data.bookingTravellers} commissions={data.commissions} payments={data.payments} busy={busy} runAction={runAction} askReason={askReason} locale={locale} />;
  if (page === "bookings") return <BookingsPage role="agency" data={data} busy={busy} runAction={runAction} askReason={askReason} locale={locale} />;
  if (page === "messages") return <MessagesPage data={data} profile={profile} busy={busy} runAction={runAction} locale={locale} />;
  if (page === "finance") return <FinancePage role="agency" data={data} busy={busy} runAction={runAction} locale={locale} />;
  if (page === "more") return <CompanyProfile company={company} profile={profile} busy={busy} runAction={runAction} locale={locale} changeLocale={changeLocale} />;
  return <CompanyOverview data={data} company={company} companies={companies} switchCompany={switchCompany} goTo={goTo} locale={locale} busy={busy} runAction={runAction} />;
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="portal-page-heading">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {action}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "green",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone?: "green" | "gold" | "teal" | "sand";
  onClick?: () => void;
}) {
  return (
    <button type="button" className={`portal-metric ${tone}`} onClick={onClick} disabled={!onClick}>
      <span className="portal-metric-icon"><Icon size={19} /></span>
      <div className="portal-metric-value">{value}</div>
      <b>{label}</b>
      <small>{detail}</small>
      {onClick && <ArrowUpRight size={16} />}
    </button>
  );
}

function StatusPill({ status, locale }: { status: string; locale?: "ku" | "ar" | "en" }) {
  return <span className={`portal-status ${statusTone(status)}`}><i />{localizedCompanyStatus(status, locale)}</span>;
}

function AdminOverview({ data, goTo, locale }: { data: PortalData; goTo: (page: PageId) => void; locale: "ku" | "ar" | "en" }) {
  const t = dashboardTranslations[locale];
  const collected = data.commissions.filter((item) => item.status === "collected").reduce((sum, item) => sum + Number(item.amount_iqd), 0);
  const owed = data.commissions.filter((item) => item.status === "owed").reduce((sum, item) => sum + Number(item.amount_iqd), 0);
  const pendingCompanies = data.companies.filter((item) => companyVerificationState(item) === "pending");
  const pendingTrips = data.trips.filter((item) => item.lifecycle_status === "pending_review");
  const pendingChanges = data.tripChangeRequests.filter((item) => item.status === "pending");
  const requestedBookings = data.bookings.filter((item) => item.operational_stage === "requested");
  const openSupport = data.support.filter((item) => !item.status || item.status === "open");
  const hour = new Date().getHours();
  const greeting = hour < 12
    ? (locale === "ku" ? "بەیانیت باش، بەڕێوەبەر." : locale === "ar" ? "صباح الخير، يا مسؤول." : "Good morning, Admin.")
    : hour < 17
      ? (locale === "ku" ? "پاش نیوەڕۆت باش، بەڕێوەبەر." : locale === "ar" ? "طاب نهارك، يا مسؤول." : "Good afternoon, Admin.")
      : (locale === "ku" ? "ئێوارەت باش، بەڕێوەبەر." : locale === "ar" ? "مساء الخير، يا مسؤول." : "Good evening, Admin.");

  return (
    <>
      <PageHeading
        eyebrow={locale === "ku" ? "لێدانی پلاتفۆرم" : locale === "ar" ? "نبض المنصة" : "Platform pulse"}
        title={greeting}
        description={locale === "ku" ? "لێرەدا ئەوە نیشان دراوە کە پێویستی بە گرنگیپێدانی تۆ هەیە لە بازاڕی تەوافدا ئەمڕۆ." : locale === "ar" ? "إليك ما يحتاج إلى اهتمامك عبر سوق طواف اليوم." : "Here is what needs your attention across the Tawaf marketplace today."}
      />

      <section className="portal-metric-grid">
        <MetricCard icon={Building2} label={t.activeCompanies} value={`${data.companies.filter((item) => item.status === "active").length}`} detail={`${pendingCompanies.length} ${t.awaitingDecision}`} tone="green" onClick={() => goTo("companies")} />
        <MetricCard icon={Plane} label={t.marketplaceTrips} value={`${data.trips.length}`} detail={`${pendingTrips.length} ${t.pendingReview}`} tone="teal" onClick={() => goTo("trips")} />
        <MetricCard icon={TicketCheck} label={t.totalBookings} value={`${data.bookings.length}`} detail={`${requestedBookings.length} ${t.newRequests}`} tone="gold" onClick={() => goTo("trips")} />
        <MetricCard icon={CircleDollarSign} label={t.collectedRevenue} value={formatIqd(collected, true)} detail={`${formatIqd(owed, true)} ${t.stillOwed}`} tone="sand" onClick={() => goTo("finance")} />
      </section>

      <section className="portal-panel">
        <PanelHeader title={t.needsAttention} subtitle={t.itemsWaitingAction} />
        <div className="portal-attention-list">
          <AttentionItem icon={Building2} tone="gold" count={pendingCompanies.length} title={t.companyApplications} text={t.reviewBusinessDetails} onClick={() => goTo("companies")} />
          <AttentionItem icon={ClipboardCheck} tone="teal" count={pendingTrips.length + pendingChanges.length} title={t.tripsForReview} text={locale === "ku" ? `${pendingTrips.length} گەشتی نوێ · ${pendingChanges.length} داواکاری گۆڕانکاری` : locale === "ar" ? `${pendingTrips.length} رحلات جديدة · ${pendingChanges.length} طلبات تغيير` : `${pendingTrips.length} new trips · ${pendingChanges.length} change requests`} onClick={() => goTo("trips")} />
          <AttentionItem icon={BookOpenCheck} tone="sand" count={requestedBookings.length} title={t.bookingRequests} text={t.waitingCompanyRespond} onClick={() => goTo("trips")} />
          <AttentionItem icon={Headphones} tone="green" count={openSupport.length} title={t.supportMessages} text={t.unresolvedInInbox} onClick={() => goTo("support")} />
        </div>
      </section>
    </>
  );
}

// Owner-only: the whole reason a chain joins the platform is seeing its offices
// side by side. The workspace itself stays scoped to one branch — this is a
// read-only summary that also acts as a fast switcher.
function GroupRollupPanel({ companies, activeId, switchCompany, locale }: {
  companies: Company[];
  activeId: string;
  switchCompany: (id: string) => void;
  locale: "ku" | "ar" | "en";
}) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const [rows, setRows] = useState<Record<string, { bookings: number; value: number; pending: number }>>({});
  const [loading, setLoading] = useState(true);
  const ids = companies.map((item) => item.id).join(",");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      // RLS lets a group owner read every branch's bookings (owns_company walks
      // the parent), so one query covers the whole group.
      const { data } = await getSupabase()
        .from("bookings")
        .select("company_id, total_iqd, operational_stage")
        .in("company_id", companies.map((item) => item.id));
      if (!active) return;
      const next: Record<string, { bookings: number; value: number; pending: number }> = {};
      (data ?? []).forEach((row: any) => {
        const entry = next[row.company_id] ?? { bookings: 0, value: 0, pending: 0 };
        const dead = ["cancelled", "rejected", "expired"].includes(row.operational_stage);
        entry.bookings += 1;
        if (!dead) entry.value += Number(row.total_iqd) || 0;
        if (row.operational_stage === "requested") entry.pending += 1;
        next[row.company_id] = entry;
      });
      setRows(next);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [ids]);

  return (
    <section className="portal-panel" style={{ marginBottom: 15 }}>
      <PanelHeader
        title={tr("کۆی گروپ", "ملخص المجموعة", "Group overview")}
        subtitle={tr("هەموو لقەکان پێکەوە — کرتە بکە بۆ گۆڕین", "كل الفروع معاً — انقر للتبديل", "All offices side by side — click to switch")}
      />
      {loading ? <div style={{ padding: 16 }}><TawafLoadingSpinner size={18} /></div> : (
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr>
              <th>{tr("نووسینگە", "المكتب", "Office")}</th>
              <th>{tr("حیجزەکان", "الحجوزات", "Bookings")}</th>
              <th>{tr("داواکاری نوێ", "طلبات جديدة", "New requests")}</th>
              <th>{tr("بەها", "القيمة", "Value")}</th>
              <th>{tr("دۆخ", "الحالة", "Status")}</th>
            </tr></thead>
            <tbody>
              {companies.map((item) => {
                const row = rows[item.id] ?? { bookings: 0, value: 0, pending: 0 };
                return (
                  <tr key={item.id} className="portal-row-clickable" onClick={() => switchCompany(item.id)}>
                    <td>
                      <b>{item.name}{item.id === activeId && " ●"}</b>
                      <small className="portal-cell-sub">{item.parent_company_id ? (item.location || tr("لق", "فرع", "Branch")) : tr("نووسینگەی سەرەکی", "المكتب الرئيسي", "Head office")}</small>
                    </td>
                    <td>{row.bookings}</td>
                    <td>{row.pending || "—"}</td>
                    <td>{formatIqd(row.value, true)}</td>
                    <td><StatusPill status={item.is_active ? (item.verification_status || "approved") : "suspended"} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CompanyOverview({ data, company, companies, switchCompany, goTo, locale, busy, runAction }: { data: PortalData; company: Company; companies: Company[]; switchCompany: (id: string) => void; goTo: (page: PageId) => void; locale: "ku" | "ar" | "en"; busy: string; runAction: RunAction }) {
  const t = dashboardTranslations[locale];
  const activeTrips = data.trips.filter((item) => ["published", "pending_review"].includes(item.lifecycle_status));
  const pending = data.bookings.filter((item) => item.operational_stage === "requested");
  const confirmed = data.bookings.filter((item) => ["confirmed", "ready", "in_progress"].includes(item.operational_stage));
  const bookingValue = data.bookings.filter((item) => !["cancelled", "rejected", "expired"].includes(item.operational_stage)).reduce((sum, item) => sum + Number(item.total_iqd), 0);
  const received = data.payments.filter((item) => item.status === "succeeded").reduce((sum, item) => sum + Number(item.amount_iqd), 0);
  const nextTrip = [...data.trips].filter((item) => item.departure_date && new Date(item.departure_date) >= new Date() && ["published", "pending_review", "paused"].includes(item.lifecycle_status)).sort((a, b) => String(a.departure_date).localeCompare(String(b.departure_date)))[0];
  const tripsNeedingAction = data.trips.filter((item) => ["needs_changes", "rejected"].includes(item.lifecycle_status));
  const pendingChangeRequests = data.tripChangeRequests.filter((item) => item.status === "pending");

  // Translate verification status
  const canSubmitApplication = ["draft", "needs_changes", "rejected"].includes(company.verification_status);
  const getVerificationStatusLabel = (status: string) => {
    if (locale === "ku") {
      switch (status) {
        case "verified": return "پشتڕاستکراوە";
        case "pending": return "چاوەڕێی بڕیارە";
        case "needs_changes": return "پێویستی بە دەستکارییە";
        case "rejected": return "ڕەتکراوەتەوە";
        default: return status;
      }
    }
    if (locale === "ar") {
      switch (status) {
        case "verified": return "معتمد";
        case "pending": return "قيد الانتظار";
        case "needs_changes": return "بحاجة لتعديلات";
        case "rejected": return "مرفوض";
        default: return status;
      }
    }
    return titleCase(status);
  };

  return (
    <>
      <PageHeading
        eyebrow={company.is_verified ? t.verifiedTawafCompany : getVerificationStatusLabel(company.verification_status)}
        title={t.welcomeBack.replace("{name}", company.name)}
        description={t.companyOverviewDesc}
        action={<button className="portal-secondary-button" type="button" onClick={() => goTo("trips")}><Plus size={16} /> {t.manageTrips}</button>}
      />

      {!company.is_verified && (
        <div className="portal-verification-banner">
          {/* submit_company_application() accepts exactly these three states; it
              raises 'company cannot be submitted from %' for anything else. */}
          <span><ShieldCheck size={20} /></span>
          <div>
            <b>{t.companyVerificationStatus.replace("{status}", getVerificationStatusLabel(company.verification_status))}</b>
            <p>{company.verification_reason || (locale === "ku" ? "تەواف پێداچوونەوە بە زانیارییەکانی کۆمپانیاکەتدا دەکات. دەتوانیت گەشتەکان ئامادە بکەیت کاتێک پێداچوونەوەکە لە پرۆسەدایە." : locale === "ar" ? "يقوم طواف بمراجعة معلومات شركتك. يمكنك إعداد الرحلات أثناء عملية المراجعة." : "Tawaf is reviewing your company information. You can prepare trips while the review is in progress.")}</p>
          </div>
          {canSubmitApplication ? (
            <button
              type="button"
              className="approve"
              disabled={busy === `company-submit-${company.id}`}
              onClick={() => runAction(
                `company-submit-${company.id}`,
                () => getSupabase().rpc("submit_company_application", { p_company_id: company.id }),
                locale === "ku" ? "داواکارییەکەت نێردرا بۆ پێداچوونەوە." : locale === "ar" ? "تم إرسال طلبك للمراجعة." : "Your application was sent for review.",
              )}
            >
              {busy === `company-submit-${company.id}` ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />}
              {locale === "ku" ? "ناردن بۆ پێداچوونەوە" : locale === "ar" ? "إرسال للمراجعة" : "Submit for review"}
            </button>
          ) : (
            <button type="button" onClick={() => goTo("more")}>{t.viewCompanyProfile}</button>
          )}
        </div>
      )}

      {companies.length > 1 && (
        <GroupRollupPanel companies={companies} activeId={company.id} switchCompany={switchCompany} locale={locale} />
      )}

      <section className="portal-metric-grid">
        <MetricCard icon={Plane} label={t.activeTrips} value={`${activeTrips.length}`} detail={t.tripsTotal.replace("{count}", `${data.trips.length}`)} tone="green" onClick={() => goTo("trips")} />
        <MetricCard icon={Mail} label={t.newRequests} value={`${pending.length}`} detail={t.confirmedBookings.replace("{count}", `${confirmed.length}`)} tone="gold" onClick={() => goTo("bookings")} />
        <MetricCard icon={Banknote} label={t.bookingValue} value={formatIqd(bookingValue, true)} detail={t.acrossActiveBookings} tone="teal" onClick={() => goTo("finance")} />
        <MetricCard icon={WalletCards} label={t.paymentsReceived} value={formatIqd(received, true)} detail={t.commissionItems.replace("{count}", `${data.commissions.filter((item) => item.status === "owed").length}`)} tone="sand" onClick={() => goTo("finance")} />
      </section>

      <section className="portal-overview-grid">
        <article className="portal-next-trip">
          <div className="portal-next-trip-pattern" aria-hidden="true" />
          <span className="portal-next-label"><CalendarDays size={14} /> {t.nextDeparture}</span>
          {nextTrip ? (
            <>
              <h2>{nextTrip.title}</h2>
              <p>{nextTrip.days} {locale === "ku" ? "ڕۆژ" : locale === "ar" ? "يوم" : "days"} · {locale === "ku" ? (nextTrip.transport === "plane" ? "فڕۆکە" : "پاس") : locale === "ar" ? (nextTrip.transport === "plane" ? "طائرة" : "حافلة") : titleCase(nextTrip.transport)} · {nextTrip.acc_stars} {locale === "ku" ? "ئەستێرە" : locale === "ar" ? "نجوم" : "star"}</p>
              <div className="portal-next-trip-meta">
                <div><small>{t.departure}</small><b>{formatDate(nextTrip.departure_date, true)}</b></div>
                <div><small>{t.travellers}</small><b>{nextTrip.seats_reserved ?? 0} / {nextTrip.capacity ?? "—"}</b></div>
                <div><small>{t.status}</small><StatusPill status={nextTrip.lifecycle_status} /></div>
              </div>
              <button type="button" onClick={() => goTo("trips")}>{t.openTripOperations} <ArrowRight size={15} /></button>
            </>
          ) : (
            <div className="portal-next-empty">
              <h2>{t.noDepartureScheduled}</h2>
              <p>{t.createTripDraft}</p>
              <button type="button" onClick={() => goTo("trips")}>{t.createFirstTrip} <ArrowRight size={15} /></button>
            </div>
          )}
        </article>

        <article className="portal-panel">
          <PanelHeader title={t.operationsHealth} subtitle={t.whatTeamShouldHandle} />
          <div className="portal-attention-list">
            <AttentionItem icon={Mail} tone="gold" count={pending.length} title={t.bookingRequests} text={t.waitingCompanyRespond} onClick={() => goTo("bookings")} />
            <AttentionItem icon={FileCheck2} tone="teal" count={data.bookings.filter((item) => item.operational_stage === "needs_information").length} title={t.informationNeeded} text={t.travellersIncomplete} onClick={() => goTo("bookings")} />
            <AttentionItem icon={AlertTriangle} tone="sand" count={tripsNeedingAction.length} title={locale === "ku" ? "گەشتەکان پێویستیان بە چاککردنە" : locale === "ar" ? "رحلات تحتاج إلى تعديل" : "Trips needing fixes"} text={locale === "ku" ? "تەواف داوای گۆڕانکاری کردووە یان ڕەتی کردووەتەوە" : locale === "ar" ? "طلب طواف تعديلات أو رفض الرحلة" : "Tawaf requested changes or rejected the trip"} onClick={() => goTo("trips")} />
            <AttentionItem icon={ClipboardCheck} tone="teal" count={pendingChangeRequests.length} title={locale === "ku" ? "داواکاری لە چاوەڕوانیدا" : locale === "ar" ? "طلبات بانتظار طواف" : "Requests awaiting Tawaf"} text={locale === "ku" ? "گۆڕانکارییەکانت لە چاوەڕوانی پەسەندکردنی بەڕێوەبەردان" : locale === "ar" ? "تغييراتك بانتظار موافقة المشرف" : "Your submitted changes are waiting for admin approval"} onClick={() => goTo("trips")} />
            <AttentionItem icon={Plane} tone="teal" count={data.bookings.filter((item) => item.operational_stage === "in_progress").length} title={locale === "ku" ? "لە گەشتدان ئێستا" : locale === "ar" ? "في الرحلة الآن" : "Travelling now"} text={locale === "ku" ? "گەشتیارانی سەر زەوی — دوای گەڕانەوە خۆکارانە تەواو دەکرێن" : locale === "ar" ? "معتمرون على الأرض — تُغلق تلقائياً بعد العودة" : "Pilgrims on the ground — closed automatically after the return date"} onClick={() => goTo("bookings")} />
            <AttentionItem icon={MessageSquareText} tone="green" count={data.inquiries.filter((item) => item.status !== "closed").length} title={t.openConversations} text={t.pilgrimInquiriesReply} onClick={() => goTo("messages")} />
          </div>
        </article>
      </section>
    </>
  );
}

function AdminCompanies({ data, busy, runAction, askReason, locale }: { data: PortalData; busy: string; runAction: RunAction; askReason: AskReason; locale: "ku" | "ar" | "en" }) {
  const t = dashboardTranslations[locale];
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const [filter, setFilter] = useState<"all" | CompanyVerificationState>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [listPage, setListPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A trip opened from inside the company drawer. Stacks on top of the drawer
  // so the admin keeps their place in the company they were reviewing.
  const [drilledTrip, setDrilledTrip] = useState<Trip | null>(null);
  const selected = data.companies.find((item) => item.id === selectedId) ?? null;
  const ownerById = useMemo(() => new Map(data.companyOwners.map((owner) => [owner.id, owner])), [data.companyOwners]);

  const analytics = useMemo(() => {
    const lastActivity = new Map<string, number>();
    const bookingValue = new Map<string, number>();
    data.companies.forEach((company) => lastActivity.set(company.id, new Date(company.created_at).getTime()));
    const recordActivity = (companyId: string, createdAt: string) => {
      const timestamp = new Date(createdAt).getTime();
      if (Number.isFinite(timestamp)) lastActivity.set(companyId, Math.max(lastActivity.get(companyId) ?? 0, timestamp));
    };
    data.trips.forEach((item) => recordActivity(item.company_id, item.created_at));
    data.bookings.forEach((item) => {
      recordActivity(item.company_id, item.created_at);
      if (!["cancelled", "rejected", "expired"].includes(item.operational_stage)) {
        bookingValue.set(item.company_id, (bookingValue.get(item.company_id) ?? 0) + Number(item.total_iqd || 0));
      }
    });
    data.payments.forEach((item) => recordActivity(item.company_id, item.created_at));
    const tripCount = new Map<string, number>();
    data.trips.forEach((item) => tripCount.set(item.company_id, (tripCount.get(item.company_id) ?? 0) + 1));
    return { lastActivity, bookingValue, tripCount };
  }, [data]);

  const counts = useMemo(() => {
    const result: Record<"all" | CompanyVerificationState, number> = {
      all: data.companies.length,
      pending: 0,
      needs_changes: 0,
      approved: 0,
      suspended: 0,
      rejected: 0,
    };
    data.companies.forEach((company) => { result[companyVerificationState(company)] += 1; });
    return result;
  }, [data.companies]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const companies = data.companies.filter((item) => {
    const owner = ownerById.get(item.owner_id);
    const searchable = [
      item.name,
      item.name_ar,
      item.name_en,
      item.location,
      item.license_number,
      item.phone,
      item.whatsapp,
      item.owner_id,
      owner?.full_name,
      owner?.phone,
      item.id,
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return (!normalizedQuery || searchable.includes(normalizedQuery))
      && (filter === "all" || companyVerificationState(item) === filter);
  }).sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, locale);
    if (sort === "rating") return Number(b.rating ?? 0) - Number(a.rating ?? 0);
    if (sort === "activity") return (analytics.lastActivity.get(b.id) ?? 0) - (analytics.lastActivity.get(a.id) ?? 0);
    if (sort === "booking_value") return (analytics.bookingValue.get(b.id) ?? 0) - (analytics.bookingValue.get(a.id) ?? 0);
    if (sort === "completion") return companyProfileCompletion(b) - companyProfileCompletion(a);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(companies.length / pageSize));
  const safePage = Math.min(listPage, totalPages);
  const visibleCompanies = companies.slice((safePage - 1) * pageSize, safePage * pageSize);

  function changeFilter(next: "all" | CompanyVerificationState) {
    setFilter(next);
    setListPage(1);
  }

  async function review(company: Company, decision: "approved" | "rejected" | "needs_changes" | "suspended") {
    let reason: string | null = null;
    if (decision !== "approved") {
      reason = await askReason(decision === "rejected" ? (locale === "ku" ? "هۆکاری ڕەتکردنەوەی ئەم کۆمپانیایە:" : locale === "ar" ? "سبب رفض هذه الشركة:" : "Reason for rejecting this company:") : decision === "suspended" ? (locale === "ku" ? "هۆکاری ڕاگرتنی ئەم کۆمپانیایە:" : locale === "ar" ? "سبب تعليق هذه الشركة:" : "Reason for suspending this company:") : (locale === "ku" ? "کۆمپانیاکە چی دەستکاری بکات؟" : locale === "ar" ? "ما الذي يجب على الشركة تعديله؟" : "What should the company change?"));
      if (!reason) return;
    }
    await runAction(
      `company-${company.id}-${decision}`,
      () => getSupabase().rpc("review_company_application", { p_company_id: company.id, p_decision: decision, p_reason: reason }),
      decision === "approved" ? (locale === "ku" ? `${company.name} ئێستا پەسەندکرا.` : locale === "ar" ? `${company.name} مقبول الآن.` : `${company.name} is now approved.`) : (locale === "ku" ? `بڕیاری پێداچوونەوە نێردرا بۆ ${company.name}.` : locale === "ar" ? `تم إرسال قرار المراجعة إلى ${company.name}.` : `Review decision sent to ${company.name}.`),
    );
  }

  return (
    <>
      <PageHeading eyebrow={locale === "ku" ? "ڕێکخستنی بازاڕ" : locale === "ar" ? "حوكمة السوق" : "Marketplace governance"} title={t.adminCompaniesTitle} description={t.adminCompaniesDesc} />
      <section className="portal-company-metrics" aria-label={tr("پوختەی دۆخی کۆمپانیاکان", "ملخص حالات الشركات", "Company status summary")}>
        {([
          ["all", Building2, "neutral", tr("هەموو کۆمپانیاکان", "جميع الشركات", "All companies")],
          ["pending", Clock3, "warning", tr("چاوەڕێی پێداچوونەوە", "بانتظار المراجعة", "Pending review")],
          ["needs_changes", FileText, "gold", tr("گۆڕانکاری پێویستە", "تعديلات مطلوبة", "Changes requested")],
          ["approved", BadgeCheck, "positive", tr("پەسەندکراو", "معتمدة", "Approved")],
          ["suspended", AlertTriangle, "danger", tr("ڕاگیراو", "معلقة", "Suspended")],
          ["rejected", X, "negative", tr("ڕەتکراوە", "مرفوضة", "Rejected")],
        ] as Array<["all" | CompanyVerificationState, LucideIcon, string, string]>).map(([id, Icon, tone, label]) => (
          <button key={id} type="button" className={filter === id ? "is-active" : ""} onClick={() => changeFilter(id)} aria-pressed={filter === id}>
            <span className={tone}><Icon size={17} /></span>
            <p><b>{counts[id]}</b><small>{label}</small></p>
          </button>
        ))}
      </section>
      <div className="portal-toolbar portal-company-toolbar">
        <label>
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setListPage(1); }}
            placeholder={tr("گەڕان بە ناو، خاوەن، مۆڵەت، تەلەفۆن یان شار...", "البحث بالاسم أو المالك أو الترخيص أو الهاتف أو المدينة...", "Search name, owner, licence, phone or city…")}
            aria-label={tr("گەڕان بۆ کۆمپانیا", "البحث عن شركة", "Search companies")}
          />
        </label>
        <div className="portal-filter-row" aria-label={tr("فلتەری دۆخ", "تصفية الحالة", "Status filter")}>
          <Filter size={15} />
          {([
            ["all", tr("هەموو", "الكل", "All")],
            ["pending", tr("چاوەڕێ", "قيد المراجعة", "Pending")],
            ["needs_changes", tr("گۆڕانکاری", "تعديلات", "Changes")],
            ["approved", tr("پەسەندکراو", "معتمدة", "Approved")],
            ["suspended", tr("ڕاگیراو", "معلقة", "Suspended")],
            ["rejected", tr("ڕەتکراوە", "مرفوضة", "Rejected")],
          ] as Array<["all" | CompanyVerificationState, string]>).map(([id, label]) => (
            <button type="button" key={id} className={filter === id ? "active" : ""} onClick={() => changeFilter(id)}>{label}</button>
          ))}
        </div>
        <label className="portal-sort-control">
          <span>{tr("ڕیزکردن", "ترتيب", "Sort")}</span>
          <select value={sort} onChange={(event) => { setSort(event.target.value); setListPage(1); }} aria-label={tr("ڕیزکردنی کۆمپانیاکان", "ترتيب الشركات", "Sort companies")}>
            <option value="newest">{tr("نوێترین", "الأحدث", "Newest")}</option>
            <option value="activity">{tr("دوایین چالاکی", "آخر نشاط", "Last activity")}</option>
            <option value="completion">{tr("تەواوی پڕۆفایل", "اكتمال الملف", "Profile completion")}</option>
            <option value="booking_value">{tr("بەهای حیجز", "قيمة الحجوزات", "Booking value")}</option>
            <option value="rating">{tr("هەڵسەنگاندن", "التقييم", "Rating")}</option>
            <option value="name">{tr("ناو", "الاسم", "Name")}</option>
          </select>
        </label>
      </div>
      <section className="portal-panel portal-collection-panel">
        <PanelHeader title={`${companies.length} ${locale === "ku" ? "کۆمپانیا" : locale === "ar" ? "شركات" : "companies"}`} subtitle={locale === "ku" ? "دۆخی پشتڕاستکردنەوە و بازاڕی کۆمپانیا" : locale === "ar" ? "التحقق المباشر من الشركة وحالة السوق" : "Live company verification and marketplace status"} />
        {companies.length ? (
          <>
            {/* One grid for every width, replacing the desktop table plus the
                separate .portal-company-mobile-list that duplicated all of this
                markup with a different subset of the same fields. */}
            <div className="portal-company-grid">
              {visibleCompanies.map((company) => {
                const state = companyVerificationState(company);
                const completion = companyProfileCompletion(company);
                const owner = ownerById.get(company.owner_id);
                const parent = company.parent_company_id
                  ? data.companies.find((item) => item.id === company.parent_company_id)?.name ?? "—"
                  : null;
                const lastActivity = new Date(analytics.lastActivity.get(company.id) ?? new Date(company.created_at).getTime()).toISOString();
                // Pending and needs_changes are the admin's actual queue, so
                // they carry the accent. Everything else is reference.
                const needsReview = state === "pending" || state === "needs_changes";
                return (
                  <article
                    className={`portal-company-tile${needsReview ? " needs-review" : ""}`}
                    key={company.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(company.id)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(company.id); } }}
                  >
                    <header className="portal-company-tile-head">
                      <span className={`portal-company-logo${company.logo_url ? " has-image" : ""}`}>
                        <Building2 size={18} />
                        {company.logo_url && <img src={company.logo_url} alt="" loading="lazy" onError={(event) => { event.currentTarget.closest(".portal-company-logo")?.classList.remove("has-image"); }} />}
                      </span>
                      <div>
                        <b>{company.name}</b>
                        <small>
                          <MapPin size={11} /> {company.location || tr("شوێن دیاری نەکراوە", "الموقع غير محدد", "Location not set")}
                          {parent && <> · {tr("لقی", "فرع", "Branch of")} {parent}</>}
                        </small>
                      </div>
                    </header>

                    <div className="portal-company-badges">
                      <StatusPill status={state} locale={locale} />
                      {company.is_promoted && <span className="portal-company-promoted"><Star size={11} fill="currentColor" /> {tr("پرۆمۆت", "مروّجة", "Promoted")}</span>}
                    </div>

                    {/* Completion is the thing an admin acts on for a pending
                        application, so it gets a full-width bar rather than the
                        94px chip the table cell used. */}
                    <div className="portal-company-completion">
                      <span>{tr("تەواوی پڕۆفایل", "اكتمال الملف", "Profile completion")}</span>
                      <small>{completion}%</small>
                      <i><b className={completion < 70 ? "is-low" : undefined} style={{ width: `${completion}%` }} /></i>
                    </div>

                    <div className="portal-company-stats">
                      <div><small>{tr("گەشتەکان", "الرحلات", "Trips")}</small><b>{analytics.tripCount.get(company.id) ?? 0}</b></div>
                      <div><small>{tr("بەهای حیجز", "قيمة الحجوزات", "Booking value")}</small><b dir="ltr">{formatIqd(analytics.bookingValue.get(company.id) ?? 0, true)}</b></div>
                      <div><small>{tr("هەڵسەنگاندن", "التقييم", "Rating")}</small><b>{company.rating ? `${Number(company.rating).toFixed(1)} (${company.reviews ?? 0})` : "—"}</b></div>
                    </div>

                    <ul className="portal-company-meta">
                      <li><UserRound size={12} /> {owner?.full_name || tr("خاوەن دیاری نەکراوە", "المالك غير محدد", "Owner not set")}{company.phone && <em dir="ltr">{company.phone}</em>}</li>
                      <li><ShieldCheck size={12} /> {company.license_number ? `${tr("مۆڵەت", "ترخيص", "Licence")} ${company.license_number}` : tr("ژمارەی مۆڵەت نییە", "لا يوجد رقم ترخيص", "No licence number")}</li>
                      <li><Clock3 size={12} /> {tr("دوایین چالاکی", "آخر نشاط", "Last activity")} {formatDate(lastActivity, true)}</li>
                    </ul>

                    <div className="portal-card-actions" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="portal-review-button" onClick={() => setSelectedId(company.id)}>
                        <ClipboardCheck size={14} /> {state === "pending" ? tr("پێداچوونەوەی داواکاری", "مراجعة الطلب", "Review application") : tr("کردنەوەی پڕۆفایل", "فتح الملف", "Open profile")}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {totalPages > 1 && (
              <nav className="portal-pagination" aria-label={tr("لاپەڕەکانی کۆمپانیا", "صفحات الشركات", "Company pages")}>
                <span>{tr(`لاپەڕەی ${safePage} لە ${totalPages}`, `الصفحة ${safePage} من ${totalPages}`, `Page ${safePage} of ${totalPages}`)}</span>
                <div>
                  <button type="button" onClick={() => setListPage((value) => Math.max(1, value - 1))} disabled={safePage === 1} aria-label={tr("لاپەڕەی پێشوو", "الصفحة السابقة", "Previous page")}><ChevronLeft size={15} /></button>
                  <button type="button" onClick={() => setListPage((value) => Math.min(totalPages, value + 1))} disabled={safePage === totalPages} aria-label={tr("لاپەڕەی دواتر", "الصفحة التالية", "Next page")}><ArrowRight size={15} /></button>
                </div>
              </nav>
            )}
          </>
        ) : <EmptyState icon={Building2} title={t.noCompaniesFound} text={tr("گەڕانێکی تر تاقی بکەرەوە یان فلتەرەکە بگۆڕە.", "حاول البحث بكلمات أخرى أو تغيير الفلاتر.", "Try another search or filter.")} compact />}
      </section>
      {selected && (
        <CompanyDetailDrawer
          company={selected}
          data={data}
          busy={busy}
          runAction={runAction}
          locale={locale}
          onClose={() => setSelectedId(null)}
          onReview={(decision) => review(selected, decision)}
          onTogglePromoted={() => runAction(
            `company-${selected.id}-promote`,
            () => getSupabase().rpc("admin_set_company_promoted", { p_company_id: selected.id, p_value: !selected.is_promoted }),
            selected.is_promoted
              ? (locale === "ku" ? "پرۆمۆشنی کۆمپانیا لابرا." : locale === "ar" ? "تمت إزالة ترويج الشركة." : "Company promotion removed.")
              : (locale === "ku" ? "کۆمپانیا پرۆمۆت کرا لە بازاڕدا." : locale === "ar" ? "تم ترويج الشركة في السوق." : "Company is now promoted in the marketplace."),
          )}
          onOpenTrip={setDrilledTrip}
        />
      )}
      {drilledTrip && (
        <TripDetailModal
          trip={drilledTrip}
          companyName={data.companies.find((item) => item.id === drilledTrip.company_id)?.name ?? "Tawaf company"}
          data={data}
          locale={locale}
          role="admin"
          busy={busy}
          runAction={runAction}
          askReason={askReason}
          onReview={(decision) => reviewTripDecision(drilledTrip, decision, { runAction, askReason, locale })}
          onClose={() => setDrilledTrip(null)}
        />
      )}
    </>
  );
}

// Admin-only. resolve_commission_rate() already resolves offer override ->
// agency override -> 5% platform default, but until now the agency tier could
// only be changed with raw SQL. This is the missing control surface, plus the
// audit trail for this company so a rate change is never unexplained.
function CompanyCommercialPanel({ company, busy, runAction, locale, activeTab }: {
  company: Company;
  busy: string;
  runAction: RunAction;
  locale: "ku" | "ar" | "en";
  activeTab: "overview" | "verification" | "commercial" | "activity";
}) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const [tier, setTier] = useState("standard");
  const [percent, setPercent] = useState("5");
  const [loaded, setLoaded] = useState(false);
  const [activity, setActivity] = useState<Array<{ id: string; action: string; reason: string | null; created_at: string; actor_role: string | null }>>([]);
  const savingKey = `commercial-${company.id}`;

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = getSupabase();
      const [settings, logs] = await Promise.all([
        supabase.from("agency_commercial_settings").select("commission_tier, commission_rate").eq("agency_id", company.id).maybeSingle(),
        supabase.from("audit_logs").select("id, action, reason, created_at, actor_role").eq("entity_id", company.id).order("created_at", { ascending: false }).limit(8),
      ]);
      if (!active) return;
      if (settings.data) {
        setTier(settings.data.commission_tier ?? "standard");
        setPercent(((Number(settings.data.commission_rate) || 0) * 100).toFixed(2).replace(/\.?0+$/, ""));
      }
      setActivity((logs.data ?? []) as typeof activity);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [company.id]);

  async function save() {
    const rate = Number(percent) / 100;
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) return;
    const { data: auth } = await getSupabase().auth.getUser();
    await runAction(
      savingKey,
      () => getSupabase().from("agency_commercial_settings").upsert({
        agency_id: company.id,
        commission_tier: tier,
        commission_rate: rate,
        updated_by: auth.user?.id ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "agency_id" }),
      tr("ڕێژەی کۆمسیۆن نوێکرایەوە.", "تم تحديث نسبة العمولة.", "Commission rate updated."),
    );
  }

  return (
    <>
      {activeTab === "commercial" && <section>
        <h3>{tr("ڕێککەوتنی بازرگانی", "الإعدادات التجارية", "Commercial terms")}</h3>
        {!loaded ? <TawafLoadingSpinner size={16} /> : (
          <>
            <div className="portal-commercial-row">
              <label>
                <small>{tr("پلە", "الفئة", "Tier")}</small>
                <select value={tier} onChange={(event) => setTier(event.target.value)}>
                  <option value="standard">{tr("ئاسایی", "قياسي", "Standard")}</option>
                  <option value="preferred">{tr("تایبەت", "مفضّل", "Preferred")}</option>
                  <option value="custom">{tr("دەستنیشانکراو", "مخصص", "Custom")}</option>
                </select>
              </label>
              <label>
                <small>{tr("ڕێژە %", "النسبة %", "Rate %")}</small>
                <input type="number" min={0} max={100} step={0.25} value={percent} onChange={(event) => setPercent(event.target.value)} />
              </label>
              <button type="button" className="portal-secondary-button" onClick={save} disabled={busy === savingKey}>
                {busy === savingKey ? <TawafLoadingSpinner size={14} /> : <Check size={14} />} {tr("پاشەکەوت", "حفظ", "Save")}
              </button>
            </div>
            <p className="portal-commercial-note">
              {tr(
                "بەبێ ڕێککەوتنی تایبەت، ٥٪ی بنەڕەتیی پلاتفۆرم جێبەجێ دەکرێت. ڕێژەی هەر گەشتێک لەسەرەوەی ئەمە دەبێت.",
                "بدون إعداد خاص تُطبَّق نسبة المنصة الافتراضية ٥٪. تجاوز الرحلة المفردة له الأولوية على هذا.",
                "Without an override the 5% platform default applies. A per-trip override still takes precedence over this.",
              )}
            </p>
          </>
        )}
      </section>}

      {activeTab === "activity" && (
        <section>
          <h3>{tr("چالاکی", "السجل", "Activity")}</h3>
          {!loaded ? <TawafLoadingSpinner size={16} /> : activity.length ? (
            <ul className="portal-activity-list">
              {activity.map((row) => (
                <li key={row.id}>
                  <b>{titleCase(row.action)}</b>
                  <small>{row.actor_role ? `${titleCase(row.actor_role)} · ` : ""}{relativeTime(row.created_at)}</small>
                  {row.reason && <p>{row.reason}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="portal-commercial-note">{tr("هێشتا هیچ چالاکییەک تۆمار نەکراوە.", "لم يتم تسجيل أي نشاط بعد.", "No activity has been recorded yet.")}</p>
          )}
        </section>
      )}
    </>
  );
}

function CompanyDetailDrawer({
  company,
  data,
  busy,
  runAction,
  locale,
  onClose,
  onReview,
  onTogglePromoted,
  onOpenTrip,
}: {
  company: Company;
  data: PortalData;
  busy: string;
  runAction: RunAction;
  locale: "ku" | "ar" | "en";
  onClose: () => void;
  onReview: (decision: "approved" | "rejected" | "needs_changes" | "suspended") => void;
  onTogglePromoted: () => void;
  onOpenTrip: (trip: Trip) => void;
}) {
  useScrollLock();
  const t = dashboardTranslations[locale];
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const state = companyVerificationState(company);
  const [activeTab, setActiveTab] = useState<"overview" | "trips" | "verification" | "commercial" | "activity">(state === "pending" ? "verification" : "overview");
  const [confirmingApproval, setConfirmingApproval] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const trips = data.trips.filter((item) => item.company_id === company.id);
  const bookings = data.bookings.filter((item) => item.company_id === company.id);
  const owner = data.companyOwners.find((item) => item.id === company.owner_id);
  const bookingValue = bookings.filter((item) => !["cancelled", "rejected", "expired"].includes(item.operational_stage)).reduce((sum, item) => sum + Number(item.total_iqd), 0);
  const commissionOwed = data.commissions.filter((item) => item.company_id === company.id && item.status === "owed").reduce((sum, item) => sum + Number(item.amount_iqd), 0);
  const completion = companyProfileCompletion(company);
  const isPending = ["pending", "needs_changes"].includes(state);
  const isRejected = state === "rejected";
  const isSuspended = state === "suspended";
  // Promotion only affects the marketplace for companies the app actually
  // surfaces (approved + active). Anything else can't be promoted meaningfully,
  // so we don't offer the toggle there — it would be a no-op for clients.
  const canPromote = state === "approved";
  const rowBusy = busy.startsWith(`company-${company.id}`);
  const notProvided = tr("دابین نەکراوە", "غير متوفر", "Not provided");
  const duplicateLicence = Boolean(company.license_number && data.companies.some((item) => item.id !== company.id && item.license_number?.trim().toLocaleLowerCase() === company.license_number?.trim().toLocaleLowerCase()));
  const duplicatePhone = Boolean(company.phone && data.companies.some((item) => item.id !== company.id && item.phone?.replace(/\D/g, "") === company.phone?.replace(/\D/g, "")));
  const reviewSignals = [
    !company.license_number ? tr("ژمارەی مۆڵەت دابین نەکراوە.", "رقم الترخيص غير متوفر.", "No licence number was provided.") : "",
    duplicateLicence ? tr("هەمان ژمارەی مۆڵەت لە کۆمپانیایەکی تردا بەکارهاتووە.", "رقم الترخيص مستخدم لدى شركة أخرى.", "This licence number is also used by another company.") : "",
    duplicatePhone ? tr("هەمان ژمارەی تەلەفۆن لە کۆمپانیایەکی تردا بەکارهاتووە.", "رقم الهاتف مستخدم لدى شركة أخرى.", "This phone number is also used by another company.") : "",
    completion < 70 ? tr("پڕۆفایلی کۆمپانیا لە ٧٠٪ کەمتر تەواوە.", "اكتمال ملف الشركة أقل من ٧٠٪.", "The company profile is less than 70% complete.") : "",
  ].filter(Boolean);
  const checklist = [
    {
      label: tr("ناسنامەی بازرگانی", "الهوية التجارية", "Business identity"),
      complete: Boolean(company.name && company.license_number),
      detail: tr("ناوی بازرگانی و ژمارەی مۆڵەت", "الاسم التجاري ورقم الترخيص", "Trading name and licence number"),
    },
    {
      label: tr("زانیاری پەیوەندی", "معلومات الاتصال", "Contact information"),
      complete: Boolean(company.phone && company.location && company.office_address),
      detail: tr("تەلەفۆن، شار و ناونیشانی نووسینگە", "الهاتف والمدينة وعنوان المكتب", "Phone, city and office address"),
    },
    {
      label: tr("پڕۆفایلی بازاڕ", "ملف السوق", "Marketplace profile"),
      complete: Boolean(company.about && company.logo_url && company.banner_url),
      detail: tr("پێناسە، لۆگۆ و وێنەی غلاف", "الوصف والشعار وصورة الغلاف", "Description, logo and cover image"),
    },
    {
      label: tr("زانیاری کارکردن", "معلومات التشغيل", "Operating information"),
      complete: Boolean(company.office_hours && company.accepted_payment_methods?.length),
      detail: tr("کاتەکانی کار و شێوازی پارەدان", "ساعات العمل وطرق الدفع", "Office hours and payment methods"),
    },
  ];

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  function handleDrawerKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !drawerRef.current) return;
    const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]"))
      .filter((element) => !element.hasAttribute("hidden"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function confirmApproval() {
    setConfirmingApproval(false);
    onReview("approved");
  }

  return (
    <div className="portal-drawer-scrim" onClick={onClose}>
      <aside
        ref={drawerRef}
        className="portal-drawer"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDrawerKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`company-drawer-title-${company.id}`}
      >
        <header className="portal-drawer-head" style={company.banner_url ? { backgroundImage: `linear-gradient(rgba(5,45,36,.55), rgba(5,45,36,.75)), url("${company.banner_url}")` } : undefined}>
          <button ref={closeRef} type="button" className="portal-drawer-close" onClick={onClose} aria-label={tr("داخستنی وردەکاری", "إغلاق التفاصيل", "Close details")}><X size={17} /></button>
          <div className="portal-company-avatar large">
            {company.logo_url ? <img src={company.logo_url} alt="" /> : company.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 id={`company-drawer-title-${company.id}`}>{company.name}</h2>
            <p>{company.location || notProvided} · {locale === "ku" ? "بەشداربووە" : locale === "ar" ? "انضمت في" : "Joined"} {formatDate(company.created_at, true)}</p>
          </div>
          <div className="portal-drawer-badges">
            <StatusPill status={state} locale={locale} />
            {company.is_promoted && <span className="portal-status positive"><i />{locale === "ku" ? "پرۆمۆتکراو" : locale === "ar" ? "مروَّجة" : "Promoted"}</span>}
          </div>
        </header>

        <nav className="portal-drawer-tabs" role="tablist" aria-label={tr("بەشەکانی پڕۆفایلی کۆمپانیا", "أقسام ملف الشركة", "Company profile sections")}>
          {([
            ["overview", tr("پوختە", "نظرة عامة", "Overview")],
            ["trips", `${tr("گەشتەکان", "الرحلات", "Trips")} (${trips.length})`],
            ["verification", tr("پشتڕاستکردنەوە", "التحقق", "Verification")],
            ["commercial", tr("بازرگانی", "تجاري", "Commercial")],
            ["activity", tr("چالاکی", "النشاط", "Activity")],
          ] as Array<[typeof activeTab, string]>).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>{label}</button>
          ))}
        </nav>

        <div className="portal-drawer-body">
          {company.verification_reason && (
            <p className="portal-drawer-reason"><AlertTriangle size={14} /> {company.verification_reason}</p>
          )}

          {activeTab === "overview" && (
            <>
              <div className="portal-drawer-stats">
                <div><b>{trips.length}</b><small>{tr("گەشتەکان", "الرحلات", "Trips")}</small></div>
                <div><b>{bookings.length}</b><small>{tr("حیجزەکان", "الحجوزات", "Bookings")}</small></div>
                <div><b>{formatIqd(bookingValue, true)}</b><small>{t.bookingValue}</small></div>
                <div><b>{formatIqd(commissionOwed, true)}</b><small>{tr("کۆمسیۆنی ماوە", "عمولة مستحقة", "Commission owed")}</small></div>
              </div>

              <section>
                <h3>{tr("زانیاری پەیوەندی", "معلومات الاتصال", "Contact information")}</h3>
                <ul className="portal-drawer-facts">
                  <li><PhoneCall size={14} /><span>{company.phone || notProvided}</span></li>
                  <li><MessageSquareText size={14} /><span>{company.whatsapp || notProvided} (WhatsApp)</span></li>
                  <li><MapPin size={14} /><span>{company.office_address || notProvided}</span></li>
                  <li><Clock3 size={14} /><span>{company.office_hours || notProvided}</span></li>
                </ul>
              </section>

              <section>
                <h3>{tr("زانیاری بازرگانی", "معلومات العمل", "Business details")}</h3>
                <ul className="portal-drawer-facts">
                  <li><FileCheck2 size={14} /><span>{tr("ژمارەی مۆڵەت:", "رقم الترخيص:", "Licence:")} {company.license_number || notProvided}</span></li>
                  <li><CalendarDays size={14} /><span>{tr("دامەزراوە لە", "تأسست في", "Established")} {company.since ?? notProvided}</span></li>
                  <li><Star size={14} /><span>{Number(company.rating ?? 0).toFixed(1)} · {company.reviews ?? 0} {tr("هەڵسەنگاندن", "تقييمات", "reviews")}</span></li>
                  <li><CreditCard size={14} /><span>{(company.accepted_payment_methods ?? []).map(titleCase).join(", ") || notProvided}</span></li>
                </ul>
                {(company.tags ?? []).length > 0 && (
                  <div className="portal-drawer-tags">{(company.tags ?? []).map((tag) => <span key={tag}>{tag}</span>)}</div>
                )}
              </section>

              {company.about && (
                <section>
                  <h3>{tr("دەربارە", "نبذة", "About")}</h3>
                  <p className="portal-drawer-about">{company.about}</p>
                </section>
              )}
            </>
          )}

          {activeTab === "trips" && (
            <section>
              <h3>{tr("گەشتەکانی ئەم کۆمپانیایە", "رحلات هذه الشركة", "Trips by this company")}</h3>
              {trips.length ? (
                <ul className="portal-drawer-trip-list">
                  {trips.map((trip) => {
                    const tripBookingCount = bookings.filter((item) => item.package_id === trip.id).length;
                    return (
                      <li key={trip.id}>
                        <button type="button" onClick={() => onOpenTrip(trip)}>
                          <span className="portal-drawer-trip-main">
                            <b>{trip.title}</b>
                            <small>
                              {trip.departure_date ? formatDate(trip.departure_date, true) : tr("بەروار دیارینەکراوە", "التاريخ غير محدد", "Date not set")}
                              {" · "}
                              {tripBookingCount} {tr("حیجز", "حجز", tripBookingCount === 1 ? "booking" : "bookings")}
                            </small>
                          </span>
                          <span className={`portal-status ${statusTone(trip.lifecycle_status)}`}><i />{titleCase(trip.lifecycle_status)}</span>
                          <ArrowRight size={15} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="portal-commercial-note">{tr("ئەم کۆمپانیایە هێشتا هیچ گەشتێکی دروست نەکردووە.", "لم تنشئ هذه الشركة أي رحلة بعد.", "This company has not created any trips yet.")}</p>
              )}
            </section>
          )}

          {activeTab === "verification" && (
            <section>
              <div className="portal-verification-score">
                <div><b>{completion}%</b><small>{tr("تەواوی پڕۆفایل", "اكتمال الملف", "Profile completion")}</small></div>
                <span><i style={{ width: `${completion}%` }} /></span>
              </div>
              <h3>{tr("لیستی پێداچوونەوە", "قائمة التحقق", "Review checklist")}</h3>
              <ul className="portal-verification-list">
                {checklist.map((item) => (
                  <li key={item.label} className={item.complete ? "complete" : ""}>
                    <span>{item.complete ? <Check size={14} /> : <AlertTriangle size={14} />}</span>
                    <div><b>{item.label}</b><small>{item.detail}</small></div>
                  </li>
                ))}
              </ul>

              <div className="portal-verification-record">
                <h3>{tr("تۆماری داواکاری", "سجل الطلب", "Application record")}</h3>
                <dl>
                  <div><dt>{tr("خاوەنی کۆمپانیا", "مالك الشركة", "Company owner")}</dt><dd>{owner?.full_name || company.owner_id}</dd></div>
                  {owner?.phone && <div><dt>{tr("تەلەفۆنی خاوەن", "هاتف المالك", "Owner phone")}</dt><dd>{owner.phone}</dd></div>}
                  {owner?.full_name && <div><dt>{tr("ناسنامەی خاوەن", "معرف المالك", "Owner ID")}</dt><dd>{company.owner_id}</dd></div>}
                  <div><dt>{tr("بەرواری تۆمارکردن", "تاريخ التسجيل", "Submitted")}</dt><dd>{formatDate(company.created_at, true)}</dd></div>
                  <div><dt>{tr("ژمارەی مۆڵەت", "رقم الترخيص", "Licence number")}</dt><dd>{company.license_number || notProvided}</dd></div>
                </dl>
              </div>

              <div className={`portal-review-signals ${reviewSignals.length ? "warning" : "clear"}`}>
                <h3>{reviewSignals.length ? tr("ئاگادارییەکانی پێداچوونەوە", "إشارات المراجعة", "Review signals") : tr("هیچ ئاگادارییەک نەدۆزرایەوە", "لم يتم العثور على إشارات", "No review signals found")}</h3>
                {reviewSignals.length ? <ul>{reviewSignals.map((signal) => <li key={signal}>{signal}</li>)}</ul> : <p>{tr("هیچ دووبارەبوونەوە یان کەموکوڕییەکی دیار نەدۆزرایەوە.", "لم يتم اكتشاف تكرار أو نقص واضح.", "No obvious duplicate or missing-data signals were detected.")}</p>}
              </div>

              <p className="portal-verification-note"><ShieldCheck size={15} /> {tr(
                "ئەم لیستە تەنها تەواوی زانیارییە نێردراوەکان دەسەلمێنێت. پێش پەسەندکردن، ژمارەی مۆڵەت لەگەڵ بەڵگەی فەرمی بەراورد بکە.",
                "تتحقق هذه القائمة من اكتمال البيانات المقدمة فقط. قارن رقم الترخيص مع المستند الرسمي قبل الاعتماد.",
                "This checklist verifies submitted data completeness only. Compare the licence number with official evidence before approval.",
              )}</p>
            </section>
          )}

          <CompanyCommercialPanel company={company} busy={busy} runAction={runAction} locale={locale} activeTab={activeTab} />
        </div>

        <footer className="portal-drawer-actions">
          {confirmingApproval ? (
            <div className="portal-approval-confirm">
              <div><AlertTriangle size={17} /><span><b>{isSuspended ? tr("چالاککردنەوەی کۆمپانیا؟", "إعادة تفعيل الشركة؟", "Reactivate company?") : tr("پەسەندکردنی کۆمپانیا؟", "اعتماد الشركة؟", "Approve company?")}</b><small>{tr("ئەم کارە دەستگەیشتنی کۆمپانیا بۆ بازاڕ چالاک دەکات.", "سيؤدي هذا إلى تفعيل وصول الشركة إلى السوق.", "This activates the company’s marketplace access.")}</small></span></div>
              <div>
                <button type="button" className="portal-secondary-button" onClick={() => setConfirmingApproval(false)}>{tr("پاشگەزبوونەوە", "إلغاء", "Cancel")}</button>
                <button type="button" className="portal-primary-button" onClick={confirmApproval} disabled={rowBusy}>{rowBusy ? <TawafLoadingSpinner size={14} /> : <Check size={14} />} {tr("پشتڕاستکردنەوە", "تأكيد", "Confirm")}</button>
              </div>
            </div>
          ) : isPending ? (
            <>
              <button type="button" className="portal-primary-button" onClick={() => { setActiveTab("verification"); setConfirmingApproval(true); }} disabled={rowBusy}><Check size={14} /> {t.accept}</button>
              <button type="button" className="portal-secondary-button" onClick={() => onReview("needs_changes")} disabled={rowBusy}>{locale === "ku" ? "داوای گۆڕانکاری" : locale === "ar" ? "طلب تعديلات" : "Request changes"}</button>
              <button type="button" className="portal-secondary-button danger" onClick={() => onReview("rejected")} disabled={rowBusy}>{t.reject}</button>
            </>
          ) : isRejected ? (
            <button type="button" className="portal-primary-button" onClick={() => { setActiveTab("verification"); setConfirmingApproval(true); }} disabled={rowBusy}><Check size={14} /> {locale === "ku" ? "پەسەندکردنی کۆمپانیا" : locale === "ar" ? "الموافقة على الشركة" : "Approve company"}</button>
          ) : isSuspended ? (
            <button type="button" className="portal-primary-button" onClick={() => setConfirmingApproval(true)} disabled={rowBusy}><Check size={14} /> {locale === "ku" ? "چالاککردنەوەی کۆمپانیا" : locale === "ar" ? "إعادة تفعيل الشركة" : "Reactivate company"}</button>
          ) : (
            <>
              {canPromote && <button type="button" className="portal-secondary-button" onClick={onTogglePromoted} disabled={rowBusy}>{busy === `company-${company.id}-promote` ? <TawafLoadingSpinner size={14} /> : <Star size={14} />} {company.is_promoted ? (locale === "ku" ? "لابردنی پرۆمۆشن" : locale === "ar" ? "إزالة الترويج" : "Remove promotion") : (locale === "ku" ? "پرۆمۆتکردنی کۆمپانیا" : locale === "ar" ? "ترويج الشركة" : "Promote company")}</button>}
              <button type="button" className="portal-secondary-button danger" onClick={() => onReview("suspended")} disabled={rowBusy}>{busy === `company-${company.id}-suspended` ? <TawafLoadingSpinner size={14} /> : <X size={14} />} {locale === "ku" ? "ڕاگرتنی کۆمپانیا" : locale === "ar" ? "تعليق الشركة" : "Suspend company"}</button>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}

type TripDetailData = {
  itinerary: Array<{ day_no: number; title: string; summary: string | null }>;
  pricing: Array<{ occupancy_type: string; price_iqd: number }>;
  hotels: Array<{ city: string; nights: number; distance_from_haram_m: number | null; hotels: { name: string; description: string | null; star_rating: number } | null }>;
  inclusions: Array<{ type: string; included: boolean; details: string | null }>;
};

// Read-only detail sheet the admin opens by clicking a trip card, so every field the
// company submitted can be reviewed before the review decision. Pulls the child
// tables (itinerary/pricing/hotels/inclusions) on open — admin RLS (is_admin) already
// allows reading these for pending trips, so no server change is needed.
function TripDetailModal({ trip, companyName, data, locale, role, busy, runAction, askReason, onReview, onClose }: {
  trip: any;
  companyName: string;
  data: PortalData;
  locale: "ku" | "ar" | "en";
  role: Role;
  busy: string;
  runAction: RunAction;
  askReason: AskReason;
  onReview: (decision: "published" | "needs_changes" | "rejected") => Promise<boolean>;
  onClose: () => void;
}) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const [details, setDetails] = useState<TripDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const rowBusy = busy === `trip-review-${trip.id}`;

  // Bookings come from data already in memory, so this section renders straight
  // away rather than waiting on the itinerary/pricing fetch below.
  const tripBookings = useMemo(
    () => data.bookings
      .filter((item) => item.package_id === trip.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [data.bookings, trip.id],
  );
  const activeTripBookings = tripBookings.filter((item) => !["cancelled", "rejected", "expired"].includes(item.operational_stage));
  const bookedTravellers = activeTripBookings.reduce((sum, item) => sum + Number(item.travellers ?? 0), 0);
  const bookedValue = activeTripBookings.reduce((sum, item) => sum + Number(item.total_iqd ?? 0), 0);
  // Lead traveller names the booking; fall back to whichever traveller is on file.
  const clientNameByBooking = useMemo(() => {
    const names = new Map<string, string>();
    data.bookingTravellers.forEach((row) => {
      const name = (row.full_name || row.local_name || "").trim();
      if (!name) return;
      if (row.is_lead || !names.has(row.booking_id)) names.set(row.booking_id, name);
    });
    return names;
  }, [data.bookingTravellers]);

  useScrollLock();

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError("");
      const supabase = getSupabase();
      const [itinerary, pricing, hotels, inclusions] = await Promise.all([
        supabase.from("itinerary_days").select("*").eq("package_id", trip.id).order("day_no"),
        supabase.from("offer_pricing").select("*").eq("offer_id", trip.id).order("price_iqd"),
        supabase.from("offer_hotels").select("*, hotels(*)").eq("offer_id", trip.id),
        supabase.from("offer_inclusions").select("*").eq("offer_id", trip.id).order("sort_order"),
      ]);
      if (!active) return;
      const err = [itinerary, pricing, hotels, inclusions].find((result) => result.error)?.error;
      if (err) {
        setLoadError(err.message);
        setLoading(false);
        return;
      }
      setDetails({
        itinerary: (itinerary.data ?? []) as any,
        pricing: (pricing.data ?? []) as any,
        hotels: (hotels.data ?? []) as any,
        inclusions: (inclusions.data ?? []) as any,
      });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [trip.id]);

  // Close on Escape for keyboard reviewers. Skipped while a booking is open on
  // top, so one Escape closes the booking rather than both layers at once.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !openBookingId) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, openBookingId]);

  const facts: Array<{ label: string; value: string }> = [
    { label: tr("بەرواری ڕۆیشتن", "تاريخ المغادرة", "Departure"), value: formatDate(trip.departure_date, true) },
    { label: tr("بەرواری گەڕانەوە", "تاريخ العودة", "Return"), value: formatDate(trip.return_date, true) },
    { label: tr("ماوە", "المدة", "Duration"), value: `${trip.days ?? "—"} ${tr("ڕۆژ", "أيام", "days")} · ${trip.nights ?? "—"} ${tr("شەو", "ليالٍ", "nights")}` },
    { label: tr("نرخ / بۆ هەر کەسێک", "السعر / للمعتمر", "Price / pilgrim"), value: formatIqd(trip.price_iqd) },
    { label: tr("پێشەکی", "العربون", "Deposit"), value: trip.deposit_iqd ? formatIqd(trip.deposit_iqd) : tr("دیارینەکراوە", "غير محدد", "Not set") },
    { label: tr("گونجایش", "السعة", "Capacity"), value: `${trip.seats_reserved ?? 0} / ${trip.capacity ?? "—"} ${tr("شوێن", "مقعد", "seats")}` },
    { label: tr("پلەی هۆتێل", "تصنيف الفندق", "Hotel rating"), value: `${trip.acc_stars ?? "—"} ${tr("ئەستێرە", "نجوم", "star")}` },
    { label: tr("ژەم لە ڕۆژێکدا", "الوجبات في اليوم", "Meals / day"), value: trip.meals_per_day != null ? String(trip.meals_per_day) : (trip.meals || tr("دیارینەکراوە", "غير محدد", "Not set")) },
  ];

  const transportBits = [
    trip.transport === "plane" ? tr("فڕۆکە", "طائرة", "Plane") : trip.transport === "bus" ? tr("پاس", "حافلة", "Bus") : titleCase(trip.transport || ""),
    trip.airline_name || trip.carrier,
    trip.departure_airport && tr(`فڕۆکەخانە: ${trip.departure_airport}`, `المطار: ${trip.departure_airport}`, `Airport: ${trip.departure_airport}`),
    trip.airport_transfers ? tr("گواستنەوەی فڕۆکەخانە", "نقل المطار", "Airport transfers") : null,
    trip.bus_between_cities ? tr("پاس نێوان شارەکان", "حافلة بين المدن", "Bus between cities") : null,
  ].filter(Boolean) as string[];

  const includedInclusions = (details?.inclusions ?? []).filter((row) => row.included);

  return (
    <>
    <div className="portal-trip-modal-scrim" onClick={onClose}>
      <div className="portal-trip-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="portal-trip-modal-head">
          <div className={`portal-trip-modal-cover${trip.image_url ? " has-image" : ""}`}>
            <span className="portal-trip-placeholder"><Plane size={22} /></span>
            {trip.image_url && <img src={trip.image_url} alt="" onError={(event) => { event.currentTarget.closest(".portal-trip-modal-cover")?.classList.remove("has-image"); }} />}
          </div>
          <div className="portal-trip-modal-title">
            {role === "admin" && <small>{tr("پێشبینینی زیارەتکار · ", "معاينة المعتمر · ", "Client preview · ")}{companyName}</small>}
            <h2>{trip.title}</h2>
            <StatusPill status={trip.lifecycle_status} />
          </div>
          <button type="button" className="portal-trip-modal-close" onClick={onClose} aria-label={tr("داخستن", "إغلاق", "Close")}><X size={18} /></button>
        </header>

        <div className="portal-trip-modal-body">
          {(trip.rejection_reason || trip.review_reason) && (
            <p className={`portal-review-note${trip.rejection_reason ? " is-rejection" : ""}`}>
              <b>{trip.rejection_reason
                ? tr("هۆکاری ڕەتکردنەوە: ", "سبب الرفض: ", "Rejection reason: ")
                : tr("تێبینی گۆڕانکاری: ", "ملاحظة التعديل: ", "Changes note: ")}</b>
              {trip.rejection_reason || trip.review_reason}
            </p>
          )}

          {trip.overview && (
            <section className="portal-trip-modal-section">
              <h3><FileText size={13} /> {tr("پێناسە", "الوصف", "Overview")}</h3>
              <p className="portal-trip-modal-text">{trip.overview}</p>
            </section>
          )}

          <section className="portal-trip-modal-section">
            <h3><ClipboardCheck size={13} /> {tr("زانیاری سەرەکی", "المعلومات الأساسية", "Key details")}</h3>
            <div className="portal-trip-facts">
              {facts.map((fact) => (
                <div key={fact.label}><small>{fact.label}</small><b>{fact.value}</b></div>
              ))}
            </div>
          </section>

          {/* Bookings live under the trip they were made against — this is the
              only route to a booking now that admins have no Bookings page. */}
          <section className="portal-trip-modal-section">
            <h3>
              <BookOpenCheck size={13} /> {tr("حیجزەکان", "الحجوزات", "Bookings")}
              <span className="portal-trip-modal-count">{tripBookings.length}</span>
            </h3>
            {tripBookings.length ? (
              <>
                <div className="portal-trip-booking-summary">
                  <div><small>{tr("چالاک", "نشطة", "Active")}</small><b>{activeTripBookings.length}</b></div>
                  <div><small>{tr("گەشتیاران", "المعتمرون", "Travellers")}</small><b>{bookedTravellers}</b></div>
                  <div><small>{tr("بەهای حیجزەکان", "قيمة الحجوزات", "Booking value")}</small><b dir="ltr">{formatIqd(bookedValue, true)}</b></div>
                </div>
                <ul className="portal-trip-booking-list">
                  {tripBookings.map((booking) => (
                    <li key={booking.id}>
                      <button type="button" onClick={() => setOpenBookingId(booking.id)}>
                        <span className="portal-trip-booking-who">
                          <b>{clientNameByBooking.get(booking.id) ?? tr("گەشتیار", "معتمر", "Traveller")}</b>
                          <small>#{booking.id.slice(0, 8).toUpperCase()} · {booking.travellers} {tr("کەس", "أشخاص", booking.travellers === 1 ? "traveller" : "travellers")}</small>
                        </span>
                        <span className="portal-trip-booking-money" dir="ltr">{formatIqd(booking.total_iqd, true)}</span>
                        <span className={`portal-status ${statusTone(booking.operational_stage)}`}><i />{titleCase(booking.operational_stage)}</span>
                        <ArrowRight size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="portal-trip-modal-text muted">
                {tr("هێشتا هیچ حیجزێک بۆ ئەم گەشتە نەکراوە.", "لا توجد حجوزات على هذه الرحلة بعد.", "No bookings have been made on this trip yet.")}
              </p>
            )}
          </section>

          <section className="portal-trip-modal-section">
            <h3><Plane size={13} /> {tr("گواستنەوە", "النقل", "Transport")}</h3>
            <p className="portal-trip-modal-text">{transportBits.length ? transportBits.join(" · ") : tr("زانیاری نییە", "لا معلومات", "No details")}</p>
            {trip.transport_notes && <p className="portal-trip-modal-text muted">{trip.transport_notes}</p>}
          </section>

          {loading ? (
            <div className="portal-trip-modal-loading"><TawafLoadingSpinner size={20} /> {tr("زانیاری دەهێنرێت…", "جارٍ تحميل التفاصيل…", "Loading details…")}</div>
          ) : loadError ? (
            <div className="portal-trip-modal-error"><AlertTriangle size={14} /> {loadError}</div>
          ) : (
            <>
              {details && details.hotels.length > 0 && (
                <section className="portal-trip-modal-section">
                  <h3><MapPin size={13} /> {tr("هۆتێلەکان", "الفنادق", "Hotels")}</h3>
                  <div className="portal-trip-hotels">
                    {details.hotels
                      .slice()
                      .sort((a, b) => (a.city === "makkah" ? -1 : 1) - (b.city === "makkah" ? -1 : 1))
                      .map((hotel, index) => (
                        <div key={index} className="portal-trip-hotel">
                          <div className="portal-trip-hotel-head">
                            <b>{hotel.city === "makkah" ? tr("مەککە", "مكة", "Makkah") : tr("مەدینە", "المدينة", "Madinah")}</b>
                            <span>{"★".repeat(Math.max(0, Math.min(5, hotel.hotels?.star_rating ?? 0)))}</span>
                          </div>
                          <b className="portal-trip-hotel-name">{hotel.hotels?.name ?? tr("هۆتێل دیارینەکراوە", "فندق غير محدد", "Hotel not set")}</b>
                          <div className="portal-trip-hotel-meta">
                            <span>{hotel.nights} {tr("شەو", "ليالٍ", "nights")}</span>
                            {hotel.distance_from_haram_m != null && <span>{hotel.distance_from_haram_m}{hotel.city === "makkah" ? tr("م لە حەرەم", "م من الحرم", "m from Haram") : tr("م لە مزگەوتی نەبەوی", "م من المسجد النبوي", "m from Prophet's Mosque")}</span>}
                          </div>
                          {hotel.hotels?.description && <p className="portal-trip-modal-text muted">{hotel.hotels.description}</p>}
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {details && details.pricing.length > 0 && (
                <section className="portal-trip-modal-section">
                  <h3><CircleDollarSign size={13} /> {tr("نرخەکان بەپێی ژوور", "الأسعار حسب الغرفة", "Pricing by occupancy")}</h3>
                  <div className="portal-trip-pricing">
                    {details.pricing.map((row, index) => (
                      <div key={index}><small>{titleCase(row.occupancy_type)}</small><b>{formatIqd(row.price_iqd)}</b></div>
                    ))}
                  </div>
                </section>
              )}

              {includedInclusions.length > 0 && (
                <section className="portal-trip-modal-section">
                  <h3><Check size={13} /> {tr("خزمەتگوزاریە لەخۆگیراوەکان", "الخدمات المشمولة", "What's included")}</h3>
                  <div className="portal-trip-inclusions">
                    {includedInclusions.map((row, index) => (
                      <span key={index}><Check size={11} /> {row.details || titleCase(row.type)}</span>
                    ))}
                  </div>
                </section>
              )}

              {details && details.itinerary.length > 0 && (
                <section className="portal-trip-modal-section">
                  <h3><CalendarDays size={13} /> {tr("بەرنامەی ڕۆژانە", "البرنامج اليومي", "Daily itinerary")}</h3>
                  <ol className="portal-trip-itinerary">
                    {details.itinerary.map((day) => (
                      <li key={day.day_no}>
                        <span className="portal-trip-day-no">{tr("ڕۆژ", "يوم", "Day")} {day.day_no}</span>
                        <div>
                          <b>{day.title}</b>
                          {day.summary && <p>{day.summary}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          )}

          {(trip.cancellation_policy || trip.deposit_terms) && (
            <section className="portal-trip-modal-section">
              <h3><ShieldCheck size={13} /> {tr("مەرجەکان", "السياسات", "Policies")}</h3>
              {trip.deposit_terms && <p className="portal-trip-modal-text"><b>{tr("مەرجی پێشەکی: ", "شروط العربون: ", "Deposit terms: ")}</b>{trip.deposit_terms}</p>}
              {trip.cancellation_policy && <p className="portal-trip-modal-text"><b>{tr("مەرجی هەڵوەشاندنەوە: ", "سياسة الإلغاء: ", "Cancellation: ")}</b>{trip.cancellation_policy}</p>}
            </section>
          )}
        </div>

        {role === "admin" && trip.lifecycle_status === "pending_review" && (
          <footer className="portal-trip-modal-actions">
            <button type="button" className="approve" onClick={async () => { if (await onReview("published")) onClose(); }} disabled={rowBusy}>
              {rowBusy ? <TawafLoadingSpinner size={14} /> : <Check size={14} />} {tr("پەسەندکردن", "قبول", "Approve trip")}
            </button>
            <button type="button" className="changes" onClick={async () => { if (await onReview("needs_changes")) onClose(); }} disabled={rowBusy}>
              <FileText size={14} /> {tr("داوای گۆڕانکاری", "طلب تعديلات", "Request changes")}
            </button>
            <button type="button" className="danger" onClick={async () => { if (await onReview("rejected")) onClose(); }} disabled={rowBusy}>
              <X size={14} /> {tr("ڕەتکردنەوە", "رفض", "Reject")}
            </button>
          </footer>
        )}
      </div>
    </div>
    {/* Sibling, not a child: inside the trip scrim a click on the booking
        backdrop would bubble up and close the trip modal underneath too. */}
    {openBookingId && (
      <BookingDetailModal
        bookingId={openBookingId}
        data={data}
        role={role}
        busy={busy}
        runAction={runAction}
        askReason={askReason}
        locale={locale}
        onClose={() => setOpenBookingId(null)}
      />
    )}
    </>
  );
}

// Shared by the Trips page and the trip modal opened from a company profile —
// both are the same admin decision on the same package, so they must ask for the
// same reasons and emit the same toast.
async function reviewTripDecision(
  trip: Trip,
  decision: "published" | "needs_changes" | "rejected",
  { runAction, askReason, locale }: { runAction: RunAction; askReason: AskReason; locale: "ku" | "ar" | "en" },
): Promise<boolean> {
  const reason = decision === "rejected"
    ? await askReason(locale === "ku" ? "بۆچی ئەم گەشتە ڕەتدەکرێتەوە؟" : locale === "ar" ? "لماذا يتم رفض هذه الرحلة؟" : "Why is this trip being rejected?")
    : decision === "needs_changes"
      ? await askReason(
          locale === "ku" ? "چی دەبێت کۆمپانیاکە بگۆڕێت؟ (ئارەزوومەندانە)" : locale === "ar" ? "ما الذي يجب على الشركة تغييره؟ (اختياري)" : "What should the company change? (optional)",
          { optional: true },
        )
      : null;
  if (decision !== "published" && reason === null) return false;
  const result = await runAction(
    `trip-review-${trip.id}`,
    () => getSupabase().rpc("review_package", { p_package_id: trip.id, p_decision: decision, p_reason: reason }),
    decision === "published"
      ? (locale === "ku" ? `${trip.title} ئێستا چالاکە.` : locale === "ar" ? `${trip.title} نشطة الآن.` : `${trip.title} is now live.`)
      : decision === "needs_changes"
        ? (locale === "ku" ? `${trip.title} گەڕێندرایەوە بۆ ڕەشنووس.` : locale === "ar" ? `أُعيدت ${trip.title} إلى المسودة.` : `${trip.title} returned to draft for changes.`)
        : (locale === "ku" ? `${trip.title} ڕەتکرایەوە.` : locale === "ar" ? `تم رفض ${trip.title}.` : `${trip.title} was rejected.`),
  );
  return Boolean(result);
}

function TripsPage({ role, data, busy, runAction, askReason, onCreateTrip, locale }: { role: Role; data: PortalData; busy: string; runAction: RunAction; askReason: AskReason; onCreateTrip?: () => void; locale: "ku" | "ar" | "en" }) {
  const t = dashboardTranslations[locale];
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [detailTrip, setDetailTrip] = useState<Trip | null>(null);
  const companyMap = new Map(data.companies.map((item) => [item.id, item.name]));
  const trips = data.trips.filter((item) => {
    const matches = `${item.title} ${companyMap.get(item.company_id) ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matches && (filter === "all" || item.lifecycle_status === filter);
  });
  const pendingChanges = data.tripChangeRequests.filter((item) => item.status === "pending");
  const countByStatus = (status: string) => data.trips.filter((item) => item.lifecycle_status === status).length;

  const reviewTrip = (trip: Trip, decision: "published" | "needs_changes" | "rejected") =>
    reviewTripDecision(trip, decision, { runAction, askReason, locale });

  async function toggleFeatured(trip: Trip) {
    await runAction(
      `trip-feature-${trip.id}`,
      () => getSupabase().rpc("admin_set_package_featured", { p_package_id: trip.id, p_value: !trip.is_featured }),
      trip.is_featured
        ? (locale === "ku" ? `${trip.title} لە تایبەتکراوەکان لابرا.` : locale === "ar" ? `تمت إزالة ${trip.title} من الرحلات المميزة.` : `${trip.title} is no longer featured.`)
        : (locale === "ku" ? `${trip.title} تایبەتکرا لە بازاڕدا.` : locale === "ar" ? `أصبحت ${trip.title} رحلة مميزة في السوق.` : `${trip.title} is now featured in the marketplace.`),
    );
  }

  async function takeDownTrip(trip: Trip) {
    const reason = await askReason(locale === "ku" ? "بۆچی ئەم گەشتە لە بازاڕ لادەبرێت؟" : locale === "ar" ? "لماذا يتم إنزال هذه الرحلة من السوق؟" : "Why is this trip being taken down from the marketplace?");
    if (!reason) return;
    await runAction(
      `trip-takedown-${trip.id}`,
      () => getSupabase().rpc("admin_force_unpublish_offer", { p_offer_id: trip.id, p_reason: reason }),
      locale === "ku" ? `${trip.title} لە بازاڕ لابرا و کۆمپانیاکە ئاگادار کرایەوە.` : locale === "ar" ? `تم إنزال ${trip.title} من السوق وتم إبلاغ الشركة.` : `${trip.title} was taken down and the company was notified.`,
    );
  }

  async function agencyTripAction(trip: Trip) {
    if (["draft", "needs_changes"].includes(trip.lifecycle_status)) {
      await runAction(`trip-${trip.id}`, () => getSupabase().rpc("submit_package", { p_package_id: trip.id }), locale === "ku" ? `${trip.title} نێردرا بۆ پێداچوونەوە.` : locale === "ar" ? `تم إرسال ${trip.title} للمراجعة.` : `${trip.title} was submitted for review.`);
    } else if (trip.lifecycle_status === "published") {
      await runAction(`trip-${trip.id}`, () => getSupabase().rpc("pause_package", { p_package_id: trip.id, p_reason: "Paused from company web portal" }), locale === "ku" ? `${trip.title} ڕاگیرا.` : locale === "ar" ? `تم إيقاف ${trip.title} مؤقتاً.` : `${trip.title} is paused.`);
    }
  }

  // Approving an edit re-publishes the trip when it was published before, which runs
  // assert_offer_complete() in Supabase. Mirror the checks that can only fail on the
  // admin side so the reviewer sees the reason instead of a raw Postgres error.
  function approvalBlocker(request: TripChangeRequest, trip?: Trip): string | null {
    if (request.request_type !== "edit") return null;
    const beforeFields = request.before_snapshot?.fields ?? {};
    const proposedFields = request.proposed_snapshot?.fields ?? {};
    const previousStatus = beforeFields.lifecycle_status ?? trip?.lifecycle_status;
    if (previousStatus !== "published") return null;
    const departure = proposedFields.departure_date ?? trip?.departure_date ?? null;
    const returnDate = proposedFields.return_date ?? trip?.return_date ?? null;
    const today = new Date().toISOString().slice(0, 10);
    if (!departure || !returnDate) {
      return locale === "ku"
        ? "ناتوانرێت پەسەند بکرێت: بەرواری ڕۆیشتن و گەڕانەوە دیارینەکراون. داوا لە کۆمپانیاکە بکە بەروارەکان زیاد بکات."
        : locale === "ar"
          ? "لا يمكن الموافقة: تاريخا المغادرة والعودة غير محددين. اطلب من الشركة إضافتهما."
          : "Cannot approve: departure and return dates are missing. Ask the company to add them.";
    }
    if (departure < today) {
      return locale === "ku"
        ? `ناتوانرێت پەسەند بکرێت: بەرواری ڕۆیشتن (${departure}) تێپەڕیوە. داوا لە کۆمپانیاکە بکە بەروارێکی داهاتوو دابنێت و دووبارە بینێرێت.`
        : locale === "ar"
          ? `لا يمكن الموافقة: تاريخ المغادرة (${departure}) قد مضى. اطلب من الشركة تحديده بتاريخ مستقبلي وإعادة الإرسال.`
          : `Cannot approve: the departure date (${departure}) has already passed. Ask the company to set a future date and resubmit.`;
    }
    if (returnDate < departure) {
      return locale === "ku"
        ? "ناتوانرێت پەسەند بکرێت: بەرواری گەڕانەوە پێش بەرواری ڕۆیشتنە."
        : locale === "ar"
          ? "لا يمكن الموافقة: تاريخ العودة يسبق تاريخ المغادرة."
          : "Cannot approve: the return date is before the departure date.";
    }
    return null;
  }

  async function reviewTripChange(request: TripChangeRequest, decision: "approved" | "rejected") {
    const reason = decision === "rejected"
      ? await askReason(locale === "ku" ? "هۆکاری ڕەتکردنەوەی ئەم داواکارییە بنووسە:" : locale === "ar" ? "اكتب سبب رفض طلب التغيير:" : "Why are these changes being rejected?")
      : null;
    if (decision === "rejected" && !reason) return;
    await runAction(
      `trip-change-${request.id}`,
      () => getSupabase().rpc("review_trip_change", {
        p_request_id: request.id,
        p_decision: decision,
        p_reason: reason,
      }),
      decision === "approved"
        ? (locale === "ku" ? "گۆڕانکارییەکانی گەشت پەسەند کران." : locale === "ar" ? "تمت الموافقة على تغييرات الرحلة." : "Trip changes approved and applied.")
        : (locale === "ku" ? "داواکاری گۆڕانکاری ڕەتکرایەوە." : locale === "ar" ? "تم رفض طلب التغيير." : "Trip change request rejected."),
    );
  }

  return (
    <>
      <PageHeading
        eyebrow={role === "admin" ? (locale === "ku" ? "ناوەڕۆکی بازاڕ" : locale === "ar" ? "محتوى السوق" : "Marketplace content") : (locale === "ku" ? "کەتەلۆگی گەشتەکان" : locale === "ar" ? "كتالوج الرحلات" : "Trip catalogue")}
        title={locale === "ku" ? "گەشتەکان" : locale === "ar" ? "الرحلات" : "Trips"}
        description={role === "admin" ? (locale === "ku" ? "پێداچوونەوە بە هەر پاکێجێکی عومرە بکە پێش ئەوەی بگاتە دەستی زیارەتکاران." : locale === "ar" ? "راجع كل باقة عمرة قبل أن تصل إلى المعتمرين." : "Review every Umrah package before it reaches pilgrims.") : (locale === "ku" ? "گەشتی نوێ دروست بکە، پێشکەشی بکە و کاروباری گەشتەکەت بەڕێوەبەرە." : locale === "ar" ? "أنشئ وأرسل وأدر رحلات عمرة شركتك." : "Create, submit and operate your company’s Umrah departures.")}
        action={role === "agency" ? <button className="portal-primary-button" type="button" onClick={onCreateTrip}><Plus size={16} /> {t.createTrip}</button> : undefined}
      />
      {role === "admin" && (
        <section className="portal-mini-metrics">
          <div><span className="warning"><ClipboardCheck size={17} /></span><p><b>{countByStatus("pending_review") + pendingChanges.length}</b><small>{locale === "ku" ? "چاوەڕێی پێداچوونەوە" : locale === "ar" ? "بانتظار المراجعة" : "Awaiting review"}</small></p></div>
          <div><span className="positive"><Plane size={17} /></span><p><b>{countByStatus("published")}</b><small>{locale === "ku" ? "بڵاوکراوە لە بازاڕدا" : locale === "ar" ? "منشورة في السوق" : "Live in marketplace"}</small></p></div>
          <div><span className="neutral"><Clock3 size={17} /></span><p><b>{countByStatus("paused") + countByStatus("draft")}</b><small>{locale === "ku" ? "ڕاگیراو یان ڕەشنووس" : locale === "ar" ? "موقوفة أو مسودة" : "Paused or draft"}</small></p></div>
          <div><span className="gold"><Star size={17} /></span><p><b>{data.trips.filter((item) => item.is_featured && item.lifecycle_status === "published").length}</b><small>{locale === "ku" ? "گەشتی تایبەتکراو" : locale === "ar" ? "رحلات مميزة" : "Featured trips"}</small></p></div>
        </section>
      )}
      {role === "admin" && pendingChanges.length > 0 && (
        <section className="trip-change-review-queue">
          <header>
            <div><p>CHANGE APPROVALS</p><h2>Company trip requests</h2><span>Review exactly what a company changed before it affects the marketplace.</span></div>
            <strong>{pendingChanges.length} pending</strong>
          </header>
          <div>
            {pendingChanges.map((request) => {
              const trip = data.trips.find((item) => item.id === request.package_id);
              const beforeFields = request.before_snapshot?.fields ?? {};
              const proposedFields = request.proposed_snapshot?.fields ?? {};
              const blocker = approvalBlocker(request, trip);
              return (
                <article className="trip-change-review-card" key={request.id}>
                  <header>
                    <div>
                      <span className={`trip-change-kind ${request.request_type}`}>{titleCase(request.request_type)} request</span>
                      <h3>{trip?.title ?? beforeFields.title ?? "Trip request"}</h3>
                      <p>{companyMap.get(request.company_id) ?? "Tawaf company"} · {relativeTime(request.created_at)}</p>
                    </div>
                    <StatusPill status={request.status} />
                  </header>
                  {request.request_reason && <p className="trip-change-reason"><b>Company reason:</b> {request.request_reason}</p>}
                  <div className="trip-change-diff">
                    {request.changed_fields.map((field) => {
                      const isBundle = ["itinerary", "pricing", "hotels", "inclusions"].includes(field);
                      const before = isBundle ? request.before_snapshot?.[field] : beforeFields[field];
                      const after = isBundle ? request.proposed_snapshot?.[field] : proposedFields[field];
                      return (
                        <div key={field}>
                          <b>{tripChangeLabels[field] ?? titleCase(field)}</b>
                          <span><small>Before</small>{tripChangeValue(field, before)}</span>
                          <i><ArrowRight size={14} /></i>
                          <span><small>Requested</small>{tripChangeValue(field, after)}</span>
                        </div>
                      );
                    })}
                  </div>
                  {blocker && <p className="trip-change-blocked"><AlertTriangle size={13} /> {blocker}</p>}
                  <footer>
                    <button type="button" className="danger" onClick={() => reviewTripChange(request, "rejected")} disabled={busy === `trip-change-${request.id}`}><X size={14} /> Reject</button>
                    <button type="button" className="approve" onClick={() => reviewTripChange(request, "approved")} disabled={busy === `trip-change-${request.id}` || Boolean(blocker)} title={blocker ?? undefined}>{busy === `trip-change-${request.id}` ? <TawafLoadingSpinner size={14} /> : <Check size={14} />} Approve & apply</button>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <Toolbar query={query} setQuery={setQuery} placeholder={locale === "ku" ? "گەڕان بۆ گەشت یان کۆمپانیا..." : locale === "ar" ? "البحث عن رحلة أو شركة..." : "Search trip or company…"} filters={[["all", t.allAll || "All"], ["draft", locale === "ku" ? "ڕەشنووس" : locale === "ar" ? "مسودة" : "Draft"], ["pending_review", locale === "ku" ? "پێداچوونەوە" : locale === "ar" ? "قيد المراجعة" : "Pending review"], ["published", locale === "ku" ? "چالاک" : locale === "ar" ? "نشط" : "Published"], ["paused", locale === "ku" ? "ڕاگیراو" : locale === "ar" ? "موقوف" : "Paused"], ["rejected", locale === "ku" ? "ڕەتکراوە" : locale === "ar" ? "مرفوض" : "Rejected"]]} activeFilter={filter} setFilter={setFilter} />
      <section className="portal-trip-grid">
        {trips.map((trip) => {
          const fill = Math.min(100, ((trip.seats_reserved ?? 0) / Math.max(1, trip.capacity ?? 1)) * 100);
          // A trip whose departure has passed can no longer be published or re-approved
          // (assert_offer_complete rejects past dates), so surface it before someone tries.
          const departed = Boolean(trip.departure_date) && trip.departure_date! < new Date().toISOString().slice(0, 10)
            && !["removed", "rejected"].includes(trip.lifecycle_status);
          return (
            <article
              className="portal-trip-card is-clickable"
              key={trip.id}
              role="button"
              tabIndex={0}
              onClick={() => setDetailTrip(trip)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setDetailTrip(trip); } }}
            >
              <div className={`portal-trip-visual${trip.image_url ? " has-image" : ""}`}>
                {/* Placeholder always renders underneath, so a broken storage URL degrades cleanly. */}
                <span className="portal-trip-placeholder"><Plane size={22} /></span>
                {trip.image_url && <img src={trip.image_url} alt="" loading="lazy" onError={(event) => { event.currentTarget.closest(".portal-trip-visual")?.classList.remove("has-image"); }} />}
                <StatusPill status={trip.lifecycle_status} />
                {trip.is_featured && <i><Star size={12} fill="currentColor" /> {locale === "ku" ? "تایبەت" : locale === "ar" ? "مميز" : "Featured"}</i>}
              </div>
              <div className="portal-trip-body">
                {role === "admin" && <small className="portal-trip-company">{companyMap.get(trip.company_id) ?? "Tawaf company"}</small>}
                <h3>{trip.title}</h3>
                <div className="portal-trip-meta">
                  <span><CalendarDays size={14} /> {trip.days} {locale === "ku" ? "ڕۆژ" : locale === "ar" ? "أيام" : "days"}</span>
                  <span><Star size={14} /> {trip.acc_stars} {locale === "ku" ? "ئەستێرە" : locale === "ar" ? "نجوم" : "star"}</span>
                  <span><Plane size={14} /> {locale === "ku" ? (trip.transport === "plane" ? "فڕۆکە" : "پاس") : locale === "ar" ? (trip.transport === "plane" ? "طائرة" : "حافلة") : titleCase(trip.transport)}</span>
                </div>
                {/* Three columns rather than two: a departure with no return
                    beside it makes an admin open the trip to answer "how long
                    is this one". */}
                <div className="portal-trip-dates is-three">
                  <div><small>{t.departure}</small><b className={departed ? "is-past" : undefined}>{formatDate(trip.departure_date, true)}</b></div>
                  <div><small>{locale === "ku" ? "گەڕانەوە" : locale === "ar" ? "العودة" : "Return"}</small><b>{formatDate(trip.return_date, true)}</b></div>
                  <div><small>{locale === "ku" ? "نرخ / بۆ هەر کەسێک" : locale === "ar" ? "السعر / للمعتمر" : "Price / pilgrim"}</small><b>{formatIqd(trip.price_iqd)}</b></div>
                </div>
                <div className="portal-capacity">
                  <span><b>{trip.seats_reserved ?? 0}</b> {locale === "ku" ? `لە ${trip.capacity ?? "—"} شوێن` : locale === "ar" ? `من ${trip.capacity ?? "—"} مقعد` : `of ${trip.capacity ?? "—"} seats`}</span>
                  <small>{Math.round(fill)}% {locale === "ku" ? "پڕبووەتەوە" : locale === "ar" ? "ممتلئ" : "filled"}</small>
                  <i><b style={{ width: `${fill}%` }} /></i>
                </div>
                {departed && <p className="portal-departed-note"><AlertTriangle size={12} /> {locale === "ku" ? "بەرواری ڕۆیشتن تێپەڕیوە — پێویستە نوێ بکرێتەوە پێش بڵاوکردنەوە." : locale === "ar" ? "تاريخ المغادرة قد مضى — يجب تحديثه قبل النشر." : "Departure date has passed — it must be updated before this trip can be published again."}</p>}
                {(trip.rejection_reason || trip.review_reason) && (
                  <p className={`portal-review-note${trip.rejection_reason ? " is-rejection" : ""}`}>
                    <b>{trip.rejection_reason
                      ? (locale === "ku" ? "هۆکاری ڕەتکردنەوە: " : locale === "ar" ? "سبب الرفض: " : "Rejection reason: ")
                      : (locale === "ku" ? "تێبینی گۆڕانکاری: " : locale === "ar" ? "ملاحظة التعديل: " : "Changes note: ")}</b>
                    {trip.rejection_reason || trip.review_reason}
                  </p>
                )}
                <div className="portal-card-actions" onClick={(event) => event.stopPropagation()}>
                  {role === "admin" && trip.lifecycle_status === "pending_review" ? (
                    <>
                      <button type="button" onClick={() => setDetailTrip(trip)}><Eye size={14} /> {locale === "ku" ? "وردەکاری" : locale === "ar" ? "عرض التفاصيل" : "View details"}</button>
                      <button type="button" className="approve" onClick={() => reviewTrip(trip, "published")} disabled={busy === `trip-review-${trip.id}`}><Check size={14} /> {t.accept}</button>
                      <button type="button" className="changes" onClick={() => reviewTrip(trip, "needs_changes")} disabled={busy === `trip-review-${trip.id}`}><FileText size={14} /> {locale === "ku" ? "گۆڕانکاری" : locale === "ar" ? "طلب تعديل" : "Request changes"}</button>
                      <button type="button" className="danger" onClick={() => reviewTrip(trip, "rejected")} disabled={busy === `trip-review-${trip.id}`}><X size={14} /> {t.reject}</button>
                    </>
                  ) : role === "admin" && trip.lifecycle_status === "published" ? (
                    <>
                      <button type="button" onClick={() => toggleFeatured(trip)} disabled={busy === `trip-feature-${trip.id}`}>{busy === `trip-feature-${trip.id}` ? <TawafLoadingSpinner size={14} /> : <Star size={14} />} {trip.is_featured ? (locale === "ku" ? "لابردنی تایبەتکردن" : locale === "ar" ? "إزالة التمييز" : "Unfeature") : (locale === "ku" ? "تایبەتکردن" : locale === "ar" ? "تمييز الرحلة" : "Feature")}</button>
                      <button type="button" className="danger" onClick={() => takeDownTrip(trip)} disabled={busy === `trip-takedown-${trip.id}`}>{busy === `trip-takedown-${trip.id}` ? <TawafLoadingSpinner size={14} /> : <X size={14} />} {locale === "ku" ? "لابردن لە بازاڕ" : locale === "ar" ? "إنزال من السوق" : "Take down"}</button>
                    </>
                  ) : role === "agency" && ["draft", "needs_changes", "published"].includes(trip.lifecycle_status) ? (
                    <button type="button" className={trip.lifecycle_status === "published" ? "danger" : "approve"} onClick={() => agencyTripAction(trip)} disabled={busy === `trip-${trip.id}`}>
                      {busy === `trip-${trip.id}` ? <TawafLoadingSpinner size={14} /> : trip.lifecycle_status === "published" ? <X size={14} /> : <ArrowUpRight size={14} />}
                      {trip.lifecycle_status === "published" ? (locale === "ku" ? "ڕاگرتنی گەشت" : locale === "ar" ? "إيقاف مؤقت" : "Pause trip") : (locale === "ku" ? "ناردن بۆ پێداچوونەوە" : locale === "ar" ? "إرسال للمراجعة" : "Submit for review")}
                    </button>
                  ) : <span className="portal-card-note">{locale === "ku" ? "هیچ کردارێک پێویست نییە" : locale === "ar" ? "لا إجراء مطلوب" : "No action required"}</span>}
                </div>
              </div>
            </article>
          );
        })}
        {!trips.length && <EmptyState icon={Plane} title={t.noTripsFound} text={role === "agency" ? t.noTripsCreated : (locale === "ku" ? "گەڕانێکی تر یان فلتەرێکی تر تاقی بکەرەوە." : locale === "ar" ? "حاول البحث بكلمات أخرى أو تغيير الفلاتر." : "Try another search or status filter.")} />}
      </section>
      {detailTrip && (
        <TripDetailModal
          trip={detailTrip}
          companyName={companyMap.get(detailTrip.company_id) ?? "Tawaf company"}
          data={data}
          locale={locale}
          role={role}
          busy={busy}
          runAction={runAction}
          askReason={askReason}
          onReview={(decision) => reviewTrip(detailTrip, decision)}
          onClose={() => setDetailTrip(null)}
        />
      )}
    </>
  );
}

// ---------- Booking detail + document/visa review ----------

const PASSPORT_BUCKET = "booking-passports";
const isImagePath = (path: string | null | undefined) => /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(path ?? "");

type LightboxImage = { url: string; label: string };

// Full-screen zoomable viewer. Reviewers flip between a traveller's passport /
// selfie / document scans while zoomed in to check faces and passport numbers.
function ImageLightbox({ images, index, onClose }: { images: LightboxImage[]; index: number; onClose: () => void }) {
  const [current, setCurrent] = useState(index);
  const [zoom, setZoom] = useState(1);
  useEffect(() => { setCurrent(index); setZoom(1); }, [index]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") { setCurrent((c) => Math.min(images.length - 1, c + 1)); setZoom(1); }
      if (event.key === "ArrowLeft") { setCurrent((c) => Math.max(0, c - 1)); setZoom(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);
  const image = images[current];
  if (!image) return null;
  return (
    <div className="booking-lightbox" onClick={onClose}>
      <div className="booking-lightbox-bar" onClick={(event) => event.stopPropagation()}>
        <span>{image.label}{images.length > 1 ? ` · ${current + 1}/${images.length}` : ""}</span>
        <div className="booking-lightbox-tools">
          <button type="button" onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} aria-label="Zoom out">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(1)))} aria-label="Zoom in">+</button>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
      </div>
      <div className="booking-lightbox-stage" onClick={(event) => event.stopPropagation()}>
        {images.length > 1 && current > 0 && <button type="button" className="booking-lightbox-nav prev" onClick={() => { setCurrent((c) => c - 1); setZoom(1); }}>‹</button>}
        <img src={image.url} alt={image.label} style={{ transform: `scale(${zoom})` }} onWheel={(event) => { event.preventDefault(); setZoom((z) => Math.min(4, Math.max(1, +(z - Math.sign(event.deltaY) * 0.25).toFixed(2)))); }} />
        {images.length > 1 && current < images.length - 1 && <button type="button" className="booking-lightbox-nav next" onClick={() => { setCurrent((c) => c + 1); setZoom(1); }}>›</button>}
      </div>
    </div>
  );
}

const VISA_STEPS = ["not_started", "submitted", "under_review", "approved", "rejected"] as const;

function TravellerReviewCard({ traveller, docs, booking, role, busy, runAction, askReason, locale, rooms, assignments, onAssignRoom, onOpenImages }: {
  traveller: BookingTraveller;
  docs: TravellerDocument[];
  booking: Booking;
  role: Role;
  busy: string;
  runAction: RunAction;
  askReason: AskReason;
  locale: "ku" | "ar" | "en";
  rooms: Array<{ id: string; city: string; label: string; capacity: number; gender_policy: string }>;
  assignments: Array<{ room_id: string; traveller_id: string }>;
  onAssignRoom: (roomId: string, travellerId: string) => void;
  onOpenImages: (images: LightboxImage[], index: number) => void;
}) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const canReview = role === "agency"; // admin is read-only for document/visa verdicts
  const rowBusy = busy === `traveller-${traveller.id}`;
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [visaRef, setVisaRef] = useState(traveller.visa_reference ?? "");
  const [seat, setSeat] = useState(traveller.transport_seat ?? "");

  // The app writes an upload to BOTH booking_travellers.passport_image_path /
  // .selfie_image_path AND a traveller_documents row pointing at the very same
  // object, so listing the two sources naively showed every file twice — two
  // uploads rendered as four tiles. traveller_documents wins because it is the
  // richer record (id, kind, review status); the legacy columns only fill in for
  // travellers uploaded before that table existed.
  const seenPaths = new Set(docs.map((d) => `${d.storage_bucket}:${d.storage_path}`));
  const legacy = (path: string | null, key: string, label: string) =>
    path && !seenPaths.has(`${PASSPORT_BUCKET}:${path}`)
      ? { key, bucket: PASSPORT_BUCKET, path, label, image: true }
      : null;

  const docLabel = (kind: string) => {
    if (kind === "passport") return tr("پاسپۆرت", "جواز السفر", "Passport");
    if (kind === "personal_photo" || kind === "selfie") return tr("وێنەی کەسی", "صورة شخصية", "Personal photo");
    return titleCase(kind);
  };

  // Passport first: it is the document a reviewer checks first and the one a
  // visa decision hangs on. traveller_documents arrives newest-first, which put
  // whichever file happened to be uploaded last in front.
  const kindRank = (kind: string) => (kind === "passport" ? 0 : kind === "personal_photo" || kind === "selfie" ? 1 : 2);

  const sources = [
    ...[...docs]
      .sort((a, b) => kindRank(a.kind) - kindRank(b.kind))
      .map((d) => ({ key: d.id, bucket: d.storage_bucket, path: d.storage_path, label: docLabel(d.kind), image: isImagePath(d.storage_path) })),
    legacy(traveller.passport_image_path, "passport", tr("پاسپۆرت", "جواز السفر", "Passport")),
    legacy(traveller.selfie_image_path, "selfie", tr("وێنەی کەسی", "صورة شخصية", "Personal photo")),
  ].filter(Boolean) as Array<{ key: string; bucket: string; path: string; label: string; image: boolean }>;
  const signKey = sources.map((s) => `${s.bucket}:${s.path}`).join("|");

  useEffect(() => {
    setVisaRef(traveller.visa_reference ?? "");
    setSeat(traveller.transport_seat ?? "");
  }, [traveller.visa_reference, traveller.transport_seat]);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = getSupabase();
      const entries = await Promise.all(sources.map(async (s) => {
        const { data } = await supabase.storage.from(s.bucket).createSignedUrl(s.path, 3600);
        return [s.key, data?.signedUrl ?? ""] as const;
      }));
      if (active) setSigned(Object.fromEntries(entries.filter(([, url]) => url)));
    })();
    return () => { active = false; };
  }, [signKey]);

  // The name travels into the lightbox too — a full-screen passport with only
  // "Passport" on it tells a reviewer nothing about whose it is.
  const visible = sources.filter((s) => s.image && signed[s.key]);
  const galleryImages: LightboxImage[] = visible.map((s) => ({ url: signed[s.key], label: `${traveller.full_name} · ${s.label}` }));
  const openImage = (key: string) => {
    // Matched on the source key rather than the label, which is no longer
    // unique once two travellers each have a "Passport".
    const idx = visible.findIndex((s) => s.key === key);
    if (idx >= 0) onOpenImages(galleryImages, idx);
  };

  async function approveDocuments() {
    await runAction(`traveller-${traveller.id}`, () => getSupabase().rpc("update_traveller_operations", { p_traveller_id: traveller.id, p_document_status: "approved" }), tr("بەڵگەنامەکان پەسەندکران.", "تمت الموافقة على المستندات.", "Documents approved."));
  }
  async function rejectDocuments() {
    const reason = await askReason(tr("بۆچی بەڵگەنامەکان ڕەتدەکرێنەوە؟ (زیارەتکار ئەمە دەبینێت)", "لماذا ترفض المستندات؟ (يراها المعتمر)", "Why are the documents rejected? (the pilgrim sees this)"));
    if (!reason) return;
    await runAction(`traveller-${traveller.id}`, () => getSupabase().rpc("update_traveller_operations", { p_traveller_id: traveller.id, p_document_status: "rejected", p_document_reason: reason }), tr("بەڵگەنامەکان ڕەتکرانەوە و زیارەتکار ئاگادار کرایەوە.", "تم رفض المستندات وإبلاغ المعتمر.", "Documents rejected — the pilgrim was notified."));
  }
  async function setVisa(status: string) {
    let reason: string | null = null;
    if (status === "rejected") {
      reason = await askReason(tr("هۆکاری ڕەتکردنەوەی ڤیزا:", "سبب رفض التأشيرة:", "Reason the visa was rejected:"));
      if (!reason) return;
    }
    await runAction(`traveller-${traveller.id}`, () => getSupabase().rpc("update_traveller_operations", { p_traveller_id: traveller.id, p_visa_status: status, p_visa_reference: visaRef || null, p_visa_reason: reason }), tr("دۆخی ڤیزا نوێکرایەوە.", "تم تحديث حالة التأشيرة.", "Visa status updated."));
  }
  async function saveSeat() {
    await runAction(`traveller-${traveller.id}`, () => getSupabase().rpc("update_traveller_operations", { p_traveller_id: traveller.id, p_transport_seat: seat || null }), tr("کورسی گواستنەوە پاشەکەوتکرا.", "تم حفظ مقعد النقل.", "Transport seat saved."));
  }

  const currentRoomByCity = new Map<string, string>();
  assignments.filter((a) => a.traveller_id === traveller.id).forEach((a) => {
    const room = rooms.find((r) => r.id === a.room_id);
    if (room) currentRoomByCity.set(room.city, room.id);
  });
  const cities = Array.from(new Set(rooms.map((r) => r.city)));

  return (
    <article className="booking-traveller">
      <header className="booking-traveller-head">
        <div className="booking-traveller-id">
          <span className="booking-traveller-avatar"><UserRound size={16} /></span>
          <div>
            <b>{traveller.full_name}{traveller.is_lead && <i className="booking-lead-chip">{tr("سەرۆک", "قائد", "Lead")}</i>}</b>
            <small>{[traveller.passport_no && `${tr("پاسپۆرت", "جواز", "Passport")} ${traveller.passport_no}`, traveller.nationality, traveller.gender && titleCase(traveller.gender), traveller.date_of_birth && formatDate(traveller.date_of_birth, true)].filter(Boolean).join(" · ") || tr("زانیاری کەسی کەمە", "بيانات شخصية ناقصة", "No identity details")}</small>
          </div>
        </div>
        <div className="booking-traveller-pills">
          <span className="booking-pill-label">{tr("بەڵگەنامە", "المستندات", "Documents")}</span>
          <StatusPill status={traveller.document_status} />
          <span className="booking-pill-label">{tr("ڤیزا", "التأشيرة", "Visa")}</span>
          <StatusPill status={traveller.visa_status} />
        </div>
      </header>

      {traveller.document_reason && <p className="booking-reason-note"><AlertTriangle size={12} /> {tr("هۆکاری ڕەتکردنەوە", "سبب الرفض", "Rejection note")}: {traveller.document_reason}</p>}

      {/* Says whose documents these are. On a family booking the tiles for four
          people otherwise run together as one undifferentiated wall of
          passports with nothing tying a photo to a person. */}
      <div className="booking-doc-owner">
        <span>{tr("بەڵگەنامەکانی", "مستندات", "Documents of")} <b>{traveller.full_name}</b></span>
        {sources.length > 0 && <small>{sources.length}</small>}
      </div>

      <div className="booking-doc-row">
        {sources.length === 0 && <div className="booking-doc-empty"><Camera size={14} /> {tr("هێشتا هیچ بەڵگەنامەیەک بارنەکراوە", "لم يتم رفع أي مستند بعد", "No documents uploaded yet")}</div>}
        {sources.map((s) => {
          const url = signed[s.key];
          if (s.image) {
            return (
              <button type="button" key={s.key} className="booking-doc-thumb" onClick={() => openImage(s.key)} disabled={!url}>
                {url ? <img src={url} alt={s.label} loading="lazy" /> : <span className="booking-doc-loading"><TawafLoadingSpinner size={14} /></span>}
                <small>{s.label}</small>
              </button>
            );
          }
          return (
            <a key={s.key} className="booking-doc-file" href={url || undefined} target="_blank" rel="noreferrer">
              <FileText size={16} /><small>{s.label}</small>
            </a>
          );
        })}
      </div>

      {canReview && (
        <div className="booking-review-actions">
          <button type="button" className="approve" onClick={approveDocuments} disabled={rowBusy || traveller.document_status === "approved" || traveller.document_status === "missing"}>
            {rowBusy ? <TawafLoadingSpinner size={13} /> : <Check size={13} />} {tr("پەسەندکردنی بەڵگەنامە", "قبول المستندات", "Approve documents")}
          </button>
          <button type="button" className="danger" onClick={rejectDocuments} disabled={rowBusy || traveller.document_status === "missing"}>
            <X size={13} /> {tr("ڕەتکردنەوە", "رفض", "Reject")}
          </button>
        </div>
      )}

      {canReview && (
        <div className="booking-ops-grid">
          <div className="booking-ops-block">
            <label>{tr("قۆناغی ڤیزا", "مرحلة التأشيرة", "Visa stage")}</label>
            <div className="booking-visa-steps">
              {VISA_STEPS.filter((s) => s !== "not_started").map((s) => (
                <button type="button" key={s} className={traveller.visa_status === s ? "is-active" : ""} onClick={() => setVisa(s)} disabled={rowBusy}>{titleCase(s)}</button>
              ))}
            </div>
            <div className="booking-inline-field">
              <input value={visaRef} onChange={(event) => setVisaRef(event.target.value)} placeholder={tr("ژمارەی ڤیزا", "رقم التأشيرة", "Visa reference")} />
            </div>
            {traveller.visa_reason && <small className="booking-inline-note">{traveller.visa_reason}</small>}
          </div>
          <div className="booking-ops-block">
            <label>{tr("کورسی گواستنەوە", "مقعد النقل", "Transport seat")}</label>
            <div className="booking-inline-field">
              <input value={seat} onChange={(event) => setSeat(event.target.value)} placeholder={tr("وەک B12", "مثل B12", "e.g. B12")} />
              <button type="button" onClick={saveSeat} disabled={rowBusy || seat === (traveller.transport_seat ?? "")}>{tr("پاشەکەوت", "حفظ", "Save")}</button>
            </div>
            {cities.length > 0 && (
              <>
                <label style={{ marginTop: 10 }}>{tr("ژوور", "الغرفة", "Room")}</label>
                {cities.map((city) => (
                  <div className="booking-inline-field" key={city}>
                    <select value={currentRoomByCity.get(city) ?? ""} onChange={(event) => event.target.value && onAssignRoom(event.target.value, traveller.id)} disabled={rowBusy}>
                      <option value="">{titleCase(city)} — {tr("ژوور هەڵبژێرە", "اختر غرفة", "select room")}</option>
                      {rooms.filter((r) => r.city === city).map((r) => (
                        <option key={r.id} value={r.id}>{r.label} ({r.capacity} · {titleCase(r.gender_policy)})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

// Mirrors the Flutter client's getClientBookingProgress (client_booking_progress.dart)
// so the agency sees the exact same four-stage journey the pilgrim sees. Stage 0 = a
// terminal state (cancelled/rejected/expired). Returns 1..4 otherwise.
//   1 Booked · 2 Documents · 3 Visa · 4 Ready
function bookingJourneyStage(stage: string, docs: string[], visas: string[]): number {
  if (["ready", "in_progress", "completed"].includes(stage)) return 4;
  if (["cancelled", "rejected", "expired"].includes(stage)) return 0;
  if (stage === "awaiting_payment" || stage === "requested") return 1;
  // confirmed / needs_information → derived from traveller statuses, same precedence as the app
  if (visas.includes("rejected")) return 3;
  if (visas.includes("submitted") || visas.includes("under_review")) return 3;
  if (visas.length > 0 && visas.every((v) => v === "approved")) return 3;
  if (docs.includes("rejected") || stage === "needs_information") return 2;
  const submitted = new Set(["uploaded", "under_review", "approved"]);
  if (docs.length === 0 || docs.some((d) => !submitted.has(d))) return 2;
  if (docs.includes("uploaded") || docs.includes("under_review")) return 2;
  return 3; // every document approved → advance to the visa stage
}

function BookingJourney({ booking, travellers, locale }: { booking: Booking; travellers: BookingTraveller[]; locale: "ku" | "ar" | "en" }) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const docs = travellers.map((t) => t.document_status);
  const visas = travellers.map((t) => t.visa_status);
  const current = bookingJourneyStage(booking.operational_stage, docs, visas);
  // Mirrors the app: once the trip departs the final step stops being a promise
  // ("Ready") and becomes a state ("Travelling"), then "Completed" at the end.
  const travelling = booking.operational_stage === "in_progress";
  const finished = booking.operational_stage === "completed";
  const steps = [
    tr("حیجزکراو", "محجوز", "Booked"),
    tr("بەڵگەنامە", "المستندات", "Documents"),
    tr("ڤیزا", "التأشيرة", "Visa"),
    travelling
      ? tr("لە گەشتدا", "في الرحلة", "Travelling")
      : finished
        ? tr("تەواوبوو", "مكتملة", "Completed")
        : tr("ئامادە", "جاهز", "Ready"),
  ];
  if (current === 0) {
    return (
      <div className="booking-journey terminal">
        <span className="booking-journey-terminal-dot"><X size={13} /></span>
        {tr("ئەم حیجزە کۆتایی هاتووە", "انتهى هذا الحجز", "This booking has ended")} · <StatusPill status={booking.operational_stage} />
      </div>
    );
  }
  return (
    <div className="booking-journey" role="group" aria-label="Booking progress">
      {steps.map((label, index) => {
        const step = index + 1;
        // A completed trip has no "current" step left — every dot is a tick.
        const state = step < current ? "done" : step === current ? (finished ? "done" : "active") : "todo";
        return (
          <div key={label} className={`booking-journey-step ${state}`}>
            <span className="booking-journey-dot">{state === "done" ? <Check size={13} /> : step}</span>
            <small>{label}</small>
            {index < steps.length - 1 && <i className="booking-journey-line" />}
          </div>
        );
      })}
    </div>
  );
}

function BookingDetailModal({ bookingId, data, role, busy, runAction, askReason, locale, onClose }: {
  bookingId: string;
  data: PortalData;
  role: Role;
  busy: string;
  runAction: RunAction;
  askReason: AskReason;
  locale: "ku" | "ar" | "en";
  onClose: () => void;
}) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const booking = data.bookings.find((b) => b.id === bookingId);
  const travellers = data.bookingTravellers.filter((t) => t.booking_id === bookingId);
  const tripTitle = data.trips.find((t) => t.id === booking?.package_id)?.title ?? tr("گەشتی عومرە", "رحلة عمرة", "Umrah trip");
  const companyName = data.companies.find((c) => c.id === booking?.company_id)?.name;
  const payment = data.payments.find((p) => p.booking_id === bookingId && p.status === "succeeded");
  const [rooms, setRooms] = useState<Array<{ id: string; city: string; label: string; capacity: number; gender_policy: string }>>([]);
  const [assignments, setAssignments] = useState<Array<{ room_id: string; traveller_id: string }>>([]);
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  useScrollLock();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !lightbox) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, lightbox]);

  const loadRooms = useCallback(async () => {
    if (!booking) return;
    const supabase = getSupabase();
    const roomsResult = await supabase.from("trip_rooms").select("id, city, label, capacity, gender_policy").eq("package_id", booking.package_id);
    const roomList = (roomsResult.data ?? []) as typeof rooms;
    setRooms(roomList);
    if (roomList.length) {
      const assignResult = await supabase.from("trip_room_assignments").select("room_id, traveller_id").in("room_id", roomList.map((r) => r.id));
      setAssignments((assignResult.data ?? []) as typeof assignments);
    } else {
      setAssignments([]);
    }
  }, [booking?.package_id]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  async function assignRoom(roomId: string, travellerId: string) {
    await runAction(`traveller-${travellerId}`, () => getSupabase().rpc("assign_traveller_room", { p_room_id: roomId, p_traveller_id: travellerId }), tr("ژوور دیاریکرا.", "تم تعيين الغرفة.", "Room assigned."));
    await loadRooms();
  }

  async function transition(action: string) {
    let reason: string | null = null;
    if (["reject", "request_information", "cancel"].includes(action)) {
      reason = await askReason(action === "request_information" ? tr("چی زانیارییەک کەمە؟", "ما هي المعلومات الناقصة؟", "What information is missing?") : tr("تکایە هۆکارێک زیاد بکە:", "يرجى إضافة سبب:", "Please add a reason:"));
      if (!reason) return;
    }
    await runAction(`booking-${bookingId}`, () => getSupabase().rpc("transition_booking", { p_booking_id: bookingId, p_action: action, p_reason: reason }), tr("دۆخی حیجز نوێکرایەوە.", "تم تحديث حالة الحجز.", "Booking updated."));
  }

  async function confirmCash() {
    await runAction(`booking-${bookingId}`, () => getSupabase().rpc("confirm_cash_received", { p_booking_id: bookingId, p_amount_iqd: null }), tr("پارەی نەختینە پشتڕاستکرایەوە.", "تم تأكيد الدفع النقدي.", "Cash payment confirmed."));
  }

  if (!booking) return null;
  const bookingBusy = busy === `booking-${bookingId}`;
  const remaining = Math.max(0, Number(booking.total_iqd) - Number(booking.amount_paid_iqd));
  const awaitingReview = travellers.filter((t) => t.document_status === "under_review").length;
  const allVisasApproved = travellers.length > 0 && travellers.every((t) => t.visa_status === "approved");
  const canManage = role === "agency";
  const expirySoon = booking.expires_at && ["requested", "needs_information", "awaiting_payment"].includes(booking.operational_stage);
  // The booking row has no return date, so it is read off the package.
  const bookingReturnDate = data.trips.find((item) => item.id === booking.package_id)?.return_date ?? null;
  const bookingNights = nightsBetween(booking.departure_date, bookingReturnDate);

  return (
    <div className="booking-modal-scrim" onClick={onClose}>
      <div className="booking-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="booking-modal-head">
          <div>
            <small>#{booking.id.slice(0, 8).toUpperCase()} · {tripTitle}{role === "admin" && companyName ? ` · ${companyName}` : ""}</small>
            <h2>{booking.travellers} {tr("زیارەتکار", "معتمر", "pilgrims")} · {formatIqd(booking.total_iqd)}</h2>
            <div className="booking-modal-tags">
              <StatusPill status={booking.operational_stage} />
              {awaitingReview > 0 && <span className="booking-tag warning">{awaitingReview} {tr("چاوەڕێی پێداچوونەوە", "بانتظار المراجعة", "awaiting review")}</span>}
            </div>
          </div>
          <button type="button" className="booking-modal-close" onClick={onClose} aria-label={tr("داخستن", "إغلاق", "Close")}><X size={18} /></button>
        </header>

        <div className="booking-modal-body">
          <BookingJourney booking={booking} travellers={travellers} locale={locale} />
          <section className="booking-summary-grid">
            <div><small>{tr("شێوازی پارەدان", "طريقة الدفع", "Payment")}</small><b>{titleCase(booking.pay_method)} · {titleCase(booking.pay_status)}</b></div>
            <div><small>{tr("دراوە / کۆ", "المدفوع / الإجمالي", "Paid / total")}</small><b>{formatIqd(booking.amount_paid_iqd)} / {formatIqd(booking.total_iqd)}</b></div>
            <div><small>{tr("ماوە", "المتبقي", "Remaining")}</small><b>{remaining ? formatIqd(remaining) : tr("هیچ", "لا شيء", "None")}</b></div>
            <div><small>{tr("ژوور", "الغرفة", "Room")}</small><b>{booking.room_label ?? (booking.room_occupancy ? `${booking.room_occupancy}-${tr("کەسی", "أشخاص", "bed")}` : "—")}</b></div>
            <div><small>{tr("تەلەفۆن", "الهاتف", "Phone")}</small><b dir="ltr">{booking.contact_phone ?? "—"}</b></div>
            <div><small>{tr("بەرواری ڕۆیشتن", "المغادرة", "Departure")}</small><b>{formatDate(booking.departure_date, true)}</b></div>
            {/* Return comes off the package: bookings have no return column. */}
            <div><small>{tr("بەرواری گەڕانەوە", "العودة", "Return")}</small><b>{formatDate(bookingReturnDate, true)}{bookingNights ? <em className="booking-nights"> · {bookingNights} {tr("شەو", "ليلة", bookingNights === 1 ? "night" : "nights")}</em> : null}</b></div>
            {expirySoon && <div><small>{tr("کۆتایی داواکاری", "انتهاء الطلب", "Request expires")}</small><b className={booking.expires_at && new Date(booking.expires_at) < new Date() ? "is-past" : undefined}>{relativeTime(booking.expires_at!)}</b></div>}
          </section>
          {booking.note && <p className="booking-note"><FileText size={12} /> {booking.note}</p>}

          <div className="booking-section-title"><UserRound size={14} /> {tr("زیارەتکاران و بەڵگەنامەکان", "المعتمرون والمستندات", "Pilgrims & documents")}{canManage && awaitingReview > 0 && <span className="booking-queue-badge">{awaitingReview}</span>}</div>
          {travellers.length === 0 && <p className="booking-empty">{tr("هیچ زیارەتکارێک تۆمار نەکراوە.", "لا يوجد معتمرون مسجلون.", "No travellers recorded.")}</p>}
          {travellers.map((traveller) => (
            <TravellerReviewCard
              key={traveller.id}
              traveller={traveller}
              docs={data.travellerDocuments.filter((d) => d.traveller_id === traveller.id)}
              booking={booking}
              role={role}
              busy={busy}
              runAction={runAction}
              askReason={askReason}
              locale={locale}
              rooms={rooms}
              assignments={assignments}
              onAssignRoom={assignRoom}
              onOpenImages={(images, index) => setLightbox({ images, index })}
            />
          ))}
        </div>

        <footer className="booking-modal-actions">
          {canManage && booking.pay_method === "cash" && ["requested", "needs_information", "awaiting_payment"].includes(booking.operational_stage) && (
            <button type="button" className="approve" onClick={confirmCash} disabled={bookingBusy}><Banknote size={14} /> {tr("پشتڕاستکردنی پارەی نەختینە", "تأكيد الدفع النقدي", "Confirm cash received")}</button>
          )}
          {booking.pay_method === "fib" && ["requested", "needs_information", "awaiting_payment"].includes(booking.operational_stage) && (
            <span className="booking-readonly-note"><CreditCard size={14} /> {tr("پارەدانی FIB خۆکارانە پشتڕاست دەکرێتەوە", "دفع FIB يُؤكَّد تلقائياً", "FIB payment confirms automatically")}</span>
          )}
          {canManage && ["requested", "needs_information"].includes(booking.operational_stage) && (
            <button type="button" onClick={() => transition("request_information")} disabled={bookingBusy}>{tr("داوای زانیاری", "طلب معلومات", "Request info")}</button>
          )}
          {canManage && booking.operational_stage === "confirmed" && (
            <button type="button" className="approve" onClick={() => transition("ready")} disabled={bookingBusy || !allVisasApproved} title={allVisasApproved ? undefined : tr("هەموو ڤیزاکان دەبێت پەسەند بکرێن", "يجب اعتماد كل التأشيرات", "All visas must be approved first")}><ClipboardCheck size={14} /> {tr("ئامادەکردن", "جاهز", "Mark ready")}</button>
          )}
          {canManage && booking.operational_stage === "ready" && (
            <button type="button" className="approve" onClick={() => transition("start")} disabled={bookingBusy}><Plane size={14} /> {tr("دەستپێکردنی گەشت", "بدء الرحلة", "Start trip")}</button>
          )}
          {canManage && booking.operational_stage === "in_progress" && (
            <button type="button" className="approve" onClick={() => transition("complete")} disabled={bookingBusy}><Check size={14} /> {tr("تەواوکردن", "إكمال", "Complete")}</button>
          )}
          {canManage && ["requested", "needs_information", "awaiting_payment"].includes(booking.operational_stage) && (
            <button type="button" className="danger" onClick={() => transition("reject")} disabled={bookingBusy}><X size={14} /> {tr("ڕەتکردنەوە", "رفض", "Reject")}</button>
          )}
          {canManage && ["confirmed", "ready"].includes(booking.operational_stage) && (
            <button type="button" className="danger" onClick={() => transition("cancel")} disabled={bookingBusy}>{tr("هەڵوەشاندنەوە", "إلغاء", "Cancel")}</button>
          )}
          {/* The nightly safety net moves these on its own, so say so rather than
              letting a stage change look like it happened by magic. */}
          {["confirmed", "ready"].includes(booking.operational_stage) && booking.departure_date && booking.departure_date <= new Date().toISOString().slice(0, 10) && (
            <span className="booking-readonly-note"><Clock3 size={14} /> {tr("بەرواری ڕۆیشتن هاتووە — ئەمشەو خۆکارانە دەست پێدەکات ئەگەر دەستی پێنەکەیت", "حان موعد المغادرة — ستبدأ تلقائياً الليلة إن لم تبدأها", "Departure has arrived — this starts automatically tonight if you don't")}</span>
          )}
          {booking.operational_stage === "in_progress" && (
            <span className="booking-readonly-note"><Clock3 size={14} /> {tr("ڕۆژێک دوای گەڕانەوە خۆکارانە تەواو دەبێت", "تُكمل تلقائياً بعد يوم من العودة", "Completes automatically a day after the return date")}</span>
          )}
          {role === "admin" && <span className="booking-readonly-note"><ShieldCheck size={14} /> {tr("چاودێری تەنها-خوێندنەوە", "إشراف للقراءة فقط", "Read-only oversight")}</span>}
        </footer>
      </div>
      {lightbox && <ImageLightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// Admin-only oversight: how quickly each agency turns an uploaded document into a
// verdict. Derived from traveller_documents (created_at = upload, reviewed_at =
// verdict) so slow agencies surface without any write access.
function DocumentSlaPanel({ data, companyMap, locale }: { data: PortalData; companyMap: Map<string, string>; locale: "ku" | "ar" | "en" }) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const reviewed = data.travellerDocuments.filter((d) => d.reviewed_at);
  const pending = data.travellerDocuments.filter((d) => d.status === "under_review");
  const hours = (a: string, b: string) => (new Date(a).getTime() - new Date(b).getTime()) / 3.6e6;
  const byCompany = new Map<string, { total: number; sum: number; pending: number; oldest: number }>();
  reviewed.forEach((d) => {
    const row = byCompany.get(d.company_id) ?? { total: 0, sum: 0, pending: 0, oldest: 0 };
    row.total += 1; row.sum += hours(d.reviewed_at!, d.created_at);
    byCompany.set(d.company_id, row);
  });
  pending.forEach((d) => {
    const row = byCompany.get(d.company_id) ?? { total: 0, sum: 0, pending: 0, oldest: 0 };
    row.pending += 1; row.oldest = Math.max(row.oldest, hours(new Date().toISOString(), d.created_at));
    byCompany.set(d.company_id, row);
  });
  const rows = Array.from(byCompany.entries())
    .map(([id, r]) => ({ id, name: companyMap.get(id) ?? "Company", avg: r.total ? r.sum / r.total : null, total: r.total, pending: r.pending, oldest: r.oldest }))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  const overallAvg = reviewed.length ? reviewed.reduce((s, d) => s + hours(d.reviewed_at!, d.created_at), 0) / reviewed.length : null;
  const fmtH = (h: number | null) => (h == null ? "—" : h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`);
  if (!rows.length) return null;
  return (
    <section className="portal-panel portal-table-panel" style={{ marginTop: 16 }}>
      <PanelHeader title={tr("خێرایی پێداچوونەوەی بەڵگەنامە", "سرعة مراجعة المستندات", "Document review SLA")} subtitle={tr(`ناوەندی کاتی بڕیاردان: ${fmtH(overallAvg)} · ${pending.length} چاوەڕێن`, `متوسط زمن القرار: ${fmtH(overallAvg)} · ${pending.length} قيد الانتظار`, `Avg verdict time: ${fmtH(overallAvg)} · ${pending.length} pending`)} />
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead><tr><th>{tr("کۆمپانیا", "الشركة", "Agency")}</th><th>{tr("ناوەندی کات", "متوسط الزمن", "Avg time")}</th><th>{tr("پێداچووەوە", "تمت المراجعة", "Reviewed")}</th><th>{tr("چاوەڕێ", "قيد الانتظار", "Pending")}</th><th>{tr("کۆنترین چاوەڕێ", "أقدم انتظار", "Oldest waiting")}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.name}</b></td>
                <td className={r.avg != null && r.avg > 48 ? "" : undefined}><b style={r.avg != null && r.avg > 48 ? { color: "#9c493e" } : undefined}>{fmtH(r.avg)}</b></td>
                <td>{r.total}</td>
                <td>{r.pending > 0 ? <StatusPill status="under_review" /> : "0"} {r.pending > 0 ? r.pending : ""}</td>
                <td>{r.pending > 0 ? fmtH(r.oldest) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Booking card state model ────────────────────────────────────────────────
// `operational_stage` carries ten values; a card only needs five weights. The
// mapping is explicit rather than a default-else so a stage added later shows
// up here as a compile-visible gap instead of silently rendering as "settled".
//
// Note `in_progress` means the pilgrims are ON THE GROUND — it is not a
// documents-in-progress state. Document and visa work happens inside
// `confirmed`, which is why blockers promote that stage rather than a stage of
// their own.
type BookingTier = "urgent" | "blocked" | "settled" | "journey" | "inert";

const PENDING_STAGES = ["requested", "needs_information", "awaiting_payment"];
const INERT_STAGES = ["expired", "cancelled", "rejected"];
const JOURNEY_STAGES = ["in_progress", "completed"];

function bookingTier(stage: string, blockerCount: number): BookingTier {
  if (INERT_STAGES.includes(stage)) return "inert";
  if (PENDING_STAGES.includes(stage)) return "urgent";
  if (JOURNEY_STAGES.includes(stage)) return "journey";
  if (blockerCount > 0) return "blocked";
  return "settled"; // confirmed (clean) and ready
}

const TIER_ORDER: Record<BookingTier, number> = {
  urgent: 0,
  blocked: 1,
  settled: 2,
  journey: 3,
  inert: 4,
};

type DecoratedBooking = { booking: Booking; blockers: ReturnType<typeof bookingBlockers>; tier: BookingTier };

/// Orders the grid by what needs a human, not by when the row was written. The
/// old table sorted on created_at, which is how a month-old expired request
/// ended up above a payment window closing in nine minutes.
function compareBookingCards(a: DecoratedBooking, b: DecoratedBooking) {
  const byTier = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
  if (byTier !== 0) return byTier;
  // Inside the urgent tier the tightest deadline wins. A request with no expiry
  // set cannot be the most urgent thing on screen, so it sorts last.
  if (a.tier === "urgent") {
    const at = a.booking.expires_at ? new Date(a.booking.expires_at).getTime() : Infinity;
    const bt = b.booking.expires_at ? new Date(b.booking.expires_at).getTime() : Infinity;
    if (at !== bt) return at - bt;
  }
  return new Date(b.booking.created_at).getTime() - new Date(a.booking.created_at).getTime();
}

// What is stopping this booking from reaching 'ready'. Returned as counts so
// the card can say "1 of 3 passports rejected" instead of a bare status word.
function bookingBlockers(travellers: BookingTraveller[]) {
  const docsRejected = travellers.filter((t) => t.document_status === "rejected").length;
  const docsMissing = travellers.filter((t) => t.document_status === "missing").length;
  const docsReview = travellers.filter((t) => t.document_status === "under_review").length;
  const visaRejected = travellers.filter((t) => t.visa_status === "rejected").length;
  const visaPending = travellers.filter((t) => !["approved", "rejected"].includes(t.visa_status)).length;
  return {
    total: travellers.length,
    docsRejected,
    docsMissing,
    docsReview,
    visaRejected,
    visaPending,
    // Only things the agency must act on count as blockers. Visas merely
    // pending sit with the embassy, so they describe the stage without
    // promoting the card into the "needs attention" tier.
    count: docsRejected + docsMissing + docsReview + visaRejected,
  };
}

function blockerLabel(b: ReturnType<typeof bookingBlockers>, locale: "ku" | "ar" | "en"): string | null {
  const of = (n: number) => (locale === "ku" ? `${n} لە ${b.total}` : locale === "ar" ? `${n} من ${b.total}` : `${n} of ${b.total}`);
  if (b.docsRejected) return locale === "ku" ? `${of(b.docsRejected)} پاسپۆرت ڕەتکراوەتەوە` : locale === "ar" ? `${of(b.docsRejected)} جوازات مرفوضة` : `${of(b.docsRejected)} passports rejected`;
  if (b.visaRejected) return locale === "ku" ? `${of(b.visaRejected)} ڤیزا ڕەتکراوەتەوە` : locale === "ar" ? `${of(b.visaRejected)} تأشيرات مرفوضة` : `${of(b.visaRejected)} visas rejected`;
  if (b.docsReview) return locale === "ku" ? `${of(b.docsReview)} بەڵگەنامە چاوەڕێی پێداچوونەوەیە` : locale === "ar" ? `${of(b.docsReview)} مستندات بانتظار المراجعة` : `${of(b.docsReview)} awaiting your review`;
  if (b.docsMissing) return locale === "ku" ? `${of(b.docsMissing)} بەڵگەنامە نەنێردراوە` : locale === "ar" ? `${of(b.docsMissing)} مستندات لم تُرفع` : `${of(b.docsMissing)} documents not uploaded`;
  if (b.visaPending) return locale === "ku" ? `${of(b.visaPending)} ڤیزا لەلای باڵیۆزخانەیە` : locale === "ar" ? `${of(b.visaPending)} تأشيرات لدى السفارة` : `${of(b.visaPending)} visas with the embassy`;
  return null;
}

/// Whole days until departure. Negative once it has gone.
function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - midnight.getTime()) / 86400000);
}

function proximityLabel(days: number | null, locale: "ku" | "ar" | "en"): string | null {
  if (days == null) return null;
  if (days < 0) return locale === "ku" ? `${Math.abs(days)} ڕۆژ لەمەوپێش` : locale === "ar" ? `قبل ${Math.abs(days)} يوم` : `${Math.abs(days)} days ago`;
  if (days === 0) return locale === "ku" ? "ئەمڕۆ" : locale === "ar" ? "اليوم" : "Today";
  if (days === 1) return locale === "ku" ? "سبەینێ" : locale === "ar" ? "غداً" : "Tomorrow";
  return locale === "ku" ? `دوای ${days} ڕۆژ` : locale === "ar" ? `بعد ${days} يوم` : `in ${days} days`;
}

type CountdownLevel = "calm" | "warning" | "critical" | "lapsed";

function countdownLevel(msLeft: number): CountdownLevel {
  if (msLeft <= 0) return "lapsed";
  if (msLeft < 3600_000) return "critical"; // under an hour
  if (msLeft < 6 * 3600_000) return "warning";
  return "calm";
}

/// Digits only — the caller wraps this in an LTR island. Kurdish and Arabic run
/// right-to-left, and an un-isolated "2:05:44" renders with its segments in the
/// wrong order.
function countdownText(msLeft: number, locale: "ku" | "ar" | "en"): string {
  if (msLeft <= 0) return locale === "ku" ? "بەسەرچوو" : locale === "ar" ? "انتهت" : "Lapsed";
  const totalSeconds = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  // Precision tracks urgency. A twenty-hour deadline rendered as a ticking
  // 19:59:50 reads like an emergency and buries the two cards that are actually
  // minutes from lapsing, so seconds only appear once seconds matter.
  if (days >= 1) {
    return locale === "ku" ? `${days} ڕۆژ ${hours} کاتژمێر` : locale === "ar" ? `${days} يوم ${hours} ساعة` : `${days}d ${hours}h`;
  }
  if (totalSeconds >= 6 * 3600) {
    return locale === "ku" ? `${hours} کاتژمێر ${minutes} خولەک` : locale === "ar" ? `${hours} ساعة ${minutes} دقيقة` : `${hours}h ${minutes}m`;
  }
  return hours >= 1 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

function BookingsPage({ role, data, busy, runAction, askReason, locale }: { role: Role; data: PortalData; busy: string; runAction: RunAction; askReason: AskReason; locale: "ku" | "ar" | "en" }) {
  const t = dashboardTranslations[locale];
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"priority" | "newest" | "departure" | "payout">("priority");
  const [detailId, setDetailId] = useState<string | null>(null);
  const tripMap = new Map(data.trips.map((item) => [item.id, item.title]));
  // A booking stores only its departure date, so the return has to come from
  // the package it was made against — that is where the itinerary lives.
  const tripReturnMap = new Map(data.trips.map((item) => [item.id, item.return_date]));
  const companyMap = new Map(data.companies.map((item) => [item.id, item.name]));
  // Client name comes from the booking's lead traveller (falling back to the
  // first traveller on file). booking_travellers is already loaded and RLS-scoped,
  // so no extra query or schema change is needed here.
  const clientNameByBooking = new Map<string, string>();
  data.bookingTravellers.forEach((tr) => {
    const name = (tr.full_name || tr.local_name || "").trim();
    if (!name) return;
    if (tr.is_lead || !clientNameByBooking.has(tr.booking_id)) clientNameByBooking.set(tr.booking_id, name);
  });
  const travellersByBooking = new Map<string, BookingTraveller[]>();
  data.bookingTravellers.forEach((tr) => {
    const list = travellersByBooking.get(tr.booking_id);
    if (list) list.push(tr); else travellersByBooking.set(tr.booking_id, [tr]);
  });
  const awaitingByBooking = new Map<string, number>();
  data.bookingTravellers.forEach((tr) => {
    if (tr.document_status === "under_review") awaitingByBooking.set(tr.booking_id, (awaitingByBooking.get(tr.booking_id) ?? 0) + 1);
  });
  const docsAwaiting = data.bookingTravellers.filter((item) => item.document_status === "under_review").length;

  const allCards: DecoratedBooking[] = data.bookings.map((booking) => {
      const travellers = travellersByBooking.get(booking.id) ?? [];
      const blockers = bookingBlockers(travellers);
      return { booking, blockers, tier: bookingTier(booking.operational_stage, blockers.count) };
    });

  const normalizedQuery = query.trim().toLowerCase();
  const cards = allCards
    .filter(({ booking, blockers, tier }) => {
      const haystack = `${booking.id} ${tripMap.get(booking.package_id) ?? ""} ${clientNameByBooking.get(booking.id) ?? ""} ${companyMap.get(booking.company_id) ?? ""} ${booking.contact_phone ?? ""}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
      if (filter === "all") return true;
      if (filter === "attention") return tier === "urgent" || tier === "blocked";
      if (filter === "docs_review") return (awaitingByBooking.get(booking.id) ?? 0) > 0;
      return booking.operational_stage === filter;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.booking.created_at).getTime() - new Date(a.booking.created_at).getTime();
      if (sortBy === "departure") {
        const aDate = a.booking.departure_date ? new Date(`${a.booking.departure_date}T00:00:00`).getTime() : Infinity;
        const bDate = b.booking.departure_date ? new Date(`${b.booking.departure_date}T00:00:00`).getTime() : Infinity;
        return aDate - bDate;
      }
      if (sortBy === "payout") {
        const payout = (item: Booking) => Number(item.payout_iqd ?? 0) || Math.max(0, Number(item.total_iqd) - Number(item.commission_iqd ?? 0));
        return payout(b.booking) - payout(a.booking);
      }
      return compareBookingCards(a, b);
    });
  const bookings = cards.map(({ booking }) => booking);

  // One interval for the whole page rather than one per card, and only while a
  // countdown is actually on screen — an agency leaving this tab open on a list
  // of completed trips should not repaint every second.
  const [now, setNow] = useState(() => Date.now());
  const hasLiveCountdown = cards.some((c) => c.tier === "urgent" && c.booking.expires_at);
  useEffect(() => {
    if (!hasLiveCountdown) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasLiveCountdown]);

  async function transition(booking: Booking, action: string) {
    let reason: string | null = null;
    if (["reject", "request_information", "cancel"].includes(action)) {
      reason = await askReason(action === "request_information" ? (locale === "ku" ? "چی زانیارییەک کەمە؟" : locale === "ar" ? "ما هي المعلومات الناقصة؟" : "What information is missing?") : (locale === "ku" ? "تکایە هۆکارێک زیاد بکە:" : locale === "ar" ? "يرجى إضافة سبب:" : "Please add a reason:"));
      if (!reason) return;
    }
    await runAction(
      `booking-${booking.id}`,
      () => getSupabase().rpc("transition_booking", { p_booking_id: booking.id, p_action: action, p_reason: reason }),
      locale === "ku" ? `گۆڕینی دۆخی حیجزەکە ${action.replaceAll("_", " ")} تەواو بوو.` : locale === "ar" ? `تم تعديل حالة الحجز إلى ${action.replaceAll("_", " ")} بنجاح.` : `Booking ${action.replaceAll("_", " ")} completed.`,
    );
  }

  function exportCsv() {
    const header = ["Booking", "Trip", "Client", "Company", "Travellers", "Total IQD", "Paid IQD", "Stage", "Pay method", "Phone", "Departure", "Return", "Nights", "Created"];
    const rows = bookings.map((booking) => [
      booking.id.slice(0, 8).toUpperCase(),
      tripMap.get(booking.package_id) ?? "Umrah trip",
      clientNameByBooking.get(booking.id) ?? "",
      companyMap.get(booking.company_id) ?? "Company",
      booking.travellers,
      booking.total_iqd,
      booking.amount_paid_iqd,
      booking.operational_stage,
      booking.pay_method,
      booking.contact_phone ?? "",
      booking.departure_date ?? "",
      tripReturnMap.get(booking.package_id) ?? "",
      nightsBetween(booking.departure_date, tripReturnMap.get(booking.package_id) ?? null) ?? "",
      booking.created_at,
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    link.download = `tawaf-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const activeValue = data.bookings.filter((item) => !["cancelled", "rejected", "expired"].includes(item.operational_stage)).reduce((sum, item) => sum + Number(item.total_iqd), 0);
  const attentionCount = allCards.filter(({ tier }) => tier === "urgent" || tier === "blocked").length;
  const travellingCount = data.bookings.filter((item) => item.operational_stage === "in_progress").length;
  const filterOptions: Array<[string, string]> = [
    ["all", t.allAll || "All"],
    ["attention", locale === "ku" ? "پێویستی بە کردارە" : locale === "ar" ? "يتطلب إجراء" : "Needs action"],
    ["docs_review", locale === "ku" ? "پێداچوونەوەی بەڵگە" : locale === "ar" ? "مراجعة المستندات" : "Doc review"],
    ["requested", locale === "ku" ? "داواکراو" : locale === "ar" ? "مطلوب" : "Requested"],
    ["awaiting_payment", locale === "ku" ? "چاوەڕێی پارە" : locale === "ar" ? "في انتظار الدفع" : "Awaiting payment"],
    ["confirmed", locale === "ku" ? "پشتڕاستکراو" : locale === "ar" ? "مؤكد" : "Confirmed"],
    ["ready", locale === "ku" ? "ئامادە" : locale === "ar" ? "جاهز" : "Ready"],
    ["in_progress", locale === "ku" ? "لە گەشتدایە" : locale === "ar" ? "قيد التنفيذ" : "In progress"],
    ["completed", locale === "ku" ? "تەواوبوو" : locale === "ar" ? "مكتمل" : "Completed"],
    ["cancelled", locale === "ku" ? "هەڵوەشاوە" : locale === "ar" ? "ملغي" : "Cancelled"],
  ];
  const countForFilter = (id: string) => {
    if (id === "all") return data.bookings.length;
    if (id === "attention") return attentionCount;
    if (id === "docs_review") return data.bookings.filter((item) => (awaitingByBooking.get(item.id) ?? 0) > 0).length;
    return data.bookings.filter((item) => item.operational_stage === id).length;
  };

  return (
    <div className="booking-workspace">
      <PageHeading eyebrow={locale === "ku" ? "ئۆپەراسیۆنی گەشتیاران" : locale === "ar" ? "عمليات المسافرين" : "Traveller operations"} title={locale === "ku" ? "حیجزەکان" : locale === "ar" ? "الحجوزات" : "Bookings"} description={role === "admin" ? (locale === "ku" ? "چاودێری چالاکییەکانی حیجزکردن بکە لە سەرانسەری بازاڕی تەوافدا." : locale === "ar" ? "راقب نشاط الحجز عبر سوق طواف بالكامل." : "Monitor booking activity across the entire Tawaf marketplace.") : (locale === "ku" ? "داواکارییەکان بپشکنە، پارەدانەکان پشتڕاست بکەرەوە، و گەشتیاران ڕێکبخە لە هەر قۆناغێکی گەشتەکەدا." : locale === "ar" ? "راجع الطلبات، وأكد المدفوعات، وتابع المسافرين خلال كل مرحلة من الرحلة." : "Review requests, confirm payments and move travellers through every trip stage.")} action={<button className="portal-secondary-button" type="button" onClick={exportCsv} disabled={!bookings.length}><FileText size={15} /> {locale === "ku" ? "هەناردەکردنی CSV" : locale === "ar" ? "تصدير CSV" : "Export CSV"}</button>} />

      <section className="booking-overview" aria-label={locale === "ku" ? "پوختەی حیجزەکان" : locale === "ar" ? "ملخص الحجوزات" : "Booking summary"}>
        <button type="button" className={filter === "attention" ? "is-active attention" : "attention"} onClick={() => setFilter("attention")}>
          <span><AlertTriangle size={18} /></span><p><small>{locale === "ku" ? "پێویستی بە کردارە" : locale === "ar" ? "يتطلب إجراء" : "Needs action"}</small><b>{attentionCount}</b></p><ArrowRight size={16} />
        </button>
        <button type="button" className={filter === "docs_review" ? "is-active documents" : "documents"} onClick={() => setFilter("docs_review")}>
          <span><FileCheck2 size={18} /></span><p><small>{locale === "ku" ? "بەڵگە چاوەڕێیە" : locale === "ar" ? "مستندات للمراجعة" : "Docs to review"}</small><b>{docsAwaiting}</b></p><ArrowRight size={16} />
        </button>
        <button type="button" className={filter === "in_progress" ? "is-active travelling" : "travelling"} onClick={() => setFilter("in_progress")}>
          <span><Plane size={18} /></span><p><small>{locale === "ku" ? "لە گەشتدان" : locale === "ar" ? "في الرحلة الآن" : "Travelling now"}</small><b>{travellingCount}</b></p><ArrowRight size={16} />
        </button>
        <div className="booking-overview-value">
          <span><CircleDollarSign size={18} /></span><p><small>{locale === "ku" ? "بەهای حیجزە چالاکەکان" : locale === "ar" ? "قيمة الحجوزات النشطة" : "Active booking value"}</small><b dir="ltr">{formatIqd(activeValue, true)}</b></p>
        </div>
      </section>

      <section className="booking-controls">
        <label className="booking-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={locale === "ku" ? "گەڕان بە ناو، گەشت، ژمارە یان کۆدی حیجز..." : locale === "ar" ? "ابحث بالاسم أو الرحلة أو الهاتف أو رقم الحجز..." : "Search name, trip, phone or booking ID…"} />
          {query && <button type="button" onClick={() => setQuery("")} aria-label={locale === "ku" ? "سڕینەوەی گەڕان" : locale === "ar" ? "مسح البحث" : "Clear search"}><X size={15} /></button>}
        </label>
        <label className="booking-sort">
          <span>{locale === "ku" ? "ڕیزکردن" : locale === "ar" ? "ترتيب" : "Sort"}</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
            <option value="priority">{locale === "ku" ? "پێشینەی کردار" : locale === "ar" ? "أولوية الإجراء" : "Action priority"}</option>
            <option value="newest">{locale === "ku" ? "نوێترین" : locale === "ar" ? "الأحدث" : "Newest first"}</option>
            <option value="departure">{locale === "ku" ? "نزیکترین بەرواری ڕۆیشتن" : locale === "ar" ? "أقرب مغادرة" : "Departure soonest"}</option>
            <option value="payout">{locale === "ku" ? "زۆرترین داهات" : locale === "ar" ? "أعلى مستحق" : "Highest payout"}</option>
          </select>
          <ChevronDown size={15} />
        </label>
        <div className="booking-filter-row">
          {filterOptions.map(([id, label]) => (
            <button type="button" key={id} className={filter === id ? "active" : undefined} onClick={() => setFilter(id)}>
              {label}<span>{countForFilter(id)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="booking-results">
        <header className="booking-results-head">
          <div>
            <h2>{locale === "ku" ? "ڕیزی حیجزەکان" : locale === "ar" ? "قائمة الحجوزات" : "Booking queue"}</h2>
            <p>{bookings.length} {locale === "ku" ? "حیجز لە ئەنجامەکاندا" : locale === "ar" ? "حجز في النتائج" : bookings.length === 1 ? "booking in view" : "bookings in view"}</p>
          </div>
          <span><ShieldCheck size={14} /> {locale === "ku" ? "پارێزراو بەپێی ڕۆڵ" : locale === "ar" ? "محمي حسب الصلاحية" : "Role-secured"}</span>
        </header>
        {cards.length ? (
          <div className="portal-booking-grid">
            {cards.map(({ booking, blockers, tier }) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                blockers={blockers}
                tier={tier}
                now={now}
                role={role}
                busy={busy}
                locale={locale}
                clientName={clientNameByBooking.get(booking.id) ?? null}
                tripTitle={tripMap.get(booking.package_id) ?? "Umrah trip"}
                returnDate={tripReturnMap.get(booking.package_id) ?? null}
                companyName={companyMap.get(booking.company_id) ?? "Company"}
                visasReady={visasReadyByBooking(data.bookingTravellers, booking.id)}
                onOpen={() => setDetailId(booking.id)}
                transition={(action) => transition(booking, action)}
                runAction={runAction}
              />
            ))}
          </div>
        ) : <EmptyState icon={BookOpenCheck} title={t.noBookingsFound} text={locale === "ku" ? "گەڕانێکی تر تاقی بکەرەوە یان فلتەرەکە بگۆڕە." : locale === "ar" ? "حاول البحث بكلمات أخرى أو تغيير الفلاتر." : "Try another search or status filter."} compact />}
      </section>
      {role === "admin" && <DocumentSlaPanel data={data} companyMap={companyMap} locale={locale} />}
      {detailId && (
        <BookingDetailModal
          bookingId={detailId}
          data={data}
          role={role}
          busy={busy}
          runAction={runAction}
          askReason={askReason}
          locale={locale}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

function BookingCard({
  booking, blockers, tier, now, role, busy, locale,
  clientName, tripTitle, returnDate, companyName, visasReady, onOpen, transition, runAction,
}: {
  booking: Booking;
  blockers: ReturnType<typeof bookingBlockers>;
  tier: BookingTier;
  now: number;
  role: Role;
  busy: string;
  locale: "ku" | "ar" | "en";
  clientName: string | null;
  tripTitle: string;
  /// From the booking's package — see tripReturnMap.
  returnDate: string | null;
  companyName: string;
  visasReady: boolean;
  onOpen: () => void;
  transition: (action: string) => void;
  runAction: RunAction;
}) {
  const t = dashboardTranslations[locale];
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  // Deliberately local and deliberately cosmetic: the number is already in the
  // response, and RLS is what actually decides who may read it. This only stops
  // a full grid of client numbers being readable over someone's shoulder.
  const [phoneShown, setPhoneShown] = useState(false);

  const total = Number(booking.total_iqd);
  const paid = Number(booking.amount_paid_iqd);
  const commission = Number(booking.commission_iqd ?? 0);
  // payout_iqd is the stored truth; the subtraction is a fallback for rows
  // written before the column was populated.
  const payout = Number(booking.payout_iqd ?? 0) || Math.max(0, total - commission);
  const partiallyPaid = paid > 0 && paid < total;

  const msLeft = booking.expires_at ? new Date(booking.expires_at).getTime() - now : null;
  const level = msLeft == null ? null : countdownLevel(msLeft);
  const showCountdown = tier === "urgent" && msLeft != null;
  const awaitingClient = tier === "urgent" && booking.pay_method !== "cash";

  const days = daysUntil(booking.departure_date);
  const proximity = proximityLabel(days, locale);
  const nights = nightsBetween(booking.departure_date, returnDate);
  const blocker = blockerLabel(blockers, locale);
  const inert = tier === "inert";
  const PayIcon = booking.pay_method === "cash" ? Banknote : booking.pay_method === "card" ? CreditCard : WalletCards;

  return (
    <article
      className={`portal-booking-card is-${tier}${showCountdown ? ` has-countdown is-${level}` : ""}`}
      data-booking-status={booking.operational_stage}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }}
    >
      {/* The single most decision-relevant thing on a pending card, so it sits
          above the reference rather than beside it. */}
      {showCountdown && (
        <div className="portal-booking-countdown">
          <Clock3 size={14} />
          {/* "auto", not "ltr": a bare clock like 07:06 has no strong character
              so it falls back to LTR and stays readable, while the Kurdish and
              Arabic long forms ("19 کاتژمێر 59 خولەک") keep their own word order
              instead of being reversed into nonsense by a forced LTR run. */}
          <b dir="auto">{countdownText(msLeft!, locale)}</b>
          <small>{msLeft! <= 0 ? tr("ماوەی پارەدان بەسەرچووە", "انتهت مهلة الدفع", "Payment window closed") : tr("ماوە بۆ پارەدان", "متبقٍ للدفع", "left to pay")}</small>
        </div>
      )}

      <header className="portal-booking-head">
        <div>
          <b>#{booking.id.slice(0, 8).toUpperCase()}</b>
          <small>{relativeTime(booking.created_at)}</small>
        </div>
        <StatusPill status={booking.operational_stage} />
      </header>

      {/* Net first: it is the number an agency is actually deciding on. Gross
          and commission stay available but stop competing with it.
          An expired or cancelled booking pays nothing, so labelling its figure
          "your payout" would state something false — it becomes what was lost
          instead, which is the thing worth knowing about a dead request. */}
      <div className="portal-booking-money">
        <small>{inert ? tr("داهاتی لەدەستچوو", "إيراد ضائع", "Payout lost") : tr("داهاتی تۆ", "صافي مستحقك", "Your payout")}</small>
        <b dir="ltr">{formatIqd(payout)}</b>
        <span>{tr(`${formatIqd(total)} کۆی گشتی · ${formatIqd(commission)} کۆمیشن`, `${formatIqd(total)} إجمالي · ${formatIqd(commission)} عمولة`, `${formatIqd(total)} gross · ${formatIqd(commission)} commission`)}</span>
      </div>

      <div className="portal-booking-client">
        <span><UserRound size={15} /></span>
        <div>
          <b>{clientName ?? tr("ناوی گەشتیار نییە", "لا يوجد اسم مسافر", "No traveller name")}</b>
          <small>{booking.travellers} {tr("گەشتیار", "مسافر", booking.travellers === 1 ? "traveller" : "travellers")}</small>
        </div>
        {booking.contact_phone && (
          phoneShown || (!PENDING_STAGES.includes(booking.operational_stage) && !inert) ? (
            <a className="portal-booking-phone" href={`tel:${booking.contact_phone}`} dir="ltr" onClick={(event) => event.stopPropagation()}>{booking.contact_phone}</a>
          ) : (
            <button
              type="button"
              className="portal-booking-phone is-locked"
              onClick={(event) => { event.stopPropagation(); setPhoneShown(true); }}
              title={tr("پیشاندانی ژمارە", "إظهار الرقم", "Reveal number")}
            >
              <Lock size={12} /> {tr("ژمارە", "الرقم", "Number")}
            </button>
          )
        )}
      </div>

      <div className="portal-booking-trip">
        <Plane size={13} />
        <div>
          <b>{tripTitle}</b>
          <small>
            {/* Departure–return, so the card answers "how long are they away"
                without opening anything. Isolated LTR: formatDateRange always
                returns Latin-script dates, and an un-isolated "01 Aug – 12 Aug
                2026" reorders its segments inside a Kurdish or Arabic line. */}
            <span dir="ltr">{formatDateRange(booking.departure_date, returnDate)}</span>
            {nights && <> · {nights} {tr("شەو", "ليلة", nights === 1 ? "night" : "nights")}</>}
            {proximity && <em className={days != null && days >= 0 && days <= 7 ? "is-imminent" : undefined}>{proximity}</em>}
            {role === "admin" ? ` · ${companyName}` : ""}
          </small>
        </div>
      </div>

      <div className="portal-booking-strip">
        <span className="portal-booking-method"><PayIcon size={13} /> {titleCase(booking.pay_method)}</span>
        {awaitingClient && <span className="portal-booking-waiting"><Hourglass size={12} /> {tr("چاوەڕێی پارەدانی کڕیار", "بانتظار دفع العميل", "Waiting on client")}</span>}
      </div>

      {/* Only drawn where a part-payment genuinely exists. A 0% bar on an
          expired card was pure noise. */}
      {partiallyPaid && (
        <div className="portal-booking-pay">
          <span>{tr(`${formatIqd(total - paid)} ماوە`, `متبقي ${formatIqd(total - paid)}`, `${formatIqd(total - paid)} due`)}</span>
          <small>{Math.round((paid / total) * 100)}%</small>
          <i><b style={{ width: `${Math.min(100, (paid / total) * 100)}%` }} /></i>
        </div>
      )}

      {tier === "blocked" && blocker && <p className="portal-booking-alert is-blocking"><AlertTriangle size={12} /> {blocker}</p>}
      {tier === "settled" && blocker && <p className="portal-booking-alert"><FileCheck2 size={12} /> {blocker}</p>}
      {inert && booking.status_reason && <p className="portal-booking-reason">{booking.status_reason}</p>}

      {/* An inert card gets no primary action at all — it is a record, not work.
          Opening it is still possible by clicking the card. */}
      {!inert && (
        <div className="portal-card-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="portal-action-button" onClick={onOpen}>
            {tier === "blocked" ? <><FileCheck2 size={14} /> {tr("بەڵگەنامەکان", "المستندات", "Documents")}</> : <><FileText size={14} /> {tr("پێداچوونەوە", "مراجعة", "Review")}</>}
          </button>
          <BookingActions booking={booking} busy={busy === `booking-${booking.id}`} transition={transition} role={role} runAction={runAction} locale={locale} visasReady={visasReady} />
        </div>
      )}
    </article>
  );
}

// The client app's tracker jumps to its final "Ready to travel" stage the moment
// operational_stage becomes 'ready' (see the app's client_booking_progress.dart),
// so "Mark ready" must stay locked until every traveller's visa is approved.
function visasReadyByBooking(travellers: BookingTraveller[], bookingId: string) {
  const rows = travellers.filter((item) => item.booking_id === bookingId);
  return rows.length > 0 && rows.every((item) => item.visa_status === "approved");
}

function BookingActions({ booking, busy, transition, role, runAction, locale, visasReady }: { booking: Booking; busy: boolean; transition: (action: string) => void; role: Role; runAction: RunAction; locale: "ku" | "ar" | "en"; visasReady: boolean }) {
  const t = dashboardTranslations[locale];
  if (busy) return <TawafLoadingSpinner size={16} />;
  if (["requested", "needs_information", "awaiting_payment"].includes(booking.operational_stage)) {
    return (
      <div className="portal-row-actions">
        {role === "agency" && booking.pay_method === "cash" && (
          <button type="button" className="approve" onClick={() => runAction(`booking-${booking.id}`, () => getSupabase().rpc("confirm_cash_received", { p_booking_id: booking.id, p_amount_iqd: null }), locale === "ku" ? "پارەی نەختینە پشتڕاستکرایەوە." : locale === "ar" ? "تم تأكيد الدفع النقدي." : "Cash payment confirmed.")}><Banknote size={14} /> {t.confirmCash}</button>
        )}
        {booking.operational_stage === "requested" && <button type="button" onClick={() => transition("request_information")}>{t.requestInfo}</button>}
        <button type="button" className="danger" onClick={() => transition("reject")}>{t.reject}</button>
      </div>
    );
  }
  if (booking.operational_stage === "confirmed") {
    return (
      <div className="portal-row-actions">
        <button type="button" className="approve" onClick={() => transition("ready")} disabled={!visasReady} title={visasReady ? undefined : (locale === "ku" ? "هەموو ڤیزاکان دەبێت پەسەند بکرێن پێش ئامادەکردن" : locale === "ar" ? "يجب اعتماد كل التأشيرات قبل التجهيز" : "All traveller visas must be approved first")}><ClipboardCheck size={14} /> {t.markReady}</button>
        <button type="button" className="danger" onClick={() => transition("cancel")}>{locale === "ku" ? "هەڵوەشاندنەوە" : locale === "ar" ? "إلغاء" : "Cancel"}</button>
      </div>
    );
  }
  if (booking.operational_stage === "ready") {
    return (
      <div className="portal-row-actions">
        <button type="button" className="approve" onClick={() => transition("start")}><Plane size={14} /> {t.startTrip}</button>
        <button type="button" className="danger" onClick={() => transition("cancel")}>{locale === "ku" ? "هەڵوەشاندنەوە" : locale === "ar" ? "إلغاء" : "Cancel"}</button>
      </div>
    );
  }
  if (booking.operational_stage === "in_progress") return <button type="button" className="portal-action-button" onClick={() => transition("complete")}><Check size={14} /> {t.complete}</button>;
  return null;
}

function FinancePage({ role, data, busy, runAction, locale }: { role: Role; data: PortalData; busy: string; runAction: RunAction; locale: "ku" | "ar" | "en" }) {
  const t = dashboardTranslations[locale];
  const collected = data.payments.filter((item) => item.status === "succeeded").reduce((sum, item) => sum + Number(item.amount_iqd), 0);
  const commissionOwed = data.commissions.filter((item) => item.status === "owed").reduce((sum, item) => sum + Number(item.amount_iqd), 0);
  const commissionCollected = data.commissions.filter((item) => item.status === "collected").reduce((sum, item) => sum + Number(item.amount_iqd), 0);
  const companyMap = new Map(data.companies.map((item) => [item.id, item.name]));

  return (
    <>
      <PageHeading eyebrow={locale === "ku" ? "ئۆپەراسیۆنە دارایییەکان" : locale === "ar" ? "العمليات المالية" : "Financial operations"} title={role === "admin" ? t.finance : t.bookingValue} description={role === "admin" ? (locale === "ku" ? "چاودێری پارەدانەکانی بازاڕ و تسویەی کۆمسیۆنی کۆمپانیاکان بکە." : locale === "ar" ? "تتبع مدفوعات السوق وتسوية عمولة الشركة." : "Track marketplace payments and company commission settlement.") : (locale === "ku" ? "پارە وەرگیراوەکان، کۆمسیۆنی تەواف، حیساباتی خۆت و مێژووی دەرهێنانی پارە ببینە." : locale === "ar" ? "شاهد المدفوعات المستلمة، وعمولة طواف، ودفتر الحسابات وتاريخ عمليات السحب." : "See received payments, Tawaf commission, your ledger and payout history.")} />
      <section className="portal-metric-grid">
        <MetricCard icon={WalletCards} label={t.paymentsReceived} value={formatIqd(collected, true)} detail={locale === "ku" ? `${data.payments.filter((item) => item.status === "succeeded").length} پارەدانی سەرکەوتوو` : locale === "ar" ? `${data.payments.filter((item) => item.status === "succeeded").length} مدفوعات ناجحة` : `${data.payments.filter((item) => item.status === "succeeded").length} successful payments`} tone="green" />
        <MetricCard icon={Clock3} label={t.totalOwed} value={formatIqd(commissionOwed, true)} detail={locale === "ku" ? `${data.commissions.filter((item) => item.status === "owed").length} بڕگەی کراوە` : locale === "ar" ? `${data.commissions.filter((item) => item.status === "owed").length} عناصر مفتوحة` : `${data.commissions.filter((item) => item.status === "owed").length} open items`} tone="gold" />
        <MetricCard icon={BadgeCheck} label={locale === "ku" ? "کۆمسیۆنی یەکلاکراوە" : locale === "ar" ? "العمولة المسواة" : "Commission settled"} value={formatIqd(commissionCollected, true)} detail={locale === "ku" ? "کۆکراوەتەوە لەلایەن تەواف" : locale === "ar" ? "تم تحصيلها بواسطة طواف" : "Collected by Tawaf"} tone="teal" />
        <MetricCard icon={Banknote} label={role === "admin" ? (locale === "ku" ? "پارەدانەکانی پلاتفۆرم" : locale === "ar" ? "مدفوعات المنصة" : "Platform payments") : t.netEarnings} value={formatIqd(Math.max(0, collected - commissionOwed), true)} detail={locale === "ku" ? "دوای کۆمسیۆنەکان" : locale === "ar" ? "بعد العمولة المفتوحة" : "After open commission"} tone="sand" />
      </section>

      <section className="portal-overview-grid finance">
        <article className="portal-panel">
          <PanelHeader title={locale === "ku" ? "دەفتەری کۆمسیۆن" : locale === "ar" ? "دفتر الأستاذ للعمولة" : "Commission ledger"} subtitle={role === "admin" ? (locale === "ku" ? "دۆخی تسویە بەپێی کۆمپانیا" : locale === "ar" ? "حالة التسوية حسب الشركة" : "Settlement status by company") : (locale === "ku" ? "کۆمسیۆنی دروستبوو لە حیجزەکانتدا" : locale === "ar" ? "العمولة الناتجة عن حجوزاتك" : "Commission generated by your bookings")} />
          {data.commissions.length ? (
            <div className="portal-finance-list">
              {data.commissions.slice(0, 8).map((item) => (
                <div key={item.id}>
                  <span className={`portal-row-icon ${item.status === "collected" ? "positive" : "warning"}`}><CircleDollarSign size={17} /></span>
                  <div><b>{role === "admin" ? companyMap.get(item.company_id) ?? "Company" : (locale === "ku" ? `حیجزی #${item.booking_id.slice(0, 8).toUpperCase()}` : locale === "ar" ? `حجز #${item.booking_id.slice(0, 8).toUpperCase()}` : `Booking #${item.booking_id.slice(0, 8).toUpperCase()}`)}</b><small>{formatDate(item.created_at, true)}</small></div>
                  <strong>{formatIqd(item.amount_iqd)}</strong>
                  <StatusPill status={item.status} />
                  {role === "admin" && item.status === "owed" && <button type="button" onClick={() => runAction(`commission-${item.id}`, () => getSupabase().from("commissions").update({ status: "collected", collected_at: new Date().toISOString() }).eq("id", item.id), locale === "ku" ? "کۆمسیۆن وەک کۆکراوە نیشان کرا." : locale === "ar" ? "تم تحديد العمولة كمحصلة." : "Commission marked as collected.")} disabled={busy === `commission-${item.id}`}>{busy === `commission-${item.id}` ? <TawafLoadingSpinner size={14} /> : (locale === "ku" ? "نیشانکردنی کۆکراوە" : locale === "ar" ? "تحديد كمحصل" : "Mark collected")}</button>}
                </div>
              ))}
            </div>
          ) : <EmptyInline text={locale === "ku" ? "هیچ کۆمسیۆنێک هێشتا نییە." : locale === "ar" ? "لا توجد قيود عمولة بعد." : "No commission entries yet."} />}
        </article>

        <article className="portal-panel">
          <PanelHeader title={role === "admin" ? (locale === "ku" ? "دوایین پارەدانەکان" : locale === "ar" ? "أحدث المدفوعات" : "Latest payments") : (locale === "ku" ? "چالاکییەکانی جزدان" : locale === "ar" ? "نشاط المحفظة" : "Wallet activity")} subtitle={locale === "ku" ? "چالاکی دارایی پشتڕاستکراوە" : locale === "ar" ? "النشاط المالي المعتمد" : "Verified financial activity"} />
          <div className="portal-finance-list">
            {(role === "agency" && data.ledger.length ? data.ledger : data.payments).slice(0, 8).map((item: any) => (
              <div key={item.id}>
                <span className="portal-row-icon positive">{Number(item.amount_iqd) >= 0 ? <ArrowDownRight size={17} /> : <ArrowUpRight size={17} />}</span>
                <div><b>{item.description ?? (item.method ? titleCase(item.method) : titleCase(item.entry_type ?? "Payment"))}</b><small>{formatDate(item.created_at, true)}</small></div>
                <strong>{formatIqd(item.amount_iqd)}</strong>
                <StatusPill status={item.status ?? "completed"} />
              </div>
            ))}
            {!(role === "agency" && data.ledger.length ? data.ledger : data.payments).length && <EmptyInline text={locale === "ku" ? "چالاکی دارایی لێرەدا دەردەکەوێت." : locale === "ar" ? "سوف يظهر النشاط المالي هنا." : "Financial activity will appear here."} />}
          </div>
        </article>
      </section>
    </>
  );
}

function MessagesPage({ data, profile, busy, runAction, locale }: { data: PortalData; profile: Profile; busy: string; runAction: RunAction; locale: "ku" | "ar" | "en" }) {
  const t = dashboardTranslations[locale];
  const [selectedId, setSelectedId] = useState(data.inquiries[0]?.id ?? "");
  const [reply, setReply] = useState("");
  const [search, setSearch] = useState("");
  const visibleInquiries = data.inquiries.filter((inquiry) => {
    const haystack = `${inquiry.subject ?? ""} ${(inquiry.inquiry_messages ?? []).map((m) => m.body).join(" ")}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });
  const selected = data.inquiries.find((item) => item.id === selectedId) ?? visibleInquiries[0];
  const messages = [...(selected?.inquiry_messages ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    const body = reply.trim();
    setReply("");
    await runAction(
      `reply-${selected.id}`,
      () => getSupabase().from("inquiry_messages").insert({ inquiry_id: selected.id, sender_id: profile.id, body }),
      locale === "ku" ? "وەڵامەکە نێردرا بۆ زیارەتکار." : locale === "ar" ? "تم إرسال الرد للمعتمر." : "Reply sent to the pilgrim.",
    );
  }

  return (
    <>
      <PageHeading eyebrow={locale === "ku" ? "پەیوەندی زیارەتکاران" : locale === "ar" ? "اتصالات المعتمرين" : "Pilgrim communication"} title={locale === "ku" ? "نامەکان" : locale === "ar" ? "الرسائل" : "Messages"} description={locale === "ku" ? "وەڵامی پرسیاری گەشتیاران بدەرەوە و هەموو گفتوگۆکانی پاکێجەکە بەیەکەوە بهێڵەرەوە." : locale === "ar" ? "أجب عن أسئلة المسافرين واحتفظ بجميع محادثات الباقات معاً." : "Answer traveller questions and keep every package conversation together."} />
      <section className="portal-messages">
        <aside>
          <div className="portal-message-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={locale === "ku" ? "گەڕان لە گفتوگۆکان..." : locale === "ar" ? "البحث في المحادثات..." : "Search conversations…"} /></div>
          {visibleInquiries.map((inquiry) => (
            <button type="button" key={inquiry.id} className={selected?.id === inquiry.id ? "active" : ""} onClick={() => setSelectedId(inquiry.id)}>
              <span><UserRound size={17} /></span>
              <div><b>{inquiry.subject || (locale === "ku" ? "پرسیاری زیارەتکار" : locale === "ar" ? "استفسار المعتمر" : "Pilgrim inquiry")}</b><small>{inquiry.inquiry_messages?.at(-1)?.body ?? (locale === "ku" ? "گفتوگۆیەکی نوێی تەواف" : locale === "ar" ? "محادثة طواف جديدة" : "New Tawaf conversation")}</small></div>
              <i>{relativeTime(inquiry.updated_at ?? inquiry.created_at)}</i>
            </button>
          ))}
          {!visibleInquiries.length && <EmptyInline text={locale === "ku" ? "هیچ گفتوگۆیەکی زیارەتکاران هێشتا نییە." : locale === "ar" ? "لا توجد محادثات معتمرين بعد." : "No pilgrim conversations yet."} />}
        </aside>
        <article>
          {selected ? (
            <>
              <header><div><span><UserRound size={18} /></span><div><b>{selected.subject || (locale === "ku" ? "پرسیاری زیارەتکار" : locale === "ar" ? "استفسار المعتمر" : "Pilgrim inquiry")}</b><small><i /> {locale === "ku" ? "گفتوگۆی چالاک" : locale === "ar" ? "محادثة نشطة" : "Active conversation"}</small></div></div></header>
              <div className="portal-message-thread">
                {messages.map((message) => {
                  const own = message.sender_id === profile.id;
                  return <div key={message.id} className={own ? "own" : ""}><span>{message.body}</span><small>{relativeTime(message.created_at)}</small></div>;
                })}
                {!messages.length && <EmptyInline text={locale === "ku" ? "دەست بە گفتوگۆکە بکە بە ناردنی وەڵامێکی یارمەتیدەر." : locale === "ar" ? "ابدأ المحادثة برد مفيد ومساعد." : "Start the conversation with a helpful reply."} />}
              </div>
              <form className="portal-message-compose" onSubmit={sendReply}>
                <input value={reply} onChange={(event) => setReply(event.target.value)} placeholder={locale === "ku" ? "وەڵامێکی ڕوون بنووسە..." : locale === "ar" ? "اكتب رداً واضحاً..." : "Write a clear reply…"} />
                <button type="submit" disabled={!reply.trim() || busy === `reply-${selected.id}`}>{busy === `reply-${selected.id}` ? <TawafLoadingSpinner size={16} /> : <ArrowUpRight size={16} />}</button>
              </form>
            </>
          ) : <EmptyState icon={MessageSquareText} title={locale === "ku" ? "هیچ گفتوگۆیەک هەڵنەبژێردراوە" : locale === "ar" ? "لم يتم تحديد محادثة" : "No conversation selected"} text={locale === "ku" ? "گفتوگۆ نوێیەکانی زیارەتکاران لەم شوێنی کارەدا دەردەکەون." : locale === "ar" ? "ستظهر استفسارات المعتمرين الجديدة في مساحة العمل هذه." : "New pilgrim inquiries will appear in this workspace."} />}
        </article>
      </section>
    </>
  );
}

function CompanyProfile({
  company,
  profile,
  busy,
  runAction,
  locale,
  changeLocale,
}: {
  company: Company;
  profile: Profile;
  busy: string;
  runAction: RunAction;
  locale: "ku" | "ar" | "en";
  changeLocale: (val: "ku" | "ar" | "en") => void;
}) {
  const [name, setName] = useState(company.name ?? "");
  const [nameEn, setNameEn] = useState(company.name_en ?? "");
  const [nameAr, setNameAr] = useState(company.name_ar ?? "");
  const [location, setLocation] = useState(company.location ?? "");
  const [officeAddress, setOfficeAddress] = useState(company.office_address ?? "");
  const [phone, setPhone] = useState(company.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(company.whatsapp ?? "");
  const [officeHours, setOfficeHours] = useState(company.office_hours ?? "");
  const [licenseNumber, setLicenseNumber] = useState(company.license_number ?? "");
  const [since, setSince] = useState(company.since?.toString() ?? "");
  const [tags, setTags] = useState((company.tags ?? []).join(", "));
  const [about, setAbout] = useState(company.about ?? "");
  const [aboutEn, setAboutEn] = useState(company.about_en ?? "");
  const [aboutAr, setAboutAr] = useState(company.about_ar ?? "");
  const [introVideoUrl, setIntroVideoUrl] = useState(company.intro_video_url ?? "");
  const [cancellationPolicy, setCancellationPolicy] = useState(company.cancellation_policy ?? "");
  const [cancellationPolicyEn, setCancellationPolicyEn] = useState(company.cancellation_policy_en ?? "");
  const [cancellationPolicyAr, setCancellationPolicyAr] = useState(company.cancellation_policy_ar ?? "");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(company.accepted_payment_methods?.length ? company.accepted_payment_methods : ["cash"]);
  const canEdit = company.owner_id === profile.id;

  const profileFields = [name, location, officeAddress, phone, whatsapp, officeHours, licenseNumber, about, company.logo_url, company.banner_url];
  const profileStrength = Math.round((profileFields.filter((value) => String(value ?? "").trim()).length / profileFields.length) * 100);

  function togglePayment(method: string) {
    setPaymentMethods((current) => current.includes(method) ? current.filter((item) => item !== method) : [...current, method]);
  }

  async function uploadCompanyImage(kind: "logo" | "banner", file?: File) {
    if (!file) return;
    await runAction(
      `company-${kind}`,
      async () => {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          return { error: new Error("Please choose a JPG, PNG or WebP image.") };
        }
        if (file.size > 5 * 1024 * 1024) {
          return { error: new Error("The image must be smaller than 5 MB.") };
        }

        const supabase = getSupabase();
        const path = `${company.id}/profile/${kind}`;
        const uploaded = await supabase.storage
          .from("agency-media")
          .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: true });
        if (uploaded.error) return uploaded;

        const { data: publicFile } = supabase.storage.from("agency-media").getPublicUrl(path);
        const field = kind === "logo" ? "logo_url" : "banner_url";
        return supabase
          .from("companies")
          .update({ [field]: `${publicFile.publicUrl}?v=${Date.now()}` })
          .eq("id", company.id);
      },
      kind === "logo" ? "Company profile picture updated." : "Company cover image updated.",
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(
      "company-profile",
      () => {
        if (!name.trim()) return Promise.resolve({ error: new Error("Company name is required.") });
        if (!paymentMethods.length) return Promise.resolve({ error: new Error("Select at least one accepted payment method.") });

        return getSupabase().from("companies").update({
          name: name.trim(),
          name_en: nameEn.trim() || null,
          name_ar: nameAr.trim() || null,
          location: location.trim() || null,
          office_address: officeAddress.trim() || null,
          phone: phone.trim() || null,
          whatsapp: whatsapp.trim() || null,
          office_hours: officeHours.trim() || null,
          license_number: licenseNumber.trim() || null,
          since: since ? Number(since) : null,
          tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10),
          about: about.trim(),
          about_en: aboutEn.trim() || null,
          about_ar: aboutAr.trim() || null,
          intro_video_url: introVideoUrl.trim() || null,
          cancellation_policy: cancellationPolicy.trim() || null,
          cancellation_policy_en: cancellationPolicyEn.trim() || null,
          cancellation_policy_ar: cancellationPolicyAr.trim() || null,
          accepted_payment_methods: paymentMethods,
        }).eq("id", company.id);
      },
      "Your complete company profile has been saved.",
    );
  }

  return (
    <>
      <PageHeading eyebrow={locale === "ku" ? "ڕێکخستنەکانی کۆمپانیا" : locale === "ar" ? "إعدادات الشركة" : "Company settings"} title={locale === "ku" ? "پڕۆفایلی کۆمپانیا" : locale === "ar" ? "ملف الشركة" : "Company profile"} description={locale === "ku" ? "کۆنتڕۆڵ بکە چۆن کۆمپانیاکەت لە سەرانسەری تەواف بۆ زیارەتکاران دەردەکەوێت." : locale === "ar" ? "التحكم في كيفية ظهور شركتك للمعتمرين عبر طواف." : "Control how your company appears to pilgrims across Tawaf."} />
      {!canEdit && (
        <div className="portal-verification-banner">
          <span><ShieldCheck size={20} /></span>
          <div>
            <b>{locale === "ku" ? "دەستگەیشتنی خاوەن پێویستە" : locale === "ar" ? "مطلوب صلاحية المالك" : "Owner access required"}</b>
            <p>{locale === "ku" ? "دەتوانیت تەماشای پڕۆفایلەکە بکەیت، بەڵام تەنها خاوەنی کۆمپانیا دەتوانێت زانیارییە گشتییەکان بگۆڕێت." : locale === "ar" ? "يمكنك عرض هذا الملف الشخصي، ولكن يمكن لمالك الشركة فقط تغيير تفاصيل الشركة العامة." : "You can view this profile, but only the company owner can change public company details."}</p>
          </div>
        </div>
      )}
      <section className="portal-profile-layout">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", position: "sticky", top: "95px" }}>
          <article className="portal-profile-summary" style={{ position: "static", minHeight: "auto" }}>
            {company.banner_url && (
              <div className="portal-profile-summary-cover" style={{ backgroundImage: `url("${company.banner_url}")` }} />
            )}
            <div className="portal-company-avatar large">
              {company.logo_url ? (
                // External company logos are already optimized by Tawaf Storage.
                <img src={company.logo_url} alt={`${company.name} logo`} />
              ) : company.name.slice(0, 2).toUpperCase()}
            </div>
            <h2>{company.name}</h2>
            <StatusPill status={company.verification_status} />
            <p>{company.about || (locale === "ku" ? "پێشەکییەکی ڕوون زیاد بکە بۆ یارمەتیدانی زیارەتکاران بۆ تێگەیشتن لە کۆمپانیاکەت." : locale === "ar" ? "أضف مقدمة واضحة لمساعدة المعتمرين على فهم شركتك." : "Add a clear introduction to help pilgrims understand your company.")}</p>
            <div className="portal-profile-strength">
              <span><b>{profileStrength}%</b> {locale === "ku" ? "تەواوبوونی پڕۆفایل" : locale === "ar" ? "اكتمل الملف الشخصي" : "Profile complete"}</span>
              <i><b style={{ width: `${profileStrength}%` }} /></i>
            </div>
            <div className="portal-profile-facts">
              <span><MapPin size={15} /> {company.location || (locale === "ku" ? "شوێن زیاد نەکراوە" : locale === "ar" ? "لم تتم إضافة الموقع" : "Location not added")}</span>
              <span><Star size={15} /> {Number(company.rating ?? 0).toFixed(1)} {locale === "ku" ? "هەڵسەنگاندنی کۆمپانیا" : locale === "ar" ? "تقييم الشركة" : "company rating"}</span>
              <span><BadgeCheck size={15} /> {company.is_verified ? (locale === "ku" ? "پشتڕاستکراوە لەلایەن تەواف" : locale === "ar" ? "معتمد من طواف" : "Verified by Tawaf") : (locale === "ku" ? "پشتڕاستکردنەوە لە پرۆسەدایە" : locale === "ar" ? "التحقق قيد التنفيذ" : "Verification in progress")}</span>
            </div>
          </article>

          <div className="portal-panel" style={{ padding: "20px", borderRadius: "20px", background: "var(--surface)", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
              <span style={{ display: "grid", placeItems: "center", width: "28px", height: "28px", borderRadius: "50%", background: "rgba(15,92,77,0.08)", color: "var(--green)" }}><Languages size={15} /></span>
              <div>
                <b style={{ fontSize: "12px", display: "block", color: "var(--ink)" }}>
                  {locale === "ku" ? "زمانی کارکردن" : locale === "ar" ? "لغة العمل" : "Workspace language"}
                </b>
                <small style={{ fontSize: "8px", color: "var(--muted)", display: "block", marginTop: "2px" }}>
                  {locale === "ku" ? "زمانی پۆرتالەکە بگۆڕە" : locale === "ar" ? "تغيير لغة البوابة" : "Switch portal display language"}
                </small>
              </div>
            </div>
            <div className="locale-selector" style={{ width: "100%", padding: "2px", background: "rgba(15, 92, 77, 0.05)", border: "1px solid rgba(15, 92, 77, 0.1)", borderRadius: "100px", display: "flex", gap: "4px" }}>
              <button type="button" style={{ flex: 1, textAlign: "center", border: 0, borderRadius: "100px", padding: "6px 0", fontSize: "11px", fontWeight: "700", cursor: "pointer", color: locale === "ku" ? "#fff" : "#647169", background: locale === "ku" ? "var(--green)" : "transparent" }} onClick={() => changeLocale("ku")}>کوردی</button>
              <button type="button" style={{ flex: 1, textAlign: "center", border: 0, borderRadius: "100px", padding: "6px 0", fontSize: "11px", fontWeight: "700", cursor: "pointer", color: locale === "ar" ? "#fff" : "#647169", background: locale === "ar" ? "var(--green)" : "transparent" }} onClick={() => changeLocale("ar")}>عربي</button>
              <button type="button" style={{ flex: 1, textAlign: "center", border: 0, borderRadius: "100px", padding: "6px 0", fontSize: "11px", fontWeight: "700", cursor: "pointer", color: locale === "en" ? "#fff" : "#647169", background: locale === "en" ? "var(--green)" : "transparent" }} onClick={() => changeLocale("en")}>EN</button>
            </div>
          </div>
        </div>
        <form className="portal-profile-form portal-panel" onSubmit={save}>
          <PanelHeader title={locale === "ku" ? "زانیارییە گشتییەکانی کۆمپانیا" : locale === "ar" ? "تفاصيل الشركة العامة" : "Public company details"} subtitle={locale === "ku" ? "هەموو شتێک لێرە لە پڕۆفایلی تەواف و گەشتەکانتدا نیشان دەدرێت" : locale === "ar" ? "كل شيء هنا يظهر عبر ملفك الشخصي ورحلاتك في طواف" : "Everything here is shown across your Tawaf profile and trips"} />

          <div className="portal-profile-media">
            <div className="portal-profile-banner" style={company.banner_url ? { backgroundImage: `linear-gradient(rgba(5,45,36,.15), rgba(5,45,36,.3)), url("${company.banner_url}")` } : undefined}>
              <div><Upload size={18} /><b>{locale === "ku" ? "غلافی کۆمپانیا" : locale === "ar" ? "غلاف الشركة" : "Company cover"}</b><small>{locale === "ku" ? "پێشنیارکراو ١٦٠٠ × ٦٠٠ · JPG, PNG یان WebP" : locale === "ar" ? "الموصى به ١٦٠٠ × ٦٠٠ · JPG أو PNG أو WebP" : "Recommended 1600 × 600 · JPG, PNG or WebP"}</small></div>
              <label className={!canEdit ? "disabled" : ""}>
                {busy === "company-banner" ? <TawafLoadingSpinner size={15} /> : <Camera size={15} />}
                {company.banner_url ? (locale === "ku" ? "گۆڕینی غلاف" : locale === "ar" ? "تغيير الغلاف" : "Replace cover") : (locale === "ku" ? "بارکردنی غلاف" : locale === "ar" ? "رفع الغلاف" : "Upload cover")}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!canEdit || busy === "company-banner"} onChange={(event) => uploadCompanyImage("banner", event.target.files?.[0])} />
              </label>
            </div>
            <div className="portal-profile-logo-editor">
              <div className="portal-company-avatar large">
                {company.logo_url ? (
                  <img src={company.logo_url} alt={`${company.name} profile`} />
                ) : company.name.slice(0, 2).toUpperCase()}
              </div>
              <div><b>{locale === "ku" ? "وێنەی پڕۆفایل" : locale === "ar" ? "الصورة الشخصية" : "Profile picture"}</b><small>{locale === "ku" ? "وێنەی چوارگۆشە · زۆرترین ٥ مێگابایت" : locale === "ar" ? "صورة مربعة · الحد الأقصى ٥ ميجابايت" : "Square image · Maximum 5 MB"}</small></div>
              <label className={!canEdit ? "disabled" : ""}>
                {busy === "company-logo" ? <TawafLoadingSpinner size={15} /> : <Camera size={15} />}
                {locale === "ku" ? "گۆڕینی وێنە" : locale === "ar" ? "تغيير الصورة" : "Change picture"}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!canEdit || busy === "company-logo"} onChange={(event) => uploadCompanyImage("logo", event.target.files?.[0])} />
              </label>
            </div>
          </div>

          <div className="portal-profile-section">
            <header><span><Building2 size={18} /></span><div><b>{locale === "ku" ? "ناسنامەی کۆمپانیا" : locale === "ar" ? "هوية الشركة" : "Company identity"}</b><small>{locale === "ku" ? "ناوە بازرگانییەکانت و زانیارییە فەرمییەکانی کارەکەت" : locale === "ar" ? "أسماءك التجارية ومعلومات عملك الرسمية" : "Your trading names and official business information"}</small></div></header>
            <div className="portal-form-grid">
              <label><span>{locale === "ku" ? "ناوی کۆمپانیا" : locale === "ar" ? "اسم الشركة" : "Company name"}</span><input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} disabled={!canEdit} /></label>
              <label><span>{locale === "ku" ? "ژمارەی مۆڵەت" : locale === "ar" ? "رقم الترخيص" : "License number"}</span><input value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} placeholder={locale === "ku" ? "ژمارەی فەرمی تۆمارکردن" : locale === "ar" ? "رقم التسجيل الرسمي" : "Official registration number"} disabled={!canEdit} /></label>
              <label><span>{locale === "ku" ? "ناوی ئینگلیزی" : locale === "ar" ? "الاسم بالإنجليزية" : "English name"}</span><input value={nameEn} onChange={(event) => setNameEn(event.target.value)} placeholder={locale === "ku" ? "ناوی کۆمپانیا بە ئینگلیزی" : locale === "ar" ? "اسم الشركة بالإنجليزية" : "Company name in English"} disabled={!canEdit} /></label>
              <label dir="rtl"><span>{locale === "ku" ? "ناوی عەرەبی" : locale === "ar" ? "الاسم بالعربية" : "Arabic name"}</span><input value={nameAr} onChange={(event) => setNameAr(event.target.value)} placeholder={locale === "ku" ? "ناوی کۆمپانیا بە عەرەبی" : locale === "ar" ? "اسم الشركة بالعربية" : "اسم الشركة بالعربية"} disabled={!canEdit} /></label>
              <label><span>{locale === "ku" ? "ساڵی دامەزراندن" : locale === "ar" ? "سنة التأسيس" : "Established year"}</span><input type="number" min="1900" max={new Date().getFullYear()} value={since} onChange={(event) => setSince(event.target.value)} placeholder="2018" disabled={!canEdit} /></label>
              <label><span>{locale === "ku" ? "تاگی خزمەتگوزاری" : locale === "ar" ? "وسوم الخدمة" : "Service tags"}</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="VIP, Family, Ramadan" disabled={!canEdit} /></label>
            </div>
          </div>

          <div className="portal-profile-section">
            <header><span><PhoneCall size={18} /></span><div><b>{locale === "ku" ? "ناونیشان و ئۆفیس" : locale === "ar" ? "الاتصال والمكتب" : "Contact and office"}</b><small>{locale === "ku" ? "پەیوەندیکردن بۆ زیارەتکاران ئاسان بکە" : locale === "ar" ? "سهل الوصول إلى فريقك بالنسبة للمعتمرين" : "Make it easy for pilgrims to reach your team"}</small></div></header>
            <div className="portal-form-grid">
              {/* A picker, not free text: the app matches this value to rank
                  trips by the client's home city, and typos silently break that.
                  An existing non-canonical value is kept as an extra option so
                  saving the form never quietly rewrites it. */}
              <label><span>{locale === "ku" ? "شار" : locale === "ar" ? "المدينة" : "City"}</span>
                <select value={location} onChange={(event) => setLocation(event.target.value)} disabled={!canEdit}>
                  <option value="">{locale === "ku" ? "شار هەڵبژێرە" : locale === "ar" ? "اختر المدينة" : "Select city"}</option>
                  {IRAQI_CITIES.map((city) => (
                    <option key={city.value} value={city.value}>{cityLabel(city, locale)}</option>
                  ))}
                  {location && !IRAQI_CITIES.some((city) => city.value === location) && (
                    <option value={location}>{location}</option>
                  )}
                </select>
              </label>
              <label><span>{locale === "ku" ? "ژمارەی تەلەفۆن" : locale === "ar" ? "رقم الهاتف" : "Phone number"}</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+964…" disabled={!canEdit} /></label>
              <label><span>{locale === "ku" ? "ژمارەی WhatsApp" : locale === "ar" ? "رقم الواتساب" : "WhatsApp number"}</span><input type="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="+964…" disabled={!canEdit} /></label>
              <label><span>{locale === "ku" ? "کاتەکانی دەوام" : locale === "ar" ? "ساعات العمل" : "Office hours"}</span><input value={officeHours} onChange={(event) => setOfficeHours(event.target.value)} placeholder="Sat–Thu, 9:00–17:00" disabled={!canEdit} /></label>
              <label className="full"><span>{locale === "ku" ? "ناونیشانی ئۆفیس" : locale === "ar" ? "عنوان المكتب" : "Office address"}</span><input value={officeAddress} onChange={(event) => setOfficeAddress(event.target.value)} placeholder={locale === "ku" ? "شەقام، بینا و نزیکترین نیشانە" : locale === "ar" ? "الشارع والمبنى وأقرب معلم" : "Street, building and nearest landmark"} disabled={!canEdit} /></label>
            </div>
          </div>

          <div className="portal-profile-section">
            <header><span><Languages size={18} /></span><div><b>{locale === "ku" ? "پێناسی کۆمپانیا" : locale === "ar" ? "وصف الشركة" : "Company description"}</b><small>{locale === "ku" ? "بە زیارەتکاران بڵێ بۆچی لەگەڵ ئێوەدا گەشت بکەن" : locale === "ar" ? "أخبر المعتمرين لماذا يجب عليهم السفر معكم" : "Tell pilgrims why they should travel with you"}</small></div></header>
            <div className="portal-form-grid">
              <label className="full"><span>{locale === "ku" ? "پێناسی سەرەکی" : locale === "ar" ? "الوصف الرئيسي" : "Primary description"}</span><textarea value={about} onChange={(event) => setAbout(event.target.value)} rows={5} maxLength={1600} placeholder={locale === "ku" ? "ئەزموون، خزمەتگوزارییەکان و تایبەتمەندی گەشتەکانت بنووسە..." : locale === "ar" ? "صف خبرتكم وخدماتكم وما يجعل رحلات العمرة لديكم مميزة..." : "Describe your experience, services and what makes your Umrah trips special…"} disabled={!canEdit} /></label>
              <label><span>{locale === "ku" ? "پێناسی ئینگلیزی" : locale === "ar" ? "الوصف بالإنجليزية" : "English description"}</span><textarea value={aboutEn} onChange={(event) => setAboutEn(event.target.value)} rows={5} maxLength={1600} placeholder={locale === "ku" ? "پێناسی کۆمپانیا بە ئینگلیزی..." : locale === "ar" ? "وصف الشركة بالإنجليزية..." : "Company description in English…"} disabled={!canEdit} /></label>
              <label dir="rtl"><span>{locale === "ku" ? "پێناسی عەرەبی" : locale === "ar" ? "الوصف بالعربية" : "Arabic description"}</span><textarea value={aboutAr} onChange={(event) => setAboutAr(event.target.value)} rows={5} maxLength={1600} placeholder={locale === "ku" ? "پێناسی کۆمپانیا بە عەرەبی..." : locale === "ar" ? "وصف الشركة بالعربية..." : "وصف الشركة بالعربية…"} disabled={!canEdit} /></label>
            </div>
          </div>

          <div className="portal-profile-section">
            <header><span><CreditCard size={18} /></span><div><b>{locale === "ku" ? "پارەدانەکان و میدیا" : locale === "ar" ? "المدفوعات والوسائط" : "Payments and media"}</b><small>{locale === "ku" ? "دیاریکردنی ڕێگاکانی پارەدان و ڤیدیۆی کۆمپانیا" : locale === "ar" ? "حدد خيارات الدفع وأضف فيديو تعريفي للشركة" : "Set payment options and add a company introduction video"}</small></div></header>
            <div className="portal-form-grid">
              <label className="full"><span>{locale === "ku" ? "ڤیدیۆی ناساندنی کۆمپانیا" : locale === "ar" ? "رابط فيديو تعريفي" : "Introduction video URL"}</span><input type="url" value={introVideoUrl} onChange={(event) => setIntroVideoUrl(event.target.value)} placeholder="https://youtube.com/…" disabled={!canEdit} /></label>
              <fieldset className="portal-payment-options">
                <legend>{locale === "ku" ? "ڕێگاکانی پارەدانی پەسەندکراو" : locale === "ar" ? "طرق الدفع المقبولة" : "Accepted payment methods"}</legend>
                {[["cash", locale === "ku" ? "نەختینە (کاش)" : locale === "ar" ? "نقداً" : "Cash"], ["card", locale === "ku" ? "کارت" : locale === "ar" ? "بطاقة" : "Card"], ["fib", "FIB"]].map(([value, label]) => (
                  <label key={value}><input type="checkbox" checked={paymentMethods.includes(value)} onChange={() => togglePayment(value)} disabled={!canEdit} /><span>{label}</span></label>
                ))}
              </fieldset>
            </div>
          </div>

          <div className="portal-profile-section">
            <header><span><FileText size={18} /></span><div><b>{locale === "ku" ? "سیاسەتی هەڵوەشاندنەوە" : locale === "ar" ? "سياسة الإلغاء" : "Cancellation policy"}</b><small>{locale === "ku" ? "مەرجەکانی هەڵوەشاندنەوە و گێڕانەوەی پارە ڕوون بکەرەوە" : locale === "ar" ? "وضح شروط الإلغاء واسترداد الأموال بوضوح" : "Explain cancellation and refund terms clearly"}</small></div></header>
            <div className="portal-form-grid">
              <label className="full"><span>{locale === "ku" ? "سیاسەتی سەرەکی هەڵوەشاندنەوە" : locale === "ar" ? "سياسة الإلغاء الرئيسية" : "Primary cancellation policy"}</span><textarea value={cancellationPolicy} onChange={(event) => setCancellationPolicy(event.target.value)} rows={4} placeholder={locale === "ku" ? "مەرجەکانی هەڵوەشاندنەوە، تێچووەکان و گێڕانەوەی پارە ڕوون بکەرەوە..." : locale === "ar" ? "شروط الإلغاء والرسوم واسترداد الأموال..." : "Explain cancellation deadlines, fees and refunds…"} disabled={!canEdit} /></label>
              <label><span>{locale === "ku" ? "سیاسەتی ئینگلیزی" : locale === "ar" ? "السياسة بالإنجليزية" : "English policy"}</span><textarea value={cancellationPolicyEn} onChange={(event) => setCancellationPolicyEn(event.target.value)} rows={4} disabled={!canEdit} /></label>
              <label dir="rtl"><span>{locale === "ku" ? "سیاسەتی عەرەبی" : locale === "ar" ? "السياسة بالعربية" : "Arabic policy"}</span><textarea value={cancellationPolicyAr} onChange={(event) => setCancellationPolicyAr(event.target.value)} rows={4} disabled={!canEdit} /></label>
            </div>
          </div>

          <div className="portal-form-actions portal-profile-save">
            <span><ShieldCheck size={15} /> {locale === "ku" ? "گۆڕانکارییەکان بە پارێزراوی پاشەکەوت دەبن بۆ پڕۆفایلی کۆمپانیاکەت." : locale === "ar" ? "يتم حفظ التغييرات بأمان في ملف شركتك على طواف." : "Changes are securely saved to your Tawaf company profile."}</span>
            <button className="portal-primary-button" type="submit" disabled={!canEdit || busy === "company-profile"}>{busy === "company-profile" ? <TawafLoadingSpinner size={16} /> : <Check size={16} />} {locale === "ku" ? "پاشەکەوتکردنی پڕۆفایل بە تەواوی" : locale === "ar" ? "حفظ الملف الشخصي بالكامل" : "Save complete profile"}</button>
          </div>
        </form>
      </section>
    </>
  );
}

function SupportPage({ data, busy, runAction, locale }: { data: PortalData; busy: string; runAction: RunAction; locale: "ku" | "ar" | "en" }) {
  const t = dashboardTranslations[locale];
  return (
    <>
      <PageHeading eyebrow={locale === "ku" ? "پشتیوانی بازاڕ" : locale === "ar" ? "دعم السوق" : "Marketplace support"} title={t.supportMessages} description={locale === "ku" ? "وەڵامی پرسیاری زیارەتکاران و کۆمپانیاکان بدەرەوە پێش ئەوەی ببنە ڕێگر." : locale === "ar" ? "حل أسئلة المعتمرين والشركات قبل أن تتحول إلى عوائق." : "Resolve questions from pilgrims and companies before they become blockers."} />
      <section className="portal-support-grid">
        {data.support.map((message) => (
          <article className="portal-support-card" key={message.id}>
            <header><span><Mail size={18} /></span><div><b>{message.email || "Tawaf user"}</b><small>{relativeTime(message.created_at)}</small></div><StatusPill status={message.status || "open"} /></header>
            <p>{message.message}</p>
            <footer><a href={`mailto:${message.email ?? "hello@tawaf.app"}?subject=Your%20Tawaf%20support%20request`}>{locale === "ku" ? "وەڵامدانەوە بە ئیمەیڵ" : locale === "ar" ? "الرد عبر البريد الإلكتروني" : "Reply by email"} <ArrowUpRight size={14} /></a><button type="button" onClick={() => runAction(`support-${message.id}`, () => getSupabase().from("support_messages").delete().eq("id", message.id), locale === "ku" ? "کێشەی پشتیوانی چارەسەر کرا." : locale === "ar" ? "تم حل رسالة الدعم." : "Support message resolved.")} disabled={busy === `support-${message.id}`}>{busy === `support-${message.id}` ? <TawafLoadingSpinner size={14} /> : <Check size={14} />} {locale === "ku" ? "چارەسەرکردن" : locale === "ar" ? "حل" : "Resolve"}</button></footer>
          </article>
        ))}
        {!data.support.length && <EmptyState icon={Headphones} title={locale === "ku" ? "سندوقی نامەکان پاکە" : locale === "ar" ? "صندوق الوارد فارغ" : "Inbox is clear"} text={locale === "ku" ? "هیچ نامەیەکی پشتیوانی چارەسەرنەکراو نییە." : locale === "ar" ? "لا توجد رسائل دعم غير محلولة." : "There are no unresolved support messages."} />}
      </section>
    </>
  );
}

function AdminMore({ locale, changeLocale, busy, runAction }: { locale: "ku" | "ar" | "en"; changeLocale: (val: "ku" | "ar" | "en") => void; busy: string; runAction: RunAction }) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");

  // One notification row per recipient, so an announcement lands in the same
  // list, badge, realtime feed and banner as every other notification.
  async function broadcast() {
    const body = message.trim();
    if (!body) return;
    if (!window.confirm(tr(
      "ئەم پەیامە بۆ هەموو وەرگرانی هەڵبژێردراو دەنێردرێت. دڵنیایت؟",
      "سيتم إرسال هذه الرسالة إلى كل المستلمين المحددين. هل أنت متأكد؟",
      "This message will be sent to every selected recipient. Are you sure?",
    ))) return;
    const result = await runAction(
      "broadcast",
      () => getSupabase().rpc("admin_broadcast_notification", { p_message: body, p_audience: audience }),
      tr("پەیامەکە نێردرا.", "تم إرسال الرسالة.", "Announcement sent."),
    );
    if (result) setMessage("");
  }

  return (
    <>
      <section className="portal-panel" style={{ padding: "22px", marginBottom: 15 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <span style={{ display: "grid", placeItems: "center", width: "34px", height: "34px", borderRadius: "11px", background: "rgba(15,92,77,0.08)", color: "var(--green)" }}><Bell size={17} /></span>
          <div>
            <b style={{ fontSize: "14px", display: "block", color: "var(--ink)" }}>{tr("ڕاگەیاندن بۆ بەکارهێنەران", "إرسال إعلان", "Send an announcement")}</b>
            <small style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginTop: "2px" }}>
              {tr(
                "لە ئەپ، لیستی ئاگادارکردنەوە و شاشەی قوفڵکراودا دەردەکەوێت.",
                "يظهر في التطبيق وقائمة الإشعارات وشاشة القفل.",
                "Delivered in the app, notification shade, and lock screen.",
              )}
            </small>
          </div>
        </div>
        <textarea
          rows={3}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={tr("پەیامەکەت بنووسە…", "اكتب رسالتك…", "Write your message…")}
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid rgba(15,92,77,.18)", borderRadius: 12, padding: "12px 14px", fontFamily: "inherit", fontSize: 13, color: "var(--portal-ink, #14251f)", background: "#fff", resize: "vertical" }}
        />
        <div className="portal-commercial-row" style={{ marginTop: 12 }}>
          <label>
            <small>{tr("وەرگران", "المستلمون", "Recipients")}</small>
            <select value={audience} onChange={(event) => setAudience(event.target.value)}>
              <option value="all">{tr("هەمووان، لەگەڵ میوانان", "الجميع، بما في ذلك الضيوف", "Everyone, including signed-out users")}</option>
              <option value="client">{tr("تەنها زیارەتکاران", "المعتمرون فقط", "Pilgrims only")}</option>
              <option value="companies">{tr("تەنها کۆمپانیاکان", "الشركات فقط", "Companies only")}</option>
            </select>
          </label>
          <button type="button" className="portal-primary-button" onClick={broadcast} disabled={!message.trim() || busy === "broadcast"}>
            {busy === "broadcast" ? <TawafLoadingSpinner size={14} /> : <ArrowUpRight size={14} />} {tr("ناردن", "إرسال", "Send")}
          </button>
        </div>
      </section>

      <PageHeading eyebrow={locale === "ku" ? "ڕێکخستنەکان" : locale === "ar" ? "الإعدادات" : "Settings"} title={locale === "ku" ? "ڕێکخستنەکان" : locale === "ar" ? "الإعدادات" : "Settings"} description={locale === "ku" ? "زمانی پانێڵی بەڕێوەبردن." : locale === "ar" ? "لغة لوحة تحكم المسؤول." : "Administrator panel language."} />

      <section className="portal-panel" style={{ padding: "22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
          <span style={{ display: "grid", placeItems: "center", width: "34px", height: "34px", borderRadius: "11px", background: "rgba(15,92,77,0.08)", color: "var(--green)" }}><Languages size={17} /></span>
          <div>
            <b style={{ fontSize: "14px", display: "block", color: "var(--ink)" }}>
              {locale === "ku" ? "زمانی پلاتفۆرم" : locale === "ar" ? "لغة المنصة" : "Platform language"}
            </b>
            <small style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginTop: "2px" }}>
              {locale === "ku" ? "زمانی پانێڵی بەڕێوەبردن بگۆڕە" : locale === "ar" ? "تغيير لغة لوحة تحكم المسؤول" : "Switch administrator panel display language"}
            </small>
          </div>
        </div>
        <div className="locale-selector" style={{ background: "rgba(15, 92, 77, 0.05)", border: "1px solid rgba(15, 92, 77, 0.1)", borderRadius: "100px", display: "inline-flex", gap: "4px", padding: "2px" }}>
          <button type="button" style={{ border: 0, borderRadius: "100px", padding: "8px 18px", fontSize: "12px", fontWeight: "700", cursor: "pointer", color: locale === "ku" ? "#fff" : "#647169", background: locale === "ku" ? "var(--green)" : "transparent" }} onClick={() => changeLocale("ku")}>کوردی</button>
          <button type="button" style={{ border: 0, borderRadius: "100px", padding: "8px 18px", fontSize: "12px", fontWeight: "700", cursor: "pointer", color: locale === "ar" ? "#fff" : "#647169", background: locale === "ar" ? "var(--green)" : "transparent" }} onClick={() => changeLocale("ar")}>عربي</button>
          <button type="button" style={{ border: 0, borderRadius: "100px", padding: "8px 18px", fontSize: "12px", fontWeight: "700", cursor: "pointer", color: locale === "en" ? "#fff" : "#647169", background: locale === "en" ? "var(--green)" : "transparent" }} onClick={() => changeLocale("en")}>EN</button>
        </div>
      </section>
    </>
  );
}

function Toolbar({ query, setQuery, placeholder, filters, activeFilter, setFilter }: { query: string; setQuery: (value: string) => void; placeholder: string; filters: string[][]; activeFilter: string; setFilter: (value: string) => void }) {
  return (
    <div className="portal-toolbar">
      <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} /></label>
      <div className="portal-filter-row"><Filter size={15} />{filters.map(([id, label]) => <button type="button" key={id} className={activeFilter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}</button>)}</div>
    </div>
  );
}

function PanelHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <header className="portal-panel-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</header>;
}

function AttentionItem({ icon: Icon, tone, count, title, text, onClick }: { icon: LucideIcon; tone: string; count: number; title: string; text: string; onClick: () => void }) {
  return <button type="button" onClick={onClick}><span className={tone}><Icon size={18} /></span><div><b>{title}</b><small>{text}</small></div><strong>{count}</strong><ArrowRight size={15} /></button>;
}

function EmptyInline({ text }: { text: string }) {
  return <div className="portal-empty-inline"><CheckCircle2 size={19} /><span>{text}</span></div>;
}

function EmptyState({ icon: Icon, title, text, compact = false }: { icon: LucideIcon; title: string; text: string; compact?: boolean }) {
  return <div className={`portal-empty ${compact ? "compact" : ""}`}><span><Icon size={23} /></span><h3>{title}</h3><p>{text}</p></div>;
}
