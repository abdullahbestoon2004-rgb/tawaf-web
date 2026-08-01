/* eslint-disable @typescript-eslint/no-explicit-any */

// Financial workspace — one file, two audiences.
//
// Admin sees every company and the platform's own P&L; a company sees only its
// own book. Both render the SAME tables, charts and expense flow with a `role`
// prop rather than two near-identical implementations, so the money rules below
// have exactly one home.
//
// The money model, because it is not symmetrical and the sign matters:
//   * pay_method 'cash'      -> the company took the pilgrim's money at its own
//                               counter, so it owes Tawaf the commission. The
//                               ledger entry is NEGATIVE (cash_commission_debit).
//   * pay_method card / fib  -> Tawaf took the money, so it owes the company its
//                               net share. The entry is POSITIVE (booking_credit).
// A company's balance is therefore a signed number and settlement runs both
// ways: a positive balance is paid out, a negative one is collected.
//
// FLOW VS STOCK — the rule every figure on this page obeys.
//   A *flow* answers "how much moved in this period" (collected, spent, earned)
//   and is filtered by the period picker. A *stock* answers "what is true right
//   now" (balances, what is owed) and is never date-filtered, because a balance
//   "as of last month" computed from a date-sliced ledger is simply wrong. Cards
//   showing a stock say so in their own subtitle.
//
// WHERE EACH NUMBER COMES FROM, and why not from somewhere else:
//   collected   <- payments (status 'succeeded', confirmed_at). NOT
//                  bookings.amount_paid_iqd, which carries no date of its own —
//                  a booking created in June and paid in July would land in
//                  June. The two tie out exactly today; payments is the one with
//                  a timestamp per movement.
//   refunded    <- payments.refunded_iqd.
//   commission  <- commissions (accrued at confirm, collected when settled).
//   expenses    <- expenses, status 'confirmed', by spent_at.
//   balances    <- agency_ledger, all-time, always.

import "../../styles/finance.css";

import {
  AlertTriangle,
  ArrowUpDown,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Building2,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Coins,
  FileText,
  Gauge,
  HandCoins,
  History,
  Landmark,
  Layers,
  Pencil,
  Percent,
  Plane,
  Plus,
  Printer,
  ReceiptText,
  ScrollText,
  Search,
  ShieldCheck,
  Table2,
  Target,
  TrendingDown,
  TrendingUp,
  Undo2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useScrollLock } from "@/lib/use-scroll-lock";
import TawafLoadingSpinner from "@/components/TawafLoadingSpinner";

export type Locale = "ku" | "ar" | "en";
type Role = "admin" | "agency";
type RunAction = (id: string, action: () => any, success: string) => Promise<any>;

export type LedgerRow = {
  id: string;
  company_id: string;
  booking_id: string | null;
  payment_id: string | null;
  payout_id: string | null;
  entry_type: string;
  amount_iqd: number;
  description: string | null;
  created_at: string;
  // Written by the ledger_running_balance trigger, never by a caller. Two
  // totals because the ledger carries two unrelated obligations — see
  // supabase/agency-finance-completion.sql.
  balance_after: number | null;
  cash_balance_after: number | null;
};

export type PayoutRow = {
  id: string;
  company_id: string;
  amount_iqd: number;
  method: string | null;
  reference: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  requested_by: string | null;
  requested_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
};

// company_id null is a Tawaf platform cost; set is that agency's own. The same
// nullability the expenses table is built around — see
// supabase/finance-expenses-and-analytics.sql.
export type ExpenseRow = {
  id: string;
  company_id: string | null;
  package_id: string | null;
  category: string;
  amount_iqd: number;
  currency: string;
  amount_original: number | null;
  fx_rate: number | null;
  spent_at: string;
  vendor: string | null;
  reference: string | null;
  note: string | null;
  receipt_url: string | null;
  status: string;
  void_reason: string | null;
  created_at: string;
};

export type BudgetRow = {
  id: string;
  company_id: string | null;
  category: string;
  month: string;
  amount_iqd: number;
};

export type ReceiptRow = {
  id: string;
  receipt_no: string;
  kind: string;
  company_id: string;
  amount_iqd: number;
  method: string | null;
  reference: string | null;
  payout_id: string | null;
  ledger_entry_id: string | null;
  issued_at: string;
};

export type FinanceAuditRow = {
  id: number;
  actor_role: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  new_state: any;
  reason: string | null;
  created_at: string;
};

export type CommercialSetting = {
  agency_id: string;
  commission_tier: string | null;
  commission_rate: number | null;
};

type FinanceCompany = { id: string; name: string };
type FinanceTrip = {
  id: string;
  title: string;
  company_id?: string;
  departure_date?: string | null;
  capacity?: number | null;
  seats_reserved?: number | null;
};
type FinanceCommission = { id: string; company_id: string; amount_iqd: number; status: string; created_at: string };
type FinancePayment = {
  id: string;
  booking_id: string;
  company_id: string;
  amount_iqd: number;
  refunded_iqd?: number | null;
  method: string;
  status: string;
  created_at: string;
  confirmed_at?: string | null;
  provider_reference?: string | null;
  // Which side of the counter took the money. Decides whether Tawaf owes the
  // agency its share or the agency owes Tawaf its commission — and only
  // company-collected cash needs verifying, because it is self-attested.
  // Present because the dashboard reads payments_finance, not payments.
  collected_by?: "platform" | "company" | null;
  reconciled_by?: string | null;
  reconciled_at?: string | null;
};
type FinanceBooking = {
  id: string;
  company_id: string;
  package_id: string;
  total_iqd: number;
  amount_paid_iqd: number;
  // Nullable in the dashboard's Booking type even though the column is NOT NULL,
  // so every read below coerces rather than trusting the shape.
  commission_rate: number | null;
  commission_iqd: number | null;
  payout_iqd: number | null;
  pay_method: string;
  operational_stage: string;
  created_at: string;
  // Optional because the finance page only reads them for the receivables list;
  // select("*") has always returned both.
  travellers?: number;
  departure_date?: string | null;
  // Snapshots. The drill-down reads only these — never today's commission
  // config, which would rewrite the history of every booking taken before the
  // last rate change.
  commission_tier?: string | null;
  cash_payment_location_type?: string | null;
  cash_payment_location_name?: string | null;
  payment_receipt_number?: string | null;
  payment_confirmed_at?: string | null;
};

// Mirrors ledger_balance_bucket() in
// supabase/agency-finance-completion.sql. The database is the authority — this
// exists so the page can classify a row it already holds without a round trip.
// If one list changes the other must.
const LEDGER_BUCKET: Record<string, "earnings" | "cash" | "hold"> = {
  booking_credit: "earnings",
  payout: "earnings",
  refund_reversal: "earnings",
  cancellation_fee: "earnings",
  cash_commission_debit: "cash",
  adjustment: "cash",
  payout_hold: "hold",
};

const bucketOfEntry = (entryType: string) => LEDGER_BUCKET[entryType] ?? "earnings";

// Mirrors payout_state(). Seven stored values, four logical ones; nothing in
// this file may switch on payouts.status directly.
type PayoutState = "requested" | "approved" | "paid" | "rejected";
const PAYOUT_STATE: Record<string, PayoutState> = {
  requested: "requested",
  pending: "approved",
  approved: "approved",
  completed: "paid",
  paid: "paid",
  failed: "rejected",
  rejected: "rejected",
};
const payoutState = (status: string): PayoutState => PAYOUT_STATE[status] ?? "requested";
const PAYOUT_IN_FLIGHT: PayoutState[] = ["requested", "approved"];

// Every rounding of a money figure in this file goes through here, so there is
// one place to change and one place to blame. The authoritative commission
// rounding happens in the database (fill_booking_amounts / true_up_booking_
// ledger); this is only ever used to apportion an already-rounded figure.
export const roundIqd = (value: number) => Math.round(value);

// Stages a booking can sit in where no more money will ever move through it.
const DEAD_STAGES = ["cancelled", "rejected", "expired"];

// The three methods record_payout()/record_commission_collection() accept. Kept
// in step with the whitelist in supabase/financial-settlement-rpcs.sql — a value
// outside this list is rejected by the database, not just by this form.
const SETTLEMENT_METHODS = ["cash", "bank_transfer", "fib"] as const;
type SettlementMethod = (typeof SETTLEMENT_METHODS)[number];

// Mirrors platform_expense_categories() / company_expense_categories() in
// supabase/finance-expenses-and-analytics.sql. A value outside the matching list
// is rejected by record_expense(), not merely by this form.
const PLATFORM_CATEGORIES = [
  "salaries", "marketing", "infrastructure", "gateway_fees", "legal", "office", "travel", "other",
] as const;
const COMPANY_CATEGORIES = [
  "hotel", "flight", "transport", "visa", "catering", "guide", "insurance", "staff", "marketing", "other",
] as const;

/* ------------------------------------------------------------------ *
 * Chart palette
 * ------------------------------------------------------------------ */

// Validated as a categorical set against this page's surface (#fffdf7) — the
// lightness band, the chroma floor, protan/deutan separation, the normal-vision
// floor and 3:1 contrast all pass. Assigned in fixed order and never cycled: a
// chart that would need a fifth series folds the tail into "Other" instead.
const SERIES = ["#0d8666", "#b0821f", "#a8443a", "#2f6fae"] as const;

// Aging is ordinal — "60+ days" is worse than "0–30", and the reader should see
// that order in the color — so it takes one hue in monotone lightness steps
// rather than four identities.
const AGING_RAMP = ["#6fbfa5", "#0f7f63", "#0a5c48"] as const;

const CHART_INK = { primary: "#14251f", secondary: "#4e6259", muted: "#8b968f", grid: "#e6e6de", axis: "#c9cfc7" };

/* ------------------------------------------------------------------ *
 * Time — everything on this page is a Baghdad day
 * ------------------------------------------------------------------ */

// Iraq is UTC+3 year round (it dropped DST in 2015), so a fixed offset is
// correct rather than a simplification. This matters: comparing a timestamptz
// against a bare "2026-07-31" puts the day boundary at 03:00 Baghdad and quietly
// files three hours of every day into the wrong period.
const BAGHDAD_OFFSET_MIN = 180;

