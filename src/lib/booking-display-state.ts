/**
 * The single client-facing reading of a booking.
 *
 * This is a direct port of `lib/models/booking_display_state.dart` in the
 * Flutter app. The two MUST stay in step: a pilgrim seeing "Changes required"
 * on their phone and an agent seeing "Confirmed" for the same booking on the
 * dashboard is the exact failure this file exists to prevent. If you change the
 * precedence here, change it there in the same commit.
 *
 * A booking carries four independent status axes — operational stage, payment,
 * documents and visa — and none of them alone is what a person should be shown.
 *
 * Ordering matters. Cases are evaluated top to bottom and the first match wins,
 * so a booking that is both paid and has a rejected document reads as
 * "action needed" rather than "confirmed": the thing someone has to *do*
 * outranks the thing that is merely true.
 */

export type BookingDisplayState =
  | "pendingReview"
  | "actionNeeded"
  | "awaitingPayment"
  | "documentsInReview"
  | "visaInProgress"
  | "confirmed"
  | "readyToTravel"
  | "travelling"
  | "completed"
  | "cancelled"
  | "rejected"
  | "expired";

const DEAD_STAGES = new Set(["cancelled", "rejected", "expired", "no_show"]);
const VISA_IN_FLIGHT = new Set(["ready_to_apply", "submitted", "under_review"]);

export const VISA_REJECTION_CATEGORIES = ["fixable_document", "traveller_replaced", "final_rejection"] as const;
export type VisaRejectionCategory = typeof VISA_REJECTION_CATEGORIES[number];

export type BookingStateInput = {
  operationalStage: string;
  paymentStatus?: string | null;
  /**
   * Per-traveller values for travellers still on the booking.
   *
   * `undefined` and `[]` mean different things and the difference matters.
   * `[]` is "loaded, and there are none" — which at the confirmed stage means
   * nobody has uploaded anything, i.e. action needed. `undefined` is "not
   * loaded", where inferring anything would be a guess. Several dashboard
   * screens list bookings without joining travellers, so this distinction is
   * what stops them all reading "Action needed".
   */
  documentStatuses?: string[];
  visaStatuses?: string[];
  payMethod?: string | null;
};

/**
 * Removed travellers remain in the database as an audit trail, but must never
 * influence a live booking's status, readiness, manifest, or exports.
 * Travellers selected before `removed_at` existed have no property and are
 * therefore active.
 */
export function onlyActiveTravellers<T extends { removed_at?: string | null }>(travellers: T[]): T[] {
  return travellers.filter((traveller) => traveller.removed_at == null);
}

export function resolveBookingDisplayState({
  operationalStage,
  paymentStatus,
  documentStatuses,
  visaStatuses,
}: BookingStateInput): BookingDisplayState {
  const docs = documentStatuses ?? [];
  const visas = visaStatuses ?? [];
  const travellersKnown = documentStatuses !== undefined;
  // Terminal stages short-circuit: once a booking is dead, no document or visa
  // state on it is actionable.
  switch (operationalStage) {
    case "cancelled": return "cancelled";
    case "rejected": return "rejected";
    case "expired":
    case "no_show": return "expired";
    case "completed": return "completed";
    case "in_progress": return "travelling";
    case "ready": return "readyToTravel";
  }

  if (operationalStage === "requested") return "pendingReview";

  // Phase 1 split the request hold from the post-acceptance payment deadline.
  // A few pre-migration rows can still be `confirmed` without actually being
  // paid; showing those as confirmed would unlock work that the server rejects.
  // `undefined` means the caller did not load payment state, so do not guess.
  if (
    operationalStage === "awaiting_payment"
    || (operationalStage === "confirmed" && paymentStatus !== undefined && paymentStatus !== "paid")
  ) return "awaitingPayment";

  const anyDocumentRejected = docs.includes("rejected");
  const anyVisaRejected = visas.includes("rejected");
  const anyVisaDocumentsMissing = visas.includes("documents_missing");
  // A traveller who has uploaded nothing blocks the booking just as much as one
  // whose document was sent back. Only at 'confirmed', not 'awaiting_payment' —
  // while money is still owed, the payment is the more specific blocker and
  // "awaiting payment" tells the reader more than a generic "action needed".
  // Skipped entirely when travellers were not loaded, so a list screen that
  // does not join them does not paint every confirmed booking red.
  const documentsOutstanding = travellersKnown
    && operationalStage === "confirmed"
    && (docs.length === 0 || docs.includes("missing"));

  if (
    operationalStage === "needs_information"
    || anyDocumentRejected
    || anyVisaRejected
    || anyVisaDocumentsMissing
    || documentsOutstanding
  ) return "actionNeeded";

  if (visas.some((status) => VISA_IN_FLIGHT.has(status))) return "visaInProgress";
  if (docs.includes("under_review")) return "documentsInReview";

  return "confirmed";
}

