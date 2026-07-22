/* eslint-disable @typescript-eslint/no-explicit-any */

import "../../styles/portal.css";
import "../../styles/trips.css";
import "../../styles/portal-theme.css";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
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
  FileCheck2,
  FileText,
  Filter,
  Headphones,
  Languages,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Plane,
  Plus,
  PhoneCall,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Star,
  TicketCheck,
  TrendingUp,
  Upload,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import TawafLoadingSpinner from "@/components/TawafLoadingSpinner";
import CompanyTripsWorkspace from "./company-trips.tsx";
import { dashboardTranslations } from "./translations.ts";

type Role = "admin" | "agency";
type RunAction = (id: string, action: () => any, success: string) => Promise<any>;
type AskReason = (title: string) => Promise<string | null>;
type PageId =
  | "overview"
  | "companies"
  | "trips"
  | "bookings"
  | "finance"
  | "support"
  | "messages"
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
  created_at: string;
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
  travellers: number;
  total_iqd: number;
  amount_paid_iqd: number;
  operational_stage: string;
  pay_method: string;
  departure_date: string | null;
  contact_phone: string | null;
  created_at: string;
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
  trips: Trip[];
  tripChangeRequests: TripChangeRequest[];
  bookings: Booking[];
  commissions: Commission[];
  payments: Payment[];
  support: SupportMessage[];
  inquiries: Inquiry[];
  ledger: LedgerRow[];
  payouts: Payout[];
};

const emptyData: PortalData = {
  companies: [],
  trips: [],
  tripChangeRequests: [],
  bookings: [],
  commissions: [],
  payments: [],
  support: [],
  inquiries: [],
  ledger: [],
  payouts: [],
};

const adminNavigation: Array<{ id: PageId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "trips", label: "Trips", icon: Plane },
  { id: "bookings", label: "Bookings", icon: BookOpenCheck },
  { id: "finance", label: "Finance", icon: CircleDollarSign },
  { id: "support", label: "Support", icon: Headphones },
  { id: "more", label: "More", icon: MoreHorizontal },
];

const companyNavigation: Array<{ id: PageId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "trips", label: "Trips", icon: Plane },
  { id: "bookings", label: "Bookings", icon: BookOpenCheck },
  { id: "messages", label: "Messages", icon: MessageSquareText },
  { id: "finance", label: "Money", icon: WalletCards },
  { id: "more", label: "Company profile", icon: Settings },
];

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