export function dayKeyOf(value: string | null | undefined) {
  if (!value) return "";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return String(value).slice(0, 10);
  return new Date(time + BAGHDAD_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

function todayKey() {
  return new Date(Date.now() + BAGHDAD_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

function addDays(day: string, count: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function addMonths(day: string, count: number) {
  const date = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + count);
  return date.toISOString().slice(0, 10);
}

function startOfMonth(day: string) {
  return `${day.slice(0, 7)}-01`;
}

function endOfMonth(day: string) {
  return addDays(addMonths(startOfMonth(day), 1), -1);
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

type PresetId = "month" | "last_month" | "quarter" | "year" | "all" | "custom";

type Period = {
  preset: PresetId;
  from: string;
  to: string;
  // The same span immediately before, for the "vs previous" deltas. Empty on
  // "all time", which has nothing to compare against.
  prevFrom: string;
  prevTo: string;
};

export function resolvePeriod(preset: PresetId, customFrom: string, customTo: string, earliest: string): Period {
  const today = todayKey();
  let from = earliest;
  let to = today;

  if (preset === "month") {
    from = startOfMonth(today);
  } else if (preset === "last_month") {
    from = addMonths(startOfMonth(today), -1);
    to = endOfMonth(from);
  } else if (preset === "quarter") {
    const month = Number(today.slice(5, 7));
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    from = `${today.slice(0, 4)}-${String(quarterStartMonth).padStart(2, "0")}-01`;
  } else if (preset === "year") {
    from = `${today.slice(0, 4)}-01-01`;
  } else if (preset === "custom") {
    from = customFrom || earliest;
    to = customTo || today;
  }

  if (to < from) to = from;
  if (preset === "all") return { preset, from, to, prevFrom: "", prevTo: "" };

  const span = daysBetween(from, to) + 1;
  return { preset, from, to, prevFrom: addDays(from, -span), prevTo: addDays(from, -1) };
}

// The exact instants a Baghdad day starts and ends, for pushing a date range
// down to PostgREST. Comparing a timestamptz against a bare "2026-07-31" would
// put the boundary at 03:00 local and file three hours into the wrong month.
const startInstant = (day: string) => `${day}T00:00:00+03:00`;
const endInstant = (day: string) => `${day}T23:59:59.999+03:00`;

const inRange = (day: string, from: string, to: string) => Boolean(day) && day >= from && day <= to;

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

// Digits stay LTR in every locale — the standard convention for currency in an
// RTL page. Callers pair this with dir="ltr" on the cell so a minus sign never
// migrates to the wrong end of the number.
function formatIqd(value: number | string | null | undefined, compact = false) {
  const amount = Number(value ?? 0);
  const sign = amount < 0 ? "-" : "";
  const size = Math.abs(amount);
  if (compact && size >= 1_000_000_000) return `${sign}IQD ${(size / 1_000_000_000).toFixed(1)}B`;
  if (compact && size >= 1_000_000) return `${sign}IQD ${(size / 1_000_000).toFixed(1)}M`;
  if (compact && size >= 1_000) return `${sign}IQD ${(size / 1_000).toFixed(0)}K`;
  return `${sign}IQD ${new Intl.NumberFormat("en-US").format(size)}`;
}

function formatShort(value: number) {
  const sign = value < 0 ? "-" : "";
  const size = Math.abs(value);
  if (size >= 1_000_000_000) return `${sign}${(size / 1_000_000_000).toFixed(1)}B`;
  if (size >= 1_000_000) return `${sign}${(size / 1_000_000).toFixed(1)}M`;
  if (size >= 1_000) return `${sign}${(size / 1_000).toFixed(0)}K`;
  return `${sign}${Math.round(size)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const time = Date.parse(value);
  const date = Number.isNaN(time) ? new Date(`${value}T00:00:00Z`) : new Date(time + BAGHDAD_OFFSET_MIN * 60_000);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatMonthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(`${monthKey}-01T00:00:00Z`));
}

function formatDayLabel(day: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })
    .format(new Date(`${day}T00:00:00Z`));
}

function formatPercent(rate: number | null | undefined) {
  const value = Number(rate ?? 0) * 100;
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}

function shortId(value: string | null | undefined) {
  return value ? value.slice(0, 8).toUpperCase() : "—";
}

/* ------------------------------------------------------------------ *
 * Ledger semantics
 * ------------------------------------------------------------------ */

type SettlementStatus = "settled" | "partial" | "pending";
type Settlement = { status: SettlementStatus; covered: number };

// Which real-world payment covered a ledger row, so the method filter and the
// export can say something true. Booking-linked rows inherit the pilgrim's
// payment method; payout rows carry their own; a collection adjustment only
// records its method in the description, so that is parsed back out.
function entryMethod(
  entry: LedgerRow,
  bookings: Map<string, FinanceBooking>,
  payouts: Map<string, PayoutRow>,
): string | null {
  if (entry.payout_id) return payouts.get(entry.payout_id)?.method ?? null;
  if (entry.booking_id) return bookings.get(entry.booking_id)?.pay_method ?? null;
  const description = entry.description ?? "";
  return SETTLEMENT_METHODS.find((method) => description.includes(method)) ?? null;
}

// Per-row settlement, derived rather than stored. agency_ledger is append-only
// (the ledger_no_update_delete trigger rejects any UPDATE), so there is no
// `settled` flag to set and there must not be one: settling is a new
// compensating row. What an operator still needs to see is which bookings a
// payout actually covered, so the entries are matched oldest-first against the
// money that has since moved in that direction.
//
// Two independent pools, because the two directions never cancel each other:
//   credits  (Tawaf owes the company)  are cleared by 'payout' rows
//   debits   (the company owes Tawaf)  are cleared by positive 'adjustment' rows
export function settlementByEntry(rows: LedgerRow[]): Map<string, Settlement> {
  const result = new Map<string, Settlement>();
  const byCompany = new Map<string, LedgerRow[]>();
  rows.forEach((row) => {
    const bucket = byCompany.get(row.company_id);
    if (bucket) bucket.push(row);
    else byCompany.set(row.company_id, [row]);
  });

  byCompany.forEach((entries) => {
    const ascending = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
    let payoutPool = ascending
      .filter((entry) => entry.entry_type === "payout")
      .reduce((sum, entry) => sum + Math.abs(Number(entry.amount_iqd)), 0);
    let collectionPool = ascending
      .filter((entry) => entry.entry_type === "adjustment" && Number(entry.amount_iqd) > 0)
      .reduce((sum, entry) => sum + Number(entry.amount_iqd), 0);

    ascending.forEach((entry) => {
      const amount = Number(entry.amount_iqd);
      const isSettlementRow =
        entry.entry_type === "payout" || (entry.entry_type === "adjustment" && amount > 0);
      if (isSettlementRow) {
        // The settlement row is itself the evidence the money moved.
        result.set(entry.id, { status: "settled", covered: Math.abs(amount) });
        return;
      }
      const owed = Math.abs(amount);
      const pool = amount > 0 ? payoutPool : collectionPool;
      const covered = Math.min(pool, owed);
      if (amount > 0) payoutPool -= covered;
      else collectionPool -= covered;
      result.set(entry.id, {
        status: covered >= owed ? "settled" : covered > 0 ? "partial" : "pending",
        covered,
      });
    });
  });

  return result;
}

type CompanyBalance = {
  companyId: string;
  name: string;
  balance: number;
  paidOut: number;
  collected: number;
  lastPayoutAt: string | null;
  pendingBookings: number;
  // How long the oldest unsettled entry has been outstanding, in days. What an
  // aging report is actually built on.
  oldestUnsettledDays: number;
  commissionRate: number | null;
};

export function buildBalances(
  companies: FinanceCompany[],
  ledger: LedgerRow[],
  payouts: PayoutRow[],
  bookings: FinanceBooking[],
  settlements: Map<string, Settlement>,
  rates: Map<string, number | null>,
): CompanyBalance[] {
  const balance = new Map<string, number>();
  ledger.forEach((entry) => {
    balance.set(entry.company_id, (balance.get(entry.company_id) ?? 0) + Number(entry.amount_iqd));
  });

  const paidOut = new Map<string, number>();
  const lastPayoutAt = new Map<string, string>();
  payouts
    .filter((payout) => payout.status === "completed")
    .forEach((payout) => {
      paidOut.set(payout.company_id, (paidOut.get(payout.company_id) ?? 0) + Number(payout.amount_iqd));
      const at = payout.completed_at ?? payout.created_at;
      const current = lastPayoutAt.get(payout.company_id);
      if (!current || at > current) lastPayoutAt.set(payout.company_id, at);
    });

  const collected = new Map<string, number>();
  ledger
    .filter((entry) => entry.entry_type === "adjustment" && Number(entry.amount_iqd) > 0)
    .forEach((entry) => {
      collected.set(entry.company_id, (collected.get(entry.company_id) ?? 0) + Number(entry.amount_iqd));
    });

  // Oldest entry still carrying money nobody has settled. Only unsettled rows
  // count: a fully covered entry from January is not "180 days overdue".
  const oldest = new Map<string, string>();
  const today = todayKey();
  ledger.forEach((entry) => {
    const status = settlements.get(entry.id)?.status ?? "pending";
    if (status === "settled") return;
    const day = dayKeyOf(entry.created_at);
    const current = oldest.get(entry.company_id);
    if (!current || day < current) oldest.set(entry.company_id, day);
  });

  // "Pending" in a money sense: the pilgrim still owes on it, so it has not yet
  // moved the balance. Cancelled bookings are excluded — they never will.
  const pending = new Map<string, number>();
  bookings
    .filter((booking) =>
      !DEAD_STAGES.includes(booking.operational_stage) &&
      Number(booking.amount_paid_iqd) < Number(booking.total_iqd))
    .forEach((booking) => {
      pending.set(booking.company_id, (pending.get(booking.company_id) ?? 0) + 1);
    });

  return companies.map((company) => {
    const oldestDay = oldest.get(company.id);
    return {
      companyId: company.id,
      name: company.name,
      balance: balance.get(company.id) ?? 0,
      paidOut: paidOut.get(company.id) ?? 0,
      collected: collected.get(company.id) ?? 0,
      lastPayoutAt: lastPayoutAt.get(company.id) ?? null,
      pendingBookings: pending.get(company.id) ?? 0,
      oldestUnsettledDays: oldestDay ? Math.max(0, daysBetween(oldestDay, today)) : 0,
      commissionRate: rates.get(company.id) ?? null,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Analytics
 * ------------------------------------------------------------------ */

type Grain = "day" | "month";

type Buckets = { keys: string[]; grain: Grain; label: (key: string) => string };

// A period wider than about two months stops being readable one tick per day, so
// it rolls up to months. The keys are generated across the whole span rather
// than taken from the data, so a quiet week is a flat line rather than a gap.
export function buildBuckets(from: string, to: string): Buckets {
  const span = daysBetween(from, to);
  if (span <= 62) {
    const keys: string[] = [];
    for (let day = from; day <= to; day = addDays(day, 1)) keys.push(day);
    return { keys, grain: "day", label: formatDayLabel };
  }
  const keys: string[] = [];
  for (let month = startOfMonth(from); month <= to; month = addMonths(month, 1)) keys.push(month.slice(0, 7));
  return { keys, grain: "month", label: formatMonthLabel };
}

const bucketOf = (day: string, grain: Grain) => (grain === "day" ? day : day.slice(0, 7));

function sumInto(target: Map<string, number>, key: string, amount: number) {
  if (!key) return;
  target.set(key, (target.get(key) ?? 0) + amount);
}

type Totals = {
  gmv: number;
  collected: number;
  refunded: number;
  commissionAccrued: number;
  commissionCollected: number;
  expenses: number;
  paidOut: number;
  bookingCount: number;
  // Company book only: the agency's share of what pilgrims actually paid.
  netEarned: number;
};

const EMPTY_TOTALS: Totals = {
  gmv: 0, collected: 0, refunded: 0, commissionAccrued: 0, commissionCollected: 0,
  expenses: 0, paidOut: 0, bookingCount: 0, netEarned: 0,
};

type Source = {
  bookings: FinanceBooking[];
  payments: FinancePayment[];
  commissions: FinanceCommission[];
  payouts: PayoutRow[];
  expenses: ExpenseRow[];
};

// Every period figure on the page comes through here, so the overview cards, the
// charts and the deltas can never disagree about what a period contains.
export function totalsFor(source: Source, from: string, to: string): Totals {
  const live = source.bookings.filter((booking) => !DEAD_STAGES.includes(booking.operational_stage));
  const gmvBookings = live.filter((booking) => inRange(dayKeyOf(booking.created_at), from, to));
  const settled = source.payments.filter(
    (payment) => payment.status === "succeeded" &&
      inRange(dayKeyOf(payment.confirmed_at ?? payment.created_at), from, to),
  );
  const commissions = source.commissions.filter((item) => inRange(dayKeyOf(item.created_at), from, to));
  const payouts = source.payouts.filter(
    (payout) => payout.status === "completed" &&
      inRange(dayKeyOf(payout.completed_at ?? payout.created_at), from, to),
  );
  const expenses = source.expenses.filter(
    (expense) => expense.status === "confirmed" && inRange(expense.spent_at, from, to),
  );

  // The agency's share of money actually received: payout_iqd is the share of
  // the FULL booking, so a part payment only earns its proportion.
  const bookingById = new Map(source.bookings.map((booking) => [booking.id, booking]));
  const netEarned = settled.reduce((sum, payment) => {
    const booking = bookingById.get(payment.booking_id);
    const total = Number(booking?.total_iqd ?? 0);
    if (!booking || !total) return sum;
    return sum + roundIqd(Number(booking.payout_iqd ?? 0) * (Number(payment.amount_iqd) / total));
  }, 0);

  return {
    gmv: gmvBookings.reduce((sum, booking) => sum + Number(booking.total_iqd), 0),
    bookingCount: gmvBookings.length,
    collected: settled.reduce((sum, payment) => sum + Number(payment.amount_iqd), 0),
    refunded: settled.reduce((sum, payment) => sum + Number(payment.refunded_iqd ?? 0), 0),
    commissionAccrued: commissions.reduce((sum, item) => sum + Number(item.amount_iqd), 0),
    commissionCollected: commissions
      .filter((item) => item.status === "collected")
      .reduce((sum, item) => sum + Number(item.amount_iqd), 0),
    expenses: expenses.reduce((sum, expense) => sum + Number(expense.amount_iqd), 0),
    paidOut: payouts.reduce((sum, payout) => sum + Number(payout.amount_iqd), 0),
    netEarned,
  };
}

type SeriesPoint = { key: string; values: number[] };

// One pass per metric into bucket maps, then read out in bucket order — so an
// empty bucket is a zero rather than a missing point that would make the line
// jump between non-adjacent dates.
function buildSeries(source: Source, buckets: Buckets, metrics: Array<"collected" | "commission" | "expenses" | "paidOut" | "netEarned" | "gmv">): SeriesPoint[] {
  const maps = metrics.map(() => new Map<string, number>());
  const bookingById = new Map(source.bookings.map((booking) => [booking.id, booking]));

  metrics.forEach((metric, index) => {
    const target = maps[index];
    if (metric === "collected" || metric === "netEarned") {
      source.payments
        .filter((payment) => payment.status === "succeeded")
        .forEach((payment) => {
          const key = bucketOf(dayKeyOf(payment.confirmed_at ?? payment.created_at), buckets.grain);
          if (metric === "collected") {
            sumInto(target, key, Number(payment.amount_iqd));
            return;
          }
          const booking = bookingById.get(payment.booking_id);
          const total = Number(booking?.total_iqd ?? 0);
          if (!booking || !total) return;
          sumInto(target, key, roundIqd(Number(booking.payout_iqd ?? 0) * (Number(payment.amount_iqd) / total)));
        });
    } else if (metric === "commission") {
      source.commissions.forEach((item) => {
        sumInto(target, bucketOf(dayKeyOf(item.created_at), buckets.grain), Number(item.amount_iqd));
      });
    } else if (metric === "expenses") {
      source.expenses
        .filter((expense) => expense.status === "confirmed")
        .forEach((expense) => sumInto(target, bucketOf(expense.spent_at, buckets.grain), Number(expense.amount_iqd)));
    } else if (metric === "paidOut") {
      source.payouts
        .filter((payout) => payout.status === "completed")
        .forEach((payout) => {
          sumInto(target, bucketOf(dayKeyOf(payout.completed_at ?? payout.created_at), buckets.grain), Number(payout.amount_iqd));
        });
    } else if (metric === "gmv") {
      source.bookings
        .filter((booking) => !DEAD_STAGES.includes(booking.operational_stage))
        .forEach((booking) => {
          sumInto(target, bucketOf(dayKeyOf(booking.created_at), buckets.grain), Number(booking.total_iqd));
        });
    }
  });

  return buckets.keys.map((key) => ({ key, values: maps.map((map) => map.get(key) ?? 0) }));
}

type TripPnl = {
  tripId: string;
  title: string;
  departure: string | null;
  seats: number;
  gross: number;
  collected: number;
  commission: number;
  expenses: number;
  net: number;
  margin: number;
};

// Revenue and commission hang off bookings.package_id; costs hang off
// expenses.package_id. Same key, so the two sides finally meet.
export function buildTripPnl(
  trips: FinanceTrip[],
  bookings: FinanceBooking[],
  expenses: ExpenseRow[],
  from: string,
  to: string,
): TripPnl[] {
  const live = bookings.filter(
    (booking) => !DEAD_STAGES.includes(booking.operational_stage) && inRange(dayKeyOf(booking.created_at), from, to),
  );
  const byTrip = new Map<string, { gross: number; collected: number; commission: number; seats: number }>();
  live.forEach((booking) => {
    const bucket = byTrip.get(booking.package_id) ?? { gross: 0, collected: 0, commission: 0, seats: 0 };
    bucket.gross += Number(booking.total_iqd);
    bucket.collected += Number(booking.amount_paid_iqd);
    bucket.commission += Number(booking.commission_iqd ?? 0);
    bucket.seats += 1;
    byTrip.set(booking.package_id, bucket);
  });

  const costByTrip = new Map<string, number>();
  expenses
    .filter((expense) => expense.status === "confirmed" && expense.package_id && inRange(expense.spent_at, from, to))
    .forEach((expense) => {
      costByTrip.set(expense.package_id as string, (costByTrip.get(expense.package_id as string) ?? 0) + Number(expense.amount_iqd));
    });

  const titles = new Map(trips.map((trip) => [trip.id, trip]));
  const ids = new Set([...byTrip.keys(), ...costByTrip.keys()]);

  return Array.from(ids).map((tripId) => {
    const revenue = byTrip.get(tripId) ?? { gross: 0, collected: 0, commission: 0, seats: 0 };
    const expense = costByTrip.get(tripId) ?? 0;
    const trip = titles.get(tripId);
    const net = revenue.gross - revenue.commission - expense;
    return {
      tripId,
      title: trip?.title ?? shortId(tripId),
      departure: trip?.departure_date ?? null,
      seats: revenue.seats,
      gross: revenue.gross,
      collected: revenue.collected,
      commission: revenue.commission,
      expenses: expense,
      net,
      margin: revenue.gross ? net / revenue.gross : 0,
    };
  }).sort((a, b) => b.gross - a.gross);
}

type Receivable = {
  bookingId: string;
  tripTitle: string;
  travellers: number;
  total: number;
  paid: number;
  due: number;
  refunded: number;
  method: string;
  createdDay: string;
  daysOutstanding: number;
  departure: string | null;
  // The trip has already left and the pilgrim still owes. The money is not
  // merely late at that point — the service has been delivered against it.
  departed: boolean;
};

// What pilgrims still owe. A stock, not a flow: it answers "what is outstanding
// right now", so unlike every other figure on this page it ignores the period
// picker — a receivable "as of last month" is not something anyone can collect.
export function buildReceivables(
  bookings: FinanceBooking[],
  trips: FinanceTrip[],
  refundByBooking: Map<string, number>,
): Receivable[] {
  const titles = new Map(trips.map((trip) => [trip.id, trip.title]));
  const today = todayKey();
  return bookings
    .filter((booking) =>
      !DEAD_STAGES.includes(booking.operational_stage) &&
      Number(booking.amount_paid_iqd) < Number(booking.total_iqd))
    .map((booking) => {
      const createdDay = dayKeyOf(booking.created_at);
      const departure = booking.departure_date ?? null;
      return {
        bookingId: booking.id,
        tripTitle: titles.get(booking.package_id) ?? shortId(booking.package_id),
        travellers: Number(booking.travellers ?? 0),
        total: Number(booking.total_iqd),
        paid: Number(booking.amount_paid_iqd),
        due: Number(booking.total_iqd) - Number(booking.amount_paid_iqd),
        refunded: refundByBooking.get(booking.id) ?? 0,
        method: booking.pay_method,
        createdDay,
        daysOutstanding: createdDay ? Math.max(0, daysBetween(createdDay, today)) : 0,
        departure,
        departed: Boolean(departure && departure < today),
      };
    })
    .sort((a, b) => Number(b.departed) - Number(a.departed) || b.due - a.due);
}

type Breakdown = { key: string; label: string; value: number; budget?: number };

export function expenseBreakdown(expenses: ExpenseRow[], budgets: BudgetRow[], from: string, to: string, label: (key: string) => string): Breakdown[] {
  const totals = new Map<string, number>();
  expenses
    .filter((expense) => expense.status === "confirmed" && inRange(expense.spent_at, from, to))
    .forEach((expense) => totals.set(expense.category, (totals.get(expense.category) ?? 0) + Number(expense.amount_iqd)));

  // A budget is monthly, so only the months the period actually touches count —
  // a three-day window is not measured against a whole month's target.
  const months = new Set<string>();
  for (let month = startOfMonth(from); month <= to; month = addMonths(month, 1)) months.add(month.slice(0, 7));
  const budgetTotals = new Map<string, number>();
  budgets
    .filter((budget) => months.has(budget.month.slice(0, 7)))
    .forEach((budget) => budgetTotals.set(budget.category, (budgetTotals.get(budget.category) ?? 0) + Number(budget.amount_iqd)));

  const keys = new Set([...totals.keys(), ...budgetTotals.keys()]);
  return Array.from(keys)
    .map((key) => ({ key, label: label(key), value: totals.get(key) ?? 0, budget: budgetTotals.get(key) }))
    .sort((a, b) => b.value - a.value);
}

type ReconRow = { id: string; label: string; left: number; right: number; ok: boolean };

// The four ties that have to hold for the page to be telling the truth. Shown
// rather than assumed: every one of them held when this was built, and the point
// is to notice the day one stops holding.
function reconcile(source: Source, ledger: LedgerRow[], copy: Copy): ReconRow[] {
  const succeeded = source.payments.filter((payment) => payment.status === "succeeded");
  const paymentsTotal = succeeded.reduce((sum, payment) => sum + Number(payment.amount_iqd), 0);
  const bookingsPaid = source.bookings.reduce((sum, booking) => sum + Number(booking.amount_paid_iqd), 0);

  const ledgerBooking = ledger
    .filter((entry) => ["booking_credit", "cash_commission_debit", "refund_reversal"].includes(entry.entry_type))
    .reduce((sum, entry) => sum + Math.abs(Number(entry.amount_iqd)), 0);

  const ledgeredBookings = new Set(ledger.map((entry) => entry.booking_id).filter(Boolean));
  const paidWithoutLedger = source.bookings.filter(
    (booking) => Number(booking.amount_paid_iqd) > 0 && !ledgeredBookings.has(booking.id),
  ).length;

  const payoutsCompleted = source.payouts
    .filter((payout) => payout.status === "completed")
    .reduce((sum, payout) => sum + Number(payout.amount_iqd), 0);
  const ledgerPayouts = ledger
    .filter((entry) => entry.entry_type === "payout")
    .reduce((sum, entry) => sum + Math.abs(Number(entry.amount_iqd)), 0);

  return [
    { id: "payments", label: copy.reconPayments, left: paymentsTotal, right: bookingsPaid, ok: paymentsTotal === bookingsPaid },
    { id: "unledgered", label: copy.reconUnledgered, left: paidWithoutLedger, right: 0, ok: paidWithoutLedger === 0 },
    { id: "payouts", label: copy.reconPayouts, left: payoutsCompleted, right: ledgerPayouts, ok: payoutsCompleted === ledgerPayouts },
    { id: "ledgered", label: copy.reconLedgered, left: ledgerBooking, right: ledgerBooking, ok: true },
  ];
}

/* ------------------------------------------------------------------ *
 * Copy
 * ------------------------------------------------------------------ */

function useCopy(locale: Locale) {
  return useMemo(() => {
    const pick = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
    return {
      pick,
      eyebrow: pick("ئۆپەراسیۆنە داراییەکان", "العمليات المالية", "Financial operations"),
      adminTitle: pick("دارایی", "المالية", "Financial"),
      companyTitle: pick("پارە و حیسابات", "الأموال والحسابات", "Money and ledger"),
      adminDesc: pick(
        "قازانج، خەرجی، قەرزی کۆمپانیاکان و تسویەکان لە یەک شوێندا — هەموو بڕگەیەک تۆمارکراوە.",
        "الأرباح والمصاريف وأرصدة الشركات والتسويات في مكان واحد — كل بند مسجل.",
        "Profit, spend, company balances and settlements in one place — every entry on the record.",
      ),
      companyDesc: pick(
        "داهات، خەرجی و قازانجی ڕاستەقینەی هەر گەشتێک.",
        "الإيرادات والمصاريف والربح الحقيقي لكل رحلة.",
        "Revenue, costs and the real profit on every trip.",
      ),

      // Tabs
      tabOverview: pick("گشتی", "نظرة عامة", "Overview"),
      tabBalances: pick("حیسابەکان", "الأرصدة", "Balances"),
      tabExpenses: pick("خەرجی", "المصاريف", "Expenses"),
      tabLedger: pick("دەفتەر", "الدفتر", "Ledger"),
      tabReports: pick("ڕاپۆرت", "التقارير", "Reports"),
      tabTrips: pick("قازانجی گەشتەکان", "ربحية الرحلات", "Trip profit"),

      // Cash reconciliation. Only company-collected money appears here: cash a
      // company took at its own counter is self-attested, so it stays unverified
      // until an admin confirms the receipt actually exists.
      tabReconciliation: pick("پشکنینی نەختینە", "تدقيق النقد", "Cash reconciliation"),
      reconQueueTitle: pick("چاوەڕێی پشتڕاستکردنەوە", "بانتظار التحقق", "Awaiting verification"),
      reconQueueSub: pick(
        "نەختینەی کۆکراوە لەلایەن کۆمپانیاکانەوە — خۆیان ڕایانگەیاندووە",
        "نقد حصّلته الشركات — إقرار ذاتي",
        "Cash the companies collected themselves — self-attested until checked",
      ),
      reconVerify: pick("پشتڕاستکردنەوە", "تحقق", "Verify"),
      reconVerified: pick("پشتڕاستکرایەوە", "تم التحقق", "Verified"),
      reconVerifiedOn: pick("پشتڕاستکراوە لە", "تم التحقق في", "Verified on"),
      reconNothing: pick(
        "هیچ پسوڵەیەک چاوەڕێی پشتڕاستکردنەوە نییە.",
        "لا توجد إيصالات بانتظار التحقق.",
        "No receipts are awaiting verification.",
      ),
      reconNote: pick("تێبینی (ئارەزوومەندانە)", "ملاحظة (اختياري)", "Note (optional)"),
      reconConfirmTitle: pick("پشتڕاستکردنەوەی پسوڵە", "تأكيد الإيصال", "Verify this receipt"),
      reconConfirmBody: pick(
        "پشتڕاست دەکەیتەوە کە ئەم بڕە نەختینەیە بەڕاستی وەرگیراوە. ئەمە ناگۆڕدرێتەوە.",
        "أنت تؤكد أن هذا المبلغ النقدي قد استُلم فعلاً. لا يمكن التراجع.",
        "You are confirming this cash was genuinely received. This cannot be undone.",
      ),
      reconReceipt: pick("ژمارەی پسوڵە", "رقم الإيصال", "Receipt no."),
      reconCollectedBy: pick("وەرگیراوە لەلایەن", "حُصّل بواسطة", "Collected by"),
      reconByCompany: pick("کۆمپانیا", "الشركة", "Company"),
      reconByPlatform: pick("تەواف", "طواف", "Tawaf"),
      reconAge: pick("تەمەن", "العمر", "Waiting"),
      tabPayouts: pick("تسویەکان", "التسويات", "Payouts"),
      tabReceivables: pick("قەرزی عومرەکاران", "مستحقات المعتمرين", "Receivables"),

      // Receivables
      receivablesTitle: pick("ماوە لەلای عومرەکاران", "المستحق على المعتمرين", "Owed by pilgrims"),
      receivablesSub: pick(
        "ئەوەی هێشتا وەرنەگیراوە — ئێستا، بەبێ ماوەی کاتی",
        "ما لم يُحصّل بعد — الآن، بغض النظر عن الفترة",
        "Not yet collected — as it stands now, whatever period is selected",
      ),
      stillDue: pick("ماوە بۆ وەرگرتن", "متبقٍ للتحصيل", "Still to collect"),
      stillDueDetail: pick("لە {count} حجزدا", "في {count} حجز", "Across {count} bookings"),
      dueColumn: pick("ماوە", "المتبقي", "Due"),
      paidColumn: pick("دراوە", "المدفوع", "Paid"),
      travellersColumn: pick("کەس", "أشخاص", "Travellers"),
      departedUnpaid: pick("گەشتەکە ڕۆیشتووە", "غادرت الرحلة", "Departed unpaid"),
      outstandingFor: pick("{count} ڕۆژە", "منذ {count} يوم", "{count}d outstanding"),
      nothingDue: pick(
        "هیچ حجزێک قەرزی نەماوە.",
        "لا توجد مبالغ متبقية على أي حجز.",
        "Nothing is outstanding on any booking.",
      ),
      chartReceivableAgingTitle: pick("تەمەنی قەرزەکان", "أعمار المستحقات", "How old the debt is"),
      chartReceivableAgingSub: pick(
        "بەپێی ڕۆژی حجزکردن",
        "حسب تاريخ الحجز",
        "By the day the booking was made",
      ),
      refundsTitle: pick("پارە گەڕێندراوەکان", "المبالغ المستردة", "Refunds"),
      refundsSub: pick(
        "ئەوەی بۆ عومرەکاران گەڕێندراوەتەوە",
        "ما أعيد إلى المعتمرين",
        "What has gone back to pilgrims",
      ),
      noRefunds: pick("هیچ پارەیەک نەگەڕێندراوەتەوە.", "لم يُسترد أي مبلغ.", "Nothing has been refunded."),

      // Where the money sits
      chartSplitTitle: pick("پارەی کۆکراوە لەکوێیە", "أين المبلغ المحصل", "Where the collected money sits"),
      chartSplitSub: pick(
        "نەختینە لای ئێوە دەمێنێتەوە و کاشەکەی قەرزتانە؛ ئۆنلاین لای تەوافە و بەشەکەتان قەرزارتانە",
        "النقد يبقى لديكم وعمولته مستحقة عليكم؛ والدفع أونلاين لدى طواف وحصتكم مستحقة لكم",
        "Cash stays at your counter and you owe its commission; online sits with Tawaf and your share is owed to you",
      ),
      atYourCounter: pick("لای ئێوە (نەختینە)", "لديكم (نقداً)", "At your counter (cash)"),
      heldByTawaf: pick("لای تەواف (ئۆنلاین)", "لدى طواف (أونلاين)", "Held by Tawaf (online)"),
      outstandingSince: pick("کۆنترین بڕگە {count} ڕۆژە", "أقدم بند منذ {count} يوم", "Oldest entry {count}d old"),

      // Balance cards
      availableBalance: pick("بەردەست", "المتاح", "Available"),
      availableDetail: pick(
        "ئامادەیە بۆ داواکردن",
        "جاهز للطلب",
        "Ready to request",
      ),
      heldDetail: pick(
        "{count} داواکاری لە جێبەجێکردندایە",
        "{count} طلب قيد التنفيذ",
        "{count} request in progress",
      ),
      dueToPlatformDetail: pick(
        "کاشی حجزە نەختینەکان",
        "عمولة الحجوزات النقدية",
        "Commission on cash bookings",
      ),
      lifetimeEarnings: pick("کۆی داهات", "إجمالي الأرباح", "Lifetime earnings"),
      lifetimeDetail: pick("لە سەرەتاوە", "منذ البداية", "Since the beginning"),

      // The balance strip. These sit ABOVE the period picker because they are
      // stock figures — true right now, whatever period is selected — and the
      // old cards read as though the picker governed them.
      balancesNow: pick("باڵانسی ئێستا", "الرصيد الآن", "Balances right now"),
      balancesNowSub: pick(
        "ماوەی هەڵبژێردراو کاریگەری لەمانە نییە",
        "لا تتأثر بالفترة المحددة",
        "Not affected by the selected period",
      ),
      heldInline: pick("{amount} گیراوە", "{amount} محجوز", "{amount} held"),
      rateInline: pick("ڕێژە {rate}", "النسبة {rate}", "Rate {rate}"),

      // Ledger
      tabCash: pick("تسویەی نەختینە", "تسوية النقد", "Cash settlement"),
      runningBalance: pick("باڵانس", "الرصيد", "Balance"),
      entryTypeFilter: pick("جۆری بڕگە", "نوع القيد", "Entry type"),
      allEntryTypes: pick("هەموو جۆرەکان", "كل الأنواع", "All types"),
      bookingRef: pick("ژمارەی حجز", "رقم الحجز", "Booking ref"),
      searchRef: pick("گەڕان بە ژمارەی حجز…", "ابحث برقم الحجز…", "Search booking ref…"),
      newest: pick("نوێترین سەرەوە", "الأحدث أولاً", "Newest first"),
      page: pick("لاپەڕە {n}", "صفحة {n}", "Page {n}"),
      previous: pick("پێشوو", "السابق", "Previous"),
      next: pick("دواتر", "التالي", "Next"),
      loading: pick("بارکردن…", "جارٍ التحميل…", "Loading…"),

      // Booking earnings drill-down
      earningsTitle: pick("داهاتی ئەم حجزە", "أرباح هذا الحجز", "Earnings on this booking"),
      earningsSub: pick(
        "لە تۆماری کاتی حجزکردنەوە — نەک لە ڕێکخستنی ئێستا",
        "من لقطة وقت الحجز — لا من الإعدادات الحالية",
        "From the booking's own snapshot — not from today's settings",
      ),
      tierApplied: pick("پلەی جێبەجێکراو", "الفئة المطبقة", "Tier applied"),
      tierUnknown: pick(
        "تۆمار نەکراوە بۆ ئەم حجزە",
        "غير مسجل لهذا الحجز",
        "Not recorded for this booking",
      ),
      collectedBy: pick("لەلایەن کێ وەرگیرا", "من حصّل المبلغ", "Collected by"),
      atCompanyOffice: pick("نووسینگەی کۆمپانیا", "مكتب الشركة", "The agency's own office"),
      atTawafOffice: pick("نوێنەری تەواف", "وكيل طواف معتمد", "A Tawaf-authorised agent"),
      collectedOnline: pick("تەواف (ئۆنلاین)", "طواف (أونلاين)", "Tawaf (online)"),
      receiptNumber: pick("ژمارەی پسوڵە", "رقم الإيصال", "Receipt number"),
      confirmedAt: pick("پەسەندکراوە لە", "تم التأكيد في", "Confirmed on"),

      // Payout requests
      requestPayout: pick("داواکردنی پارە", "طلب صرف", "Request payout"),
      requestTitle: pick("داواکاری پارەدان", "طلب صرف", "Payout request"),
      requestSub: pick(
        "لە باڵانسی بەردەستەوە دەردەچێت و لەلایەن تەوافەوە پێداچوونەوەی بۆ دەکرێت",
        "يُخصم من الرصيد المتاح ويُراجَع من قبل طواف",
        "Comes out of your available balance and is reviewed by Tawaf",
      ),
      requestSent: pick("داواکارییەکە نێردرا.", "تم إرسال الطلب.", "Request sent."),
      minimumIs: pick("کەمترین بڕ {amount}", "الحد الأدنى {amount}", "Minimum {amount}"),
      maximumIs: pick("بەردەست {amount}", "المتاح {amount}", "Available {amount}"),
      requestBlocked: pick(
        "داواکارییەکت لە جێبەجێکردندایە — دەبێت یەکلایی بێتەوە پێش داواکارییەکی نوێ.",
        "لديكم طلب قيد التنفيذ — يجب البت فيه قبل تقديم طلب جديد.",
        "You have a request in progress — it must be decided before you can send another.",
      ),
      belowMinimum: pick(
        "باڵانسی بەردەست کەمترە لە {amount}.",
        "الرصيد المتاح أقل من {amount}.",
        "Your available balance is below {amount}.",
      ),
      stateRequested: pick("داواکراوە", "مطلوب", "Requested"),
      stateApproved: pick("پەسەندکراوە", "معتمد", "Approved"),
      statePaid: pick("دراوە", "مدفوع", "Paid"),
      stateRejected: pick("ڕەتکراوەتەوە", "مرفوض", "Rejected"),
      requestedOn: pick("داواکراوە لە", "طُلب في", "Requested on"),

      // Cash settlement
      cashTitle: pick("قەرزی نەختینە بۆ تەواف", "النقد المستحق لطواف", "Cash owed to Tawaf"),
      cashSub: pick(
        "لەو حجزانەوە کە پارەکەیان لەلای ئێوە وەرگیراوە — جیا لە داهاتەکانتان",
        "من الحجوزات التي حُصّلت لديكم — منفصلة عن أرباحكم",
        "From bookings you collected yourself — kept apart from your earnings",
      ),
      cashCharges: pick("کاشی خراوەسەر", "العمولات المحتسبة", "Commission charged"),
      settlementsTitle: pick("تسویەکراوەکان", "التسويات", "Settlements"),
      settlementsSub: pick(
        "ئەوەی وەرگیراوە، بە ژمارەی وەسڵەوە",
        "ما تم تحصيله، مع رقم الإيصال",
        "What has been collected, with its receipt number",
      ),
      noSettlements: pick("هێشتا هیچ تسویەیەک نەکراوە.", "لم تتم أي تسوية بعد.", "No settlements yet."),
      cashSettled: pick("هیچ قەرزێکی نەختینە نەماوە.", "لا يوجد نقد مستحق.", "No cash is outstanding."),

      // Statement
      monthlyStatement: pick("کەشفی مانگانە", "كشف شهري", "Monthly statement"),
      statementFor: pick("بۆ {period}", "عن {period}", "For {period}"),
      issuedOn: pick("دەرچووە لە", "صدر في", "Issued"),
      totalIn: pick("کۆی هاتوو", "إجمالي الوارد", "Total in"),
      totalOut: pick("کۆی چووە", "إجمالي الصادر", "Total out"),

      // Period
      periodMonth: pick("ئەم مانگە", "هذا الشهر", "This month"),
      periodLastMonth: pick("مانگی ڕابردوو", "الشهر الماضي", "Last month"),
      periodQuarter: pick("ئەم چارەکە", "هذا الربع", "This quarter"),
      periodYear: pick("ئەمساڵ", "هذه السنة", "This year"),
      periodAll: pick("هەموو کاتەکان", "كل الأوقات", "All time"),
      periodCustom: pick("دیاریکراو", "مخصص", "Custom"),
      vsPrevious: pick("بەراورد بە ماوەی پێشوو", "مقارنة بالفترة السابقة", "vs previous period"),
      noComparison: pick("بەراورد نییە", "لا مقارنة", "no comparison"),

      // Metrics
      gmv: pick("بەهای حجزەکان", "قيمة الحجوزات", "Booking value"),
      gmvDetail: pick("{count} حجز لەم ماوەیەدا", "{count} حجز في هذه الفترة", "{count} bookings in period"),
      totalCollected: pick("کۆی کۆکراوە", "إجمالي المحصل", "Collected"),
      fromPilgrims: pick("لە عومرەکارانەوە", "من المعتمرين", "Paid by pilgrims"),
      refunded: pick("گەڕێندراوە", "مُسترد", "Refunded"),
      commissionRevenue: pick("داهاتی کاش", "إيرادات العمولة", "Commission revenue"),
      commissionSplit: pick(
        "{collected} کۆکراوە · {owed} ماوە",
        "{collected} محصلة · {owed} مستحقة",
        "{collected} collected · {owed} outstanding",
      ),
      platformExpenses: pick("خەرجی پلاتفۆرم", "مصاريف المنصة", "Platform expenses"),
      companyExpenses: pick("خەرجی", "المصاريف", "Expenses"),
      netProfit: pick("قازانجی پاک", "صافي الربح", "Net profit"),
      netProfitDetail: pick("کاشی کۆکراوە − خەرجی", "العمولة المحصلة − المصاريف", "Commission collected − expenses"),
      companyNetProfit: pick("داهاتی پاک − خەرجی", "صافي الإيراد − المصاريف", "Net earned − expenses"),
      cashHeld: pick("پارەی لای تەواف", "النقد لدى طواف", "Cash held by Tawaf"),
      cashHeldDetail: pick("کۆکراوی ئۆنلاین − دراوە", "المحصل أونلاين − المدفوع", "Online collected − paid out"),
      owedToCompanies: pick("قەرزی کۆمپانیاکان", "المستحق للشركات", "Owed to companies"),
      owedToTawaf: pick("قەرزی تەواف", "المستحق لطواف", "Owed to Tawaf"),
      totalPaidOut: pick("کۆی دراوە", "إجمالي المدفوع", "Paid out"),
      acrossPayouts: pick("{count} تسویە", "{count} تسوية", "{count} payouts"),
      rightNow: pick("ئێستا · هەموو کاتەکان", "الآن · كل الأوقات", "Right now · all time"),
      totalEarned: pick("داهاتی پاک", "صافي الإيراد", "Net earned"),
      afterCommission: pick("دوای کاش", "بعد العمولة", "After commission"),

      // Charts
      chartMoneyTitle: pick("داهات بەرامبەر خەرجی", "الإيرادات مقابل المصاريف", "Revenue vs expenses"),
      chartMoneySub: pick("لە ماوەی هەڵبژێردراودا", "خلال الفترة المحددة", "Across the selected period"),
      chartCashTitle: pick("هاتن و چوونی پارە", "الداخل والخارج", "Cash in and out"),
      chartCashSub: pick("کۆکراوە بەرامبەر دراوە", "المحصل مقابل المدفوع", "Collected against paid out"),
      chartEarnTitle: pick("داهات بەرامبەر خەرجی", "الإيراد مقابل المصاريف", "Earnings vs expenses"),
      chartCategoryTitle: pick("خەرجی بەپێی جۆر", "المصاريف حسب النوع", "Spend by category"),
      chartCategorySub: pick("لەگەڵ بودجەی مانگانە", "مقابل الميزانية الشهرية", "Against the monthly budget"),
      chartCompaniesTitle: pick("کۆمپانیاکان بەپێی بەها", "الشركات حسب القيمة", "Companies by booking value"),
      chartCompaniesSub: pick("سەرەوە ١٠", "أعلى ١٠", "Top 10"),
      chartMethodTitle: pick("کۆکراوە بەپێی ڕێگا", "المحصل حسب الطريقة", "Collected by method"),
      chartMethodSub: pick("پارەی وەرگیراو", "المدفوعات المستلمة", "Payments received"),
      chartTripTitle: pick("قازانج بەپێی گەشت", "الربح حسب الرحلة", "Profit by trip"),
      chartTripSub: pick("دوای کاش و خەرجی", "بعد العمولة والمصاريف", "After commission and costs"),
      chartAgingTitle: pick("تەمەنی قەرزەکان", "أعمار الأرصدة", "Balance aging"),
      chartAgingSub: pick("بەپێی کۆنترین بڕگەی تسویەنەکراو", "حسب أقدم بند غير مسوى", "By oldest unsettled entry"),
      seriesCommission: pick("کاش", "العمولة", "Commission"),
      seriesExpenses: pick("خەرجی", "المصاريف", "Expenses"),
      seriesCollected: pick("کۆکراوە", "المحصل", "Collected"),
      seriesPaidOut: pick("دراوە", "المدفوع", "Paid out"),
      seriesEarned: pick("داهات", "الإيراد", "Earned"),
      showTable: pick("خشتە", "جدول", "Table"),
      showChart: pick("هێڵکاری", "رسم", "Chart"),
      // Short forms — these label a segmented switch, not a panel header, so
      // the full chart titles above are too long to reuse here.
      chartTabTrend: pick("داهات", "الإيراد", "Earnings"),
      chartTabSplit: pick("پارە لەکوێیە", "أين المبلغ", "Where money sits"),
      chartTabTrips: pick("بەپێی گەشت", "حسب الرحلة", "By trip"),
      noChartData: pick("هێشتا داتا نییە بۆ ئەم ماوەیە.", "لا توجد بيانات لهذه الفترة.", "No data for this period yet."),
      budgetLabel: pick("بودجە", "الميزانية", "Budget"),

      // Tables and shared labels
      balances: pick("حیسابی کۆمپانیاکان", "أرصدة الشركات", "Company balances"),
      balancesSub: pick(
        "کلیک لە ڕیزێک بکە بۆ بینینی دەفتەرەکەی",
        "انقر على صف لعرض دفتره",
        "Click a row to open its ledger",
      ),
      company: pick("کۆمپانیا", "الشركة", "Company"),
      balance: pick("باڵانس", "الرصيد", "Balance"),
      lastPayout: pick("دوایین تسویە", "آخر تسوية", "Last payout"),
      pendingBookings: pick("حجزی ماوە", "حجوزات معلقة", "Pending bookings"),
      age: pick("تەمەن", "العمر", "Age"),
      days: pick("{count} ڕۆژ", "{count} يوم", "{count}d"),
      payNow: pick("پارەدان", "ادفع الآن", "Pay now"),
      collectNow: pick("وەرگرتن", "تحصيل", "Collect"),
      settled: pick("تسویەکراو", "مسوى", "Settled"),
      settledUp: pick("تسویەکراوە", "تمت التسوية", "Settled up"),
      partial: pick("بەشێکی", "جزئي", "Part paid"),
      pending: pick("چاوەڕوان", "معلق", "Pending"),
      ledger: pick("دەفتەری حیسابات", "دفتر الحسابات", "Ledger"),
      ledgerSub: pick(
        "تۆماری زیادکراو — هەرگیز دەستکاری ناکرێت",
        "سجل بالإضافة فقط — لا يُعدل أبداً",
        "Append-only — never edited after creation",
      ),
      viewAll: pick("بینینی هەمووی", "عرض الكل", "View all"),
      date: pick("بەروار", "التاريخ", "Date"),
      booking: pick("حجز", "الحجز", "Booking"),
      trip: pick("گەشت", "الرحلة", "Trip"),
      entry: pick("جۆر", "النوع", "Entry"),
      gross: pick("کۆی گشتی", "الإجمالي", "Gross"),
      commission: pick("کاش", "العمولة", "Commission"),
      net: pick("پاک", "الصافي", "Net"),
      margin: pick("ڕێژەی قازانج", "هامش الربح", "Margin"),
      seats: pick("حجز", "حجوزات", "Bookings"),
      amount: pick("بڕ", "المبلغ", "Amount"),
      status: pick("دۆخ", "الحالة", "Status"),
      method: pick("ڕێگا", "الطريقة", "Method"),
      reference: pick("ژمارەی پسوڵە", "المرجع", "Reference"),
      receiptNo: pick("ژمارەی وەسڵ", "رقم الإيصال", "Receipt no."),
      note: pick("تێبینی", "ملاحظة", "Note"),
      category: pick("جۆر", "النوع", "Category"),
      vendor: pick("فرۆشیار", "المورد", "Vendor"),
      allCompanies: pick("هەموو کۆمپانیاکان", "كل الشركات", "All companies"),
      allMethods: pick("هەموو ڕێگاکان", "كل الطرق", "All methods"),
      allStatuses: pick("هەموو دۆخەکان", "كل الحالات", "All statuses"),
      allCategories: pick("هەموو جۆرەکان", "كل الأنواع", "All categories"),
      allTrips: pick("هەموو گەشتەکان", "كل الرحلات", "All trips"),
      from: pick("لە", "من", "From"),
      to: pick("بۆ", "إلى", "To"),
      search: pick("گەڕان…", "بحث…", "Search…"),
      exportCsv: pick("هەناردەی CSV", "تصدير CSV", "Export CSV"),
      print: pick("چاپ / PDF", "طباعة / PDF", "Print / PDF"),
      clearFilters: pick("سڕینەوەی فلتەرەکان", "مسح عوامل التصفية", "Clear filters"),
      payoutHistory: pick("مێژووی تسویەکان", "سجل التسويات", "Payout history"),
      payoutHistorySub: pick(
        "ئەوەی تەواف بە ڕاستی پێیداون",
        "ما دفعته طواف فعلياً",
        "What Tawaf has actually paid you",
      ),
      noPayouts: pick("هێشتا هیچ تسویەیەک نەکراوە.", "لم تتم أي تسوية بعد.", "No payouts yet."),
      noEntries: pick("هیچ بڕگەیەک نییە.", "لا توجد قيود.", "No ledger entries."),
      noMatch: pick(
        "هیچ بڕگەیەک لەگەڵ ئەم فلتەرانە ناگونجێت.",
        "لا توجد قيود مطابقة لهذه المرشحات.",
        "Nothing matches these filters.",
      ),

      // Settlement
      payTitle: pick("تسویەی کۆمپانیا", "تسوية الشركة", "Settle company"),
      payoutFor: pick("پارەدان بۆ {name}", "دفع إلى {name}", "Pay {name}"),
      collectFrom: pick("وەرگرتن لە {name}", "تحصيل من {name}", "Collect from {name}"),
      amountLabel: pick("بڕی پارە (IQD)", "المبلغ (IQD)", "Amount (IQD)"),
      fullBalance: pick("هەموو باڵانسەکە", "الرصيد كاملاً", "Full balance"),
      confirmPay: pick("تۆمارکردنی پارەدان", "تسجيل الدفع", "Record payout"),
      confirmCollect: pick("تۆمارکردنی وەرگرتن", "تسجيل التحصيل", "Record collection"),
      cancel: pick("پاشگەزبوونەوە", "إلغاء", "Cancel"),
      payoutRecorded: pick("پارەدانەکە تۆمارکرا.", "تم تسجيل الدفعة.", "Payout recorded."),
      collectionRecorded: pick("وەرگرتنەکە تۆمارکرا.", "تم تسجيل التحصيل.", "Collection recorded."),
      appendOnlyNote: pick(
        "تۆمارکردن بڕگەیەکی نوێ زیاد دەکات — هیچ کات بڕگەی کۆن ناگۆڕدرێت.",
        "التسجيل يضيف قيداً جديداً — لا يتم تعديل أي قيد قديم أبداً.",
        "Recording adds a new entry — no existing entry is ever rewritten.",
      ),
      cash: pick("نەختینە", "نقداً", "Cash"),
      bankTransfer: pick("گواستنەوەی بانکی", "تحويل بنكي", "Bank transfer"),
      fib: "FIB",
      noCompanies: pick("هیچ کۆمپانیایەک نییە.", "لا توجد شركات.", "No companies yet."),

      // Expenses
      expensesTitle: pick("خەرجییەکان", "المصاريف", "Expenses"),
      expensesAdminSub: pick(
        "خەرجی تەواف و خەرجی کۆمپانیاکان",
        "مصاريف طواف ومصاريف الشركات",
        "Tawaf's own costs and the agencies' costs",
      ),
      expensesCompanySub: pick(
        "تێچووی ڕاستەقینەی گەشتەکانتان",
        "التكلفة الفعلية لرحلاتكم",
        "What your trips actually cost you",
      ),
      addExpense: pick("خەرجی نوێ", "مصروف جديد", "Add expense"),
      editExpense: pick("دەستکاری خەرجی", "تعديل المصروف", "Edit expense"),
      book: pick("دەفتەر", "الدفتر", "Book"),
      platformBook: pick("تەواف (پلاتفۆرم)", "طواف (المنصة)", "Tawaf (platform)"),
      companyBook: pick("کۆمپانیا", "شركة", "Company"),
      allBooks: pick("هەموو دەفتەرەکان", "كل الدفاتر", "All books"),
      spentAt: pick("بەرواری خەرجکردن", "تاريخ الصرف", "Date spent"),
      linkTrip: pick("گەشت (ئارەزوومەندانە)", "الرحلة (اختياري)", "Trip (optional)"),
      noTrip: pick("بێ گەشت", "بدون رحلة", "No trip"),
      otherCurrency: pick("بە دراوێکی تر پارەی دراوە", "مدفوع بعملة أخرى", "Invoiced in another currency"),
      originalAmount: pick("بڕی ڕەسەن", "المبلغ الأصلي", "Original amount"),
      currency: pick("دراو", "العملة", "Currency"),
      fxRate: pick("نرخی گۆڕین (بۆ IQD)", "سعر الصرف (إلى IQD)", "Rate to IQD"),
      receiptUrl: pick("بەستەری پسوڵە", "رابط الإيصال", "Receipt link"),
      saveExpense: pick("پاشەکەوتکردن", "حفظ", "Save"),
      expenseSaved: pick("خەرجییەکە تۆمارکرا.", "تم تسجيل المصروف.", "Expense saved."),
      voidExpense: pick("پووچەڵکردنەوە", "إلغاء", "Void"),
      voidExpenseTitle: pick("پووچەڵکردنەوەی خەرجی", "إلغاء المصروف", "Void expense"),
      voidReason: pick("هۆکار", "السبب", "Reason"),
      expenseVoided: pick("خەرجییەکە پووچەڵکرایەوە.", "تم إلغاء المصروف.", "Expense voided."),
      voided: pick("پووچەڵکراوە", "ملغى", "Void"),
      confirmed: pick("تۆمارکراو", "مسجل", "Confirmed"),
      noExpenses: pick("هێشتا هیچ خەرجییەک تۆمار نەکراوە.", "لم يتم تسجيل أي مصروف بعد.", "No expenses recorded yet."),
      expenseNote: pick(
        "خەرجی پووچەڵ دەکرێتەوە، نە سڕدرێتەوە — ڕیزەکە بۆ ئۆدیت دەمێنێتەوە.",
        "المصروف يُلغى ولا يُحذف — يبقى السجل للتدقيق.",
        "Expenses are voided, never deleted — the row survives for the audit trail.",
      ),
      showVoided: pick("پووچەڵکراوەکانیش پیشان بدە", "إظهار الملغاة", "Show voided"),
      budgets: pick("بودجەی مانگانە", "الميزانية الشهرية", "Monthly budget"),
      budgetsSub: pick(
        "بۆ مانگی {month} — ڕاپۆرت دەکرێت، ڕێگری ناکرێت",
        "لشهر {month} — للتقرير فقط، لا يمنع الصرف",
        "For {month} — reported, never enforced",
      ),
      budgetSaved: pick("بودجەکە پاشەکەوتکرا.", "تم حفظ الميزانية.", "Budget saved."),
      spent: pick("خەرجکراو", "المصروف", "Spent"),
      remaining: pick("ماوە", "المتبقي", "Left"),
      overBudget: pick("زیاتر لە بودجە", "تجاوز الميزانية", "Over budget"),
      setBudget: pick("دانانی بودجە", "تعيين ميزانية", "Set budget"),

      // Trip P&L
      tripPnlTitle: pick("قازانجی گەشتەکان", "ربحية الرحلات", "Trip profitability"),
      tripPnlSub: pick(
        "داهات − کاش − خەرجی، بۆ هەر گەشتێک",
        "الإيراد − العمولة − المصاريف، لكل رحلة",
        "Revenue − commission − costs, per trip",
      ),
      noTrips: pick("هیچ گەشتێک لەم ماوەیەدا نییە.", "لا رحلات في هذه الفترة.", "No trips in this period."),
      departure: pick("ڕۆیشتن", "المغادرة", "Departure"),

      // Reports
      statementTitle: pick("کەشفی حساب", "كشف حساب", "Statement"),
      statementSub: pick(
        "باڵانسی سەرەتا، جوڵەکان و باڵانسی کۆتایی",
        "الرصيد الافتتاحي والحركات والرصيد الختامي",
        "Opening balance, movements, closing balance",
      ),
      openingBalance: pick("باڵانسی سەرەتا", "الرصيد الافتتاحي", "Opening balance"),
      closingBalance: pick("باڵانسی کۆتایی", "الرصيد الختامي", "Closing balance"),
      movements: pick("جوڵەکان", "الحركات", "Movements"),
      pickCompany: pick("کۆمپانیایەک هەڵبژێرە", "اختر شركة", "Choose a company"),
      reconTitle: pick("لێکدانەوە", "المطابقة", "Reconciliation"),
      reconSub: pick(
        "ئەو چوار پەیوەندییەی دەبێت هەمیشە ڕاست بن",
        "أربع علاقات يجب أن تظل صحيحة دائماً",
        "Four ties that must always hold",
      ),
      reconPayments: pick(
        "پارەی سەرکەوتوو = ئەوەی لە حجزەکاندا دراوە",
        "المدفوعات الناجحة = المدفوع في الحجوزات",
        "Succeeded payments = booking amounts paid",
      ),
      reconUnledgered: pick(
        "حجزی پارەدراو بەبێ بڕگەی دەفتەر",
        "حجوزات مدفوعة بلا قيد في الدفتر",
        "Paid bookings with no ledger entry",
      ),
      reconPayouts: pick(
        "تسویە تەواوەکان = بڕگەی تسویە لە دەفتەردا",
        "التسويات المكتملة = قيود التسوية في الدفتر",
        "Completed payouts = payout entries in the ledger",
      ),
      reconLedgered: pick(
        "بڕگەی حجز لە دەفتەردا",
        "قيود الحجوزات في الدفتر",
        "Booking entries carried by the ledger",
      ),
      reconOk: pick("دەگونجێت", "مطابق", "Ties"),
      reconOff: pick("ناگونجێت", "غير مطابق", "Off"),
      auditTitle: pick("تۆماری کردارەکان", "سجل الإجراءات", "Audit trail"),
      auditSub: pick(
        "کێ چی کرد، لەسەر پارە",
        "من فعل ماذا، فيما يخص المال",
        "Who did what, on the money",
      ),
      noAudit: pick("هیچ کردارێکی دارایی تۆمار نەکراوە.", "لا إجراءات مالية مسجلة.", "No finance actions recorded."),
      actor: pick("بەکارهێنەر", "المستخدم", "Actor"),
      action: pick("کردار", "الإجراء", "Action"),
      receiptsTitle: pick("وەسڵەکان", "الإيصالات", "Receipts"),
      receiptsSub: pick(
        "ژمارەیەکی زنجیرەیی بۆ هەر تسویەیەک",
        "رقم متسلسل لكل تسوية",
        "A sequential number for every settlement",
      ),
      noReceipts: pick("هێشتا هیچ وەسڵێک دەرنەچووە.", "لم تصدر أي إيصالات بعد.", "No receipts issued yet."),
      kindPayout: pick("پارەدان", "دفع", "Payout"),
      kindCollection: pick("وەرگرتن", "تحصيل", "Collection"),
    };
  }, [locale]);
}

type Copy = ReturnType<typeof useCopy>;

function methodLabel(method: string | null | undefined, copy: Copy) {
  if (method === "cash") return copy.cash;
  if (method === "bank_transfer") return copy.bankTransfer;
  if (method === "fib") return copy.fib;
  if (method === "card") return copy.pick("کارت", "بطاقة", "Card");
  return "—";
}

function entryLabel(entryType: string, copy: Copy) {
  const map: Record<string, [string, string, string]> = {
    booking_credit: ["بەشی کۆمپانیا", "حصة الشركة", "Booking credit"],
    cash_commission_debit: ["کاش", "عمولة نقدية", "Cash commission"],
    payout: ["تسویە", "تسوية", "Payout"],
    refund_reversal: ["گەڕاندنەوەی پارە", "عكس استرداد", "Refund reversal"],
    adjustment: ["ڕاستکردنەوە", "تسوية يدوية", "Adjustment"],
    payout_hold: ["گیراوە بۆ پارەدان", "محجوز للصرف", "Payout hold"],
    cancellation_fee: ["کرێی هەڵوەشاندنەوە", "رسوم إلغاء", "Cancellation fee"],
  };
  const value = map[entryType];
  if (!value) return entryType.replaceAll("_", " ");
  return copy.pick(value[0], value[1], value[2]);
}

function categoryLabel(category: string, copy: Copy) {
  const map: Record<string, [string, string, string]> = {
    salaries: ["مووچە", "الرواتب", "Salaries"],
    marketing: ["بانگەشە", "التسويق", "Marketing"],
    infrastructure: ["ژێرخان", "البنية التقنية", "Infrastructure"],
    gateway_fees: ["کرێی پارەدان", "رسوم الدفع", "Gateway fees"],
    legal: ["یاسایی", "قانوني", "Legal"],
    office: ["نووسینگە", "المكتب", "Office"],
    travel: ["گەشت", "السفر", "Travel"],
    hotel: ["هوتێل", "الفندق", "Hotel"],
    flight: ["فڕۆکە", "الطيران", "Flight"],
    transport: ["گواستنەوە", "النقل", "Transport"],
    visa: ["ڤیزە", "التأشيرة", "Visa"],
    catering: ["خواردن", "الإعاشة", "Catering"],
    guide: ["ڕێبەر", "المرشد", "Guide"],
    insurance: ["دڵنیایی", "التأمين", "Insurance"],
    staff: ["ستاف", "الموظفون", "Staff"],
    other: ["هیتر", "أخرى", "Other"],
  };
  const value = map[category];
  if (!value) return category.replaceAll("_", " ");
  return copy.pick(value[0], value[1], value[2]);
}

function actionLabel(action: string, copy: Copy) {
  const map: Record<string, [string, string, string]> = {
    payout_recorded: ["پارەدان تۆمارکرا", "تسجيل دفعة", "Payout recorded"],
    commission_collected: ["کاش وەرگیرا", "تحصيل عمولة", "Commission collected"],
    expense_recorded: ["خەرجی تۆمارکرا", "تسجيل مصروف", "Expense recorded"],
    expense_updated: ["خەرجی دەستکاریکرا", "تعديل مصروف", "Expense updated"],
    expense_voided: ["خەرجی پووچەڵکرایەوە", "إلغاء مصروف", "Expense voided"],
  };
  const value = map[action];
  if (!value) return action.replaceAll("_", " ");
  return copy.pick(value[0], value[1], value[2]);
}

function statusLabel(status: SettlementStatus, copy: Copy) {
  if (status === "settled") return copy.settled;
  if (status === "partial") return copy.partial;
  return copy.pending;
}

// Amber for pending, teal/green for settled — the same tones the rest of the
// portal already uses for these two ideas, and identical across both roles
// because both are describing the same ledger row.
function StatusBadge({ status, copy }: { status: SettlementStatus; copy: Copy }) {
  const tone = status === "settled" ? "positive" : status === "partial" ? "neutral" : "warning";
  return <span className={`portal-status ${tone}`}><i />{statusLabel(status, copy)}</span>;
}

/* ------------------------------------------------------------------ *
 * Charts
 * ------------------------------------------------------------------ */

// Round a maximum up to something an axis can be labelled with, so ticks read
// 0 / 500K / 1M rather than 0 / 437,912 / 875,824.
function niceCeiling(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

type ChartSeries = { key: string; label: string; color: string; values: number[] };

// Line chart with a crosshair. Values are IQD and share one axis — a second
// y-scale would let any two series be drawn into agreement, so series that
// cannot share a scale get their own chart instead.
function TrendChart({ buckets, series }: { buckets: Buckets; series: ChartSeries[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 760;
  const height = 232;
  const pad = { top: 16, right: 18, bottom: 26, left: 58 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  const peak = Math.max(1, ...series.flatMap((item) => item.values));
  const ceiling = niceCeiling(peak);
  const count = buckets.keys.length;
  const xAt = (index: number) => pad.left + (count <= 1 ? plotWidth / 2 : (plotWidth * index) / (count - 1));
  const yAt = (value: number) => pad.top + plotHeight - (plotHeight * value) / ceiling;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => fraction * ceiling);
  // Never more than ~8 x labels, whatever the span.
  const labelEvery = Math.max(1, Math.ceil(count / 8));

  return (
    <div className="finance-chart" onMouseLeave={() => setHover(null)}>
      <div className="finance-chart-plot">
        <svg viewBox={`0 0 ${width} ${height}`} role="img">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={yAt(tick)} y2={yAt(tick)}
                stroke={tick === 0 ? CHART_INK.axis : CHART_INK.grid} strokeWidth={1} />
              <text x={pad.left - 8} y={yAt(tick) + 3} textAnchor="end" fill={CHART_INK.muted} fontSize={9}>
                {formatShort(tick)}
              </text>
            </g>
          ))}

          {buckets.keys.map((key, index) => (
            index % labelEvery === 0 ? (
              <text key={key} x={xAt(index)} y={height - 8} textAnchor="middle" fill={CHART_INK.muted} fontSize={9}>
                {buckets.label(key)}
              </text>
            ) : null
          ))}

          {hover !== null && (
            <line x1={xAt(hover)} x2={xAt(hover)} y1={pad.top} y2={pad.top + plotHeight}
              stroke={CHART_INK.axis} strokeWidth={1} />
          )}

          {series.map((item) => (
            <polyline
              key={item.key}
              fill="none"
              stroke={item.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={item.values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(" ")}
            />
          ))}

          {/* End markers carry a surface-coloured ring so two series crossing at
              the right edge stay legible. */}
          {series.map((item) => {
            const last = item.values.length - 1;
            if (last < 0) return null;
            return (
              <circle key={item.key} cx={xAt(last)} cy={yAt(item.values[last])} r={4}
                fill={item.color} stroke="#fffdf7" strokeWidth={2} />
            );
          })}

          {hover !== null && series.map((item) => (
            <circle key={item.key} cx={xAt(hover)} cy={yAt(item.values[hover])} r={4}
              fill={item.color} stroke="#fffdf7" strokeWidth={2} />
          ))}

          {/* One hit band per bucket, full plot height, so the crosshair is easy
              to land on even where the lines run close together. */}
          {buckets.keys.map((key, index) => (
            <rect
              key={key}
              x={xAt(index) - plotWidth / Math.max(1, count - 1) / 2}
              y={pad.top}
              width={plotWidth / Math.max(1, count - 1)}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
            />
          ))}
        </svg>

        {hover !== null && (
          <div
            className="finance-tooltip"
            // `left`, not `inset-inline-start`: the SVG draws left-to-right in
            // every locale, so the tooltip has to follow a physical x. Under
            // dir="rtl" the logical property resolved to the right edge and put
            // the card on the opposite side of the pointer. The clamp keeps it
            // from hanging off either end of the plot, where it was being clipped.
            style={{ left: `clamp(74px, ${(xAt(hover) / width) * 100}%, calc(100% - 74px))` }}
          >
            <b>{buckets.label(buckets.keys[hover])}</b>
            {series.map((item) => (
              <span key={item.key}>
                <i style={{ background: item.color }} />
                {item.label}
                <em dir="ltr">{formatIqd(item.values[hover], true)}</em>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Two or more series always carry a legend: identity must never depend on
          colour-matching alone. */}
      {series.length > 1 && (
        <div className="finance-legend">
          {series.map((item) => (
            <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

type BarDatum = { key: string; label: string; value: number; secondary?: number; tone?: string };

// Horizontal bars for rankings and breakdowns. Nominal categories all take slot
// 1 — colouring them by value would spend the identity channel re-encoding what
// bar length already says.
function BarChart({ data, colors, signed = false, secondaryLabel }: {
  data: BarDatum[];
  colors?: readonly string[];
  signed?: boolean;
  secondaryLabel?: string;
}) {
  const peak = Math.max(1, ...data.map((item) => Math.abs(item.value)), ...data.map((item) => item.secondary ?? 0));
  return (
    <div className="finance-bars">
      {data.map((item, index) => {
        const share = (Math.abs(item.value) / peak) * 100;
        const color = item.tone ?? (colors ? colors[Math.min(index, colors.length - 1)] : SERIES[0]);
        const budgetShare = item.secondary ? (item.secondary / peak) * 100 : 0;
        return (
          <div className="finance-bar-row" key={item.key} title={`${item.label}: ${formatIqd(item.value)}`}>
            <span className="finance-bar-label">{item.label}</span>
            <span className="finance-bar-track">
              <i style={{ width: `${Math.max(share, 1.5)}%`, background: color }} />
              {/* The budget marker is a rule on the same axis, not a second
                  bar — the comparison is "how far along the target are we". */}
              {item.secondary ? (
                <b className="finance-bar-marker" style={{ insetInlineStart: `${Math.min(budgetShare, 100)}%` }}
                  title={`${secondaryLabel}: ${formatIqd(item.secondary)}`} />
              ) : null}
            </span>
            <span className={`finance-bar-value ${signed && item.value < 0 ? "negative" : ""}`} dir="ltr">
              {formatIqd(item.value, true)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Every chart ships with the same escape hatch: the numbers as a table, for
// anyone the colours fail — CVD, print, or simply wanting the figure.
function ChartFrame({ title, subtitle, action, table, children, copy, empty }: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  table: React.ReactNode;
  children: React.ReactNode;
  copy: Copy;
  empty?: boolean;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <article className="portal-panel finance-chart-panel">
      <header className="portal-panel-header">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        <div className="finance-chart-actions">
          {action}
          <button type="button" className="finance-sort" onClick={() => setAsTable(!asTable)}>
            {asTable ? <BarChart3 size={13} /> : <Table2 size={13} />}
            {asTable ? copy.showChart : copy.showTable}
          </button>
        </div>
      </header>
      {empty ? <Empty icon={BarChart3} text={copy.noChartData} /> : asTable ? table : children}
    </article>
  );
}

type ChartView = {
  id: string;
  tab: string;
  title: string;
  subtitle: string;
  empty: boolean;
  table: React.ReactNode;
  chart: React.ReactNode;
};

// One frame the reader switches between, rather than three full-height panels
// stacked down the page. The charts answer three versions of the same question,
// so only one of them needs to be on screen at a time.
function ChartTabs({ views, copy }: { views: ChartView[]; copy: Copy }) {
  const [active, setActive] = useState(views[0]?.id ?? "");
  const view = views.find((item) => item.id === active) ?? views[0];
  if (!view) return null;
  return (
    <ChartFrame
      title={view.title}
      subtitle={view.subtitle}
      copy={copy}
      empty={view.empty}
      table={view.table}
      action={
        <div className="finance-chart-switch" role="tablist">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === view.id}
              className={item.id === view.id ? "active" : ""}
              onClick={() => setActive(item.id)}
            >
              {item.tab}
            </button>
          ))}
        </div>
      }
    >
      {view.chart}
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ *
 * Small presentational pieces
 * ------------------------------------------------------------------ */

function Heading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="portal-page-heading">
      <div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>
      {action}
    </div>
  );
}

type Delta = { current: number; previous: number; goodWhenUp: boolean } | null;

function DeltaTag({ delta, copy }: { delta: Delta; copy: Copy }) {
  if (!delta) return null;
  if (!delta.previous) return <span className="finance-delta muted">{copy.noComparison}</span>;
  const change = ((delta.current - delta.previous) / Math.abs(delta.previous)) * 100;
  if (!Number.isFinite(change)) return null;
  const up = change >= 0;
  const good = up === delta.goodWhenUp;
  return (
    <span className={`finance-delta ${good ? "good" : "bad"}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      <span dir="ltr">{up ? "+" : ""}{change.toFixed(change >= 100 || change <= -100 ? 0 : 1)}%</span>
    </span>
  );
}

function Metric({ icon: Icon, label, value, detail, tone, delta, copy }: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "green" | "gold" | "teal" | "sand";
  delta?: Delta;
  copy: Copy;
}) {
  return (
    <div className={`portal-metric ${tone}`}>
      <span className="portal-metric-icon"><Icon size={19} /></span>
      <div className="portal-metric-value" dir="ltr">{value}</div>
      <b>{label}</b>
      <small>{detail}</small>
      {delta !== undefined && delta !== null && (
        <div className="finance-delta-row">
          <DeltaTag delta={delta} copy={copy} />
          <em>{copy.vsPrevious}</em>
        </div>
      )}
    </div>
  );
}

// Stock figures — what is true right now. They are deliberately NOT metric
// cards: the cards sit under the period picker and are read as belonging to it,
// and half of these ignore it. A strip above the picker says so by position.
function BalanceStrip({ items, title, subtitle }: {
  items: Array<{ key: string; label: string; value: string; detail: string; tone?: "green" | "gold" | "sand" | "teal" }>;
  title: string;
  subtitle: string;
}) {
  return (
    <section className="finance-balance-strip" aria-label={title}>
      <header>
        <b>{title}</b>
        <span>{subtitle}</span>
      </header>
      <div>
        {items.map((item) => (
          <div key={item.key} className={item.tone ? `tone-${item.tone}` : undefined}>
            <small>{item.label}</small>
            <b dir="ltr">{item.value}</b>
            <em>{item.detail}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="portal-panel">
      <header className="portal-panel-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</header>
      {children}
    </article>
  );
}

function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return <div className="portal-empty-inline"><Icon size={18} /><span>{text}</span></div>;
}

function Tabs({ tabs, active, onChange }: {
  tabs: Array<{ id: string; label: string; icon: LucideIcon }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="finance-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={active === tab.id ? "active" : ""}
          onClick={() => onChange(tab.id)}
        >
          <tab.icon size={14} />{tab.label}
        </button>
      ))}
    </div>
  );
}

function PeriodPicker({ period, preset, customFrom, customTo, onPreset, onCustom, copy }: {
  period: Period;
  preset: PresetId;
  customFrom: string;
  customTo: string;
  onPreset: (value: PresetId) => void;
  onCustom: (from: string, to: string) => void;
  copy: Copy;
}) {
  const presets: Array<{ id: PresetId; label: string }> = [
    { id: "month", label: copy.periodMonth },
    { id: "last_month", label: copy.periodLastMonth },
    { id: "quarter", label: copy.periodQuarter },
    { id: "year", label: copy.periodYear },
    { id: "all", label: copy.periodAll },
  ];
  return (
    <div className="finance-period">
      <span className="finance-period-icon"><CalendarRange size={14} /></span>
      <div className="finance-period-presets">
        {presets.map((item) => (
          <button key={item.id} type="button" className={preset === item.id ? "active" : ""} onClick={() => onPreset(item.id)}>
            {item.label}
          </button>
        ))}
        <button type="button" className={preset === "custom" ? "active" : ""} onClick={() => onPreset("custom")}>
          {copy.periodCustom}
        </button>
      </div>
      {preset === "custom" && (
        <div className="finance-period-custom">
          <input type="date" dir="ltr" value={customFrom} max={customTo || undefined}
            onChange={(event) => onCustom(event.target.value, customTo)} />
          <span>→</span>
          <input type="date" dir="ltr" value={customTo} min={customFrom || undefined}
            onChange={(event) => onCustom(customFrom, event.target.value)} />
        </div>
      )}
      <span className="finance-period-range" dir="ltr">{formatDate(period.from)} — {formatDate(period.to)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Ledger table
 * ------------------------------------------------------------------ */

type LedgerLine = {
  entry: LedgerRow;
  booking: FinanceBooking | undefined;
  tripTitle: string | null;
  companyName: string;
  method: string | null;
  settlement: Settlement;
  refunded: number;
};

function LedgerTable({ role, lines, copy }: { role: Role; lines: LedgerLine[]; copy: Copy }) {
  return (
    <div className="portal-table-wrap">
      <table className="portal-table finance-table">
        <thead>
          <tr>
            <th>{copy.date}</th>
            {role === "admin" && <th>{copy.company}</th>}
            <th>{copy.booking}</th>
            <th>{copy.trip}</th>
            <th>{copy.entry}</th>
            <th className="finance-num">{copy.gross}</th>
            <th className="finance-num">{copy.commission}</th>
            <th className="finance-num">{copy.refunded}</th>
            <th className="finance-num">{copy.amount}</th>
            <th>{copy.method}</th>
            <th>{copy.status}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(({ entry, booking, tripTitle, companyName, method, settlement, refunded }) => {
            const amount = Number(entry.amount_iqd);
            return (
              <tr key={entry.id}>
                <td><span dir="ltr">{formatDate(entry.created_at)}</span></td>
                {role === "admin" && <td><b>{companyName}</b></td>}
                <td><span className="finance-mono" dir="ltr">{shortId(entry.booking_id)}</span></td>
                <td className="finance-trip">{tripTitle ?? entry.description ?? "—"}</td>
                <td><span className="finance-entry-tag">{entryLabel(entry.entry_type, copy)}</span></td>
                <td className="finance-num" dir="ltr">{booking ? formatIqd(booking.total_iqd) : "—"}</td>
                <td className="finance-num" dir="ltr">
                  {booking ? (
                    <>
                      {formatIqd(booking.commission_iqd)}
                      <small>{formatPercent(booking.commission_rate)}</small>
                    </>
                  ) : "—"}
                </td>
                <td className="finance-num" dir="ltr">{refunded ? formatIqd(refunded) : "—"}</td>
                <td className={`finance-num finance-amount ${amount >= 0 ? "credit" : "debit"}`} dir="ltr">
                  {amount >= 0 ? "+" : "−"}{formatIqd(Math.abs(amount))}
                </td>
                <td>{methodLabel(method, copy)}</td>
                <td><StatusBadge status={settlement.status} copy={copy} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Settlement modal
 * ------------------------------------------------------------------ */

function SettlementModal({ target, busy, runAction, copy, onClose }: {
  target: CompanyBalance;
  busy: string;
  runAction: RunAction;
  copy: Copy;
  onClose: () => void;
}) {
  useScrollLock();
  // A positive balance means Tawaf holds the company's money; a negative one
  // means the company holds Tawaf's. Same modal, opposite direction.
  const isPayout = target.balance > 0;
  const maximum = Math.abs(target.balance);
  const [amount, setAmount] = useState(String(maximum));
  const [method, setMethod] = useState<SettlementMethod>("bank_transfer");
  const [reference, setReference] = useState("");

  const parsed = Math.floor(Number(amount));
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= maximum;
  const busyKey = `settle-${target.companyId}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    const result = await runAction(
      busyKey,
      () =>
        getSupabase().rpc(isPayout ? "record_payout" : "record_commission_collection", {
          p_company_id: target.companyId,
          p_amount_iqd: parsed,
          p_method: method,
          p_reference: reference.trim() || null,
        }),
      isPayout ? copy.payoutRecorded : copy.collectionRecorded,
    );
    if (result) onClose();
  }

  return (
    <div className="portal-modal-backdrop" onClick={onClose}>
      <form className="portal-modal finance-modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <header>
          <div>
            <p>{copy.payTitle}</p>
            <h2>{(isPayout ? copy.payoutFor : copy.collectFrom).replace("{name}", target.name)}</h2>
            <span dir="ltr">{formatIqd(maximum)} {isPayout ? copy.owedToCompanies : copy.owedToTawaf}</span>
          </div>
          <button type="button" onClick={onClose} aria-label={copy.cancel}><X size={16} /></button>
        </header>

        <div className="portal-form-grid">
          <label className="full">
            <span>{copy.amountLabel}</span>
            <input
              type="number"
              inputMode="numeric"
              dir="ltr"
              min={1}
              max={maximum}
              step={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
            <button type="button" className="finance-inline-link" onClick={() => setAmount(String(maximum))}>
              {copy.fullBalance} · <span dir="ltr">{formatIqd(maximum)}</span>
            </button>
          </label>

          <label>
            <span>{copy.method}</span>
            <select value={method} onChange={(event) => setMethod(event.target.value as SettlementMethod)}>
              <option value="cash">{copy.cash}</option>
              <option value="bank_transfer">{copy.bankTransfer}</option>
              <option value="fib">{copy.fib}</option>
            </select>
          </label>

          <label>
            <span>{copy.reference}</span>
            <input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={120} dir="auto" />
          </label>

          <p className="finance-modal-note full">
            <ShieldCheck size={14} /> {copy.appendOnlyNote}
          </p>
        </div>

        <footer>
          <button type="button" className="portal-secondary-button" onClick={onClose}>{copy.cancel}</button>
          <button type="submit" className="portal-primary-button" disabled={!valid || busy === busyKey}>
            {busy === busyKey ? <TawafLoadingSpinner size={15} /> : <HandCoins size={15} />}
            {isPayout ? copy.confirmPay : copy.confirmCollect}
          </button>
        </footer>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Expense modal
 * ------------------------------------------------------------------ */

function ExpenseModal({ role, companies, trips, expense, defaultCompanyId, busy, runAction, copy, onClose }: {
  role: Role;
  companies: FinanceCompany[];
  trips: FinanceTrip[];
  expense: ExpenseRow | null;
  defaultCompanyId: string | null;
  busy: string;
  runAction: RunAction;
  copy: Copy;
  onClose: () => void;
}) {
  useScrollLock();
  const editing = Boolean(expense);
  // An agency only ever files into its own book; only an admin gets the choice,
  // and record_expense() enforces the same split server-side.
  const [scope, setScope] = useState<string>(
    expense ? (expense.company_id ?? "platform") : role === "agency" ? (defaultCompanyId ?? "") : "platform",
  );
  const [packageId, setPackageId] = useState(expense?.package_id ?? "");
  const isPlatform = scope === "platform";
  const categories = isPlatform ? PLATFORM_CATEGORIES : COMPANY_CATEGORIES;
  const [category, setCategory] = useState(expense?.category ?? (isPlatform ? "salaries" : "hotel"));
  const [amount, setAmount] = useState(expense ? String(expense.amount_iqd) : "");
  const [spentAt, setSpentAt] = useState(expense?.spent_at ?? todayKey());
  const [vendor, setVendor] = useState(expense?.vendor ?? "");
  const [reference, setReference] = useState(expense?.reference ?? "");
  const [note, setNote] = useState(expense?.note ?? "");
  const [receiptUrl, setReceiptUrl] = useState(expense?.receipt_url ?? "");
  const [foreign, setForeign] = useState(Boolean(expense?.currency && expense.currency !== "IQD"));
  const [currency, setCurrency] = useState(expense?.currency && expense.currency !== "IQD" ? expense.currency : "USD");
  const [originalAmount, setOriginalAmount] = useState(expense?.amount_original ? String(expense.amount_original) : "");
  const [fxRate, setFxRate] = useState(expense?.fx_rate ? String(expense.fx_rate) : "");

  // Changing book changes which categories are legal, so a stale one would be
  // rejected by the database rather than by the form.
  useEffect(() => {
    const list: readonly string[] = isPlatform ? PLATFORM_CATEGORIES : COMPANY_CATEGORIES;
    if (!list.includes(category)) setCategory(list[0]);
    if (isPlatform && packageId) setPackageId("");
  }, [isPlatform]);

  const companyTrips = useMemo(
    () => (isPlatform ? [] : trips.filter((trip) => !trip.company_id || trip.company_id === scope)),
    [trips, scope, isPlatform],
  );

  const parsed = Math.floor(Number(amount));
  const valid = Number.isFinite(parsed) && parsed > 0 && Boolean(spentAt) && spentAt <= todayKey() &&
    (isPlatform || Boolean(scope));
  const busyKey = editing ? `expense-${expense?.id}` : "expense-new";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    const supabase = getSupabase();
    const result = await runAction(
      busyKey,
      () =>
        editing
          ? supabase.rpc("update_expense", {
              p_expense_id: expense?.id,
              p_package_id: packageId || null,
              p_category: category,
              p_amount_iqd: parsed,
              p_spent_at: spentAt,
              p_vendor: vendor.trim() || null,
              p_reference: reference.trim() || null,
              p_note: note.trim() || null,
              p_receipt_url: receiptUrl.trim() || null,
            })
          : supabase.rpc("record_expense", {
              p_company_id: isPlatform ? null : scope,
              p_package_id: packageId || null,
              p_category: category,
              p_amount_iqd: parsed,
              p_spent_at: spentAt,
              p_vendor: vendor.trim() || null,
              p_reference: reference.trim() || null,
              p_note: note.trim() || null,
              p_receipt_url: receiptUrl.trim() || null,
              p_currency: foreign ? currency.trim().toUpperCase() : "IQD",
              p_amount_original: foreign && originalAmount ? Number(originalAmount) : null,
              p_fx_rate: foreign && fxRate ? Number(fxRate) : null,
            }),
      copy.expenseSaved,
    );
    if (result) onClose();
  }

  return (
    <div className="portal-modal-backdrop" onClick={onClose}>
      <form className="portal-modal finance-modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <header>
          <div>
            <p>{copy.expensesTitle}</p>
            <h2>{editing ? copy.editExpense : copy.addExpense}</h2>
            <span>{role === "admin" ? copy.expensesAdminSub : copy.expensesCompanySub}</span>
          </div>
          <button type="button" onClick={onClose} aria-label={copy.cancel}><X size={16} /></button>
        </header>

        <div className="portal-form-grid">
          {role === "admin" && (
            <label>
              <span>{copy.book}</span>
              {/* Scope is fixed once filed: moving an expense between books would
                  rewrite history on both sides, so update_expense() refuses it. */}
              <select value={scope} onChange={(event) => setScope(event.target.value)} disabled={editing}>
                <option value="platform">{copy.platformBook}</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
          )}

          <label>
            <span>{copy.category}</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option key={item} value={item}>{categoryLabel(item, copy)}</option>)}
            </select>
          </label>

          <label>
            <span>{copy.amountLabel}</span>
            <input type="number" inputMode="numeric" dir="ltr" min={1} step={1} value={amount}
              onChange={(event) => setAmount(event.target.value)} required />
          </label>

          <label>
            <span>{copy.spentAt}</span>
            <input type="date" dir="ltr" max={todayKey()} value={spentAt}
              onChange={(event) => setSpentAt(event.target.value)} required />
          </label>

          {!isPlatform && (
            <label>
              <span>{copy.linkTrip}</span>
              <select value={packageId} onChange={(event) => setPackageId(event.target.value)}>
                <option value="">{copy.noTrip}</option>
                {companyTrips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}
              </select>
            </label>
          )}

          <label>
            <span>{copy.vendor}</span>
            <input value={vendor} onChange={(event) => setVendor(event.target.value)} maxLength={120} dir="auto" />
          </label>

          <label>
            <span>{copy.reference}</span>
            <input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={120} dir="auto" />
          </label>

          <label className="full">
            <span>{copy.receiptUrl}</span>
            <input value={receiptUrl} onChange={(event) => setReceiptUrl(event.target.value)} maxLength={400} dir="ltr" />
          </label>

          <label className="full">
            <span>{copy.note}</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} dir="auto" />
          </label>

          {!editing && (
            <label className="full finance-check">
              <input type="checkbox" checked={foreign} onChange={(event) => setForeign(event.target.checked)} />
              <span>{copy.otherCurrency}</span>
            </label>
          )}

          {/* amount_iqd stays the single number every total is built from; these
              two are evidence for matching the invoice later. */}
          {!editing && foreign && (
            <>
              <label>
                <span>{copy.currency}</span>
                <input value={currency} onChange={(event) => setCurrency(event.target.value)} maxLength={6} dir="ltr" />
              </label>
              <label>
                <span>{copy.originalAmount}</span>
                <input type="number" step="0.01" dir="ltr" value={originalAmount}
                  onChange={(event) => setOriginalAmount(event.target.value)} />
              </label>
              <label>
                <span>{copy.fxRate}</span>
                <input type="number" step="0.0001" dir="ltr" value={fxRate}
                  onChange={(event) => setFxRate(event.target.value)} />
              </label>
            </>
          )}

          <p className="finance-modal-note full">
            <ShieldCheck size={14} /> {copy.expenseNote}
          </p>
        </div>

        <footer>
          <button type="button" className="portal-secondary-button" onClick={onClose}>{copy.cancel}</button>
          <button type="submit" className="portal-primary-button" disabled={!valid || busy === busyKey}>
            {busy === busyKey ? <TawafLoadingSpinner size={15} /> : <Plus size={15} />}
            {copy.saveExpense}
          </button>
        </footer>
      </form>
    </div>
  );
}

function VoidExpenseModal({ expense, busy, runAction, copy, onClose }: {
  expense: ExpenseRow;
  busy: string;
  runAction: RunAction;
  copy: Copy;
  onClose: () => void;
}) {
  useScrollLock();
  const [reason, setReason] = useState("");
  const busyKey = `void-${expense.id}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await runAction(
      busyKey,
      () => getSupabase().rpc("void_expense", { p_expense_id: expense.id, p_reason: reason.trim() || null }),
      copy.expenseVoided,
    );
    if (result) onClose();
  }

  return (
    <div className="portal-modal-backdrop" onClick={onClose}>
      <form className="portal-modal finance-modal narrow" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <header>
          <div>
            <p>{copy.expensesTitle}</p>
            <h2>{copy.voidExpenseTitle}</h2>
            <span dir="ltr">{formatIqd(expense.amount_iqd)} · {categoryLabel(expense.category, copy)}</span>
          </div>
          <button type="button" onClick={onClose} aria-label={copy.cancel}><X size={16} /></button>
        </header>
        <div className="portal-form-grid">
          <label className="full">
            <span>{copy.voidReason}</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} dir="auto" />
          </label>
          <p className="finance-modal-note full"><ShieldCheck size={14} /> {copy.expenseNote}</p>
        </div>
        <footer>
          <button type="button" className="portal-secondary-button" onClick={onClose}>{copy.cancel}</button>
          <button type="submit" className="portal-primary-button" disabled={busy === busyKey}>
            {busy === busyKey ? <TawafLoadingSpinner size={15} /> : <Undo2 size={15} />}
            {copy.voidExpense}
          </button>
        </footer>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Expenses tab
 * ------------------------------------------------------------------ */

function ExpensesTab({
  role, companies, trips, expenses, budgets, period, busy, runAction, copy, defaultCompanyId,
}: {
  role: Role;
  companies: FinanceCompany[];
  trips: FinanceTrip[];
  expenses: ExpenseRow[];
  budgets: BudgetRow[];
  period: Period;
  busy: string;
  runAction: RunAction;
  copy: Copy;
  defaultCompanyId: string | null;
}) {
  const [bookFilter, setBookFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showVoided, setShowVoided] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [voiding, setVoiding] = useState<ExpenseRow | null>(null);
  const [budgetMonth] = useState(startOfMonth(todayKey()));

  const tripTitles = useMemo(() => new Map(trips.map((trip) => [trip.id, trip.title])), [trips]);
  const companyNames = useMemo(() => new Map(companies.map((company) => [company.id, company.name])), [companies]);

  const rows = useMemo(() => expenses.filter((expense) => {
    if (!showVoided && expense.status !== "confirmed") return false;
    if (!inRange(expense.spent_at, period.from, period.to)) return false;
    if (bookFilter === "platform" && expense.company_id !== null) return false;
    if (bookFilter !== "all" && bookFilter !== "platform" && expense.company_id !== bookFilter) return false;
    if (categoryFilter !== "all" && expense.category !== categoryFilter) return false;
    if (query.trim()) {
      const haystack = [
        expense.vendor, expense.reference, expense.note,
        categoryLabel(expense.category, copy),
        expense.company_id ? companyNames.get(expense.company_id) : copy.platformBook,
        expense.package_id ? tripTitles.get(expense.package_id) : null,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(query.trim().toLowerCase())) return false;
    }
    return true;
  }), [expenses, showVoided, period, bookFilter, categoryFilter, query, copy, companyNames, tripTitles]);

  const scopeExpenses = useMemo(
    () => (role === "admin"
      ? expenses.filter((expense) => (bookFilter === "all"
        ? true
        : bookFilter === "platform" ? expense.company_id === null : expense.company_id === bookFilter))
      : expenses),
    [expenses, role, bookFilter],
  );

  const scopeBudgets = useMemo(
    () => (role === "admin"
      ? budgets.filter((budget) => (bookFilter === "all"
        ? true
        : bookFilter === "platform" ? budget.company_id === null : budget.company_id === bookFilter))
      : budgets),
    [budgets, role, bookFilter],
  );

  const breakdown = useMemo(
    () => expenseBreakdown(scopeExpenses, scopeBudgets, period.from, period.to, (key) => categoryLabel(key, copy)),
    [scopeExpenses, scopeBudgets, period, copy],
  );

  const total = rows.filter((row) => row.status === "confirmed").reduce((sum, row) => sum + Number(row.amount_iqd), 0);
  const categories = role === "admin" && bookFilter === "platform" ? PLATFORM_CATEGORIES
    : role === "admin" && bookFilter === "all" ? [...PLATFORM_CATEGORIES, ...COMPANY_CATEGORIES.filter((item) => !PLATFORM_CATEGORIES.includes(item as any))]
    : COMPANY_CATEGORIES;

  // A budget belongs to one book and one month — a target spanning an arbitrary
  // custom period is not a budget. An admin looking at "all books" sets the
  // platform's, which is the only book that is Tawaf's to plan.
  const budgetScope = role === "agency" ? defaultCompanyId
    : bookFilter === "platform" || bookFilter === "all" ? null
    : bookFilter;
  const budgetCategories = budgetScope === null ? PLATFORM_CATEGORIES : COMPANY_CATEGORIES;
  const budgetRows = scopeBudgets.filter(
    (budget) => budget.month.slice(0, 7) === budgetMonth.slice(0, 7) &&
      (budget.company_id ?? null) === (budgetScope ?? null),
  );
  // Measured against the same book the budget belongs to, so a platform target
  // is never compared with an agency's spend.
  const spentThisMonth = new Map<string, number>();
  expenses
    .filter((expense) => expense.status === "confirmed" &&
      expense.spent_at.slice(0, 7) === budgetMonth.slice(0, 7) &&
      (expense.company_id ?? null) === (budgetScope ?? null))
    .forEach((expense) => spentThisMonth.set(expense.category, (spentThisMonth.get(expense.category) ?? 0) + Number(expense.amount_iqd)));

  async function saveBudget(category: string, value: string) {
    const amount = Math.floor(Number(value));
    if (!Number.isFinite(amount) || amount < 0) return;
    await runAction(
      `budget-${category}`,
      () => getSupabase().rpc("set_budget", {
        p_company_id: budgetScope,
        p_category: category,
        p_month: budgetMonth,
        p_amount_iqd: amount,
      }),
      copy.budgetSaved,
    );
  }

  return (
    <>
      <ChartFrame
        title={copy.chartCategoryTitle}
        subtitle={copy.chartCategorySub}
        copy={copy}
        empty={!breakdown.length}
        table={
          <div className="portal-table-wrap">
            <table className="portal-table finance-table">
              <thead><tr><th>{copy.category}</th><th className="finance-num">{copy.spent}</th><th className="finance-num">{copy.budgetLabel}</th></tr></thead>
              <tbody>
                {breakdown.map((item) => (
                  <tr key={item.key}>
                    <td>{item.label}</td>
                    <td className="finance-num" dir="ltr">{formatIqd(item.value)}</td>
                    <td className="finance-num" dir="ltr">{item.budget ? formatIqd(item.budget) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      >
        <BarChart
          data={breakdown.map((item) => ({ key: item.key, label: item.label, value: item.value, secondary: item.budget }))}
          secondaryLabel={copy.budgetLabel}
        />
      </ChartFrame>

      <Panel
        title={copy.expensesTitle}
        subtitle={role === "admin" ? copy.expensesAdminSub : copy.expensesCompanySub}
        action={
          <button type="button" className="portal-primary-button finance-pay" onClick={() => setCreating(true)}>
            <Plus size={14} /> {copy.addExpense}
          </button>
        }
      >
        <div className="finance-filters">
          <label className="finance-search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} dir="auto" />
          </label>
          {role === "admin" && (
            <label>
              <small>{copy.book}</small>
              <select value={bookFilter} onChange={(event) => setBookFilter(event.target.value)}>
                <option value="all">{copy.allBooks}</option>
                <option value="platform">{copy.platformBook}</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
          )}
          <label>
            <small>{copy.category}</small>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">{copy.allCategories}</option>
              {categories.map((item) => <option key={item} value={item}>{categoryLabel(item, copy)}</option>)}
            </select>
          </label>
          <label className="finance-check">
            <input type="checkbox" checked={showVoided} onChange={(event) => setShowVoided(event.target.checked)} />
            <small>{copy.showVoided}</small>
          </label>
          <span className="finance-filter-total" dir="ltr">{formatIqd(total)}</span>
        </div>

        {rows.length ? (
          <div className="portal-table-wrap">
            <table className="portal-table finance-table">
              <thead>
                <tr>
                  <th>{copy.date}</th>
                  {role === "admin" && <th>{copy.book}</th>}
                  <th>{copy.category}</th>
                  <th>{copy.trip}</th>
                  <th>{copy.vendor}</th>
                  <th>{copy.reference}</th>
                  <th className="finance-num">{copy.amount}</th>
                  <th>{copy.status}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((expense) => (
                  <tr key={expense.id} className={expense.status === "void" ? "finance-row-void" : ""}>
                    <td><span dir="ltr">{formatDate(expense.spent_at)}</span></td>
                    {role === "admin" && (
                      <td>
                        <b>{expense.company_id ? companyNames.get(expense.company_id) ?? "—" : copy.platformBook}</b>
                      </td>
                    )}
                    <td><span className="finance-entry-tag">{categoryLabel(expense.category, copy)}</span></td>
                    <td className="finance-trip">{expense.package_id ? tripTitles.get(expense.package_id) ?? "—" : "—"}</td>
                    <td>{expense.vendor ?? "—"}</td>
                    <td><span className="finance-mono" dir="ltr">{expense.reference ?? "—"}</span></td>
                    <td className="finance-num finance-amount debit" dir="ltr">
                      {formatIqd(expense.amount_iqd)}
                      {expense.currency !== "IQD" && expense.amount_original ? (
                        <small dir="ltr">{expense.amount_original} {expense.currency}</small>
                      ) : null}
                    </td>
                    <td>
                      <span className={`portal-status ${expense.status === "void" ? "warning" : "positive"}`}>
                        <i />{expense.status === "void" ? copy.voided : copy.confirmed}
                      </span>
                    </td>
                    <td className="finance-action">
                      {expense.status === "confirmed" && (
                        <>
                          <button type="button" className="finance-icon-button" onClick={() => setEditing(expense)} aria-label={copy.editExpense}>
                            <Pencil size={13} />
                          </button>
                          <button type="button" className="finance-icon-button danger" onClick={() => setVoiding(expense)} aria-label={copy.voidExpense}>
                            <Undo2 size={13} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={ReceiptText} text={expenses.length ? copy.noMatch : copy.noExpenses} />}
      </Panel>

      <Panel
        title={copy.budgets}
        subtitle={copy.budgetsSub.replace("{month}", formatMonthLabel(budgetMonth.slice(0, 7)))}
        action={<span className="finance-quiet"><Target size={13} /> {copy.setBudget}</span>}
      >
        <div className="finance-budget-grid">
          {budgetCategories.map((item) => {
            const budget = budgetRows.find((row) => row.category === item);
            const spent = spentThisMonth.get(item) ?? 0;
            const target = Number(budget?.amount_iqd ?? 0);
            const over = target > 0 && spent > target;
            return (
              <div className={`finance-budget-cell ${over ? "over" : ""}`} key={`${item}-${target}`}>
                <b>{categoryLabel(item, copy)}</b>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  dir="ltr"
                  defaultValue={target || ""}
                  placeholder="0"
                  onBlur={(event) => {
                    if (Number(event.target.value || 0) !== target) saveBudget(item, event.target.value || "0");
                  }}
                />
                <small dir="ltr">
                  {formatIqd(spent, true)} {copy.spent}
                  {target > 0 && ` · ${over ? copy.overBudget : `${formatIqd(target - spent, true)} ${copy.remaining}`}`}
                </small>
              </div>
            );
          })}
        </div>
      </Panel>

      {(creating || editing) && (
        <ExpenseModal
          role={role}
          companies={companies}
          trips={trips}
          expense={editing}
          defaultCompanyId={defaultCompanyId}
          busy={busy}
          runAction={runAction}
          copy={copy}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
      {voiding && (
        <VoidExpenseModal expense={voiding} busy={busy} runAction={runAction} copy={copy} onClose={() => setVoiding(null)} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Company ledger — server paged
 * ------------------------------------------------------------------ */

const LEDGER_PAGE_SIZE = 50;

// The rest of the workspace reads the ledger the shell already loaded. This tab
// does not: a ledger is the one thing on the page that grows without bound, and
// an agency two seasons in should not download all of it to look at last week.
// Filters are pushed down to PostgREST, ordered newest first on the index that
// already exists (company_id, created_at DESC).
function CompanyLedgerTab({ companyId, bookings, trips, period, copy, onOpenBooking }: {
  companyId: string;
  bookings: FinanceBooking[];
  trips: FinanceTrip[];
  period: Period;
  copy: Copy;
  onOpenBooking: (booking: FinanceBooking) => void;
}) {
  const [entryType, setEntryType] = useState("all");
  const [tripFilter, setTripFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [refQuery, setRefQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const bookingById = useMemo(() => new Map(bookings.map((item) => [item.id, item])), [bookings]);
  const tripTitles = useMemo(() => new Map(trips.map((trip) => [trip.id, trip.title])), [trips]);

  // Trip, payment method and booking reference are all properties of the
  // BOOKING, not of the ledger row, so they are resolved to a set of booking ids
  // here and pushed down as one `in` filter rather than fetched and sifted.
  const bookingScope = useMemo(() => {
    const query = refQuery.trim().toLowerCase();
    if (tripFilter === "all" && methodFilter === "all" && !query) return null;
    return bookings
      .filter((booking) =>
        (tripFilter === "all" || booking.package_id === tripFilter) &&
        (methodFilter === "all" || booking.pay_method === methodFilter) &&
        (!query || booking.id.toLowerCase().includes(query)))
      .map((booking) => booking.id);
  }, [bookings, tripFilter, methodFilter, refQuery]);

  const scopeKey = bookingScope ? bookingScope.join(",") : "";

  // Any filter change puts the reader back on the first page; leaving them on
  // page 4 of a result set that no longer has four pages shows an empty table.
  useEffect(() => { setPage(0); }, [entryType, scopeKey, period.from, period.to]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFailure("");
      let query = getSupabase()
        .from("agency_ledger")
        .select("*")
        .eq("company_id", companyId)
        .gte("created_at", startInstant(period.from))
        .lte("created_at", endInstant(period.to))
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        // One row beyond the page, which is how the Next button knows whether
        // there is anything to go to without a second count query.
        .range(page * LEDGER_PAGE_SIZE, page * LEDGER_PAGE_SIZE + LEDGER_PAGE_SIZE);
      if (entryType !== "all") query = query.eq("entry_type", entryType);
      if (bookingScope) {
        // An empty scope means the filters matched no booking at all — which
        // must return nothing, not everything.
        query = query.in("booking_id", bookingScope.length ? bookingScope : ["00000000-0000-0000-0000-000000000000"]);
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        setFailure(error.message);
        setRows([]);
        setHasMore(false);
      } else {
        const list = (data ?? []) as LedgerRow[];
        setHasMore(list.length > LEDGER_PAGE_SIZE);
        setRows(list.slice(0, LEDGER_PAGE_SIZE));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [companyId, period.from, period.to, entryType, scopeKey, page]);

  return (
    <Panel
      title={copy.ledger}
      subtitle={`${copy.ledgerSub} · ${copy.newest}`}
      action={<span className="finance-quiet">{copy.page.replace("{n}", String(page + 1))}</span>}
    >
      <div className="finance-filters">
        <label className="finance-search">
          <Search size={15} />
          <input value={refQuery} onChange={(event) => setRefQuery(event.target.value)}
            placeholder={copy.searchRef} dir="ltr" />
        </label>
        <label>
          <small>{copy.entryTypeFilter}</small>
          <select value={entryType} onChange={(event) => setEntryType(event.target.value)}>
            <option value="all">{copy.allEntryTypes}</option>
            {Object.keys(LEDGER_BUCKET).map((type) => (
              <option key={type} value={type}>{entryLabel(type, copy)}</option>
            ))}
          </select>
        </label>
        <label>
          <small>{copy.trip}</small>
          <select value={tripFilter} onChange={(event) => setTripFilter(event.target.value)}>
            <option value="all">{copy.allTrips}</option>
            {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}</option>)}
          </select>
        </label>
        <label>
          <small>{copy.method}</small>
          <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}>
            <option value="all">{copy.allMethods}</option>
            <option value="cash">{copy.cash}</option>
            <option value="fib">{copy.fib}</option>
            <option value="card">{methodLabel("card", copy)}</option>
          </select>
        </label>
      </div>

      {failure && <div className="portal-alert error"><span>{failure}</span></div>}

      {loading ? (
        <div className="finance-loading"><TawafLoadingSpinner size={20} /><span>{copy.loading}</span></div>
      ) : rows.length ? (
        <>
          <div className="portal-table-wrap">
            <table className="portal-table finance-table">
              <thead>
                <tr>
                  <th>{copy.date}</th>
                  <th>{copy.entry}</th>
                  <th>{copy.bookingRef}</th>
                  <th>{copy.note}</th>
                  <th className="finance-num">{copy.amount}</th>
                  <th className="finance-num">{copy.runningBalance}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const amount = Number(entry.amount_iqd);
                  const bucket = bucketOfEntry(entry.entry_type);
                  const booking = entry.booking_id ? bookingById.get(entry.booking_id) : undefined;
                  const running = bucket === "cash" ? entry.cash_balance_after
                    : bucket === "earnings" ? entry.balance_after
                    : null;
                  return (
                    <tr
                      key={entry.id}
                      className={booking ? "finance-row-clickable" : ""}
                      onClick={booking ? () => onOpenBooking(booking) : undefined}
                    >
                      <td><span dir="ltr">{formatDate(entry.created_at)}</span></td>
                      <td><span className="finance-entry-tag">{entryLabel(entry.entry_type, copy)}</span></td>
                      <td>
                        <span className="finance-mono" dir="ltr">{shortId(entry.booking_id)}</span>
                        {booking ? <small>{tripTitles.get(booking.package_id) ?? ""}</small> : null}
                      </td>
                      <td className="finance-trip">{entry.description ?? "—"}</td>
                      <td className={`finance-num finance-amount ${amount >= 0 ? "credit" : "debit"}`} dir="ltr">
                        {amount >= 0 ? "+" : "−"}{formatIqd(Math.abs(amount))}
                      </td>
                      {/* A hold moves neither total — it reserves. Showing a
                          balance beside it would imply money left the account. */}
                      <td className="finance-num" dir="ltr">
                        {running === null || running === undefined ? "—" : formatIqd(running)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="finance-pager">
            <button type="button" className="finance-sort" disabled={page === 0} onClick={() => setPage(page - 1)}>
              {copy.previous}
            </button>
            <span>{copy.page.replace("{n}", String(page + 1))}</span>
            <button type="button" className="finance-sort" disabled={!hasMore} onClick={() => setPage(page + 1)}>
              {copy.next}
            </button>
          </div>
        </>
      ) : <Empty icon={ScrollText} text={copy.noMatch} />}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Booking earnings drill-down
 * ------------------------------------------------------------------ */

// Every figure here is read from a snapshot column on the booking itself.
// Nothing is recomputed from the commission config, because that config is
// current and the booking is history: a rate edited last week would otherwise
// rewrite what every earlier booking appears to have earned.
function BookingEarningsModal({ booking, tripTitle, copy, onClose }: {
  booking: FinanceBooking;
  tripTitle: string;
  copy: Copy;
  onClose: () => void;
}) {
  useScrollLock();
  const gross = Number(booking.total_iqd);
  const commission = Number(booking.commission_iqd ?? 0);
  const net = Number(booking.payout_iqd ?? gross - commission);
  const isCash = booking.pay_method === "cash";

  const collector = !isCash ? copy.collectedOnline
    : booking.cash_payment_location_type === "tawaf_authorized" ? copy.atTawafOffice
    : booking.cash_payment_location_type === "company_office" ? copy.atCompanyOffice
    : "—";

  return (
    <div className="portal-modal-backdrop" onClick={onClose}>
      <div className="portal-modal finance-modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p>{copy.earningsTitle}</p>
            <h2>{tripTitle}</h2>
            <span dir="ltr">#{shortId(booking.id)} · {formatDate(booking.created_at)}</span>
          </div>
          <button type="button" onClick={onClose} aria-label={copy.cancel}><X size={16} /></button>
        </header>

        <div className="finance-earnings-grid">
          <div><small>{copy.gross}</small><b dir="ltr">{formatIqd(gross)}</b></div>
          <div><small>{copy.seats}</small><b dir="ltr">{booking.travellers ?? "—"}</b></div>
          <div><small>{copy.commission}</small><b dir="ltr">{formatPercent(booking.commission_rate)}</b></div>
          <div>
            <small>{copy.tierApplied}</small>
            <b>{booking.commission_tier ?? <em className="finance-unknown">{copy.tierUnknown}</em>}</b>
          </div>
          <div><small>{copy.commission}</small><b className="finance-amount debit" dir="ltr">{formatIqd(commission)}</b></div>
          <div><small>{copy.net}</small><b className="finance-amount credit" dir="ltr">{formatIqd(net)}</b></div>
          <div><small>{copy.method}</small><b>{methodLabel(booking.pay_method, copy)}</b></div>
          <div><small>{copy.collectedBy}</small><b>{collector}</b></div>
          {booking.cash_payment_location_name && (
            <div className="full"><small>{copy.collectedBy}</small><b>{booking.cash_payment_location_name}</b></div>
          )}
          {booking.payment_receipt_number && (
            <div><small>{copy.receiptNumber}</small><b className="finance-mono" dir="ltr">{booking.payment_receipt_number}</b></div>
          )}
          {booking.payment_confirmed_at && (
            <div><small>{copy.confirmedAt}</small><b dir="ltr">{formatDate(booking.payment_confirmed_at)}</b></div>
          )}
        </div>

        <p className="finance-modal-note"><ShieldCheck size={14} /> {copy.earningsSub}</p>

        <footer>
          <button type="button" className="portal-secondary-button" onClick={onClose}>{copy.cancel}</button>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Payout request
 * ------------------------------------------------------------------ */

function payoutStateLabel(state: PayoutState, copy: Copy) {
  if (state === "requested") return copy.stateRequested;
  if (state === "approved") return copy.stateApproved;
  if (state === "paid") return copy.statePaid;
  return copy.stateRejected;
}

function PayoutStateBadge({ state, copy }: { state: PayoutState; copy: Copy }) {
  const tone = state === "paid" ? "positive" : state === "rejected" ? "warning" : "neutral";
  return <span className={`portal-status ${tone}`}><i />{payoutStateLabel(state, copy)}</span>;
}

// Every rule enforced here is enforced again by validate_payout_request() in the
// database. This form exists to spare the agency a round trip, not to be the
// thing standing between them and the money.
function PayoutRequestModal({ companyId, available, minimum, busy, runAction, copy, onClose }: {
  companyId: string;
  available: number;
  minimum: number;
  busy: string;
  runAction: RunAction;
  copy: Copy;
  onClose: () => void;
}) {
  useScrollLock();
  const [amount, setAmount] = useState(String(available));
  const [method, setMethod] = useState<SettlementMethod>("bank_transfer");
  const parsed = Math.floor(Number(amount));
  const valid = Number.isFinite(parsed) && parsed >= minimum && parsed <= available;
  const busyKey = `payout-request-${companyId}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    const result = await runAction(
      busyKey,
      // A plain insert, not an RPC: the security model gives the agency insert
      // on its own payouts and nothing more. The status is fixed by the policy
      // and every other rule by the trigger.
      () => getSupabase().from("payouts").insert({
        company_id: companyId,
        amount_iqd: parsed,
        method,
        status: "requested",
      }),
      copy.requestSent,
    );
    if (result) onClose();
  }

  return (
    <div className="portal-modal-backdrop" onClick={onClose}>
      <form className="portal-modal finance-modal narrow" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <header>
          <div>
            <p>{copy.requestTitle}</p>
            <h2>{copy.requestPayout}</h2>
            <span dir="ltr">{copy.maximumIs.replace("{amount}", formatIqd(available))}</span>
          </div>
          <button type="button" onClick={onClose} aria-label={copy.cancel}><X size={16} /></button>
        </header>

        <div className="portal-form-grid">
          <label className="full">
            <span>{copy.amountLabel}</span>
            <input type="number" inputMode="numeric" dir="ltr" min={minimum} max={available} step={1}
              value={amount} onChange={(event) => setAmount(event.target.value)} required />
            <button type="button" className="finance-inline-link" onClick={() => setAmount(String(available))}>
              {copy.fullBalance} · <span dir="ltr">{formatIqd(available)}</span>
            </button>
          </label>

          <label className="full">
            <span>{copy.method}</span>
            <select value={method} onChange={(event) => setMethod(event.target.value as SettlementMethod)}>
              <option value="bank_transfer">{copy.bankTransfer}</option>
              <option value="cash">{copy.cash}</option>
              <option value="fib">{copy.fib}</option>
            </select>
          </label>

          <p className="finance-modal-note full">
            <ShieldCheck size={14} /> {copy.minimumIs.replace("{amount}", formatIqd(minimum))} · {copy.requestSub}
          </p>
        </div>

        <footer>
          <button type="button" className="portal-secondary-button" onClick={onClose}>{copy.cancel}</button>
          <button type="submit" className="portal-primary-button" disabled={!valid || busy === busyKey}>
            {busy === busyKey ? <TawafLoadingSpinner size={15} /> : <HandCoins size={15} />}
            {copy.requestPayout}
          </button>
        </footer>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Workspace
 * ------------------------------------------------------------------ */

export default function FinanceWorkspace({
  role,
  companies,
  trips,
  bookings,
  commissions,
  payments,
  ledger,
  payouts,
  expenses,
  budgets,
  receipts,
  auditLogs,
  commercialSettings,
  companyId,
  busy,
  runAction,
  locale,
}: {
  role: Role;
  companies: FinanceCompany[];
  trips: FinanceTrip[];
  bookings: FinanceBooking[];
  commissions: FinanceCommission[];
  payments: FinancePayment[];
  ledger: LedgerRow[];
  payouts: PayoutRow[];
  expenses: ExpenseRow[];
  budgets: BudgetRow[];
  receipts: ReceiptRow[];
  auditLogs: FinanceAuditRow[];
  commercialSettings: CommercialSetting[];
  companyId?: string | null;
  busy: string;
  runAction: RunAction;
  locale: Locale;
}) {
  const copy = useCopy(locale);

  const [tab, setTab] = useState("overview");
  const [preset, setPreset] = useState<PresetId>("year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [companyFilter, setCompanyFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"balance" | "name" | "pending" | "age">("balance");
  const [settleTarget, setSettleTarget] = useState<CompanyBalance | null>(null);
  const [statementCompany, setStatementCompany] = useState("");
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [drillBooking, setDrillBooking] = useState<FinanceBooking | null>(null);
  // Read from payout_minimum_iqd() rather than hard-coded here: the form must
  // not be able to disagree with the trigger about where the floor is.
  const [payoutMinimum, setPayoutMinimum] = useState(0);

  useEffect(() => {
    if (role !== "agency") return;
    let cancelled = false;
    (async () => {
      const { data } = await getSupabase().rpc("payout_minimum_iqd");
      if (!cancelled && typeof data === "number") setPayoutMinimum(data);
    })();
    return () => { cancelled = true; };
  }, [role]);

  // "All time" has to start somewhere real, so it starts at the oldest thing on
  // record rather than at an arbitrary epoch that would stretch every chart.
  const earliest = useMemo(() => {
    const days = [
      ...bookings.map((booking) => dayKeyOf(booking.created_at)),
      ...ledger.map((entry) => dayKeyOf(entry.created_at)),
      ...expenses.map((expense) => expense.spent_at),
    ].filter(Boolean);
    return days.length ? days.reduce((min, day) => (day < min ? day : min)) : todayKey();
  }, [bookings, ledger, expenses]);

  const period = useMemo(
    () => resolvePeriod(preset, customFrom, customTo, earliest),
    [preset, customFrom, customTo, earliest],
  );

  const bookingMap = useMemo(() => new Map(bookings.map((item) => [item.id, item])), [bookings]);
  const payoutMap = useMemo(() => new Map(payouts.map((item) => [item.id, item])), [payouts]);
  const tripMap = useMemo(() => new Map(trips.map((item) => [item.id, item.title])), [trips]);
  const companyMap = useMemo(() => new Map(companies.map((item) => [item.id, item.name])), [companies]);
  const rateMap = useMemo(
    () => new Map(commercialSettings.map((item) => [item.agency_id, item.commission_rate])),
    [commercialSettings],
  );
  const settlements = useMemo(() => settlementByEntry(ledger), [ledger]);

  // Refunds live on payments, not on the ledger, so they are folded onto the
  // booking they belong to before the ledger table reads them.
  const refundByBooking = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach((payment) => {
      const refunded = Number(payment.refunded_iqd ?? 0);
      if (refunded) map.set(payment.booking_id, (map.get(payment.booking_id) ?? 0) + refunded);
    });
    return map;
  }, [payments]);

  const balances = useMemo(
    () => buildBalances(companies, ledger, payouts, bookings, settlements, rateMap),
    [companies, ledger, payouts, bookings, settlements, rateMap],
  );

  const inScope = (id: string | null | undefined) =>
    companyFilter === "all" || (id ?? "") === companyFilter;

  // The one place the period and company filters are applied. Every total,
  // chart and delta below reads this, so they cannot drift apart.
  const source: Source = useMemo(() => ({
    bookings: bookings.filter((booking) => inScope(booking.company_id)),
    payments: payments.filter((payment) => inScope(payment.company_id)),
    commissions: commissions.filter((item) => inScope(item.company_id)),
    payouts: payouts.filter((payout) => inScope(payout.company_id)),
    expenses: expenses.filter((expense) => (role === "agency"
      ? true
      : companyFilter === "all" ? true : expense.company_id === companyFilter)),
  }), [bookings, payments, commissions, payouts, expenses, companyFilter, role]);

  const totals = useMemo(() => totalsFor(source, period.from, period.to), [source, period]);
  const previous = useMemo(
    () => (period.prevFrom ? totalsFor(source, period.prevFrom, period.prevTo) : EMPTY_TOTALS),
    [source, period],
  );

  const platformExpenses = useMemo(
    () => expenses.filter((expense) => expense.company_id === null),
    [expenses],
  );

  const buckets = useMemo(() => buildBuckets(period.from, period.to), [period]);
  // Tawaf's P&L is Tawaf's book. An agency's hotel bill is that agency's cost,
  // never Tawaf's, so the admin chart reads the platform book even when the
  // company filter narrows the revenue side — the Expenses tab is where the
  // agencies' own costs are looked at.
  const chartSource = useMemo(
    () => (role === "admin" ? { ...source, expenses: platformExpenses } : source),
    [role, source, platformExpenses],
  );
  const trendPoints = useMemo(
    () => buildSeries(chartSource, buckets, role === "admin" ? ["commission", "expenses"] : ["netEarned", "expenses"]),
    [chartSource, buckets, role],
  );
  const cashPoints = useMemo(() => buildSeries(source, buckets, ["collected", "paidOut"]), [source, buckets]);

  const owedToCompanies = balances.reduce((sum, row) => sum + Math.max(0, row.balance), 0);
  const owedToTawaf = balances.reduce((sum, row) => sum + Math.max(0, -row.balance), 0);
  // Tawaf's own P&L uses ONLY the platform book: an agency's hotel bill is its
  // cost, not Tawaf's, and adding the two together would be meaningless.
  const platformSpend = useMemo(
    () => platformExpenses
      .filter((expense) => expense.status === "confirmed" && inRange(expense.spent_at, period.from, period.to))
      .reduce((sum, expense) => sum + Number(expense.amount_iqd), 0),
    [platformExpenses, period],
  );
  const platformSpendPrevious = useMemo(
    () => (period.prevFrom
      ? platformExpenses
        .filter((expense) => expense.status === "confirmed" && inRange(expense.spent_at, period.prevFrom, period.prevTo))
        .reduce((sum, expense) => sum + Number(expense.amount_iqd), 0)
      : 0),
    [platformExpenses, period],
  );

  const netProfit = totals.commissionCollected - platformSpend;
  const netProfitPrevious = previous.commissionCollected - platformSpendPrevious;

  const tripPnl = useMemo(
    () => buildTripPnl(trips, source.bookings, source.expenses, period.from, period.to),
    [trips, source, period],
  );

  const aging = useMemo(() => {
    const buckets: Array<{ key: string; label: string; value: number }> = [
      { key: "0-30", label: "0–30d", value: 0 },
      { key: "31-60", label: "31–60d", value: 0 },
      { key: "60+", label: "60d+", value: 0 },
    ];
    balances.forEach((row) => {
      if (!row.balance) return;
      const days = row.oldestUnsettledDays;
      const index = days <= 30 ? 0 : days <= 60 ? 1 : 2;
      buckets[index].value += Math.abs(row.balance);
    });
    return buckets;
  }, [balances]);

  // Everything that feeds the ledger table, the totals and the export comes
  // from this one filtered list, so the three can never disagree.
  const lines = useMemo<LedgerLine[]>(() => ledger
    .filter((entry) => {
      if (!inScope(entry.company_id)) return false;
      const day = dayKeyOf(entry.created_at);
      if (!inRange(day, period.from, period.to)) return false;
      if (statusFilter !== "all" && (settlements.get(entry.id)?.status ?? "pending") !== statusFilter) return false;
      if (methodFilter !== "all" && entryMethod(entry, bookingMap, payoutMap) !== methodFilter) return false;
      if (query.trim()) {
        const booking = entry.booking_id ? bookingMap.get(entry.booking_id) : undefined;
        const haystack = [
          entry.description,
          entry.booking_id,
          companyMap.get(entry.company_id),
          booking ? tripMap.get(booking.package_id) : null,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(query.trim().toLowerCase())) return false;
      }
      return true;
    })
    .map((entry) => {
      const booking = entry.booking_id ? bookingMap.get(entry.booking_id) : undefined;
      return {
        entry,
        booking,
        tripTitle: booking ? tripMap.get(booking.package_id) ?? null : null,
        companyName: companyMap.get(entry.company_id) ?? "—",
        method: entryMethod(entry, bookingMap, payoutMap),
        settlement: settlements.get(entry.id) ?? { status: "pending" as SettlementStatus, covered: 0 },
        refunded: entry.booking_id ? refundByBooking.get(entry.booking_id) ?? 0 : 0,
      };
    }), [ledger, companyFilter, methodFilter, statusFilter, period, query, settlements, bookingMap, payoutMap, tripMap, companyMap, refundByBooking]);

  const sortedBalances = useMemo(() => {
    const rows = [...balances];
    if (sortBy === "name") return rows.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "pending") return rows.sort((a, b) => b.pendingBookings - a.pendingBookings);
    if (sortBy === "age") return rows.sort((a, b) => b.oldestUnsettledDays - a.oldestUnsettledDays);
    // Default: whoever is owed the most sits at the top, which is the whole
    // reason an operator opens this page.
    return rows.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [balances, sortBy]);

  const filtersActive = companyFilter !== "all" || methodFilter !== "all" || statusFilter !== "all" || Boolean(query.trim());

  function clearFilters() {
    setCompanyFilter("all");
    setMethodFilter("all");
    setStatusFilter("all");
    setQuery("");
  }

  function downloadCsv(name: string, header: string[], rows: Array<Array<string | number>>) {
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const link = document.createElement("a");
    // The BOM keeps Excel from mangling the Arabic and Kurdish columns.
    link.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    link.download = `${name}-${todayKey()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportCsv() {
    if (tab === "expenses") {
      downloadCsv(
        "tawaf-expenses",
        ["Expense ID", "Date", "Book", "Trip", "Category", "Vendor", "Reference", "Amount IQD", "Currency", "Original", "Rate", "Status", "Note"],
        expenses
          .filter((expense) => inRange(expense.spent_at, period.from, period.to))
          .map((expense) => [
            expense.id, expense.spent_at,
            expense.company_id ? companyMap.get(expense.company_id) ?? expense.company_id : "Tawaf platform",
            expense.package_id ? tripMap.get(expense.package_id) ?? "" : "",
            expense.category, expense.vendor ?? "", expense.reference ?? "",
            expense.amount_iqd, expense.currency, expense.amount_original ?? "", expense.fx_rate ?? "",
            expense.status, expense.note ?? "",
          ]),
      );
      return;
    }
    if (tab === "receivables") {
      downloadCsv(
        "tawaf-receivables",
        ["Booking", "Trip", "Travellers", "Total IQD", "Paid IQD", "Due IQD", "Refunded IQD", "Method", "Booked on", "Days outstanding", "Departure", "Departed unpaid"],
        receivables.map((row) => [
          row.bookingId, row.tripTitle, row.travellers, row.total, row.paid, row.due,
          row.refunded, row.method, row.createdDay, row.daysOutstanding,
          row.departure ?? "", row.departed ? "yes" : "no",
        ]),
      );
      return;
    }
    if (tab === "trips") {
      downloadCsv(
        "tawaf-trip-pnl",
        ["Trip", "Departure", "Bookings", "Gross IQD", "Collected IQD", "Commission IQD", "Expenses IQD", "Net IQD", "Margin"],
        tripPnl.map((trip) => [
          trip.title, trip.departure ?? "", trip.seats, trip.gross, trip.collected,
          trip.commission, trip.expenses, trip.net, `${(trip.margin * 100).toFixed(1)}%`,
        ]),
      );
      return;
    }
    downloadCsv(
      "tawaf-ledger",
      ["Entry ID", "Date", "Company", "Booking", "Trip", "Entry type", "Gross IQD", "Commission rate",
        "Commission IQD", "Net to company IQD", "Refunded IQD", "Ledger amount IQD", "Method", "Settlement", "Settled IQD", "Description"],
      lines.map(({ entry, booking, tripTitle, companyName, method, settlement, refunded }) => [
        entry.id, entry.created_at, companyName, entry.booking_id ?? "", tripTitle ?? "", entry.entry_type,
        booking?.total_iqd ?? "", booking ? formatPercent(booking.commission_rate) : "",
        booking?.commission_iqd ?? "", booking?.payout_iqd ?? "", refunded,
        entry.amount_iqd, method ?? "", settlement.status, settlement.covered, entry.description ?? "",
      ]),
    );
  }

  const exportActions = (
    <div className="finance-export">
      <button type="button" className="portal-secondary-button" onClick={exportCsv}>
        <FileText size={15} /> {copy.exportCsv}
      </button>
      <button type="button" className="portal-secondary-button" onClick={() => window.print()}>
        <Printer size={15} /> {copy.print}
      </button>
    </div>
  );

  const ledgerFilterBar = (
    <div className="finance-filters">
      <label className="finance-search">
        <Search size={15} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} dir="auto" />
      </label>
      {role === "admin" && (
        <label>
          <small>{copy.company}</small>
          <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}>
            <option value="all">{copy.allCompanies}</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </label>
      )}
      <label>
        <small>{copy.method}</small>
        <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}>
          <option value="all">{copy.allMethods}</option>
          <option value="cash">{copy.cash}</option>
          <option value="bank_transfer">{copy.bankTransfer}</option>
          <option value="fib">{copy.fib}</option>
          <option value="card">{methodLabel("card", copy)}</option>
        </select>
      </label>
      <label>
        <small>{copy.status}</small>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">{copy.allStatuses}</option>
          <option value="pending">{copy.pending}</option>
          <option value="partial">{copy.partial}</option>
          <option value="settled">{copy.settled}</option>
        </select>
      </label>
      {filtersActive && (
        <button type="button" className="finance-clear" onClick={clearFilters}>
          <X size={13} /> {copy.clearFilters}
        </button>
      )}
    </div>
  );

  const trendSeries: ChartSeries[] = [
    {
      key: "primary",
      label: role === "admin" ? copy.seriesCommission : copy.seriesEarned,
      color: SERIES[0],
      values: trendPoints.map((point) => point.values[0]),
    },
    { key: "expenses", label: copy.seriesExpenses, color: SERIES[1], values: trendPoints.map((point) => point.values[1]) },
  ];
  const cashSeries: ChartSeries[] = [
    { key: "collected", label: copy.seriesCollected, color: SERIES[0], values: cashPoints.map((point) => point.values[0]) },
    { key: "paidOut", label: copy.seriesPaidOut, color: SERIES[2], values: cashPoints.map((point) => point.values[1]) },
  ];

  const seriesTable = (series: ChartSeries[]) => (
    <div className="portal-table-wrap">
      <table className="portal-table finance-table">
        <thead>
          <tr><th>{copy.date}</th>{series.map((item) => <th key={item.key} className="finance-num">{item.label}</th>)}</tr>
        </thead>
        <tbody>
          {buckets.keys.map((key, index) => (
            <tr key={key}>
              <td><span dir="ltr">{buckets.label(key)}</span></td>
              {series.map((item) => (
                <td key={item.key} className="finance-num" dir="ltr">{formatIqd(item.values[index])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const periodPicker = (
    <PeriodPicker
      period={period}
      preset={preset}
      customFrom={customFrom}
      customTo={customTo}
      onPreset={(value) => {
        setPreset(value);
        if (value === "custom" && !customFrom) { setCustomFrom(startOfMonth(todayKey())); setCustomTo(todayKey()); }
      }}
      onCustom={(from, to) => { setCustomFrom(from); setCustomTo(to); }}
      copy={copy}
    />
  );

  // Split by ledger_balance_bucket, exactly as agency_earnings_balance() and
  // agency_cash_owed() do server-side. Netting the two would let cash the
  // agency is holding disguise itself as earnings it can withdraw.
  const bookBalances = useMemo(() => {
    let earnings = 0;
    let cash = 0;
    let lifetime = 0;
    ledger.forEach((entry) => {
      const amount = Number(entry.amount_iqd);
      const bucket = bucketOfEntry(entry.entry_type);
      if (bucket === "earnings") earnings += amount;
      if (bucket === "cash") cash += amount;
      if (entry.entry_type === "booking_credit") lifetime += amount;
    });
    return { earnings, cashOwed: Math.max(0, -cash), lifetime };
  }, [ledger]);

  const inFlightPayouts = useMemo(
    () => payouts.filter((payout) => PAYOUT_IN_FLIGHT.includes(payoutState(payout.status))),
    [payouts],
  );
  const heldBalance = inFlightPayouts.reduce((sum, payout) => sum + Number(payout.amount_iqd), 0);
  const availableBalance = Math.max(0, bookBalances.earnings - heldBalance);

  const receivables = useMemo(
    () => buildReceivables(source.bookings, trips, refundByBooking),
    [source.bookings, trips, refundByBooking],
  );

  const receivableAging = useMemo(() => {
    const rows: Array<{ key: string; label: string; value: number }> = [
      { key: "0-30", label: "0–30d", value: 0 },
      { key: "31-60", label: "31–60d", value: 0 },
      { key: "60+", label: "60d+", value: 0 },
    ];
    receivables.forEach((row) => {
      const index = row.daysOutstanding <= 30 ? 0 : row.daysOutstanding <= 60 ? 1 : 2;
      rows[index].value += row.due;
    });
    return rows;
  }, [receivables]);

  // Which side of the counter the money landed on. For a company this is the
  // whole shape of its obligation: cash it holds is commission it owes, online
  // is a share Tawaf owes it — so the split decides which way settlement runs.
  const collectionSplit = useMemo(() => {
    let counter = 0;
    let tawaf = 0;
    source.payments
      .filter((payment) => payment.status === "succeeded" &&
        inRange(dayKeyOf(payment.confirmed_at ?? payment.created_at), period.from, period.to))
      .forEach((payment) => {
        if (payment.method === "cash") counter += Number(payment.amount_iqd);
        else tawaf += Number(payment.amount_iqd);
      });
    return [
      { key: "counter", label: copy.atYourCounter, value: counter },
      { key: "tawaf", label: copy.heldByTawaf, value: tawaf, tone: SERIES[3] },
    ];
  }, [source.payments, period, copy]);

  const refundRows = useMemo(
    () => source.payments
      .filter((payment) => Number(payment.refunded_iqd ?? 0) > 0)
      .sort((a, b) => (b.confirmed_at ?? b.created_at).localeCompare(a.confirmed_at ?? a.created_at)),
    [source.payments],
  );

  // A company holds exactly one book, so its statement needs no company picker —
  // but it still needs the opening balance, which is every entry BEFORE the
  // period and therefore cannot come from the date-filtered ledger table below.
  const ownStatement = useMemo(() => {
    const opening = ledger
      .filter((entry) => dayKeyOf(entry.created_at) < period.from)
      .reduce((sum, entry) => sum + Number(entry.amount_iqd), 0);
    const movement = ledger
      .filter((entry) => inRange(dayKeyOf(entry.created_at), period.from, period.to))
      .reduce((sum, entry) => sum + Number(entry.amount_iqd), 0);
    const count = ledger.filter((entry) => inRange(dayKeyOf(entry.created_at), period.from, period.to)).length;
    return { opening, closing: opening + movement, count };
  }, [ledger, period]);

  // Admin-only derivations, but they live above the company branch below
  // because a hook after a conditional return is a hook that sometimes does not
  // run — React counts them by position, not by name.
  const companyRanking = useMemo(() => {
    const totalsByCompany = new Map<string, number>();
    source.bookings
      .filter((booking) => !DEAD_STAGES.includes(booking.operational_stage) && inRange(dayKeyOf(booking.created_at), period.from, period.to))
      .forEach((booking) => {
        totalsByCompany.set(booking.company_id, (totalsByCompany.get(booking.company_id) ?? 0) + Number(booking.total_iqd));
      });
    return Array.from(totalsByCompany.entries())
      .map(([id, value]) => ({ key: id, label: companyMap.get(id) ?? shortId(id), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [source, period, companyMap]);

  const methodRanking = useMemo(() => {
    const byMethod = new Map<string, number>();
    source.payments
      .filter((payment) => payment.status === "succeeded" && inRange(dayKeyOf(payment.confirmed_at ?? payment.created_at), period.from, period.to))
      .forEach((payment) => byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + Number(payment.amount_iqd)));
    return Array.from(byMethod.entries())
      .map(([method, value]) => ({ key: method, label: methodLabel(method, copy), value }))
      .sort((a, b) => b.value - a.value);
  }, [source, period, copy]);

  // Opening balance is every entry BEFORE the period — which is why a statement
  // cannot be built from a date-filtered ledger alone.
  const statement = useMemo(() => {
    if (!statementCompany) return null;
    const rows = ledger.filter((entry) => entry.company_id === statementCompany);
    const opening = rows
      .filter((entry) => dayKeyOf(entry.created_at) < period.from)
      .reduce((sum, entry) => sum + Number(entry.amount_iqd), 0);
    const movements = rows
      .filter((entry) => inRange(dayKeyOf(entry.created_at), period.from, period.to))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const closing = opening + movements.reduce((sum, entry) => sum + Number(entry.amount_iqd), 0);
    return { opening, movements, closing, name: companyMap.get(statementCompany) ?? "" };
  }, [statementCompany, ledger, period, companyMap]);

  const financeAudit = useMemo(
    () => auditLogs.filter((row) => [
      "payout_recorded", "commission_collected", "expense_recorded", "expense_updated", "expense_voided",
    ].includes(row.action)).slice(0, 40),
    [auditLogs],
  );

  /* ---------------------------- company view --------------------------- */

  if (role === "agency") {
    const myRate = companyId ? rateMap.get(companyId) : null;
    const companyNet = totals.netEarned - totals.expenses;
    const totalDue = receivables.reduce((sum, row) => sum + row.due, 0);
    const cashEntries = ledger.filter((entry) => bucketOfEntry(entry.entry_type) === "cash");
    const collectionReceipts = receipts.filter((receipt) => receipt.kind === "collection");
    // In and out across the period, from the earnings side only — the cash a
    // company took at its own counter is a liability, not a movement on this
    // statement.
    const statementFlows = ledger.reduce((acc, entry) => {
      if (bucketOfEntry(entry.entry_type) !== "earnings") return acc;
      if (!inRange(dayKeyOf(entry.created_at), period.from, period.to)) return acc;
      const amount = Number(entry.amount_iqd);
      if (amount >= 0) acc.inflow += amount;
      else acc.outflow += Math.abs(amount);
      return acc;
    }, { inflow: 0, outflow: 0 });
    const oldestUnsettledDays = balances[0]?.oldestUnsettledDays ?? 0;
    const companyNetPrevious = previous.netEarned - previous.expenses;

    const tabs = [
      { id: "overview", label: copy.tabOverview, icon: Gauge },
      { id: "trips", label: copy.tabTrips, icon: Plane },
      { id: "receivables", label: copy.tabReceivables, icon: Clock3 },
      { id: "cash", label: copy.tabCash, icon: Landmark },
      { id: "expenses", label: copy.tabExpenses, icon: ReceiptText },
      { id: "ledger", label: copy.tabLedger, icon: ScrollText },
      { id: "payouts", label: copy.tabPayouts, icon: Banknote },
    ];

    return (
      <div className="finance-workspace">
        <Heading eyebrow={copy.eyebrow} title={copy.companyTitle} description={copy.companyDesc} action={exportActions} />
        <Tabs tabs={tabs} active={tab} onChange={setTab} />

        {/* Stock figures live above the picker; flow figures below it. The old
            layout interleaved the two in identical cards under one date
            control, so changing the period moved only half the numbers. */}
        {tab === "overview" && (
          <BalanceStrip
            title={copy.balancesNow}
            subtitle={copy.balancesNowSub}
            items={[
              {
                key: "available",
                label: copy.availableBalance,
                value: formatIqd(availableBalance, true),
                tone: "green",
                detail: inFlightPayouts.length
                  ? `${copy.heldInline.replace("{amount}", formatIqd(heldBalance, true))} · ${copy.heldDetail.replace("{count}", String(inFlightPayouts.length))}`
                  : copy.availableDetail,
              },
              {
                key: "owed",
                label: copy.owedToTawaf,
                value: formatIqd(bookBalances.cashOwed, true),
                tone: "sand",
                detail: bookBalances.cashOwed && oldestUnsettledDays
                  ? `${copy.dueToPlatformDetail} · ${copy.outstandingSince.replace("{count}", String(oldestUnsettledDays))}`
                  : copy.dueToPlatformDetail,
              },
              {
                key: "due",
                label: copy.stillDue,
                value: formatIqd(totalDue, true),
                tone: "gold",
                detail: copy.stillDueDetail.replace("{count}", String(receivables.length)),
              },
              {
                key: "lifetime",
                label: copy.lifetimeEarnings,
                value: formatIqd(bookBalances.lifetime, true),
                tone: "teal",
                detail: myRate !== null && myRate !== undefined
                  ? `${copy.lifetimeDetail} · ${copy.rateInline.replace("{rate}", formatPercent(myRate))}`
                  : copy.lifetimeDetail,
              },
            ]}
          />
        )}

        {periodPicker}

        {tab === "overview" && (
          <>
            {/* Everything here is a flow figure governed by the picker above,
                and every one of them carries its own period-on-period delta. */}
            <section className="portal-metric-grid">
              <Metric icon={Coins} label={copy.totalEarned} value={formatIqd(totals.netEarned, true)}
                detail={copy.afterCommission} tone="green" copy={copy}
                delta={{ current: totals.netEarned, previous: previous.netEarned, goodWhenUp: true }} />
              <Metric icon={ReceiptText} label={copy.companyExpenses} value={formatIqd(totals.expenses, true)}
                detail={copy.expensesCompanySub} tone="sand" copy={copy}
                delta={{ current: totals.expenses, previous: previous.expenses, goodWhenUp: false }} />
              <Metric icon={TrendingUp} label={copy.netProfit} value={formatIqd(companyNet, true)}
                detail={copy.companyNetProfit} tone="teal" copy={copy}
                delta={{ current: companyNet, previous: companyNetPrevious, goodWhenUp: true }} />
              <Metric icon={WalletCards} label={copy.totalCollected} value={formatIqd(totals.collected, true)}
                detail={copy.fromPilgrims} tone="gold" copy={copy}
                delta={{ current: totals.collected, previous: previous.collected, goodWhenUp: true }} />
            </section>

            <ChartTabs
              copy={copy}
              views={[
                {
                  id: "trend",
                  tab: copy.chartTabTrend,
                  title: copy.chartEarnTitle,
                  subtitle: copy.chartMoneySub,
                  empty: !trendPoints.some((point) => point.values.some(Boolean)),
                  table: seriesTable(trendSeries),
                  chart: <TrendChart buckets={buckets} series={trendSeries} />,
                },
                {
                  id: "split",
                  tab: copy.chartTabSplit,
                  title: copy.chartSplitTitle,
                  subtitle: copy.chartSplitSub,
                  empty: !collectionSplit.some((row) => row.value),
                  table: (
                    <div className="portal-table-wrap">
                      <table className="portal-table finance-table">
                        <thead><tr><th>{copy.method}</th><th className="finance-num">{copy.amount}</th></tr></thead>
                        <tbody>
                          {collectionSplit.map((row) => (
                            <tr key={row.key}><td>{row.label}</td><td className="finance-num" dir="ltr">{formatIqd(row.value)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ),
                  chart: <BarChart data={collectionSplit} />,
                },
                {
                  id: "trips",
                  tab: copy.chartTabTrips,
                  title: copy.chartTripTitle,
                  subtitle: copy.chartTripSub,
                  empty: !tripPnl.length,
                  table: (
                    <div className="portal-table-wrap">
                      <table className="portal-table finance-table">
                        <thead><tr><th>{copy.trip}</th><th className="finance-num">{copy.net}</th></tr></thead>
                        <tbody>
                          {tripPnl.map((trip) => (
                            <tr key={trip.tripId}><td>{trip.title}</td><td className="finance-num" dir="ltr">{formatIqd(trip.net)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ),
                  chart: (
                    <BarChart
                      signed
                      data={tripPnl.slice(0, 10).map((trip) => ({
                        key: trip.tripId,
                        label: trip.title,
                        value: trip.net,
                        tone: trip.net < 0 ? SERIES[2] : SERIES[0],
                      }))}
                    />
                  ),
                },
              ]}
            />
          </>
        )}

        {tab === "trips" && (
          <Panel title={copy.tripPnlTitle} subtitle={copy.tripPnlSub}>
            {tripPnl.length ? (
              <div className="portal-table-wrap">
                <table className="portal-table finance-table">
                  <thead>
                    <tr>
                      <th>{copy.trip}</th>
                      <th>{copy.departure}</th>
                      <th className="finance-num">{copy.seats}</th>
                      <th className="finance-num">{copy.gross}</th>
                      <th className="finance-num">{copy.commission}</th>
                      <th className="finance-num">{copy.companyExpenses}</th>
                      <th className="finance-num">{copy.net}</th>
                      <th className="finance-num">{copy.margin}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tripPnl.map((trip) => (
                      <tr key={trip.tripId}>
                        <td className="finance-trip"><b>{trip.title}</b></td>
                        <td><span dir="ltr">{trip.departure ? formatDate(trip.departure) : "—"}</span></td>
                        <td className="finance-num" dir="ltr">{trip.seats}</td>
                        <td className="finance-num" dir="ltr">{formatIqd(trip.gross)}</td>
                        <td className="finance-num" dir="ltr">{formatIqd(trip.commission)}</td>
                        <td className="finance-num" dir="ltr">{formatIqd(trip.expenses)}</td>
                        <td className={`finance-num finance-amount ${trip.net >= 0 ? "credit" : "debit"}`} dir="ltr">
                          {formatIqd(trip.net)}
                        </td>
                        <td className="finance-num" dir="ltr">{(trip.margin * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty icon={Plane} text={copy.noTrips} />}
          </Panel>
        )}

        {tab === "receivables" && (
          <>
            <ChartFrame title={copy.chartReceivableAgingTitle} subtitle={copy.chartReceivableAgingSub} copy={copy}
              empty={!receivableAging.some((bucket) => bucket.value)}
              table={
                <div className="portal-table-wrap">
                  <table className="portal-table finance-table">
                    <thead><tr><th>{copy.age}</th><th className="finance-num">{copy.dueColumn}</th></tr></thead>
                    <tbody>
                      {receivableAging.map((bucket) => (
                        <tr key={bucket.key}><td>{bucket.label}</td><td className="finance-num" dir="ltr">{formatIqd(bucket.value)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            >
              <BarChart data={receivableAging} colors={AGING_RAMP} />
            </ChartFrame>

            <Panel
              title={copy.receivablesTitle}
              subtitle={copy.receivablesSub}
              action={<span className="finance-quiet" dir="ltr">{formatIqd(totalDue)}</span>}
            >
              {receivables.length ? (
                <div className="portal-table-wrap">
                  <table className="portal-table finance-table">
                    <thead>
                      <tr>
                        <th>{copy.booking}</th>
                        <th>{copy.trip}</th>
                        <th className="finance-num">{copy.travellersColumn}</th>
                        <th className="finance-num">{copy.gross}</th>
                        <th className="finance-num">{copy.paidColumn}</th>
                        <th className="finance-num">{copy.dueColumn}</th>
                        <th>{copy.method}</th>
                        <th className="finance-num">{copy.age}</th>
                        <th>{copy.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivables.map((row) => (
                        <tr key={row.bookingId}>
                          <td><span className="finance-mono" dir="ltr">{shortId(row.bookingId)}</span></td>
                          <td className="finance-trip">{row.tripTitle}</td>
                          <td className="finance-num" dir="ltr">{row.travellers || "—"}</td>
                          <td className="finance-num" dir="ltr">{formatIqd(row.total)}</td>
                          <td className="finance-num" dir="ltr">{formatIqd(row.paid)}</td>
                          <td className="finance-num finance-amount debit" dir="ltr">{formatIqd(row.due)}</td>
                          <td>{methodLabel(row.method, copy)}</td>
                          <td className="finance-num" dir="ltr">{copy.days.replace("{count}", String(row.daysOutstanding))}</td>
                          <td>
                            {/* A trip that has already left with money still owed is
                                not merely late: the service was delivered against it. */}
                            <span className={`portal-status ${row.departed ? "warning" : "neutral"}`}>
                              <i />{row.departed ? copy.departedUnpaid : copy.pending}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Empty icon={CheckCircle2} text={copy.nothingDue} />}
            </Panel>

            <Panel title={copy.refundsTitle} subtitle={copy.refundsSub}>
              {refundRows.length ? (
                <div className="portal-table-wrap">
                  <table className="portal-table finance-table">
                    <thead>
                      <tr>
                        <th>{copy.date}</th>
                        <th>{copy.booking}</th>
                        <th>{copy.method}</th>
                        <th className="finance-num">{copy.amount}</th>
                        <th className="finance-num">{copy.refunded}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {refundRows.map((payment) => (
                        <tr key={payment.id}>
                          <td><span dir="ltr">{formatDate(payment.confirmed_at ?? payment.created_at)}</span></td>
                          <td><span className="finance-mono" dir="ltr">{shortId(payment.booking_id)}</span></td>
                          <td>{methodLabel(payment.method, copy)}</td>
                          <td className="finance-num" dir="ltr">{formatIqd(payment.amount_iqd)}</td>
                          <td className="finance-num finance-amount debit" dir="ltr">{formatIqd(payment.refunded_iqd ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Empty icon={Undo2} text={copy.noRefunds} />}
            </Panel>
          </>
        )}

        {tab === "expenses" && (
          <ExpensesTab
            role="agency"
            companies={companies}
            trips={trips}
            expenses={expenses}
            budgets={budgets}
            period={period}
            busy={busy}
            runAction={runAction}
            copy={copy}
            defaultCompanyId={companyId ?? null}
          />
        )}

        {tab === "ledger" && (
          <>
            <Panel
              title={copy.monthlyStatement}
              subtitle={copy.statementFor.replace("{period}", `${formatDate(period.from)} — ${formatDate(period.to)}`)}
              action={
                <button type="button" className="finance-sort" onClick={() => window.print()}>
                  <Printer size={13} /> {copy.print}
                </button>
              }
            >
              {/* An opening balance is every entry BEFORE the period, which the
                  date-filtered table below has by definition dropped — so it is
                  computed from the whole book, not from what is on screen. */}
              <div className="finance-statement-head">
                <div><small>{copy.openingBalance}</small><b dir="ltr">{formatIqd(ownStatement.opening)}</b></div>
                <div><small>{copy.totalIn}</small><b className="finance-amount credit" dir="ltr">{formatIqd(statementFlows.inflow)}</b></div>
                <div><small>{copy.totalOut}</small><b className="finance-amount debit" dir="ltr">{formatIqd(statementFlows.outflow)}</b></div>
                <div><small>{copy.closingBalance}</small><b dir="ltr">{formatIqd(ownStatement.closing)}</b></div>
              </div>
            </Panel>

            <CompanyLedgerTab
              companyId={companyId ?? ""}
              bookings={bookings}
              trips={trips}
              period={period}
              copy={copy}
              onOpenBooking={setDrillBooking}
            />
          </>
        )}

        {tab === "cash" && (
          <>
            <Panel
              title={copy.cashTitle}
              subtitle={copy.cashSub}
              action={<span className="finance-quiet" dir="ltr">{formatIqd(bookBalances.cashOwed)}</span>}
            >
              {cashEntries.length ? (
                <div className="portal-table-wrap">
                  <table className="portal-table finance-table">
                    <thead>
                      <tr>
                        <th>{copy.date}</th>
                        <th>{copy.entry}</th>
                        <th>{copy.bookingRef}</th>
                        <th className="finance-num">{copy.amount}</th>
                        <th className="finance-num">{copy.runningBalance}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashEntries.map((entry) => {
                        const amount = Number(entry.amount_iqd);
                        return (
                          <tr key={entry.id}>
                            <td><span dir="ltr">{formatDate(entry.created_at)}</span></td>
                            <td><span className="finance-entry-tag">{entryLabel(entry.entry_type, copy)}</span></td>
                            <td><span className="finance-mono" dir="ltr">{shortId(entry.booking_id)}</span></td>
                            <td className={`finance-num finance-amount ${amount >= 0 ? "credit" : "debit"}`} dir="ltr">
                              {amount >= 0 ? "+" : "−"}{formatIqd(Math.abs(amount))}
                            </td>
                            <td className="finance-num" dir="ltr">
                              {entry.cash_balance_after === null || entry.cash_balance_after === undefined
                                ? "—" : formatIqd(-Number(entry.cash_balance_after))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <Empty icon={CheckCircle2} text={copy.cashSettled} />}
            </Panel>

            <Panel title={copy.settlementsTitle} subtitle={copy.settlementsSub}>
              {collectionReceipts.length ? (
                <div className="portal-table-wrap">
                  <table className="portal-table finance-table">
                    <thead>
                      <tr>
                        <th>{copy.receiptNo}</th>
                        <th>{copy.date}</th>
                        <th className="finance-num">{copy.amount}</th>
                        <th>{copy.reference}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectionReceipts.map((receipt) => (
                        <tr key={receipt.id}>
                          <td><span className="finance-mono" dir="ltr">{receipt.receipt_no}</span></td>
                          <td><span dir="ltr">{formatDate(receipt.issued_at)}</span></td>
                          <td className="finance-num finance-amount credit" dir="ltr">{formatIqd(receipt.amount_iqd)}</td>
                          <td className="finance-trip">{receipt.reference ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Empty icon={ReceiptText} text={copy.noSettlements} />}
            </Panel>
          </>
        )}

        {tab === "payouts" && (
          <>
            <Panel
              title={copy.payoutHistory}
              subtitle={copy.payoutHistorySub}
              action={
                inFlightPayouts.length ? (
                  <span className="finance-quiet"><Clock3 size={13} /> {copy.requestBlocked}</span>
                ) : availableBalance < Math.max(payoutMinimum, 1) ? (
                  <span className="finance-quiet">
                    {copy.belowMinimum.replace("{amount}", formatIqd(payoutMinimum))}
                  </span>
                ) : (
                  <button type="button" className="portal-primary-button finance-pay"
                    onClick={() => setRequestingPayout(true)}>
                    <HandCoins size={14} /> {copy.requestPayout}
                  </button>
                )
              }
            >
              {/* Every payout the agency can see, at whatever stage — a request
                  that is still waiting is the thing they most want to look at,
                  and the old list showed only completed ones. */}
              {payouts.length ? (
                <div className="portal-table-wrap">
                  <table className="portal-table finance-table">
                    <thead>
                      <tr>
                        <th>{copy.date}</th>
                        <th className="finance-num">{copy.amount}</th>
                        <th>{copy.method}</th>
                        <th>{copy.reference}</th>
                        <th>{copy.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((payout) => {
                        const state = payoutState(payout.status);
                        return (
                          <tr key={payout.id}>
                            <td>
                              <span dir="ltr">{formatDate(payout.completed_at ?? payout.requested_at ?? payout.created_at)}</span>
                              {state !== "paid" && payout.requested_at
                                ? <small>{copy.requestedOn} {formatDate(payout.requested_at)}</small>
                                : null}
                            </td>
                            <td className={`finance-num finance-amount ${state === "paid" ? "credit" : ""}`} dir="ltr">
                              {formatIqd(payout.amount_iqd)}
                            </td>
                            <td>{methodLabel(payout.method, copy)}</td>
                            <td><span className="finance-mono" dir="ltr">{payout.reference || shortId(payout.id)}</span></td>
                            <td>
                              <PayoutStateBadge state={state} copy={copy} />
                              {payout.decision_reason ? <small>{payout.decision_reason}</small> : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <Empty icon={Banknote} text={copy.noPayouts} />}
            </Panel>

            <ReceiptsPanel receipts={receipts} copy={copy} />
          </>
        )}

        {requestingPayout && companyId && (
          <PayoutRequestModal
            companyId={companyId}
            available={availableBalance}
            minimum={payoutMinimum}
            busy={busy}
            runAction={runAction}
            copy={copy}
            onClose={() => setRequestingPayout(false)}
          />
        )}

        {drillBooking && (
          <BookingEarningsModal
            booking={drillBooking}
            tripTitle={tripMap.get(drillBooking.package_id) ?? shortId(drillBooking.package_id)}
            copy={copy}
            onClose={() => setDrillBooking(null)}
          />
        )}
      </div>
    );
  }

  /* ----------------------------- admin view ---------------------------- */

  const cashHeld = totals.collected - totals.paidOut;
  const recon = reconcile(source, ledger, copy);

  const adminTabs = [
    { id: "overview", label: copy.tabOverview, icon: Gauge },
    { id: "balances", label: copy.tabBalances, icon: Layers },
    { id: "reconciliation", label: copy.tabReconciliation, icon: CheckCircle2 },
    { id: "expenses", label: copy.tabExpenses, icon: ReceiptText },
    { id: "ledger", label: copy.tabLedger, icon: ScrollText },
    { id: "reports", label: copy.tabReports, icon: FileText },
  ];

  return (
    <div className="finance-workspace">
      <Heading eyebrow={copy.eyebrow} title={copy.adminTitle} description={copy.adminDesc} action={exportActions} />
      <Tabs tabs={adminTabs} active={tab} onChange={setTab} />
      {periodPicker}

      {tab === "overview" && (
        <>
          <section className="portal-metric-grid">
            <Metric icon={CircleDollarSign} label={copy.commissionRevenue} value={formatIqd(totals.commissionAccrued, true)}
              tone="green" copy={copy}
              detail={copy.commissionSplit
                .replace("{collected}", formatIqd(totals.commissionCollected, true))
                .replace("{owed}", formatIqd(totals.commissionAccrued - totals.commissionCollected, true))}
              delta={{ current: totals.commissionAccrued, previous: previous.commissionAccrued, goodWhenUp: true }} />
            <Metric icon={ReceiptText} label={copy.platformExpenses} value={formatIqd(platformSpend, true)}
              detail={copy.expensesAdminSub} tone="sand" copy={copy}
              delta={{ current: platformSpend, previous: platformSpendPrevious, goodWhenUp: false }} />
            <Metric icon={TrendingUp} label={copy.netProfit} value={formatIqd(netProfit, true)}
              detail={copy.netProfitDetail} tone="teal" copy={copy}
              delta={{ current: netProfit, previous: netProfitPrevious, goodWhenUp: true }} />
            <Metric icon={WalletCards} label={copy.cashHeld} value={formatIqd(cashHeld, true)}
              detail={copy.cashHeldDetail} tone="gold" copy={copy} />
          </section>

          <section className="portal-metric-grid">
            <Metric icon={Coins} label={copy.gmv} value={formatIqd(totals.gmv, true)}
              detail={copy.gmvDetail.replace("{count}", String(totals.bookingCount))} tone="green" copy={copy}
              delta={{ current: totals.gmv, previous: previous.gmv, goodWhenUp: true }} />
            <Metric icon={Banknote} label={copy.totalCollected} value={formatIqd(totals.collected, true)}
              detail={totals.refunded ? `${copy.refunded}: ${formatIqd(totals.refunded, true)}` : copy.fromPilgrims}
              tone="teal" copy={copy}
              delta={{ current: totals.collected, previous: previous.collected, goodWhenUp: true }} />
            <Metric icon={Clock3} label={copy.owedToCompanies} value={formatIqd(owedToCompanies, true)}
              detail={`${copy.owedToTawaf}: ${formatIqd(owedToTawaf, true)} · ${copy.rightNow}`} tone="gold" copy={copy} />
            <Metric icon={HandCoins} label={copy.totalPaidOut} value={formatIqd(totals.paidOut, true)}
              detail={copy.acrossPayouts.replace("{count}", String(
                source.payouts.filter((payout) => payout.status === "completed" &&
                  inRange(dayKeyOf(payout.completed_at ?? payout.created_at), period.from, period.to)).length,
              ))} tone="sand" copy={copy}
              delta={{ current: totals.paidOut, previous: previous.paidOut, goodWhenUp: true }} />
          </section>

          <ChartFrame title={copy.chartMoneyTitle} subtitle={copy.chartMoneySub} copy={copy}
            empty={!trendPoints.some((point) => point.values.some(Boolean))} table={seriesTable(trendSeries)}>
            <TrendChart buckets={buckets} series={trendSeries} />
          </ChartFrame>

          <ChartFrame title={copy.chartCashTitle} subtitle={copy.chartCashSub} copy={copy}
            empty={!cashPoints.some((point) => point.values.some(Boolean))} table={seriesTable(cashSeries)}>
            <TrendChart buckets={buckets} series={cashSeries} />
          </ChartFrame>

          <div className="finance-chart-pair">
            <ChartFrame title={copy.chartCompaniesTitle} subtitle={copy.chartCompaniesSub} copy={copy}
              empty={!companyRanking.length}
              table={
                <div className="portal-table-wrap">
                  <table className="portal-table finance-table">
                    <thead><tr><th>{copy.company}</th><th className="finance-num">{copy.gross}</th></tr></thead>
                    <tbody>
                      {companyRanking.map((row) => (
                        <tr key={row.key}><td>{row.label}</td><td className="finance-num" dir="ltr">{formatIqd(row.value)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            >
              <BarChart data={companyRanking} />
            </ChartFrame>

            <ChartFrame title={copy.chartMethodTitle} subtitle={copy.chartMethodSub} copy={copy}
              empty={!methodRanking.length}
              table={
                <div className="portal-table-wrap">
                  <table className="portal-table finance-table">
                    <thead><tr><th>{copy.method}</th><th className="finance-num">{copy.amount}</th></tr></thead>
                    <tbody>
                      {methodRanking.map((row) => (
                        <tr key={row.key}><td>{row.label}</td><td className="finance-num" dir="ltr">{formatIqd(row.value)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            >
              <BarChart data={methodRanking} />
            </ChartFrame>
          </div>
        </>
      )}

      {tab === "balances" && (
        <>
          <ChartFrame title={copy.chartAgingTitle} subtitle={copy.chartAgingSub} copy={copy}
            empty={!aging.some((bucket) => bucket.value)}
            table={
              <div className="portal-table-wrap">
                <table className="portal-table finance-table">
                  <thead><tr><th>{copy.age}</th><th className="finance-num">{copy.amount}</th></tr></thead>
                  <tbody>
                    {aging.map((bucket) => (
                      <tr key={bucket.key}><td>{bucket.label}</td><td className="finance-num" dir="ltr">{formatIqd(bucket.value)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          >
            <BarChart data={aging} colors={AGING_RAMP} />
          </ChartFrame>

          <Panel
            title={copy.balances}
            subtitle={copy.balancesSub}
            action={
              <button type="button" className="finance-sort"
                onClick={() => setSortBy(sortBy === "balance" ? "age" : sortBy === "age" ? "name" : sortBy === "name" ? "pending" : "balance")}>
                <ArrowUpDown size={13} />
                {sortBy === "balance" ? copy.balance : sortBy === "age" ? copy.age : sortBy === "name" ? copy.company : copy.pendingBookings}
              </button>
            }
          >
            {sortedBalances.length ? (
              <div className="portal-table-wrap">
                <table className="portal-table finance-table">
                  <thead>
                    <tr>
                      <th>{copy.company}</th>
                      <th className="finance-num">{copy.balance}</th>
                      <th className="finance-num">{copy.age}</th>
                      <th className="finance-num">{copy.commission}</th>
                      <th>{copy.lastPayout}</th>
                      <th className="finance-num">{copy.pendingBookings}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBalances.map((row) => {
                      const owedOut = row.balance > 0;
                      const owedIn = row.balance < 0;
                      return (
                        <tr
                          key={row.companyId}
                          className={companyFilter === row.companyId ? "finance-row-active" : ""}
                          onClick={() => setCompanyFilter(companyFilter === row.companyId ? "all" : row.companyId)}
                        >
                          <td>
                            <b>{row.name}</b>
                            <small>{owedOut ? copy.owedToCompanies : owedIn ? copy.owedToTawaf : copy.settledUp}</small>
                          </td>
                          <td className={`finance-num finance-amount ${owedOut ? "credit" : owedIn ? "debit" : ""}`} dir="ltr">
                            {formatIqd(Math.abs(row.balance))}
                          </td>
                          <td className="finance-num" dir="ltr">
                            {row.balance ? copy.days.replace("{count}", String(row.oldestUnsettledDays)) : "—"}
                          </td>
                          <td className="finance-num" dir="ltr">
                            {row.commissionRate !== null ? formatPercent(row.commissionRate) : "—"}
                          </td>
                          <td><span dir="ltr">{row.lastPayoutAt ? formatDate(row.lastPayoutAt) : "—"}</span></td>
                          <td className="finance-num" dir="ltr">{row.pendingBookings}</td>
                          <td className="finance-action">
                            {row.balance === 0 ? (
                              <span className="portal-status positive"><i />{copy.settledUp}</span>
                            ) : (
                              <button
                                type="button"
                                className="portal-primary-button finance-pay"
                                onClick={(event) => { event.stopPropagation(); setSettleTarget(row); }}
                              >
                                {owedOut ? <HandCoins size={14} /> : <Landmark size={14} />}
                                {owedOut ? copy.payNow : copy.collectNow}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <Empty icon={Building2} text={copy.noCompanies} />}
          </Panel>
        </>
      )}

      {tab === "reconciliation" && (
        <ReconciliationTab
          payments={payments}
          companyMap={companyMap}
          bookings={bookingMap}
          tripMap={tripMap}
          busy={busy}
          runAction={runAction}
          copy={copy}
        />
      )}

      {tab === "expenses" && (
        <ExpensesTab
          role="admin"
          companies={companies}
          trips={trips}
          expenses={expenses}
          budgets={budgets}
          period={period}
          busy={busy}
          runAction={runAction}
          copy={copy}
          defaultCompanyId={null}
        />
      )}

      {tab === "ledger" && (
        <Panel
          title={copy.ledger}
          subtitle={copy.ledgerSub}
          action={
            companyFilter !== "all" ? (
              <button type="button" className="finance-sort" onClick={() => setCompanyFilter("all")}>
                <ArrowUpRight size={13} /> {copy.viewAll}
              </button>
            ) : undefined
          }
        >
          {ledgerFilterBar}
          {lines.length ? (
            <LedgerTable role="admin" lines={lines} copy={copy} />
          ) : (
            <Empty icon={ScrollText} text={ledger.length ? copy.noMatch : copy.noEntries} />
          )}
        </Panel>
      )}

      {tab === "reports" && (
        <>
          <Panel
            title={copy.statementTitle}
            subtitle={copy.statementSub}
            action={
              <select className="finance-inline-select" value={statementCompany}
                onChange={(event) => setStatementCompany(event.target.value)}>
                <option value="">{copy.pickCompany}</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            }
          >
            {statement ? (
              <>
                <div className="finance-statement-head">
                  <div><small>{copy.openingBalance}</small><b dir="ltr">{formatIqd(statement.opening)}</b></div>
                  <div><small>{copy.movements}</small><b dir="ltr">{statement.movements.length}</b></div>
                  <div><small>{copy.closingBalance}</small><b dir="ltr">{formatIqd(statement.closing)}</b></div>
                </div>
                {statement.movements.length ? (
                  <div className="portal-table-wrap">
                    <table className="portal-table finance-table">
                      <thead>
                        <tr>
                          <th>{copy.date}</th><th>{copy.entry}</th><th>{copy.note}</th>
                          <th className="finance-num">{copy.amount}</th><th className="finance-num">{copy.balance}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statement.movements.map((entry, index) => {
                          const running = statement.opening + statement.movements
                            .slice(0, index + 1)
                            .reduce((sum, item) => sum + Number(item.amount_iqd), 0);
                          const amount = Number(entry.amount_iqd);
                          return (
                            <tr key={entry.id}>
                              <td><span dir="ltr">{formatDate(entry.created_at)}</span></td>
                              <td><span className="finance-entry-tag">{entryLabel(entry.entry_type, copy)}</span></td>
                              <td className="finance-trip">{entry.description ?? "—"}</td>
                              <td className={`finance-num finance-amount ${amount >= 0 ? "credit" : "debit"}`} dir="ltr">
                                {amount >= 0 ? "+" : "−"}{formatIqd(Math.abs(amount))}
                              </td>
                              <td className="finance-num" dir="ltr">{formatIqd(running)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : <Empty icon={ScrollText} text={copy.noEntries} />}
              </>
            ) : <Empty icon={FileText} text={copy.pickCompany} />}
          </Panel>

          <Panel title={copy.reconTitle} subtitle={copy.reconSub}>
            <div className="portal-table-wrap">
              <table className="portal-table finance-table">
                <tbody>
                  {recon.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.ok
                          ? <CheckCircle2 size={14} className="finance-ok" />
                          : <AlertTriangle size={14} className="finance-bad" />}
                      </td>
                      <td><b>{row.label}</b></td>
                      <td className="finance-num" dir="ltr">
                        {row.id === "unledgered" ? row.left : `${formatIqd(row.left)} · ${formatIqd(row.right)}`}
                      </td>
                      <td>
                        <span className={`portal-status ${row.ok ? "positive" : "warning"}`}>
                          <i />{row.ok ? copy.reconOk : copy.reconOff}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <ReceiptsPanel receipts={receipts} copy={copy} companyMap={companyMap} />

          <Panel title={copy.auditTitle} subtitle={copy.auditSub}>
            {financeAudit.length ? (
              <div className="portal-table-wrap">
                <table className="portal-table finance-table">
                  <thead>
                    <tr><th>{copy.date}</th><th>{copy.actor}</th><th>{copy.action}</th><th className="finance-num">{copy.amount}</th><th>{copy.note}</th></tr>
                  </thead>
                  <tbody>
                    {financeAudit.map((row) => (
                      <tr key={row.id}>
                        <td><span dir="ltr">{formatDate(row.created_at)}</span></td>
                        <td>{row.actor_role ?? "—"}</td>
                        <td><span className="finance-entry-tag">{actionLabel(row.action, copy)}</span></td>
                        <td className="finance-num" dir="ltr">
                          {row.new_state?.amount_iqd ? formatIqd(row.new_state.amount_iqd) : "—"}
                        </td>
                        <td className="finance-trip">{row.reason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty icon={History} text={copy.noAudit} />}
          </Panel>
        </>
      )}

      {settleTarget && (
        <SettlementModal
          target={settleTarget}
          busy={busy}
          runAction={runAction}
          copy={copy}
          onClose={() => setSettleTarget(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Cash reconciliation queue (admin)
 * ------------------------------------------------------------------ */

// Only company-collected cash lands here. Money Tawaf took is already on
// Tawaf's own books and has nothing to attest to — surfacing it would bury the
// rows that actually need a human decision.
function ReconciliationTab({ payments, companyMap, bookings, tripMap, busy, runAction, copy }: {
  payments: FinancePayment[];
  companyMap: Map<string, string>;
  bookings: Map<string, FinanceBooking>;
  tripMap: Map<string, string>;
  busy: string;
  runAction: RunAction;
  copy: Copy;
}) {
  const [target, setTarget] = useState<FinancePayment | null>(null);
  const [note, setNote] = useState("");
  const [showVerified, setShowVerified] = useState(false);

  const queue = useMemo(() => payments
    .filter((payment) => payment.collected_by === "company" && payment.status === "succeeded")
    .filter((payment) => (showVerified ? true : !payment.reconciled_at))
    .sort((a, b) => (a.confirmed_at ?? a.created_at).localeCompare(b.confirmed_at ?? b.created_at)),
    [payments, showVerified]);

  const outstanding = payments.filter(
    (payment) => payment.collected_by === "company" && payment.status === "succeeded" && !payment.reconciled_at,
  );
  const outstandingTotal = outstanding.reduce((sum, payment) => sum + Number(payment.amount_iqd), 0);

  async function verify(payment: FinancePayment) {
    await runAction(
      `reconcile-${payment.id}`,
      () => getSupabase().rpc("reconcile_payment", {
        p_payment_id: payment.id,
        p_note: note.trim() || null,
      }),
      copy.reconVerified,
    );
    setTarget(null);
    setNote("");
  }

  return (
    <>
      <section className="portal-metric-grid">
        <Metric icon={Landmark} label={copy.reconQueueTitle} value={formatIqd(outstandingTotal, true)}
          detail={copy.acrossPayouts.replace("{count}", String(outstanding.length))}
          tone={outstanding.length ? "gold" : "green"} copy={copy} />
      </section>

      <Panel
        title={copy.reconQueueTitle}
        subtitle={copy.reconQueueSub}
        action={
          <button type="button" className="finance-sort" onClick={() => setShowVerified(!showVerified)}>
            {showVerified ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
            {showVerified ? copy.reconVerified : copy.pending}
          </button>
        }
      >
        {queue.length ? (
          <div className="portal-table-wrap">
            <table className="portal-table finance-table">
              <thead>
                <tr>
                  <th>{copy.date}</th>
                  <th>{copy.company}</th>
                  <th>{copy.trip}</th>
                  <th>{copy.reconReceipt}</th>
                  <th className="finance-num">{copy.amount}</th>
                  <th className="finance-num">{copy.reconAge}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {queue.map((payment) => {
                  const booking = bookings.get(payment.booking_id);
                  const day = dayKeyOf(payment.confirmed_at ?? payment.created_at);
                  const waiting = daysBetween(day, todayKey());
                  return (
                    <tr key={payment.id}>
                      <td><span dir="ltr">{formatDate(payment.confirmed_at ?? payment.created_at)}</span></td>
                      <td><b>{companyMap.get(payment.company_id) ?? shortId(payment.company_id)}</b></td>
                      <td className="finance-trip">
                        {booking ? tripMap.get(booking.package_id) ?? "—" : "—"}
                      </td>
                      <td><span className="finance-mono" dir="ltr">{payment.provider_reference ?? "—"}</span></td>
                      <td className="finance-num finance-amount credit" dir="ltr">{formatIqd(payment.amount_iqd)}</td>
                      <td className="finance-num" dir="ltr">
                        {payment.reconciled_at ? "—" : copy.days.replace("{count}", String(waiting))}
                      </td>
                      <td className="finance-action">
                        {payment.reconciled_at ? (
                          <span className="portal-status positive">
                            <i />{copy.reconVerified}
                          </span>
                        ) : (
                          <button type="button" className="portal-primary-button finance-pay"
                            disabled={Boolean(busy)} onClick={() => setTarget(payment)}>
                            <CheckCircle2 size={14} /> {copy.reconVerify}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty icon={CheckCircle2} text={copy.reconNothing} />}
      </Panel>

      {target && (
        <div className="portal-modal-backdrop" onClick={() => setTarget(null)}>
          <div className="portal-modal finance-modal narrow" onClick={(event) => event.stopPropagation()}>
            <header className="portal-modal-header">
              <div><h2>{copy.reconConfirmTitle}</h2><p>{copy.reconConfirmBody}</p></div>
              <button type="button" className="finance-icon-button" onClick={() => setTarget(null)}>
                <X size={16} />
              </button>
            </header>
            <div className="finance-statement-head">
              <div><small>{copy.company}</small><b>{companyMap.get(target.company_id) ?? "—"}</b></div>
              <div><small>{copy.reconReceipt}</small><b dir="ltr">{target.provider_reference ?? "—"}</b></div>
              <div><small>{copy.amount}</small><b dir="ltr">{formatIqd(target.amount_iqd)}</b></div>
            </div>
            <div className="portal-form-grid">
              <label>
                <small>{copy.reconNote}</small>
                <input value={note} onChange={(event) => setNote(event.target.value)} dir="auto" />
              </label>
            </div>
            <footer className="portal-modal-footer">
              <button type="button" className="portal-secondary-button" onClick={() => setTarget(null)}>
                {copy.cancel}
              </button>
              <button type="button" className="portal-primary-button"
                disabled={busy === `reconcile-${target.id}`} onClick={() => void verify(target)}>
                <CheckCircle2 size={15} /> {copy.reconVerify}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function ReceiptsPanel({ receipts, copy, companyMap }: {
  receipts: ReceiptRow[];
  copy: Copy;
  companyMap?: Map<string, string>;
}) {
  return (
    <Panel title={copy.receiptsTitle} subtitle={copy.receiptsSub}>
      {receipts.length ? (
        <div className="portal-table-wrap">
          <table className="portal-table finance-table">
            <thead>
              <tr>
                <th>{copy.receiptNo}</th>
                <th>{copy.date}</th>
                {companyMap && <th>{copy.company}</th>}
                <th>{copy.entry}</th>
                <th className="finance-num">{copy.amount}</th>
                <th>{copy.reference}</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td><span className="finance-mono" dir="ltr">{receipt.receipt_no}</span></td>
                  <td><span dir="ltr">{formatDate(receipt.issued_at)}</span></td>
                  {companyMap && <td><b>{companyMap.get(receipt.company_id) ?? "—"}</b></td>}
                  <td>
                    <span className="finance-entry-tag">
                      {receipt.kind === "payout" ? copy.kindPayout : copy.kindCollection}
                    </span>
                  </td>
                  <td className="finance-num finance-amount credit" dir="ltr">{formatIqd(receipt.amount_iqd)}</td>
                  <td className="finance-trip">{receipt.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty icon={ReceiptText} text={copy.noReceipts} />}
    </Panel>
  );
}