/** Mirrors BookingClientActions.resolve — kept beside the state so the label
 *  and the offered actions can never disagree. */
export function resolveBookingActions(input: BookingStateInput) {
  const { operationalStage, paymentStatus, visaStatuses = [], payMethod } = input;
  const dead = DEAD_STAGES.has(operationalStage) || operationalStage === "completed";

  // Mirrors validate_payment_not_expired: cash is accepted only once the company
  // has accepted, because the money changes hands at a counter. FIB and card can
  // be settled earlier — the server allows requested / awaiting_payment /
  // confirmed.
  const payableStages = payMethod === "cash"
    ? new Set(["awaiting_payment"])
    : new Set(["requested", "awaiting_payment", "confirmed"]);

  return {
    canWithdraw: operationalStage === "requested",
    canProvideInformation: operationalStage === "needs_information",
    canPay: payableStages.has(operationalStage) && paymentStatus !== "paid",
    // Upload opens on acceptance and does NOT wait for payment — mirroring the
    // RLS policy, which permits awaiting_payment and confirmed.
    canUploadDocuments: operationalStage === "awaiting_payment" || operationalStage === "confirmed",
    canRespondToVisaRejection: !dead && visaStatuses.includes("rejected"),
    canCancel: ["requested", "needs_information", "awaiting_payment", "confirmed", "ready"].includes(operationalStage),
  };
}

type Locale = "ku" | "ar" | "en";

const LABELS: Record<BookingDisplayState, [string, string, string]> = {
  pendingReview: ["چاوەڕێی پێداچوونەوە", "بانتظار المراجعة", "Pending review"],
  actionNeeded: ["پێویستی بە کردار هەیە", "مطلوب إجراء", "Action needed"],
  awaitingPayment: ["چاوەڕێی پارەدان", "بانتظار الدفع", "Awaiting payment"],
  documentsInReview: ["بەڵگەنامەکان لە پێداچوونەوەدان", "المستندات قيد المراجعة", "Documents in review"],
  visaInProgress: ["ڤیزا لە جێبەجێکردندایە", "التأشيرة قيد الإنجاز", "Visa in progress"],
  confirmed: ["پشتڕاستکراوە", "مؤكد", "Confirmed"],
  readyToTravel: ["ئامادەیە بۆ گەشت", "جاهز للسفر", "Ready to travel"],
  travelling: ["لە گەشتدایە", "في الرحلة", "Travelling"],
  completed: ["تەواوبووە", "مكتمل", "Completed"],
  cancelled: ["هەڵوەشێنراوەتەوە", "ملغى", "Cancelled"],
  rejected: ["ڕەتکراوەتەوە", "مرفوض", "Rejected"],
  expired: ["بەسەرچووە", "منتهي", "Expired"],
};

export function bookingStateLabel(state: BookingDisplayState, locale: Locale): string {
  const [ku, ar, en] = LABELS[state];
  return locale === "ar" ? ar : locale === "en" ? en : ku;
}

/** Maps onto the dashboard's existing `.portal-status` tone classes. */
export function bookingStateTone(state: BookingDisplayState): "positive" | "warning" | "negative" | "neutral" {
  switch (state) {
    case "confirmed":
    case "readyToTravel":
    case "travelling":
    case "completed":
      return "positive";
    case "actionNeeded":
      return "negative";
    case "pendingReview":
    case "awaitingPayment":
    case "documentsInReview":
    case "visaInProgress":
      return "warning";
    case "cancelled":
    case "rejected":
    case "expired":
      return "neutral";
  }
}