export default function DashboardPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
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
    resolve: (value: string | null) => void;
  } | null>(null);

  const [locale, setLocale] = useState<"ku" | "ar" | "en">("ku");

  const askReason = useCallback((title: string) => {
    return new Promise<string | null>((resolve) => {
      setReasonDialog({ title, resolve });
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
            commissionsResult,
            paymentsResult,
            supportResult,
          ] = await Promise.all([
            supabase.from("companies").select("*").order("created_at", { ascending: false }),
            supabase.from("packages").select("*").order("created_at", { ascending: false }),
            supabase.from("trip_change_requests").select("*").order("created_at", { ascending: false }).limit(100),
            supabase.from("bookings").select("*").order("created_at", { ascending: false }),
            supabase.from("commissions").select("*").order("created_at", { ascending: false }),
            supabase.from("payments").select("*").order("created_at", { ascending: false }),
            supabase.from("support_messages").select("*").order("created_at", { ascending: false }),
          ]);

          const firstError = [
            companiesResult,
            tripsResult,
            tripChangesResult,
            bookingsResult,
            commissionsResult,
            paymentsResult,
            supportResult,
          ].find((result) => result.error)?.error;
          if (firstError) throw firstError;

          setCompany(null);
          setData({
            ...emptyData,
            companies: (companiesResult.data ?? []) as Company[],
            trips: (tripsResult.data ?? []) as Trip[],
            tripChangeRequests: (tripChangesResult.data ?? []) as TripChangeRequest[],
            bookings: (bookingsResult.data ?? []) as Booking[],
            commissions: (commissionsResult.data ?? []) as Commission[],
            payments: (paymentsResult.data ?? []) as Payment[],
            support: (supportResult.data ?? []) as SupportMessage[],
          });
        } else {
          let companyRow: Company | null = null;
          const ownerResult = await supabase
            .from("companies")
            .select("*")
            .eq("owner_id", currentProfile.id)
            .maybeSingle();
          if (ownerResult.error) throw ownerResult.error;
          companyRow = ownerResult.data as Company | null;

          if (!companyRow) {
            const membershipResult = await supabase
              .from("agency_staff")
              .select("company_id, companies(*)")
              .eq("user_id", currentProfile.id)
              .eq("status", "active")
              .limit(1)
              .maybeSingle();
            if (membershipResult.error) throw membershipResult.error;
            companyRow = (membershipResult.data?.companies ?? null) as Company | null;
          }

          if (!companyRow) {
            setCompany(null);
            setData(emptyData);
            throw new Error("No company workspace is attached to this account.");
          }

          // An unapproved company must not reach the workspace, however it got
          // here: fresh sign-in, a restored session, or a direct /dashboard link.
          // The sign-in form checks this too, but it is bypassed whenever a
          // session already exists, so this loader is the real gate.
          //
          // 'draft' and 'needs_changes' are deliberately allowed through: those
          // companies need to get in to complete their profile and use "Submit
          // for review" in the verification banner.
          if (["pending", "rejected", "suspended"].includes(companyRow.verification_status)) {
            await supabase.auth.signOut();
            navigate("/sign-in", { replace: true, state: { blocked: companyRow.verification_status } });
            return;
          }

          setCompany(companyRow);
          const [
            tripsResult,
            tripChangesResult,
            bookingsResult,
            commissionsResult,
            paymentsResult,
            inquiriesResult,
            ledgerResult,
            payoutsResult,
          ] = await Promise.all([
            supabase.from("packages").select("*").eq("company_id", companyRow.id).order("created_at", { ascending: false }),
            supabase.from("trip_change_requests").select("*").eq("company_id", companyRow.id).order("created_at", { ascending: false }).limit(100),
            supabase.from("bookings").select("*").eq("company_id", companyRow.id).order("created_at", { ascending: false }),
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

  const navigation = role === "admin" ? adminNavigation : companyNavigation;
  const badges: Partial<Record<PageId, number>> = role === "admin"
    ? {
      companies: data.companies.filter((item) => ["pending", "needs_changes"].includes(item.verification_status)).length,
      trips: data.trips.filter((item) => item.lifecycle_status === "pending_review").length
        + data.tripChangeRequests.filter((item) => item.status === "pending").length,
      bookings: data.bookings.filter((item) => item.operational_stage === "requested").length,
      support: data.support.filter((item) => !item.status || item.status === "open").length,
    }
    : {
      bookings: data.bookings.filter((item) => item.operational_stage === "requested").length,
      messages: data.inquiries.filter((item) => item.status !== "closed").length,
    };

  const notificationItems: Array<{ page: PageId; label: string; count: number }> = role === "admin"
    ? [
      { page: "companies", count: badges.companies ?? 0, label: locale === "en" ? "Company applications" : locale === "ar" ? "طلبات الشركات" : "داواکارییەکانی کۆمپانیا" },
      { page: "trips", count: badges.trips ?? 0, label: locale === "en" ? "Trips awaiting review" : locale === "ar" ? "رحلات بانتظار المراجعة" : "گەشتەکان بۆ پێداچوونەوە" },
      { page: "bookings", count: badges.bookings ?? 0, label: locale === "en" ? "New booking requests" : locale === "ar" ? "طلبات حجز جديدة" : "داواکاری حیجزی نوێ" },
      { page: "support", count: badges.support ?? 0, label: locale === "en" ? "Support messages" : locale === "ar" ? "رسائل الدعم" : "نامەکانی پشتیوانی" },
    ]
    : [
      { page: "bookings", count: badges.bookings ?? 0, label: locale === "en" ? "New booking requests" : locale === "ar" ? "طلبات حجز جديدة" : "داواکاری حیجزی نوێ" },
      { page: "messages", count: badges.messages ?? 0, label: locale === "en" ? "Open conversations" : locale === "ar" ? "محادثات مفتوحة" : "گفتوگۆ کراوەکان" },
    ];

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
          <div className="portal-company-card">
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
                {company.is_verified ? "Verified company" : titleCase(company.verification_status)}
              </small>
            </div>
            <ChevronDown size={15} />
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
            <span className="portal-live">
              <i /> {locale === "en" ? "Live data" : locale === "ar" ? "البيانات الحية" : "زانیاری ڕاستەوخۆ"}
            </span>
            <button type="button" aria-label={locale === "en" ? "Refresh workspace" : locale === "ar" ? "تحديث مساحة العمل" : "نوێکردنەوەی شوێنی کار"} onClick={() => loadPortal(true)} disabled={refreshing}>
              <RefreshCw className={refreshing ? "spin" : ""} size={17} />
            </button>
            <div className="portal-bell-wrap">
              <button type="button" aria-label={locale === "en" ? "Notifications" : locale === "ar" ? "الإشعارات" : "ئاگادارکردنەوەکان"} onClick={() => setBellOpen((open) => !open)}>
                <Bell size={17} />
                {notificationItems.some((item) => item.count > 0) && <i />}
              </button>
              {bellOpen && (
                <>
                  <button type="button" className="portal-bell-scrim" aria-label="Close notifications" onClick={() => setBellOpen(false)} />
                  <div className="portal-bell-menu" role="menu">
                    <b>{locale === "en" ? "Needs your attention" : locale === "ar" ? "بحاجة إلى انتباهك" : "پێویستی بە سەرنجی تۆیە"}</b>
                    {notificationItems.filter((item) => item.count > 0).map((item) => (
                      <button
                        type="button"
                        key={item.page}
                        onClick={() => {
                          setBellOpen(false);
                          changePage(item.page);
                        }}
                      >
                        <span>{item.label}</span>
                        <i>{item.count}</i>
                      </button>
                    ))}
                    {!notificationItems.some((item) => item.count > 0) && (
                      <p>{locale === "en" ? "You're all caught up." : locale === "ar" ? "لقد اطلعت على كل شيء." : "هەموو شتێکت بینیوە."}</p>
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
  onCancel,
  onSubmit,
}: {
  title: string;
  locale: "ku" | "ar" | "en";
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="portal-reason-scrim" onClick={onCancel}>
      <form
        className="portal-reason-dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <h2>{title}</h2>
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
          <button type="submit" className="portal-primary-button" disabled={!value.trim()}>
            {locale === "en" ? "Confirm" : locale === "ar" ? "تأكيد" : "پشتڕاستکردنەوە"}
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
  if (page === "bookings") return <BookingsPage role="admin" data={data} busy={busy} runAction={runAction} askReason={askReason} locale={locale} />;
  if (page === "finance") return <FinancePage role="admin" data={data} busy={busy} runAction={runAction} locale={locale} />;
  if (page === "support") return <SupportPage data={data} busy={busy} runAction={runAction} locale={locale} />;
  if (page === "more") return <AdminMore data={data} locale={locale} changeLocale={changeLocale} />;
  return <AdminOverview data={data} goTo={goTo} locale={locale} />;
}

function CompanyPages({
  page,
  data,
  company,
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
  profile: Profile;
  busy: string;
  runAction: RunAction;
  askReason: AskReason;
  goTo: (page: PageId) => void;
  locale: "ku" | "ar" | "en";
  changeLocale: (val: "ku" | "ar" | "en") => void;
}) {
  if (page === "trips") return <CompanyTripsWorkspace company={company} trips={data.trips} changeRequests={data.tripChangeRequests} bookings={data.bookings} commissions={data.commissions} payments={data.payments} busy={busy} runAction={runAction} askReason={askReason} locale={locale} />;
  if (page === "bookings") return <BookingsPage role="agency" data={data} busy={busy} runAction={runAction} askReason={askReason} locale={locale} />;
  if (page === "messages") return <MessagesPage data={data} profile={profile} busy={busy} runAction={runAction} locale={locale} />;
  if (page === "finance") return <FinancePage role="agency" data={data} busy={busy} runAction={runAction} locale={locale} />;
  if (page === "more") return <CompanyProfile company={company} profile={profile} busy={busy} runAction={runAction} locale={locale} changeLocale={changeLocale} />;
  return <CompanyOverview data={data} company={company} goTo={goTo} locale={locale} busy={busy} runAction={runAction} />;
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

function StatusPill({ status }: { status: string }) {
  return <span className={`portal-status ${statusTone(status)}`}><i />{titleCase(status)}</span>;
}

function AdminOverview({ data, goTo, locale }: { data: PortalData; goTo: (page: PageId) => void; locale: "ku" | "ar" | "en" }) {
  const t = dashboardTranslations[locale];
  const collected = data.commissions.filter((item) => item.status === "collected").reduce((sum, item) => sum + Number(item.amount_iqd), 0);
  const owed = data.commissions.filter((item) => item.status === "owed").reduce((sum, item) => sum + Number(item.amount_iqd), 0);
  const pendingCompanies = data.companies.filter((item) => ["pending", "needs_changes"].includes(item.verification_status));
  const pendingTrips = data.trips.filter((item) => item.lifecycle_status === "pending_review");
  const pendingChanges = data.tripChangeRequests.filter((item) => item.status === "pending");
  const requestedBookings = data.bookings.filter((item) => item.operational_stage === "requested");
  const openSupport = data.support.filter((item) => !item.status || item.status === "open");
  const companyMap = new Map(data.companies.map((item) => [item.id, item.name]));
  const tripMap = new Map(data.trips.map((item) => [item.id, item.title]));
  const recentBookings = data.bookings.slice(0, 5);
  const monthly = monthlyBookingCounts(data.bookings);
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
        <MetricCard icon={TicketCheck} label={t.totalBookings} value={`${data.bookings.length}`} detail={`${requestedBookings.length} ${t.newRequests}`} tone="gold" onClick={() => goTo("bookings")} />
        <MetricCard icon={CircleDollarSign} label={t.collectedRevenue} value={formatIqd(collected, true)} detail={`${formatIqd(owed, true)} ${t.stillOwed}`} tone="sand" onClick={() => goTo("finance")} />
      </section>

      <section className="portal-overview-grid">
        <article className="portal-panel portal-chart-panel">
          <PanelHeader title={t.bookingActivity} subtitle={t.requests6Months} action={<span className="portal-period">{locale === "ku" ? "٦ مانگی ڕابردوو" : locale === "ar" ? "آخر ٦ أشهر" : "Last 6 months"}</span>} />
          <div className="portal-chart-summary">
            <div><strong>{data.bookings.length}</strong><span>{t.totalBookingsLabel}</span></div>
            <small><TrendingUp size={14} /> {t.liveMarketplace}</small>
          </div>
          <div className="portal-bar-chart">
            {monthly.map((month) => {
              const max = Math.max(...monthly.map((item) => item.value), 1);
              return (
                <div key={month.label}>
                  <i style={{ height: `${Math.max(8, (month.value / max) * 100)}%` }}><span>{month.value}</span></i>
                  <small>{month.label}</small>
                </div>
              );
            })}
          </div>
        </article>

        <article className="portal-panel">
          <PanelHeader title={t.needsAttention} subtitle={t.itemsWaitingAction} />
          <div className="portal-attention-list">
            <AttentionItem icon={Building2} tone="gold" count={pendingCompanies.length} title={t.companyApplications} text={t.reviewBusinessDetails} onClick={() => goTo("companies")} />
            <AttentionItem icon={ClipboardCheck} tone="teal" count={pendingTrips.length + pendingChanges.length} title={t.tripsForReview} text={locale === "ku" ? `${pendingTrips.length} گەشتی نوێ · ${pendingChanges.length} داواکاری گۆڕانکاری` : locale === "ar" ? `${pendingTrips.length} رحلات جديدة · ${pendingChanges.length} طلبات تغيير` : `${pendingTrips.length} new trips · ${pendingChanges.length} change requests`} onClick={() => goTo("trips")} />
            <AttentionItem icon={BookOpenCheck} tone="sand" count={requestedBookings.length} title={t.bookingRequests} text={t.waitingCompanyRespond} onClick={() => goTo("bookings")} />
            <AttentionItem icon={Headphones} tone="green" count={openSupport.length} title={t.supportMessages} text={t.unresolvedInInbox} onClick={() => goTo("support")} />
          </div>
        </article>
      </section>

      <section className="portal-panel">
        <PanelHeader title={t.recentBookings} subtitle={t.newestActivity} action={<button type="button" className="portal-text-button" onClick={() => goTo("bookings")}>{t.viewAll} <ArrowRight size={14} /></button>} />
        {recentBookings.length ? (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>{t.booking}</th><th>{t.trip}</th><th>{t.company}</th><th>{t.travellers}</th><th>{t.value}</th><th>{t.status}</th><th>{t.created}</th></tr></thead>
              <tbody>
                {recentBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td><b>#{booking.id.slice(0, 8).toUpperCase()}</b></td>
                    <td>{tripMap.get(booking.package_id) ?? (locale === "ku" ? "گەشتی عومرە" : locale === "ar" ? "رحلة عمرة" : "Umrah trip")}</td>
                    <td>{companyMap.get(booking.company_id) ?? "Company"}</td>
                    <td>{booking.travellers}</td>
                    <td>{formatIqd(booking.total_iqd)}</td>
                    <td><StatusPill status={booking.operational_stage} /></td>
                    <td>{relativeTime(booking.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyInline text={t.noBookingsYet} />}
      </section>
    </>
  );
}

function CompanyOverview({ data, company, goTo, locale, busy, runAction }: { data: PortalData; company: Company; goTo: (page: PageId) => void; locale: "ku" | "ar" | "en"; busy: string; runAction: RunAction }) {
  const t = dashboardTranslations[locale];
  const activeTrips = data.trips.filter((item) => ["published", "pending_review"].includes(item.lifecycle_status));
  const pending = data.bookings.filter((item) => item.operational_stage === "requested");
  const confirmed = data.bookings.filter((item) => ["confirmed", "ready", "in_progress"].includes(item.operational_stage));
  const bookingValue = data.bookings.filter((item) => !["cancelled", "rejected", "expired"].includes(item.operational_stage)).reduce((sum, item) => sum + Number(item.total_iqd), 0);
  const received = data.payments.filter((item) => item.status === "succeeded").reduce((sum, item) => sum + Number(item.amount_iqd), 0);
  const nextTrip = [...data.trips].filter((item) => item.departure_date && new Date(item.departure_date) >= new Date() && ["published", "pending_review", "paused"].includes(item.lifecycle_status)).sort((a, b) => String(a.departure_date).localeCompare(String(b.departure_date)))[0];
  const tripMap = new Map(data.trips.map((item) => [item.id, item.title]));
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
            <AttentionItem icon={MessageSquareText} tone="green" count={data.inquiries.filter((item) => item.status !== "closed").length} title={t.openConversations} text={t.pilgrimInquiriesReply} onClick={() => goTo("messages")} />
          </div>
        </article>
      </section>

      <section className="portal-panel">
        <PanelHeader title={t.latestRequests} subtitle={t.recentBookingActivity} action={<button type="button" className="portal-text-button" onClick={() => goTo("bookings")}>{t.viewAll} <ArrowRight size={14} /></button>} />
        {data.bookings.length ? (
          <div className="portal-compact-list">
            {data.bookings.slice(0, 5).map((booking) => (
              <div key={booking.id}>
                <span className="portal-row-icon"><BookOpenCheck size={17} /></span>
                <div><b>{tripMap.get(booking.package_id) ?? (locale === "ku" ? "گەشتی عومرە" : locale === "ar" ? "رحلة عمرة" : "Umrah trip")}</b><small>#{booking.id.slice(0, 8).toUpperCase()} · {booking.travellers} {locale === "ku" ? "گەشتیار" : locale === "ar" ? "مسافرين" : "travellers"}</small></div>
                <strong>{formatIqd(booking.total_iqd)}</strong>
                <StatusPill status={booking.operational_stage} />
                <small>{relativeTime(booking.created_at)}</small>
              </div>
            ))}
          </div>
        ) : <EmptyInline text={locale === "ku" ? "داواکارییە نوێیەکانی حیجز لێرەدا دەردەکەون." : locale === "ar" ? "ستظهر طلبات الحجز الجديدة هنا." : "New booking requests will appear here."} />}
      </section>
    </>
  );
}

function AdminCompanies({ data, busy, runAction, askReason, locale }: { data: PortalData; busy: string; runAction: RunAction; askReason: AskReason; locale: "ku" | "ar" | "en" }) {
  const t = dashboardTranslations[locale];
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.companies.find((item) => item.id === selectedId) ?? null;
  const pendingCount = data.companies.filter((item) => ["pending", "needs_changes"].includes(item.verification_status)).length;
  const activeCount = data.companies.filter((item) => item.is_active && item.verification_status === "approved").length;
  const suspendedCount = data.companies.filter((item) => item.verification_status === "suspended" || !item.is_active || item.status === "suspended").length;
  const companies = data.companies.filter((item) => {
    const matchesQuery = `${item.name} ${item.location ?? ""}`.toLowerCase().includes(query.toLowerCase());
    if (filter === "pending") return matchesQuery && ["pending", "needs_changes"].includes(item.verification_status);
    if (filter === "active") return matchesQuery && item.is_active && item.verification_status === "approved";
    if (filter === "suspended") return matchesQuery && (item.verification_status === "suspended" || !item.is_active || item.status === "suspended");
    return matchesQuery;
  });

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
      <section className="portal-mini-metrics">
        <div><span className="neutral"><Building2 size={17} /></span><p><b>{data.companies.length}</b><small>{locale === "ku" ? "هەموو کۆمپانیاکان" : locale === "ar" ? "جميع الشركات" : "All companies"}</small></p></div>
        <div><span className="warning"><Clock3 size={17} /></span><p><b>{pendingCount}</b><small>{locale === "ku" ? "چاوەڕێی بڕیارن" : locale === "ar" ? "بانتظار قرار" : "Awaiting decision"}</small></p></div>
        <div><span className="positive"><BadgeCheck size={17} /></span><p><b>{activeCount}</b><small>{locale === "ku" ? "چالاک و پەسەندکراو" : locale === "ar" ? "نشطة ومعتمدة" : "Active & approved"}</small></p></div>
        <div><span className="gold"><AlertTriangle size={17} /></span><p><b>{suspendedCount}</b><small>{locale === "ku" ? "ڕاگیراو یان ڕەتکراوە" : locale === "ar" ? "معلقة أو مرفوضة" : "Suspended or rejected"}</small></p></div>
      </section>
      <Toolbar query={query} setQuery={setQuery} placeholder={locale === "ku" ? "گەڕان بۆ کۆمپانیا یان شار..." : locale === "ar" ? "البحث عن شركة أو مدينة..." : "Search company or city…"} filters={[["all", t.allAll || "All"], ["pending", t.pendingFilter], ["active", t.activeLabel], ["suspended", t.suspendedLabel]]} activeFilter={filter} setFilter={setFilter} />
      <section className="portal-panel portal-table-panel">
        <PanelHeader title={`${companies.length} ${locale === "ku" ? "کۆمپانیا" : locale === "ar" ? "شركات" : "companies"}`} subtitle={locale === "ku" ? "دۆخی پشتڕاستکردنەوە و بازاڕی کۆمپانیا" : locale === "ar" ? "التحقق المباشر من الشركة وحالة السوق" : "Live company verification and marketplace status"} />
        {companies.length ? (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>{t.company}</th><th>{locale === "ku" ? "شوێن" : locale === "ar" ? "الموقع" : "Location"}</th><th>{locale === "ku" ? "هەڵسەنگاندن" : locale === "ar" ? "التقييم" : "Rating"}</th><th>{locale === "ku" ? "پشتڕاستکردنەوە" : locale === "ar" ? "التحقق" : "Verification"}</th><th>{locale === "ku" ? "تۆماربووە" : locale === "ar" ? "انضم في" : "Joined"}</th><th className="right">{locale === "ku" ? "کردارەکان" : locale === "ar" ? "الإجراءات" : "Actions"}</th></tr></thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="clickable" onClick={() => setSelectedId(company.id)}>
                    <td><EntityName name={company.name} image={company.logo_url} fallback={Building2} detail={company.phone ?? "No phone added"} /></td>
                    <td>{company.location || (locale === "ku" ? "دابین نەکراوە" : locale === "ar" ? "غير متوفر" : "Not provided")}</td>
                    <td><span className="portal-rating"><Star size={13} fill="currentColor" /> {Number(company.rating ?? 0).toFixed(1)} <small>({company.reviews ?? 0})</small></span></td>
                    <td><StatusPill status={company.verification_status || company.status} /></td>
                    <td>{formatDate(company.created_at, true)}</td>
                    <td className="right" onClick={(event) => event.stopPropagation()}>
                      {["pending", "needs_changes"].includes(company.verification_status) ? (
                        <div className="portal-row-actions">
                          <button type="button" className="approve" onClick={() => review(company, "approved")} disabled={busy.startsWith(`company-${company.id}`)}>{busy === `company-${company.id}-approved` ? <TawafLoadingSpinner size={14} /> : <Check size={14} />} {t.accept}</button>
                          <button type="button" onClick={() => review(company, "needs_changes")} disabled={busy.startsWith(`company-${company.id}`)}>{locale === "ku" ? "گۆڕانکاری" : locale === "ar" ? "تعديلات" : "Changes"}</button>
                          <button type="button" className="danger" onClick={() => review(company, "rejected")} disabled={busy.startsWith(`company-${company.id}`)}>{t.reject}</button>
                        </div>
                      ) : (company.verification_status === "suspended" || !company.is_active) ? (
                        <div className="portal-row-actions">
                          <button type="button" className="approve" onClick={() => review(company, "approved")} disabled={busy.startsWith(`company-${company.id}`)}>{busy === `company-${company.id}-approved` ? <TawafLoadingSpinner size={14} /> : <Check size={14} />} {locale === "ku" ? "چالاککردنەوەی کۆمپانیا" : locale === "ar" ? "إعادة تفعيل الشركة" : "Reactivate company"}</button>
                        </div>
                      ) : (
                        <div className="portal-row-actions">
                          <button type="button" className="danger" onClick={() => review(company, "suspended")} disabled={busy.startsWith(`company-${company.id}`)}>{busy === `company-${company.id}-suspended` ? <TawafLoadingSpinner size={14} /> : <X size={14} />} {locale === "ku" ? "ڕاگرتنی کۆمپانیا" : locale === "ar" ? "تعليق الشركة" : "Suspend company"}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Building2} title={t.noCompaniesFound} text={locale === "ku" ? "گەڕانێکی تر تاقی بکەرەوە یان فلتەرەکە بگۆڕە." : locale === "ar" ? "حاول البحث بكلمات أخرى أو تغيير الفلاتر." : "Try another search or filter."} compact />}
      </section>
      {selected && (
        <CompanyDetailDrawer
          company={selected}
          data={data}
          busy={busy}
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
        />
      )}
    </>
  );
}

function CompanyDetailDrawer({
  company,
  data,
  busy,
  locale,
  onClose,
  onReview,
  onTogglePromoted,
}: {
  company: Company;
  data: PortalData;
  busy: string;
  locale: "ku" | "ar" | "en";
  onClose: () => void;
  onReview: (decision: "approved" | "rejected" | "needs_changes" | "suspended") => void;
  onTogglePromoted: () => void;
}) {
  const t = dashboardTranslations[locale];
  const trips = data.trips.filter((item) => item.company_id === company.id);
  const bookings = data.bookings.filter((item) => item.company_id === company.id);
  const bookingValue = bookings.filter((item) => !["cancelled", "rejected", "expired"].includes(item.operational_stage)).reduce((sum, item) => sum + Number(item.total_iqd), 0);
  const commissionOwed = data.commissions.filter((item) => item.company_id === company.id && item.status === "owed").reduce((sum, item) => sum + Number(item.amount_iqd), 0);
  const isPending = ["pending", "needs_changes"].includes(company.verification_status);
  const isSuspended = company.verification_status === "suspended" || !company.is_active;
  const rowBusy = busy.startsWith(`company-${company.id}`);
  const notProvided = locale === "ku" ? "دابین نەکراوە" : locale === "ar" ? "غير متوفر" : "Not provided";

  return (
    <div className="portal-drawer-scrim" onClick={onClose}>
      <aside className="portal-drawer" onClick={(event) => event.stopPropagation()} aria-label={company.name}>
        <header className="portal-drawer-head" style={company.banner_url ? { backgroundImage: `linear-gradient(rgba(5,45,36,.55), rgba(5,45,36,.75)), url("${company.banner_url}")` } : undefined}>
          <button type="button" className="portal-drawer-close" onClick={onClose} aria-label="Close details"><X size={17} /></button>
          <div className="portal-company-avatar large">
            {company.logo_url ? <img src={company.logo_url} alt="" /> : company.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2>{company.name}</h2>
            <p>{company.location || notProvided} · {locale === "ku" ? "بەشداربووە" : locale === "ar" ? "انضمت في" : "Joined"} {formatDate(company.created_at, true)}</p>
          </div>
          <div className="portal-drawer-badges">
            <StatusPill status={company.verification_status || company.status} />
            {company.is_promoted && <span className="portal-status positive"><i />{locale === "ku" ? "پرۆمۆتکراو" : locale === "ar" ? "مروَّجة" : "Promoted"}</span>}
          </div>
        </header>

        <div className="portal-drawer-body">
          {company.verification_reason && (
            <p className="portal-drawer-reason"><AlertTriangle size={14} /> {company.verification_reason}</p>
          )}

          <div className="portal-drawer-stats">
            <div><b>{trips.length}</b><small>{locale === "ku" ? "گەشتەکان" : locale === "ar" ? "الرحلات" : "Trips"}</small></div>
            <div><b>{bookings.length}</b><small>{locale === "ku" ? "حیجزەکان" : locale === "ar" ? "الحجوزات" : "Bookings"}</small></div>
            <div><b>{formatIqd(bookingValue, true)}</b><small>{t.bookingValue}</small></div>
            <div><b>{formatIqd(commissionOwed, true)}</b><small>{locale === "ku" ? "کۆمسیۆنی ماوە" : locale === "ar" ? "عمولة مستحقة" : "Commission owed"}</small></div>
          </div>

          <section>
            <h3>{locale === "ku" ? "زانیاری پەیوەندی" : locale === "ar" ? "معلومات الاتصال" : "Contact information"}</h3>
            <ul className="portal-drawer-facts">
              <li><PhoneCall size={14} /><span>{company.phone || notProvided}</span></li>
              <li><MessageSquareText size={14} /><span>{company.whatsapp || notProvided} (WhatsApp)</span></li>
              <li><MapPin size={14} /><span>{company.office_address || notProvided}</span></li>
              <li><Clock3 size={14} /><span>{company.office_hours || notProvided}</span></li>
            </ul>
          </section>

          <section>
            <h3>{locale === "ku" ? "زانیاری بازرگانی" : locale === "ar" ? "معلومات العمل" : "Business details"}</h3>
            <ul className="portal-drawer-facts">
              <li><FileCheck2 size={14} /><span>{locale === "ku" ? "ژمارەی مۆڵەت:" : locale === "ar" ? "رقم الترخيص:" : "License:"} {company.license_number || notProvided}</span></li>
              <li><CalendarDays size={14} /><span>{locale === "ku" ? "دامەزراوە لە" : locale === "ar" ? "تأسست في" : "Established"} {company.since ?? notProvided}</span></li>
              <li><Star size={14} /><span>{Number(company.rating ?? 0).toFixed(1)} · {company.reviews ?? 0} {locale === "ku" ? "هەڵسەنگاندن" : locale === "ar" ? "تقييمات" : "reviews"}</span></li>
              <li><CreditCard size={14} /><span>{(company.accepted_payment_methods ?? []).map(titleCase).join(", ") || notProvided}</span></li>
            </ul>
            {(company.tags ?? []).length > 0 && (
              <div className="portal-drawer-tags">{(company.tags ?? []).map((tag) => <span key={tag}>{tag}</span>)}</div>
            )}
          </section>

          {company.about && (
            <section>
              <h3>{locale === "ku" ? "دەربارە" : locale === "ar" ? "نبذة" : "About"}</h3>
              <p className="portal-drawer-about">{company.about}</p>
            </section>
          )}
        </div>

        <footer className="portal-drawer-actions">
          {isPending ? (
            <>
              <button type="button" className="portal-primary-button" onClick={() => onReview("approved")} disabled={rowBusy}>{busy === `company-${company.id}-approved` ? <TawafLoadingSpinner size={14} /> : <Check size={14} />} {t.accept}</button>
              <button type="button" className="portal-secondary-button" onClick={() => onReview("needs_changes")} disabled={rowBusy}>{locale === "ku" ? "داوای گۆڕانکاری" : locale === "ar" ? "طلب تعديلات" : "Request changes"}</button>
              <button type="button" className="portal-secondary-button danger" onClick={() => onReview("rejected")} disabled={rowBusy}>{t.reject}</button>
            </>
          ) : isSuspended ? (
            <button type="button" className="portal-primary-button" onClick={() => onReview("approved")} disabled={rowBusy}>{busy === `company-${company.id}-approved` ? <TawafLoadingSpinner size={14} /> : <Check size={14} />} {locale === "ku" ? "چالاککردنەوەی کۆمپانیا" : locale === "ar" ? "إعادة تفعيل الشركة" : "Reactivate company"}</button>
          ) : (
            <>
              <button type="button" className="portal-secondary-button" onClick={onTogglePromoted} disabled={rowBusy}>{busy === `company-${company.id}-promote` ? <TawafLoadingSpinner size={14} /> : <Star size={14} />} {company.is_promoted ? (locale === "ku" ? "لابردنی پرۆمۆشن" : locale === "ar" ? "إزالة الترويج" : "Remove promotion") : (locale === "ku" ? "پرۆمۆتکردنی کۆمپانیا" : locale === "ar" ? "ترويج الشركة" : "Promote company")}</button>
              <button type="button" className="portal-secondary-button danger" onClick={() => onReview("suspended")} disabled={rowBusy}>{busy === `company-${company.id}-suspended` ? <TawafLoadingSpinner size={14} /> : <X size={14} />} {locale === "ku" ? "ڕاگرتنی کۆمپانیا" : locale === "ar" ? "تعليق الشركة" : "Suspend company"}</button>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}

function TripsPage({ role, data, busy, runAction, askReason, onCreateTrip, locale }: { role: Role; data: PortalData; busy: string; runAction: RunAction; askReason: AskReason; onCreateTrip?: () => void; locale: "ku" | "ar" | "en" }) {
  const t = dashboardTranslations[locale];
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const companyMap = new Map(data.companies.map((item) => [item.id, item.name]));
  const trips = data.trips.filter((item) => {
    const matches = `${item.title} ${companyMap.get(item.company_id) ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matches && (filter === "all" || item.lifecycle_status === filter);
  });
  const pendingChanges = data.tripChangeRequests.filter((item) => item.status === "pending");
  const countByStatus = (status: string) => data.trips.filter((item) => item.lifecycle_status === status).length;

  async function reviewTrip(trip: Trip, decision: "published" | "rejected") {
    const reason = decision === "rejected" ? await askReason(locale === "ku" ? "بۆچی ئەم گەشتە ڕەتدەکرێتەوە؟" : locale === "ar" ? "لماذا يتم رفض هذه الرحلة؟" : "Why is this trip being rejected?") : null;
    if (decision === "rejected" && !reason) return;
    await runAction(
      `trip-review-${trip.id}`,
      () => getSupabase().rpc("review_package", { p_package_id: trip.id, p_decision: decision, p_reason: reason }),
      decision === "published" ? (locale === "ku" ? `${trip.title} ئێستا چالاکە.` : locale === "ar" ? `${trip.title} نشطة الآن.` : `${trip.title} is now live.`) : (locale === "ku" ? `تێبینییەکان نێردران بۆ ${trip.title}.` : locale === "ar" ? `تم إرسال الملاحظات لـ ${trip.title}.` : `Feedback sent for ${trip.title}.`),
    );
  }

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
            <article className="portal-trip-card" key={trip.id}>
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
                <div className="portal-trip-dates">
                  <div><small>{t.departure}</small><b className={departed ? "is-past" : undefined}>{formatDate(trip.departure_date, true)}</b></div>
                  <div><small>{locale === "ku" ? "نرخ / بۆ هەر کەسێک" : locale === "ar" ? "السعر / للمعتمر" : "Price / pilgrim"}</small><b>{formatIqd(trip.price_iqd)}</b></div>
                </div>
                <div className="portal-capacity">
                  <span><b>{trip.seats_reserved ?? 0}</b> {locale === "ku" ? `لە ${trip.capacity ?? "—"} شوێن` : locale === "ar" ? `من ${trip.capacity ?? "—"} مقعد` : `of ${trip.capacity ?? "—"} seats`}</span>
                  <small>{Math.round(fill)}% {locale === "ku" ? "پڕبووەتەوە" : locale === "ar" ? "ممتلئ" : "filled"}</small>
                  <i><b style={{ width: `${fill}%` }} /></i>
                </div>
                {departed && <p className="portal-departed-note"><AlertTriangle size={12} /> {locale === "ku" ? "بەرواری ڕۆیشتن تێپەڕیوە — پێویستە نوێ بکرێتەوە پێش بڵاوکردنەوە." : locale === "ar" ? "تاريخ المغادرة قد مضى — يجب تحديثه قبل النشر." : "Departure date has passed — it must be updated before this trip can be published again."}</p>}
                {trip.review_reason && <p className="portal-review-note">{trip.review_reason}</p>}
                <div className="portal-card-actions">
                  {role === "admin" && trip.lifecycle_status === "pending_review" ? (
                    <>
                      <button type="button" className="approve" onClick={() => reviewTrip(trip, "published")} disabled={busy === `trip-review-${trip.id}`}><Check size={14} /> {t.accept}</button>
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
    </>
  );
}

function BookingsPage({ role, data, busy, runAction, askReason, locale }: { role: Role; data: PortalData; busy: string; runAction: RunAction; askReason: AskReason; locale: "ku" | "ar" | "en" }) {
  const t = dashboardTranslations[locale];
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const tripMap = new Map(data.trips.map((item) => [item.id, item.title]));
  const companyMap = new Map(data.companies.map((item) => [item.id, item.name]));
  const bookings = data.bookings.filter((item) => {
    const haystack = `${item.id} ${tripMap.get(item.package_id) ?? ""} ${companyMap.get(item.company_id) ?? ""} ${item.contact_phone ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (filter === "all" || item.operational_stage === filter);
  });

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
    const header = ["Booking", "Trip", "Company", "Travellers", "Total IQD", "Paid IQD", "Stage", "Pay method", "Phone", "Departure", "Created"];
    const rows = bookings.map((booking) => [
      booking.id.slice(0, 8).toUpperCase(),
      tripMap.get(booking.package_id) ?? "Umrah trip",
      companyMap.get(booking.company_id) ?? "Company",
      booking.travellers,
      booking.total_iqd,
      booking.amount_paid_iqd,
      booking.operational_stage,
      booking.pay_method,
      booking.contact_phone ?? "",
      booking.departure_date ?? "",
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

  return (
    <>
      <PageHeading eyebrow={locale === "ku" ? "ئۆپەراسیۆنی گەشتیاران" : locale === "ar" ? "عمليات المسافرين" : "Traveller operations"} title={locale === "ku" ? "حیجزەکان" : locale === "ar" ? "الحجوزات" : "Bookings"} description={role === "admin" ? (locale === "ku" ? "چاودێری چالاکییەکانی حیجزکردن بکە لە سەرانسەری بازاڕی تەوافدا." : locale === "ar" ? "راقب نشاط الحجز عبر سوق طواف بالكامل." : "Monitor booking activity across the entire Tawaf marketplace.") : (locale === "ku" ? "داواکارییەکان بپشکنە، پارەدانەکان پشتڕاست بکەرەوە، و گەشتیاران ڕێکبخە لە هەر قۆناغێکی گەشتەکەدا." : locale === "ar" ? "راجع الطلبات، وأكد المدفوعات، وتابع المسافرين خلال كل مرحلة من الرحلة." : "Review requests, confirm payments and move travellers through every trip stage.")} action={<button className="portal-secondary-button" type="button" onClick={exportCsv} disabled={!bookings.length}><FileText size={15} /> {locale === "ku" ? "هەناردەکردنی CSV" : locale === "ar" ? "تصدير CSV" : "Export CSV"}</button>} />
      <section className="portal-mini-metrics">
        <div><span className="warning"><Clock3 size={17} /></span><p><b>{data.bookings.filter((item) => item.operational_stage === "requested").length}</b><small>{t.newRequests}</small></p></div>
        <div><span className="positive"><BadgeCheck size={17} /></span><p><b>{data.bookings.filter((item) => ["confirmed", "ready"].includes(item.operational_stage)).length}</b><small>{locale === "ku" ? "پشتڕاستکراوە" : locale === "ar" ? "مؤكد" : "Confirmed"}</small></p></div>
        <div><span className="neutral"><Activity size={17} /></span><p><b>{data.bookings.filter((item) => item.operational_stage === "in_progress").length}</b><small>{locale === "ku" ? "لە گەشتدایە" : locale === "ar" ? "قيد التنفيذ" : "In progress"}</small></p></div>
        <div><span className="gold"><CircleDollarSign size={17} /></span><p><b>{formatIqd(activeValue, true)}</b><small>{locale === "ku" ? "بەهای حیجزە چالاکەکان" : locale === "ar" ? "قيمة الحجوزات النشطة" : "Active booking value"}</small></p></div>
      </section>
      <Toolbar query={query} setQuery={setQuery} placeholder={locale === "ku" ? "گەڕان بۆ حیجز، گەشت یان ژمارە..." : locale === "ar" ? "البحث عن حجز أو رحلة أو هاتف..." : "Search booking, trip or phone…"} filters={[["all", t.allAll || "All"], ["requested", locale === "ku" ? "داواکراو" : locale === "ar" ? "مطلوب" : "Requested"], ["awaiting_payment", locale === "ku" ? "چاوەڕێی پارە" : locale === "ar" ? "في انتظار الدفع" : "Awaiting payment"], ["confirmed", locale === "ku" ? "پشتڕاستکراو" : locale === "ar" ? "مؤكد" : "Confirmed"], ["ready", locale === "ku" ? "ئامادە" : locale === "ar" ? "جاهز" : "Ready"], ["in_progress", locale === "ku" ? "لە گەشتدایە" : locale === "ar" ? "قيد التنفيذ" : "In progress"], ["completed", locale === "ku" ? "تەواوبوو" : locale === "ar" ? "مكتمل" : "Completed"], ["cancelled", locale === "ku" ? "هەڵوەشاوە" : locale === "ar" ? "ملغي" : "Cancelled"]]} activeFilter={filter} setFilter={setFilter} />
      <section className="portal-panel portal-table-panel">
        <PanelHeader title={`${bookings.length} ${locale === "ku" ? "حیجز" : locale === "ar" ? "حجوزات" : "bookings"}`} subtitle={locale === "ku" ? "زانیارییە پارێزراوەکانی حیجز لە تەواف" : locale === "ar" ? "بيانات الحجز المؤمنة من طواف" : "Role-secured booking data from Tawaf"} />
        {bookings.length ? (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>{t.booking}</th><th>{t.trip}</th>{role === "admin" && <th>{t.company}</th>}<th>{t.travellers}</th><th>{locale === "ku" ? "پارەدان" : locale === "ar" ? "الدفع" : "Payment"}</th><th>{t.status}</th><th className="right">{locale === "ku" ? "کردارەکان" : locale === "ar" ? "الإجراءات" : "Action"}</th></tr></thead>
              <tbody>
                {bookings.map((booking) => {
                  const remaining = Math.max(0, Number(booking.total_iqd) - Number(booking.amount_paid_iqd));
                  return (
                    <tr key={booking.id}>
                      <td><b>#{booking.id.slice(0, 8).toUpperCase()}</b><small className="portal-cell-sub">{relativeTime(booking.created_at)}</small></td>
                      <td>{tripMap.get(booking.package_id) ?? "Umrah trip"}<small className="portal-cell-sub">{formatDate(booking.departure_date, true)}</small></td>
                      {role === "admin" && <td>{companyMap.get(booking.company_id) ?? "Company"}</td>}
                      <td>{booking.travellers}{booking.contact_phone && <small className="portal-cell-sub" dir="ltr">{booking.contact_phone}</small>}</td>
                      <td><b>{formatIqd(booking.total_iqd)}</b><small className="portal-cell-sub">{titleCase(booking.pay_method)} · {remaining ? (locale === "ku" ? `${formatIqd(remaining)} ماوە` : locale === "ar" ? `متبقي ${formatIqd(remaining)}` : `${formatIqd(remaining)} due`) : (locale === "ku" ? "دراوە" : locale === "ar" ? "مدفوع" : "Paid")}</small></td>
                      <td><StatusPill status={booking.operational_stage} /></td>
                      <td className="right">
                        <BookingActions booking={booking} busy={busy === `booking-${booking.id}`} transition={(action) => transition(booking, action)} role={role} runAction={runAction} locale={locale} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={BookOpenCheck} title={t.noBookingsFound} text={locale === "ku" ? "گەڕانێکی تر تاقی بکەرەوە یان فلتەرەکە بگۆڕە." : locale === "ar" ? "حاول البحث بكلمات أخرى أو تغيير الفلاتر." : "Try another search or status filter."} compact />}
      </section>
    </>
  );
}

function BookingActions({ booking, busy, transition, role, runAction, locale }: { booking: Booking; busy: boolean; transition: (action: string) => void; role: Role; runAction: RunAction; locale: "ku" | "ar" | "en" }) {
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
        <button type="button" className="approve" onClick={() => transition("ready")}><ClipboardCheck size={14} /> {t.markReady}</button>
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
              <label><span>{locale === "ku" ? "شار یان ناوچە" : locale === "ar" ? "المدينة أو المنطقة" : "City or region"}</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Erbil, Kurdistan Region" disabled={!canEdit} /></label>
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

function AdminMore({ data, locale, changeLocale }: { data: PortalData; locale: "ku" | "ar" | "en"; changeLocale: (val: "ku" | "ar" | "en") => void }) {
  const items = [
    { icon: ShieldCheck, title: locale === "ku" ? "پاراستنی بازاڕ" : locale === "ar" ? "أمان السوق" : "Marketplace security", text: locale === "ku" ? "دەسەڵاتەکانی ڕۆڵ و دەستگەیشتنی ڕیزەکان چالاکن." : locale === "ar" ? "صلاحيات الأدوار والوصول على مستوى الصفوف نشطة." : "Role permissions and row-level access are active.", status: "Healthy" },
    { icon: Activity, title: locale === "ku" ? "چالاکییە ڕاستەوخۆکان" : locale === "ar" ? "العمليات المباشرة" : "Live operations", text: locale === "ku" ? `${data.companies.length} کۆمپانیا و ${data.trips.length} گەشت پەیوەستکراون.` : locale === "ar" ? `تم ربط ${data.companies.length} شركة و ${data.trips.length} رحلة.` : `${data.companies.length} companies and ${data.trips.length} trips connected.`, status: "Online" },
    { icon: Bell, title: locale === "ku" ? "ئاگادارکردنەوەکان" : locale === "ar" ? "الإشعارات" : "Notifications", text: locale === "ku" ? "ڕووداوەکانی حیجزکردن و پێداچوونەوە لە ئەپی مۆبایل نوێ دەبنەوە." : locale === "ar" ? "تحديث أحداث الحجز والمراجعة في تطبيق الهاتف." : "Booking and review events update the mobile app.", status: "Active" },
    { icon: Settings, title: locale === "ku" ? "ڕێکخستنە بازرگانییەکان" : locale === "ar" ? "الإعدادات التجارية" : "Commercial settings", text: locale === "ku" ? "کۆنترۆڵی کۆمسیۆن و پرۆمۆشنی کۆمپانیا." : locale === "ar" ? "عناصر التحكم في عمولة الشركة والترويج." : "Company commission and promotion controls.", status: "Configured" },
  ];
  return (
    <>
      <PageHeading eyebrow={locale === "ku" ? "ئۆپەراسیۆنەکانی پلاتفۆرم" : locale === "ar" ? "عمليات المنصة" : "Platform operations"} title={locale === "ku" ? "زیاتر" : locale === "ar" ? "المزيد" : "More"} description={locale === "ku" ? "پاراستن، ئامرازەکانی بازاڕ و کورتکراوەکانی بەڕێوەبەر." : locale === "ar" ? "الأمان وأدوات السوق واختصارات المسؤول." : "Security, marketplace tools and administrator shortcuts."} />

      {/* Platform language card */}
      <section className="portal-panel" style={{ padding: "20px", marginBottom: "20px", borderRadius: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
          <span style={{ display: "grid", placeItems: "center", width: "28px", height: "28px", borderRadius: "50%", background: "rgba(15,92,77,0.08)", color: "var(--green)" }}><Languages size={15} /></span>
          <div>
            <b style={{ fontSize: "13px", display: "block", color: "var(--ink)" }}>
              {locale === "ku" ? "زمانی پلاتفۆرم" : locale === "ar" ? "لغة المنصة" : "Platform language"}
            </b>
            <small style={{ fontSize: "9px", color: "var(--muted)", display: "block", marginTop: "2px" }}>
              {locale === "ku" ? "زمانی پانێڵی بەڕێوەبردن بگۆڕە" : locale === "ar" ? "تغيير لغة لوحة تحكم المسؤول" : "Switch administrator panel display language"}
            </small>
          </div>
        </div>
        <div className="locale-selector" style={{ background: "rgba(15, 92, 77, 0.05)", border: "1px solid rgba(15, 92, 77, 0.1)", borderRadius: "100px", display: "inline-flex", gap: "4px", padding: "2px" }}>
          <button type="button" style={{ border: 0, borderRadius: "100px", padding: "6px 16px", fontSize: "11px", fontWeight: "700", cursor: "pointer", color: locale === "ku" ? "#fff" : "#647169", background: locale === "ku" ? "var(--green)" : "transparent" }} onClick={() => changeLocale("ku")}>کوردی</button>
          <button type="button" style={{ border: 0, borderRadius: "100px", padding: "6px 16px", fontSize: "11px", fontWeight: "700", cursor: "pointer", color: locale === "ar" ? "#fff" : "#647169", background: locale === "ar" ? "var(--green)" : "transparent" }} onClick={() => changeLocale("ar")}>عربي</button>
          <button type="button" style={{ border: 0, borderRadius: "100px", padding: "6px 16px", fontSize: "11px", fontWeight: "700", cursor: "pointer", color: locale === "en" ? "#fff" : "#647169", background: locale === "en" ? "var(--green)" : "transparent" }} onClick={() => changeLocale("en")}>EN</button>
        </div>
      </section>

      <section className="portal-settings-grid">
        {items.map((item) => <article key={item.title}><span><item.icon size={20} /></span><div><h3>{item.title}</h3><p>{item.text}</p></div><StatusPill status={item.status.toLowerCase()} /><ArrowUpRight size={16} /></article>)}
      </section>
      <section className="portal-panel portal-system">
        <PanelHeader title={locale === "ku" ? "سیستمی تەواف" : locale === "ar" ? "نظام طواف" : "Tawaf system"} subtitle={locale === "ku" ? "بەستەرە چالاکەکانی بەرهەمەکە" : locale === "ar" ? "أسطح المنتجات المتصلة" : "Connected product surfaces"} />
        <div><SystemItem icon={Building2} title={locale === "ku" ? "پۆرتاڵی کۆمپانیا" : locale === "ar" ? "بوابة الشركة" : "Company portal"} text={locale === "ku" ? "گەشتەکان، ئۆپەراسیۆنەکانی حیجز، پارە، نامەکان و دەستگەیشتنی کارمەندان" : locale === "ar" ? "الرحلات، عمليات الحجز، الأموال، الرسائل ووصول الموظفين" : "Trips, booking operations, money, messages and team access"} /><SystemItem icon={ShieldCheck} title={locale === "ku" ? "کۆنترۆڵی بەڕێوەبەر" : locale === "ar" ? "تحكم المسؤول" : "Admin control"} text={locale === "ku" ? "کۆمپانیاکان، پێداچوونەوە بە ناوەڕۆک، حیجز، دارایی و پشتگیری" : locale === "ar" ? "الشركات، مراجعة المحتوى، الحجوزات، المالية والدعم" : "Companies, content review, bookings, finance and support"} /><SystemItem icon={Plane} title={locale === "ku" ? "ئەپی زیارەتکار" : locale === "ar" ? "تطبيق الهاتف للمعتمر" : "Pilgrim mobile app"} text={locale === "ku" ? "دۆزینەوەی بازاڕ، حیجزکردن، بەڵگەنامەکان و نوێکارییەکانی گەشت" : locale === "ar" ? "استكشاف السوق، الحجز، المستندات وتحديثات الرحلة" : "Marketplace discovery, booking, documents and trip updates"} /></div>
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

function EntityName({ name, image, fallback: Fallback, detail }: { name: string; image: string | null; fallback: LucideIcon; detail: string }) {
  return <div className="portal-entity">{image ? (
    // External company logos are already optimized by Tawaf Storage.
    <img src={image} alt="" />
  ) : <span><Fallback size={17} /></span>}<div><b>{name}</b><small>{detail}</small></div></div>;
}

function EmptyInline({ text }: { text: string }) {
  return <div className="portal-empty-inline"><CheckCircle2 size={19} /><span>{text}</span></div>;
}

function EmptyState({ icon: Icon, title, text, compact = false }: { icon: LucideIcon; title: string; text: string; compact?: boolean }) {
  return <div className={`portal-empty ${compact ? "compact" : ""}`}><span><Icon size={23} /></span><h3>{title}</h3><p>{text}</p></div>;
}

function SystemItem({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <article><span><Icon size={19} /></span><div><b>{title}</b><small>{text}</small></div><BadgeCheck size={17} /></article>;
}

function monthlyBookingCounts(bookings: Booking[]) {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const label = date.toLocaleDateString("en-US", { month: "short" });
    const value = bookings.filter((booking) => {
      const created = new Date(booking.created_at);
      return created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth();
    }).length;
    return { label, value };
  });
}
