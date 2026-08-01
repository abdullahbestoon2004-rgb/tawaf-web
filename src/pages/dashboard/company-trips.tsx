/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  resolveBookingDisplayState,
  bookingStateLabel,
  bookingStateTone,
  onlyActiveTravellers,
  VISA_REJECTION_CATEGORIES,
} from "../../lib/booking-display-state";
import type { VisaRejectionCategory } from "../../lib/booking-display-state";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BookOpenCheck,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Heart,
  Hotel,
  Image as ImageIcon,
  Inbox,
  MapPin,
  Minus,
  Pencil,
  Phone,
  Plane,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
  UserCheck,
  UserRound,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useScrollLock } from "@/lib/use-scroll-lock";
import TawafLoadingSpinner from "@/components/TawafLoadingSpinner";

type Company = {
  id: string;
  name: string;
  commission_rate?: number | null;
};

type Trip = {
  id: string;
  company_id: string;
  title: string;
  title_ar?: string | null;
  title_en?: string | null;
  overview?: string | null;
  overview_ar?: string | null;
  overview_en?: string | null;
  price_iqd: number;
  original_iqd?: number | null;
  days: number;
  nights: number;
  transport: string;
  carrier?: string | null;
  transfer_note?: string | null;
  acc_stars: number;
  hotel?: string | null;
  distance_haram?: string | null;
  room?: string | null;
  meals?: string | null;
  includes?: string[] | null;
  badge?: string | null;
  image_url?: string | null;
  lifecycle_status: string;
  review_reason: string | null;
  rejection_reason?: string | null;
  departure_date: string | null;
  return_date: string | null;
  capacity: number | null;
  seats_reserved: number | null;
  is_featured: boolean;
  is_published: boolean;
  hotel_makkah_description?: string | null;
  hotel_madinah_description?: string | null;
  room_occupancies?: number[] | null;
  package_tier?: string | null;
  group_type?: string | null;
  season_tag?: string | null;
  departure_airport?: string | null;
  airline_name?: string | null;
  flight_type?: string | null;
  bus_between_cities?: boolean | null;
  airport_transfers?: boolean | null;
  transport_notes?: string | null;
  meals_per_day?: number | null;
  video_url?: string | null;
  cancellation_policy?: string | null;
  deposit_iqd?: number | null;
  non_refundable_deposit?: boolean | null;
  deposit_terms?: string | null;
  accepted_payment_methods?: string[] | null;
  created_at: string;
  updated_at?: string | null;
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
  operational_stage: string;
  pay_method: string;
  pay_status: string;
  contact_phone: string | null;
  note?: string | null;
  room_label?: string | null;
  cash_payment_location_type: string | null;
  cash_payment_location_name: string | null;
  cash_payment_location_address: string | null;
  cash_payment_location_hours: string | null;
  payment_receipt_number: string | null;
  payment_confirmation_code: string | null;
  payment_confirmed_at: string | null;
  accepted_at: string | null;
  payment_deadline: string | null;
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

type TripChangeRequest = {
  id: string;
  package_id: string;
  company_id: string;
  request_type: "edit" | "pause" | "remove";
  status: "pending" | "approved" | "rejected" | "cancelled";
  changed_fields: string[];
  request_reason: string | null;
  review_reason: string | null;
  created_at: string;
};

type ItineraryDay = { id?: string; package_id?: string; day_no: number; title: string; summary: string | null };
type PricingRow = { offer_id?: string; occupancy_type: string; price_iqd: number; price_usd?: number | null };
type HotelRow = {
  offer_id?: string;
  city: "makkah" | "madinah";
  nights: number;
  distance_from_haram_m: number;
  hotels?: {
    id?: string;
    name: string;
    description: string | null;
    star_rating: number;
    photo_urls?: string[];
  } | null;
};
type InclusionRow = { id?: string; offer_id?: string; type: string; included: boolean; details?: string | null; sort_order?: number };
type Traveller = {
  id: string;
  booking_id: string;
  full_name: string;
  local_name?: string | null;
  passport_no: string | null;
  date_of_birth?: string | null;
  document_status: string;
  visa_status: string;
  visa_reference?: string | null;
  visa_rejection_category?: string | null;
  visa_reason?: string | null;
  phone: string | null;
  gender?: string | null;
  nationality?: string | null;
  passport_expiry_date?: string | null;
  is_lead?: boolean;
  transport_seat: string | null;
  removed_at?: string | null;
  removed_reason?: string | null;
};
type TravellerDocument = {
  id: string;
  traveller_id: string;
  booking_id: string;
  kind: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
};

type TripDetails = {
  itinerary: ItineraryDay[];
  pricing: PricingRow[];
  hotels: HotelRow[];
  inclusions: InclusionRow[];
  travellers: Traveller[];
  documents: TravellerDocument[];
};

type WizardHotel = {
  city: "makkah" | "madinah";
  name: string;
  description: string;
  star_rating: number;
  nights: number;
  distance_from_haram_m: number;
};

type WizardState = {
  id: string | null;
  title: string;
  title_en: string;
  title_ar: string;
  overview: string;
  overview_en: string;
  overview_ar: string;
  package_tier: "economy" | "standard" | "vip";
  group_type: "family" | "individual" | "group";
  season_tag: "regular" | "ramadan" | "shawwal" | "other";
  departure_date: string;
  return_date: string;
  capacity: string;
  // Read-only mirror of packages.seats_reserved, carried so the preview can
  // show seats REMAINING the way the app does. Never sent back — capacity
  // changes on a live trip go through the capacity-adjustment flow.
  seats_reserved: number;
  transport: "plane" | "bus";
  departure_airport: "EBL" | "BGW" | "ISU";
  airline_name: string;
  flight_type: "direct" | "connecting";
  bus_company: string;
  pickup_point: string;
  bus_between_cities: boolean;
  airport_transfers: boolean;
  transport_notes: string;
  package_price_iqd: string;
  deposit_iqd: string;
  non_refundable_deposit: boolean;
  deposit_terms: string;
  meals_per_day: string;
  video_url: string;
  image_url: string;
  hotels: WizardHotel[];
  inclusions: Record<string, boolean>;
  itinerary: Array<{ day_no: number; title: string; summary: string }>;
  cancellation_policy: string;
};

type Props = {
  company: Company;
  trips: Trip[];
  changeRequests: TripChangeRequest[];
  bookings: Booking[];
  bookingTravellers: Traveller[];
  commissions: Commission[];
  payments: Payment[];
  busy: string;
  runAction: (id: string, action: () => any, success: string) => Promise<any>;
  askReason: (title: string) => Promise<string | null>;
  locale: "ku" | "ar" | "en";
};

const tripTranslations = {
  ku: {
    tripCatalogue: "کەتەلۆگی گەشتەکان",
    trips: "گەشتەکان",
    createSubmitOperate: "گشت گەشتەکانی عومرە دروست بکە، پێشکەش بکە و بەڕێوە ببە لە یەک شوێنەوە.",
    createNewTrip: "گەشتی نوێ دروست بکە",
    totalTrips: "کۆی گەشتەکان",
    published: "بڵاوکراوەتەوە",
    underReview: "لەژێر پێداچوونەوەدایە",
    reservedSeats: "شوێنە گیراوەکان",
    searchTripCarrier: "گەڕان بەپێی گەشت، فڕۆکەخانە یان هێڵی ئاسمانی...",
    allStatus: "هەموو دۆخەکان",
    allTiers: "هەموو ئاستەکان",
    selectDepartureDate: "ڕێکەوتی بەڕێکەوتن دیاری بکە",
    duplicate: "کۆپیکردن",
    editTrip: "دەستکاری گەشت",
    allTrips: "هەموو گەشتەکان",
    overview: "پوختە",
    bookings: "حجزەکان",
    travellers: "گەشتیاران",
    documents: "بەڵگەنامەکان",
    financials: "دارایی",
    loadingTrips: "بارکردنی چالاکییەکانی گەشت...",
    adminFeedback: "تێبینییەکانی بەڕێوەبەر",
    resolveFeedback: "چارەسەرکردنی تێبینی",
    noTripsFound: "هیچ گەشتێک نەدۆزرایەوە.",
    noTripsDesc: "گەشتێک دروست بکە بۆ ئەوەی لە کەتەلۆگەکەتدا بڵاوبێتەوە.",
    allStatusesLabel: "هەموو دۆخەکان",
    allTiersLabel: "هەموو ئاستەکان",
    draft: "ڕەشنووس",
    changesRequested: "داواکاری دەستکاری",
    paused: "ڕاگیراو",
    soldOut: "تەواوبوو (پڕ)",
    expired: "بەسەرچوو",
    economy: "ئابووری (ئیکۆنۆمی)",
    standard: "ئاسایی (ستاندارد)",
    vip: "تایبەت (VIP)",
    tripName: "ناو/ناونیشانی گەشت",
    departureAirport: "فڕۆکەخانەی بەڕێکەوتن",
    duration: "ماوە",
    startingPrice: "نرخی سەرەکی",
    capacity: "توانا/شوێن",
    status: "دۆخ",
    actions: "کردارەکان",
    searchPlaceholder: "گەڕان بەپێی گەشت، فڕۆکەخانە یان هێڵی ئاسمانی...",
    tryFilters: "هەوڵ بدە فلتەرەکان بگۆڕیت.",
    createTripDraftBtn: "یەکەم ڕەشنووسی گەشتت دروست بکە بۆ دەستپێکردن.",
    unfinishedDraft: "ڕەشنووسی تەواونەکراو پارێزراوە",
    draftSafeMessage: "گۆڕانکارییەکانت لەم ئامێرە پارێزراون و دەتوانیت لە هەمان شوێن بەردەوام بیت.",
    continueEditing: "بەردەوامبوون لە دەستکاری",
    discardWorkingCopy: "لابردنی کۆپی کاتی",
    untitledDraft: "گەشتی بێ ناونیشان",
    discardConfirm: "دڵنیایت لە لابردنی کۆپی کاتی ئەم ڕەشنووسە؟"
  },
  ar: {
    tripCatalogue: "كتالوج الرحلات",
    trips: "الرحلات",
    createSubmitOperate: "أنشئ وأرسل وأدر كل مغادرة عمرة من مساحة عمل واحدة.",
    createNewTrip: "أنشئ رحلة جديدة",
    totalTrips: "إجمالي الرحلات",
    published: "منشور",
    underReview: "قيد المراجعة",
    reservedSeats: "المقاعد المحجوزة",
    searchTripCarrier: "البحث باسم الرحلة، المطار أو الطيران...",
    allStatus: "كل الحالات",
    allTiers: "كل الفئات",
    selectDepartureDate: "اختر تاريخ المغادرة",
    duplicate: "نسخ",
    editTrip: "تعديل الرحلة",
    allTrips: "كل الرحلات",
    overview: "نظرة عامة",
    bookings: "الحجوزات",
    travellers: "المسافرون",
    documents: "المستندات",
    financials: "المالية",
    loadingTrips: "جاري تحميل عمليات الرحلة...",
    adminFeedback: "ملاحظات المسؤول",
    resolveFeedback: "حل الملاحظات",
    noTripsFound: "لم يتم العثور على رحلات.",
    noTripsDesc: "أنشئ مسودة رحلة للبدء في بناء كتالوجك.",
    allStatusesLabel: "كل الحالات",
    allTiersLabel: "كل الفئات",
    draft: "مسودة",
    changesRequested: "مطلوب تعديلات",
    paused: "موقوف مؤقتاً",
    soldOut: "مكتملة بالكامل",
    expired: "منتهية",
    economy: "اقتصادي",
    standard: "عادي",
    vip: "ممتاز (VIP)",
    tripName: "الرحلة",
    departureAirport: "المغادرة",
    duration: "المدة",
    startingPrice: "السعر الأساسي",
    capacity: "السعة",
    status: "الحالة",
    actions: "الإجراءات",
    searchPlaceholder: "البحث بالرحلة، المطار أو شركة الطيران...",
    tryFilters: "حاول تغيير خيارات التصفية.",
    createTripDraftBtn: "أنشئ أول مسودة رحلة للبدء.",
    unfinishedDraft: "تم حفظ مسودة غير مكتملة",
    draftSafeMessage: "تغييراتك محفوظة على هذا الجهاز ويمكنك المتابعة من حيث توقفت.",
    continueEditing: "متابعة التعديل",
    discardWorkingCopy: "حذف النسخة المؤقتة",
    untitledDraft: "رحلة بدون عنوان",
    discardConfirm: "هل أنت متأكد من حذف النسخة المؤقتة لهذه المسودة؟"
  },
  en: {
    tripCatalogue: "Trip catalogue",
    trips: "Trips",
    createSubmitOperate: "Create, submit and operate every Umrah departure from one workspace.",
    createNewTrip: "Create new trip",
    totalTrips: "Total trips",
    published: "Published",
    underReview: "Under review",
    reservedSeats: "Reserved seats",
    searchTripCarrier: "Search trip or carrier…",
    allStatus: "All Status",
    allTiers: "All Tiers",
    selectDepartureDate: "Select departure date",
    duplicate: "Duplicate",
    editTrip: "Edit trip",
    allTrips: "All trips",
    overview: "Overview",
    bookings: "Bookings",
    travellers: "Travellers",
    documents: "Documents",
    financials: "Financials",
    loadingTrips: "Loading trip operations…",
    adminFeedback: "Admin feedback",
    resolveFeedback: "Resolve feedback",
    noTripsFound: "No trips found.",
    noTripsDesc: "Create a trip draft to begin building your Tawaf catalogue.",
    allStatusesLabel: "All statuses",
    allTiersLabel: "All tiers",
    draft: "Draft",
    changesRequested: "Changes requested",
    paused: "Paused",
    soldOut: "Sold out",
    expired: "Expired",
    economy: "Economy",
    standard: "Standard",
    vip: "VIP",
    tripName: "Trip",
    departureAirport: "Departure",
    duration: "Duration",
    startingPrice: "Starting price",
    capacity: "Capacity",
    status: "Status",
    actions: "Actions",
    searchPlaceholder: "Search by trip, airport or airline…",
    tryFilters: "Try changing the filters.",
    createTripDraftBtn: "Create your first Umrah trip draft to get started.",
    unfinishedDraft: "Unfinished trip draft saved",
    draftSafeMessage: "Your changes are safe on this device, and you can continue where you stopped.",
    continueEditing: "Continue editing",
    discardWorkingCopy: "Discard working copy",
    untitledDraft: "Untitled trip",
    discardConfirm: "Discard the temporary working copy of this draft?"
  }
};

const wizardT = {
  ku: {
    steps: [
      ["بنەڕەتەکان", "ناسنامەی گەشت، بەروارەکان و توانا"],
      ["گەشتوگوزار", "فڕین، پاس و گواستنەوەکان"],
      ["هۆتێلەکان", "مانەوە لە مەککە و مەدینە"],
      ["نرخ و خزمەتگوزاری", "نرخی پاکێج و خزمەتگوزارییە لەخۆگیراوەکان"],
      ["بەرنامە", "بەرنامەی ڕۆژانە و سیاسەتەکان"],
      ["پێداچوونەوە", "پێشبینینی عومرەکار و ناردن"],
    ],
    backToTrips: "گەڕانەوە بۆ گەشتەکان", proposingChanges: "پێشنیاری گۆڕانکاری گەشت", editingDraft: "دەستکاری ڕەشنووس", newTripDraft: "ڕەشنووسی گەشتی نوێ", untitled: "گەشتی عومرەی بێ ناونیشان",
    originalUnchanged: "ئەسڵەکە بەبێ گۆڕانکاری دەمێنێتەوە", savedLabel: "پاشەکەوت کرا", secureDraft: "ڕەشنووسی پارێزراو",
    requestChangesTag: "داواکاری گۆڕانکاری", createTripTag: "دروستکردنی گەشت", stepWord: "هەنگاوی", ofWord: "لە",
    adminProtected: "پارێزراوە لەلایەن بەڕێوەبەرەوە", adminNoteApproval: "گەشتە بڵاوکراوەکەت ناگۆڕدرێت هەتا تەواف ئەم داواکارییە پەسەند نەکات.", adminNoteNormal: "تەواف پێداچوونەوە بە هەموو گەشتێکدا دەکات پێش ئەوەی عومرەکاران بتوانن حجز بکەن.",
    tripIdentity: "ناسنامەی گەشت", tripIdentityDesc: "ناونیشانێکی ڕوون بەکاربهێنە کە عومرەکاران خێرا تێی بگەن.",
    tripTitle: "ناونیشانی گەشت *", tripTitlePh: "عومرەی ڕەمەزان لە هەولێرەوە", englishTitle: "ناونیشانی ئینگلیزی", arabicTitle: "ناونیشانی عەرەبی",
    packageTier: "ئاستی پاکێج", tierEconomy: "ئابووری", tierStandard: "ئاسایی", tierVip: "تایبەت (VIP)",
    tripType: "جۆری گەشت", typeGroup: "بە کۆمەڵ", typeFamily: "خێزانی", typeIndividual: "تاکەکەسی",
    season: "وەرز", seasonRegular: "ئاسایی", seasonRamadan: "ڕەمەزان", seasonShawwal: "شەوال", seasonOther: "هیتر",
    totalSeats: "کۆی شوێنەکان *",
    schedule: "خشتەی کات", scheduleDesc: "بەرواری گەشتە بڵاوکراوەکان دوای حجزکردن دەپارێزرێن.",
    departureDate: "بەرواری بەڕێکەوتن *", returnDate: "بەرواری گەڕانەوە *",
    primaryDescription: "پێناسەی سەرەکی *", primaryDescriptionPh: "ئەزموونی گەشتەکە، بۆ کێیە و باشییە سەرەکییەکانی ڕوون بکەرەوە…",
    englishDescription: "پێناسەی ئینگلیزی", arabicDescription: "پێناسەی عەرەبی",
    mainImage: "وێنەی سەرەکی گەشت", mainImageDesc: "وێنەیەکی بەرز و پانی جوان هەڵبژێرە — لەگەڵ هەڵبژاردنەکەدا ڕەشنووسەکە خۆکارانە پاشەکەوت دەبێت.",
    imageReady: "وێنەی گەشت ئامادەیە", addCover: "وێنەی بەرگی گەشت زیاد بکە", imageHint: "JPG، PNG یان WebP · زۆرترین ٦ MB",
    replaceImage: "گۆڕینی وێنە", uploadImage: "بارکردنی وێنە",
    transportTitle: "گواستنەوەی سەرەکی", transportDesc: "گەشتە سەرەکییەکە هەڵبژێرە و وردەکارییە دڵنیاکراوەکان بنووسە کاتێک بەردەستن.",
    byPlane: "بە فڕۆکە", byPlaneSub: "بەڕێکەوتن لە فڕۆکەخانە لەگەڵ زانیاری هێڵی ئاسمانی", byCoach: "بە پاس", byCoachSub: "گەشتی وشکانی لەگەڵ زانیاری شوێنی کۆبوونەوە",
    departureAirport: "فڕۆکەخانەی بەڕێکەوتن", airline: "هێڵی ئاسمانی", airlinePh: "هێڵە ئاسمانییەکانی عێراق", flightType: "جۆری فڕین", flightDirect: "ڕاستەوخۆ", flightConnecting: "بە وچان",
    busCompany: "کۆمپانیای پاس", busCompanyPh: "ناوی کۆمپانیای پاسەکە", pickupPoint: "شوێنی هەڵگرتن", pickupPointPh: "ناونیشانی وردی شوێنی بەڕێکەوتن…",
    transportNotes: "تێبینییەکانی گواستنەوە", transportNotesPh: "کاتی فڕین، جانتاکان، شوێنەکانی کۆبوونەوە یان زانیاری کە دواتر ڕادەگەیەنرێت…",
    busBetween: "پاس لە نێوان شارەکان", busBetweenSub: "گواستنەوەی مەککە و مەدینە لەخۆگیراوە", airportTransfers: "گواستنەوەی فڕۆکەخانە", airportTransfersSub: "گواستنەوەی گەیشتن و گەڕانەوە لەخۆگیراوە",
    hotelsTitle: "هۆتێلەکان و مانەوە", hotelsDesc: "هەردوو هۆتێلەکە پێویستیان بە پێناسەی ڕوونە پێش پێداچوونەوەی بەڕێوەبەر.",
    makkahHotel: "هۆتێلی مەککە", madinahHotel: "هۆتێلی مەدینە", makkahSub: "مانەوەی سەرەکی عومرە", madinahSub: "سەردانی مەدینە",
    hotelName: "ناوی هۆتێل *", starRating: "پلەی ئەستێرە", starsWord: "ئەستێرە", nights: "شەو", distanceHaram: "دووری لە حەرەمەوە (مەتر)", distanceNabawi: "دووری لە مزگەوتی نەبەویەوە (مەتر)",
    hotelDescription: "پێناسەی هۆتێل *", hotelDescriptionPh: "شوێن، ژوورەکان، ژەمەکان و زانیاری گواستنەوە…",
    priceTitle: "نرخی پاکێج", priceDesc: "یەک نرخی تەواو بۆ هەر عومرەکارێک دابنێ. مانەوەی هۆتێل پێشتر لە پاکێجەکەدا لەخۆگیراوە.",
    pricePerPilgrim: "نرخ بۆ هەر عومرەکارێک (IQD) *", depositAmount: "پێشەکی هەڵوەشاندنەوە بۆ هەر عومرەکارێک (IQD)", mealsPerDay: "ژەم لە ڕۆژێکدا", depositTerms: "مەرجەکانی پێشەکی هەڵوەشاندنەوە", depositTermsPh: "ڕوون بکەرەوە کە پێشەکی هەڵوەشاندنەوە کەی دەگیرێت یان دەگەڕێندرێتەوە…",
    servicesTitle: "خزمەتگوزارییە لەخۆگیراوەکان", servicesDesc: "بە ڕوونی پیشانی عومرەکارانی بدە نرخەکەیان چی دەگرێتەوە.",
    customerPrice: "نرخی کڕیار", customerPriceSub: "نرخی تەواوی پاکێج", tawafCommission: "کاشی تەواف", tawafCommissionSub: "خەمڵێنراو بە ٥٪", companyNet: "خەمڵێنراوی داهاتی کۆمپانیا", companyNetSub: "پێش کرێی دەروازەی پارەدان",
    itineraryTitle: "بەرنامەی ڕۆژانە", itineraryDesc: "هەر ڕۆژێک کورت، بەسوود و ئاسان بێت بۆ خوێندنەوەی عومرەکاران.",
    dayWord: "ڕۆژی", dayTitlePh: "گەیشتن و چوونەژوورەوەی هۆتێل", daySummaryPh: "چالاکییە سەرەکییەکان باس بکە…", addDay: "زیادکردنی ڕۆژ", 
    policiesTitle: "سیاسەتەکان", policiesDesc: "سیاسەتی هەڵوەشاندنەوە پێویستە پێش پێداچوونەوە.",
    cancellationPolicy: "سیاسەتی هەڵوەشاندنەوە و گەڕاندنەوەی پارە *", cancellationPolicyPh: "کاتە دیاریکراوەکان، کرێکان، گەڕاندنەوەی پارە و مەرجەکانی ڕەتکردنەوەی ڤیزا ڕوون بکەرەوە…",
    videoUrl: "بەستەری ڤیدیۆی ناساندن", nonRefundable: "پێشەکی هەڵوەشاندنەوە ناگەڕێندرێتەوە", nonRefundableSub: "دڵنیابە ئەمە بە ڕوونی لە سیاسەتەکەدا باسکراوە.",
    startingFrom: "دەستپێدەکات لە", viewPackage: "بینینی پاکێج", daysWord: "ڕۆژ", seatsWord: "شوێن",
    readyTitle: "ئامادەیە بۆ پێداچوونەوەی تەواف؟", readySub: "هەموو بەشە داواکراوەکان تەواو بکە",
    submitNote: "دوای ناردن، بڵاوکردنەوەی ڕاستەوخۆ دادەخرێت. بەڕێوەبەرانی تەواف گەشتەکە پەسەند دەکەن یان داوای گۆڕانکاری دەکەن.",
    previewFallbackTitle: "گەشتی عومرەکەت", previewFallbackDesc: "پێناسەی گەشتەکەت لێرەدا دەردەکەوێت.",
    previous: "پێشوو", cancel: "پاشگەزبوونەوە", saveDraftBtn: "پاشەکەوتکردنی ڕەشنووس", nextBtn: "دواتر", continueBtn: "بەردەوامبوون",
    submitBtn: "ناردن بۆ پێداچوونەوە", requestApprovalBtn: "داوای پەسەندکردنی بەڕێوەبەر",
    incVisa: "مامەڵەی ڤیزا", incFlight: "فڕینەکان", incTransport: "گواستنەوە بە پاس", incMakkahHotel: "هۆتێلی مەککە", incMadinahHotel: "هۆتێلی مەدینە", incMeals: "ژەمەکان", incAirportTransfer: "گواستنەوەی فڕۆکەخانە", incGuide: "ڕێبەری ئایینی", incZiyarat: "گەشتی زیارەتەکان", incSupport: "پشتیوانی کڕیاران",
    cTitleDesc: "ناونیشان و پێناسە", cDates: "بەرواری بەڕێکەوتن و گەڕانەوەی داهاتوو", cCapPrice: "توانا و نرخی پاکێج", cHotels: "هۆتێلەکانی مەککە و مەدینە", cItinerary: "بەرنامەی ڕۆژانە", cServices: "خزمەتگوزارییە لەخۆگیراوەکان", cPolicy: "سیاسەتی هەڵوەشاندنەوە",
    errTitle: "پێش پاشەکەوتکردن ناونیشانی گەشت زیاد بکە.", errTitleImage: "پێش بارکردنی وێنە ناونیشانی گەشت زیاد بکە.", errImageType: "وێنەیەکی JPG، PNG یان WebP هەڵبژێرە کە لە ٦ MB کەمتر بێت.",
    toastDraftSaved: "ڕەشنووسی گەشت پاشەکەوت کرا.", toastProgressSaved: "پێشکەوتنی ڕەشنووس پاشەکەوت کرا.", toastSubmitted: "گەشتەکە نێردرا بۆ پێداچوونەوەی تەواف.", toastChangesSent: "گۆڕانکارییەکانی گەشت نێردران بۆ پەسەندکردنی بەڕێوەبەر.",
    livePreviewTag: "پێشبینینی ڕاستەقینە", livePreviewHint: "ئەمە بەو شێوەیەیە کە عومرەکاران گەشتەکەت پێی دەبینن. کرتە لەسەر هەر بەهایەک بکە بۆ دەستکاریکردنی.",
    overviewTitle: "پوختە", accommodationTitle: "شوێنی مانەوە", transportationTitle: "گواستنەوە", includedTitle: "ئەوەی لەخۆگیراوە", trustTitle: "متمانە، سیاسەت و پارەدان",
    packagePerPerson: "پاکێج (بۆ هەر کەسێک)", totalFrom: "کۆی گشتی دەستپێدەکات لە", bookThisTrip: "حجزکردنی ئەم گەشتە",
    hotelWord: "هۆتێل", seatsRemaining: "شوێن ماوە", onlyLeftWord: "تەنها ماوە", onlySeatsLeft: "تەنها {count} شوێن ماوە", seatsBookedNote: "{count} شوێن حجزکراون — ناتوانرێت لەمە کەمتر بێت.", internalTitle: "زانیاری ناوخۆیی", internalHint: "بۆ عومرەکاران نیشان نادرێت. گەڕان لە ئەپەکەدا بەکاریان دەهێنێت.", capacityLabel: "ژمارەی شوێنەکان", soldOutWord: "تەواو بوو", clickToEdit: "کرتە بکە بۆ دەستکاریکردن", groundTransfersIncluded: "هەموو گواستنەوەکانی زەوی لەخۆگیراون",
    topRatedBadge: "باشترین هەڵسەنگاندن", premiumBadge: "هاوبەشی تایبەت", fastResponderBadge: "خێرا وەڵامدەرەوە", verifiedBadge: "پشتڕاستکراوە",
  },
  ar: {
    steps: [
      ["الأساسيات", "هوية الرحلة والتواريخ والسعة"],
      ["الرحلة", "الطيران والحافلات والتنقلات"],
      ["الفنادق", "الإقامة في مكة والمدينة"],
      ["السعر والخدمات", "سعر الباقة والخدمات المشمولة"],
      ["البرنامج", "البرنامج اليومي والسياسات"],
      ["المراجعة", "معاينة المعتمر والإرسال"],
    ],
    backToTrips: "العودة إلى الرحلات", proposingChanges: "اقتراح تغييرات على الرحلة", editingDraft: "تعديل المسودة", newTripDraft: "مسودة رحلة جديدة", untitled: "رحلة عمرة بدون عنوان",
    originalUnchanged: "النسخة الأصلية تبقى دون تغيير", savedLabel: "تم الحفظ", secureDraft: "مسودة آمنة",
    requestChangesTag: "طلب تغييرات", createTripTag: "إنشاء رحلة", stepWord: "الخطوة", ofWord: "من",
    adminProtected: "محمي من قبل المشرف", adminNoteApproval: "لن تتغير رحلتك المنشورة حتى يوافق طواف على هذا الطلب.", adminNoteNormal: "يراجع طواف كل رحلة قبل أن يتمكن المعتمرون من حجزها.",
    tripIdentity: "هوية الرحلة", tripIdentityDesc: "استخدم عنواناً واضحاً يفهمه المعتمرون بسرعة.",
    tripTitle: "عنوان الرحلة *", tripTitlePh: "عمرة رمضان من أربيل", englishTitle: "العنوان بالإنجليزية", arabicTitle: "العنوان بالعربية",
    packageTier: "فئة الباقة", tierEconomy: "اقتصادية", tierStandard: "عادية", tierVip: "مميزة (VIP)",
    tripType: "نوع الرحلة", typeGroup: "جماعية", typeFamily: "عائلية", typeIndividual: "فردية",
    season: "الموسم", seasonRegular: "عادي", seasonRamadan: "رمضان", seasonShawwal: "شوال", seasonOther: "آخر",
    totalSeats: "إجمالي المقاعد *",
    schedule: "الجدول الزمني", scheduleDesc: "تصبح تواريخ الرحلات المنشورة محمية بعد الحجوزات.",
    departureDate: "تاريخ المغادرة *", returnDate: "تاريخ العودة *",
    primaryDescription: "الوصف الأساسي *", primaryDescriptionPh: "اشرح تجربة الرحلة والجمهور والمزايا الرئيسية…",
    englishDescription: "الوصف بالإنجليزية", arabicDescription: "الوصف بالعربية",
    mainImage: "الصورة الرئيسية للرحلة", mainImageDesc: "اختر صورة أفقية عالية الجودة — سيتم حفظ المسودة تلقائياً عند الاختيار.",
    imageReady: "صورة الرحلة جاهزة", addCover: "أضف غلاف الرحلة", imageHint: "JPG أو PNG أو WebP · بحد أقصى ٦ MB",
    replaceImage: "استبدال الصورة", uploadImage: "رفع الصورة",
    transportTitle: "النقل الرئيسي", transportDesc: "اختر الرحلة الأساسية وأدخل التفاصيل المؤكدة عند توفرها.",
    byPlane: "بالطائرة", byPlaneSub: "مغادرة من المطار مع تفاصيل شركة الطيران", byCoach: "بالحافلة", byCoachSub: "رحلة برية مع تفاصيل نقطة الانطلاق",
    departureAirport: "مطار المغادرة", airline: "شركة الطيران", airlinePh: "الخطوط الجوية العراقية", flightType: "نوع الرحلة", flightDirect: "مباشرة", flightConnecting: "مع توقف",
    busCompany: "شركة الحافلات", busCompanyPh: "اسم شركة الحافلات", pickupPoint: "نقطة الانطلاق", pickupPointPh: "العنوان الدقيق لنقطة الانطلاق…",
    transportNotes: "ملاحظات النقل", transportNotesPh: "مواعيد الطيران، الأمتعة، نقاط الانطلاق أو معلومات ستُعلن لاحقاً…",
    busBetween: "حافلة بين المدن", busBetweenSub: "نقل مكة والمدينة مشمول", airportTransfers: "نقل المطار", airportTransfersSub: "نقل الوصول والمغادرة مشمول",
    hotelsTitle: "الفنادق والإقامة", hotelsDesc: "كلا الفندقين يحتاجان وصفاً واضحاً قبل مراجعة المشرف.",
    makkahHotel: "فندق مكة", madinahHotel: "فندق المدينة", makkahSub: "الإقامة الأساسية للعمرة", madinahSub: "زيارة المدينة",
    hotelName: "اسم الفندق *", starRating: "تصنيف النجوم", starsWord: "نجوم", nights: "ليالٍ", distanceHaram: "المسافة عن الحرم (متر)", distanceNabawi: "المسافة عن المسجد النبوي (متر)",
    hotelDescription: "وصف الفندق *", hotelDescriptionPh: "الموقع والغرف والوجبات ومعلومات النقل…",
    priceTitle: "سعر الباقة", priceDesc: "حدد سعراً كاملاً واحداً لكل معتمر. الإقامة الفندقية مشمولة في الباقة.",
    pricePerPilgrim: "السعر لكل معتمر (IQD) *", depositAmount: "عربون الإلغاء لكل معتمر (IQD)", mealsPerDay: "الوجبات في اليوم", depositTerms: "شروط عربون الإلغاء", depositTermsPh: "اشرح متى يُحتفظ بعربون الإلغاء أو يُسترد…",
    servicesTitle: "الخدمات المشمولة", servicesDesc: "أظهر للمعتمرين بوضوح ما يغطيه السعر.",
    customerPrice: "سعر العميل", customerPriceSub: "سعر الباقة الكامل", tawafCommission: "عمولة طواف", tawafCommissionSub: "تقديرياً ٥٪", companyNet: "صافي الشركة التقديري", companyNetSub: "قبل رسوم بوابة الدفع",
    itineraryTitle: "البرنامج اليومي", itineraryDesc: "اجعل كل يوم قصيراً ومفيداً وسهل القراءة للمعتمرين.",
    dayWord: "اليوم", dayTitlePh: "الوصول وتسجيل الدخول في الفندق", daySummaryPh: "صف الأنشطة الرئيسية…", addDay: "إضافة يوم",
    policiesTitle: "السياسات", policiesDesc: "سياسة الإلغاء مطلوبة قبل المراجعة.",
    cancellationPolicy: "سياسة الإلغاء والاسترداد *", cancellationPolicyPh: "اشرح المواعيد النهائية والرسوم والاسترداد وشروط رفض التأشيرة…",
    videoUrl: "رابط فيديو تعريفي", nonRefundable: "عربون الإلغاء غير قابل للاسترداد", nonRefundableSub: "تأكد من شرح ذلك بوضوح في السياسة.",
    startingFrom: "يبدأ من", viewPackage: "عرض الباقة", daysWord: "أيام", seatsWord: "مقاعد",
    readyTitle: "جاهز لمراجعة طواف؟", readySub: "أكمل كل قسم مطلوب",
    submitNote: "الإرسال يمنع النشر المباشر. سيوافق مشرفو طواف على الرحلة أو يطلبون تغييرات.",
    previewFallbackTitle: "رحلة العمرة الخاصة بك", previewFallbackDesc: "سيظهر وصف رحلتك هنا.",
    previous: "السابق", cancel: "إلغاء", saveDraftBtn: "حفظ المسودة", nextBtn: "التالي", continueBtn: "متابعة",
    submitBtn: "إرسال للمراجعة", requestApprovalBtn: "طلب موافقة المشرف",
    incVisa: "معالجة التأشيرة", incFlight: "الطيران", incTransport: "النقل بالحافلة", incMakkahHotel: "فندق مكة", incMadinahHotel: "فندق المدينة", incMeals: "الوجبات", incAirportTransfer: "نقل المطار", incGuide: "مرشد ديني", incZiyarat: "جولات الزيارات", incSupport: "دعم العملاء",
    cTitleDesc: "العنوان والوصف", cDates: "تاريخا مغادرة وعودة مستقبليان", cCapPrice: "السعة وسعر الباقة", cHotels: "فندقا مكة والمدينة", cItinerary: "البرنامج اليومي", cServices: "الخدمات المشمولة", cPolicy: "سياسة الإلغاء",
    errTitle: "أضف عنوان الرحلة قبل حفظ المسودة.", errTitleImage: "أضف عنوان الرحلة قبل رفع الصورة.", errImageType: "اختر صورة JPG أو PNG أو WebP أصغر من ٦ MB.",
    toastDraftSaved: "تم حفظ مسودة الرحلة.", toastProgressSaved: "تم حفظ تقدم المسودة.", toastSubmitted: "تم إرسال الرحلة لمراجعة طواف.", toastChangesSent: "تم إرسال تغييرات الرحلة لموافقة المشرف.",
    livePreviewTag: "معاينة حية", livePreviewHint: "هذا بالضبط كيف سيرى المعتمرون رحلتك. انقر على أي قيمة لتعديلها.",
    overviewTitle: "نظرة عامة", accommodationTitle: "الإقامة", transportationTitle: "النقل", includedTitle: "ما يشمله السعر", trustTitle: "الثقة والسياسة والدفع",
    packagePerPerson: "الباقة (للفرد)", totalFrom: "الإجمالي يبدأ من", bookThisTrip: "احجز هذه الرحلة",
    hotelWord: "فندق", seatsRemaining: "مقعد متبقٍ", onlyLeftWord: "تبقى فقط", onlySeatsLeft: "تبقى {count} مقاعد فقط", seatsBookedNote: "{count} مقعد محجوز — لا يمكن النزول تحت هذا الرقم.", internalTitle: "بيانات داخلية", internalHint: "لا تظهر للمعتمرين. يستخدمها البحث في التطبيق.", capacityLabel: "عدد المقاعد", soldOutWord: "مكتملة", clickToEdit: "انقر للتعديل", groundTransfersIncluded: "جميع التنقلات البرية مشمولة",
    topRatedBadge: "الأعلى تقييماً", premiumBadge: "شريك مميز", fastResponderBadge: "سريع الاستجابة", verifiedBadge: "موثّق",
  },
  en: {
    steps: [
      ["Basics", "Trip identity, dates and capacity"],
      ["Journey", "Flights, buses and transfers"],
      ["Hotels", "Makkah and Madinah stay"],
      ["Price & inclusions", "Package price and included services"],
      ["Program", "Daily itinerary and policies"],
      ["Review", "Customer preview and submission"],
    ],
    backToTrips: "Back to trips", proposingChanges: "Proposing trip changes", editingDraft: "Editing draft", newTripDraft: "New trip draft", untitled: "Untitled Umrah trip",
    originalUnchanged: "Original stays unchanged", savedLabel: "Saved", secureDraft: "Secure draft",
    requestChangesTag: "REQUEST CHANGES", createTripTag: "CREATE TRIP", stepWord: "STEP", ofWord: "OF",
    adminProtected: "Admin protected", adminNoteApproval: "Your live trip will not change until Tawaf approves this request.", adminNoteNormal: "Tawaf reviews every trip before pilgrims can book it.",
    tripIdentity: "Trip identity", tripIdentityDesc: "Use a clear title pilgrims can understand quickly.",
    tripTitle: "Trip title *", tripTitlePh: "Ramadan Umrah from Erbil", englishTitle: "English title", arabicTitle: "Arabic title",
    packageTier: "Package tier", tierEconomy: "Economy", tierStandard: "Standard", tierVip: "VIP",
    tripType: "Trip type", typeGroup: "Group", typeFamily: "Family", typeIndividual: "Individual",
    season: "Season", seasonRegular: "Regular", seasonRamadan: "Ramadan", seasonShawwal: "Shawwal", seasonOther: "Other",
    totalSeats: "Total seats *",
    schedule: "Schedule", scheduleDesc: "Published trip dates become protected after bookings.",
    departureDate: "Departure date *", returnDate: "Return date *",
    primaryDescription: "Primary description *", primaryDescriptionPh: "Explain the trip experience, audience and main advantages…",
    englishDescription: "English description", arabicDescription: "Arabic description",
    mainImage: "Main trip image", mainImageDesc: "Pick a high-quality landscape image — the draft saves automatically when you choose one.",
    imageReady: "Trip image ready", addCover: "Add a trip cover", imageHint: "JPG, PNG or WebP · maximum 6 MB",
    replaceImage: "Replace image", uploadImage: "Upload image",
    transportTitle: "Main transportation", transportDesc: "Choose the primary journey and provide confirmed details when available.",
    byPlane: "By plane", byPlaneSub: "Airport departure with airline details", byCoach: "By coach", byCoachSub: "Overland departure with pickup details",
    departureAirport: "Departure airport", airline: "Airline", airlinePh: "Iraqi Airways", flightType: "Flight type", flightDirect: "Direct", flightConnecting: "Connecting",
    busCompany: "Bus company", busCompanyPh: "Name of the coach operator", pickupPoint: "Pickup point", pickupPointPh: "Exact address travellers depart from…",
    transportNotes: "Transport notes", transportNotesPh: "Flight timing, baggage, pickup locations or information to be announced…",
    busBetween: "Bus between cities", busBetweenSub: "Makkah and Madinah transfer included", airportTransfers: "Airport transfers", airportTransfersSub: "Arrival and departure transport included",
    hotelsTitle: "Hotels and stay", hotelsDesc: "Both hotels need a clear description before admin review.",
    makkahHotel: "Makkah hotel", madinahHotel: "Madinah hotel", makkahSub: "Primary Umrah stay", madinahSub: "Madinah visit",
    hotelName: "Hotel name *", starRating: "Star rating", starsWord: "stars", nights: "Nights", distanceHaram: "Distance from Haram (metres)", distanceNabawi: "Distance from the Prophet's Mosque (metres)",
    hotelDescription: "Hotel description *", hotelDescriptionPh: "Location, rooms, meals and shuttle information…",
    priceTitle: "Package price", priceDesc: "Set one complete price per pilgrim. Hotel accommodation is already included in the package.",
    pricePerPilgrim: "Price per pilgrim (IQD) *", depositAmount: "Cancellation deposit per pilgrim (IQD)", mealsPerDay: "Meals per day", depositTerms: "Cancellation deposit terms", depositTermsPh: "Explain when the cancellation deposit is retained or refunded…",
    servicesTitle: "Included services", servicesDesc: "Clearly show pilgrims what their price covers.",
    customerPrice: "Customer price", customerPriceSub: "Complete package price", tawafCommission: "Tawaf commission", tawafCommissionSub: "Estimated at 5%", companyNet: "Estimated company net", companyNetSub: "Before gateway fees",
    itineraryTitle: "Daily itinerary", itineraryDesc: "Keep each day short, useful and easy for pilgrims to scan.",
    dayWord: "Day", dayTitlePh: "Arrival and hotel check-in", daySummaryPh: "Describe the main activities…", addDay: "Add itinerary day",
    policiesTitle: "Policies", policiesDesc: "A cancellation policy is required before review.",
    cancellationPolicy: "Cancellation and refund policy *", cancellationPolicyPh: "Explain deadlines, fees, refunds and visa rejection terms…",
    videoUrl: "Introduction video URL", nonRefundable: "Cancellation deposit is non-refundable", nonRefundableSub: "Make sure this is explained clearly in the policy.",
    startingFrom: "Starting from", viewPackage: "View package", daysWord: "days", seatsWord: "seats",
    readyTitle: "Ready for Tawaf review?", readySub: "Complete every required section",
    submitNote: "Submitting locks direct publishing. Tawaf administrators will approve the trip or request changes.",
    previewFallbackTitle: "Your Umrah trip", previewFallbackDesc: "Your trip description will appear here.",
    previous: "Previous", cancel: "Cancel", saveDraftBtn: "Save draft", nextBtn: "Next", continueBtn: "Continue",
    submitBtn: "Submit for review", requestApprovalBtn: "Request admin approval",
    incVisa: "Visa processing", incFlight: "Flights", incTransport: "Bus transportation", incMakkahHotel: "Makkah hotel", incMadinahHotel: "Madinah hotel", incMeals: "Meals", incAirportTransfer: "Airport transfers", incGuide: "Religious guide", incZiyarat: "Ziyarat tours", incSupport: "Customer support",
    cTitleDesc: "Title and description", cDates: "Future departure and return dates", cCapPrice: "Capacity and package price", cHotels: "Makkah and Madinah hotels", cItinerary: "Daily itinerary", cServices: "Included services", cPolicy: "Cancellation policy",
    errTitle: "Add a trip title before saving this draft.", errTitleImage: "Add a trip title before uploading a main image.", errImageType: "Choose a JPG, PNG or WebP image smaller than 6 MB.",
    toastDraftSaved: "Trip draft saved.", toastProgressSaved: "Draft progress saved.", toastSubmitted: "Trip submitted to Tawaf for admin review.", toastChangesSent: "Trip changes sent to Tawaf for admin approval.",
    livePreviewTag: "LIVE PREVIEW", livePreviewHint: "This is exactly how pilgrims will see your trip. Click any value to edit it.",
    overviewTitle: "Overview", accommodationTitle: "Accommodation", transportationTitle: "Transportation", includedTitle: "What's included", trustTitle: "Trust, policy & payment",
    packagePerPerson: "Package (per person)", totalFrom: "Total from", bookThisTrip: "Book this trip",
    hotelWord: "hotel", seatsRemaining: "seats remaining", onlyLeftWord: "Only left", onlySeatsLeft: "Only {count} seats left", seatsBookedNote: "{count} already booked — the total cannot go below this.", internalTitle: "Internal details", internalHint: "Not shown to pilgrims. Search in the app matches on these.", capacityLabel: "Seats on this trip", soldOutWord: "Sold out", clickToEdit: "Click to edit", groundTransfersIncluded: "All ground transfers included",
    topRatedBadge: "Top rated", premiumBadge: "Premium partner", fastResponderBadge: "Fast responder", verifiedBadge: "Verified",
  },
} as const;

const inclusionKeyToLabel: Record<string, keyof typeof wizardT.en> = {
  visa: "incVisa", flight: "incFlight", transport: "incTransport", makkah_hotel: "incMakkahHotel",
  madinah_hotel: "incMadinahHotel", meals: "incMeals", airport_transfer: "incAirportTransfer",
  guide: "incGuide", ziyarat: "incZiyarat", support: "incSupport",
};

const inclusionOptions = [
  ["visa", "Visa processing"],
  ["flight", "Flights"],
  ["transport", "Bus transportation"],
  ["makkah_hotel", "Makkah hotel"],
  ["madinah_hotel", "Madinah hotel"],
  ["meals", "Meals"],
  ["airport_transfer", "Airport transfers"],
  ["guide", "Religious guide"],
  ["ziyarat", "Ziyarat tours"],
  ["support", "Customer support"],
] as const;

function formatIqd(value: number | string | null | undefined) {
  return `${Math.round(Number(value ?? 0)).toLocaleString("en-US")} IQD`;
}

function isCashPending(booking: Booking) {
  return booking.pay_method === "cash"
    && isAwaitingBookingPayment(booking)
    && Number(booking.amount_paid_iqd) < Number(booking.total_iqd)
    && booking.pay_status !== "paid";
}

function isAwaitingBookingPayment(booking: Booking) {
  return booking.operational_stage === "awaiting_payment"
    || (booking.operational_stage === "confirmed" && booking.pay_status !== "paid");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string | null | undefined, locale: "ku" | "ar" | "en") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * Format as a local YYYY-MM-DD. toISOString() converts to UTC first, which
 * shifts the calendar day backwards for any positive-offset timezone (Iraq is
 * UTC+3), so it must not be used to render a plain date.
 */
function isoDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * review_trip_change rejects same-day departures, so accepting one here would
 * let a company submit a request no admin can ever approve.
 */
function earliestDepartureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return isoDate(date);
}

function addDays(value: string | null | undefined, days: number) {
  const base = value ? new Date(`${value}T00:00:00`) : new Date();
  base.setDate(base.getDate() + Math.max(1, days));
  return isoDate(base);
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function CashReceiptDialog({
  booking,
  locale,
  busy,
  onCancel,
  onSubmit,
}: {
  booking: Booking;
  locale: "ku" | "ar" | "en";
  busy: boolean;
  onCancel: () => void;
  onSubmit: (receiptNumber: string) => Promise<void>;
}) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const [receiptNumber, setReceiptNumber] = useState("");
  const location = [
    booking.cash_payment_location_name,
    booking.cash_payment_location_address,
    booking.cash_payment_location_hours,
  ].filter(Boolean).join(" · ");
  useScrollLock();

  return (
    <div
      className="portal-reason-scrim"
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <form
        className="portal-reason-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-cash-receipt-dialog-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape" && !busy) {
            event.preventDefault();
            onCancel();
          }
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (receiptNumber.trim() && !busy) void onSubmit(receiptNumber.trim());
        }}
      >
        <h2 id="trip-cash-receipt-dialog-title">{tr("تۆمارکردنی پسوڵەی نەختینە", "تسجيل إيصال الدفع النقدي", "Record cash receipt")}</h2>
        {location && (
          <p className="portal-receipt-location">
            <MapPin size={16} />
            <span>
              <b>{booking.cash_payment_location_type === "company_office"
                ? tr("نووسینگەی کۆمپانیا", "مكتب شركة السفر", "Travel company office")
                : tr("شوێنی پارەدانی ڕێگەپێدراوی تەواف", "موقع دفع معتمد من طواف", "Tawaf-authorized payment location")}</b>
              <small>{location}</small>
            </span>
          </p>
        )}
        <label className="portal-receipt-field">
          <span>{tr("ژمارەی پسوڵە", "رقم الإيصال", "Receipt number")}</span>
          <input
            autoFocus
            value={receiptNumber}
            onChange={(event) => setReceiptNumber(event.target.value)}
            placeholder={tr("ژمارەی پسوڵەکە بنووسە", "أدخل رقم الإيصال", "Enter the receipt number")}
            disabled={busy}
          />
        </label>
        <p className="portal-receipt-hint">{tr(
          "تەنها دوای وەرگرتنی پارە و دڵنیابوون لە پسوڵە پشتڕاستی بکەرەوە.",
          "أكد فقط بعد استلام المبلغ والتحقق من الإيصال.",
          "Confirm only after the cash has been received and the receipt verified.",
        )}</p>
        <div className="portal-reason-actions">
          <button type="button" className="portal-secondary-button" onClick={onCancel} disabled={busy}>
            {tr("پاشگەزبوونەوە", "إلغاء", "Cancel")}
          </button>
          <button type="submit" className="portal-primary-button" disabled={busy || !receiptNumber.trim()}>
            {busy ? <TawafLoadingSpinner size={14} /> : <BadgeCheck size={14} />}
            {tr("پشتڕاستکردنەوەی پارەدان", "تأكيد الدفع", "Confirm payment")}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Booking status as one label, derived from all four axes.
 *
 * `travellers` is deliberately optional: pass it where the rows are loaded, omit
 * it where they are not. Passing `[]` for "not loaded" would make every
 * confirmed booking read "Action needed" — see the note in
 * booking-display-state.ts.
 */
function BookingStatePill({ booking, travellers, locale }: {
  booking: { operational_stage: string; pay_status?: string | null; pay_method?: string | null };
  travellers?: Traveller[];
  locale: "ku" | "ar" | "en";
}) {
  const activeTravellers = travellers === undefined ? undefined : onlyActiveTravellers(travellers);
  const state = resolveBookingDisplayState({
    operationalStage: booking.operational_stage,
    paymentStatus: booking.pay_status,
    payMethod: booking.pay_method,
    documentStatuses: activeTravellers?.map((traveller) => traveller.document_status),
    visaStatuses: activeTravellers?.map((traveller) => traveller.visa_status),
  });
  return (
    <span className={`portal-status ${bookingStateTone(state)}`}>
      <i />{bookingStateLabel(state, locale)}
    </span>
  );
}

function statusTone(status: string) {
  if (["published", "confirmed", "completed", "approved"].includes(status)) return "positive";
  if (["rejected", "cancelled", "expired"].includes(status)) return "negative";
  if (["pending_review", "needs_changes", "requested", "awaiting_payment"].includes(status)) return "warning";
  return "neutral";
}

function Status({ value }: { value: string }) {
  return <span className={`portal-status ${statusTone(value)}`}><i />{titleCase(value)}</span>;
}

function defaultWizard(): WizardState {
  return {
    id: null,
    title: "",
    title_en: "",
    title_ar: "",
    overview: "",
    overview_en: "",
    overview_ar: "",
    package_tier: "standard",
    group_type: "group",
    season_tag: "regular",
    departure_date: "",
    return_date: "",
    capacity: "40",
    seats_reserved: 0,
    transport: "plane",
    departure_airport: "EBL",
    airline_name: "",
    flight_type: "direct",
    bus_company: "",
    pickup_point: "",
    bus_between_cities: true,
    airport_transfers: true,
    transport_notes: "",
    package_price_iqd: "",
    deposit_iqd: "0",
    non_refundable_deposit: false,
    deposit_terms: "",
    meals_per_day: "2",
    video_url: "",
    image_url: "",
    hotels: [
      { city: "makkah", name: "", description: "", star_rating: 4, nights: 5, distance_from_haram_m: 800 },
      { city: "madinah", name: "", description: "", star_rating: 4, nights: 4, distance_from_haram_m: 600 },
    ],
    inclusions: Object.fromEntries(inclusionOptions.map(([key]) => [key, ["visa", "flight", "makkah_hotel", "madinah_hotel", "support"].includes(key)])),
    itinerary: [{ day_no: 1, title: "", summary: "" }],
    cancellation_policy: "",
  };
}

type DraftRecovery = {
  version: 1;
  companyId: string;
  wizard: WizardState;
  step: number;
  updatedAt: number;
};

const TRIP_DRAFT_RECOVERY_PREFIX = "tawaf:trip-working-draft:v1:";

function tripDraftRecoveryKey(companyId: string) {
  return `${TRIP_DRAFT_RECOVERY_PREFIX}${companyId}`;
}

function readTripDraftRecovery(companyId: string): DraftRecovery | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(tripDraftRecoveryKey(companyId)) ?? "null") as Partial<DraftRecovery> | null;
    if (!parsed || parsed.version !== 1 || parsed.companyId !== companyId || !parsed.wizard) return null;
    const base = defaultWizard();
    const candidate = parsed.wizard as Partial<WizardState>;
    return {
      version: 1,
      companyId,
      wizard: {
        ...base,
        ...candidate,
        id: typeof candidate.id === "string" ? candidate.id : null,
        hotels: Array.isArray(candidate.hotels) ? candidate.hotels : base.hotels,
        inclusions: candidate.inclusions && typeof candidate.inclusions === "object"
          ? { ...base.inclusions, ...candidate.inclusions }
          : base.inclusions,
        itinerary: Array.isArray(candidate.itinerary) && candidate.itinerary.length
          ? candidate.itinerary
          : base.itinerary,
      },
      step: Number.isInteger(parsed.step) ? Math.max(0, Number(parsed.step)) : 0,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

function writeTripDraftRecovery(recovery: DraftRecovery) {
  try {
    window.localStorage.setItem(tripDraftRecoveryKey(recovery.companyId), JSON.stringify(recovery));
  } catch {
    // A browser can deny or exhaust local storage. Supabase/manual saves still
    // work, so recovery should never interrupt the trip editor.
  }
}

function isMeaningfulWorkingDraft(wizard: WizardState) {
  return JSON.stringify({ ...wizard, id: null }) !== JSON.stringify(defaultWizard());
}

function wizardFromTrip(trip: Trip, details: TripDetails): WizardState {
  const base = defaultWizard();
  const packagePrice = details.pricing.length
    ? Math.min(...details.pricing.map((row) => Number(row.price_iqd)))
    : Number(trip.price_iqd || 0);
  const hotels = (["makkah", "madinah"] as const).map((city) => {
    const row = details.hotels.find((item) => item.city === city);
    return {
      city,
      name: row?.hotels?.name ?? "",
      description: row?.hotels?.description ?? "",
      star_rating: row?.hotels?.star_rating ?? 4,
      nights: row?.nights ?? (city === "makkah" ? 5 : 4),
      distance_from_haram_m: row?.distance_from_haram_m ?? 700,
    };
  });
  return {
    ...base,
    id: trip.id,
    title: trip.title ?? "",
    title_en: trip.title_en ?? "",
    title_ar: trip.title_ar ?? "",
    overview: trip.overview ?? "",
    overview_en: trip.overview_en ?? "",
    overview_ar: trip.overview_ar ?? "",
    package_tier: (trip.package_tier as WizardState["package_tier"]) ?? "standard",
    group_type: (trip.group_type as WizardState["group_type"]) ?? "group",
    season_tag: (trip.season_tag as WizardState["season_tag"]) ?? "regular",
    departure_date: trip.departure_date ?? "",
    return_date: trip.return_date ?? "",
    capacity: String(trip.capacity ?? 40),
    seats_reserved: Number(trip.seats_reserved ?? 0),
    transport: trip.transport === "bus" ? "bus" : "plane",
    departure_airport: (trip.departure_airport as WizardState["departure_airport"]) ?? "EBL",
    airline_name: trip.airline_name ?? "",
    flight_type: (trip.flight_type as WizardState["flight_type"]) ?? "direct",
    bus_company: trip.transport === "bus" ? (trip.carrier ?? "") : "",
    pickup_point: trip.transfer_note ?? "",
    bus_between_cities: trip.bus_between_cities ?? true,
    airport_transfers: trip.airport_transfers ?? true,
    transport_notes: trip.transport_notes ?? "",
    package_price_iqd: packagePrice > 0 ? String(packagePrice) : "",
    deposit_iqd: String(trip.deposit_iqd ?? 0),
    non_refundable_deposit: trip.non_refundable_deposit ?? false,
    deposit_terms: trip.deposit_terms ?? "",
    meals_per_day: String(trip.meals_per_day ?? 2),
    video_url: trip.video_url ?? "",
    image_url: trip.image_url ?? "",
    hotels,
    inclusions: {
      ...base.inclusions,
      ...Object.fromEntries(details.inclusions.map((row) => [row.type, row.included])),
    },
    itinerary: details.itinerary.length
      ? details.itinerary.map((day) => ({ day_no: day.day_no, title: day.title, summary: day.summary ?? "" }))
      : base.itinerary,
    cancellation_policy: trip.cancellation_policy ?? "",
  };
}

export default function CompanyTripsWorkspace({ company, trips, changeRequests, bookings, bookingTravellers, commissions, payments, busy, runAction, askReason, locale }: Props) {
  const tt = tripTranslations[locale];
  const [view, setView] = useState<"list" | "manage" | "wizard" | "new-bookings">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<TripDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [tripPeriod, setTripPeriod] = useState<"active" | "past">("active");
  const [viewedBookingIds, setViewedBookingIds] = useState<Set<string>>(() => new Set());
  const [viewedBookingIdsLoaded, setViewedBookingIdsLoaded] = useState(false);
  const [tab, setTab] = useState<"overview" | "bookings" | "financials">("overview");
  const [wizard, setWizard] = useState<WizardState>(() => defaultWizard());
  const [step, setStep] = useState(0);
  const [wizardError, setWizardError] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [changeRequestMode, setChangeRequestMode] = useState(false);
  const [draftRecoveryMode, setDraftRecoveryMode] = useState(false);
  const [recoverableDraft, setRecoverableDraft] = useState<DraftRecovery | null>(() => readTripDraftRecovery(company.id));
  const [autoSaveRevision, setAutoSaveRevision] = useState(0);
  const latestRecoveryRef = useRef<DraftRecovery | null>(recoverableDraft);
  const lastAutoSavedRef = useRef("");
  const autoSavePromiseRef = useRef<Promise<string | null> | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  const selectedTrip = trips.find((trip) => trip.id === selectedId) ?? null;
  const selectedPendingRequest = changeRequests.find((request) => request.package_id === selectedId && request.status === "pending") ?? null;
  const selectedBookings = bookings.filter((booking) => booking.package_id === selectedId);
  const selectedBookingIds = new Set(selectedBookings.map((booking) => booking.id));

  // Switching views/tabs mounts new content in place without a route change, so
  // the browser keeps whatever scroll position the list or previous tab was at.
  // On mobile that can leave the new view opening with its top clipped under the
  // sticky topbar. Reset scroll on every view/tab change to land at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, tab]);

  const filteredTrips = useMemo(() => trips.filter((trip) => {
    const matchesQuery = `${trip.title} ${trip.departure_airport ?? ""} ${trip.airline_name ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || trip.lifecycle_status === statusFilter;
    const matchesTier = tierFilter === "all" || trip.package_tier === tierFilter;
    const matchesDate = !dateFilter || trip.departure_date === dateFilter;
    const ended = ["completed", "archived", "expired"].includes(trip.lifecycle_status)
      || Boolean(trip.return_date && trip.return_date < new Date().toISOString().slice(0, 10));
    const matchesPeriod = tripPeriod === "past" ? ended : !ended;
    return matchesQuery && matchesStatus && matchesTier && matchesDate && matchesPeriod;
  }).sort((a, b) => {
    // Until we actually know which bookings this company has opened, an empty
    // viewedBookingIds would make every trip look "unseen" and jump to the top,
    // then silently re-sort once the real data lands a moment later. Skip the
    // unseen-first tiebreak until that fetch resolves so the list is stable
    // from the first paint.
    const unseenA = viewedBookingIdsLoaded && bookings.some((booking) => booking.package_id === a.id && !viewedBookingIds.has(booking.id)) ? 1 : 0;
    const unseenB = viewedBookingIdsLoaded && bookings.some((booking) => booking.package_id === b.id && !viewedBookingIds.has(booking.id)) ? 1 : 0;
    if (tripPeriod === "active" && unseenA !== unseenB) return unseenB - unseenA;
    const aDate = a.departure_date ?? (tripPeriod === "active" ? "9999-12-31" : "0000-01-01");
    const bDate = b.departure_date ?? (tripPeriod === "active" ? "9999-12-31" : "0000-01-01");
    return tripPeriod === "active" ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
  }), [trips, bookings, viewedBookingIds, viewedBookingIdsLoaded, query, statusFilter, tierFilter, dateFilter, tripPeriod]);

  useEffect(() => {
    let active = true;
    async function loadBookingViews() {
      const supabase = getSupabase();
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) return;
      const result = await supabase
        .from("company_booking_views")
        .select("booking_id")
        .eq("company_id", company.id)
        .eq("user_id", userId);
      if (active && !result.error) {
        setViewedBookingIds(new Set((result.data ?? []).map((row) => row.booking_id as string)));
      }
      if (active) setViewedBookingIdsLoaded(true);
    }
    setViewedBookingIds(new Set());
    setViewedBookingIdsLoaded(false);
    void loadBookingViews();
    return () => { active = false; };
  }, [company.id]);

  async function setBookingViewed(bookingId: string, viewed: boolean) {
    setViewedBookingIds((current) => {
      const next = new Set(current);
      if (viewed) next.add(bookingId);
      else next.delete(bookingId);
      return next;
    });
    const result = await getSupabase().rpc("set_company_booking_view", {
      p_booking_id: bookingId,
      p_viewed: viewed,
    });
    if (result.error) {
      setViewedBookingIds((current) => {
        const next = new Set(current);
        if (viewed) next.delete(bookingId);
        else next.add(bookingId);
        return next;
      });
    }
  }

  useEffect(() => {
    if (view !== "wizard" || !draftRecoveryMode || changeRequestMode || !isMeaningfulWorkingDraft(wizard)) return;
    const recovery: DraftRecovery = {
      version: 1,
      companyId: company.id,
      wizard,
      step,
      updatedAt: Date.now(),
    };
    latestRecoveryRef.current = recovery;
    writeTripDraftRecovery(recovery);
    setRecoverableDraft(recovery);
    setSavedAt(new Date(recovery.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [wizard, step, view, draftRecoveryMode, changeRequestMode, company.id]);

  useEffect(() => () => {
    if (latestRecoveryRef.current?.companyId === company.id) {
      writeTripDraftRecovery(latestRecoveryRef.current);
    }
  }, [company.id]);

  useEffect(() => {
    const recovery = readTripDraftRecovery(company.id);
    latestRecoveryRef.current = recovery;
    setRecoverableDraft(recovery);
    lastAutoSavedRef.current = "";
  }, [company.id]);

  useEffect(() => {
    if (
      view !== "wizard"
      || !draftRecoveryMode
      || changeRequestMode
      || !wizard.title.trim()
    ) return;
    const serialized = JSON.stringify(wizard);
    if (serialized === lastAutoSavedRef.current) return;
    const timer = window.setTimeout(async () => {
      autoSaveTimerRef.current = null;
      if (autoSavePromiseRef.current) return;
      const task = (async () => {
        try {
          const payload = bundlePayload(wizard);
          const result = wizard.id
            ? await getSupabase().rpc("update_offer_bundle", {
                p_offer_id: wizard.id,
                p_fields: payload.fields,
                p_itinerary: payload.itinerary,
                p_pricing: payload.pricing,
                p_hotels: payload.hotels,
                p_inclusions: payload.inclusions,
              })
            : await getSupabase().rpc("create_offer_draft", {
                p_fields: payload.fields,
                p_itinerary: payload.itinerary,
                p_pricing: payload.pricing,
                p_hotels: payload.hotels,
                p_inclusions: payload.inclusions,
              });
          if (result.error) {
            lastAutoSavedRef.current = serialized;
            setWizardError(result.error.message);
            return null;
          }
          const id = wizard.id ?? result.data;
          const syncedWizard = id ? { ...wizard, id } : wizard;
          lastAutoSavedRef.current = JSON.stringify(syncedWizard);
          if (id && !wizard.id) {
            setWizard((current) => ({ ...current, id }));
            setSelectedId(id);
          }
          setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
          return id as string | null;
        } catch (cause) {
          lastAutoSavedRef.current = serialized;
          setWizardError(cause instanceof Error ? cause.message : "This draft could not be synced.");
          return null;
        }
      })();
      autoSavePromiseRef.current = task;
      await task;
      if (autoSavePromiseRef.current === task) autoSavePromiseRef.current = null;
      setAutoSaveRevision((current) => current + 1);
    }, 1200);
    autoSaveTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (autoSaveTimerRef.current === timer) autoSaveTimerRef.current = null;
    };
  }, [wizard, view, draftRecoveryMode, changeRequestMode, autoSaveRevision]);

  async function loadDetails(tripId: string) {
    setDetailsLoading(true);
    const supabase = getSupabase();
    const tripBookings = bookings.filter((booking) => booking.package_id === tripId);
    const bookingIds = tripBookings.map((booking) => booking.id);
    const [itineraryResult, pricingResult, hotelsResult, inclusionsResult, travellersResult, documentsResult] = await Promise.all([
      supabase.from("itinerary_days").select("*").eq("package_id", tripId).order("day_no"),
      supabase.from("offer_pricing").select("*").eq("offer_id", tripId).order("price_iqd"),
      supabase.from("offer_hotels").select("*, hotels(*)").eq("offer_id", tripId),
      supabase.from("offer_inclusions").select("*").eq("offer_id", tripId).order("sort_order"),
      bookingIds.length ? supabase.from("booking_travellers").select("*").in("booking_id", bookingIds).is("removed_at", null).order("created_at") : Promise.resolve({ data: [], error: null }),
      bookingIds.length ? supabase.from("traveller_documents").select("*").in("booking_id", bookingIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    ]);
    const firstError = [itineraryResult, pricingResult, hotelsResult, inclusionsResult, travellersResult, documentsResult].find((result) => result.error)?.error;
    if (firstError) {
      setWizardError(firstError.message ?? "Trip details could not be loaded.");
      setDetailsLoading(false);
      return null;
    }
    const next: TripDetails = {
      itinerary: (itineraryResult.data ?? []) as ItineraryDay[],
      pricing: (pricingResult.data ?? []) as PricingRow[],
      hotels: (hotelsResult.data ?? []) as HotelRow[],
      inclusions: (inclusionsResult.data ?? []) as InclusionRow[],
      travellers: (travellersResult.data ?? []) as Traveller[],
      documents: (documentsResult.data ?? []) as TravellerDocument[],
    };
    setDetails(next);
    setDetailsLoading(false);
    return next;
  }

  async function openManage(trip: Trip) {
    setSelectedId(trip.id);
    setTab("overview");
    setView("manage");
    setWizardError("");
    await loadDetails(trip.id);
  }

  async function openEdit(trip: Trip, duplicate = false) {
    const loaded = await loadDetails(trip.id);
    if (!loaded) return;
    const next = wizardFromTrip(trip, loaded);
    setWizard(duplicate ? { ...next, id: null, title: `${next.title} — Copy`, departure_date: "", return_date: "" } : next);
    setSelectedId(duplicate ? null : trip.id);
    setChangeRequestMode(!duplicate && !["draft", "needs_changes", "rejected"].includes(trip.lifecycle_status));
    setDraftRecoveryMode(duplicate);
    setStep(0);
    setWizardError("");
    setSavedAt("");
    setView("wizard");
  }

  function openCreate() {
    const recovery = readTripDraftRecovery(company.id) ?? recoverableDraft;
    setWizard(recovery?.wizard ?? defaultWizard());
    setSelectedId(recovery?.wizard.id ?? null);
    setChangeRequestMode(false);
    setDraftRecoveryMode(true);
    setStep(recovery?.step ?? 0);
    setWizardError("");
    setSavedAt(recovery
      ? new Date(recovery.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "");
    setView("wizard");
  }

  function clearWorkingDraft() {
    try {
      window.localStorage.removeItem(tripDraftRecoveryKey(company.id));
    } catch {
      // Keep the UI responsive even when browser storage is unavailable.
    }
    latestRecoveryRef.current = null;
    lastAutoSavedRef.current = "";
    setRecoverableDraft(null);
  }

  function discardWorkingDraft() {
    if (!window.confirm(tt.discardConfirm)) return;
    clearWorkingDraft();
    if (view === "wizard" && draftRecoveryMode) {
      setWizard(defaultWizard());
      setSelectedId(null);
      setStep(0);
      setSavedAt("");
      setWizardError("");
    }
  }

  function updateHotel(city: "makkah" | "madinah", patch: Partial<WizardHotel>) {
    setWizard((current) => ({ ...current, hotels: current.hotels.map((hotel) => hotel.city === city ? { ...hotel, ...patch } : hotel) }));
  }

  function bundlePayload(state: WizardState) {
    const nights = state.hotels.reduce((sum, hotel) => sum + Number(hotel.nights || 0), 0);
    const dayMs = state.departure_date && state.return_date
      ? Math.max(1, Math.round((new Date(state.return_date).getTime() - new Date(state.departure_date).getTime()) / 86_400_000) + 1)
      : nights + 1;
    const packagePrice = Number(state.package_price_iqd || 0);
    // offer_pricing enforces price_iqd > 0, so a draft saved before the price
    // step must send no pricing rows at all instead of zeros.
    const pricing = packagePrice > 0
      ? ["double", "triple", "quad"].map((occupancy_type) => ({
          occupancy_type,
          price_iqd: packagePrice,
        }))
      : [];
    return {
      fields: {
        company_id: company.id,
        title: state.title.trim() || "Untitled Umrah trip",
        title_en: state.title_en.trim() || null,
        title_ar: state.title_ar.trim() || null,
        overview: state.overview.trim() || "",
        overview_en: state.overview_en.trim() || null,
        overview_ar: state.overview_ar.trim() || null,
        price_iqd: packagePrice,
        days: dayMs,
        nights,
        transport: state.transport,
        carrier: (state.transport === "plane" ? state.airline_name.trim() : state.bus_company.trim()) || null,
        acc_stars: Math.max(...state.hotels.map((hotel) => Number(hotel.star_rating || 1))),
        capacity: Number(state.capacity || 0),
        departure_date: state.departure_date || null,
        return_date: state.return_date || null,
        image_url: state.image_url || null,
        room_occupancies: [2, 3, 4],
        package_tier: state.package_tier,
        group_type: state.group_type,
        season_tag: state.season_tag,
        departure_airport: state.transport === "plane" ? state.departure_airport : null,
        airline_name: state.transport === "plane" ? state.airline_name.trim() || null : null,
        flight_type: state.transport === "plane" ? state.flight_type : null,
        transfer_note: state.transport === "bus" ? state.pickup_point.trim() || null : null,
        bus_between_cities: state.bus_between_cities,
        // Airport transfers only make sense for flights.
        airport_transfers: state.transport === "plane" ? state.airport_transfers : false,
        transport_notes: state.transport_notes.trim() || null,
        meals_per_day: Number(state.meals_per_day || 0) || null,
        video_url: state.video_url.trim() || null,
        cancellation_policy: state.cancellation_policy.trim() || null,
        deposit_iqd: Number(state.deposit_iqd || 0),
        non_refundable_deposit: state.non_refundable_deposit,
        deposit_terms: state.deposit_terms.trim() || null,
        accepted_payment_methods: ["cash", "fib"],
      },
      itinerary: state.itinerary.filter((day) => day.title.trim()).map((day, index) => ({ day_no: index + 1, title: day.title.trim(), summary: day.summary.trim() || null })),
      pricing,
      hotels: state.hotels.filter((hotel) => hotel.name.trim()).map((hotel) => ({
        city: hotel.city,
        name: hotel.name.trim(),
        description: hotel.description.trim(),
        star_rating: Number(hotel.star_rating),
        nights: Number(hotel.nights),
        distance_from_haram_m: Number(hotel.distance_from_haram_m),
        photo_urls: [],
      })),
      inclusions: inclusionOptions.map(([type, label], index) => ({ type, included: Boolean(state.inclusions[type]), details: label, sort_order: index })),
    };
  }

  async function saveDraft(quiet = false, allowUntitled = false) {
    if (!allowUntitled && !wizard.title.trim()) {
      setWizardError(wizardT[locale].errTitle);
      setStep(0);
      return null;
    }
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const autoSavedId = await autoSavePromiseRef.current;
    setWizardError("");
    if (changeRequestMode) {
      setSavedAt("Ready for approval request");
      return wizard.id;
    }
    const payload = bundlePayload(wizard);
    const result = await runAction(
      "trip-wizard-save",
      () => (wizard.id ?? autoSavedId)
        ? getSupabase().rpc("update_offer_bundle", {
            p_offer_id: wizard.id ?? autoSavedId,
            p_fields: payload.fields,
            p_itinerary: payload.itinerary,
            p_pricing: payload.pricing,
            p_hotels: payload.hotels,
            p_inclusions: payload.inclusions,
          })
        : getSupabase().rpc("create_offer_draft", {
            p_fields: payload.fields,
            p_itinerary: payload.itinerary,
            p_pricing: payload.pricing,
            p_hotels: payload.hotels,
            p_inclusions: payload.inclusions,
          }),
      quiet ? wizardT[locale].toastProgressSaved : wizardT[locale].toastDraftSaved,
    );
    if (!result) return null;
    const id = wizard.id ?? autoSavedId ?? result.data;
    if (id) {
      setWizard((current) => ({ ...current, id }));
      setSelectedId(id);
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }
    return id as string | null;
  }

  const completion = useMemo(() => {
    const hotelNights = wizard.hotels.reduce((sum, hotel) => sum + Number(hotel.nights || 0), 0);
    const W = wizardT[locale];
    return [
      { label: W.cTitleDesc, done: Boolean(wizard.title.trim() && wizard.overview.trim()) },
      { label: W.cDates, done: Boolean(wizard.departure_date && wizard.return_date && wizard.departure_date >= earliestDepartureDate() && wizard.return_date >= wizard.departure_date) },
      { label: W.cCapPrice, done: Number(wizard.capacity) > 0 && Number(wizard.package_price_iqd) > 0 },
      { label: W.cHotels, done: wizard.hotels.every((hotel) => hotel.name.trim() && hotel.description.trim() && hotel.nights > 0) && hotelNights > 0 },
      { label: W.cItinerary, done: wizard.itinerary.some((day) => day.title.trim()) },
      { label: W.cServices, done: Object.values(wizard.inclusions).some(Boolean) },
      { label: W.cPolicy, done: Boolean(wizard.cancellation_policy.trim()) },
    ];
  }, [wizard, locale]);
  const canSubmit = completion.every((item) => item.done);

  async function submitForReview() {
    if (changeRequestMode) {
      if (!wizard.id || !canSubmit) return;
      const payload = bundlePayload(wizard);
      const result = await runAction(
        `trip-change-${wizard.id}`,
        () => getSupabase().rpc("request_trip_change", {
          p_package_id: wizard.id,
          p_request_type: "edit",
          p_fields: payload.fields,
          p_itinerary: payload.itinerary,
          p_pricing: payload.pricing,
          p_hotels: payload.hotels,
          p_inclusions: payload.inclusions,
          p_reason: null,
        }),
        wizardT[locale].toastChangesSent,
      );
      if (result) {
        if (draftRecoveryMode) clearWorkingDraft();
        setView("list");
        setSelectedId(null);
        setChangeRequestMode(false);
        setDraftRecoveryMode(false);
      }
      return;
    }
    const id = await saveDraft(true);
    if (!id || !canSubmit) return;
    const result = await runAction(
      `trip-${id}`,
      () => getSupabase().rpc("submit_package", { p_package_id: id }),
      wizardT[locale].toastSubmitted,
    );
    if (result) {
      clearWorkingDraft();
      setView("list");
      setSelectedId(null);
      setDraftRecoveryMode(false);
    }
  }

  async function uploadMainImage(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 6 * 1024 * 1024) {
      setWizardError(wizardT[locale].errImageType);
      return;
    }
    let draftId = wizard.id;
    if (!draftId) {
      draftId = await saveDraft(true, true);
      if (!draftId) return;
    }
    setUploadingImage(true);
    const path = changeRequestMode
      ? `${draftId}.change-${Date.now()}`
      : `${draftId}.cover`;
    const uploaded = await getSupabase().storage.from("package-images").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: true });
    if (uploaded.error) {
      setWizardError(uploaded.error.message);
      setUploadingImage(false);
      return;
    }
    const { data } = getSupabase().storage.from("package-images").getPublicUrl(path);
    const imageUrl = `${data.publicUrl}?v=${Date.now()}`;
    if (!changeRequestMode) {
      const persisted = await getSupabase()
        .from("packages")
        .update({ image_url: imageUrl })
        .eq("id", draftId);
      if (persisted.error) {
        setWizardError(persisted.error.message);
        setUploadingImage(false);
        return;
      }
    }
    setWizard((current) => ({ ...current, image_url: imageUrl }));
    setUploadingImage(false);
  }

  async function pauseTrip(trip: Trip) {
    const reason = await askReason(locale === "ku" ? "بۆچی حیجزکردن بۆ ئەم گەشتە دادەخەیت؟" : locale === "ar" ? "لماذا تغلق الحجوزات لهذه الرحلة؟" : "Why are you closing bookings for this trip?");
    if (!reason) return;
    await runAction(
      `trip-pause-${trip.id}`,
      () => getSupabase().rpc("pause_package", {
        p_package_id: trip.id,
        p_reason: reason,
      }),
      locale === "ku"
        ? "فرۆشتنی گەشت ڕاگیرا."
        : locale === "ar"
          ? "تم إيقاف مبيعات الرحلة."
          : "Trip sales paused.",
    );
  }

  async function resumeTrip(trip: Trip) {
    await runAction(
      `trip-resume-${trip.id}`,
      () => getSupabase().rpc("resume_package", { p_package_id: trip.id }),
      locale === "ku"
        ? "گەشتەکە دووبارە خرایەوە سەر فرۆشتن."
        : locale === "ar"
          ? "أعيدت الرحلة إلى البيع."
          : "Trip is back on sale.",
    );
  }

  async function deleteDraft(trip: Trip) {
    const confirmed = window.confirm(
      locale === "ku"
        ? `دڵنیایت لە سڕینەوەی «${trip.title}»؟ ئەم کارە ناگەڕێتەوە.`
        : locale === "ar"
          ? `هل أنت متأكد من حذف «${trip.title}»؟ لا يمكن التراجع عن ذلك.`
          : `Delete “${trip.title}”? This cannot be undone.`,
    );
    if (!confirmed) return;
    const result = await runAction(
      `trip-delete-${trip.id}`,
      () => getSupabase().from("packages").delete().eq("id", trip.id),
      locale === "ku" ? "گەشتەکە سڕایەوە." : locale === "ar" ? "تم حذف الرحلة." : "Trip deleted.",
    );
    if (result) {
      if (recoverableDraft?.wizard.id === trip.id) clearWorkingDraft();
      setView("list");
      setSelectedId(null);
    }
  }

  async function withdrawSubmission(trip: Trip) {
    await runAction(
      `trip-withdraw-${trip.id}`,
      () => getSupabase().rpc("withdraw_package", { p_package_id: trip.id }),
      locale === "ku"
        ? "گەشتەکە گەڕێندرایەوە بۆ ڕەشنووس."
        : locale === "ar"
          ? "تم سحب الرحلة وإعادتها إلى المسودة."
          : "Submission withdrawn and returned to draft.",
    );
  }

  async function adjustCapacity(trip: Trip) {
    const value = window.prompt(
      locale === "ku"
        ? "ژمارەی نوێی کۆی شوێنەکان بنووسە:"
        : locale === "ar"
          ? "أدخل السعة الإجمالية الجديدة:"
          : "Enter the new total trip capacity:",
      String(trip.capacity ?? Math.max(1, Number(trip.seats_reserved ?? 0) + 1)),
    );
    if (value === null) return;
    const capacity = Number(value);
    if (!Number.isInteger(capacity) || capacity <= Number(trip.seats_reserved ?? 0)) {
      window.alert(
        locale === "ku"
          ? "گونجایش دەبێت ژمارەیەکی تەواو و زیاتر لە شوێنە گیراوەکان بێت."
          : locale === "ar"
            ? "يجب أن تكون السعة رقماً صحيحاً أكبر من المقاعد المحجوزة."
            : "Capacity must be a whole number greater than reserved seats.",
      );
      return;
    }
    await runAction(
      `trip-capacity-${trip.id}`,
      () => getSupabase().rpc("adjust_package_capacity", {
        p_package_id: trip.id,
        p_capacity: capacity,
      }),
      locale === "ku"
        ? "گونجایشی گەشت نوێکرایەوە."
        : locale === "ar"
          ? "تم تحديث سعة الرحلة."
          : "Trip capacity updated.",
    );
  }

  if (view === "wizard") {
    return (
      <TripWizard
        wizard={wizard}
        setWizard={setWizard}
        error={wizardError}
        savedAt={savedAt}
        busy={busy}
        uploadingImage={uploadingImage}
        completion={completion}
        canSubmit={canSubmit}
        onBack={() => setView(wizard.id ? "manage" : "list")}
        onSave={() => saveDraft(false)}
        onSubmit={submitForReview}
        onUploadImage={uploadMainImage}
        updateHotel={updateHotel}
        approvalMode={changeRequestMode}
        company={company}
        locale={locale}
      />
    );
  }

  if (view === "new-bookings") {
    return (
      <>
        <div className="trip-manage-head">
          <button type="button" onClick={() => setView("list")}><ArrowLeft size={16} /> {tt.allTrips}</button>
        </div>
        <BookingInbox
          title={locale === "ku" ? "هەموو حیجزە نوێیەکان" : locale === "ar" ? "كل الحجوزات الجديدة" : "All new bookings"}
          subtitle={locale === "ku" ? "هەموو حیجزە نەکراوەکان لە گشت گەشتەکان" : locale === "ar" ? "كل الحجوزات غير المفتوحة عبر الرحلات" : "Every unopened booking across all trips"}
          bookings={bookings}
          trips={trips}
          travellers={onlyActiveTravellers(bookingTravellers)}
          viewedBookingIds={viewedBookingIds}
          onSetViewed={setBookingViewed}
          busy={busy}
          runAction={runAction}
          askReason={askReason}
          locale={locale}
          defaultFilter="new"
        />
      </>
    );
  }

  if (view === "manage" && selectedTrip) {
    const tripBookings = selectedBookings;
    const canEdit = !selectedPendingRequest
      && ["draft", "needs_changes", "rejected", "published", "paused", "sold_out"].includes(selectedTrip.lifecycle_status);
    return (
      <>
        <div className="trip-manage-head">
          <button type="button" onClick={() => setView("list")}><ArrowLeft size={16} /> {tt.allTrips}</button>
          <div className="trip-manage-actions">
            <button type="button" className="portal-secondary-button" onClick={() => openEdit(selectedTrip, true)}><Copy size={15} /> {tt.duplicate}</button>
            {canEdit && <button type="button" className="portal-primary-button" onClick={() => openEdit(selectedTrip)}><Pencil size={15} /> {tt.editTrip}</button>}
          </div>
        </div>

        <section className="trip-hero" style={selectedTrip.image_url ? { backgroundImage: `linear-gradient(90deg, rgba(5,42,34,.95), rgba(5,42,34,.55)), url("${selectedTrip.image_url}")` } : undefined}>
          <div>
            <span className="trip-hero-kicker">{locale === "ku" ? "ئاستی" : locale === "ar" ? "فئة" : ""}{" "}{tt[selectedTrip.package_tier as keyof typeof tt] || titleCase(selectedTrip.package_tier ?? "standard")}{" "}{locale === "ku" ? "پاکێجی عومرە" : locale === "ar" ? "باقة عمرة" : "Umrah package"}</span>
            <h1>{selectedTrip.title}</h1>
            <p><MapPin size={15} /> {selectedTrip.departure_airport || (locale === "ku" ? "فڕۆکەخانە دیاری دەکرێت" : locale === "ar" ? "المغادرة تحدد لاحقاً" : "Departure point TBA")} <span /> <CalendarDays size={15} /> {formatDate(selectedTrip.departure_date)}</p>
          </div>
          <div className="trip-hero-status"><Status value={selectedTrip.lifecycle_status} /><small>{locale === "ku" ? "کۆتا نوێکردنەوە" : locale === "ar" ? "آخر تحديث" : "Last updated"} {formatDate(selectedTrip.updated_at?.slice(0, 10) ?? selectedTrip.created_at.slice(0, 10))}</small></div>
        </section>

        {(selectedTrip.rejection_reason || selectedTrip.review_reason) && <div className={`trip-review-banner${selectedTrip.rejection_reason ? " rejected" : ""}`}><FileText size={19} /><div><b>{selectedTrip.rejection_reason ? (locale === "ku" ? "هۆکاری ڕەتکردنەوە" : locale === "ar" ? "سبب الرفض" : "Rejection reason") : tt.adminFeedback}</b><p>{selectedTrip.rejection_reason || selectedTrip.review_reason}</p></div>{canEdit && <button type="button" onClick={() => openEdit(selectedTrip)}>{tt.resolveFeedback}</button>}</div>}
        {selectedPendingRequest && <div className="trip-review-banner pending"><ShieldCheck size={19} /><div><b>Waiting for admin approval</b><p>Your {selectedPendingRequest.request_type} request is pending. The current trip stays unchanged until Tawaf reviews it.</p></div><Status value="pending" /></div>}

        <nav className="trip-tabs" aria-label="Trip management">
          {([
            ["overview", tt.overview, Eye],
            ["bookings", tt.bookings, BookOpenCheck],
            ["financials", tt.financials, WalletCards],
          ] as const).map(([id, label, Icon]) => (
            <button type="button" key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              <Icon size={16} /> {label}
              {id === "bookings" && tripBookings.length > 0 && <i>{tripBookings.length}</i>}
            </button>
          ))}
        </nav>

        {detailsLoading ? <div className="trip-detail-loading"><TawafLoadingSpinner size={22} /> {tt.loadingTrips}</div> : (
          <TripManagementTab
            tab={tab}
            trip={selectedTrip}
            details={details}
            bookings={tripBookings}
            allTrips={trips}
            bookingTravellers={onlyActiveTravellers(bookingTravellers).filter((traveller) => selectedBookingIds.has(traveller.booking_id))}
            viewedBookingIds={viewedBookingIds}
            onSetViewed={setBookingViewed}
            commissions={commissions.filter((item) => selectedBookingIds.has(item.booking_id))}
            payments={payments.filter((item) => selectedBookingIds.has(item.booking_id))}
            busy={busy}
            runAction={runAction}
            askReason={askReason}
            locale={locale}
            onEdit={() => openEdit(selectedTrip)}
            onSubmit={() => runAction(`trip-${selectedTrip.id}`, () => getSupabase().rpc("submit_package", { p_package_id: selectedTrip.id }), locale === "ku" ? "گەشتەکە پێشکەش کرا بۆ پێداچوونەوە." : locale === "ar" ? "تم إرسال الرحلة للمراجعة." : "Trip submitted for review.")}
            onPause={() => pauseTrip(selectedTrip)}
            onResume={() => resumeTrip(selectedTrip)}
            onDelete={() => deleteDraft(selectedTrip)}
            onWithdraw={() => withdrawSubmission(selectedTrip)}
            onAdjustSeats={() => adjustCapacity(selectedTrip)}
            canEdit={canEdit}
            hasPendingRequest={Boolean(selectedPendingRequest)}
          />
        )}
      </>
    );
  }

  const published = trips.filter((trip) => trip.lifecycle_status === "published").length;
  const underReview = trips.filter((trip) => trip.lifecycle_status === "pending_review").length;
  const pendingChangeTripIds = new Set(changeRequests.filter((request) => request.status === "pending").map((request) => request.package_id));
  const totalSeats = trips.reduce((sum, trip) => sum + Number(trip.capacity ?? 0), 0);
  const bookedSeats = trips.reduce((sum, trip) => sum + Number(trip.seats_reserved ?? 0), 0);
  const unseenBookings = viewedBookingIdsLoaded ? bookings.filter((booking) => !viewedBookingIds.has(booking.id)) : [];
  const allCashPending = bookings.filter(isCashPending);
  const today = new Date().toISOString().slice(0, 10);
  const activeTripCount = trips.filter((trip) => !["completed", "archived", "expired"].includes(trip.lifecycle_status) && !(trip.return_date && trip.return_date < today)).length;
  const pastTripCount = trips.length - activeTripCount;

  return (
    <>
      <div className="portal-page-heading">
        <div><p>{tt.tripCatalogue}</p><h1>{tt.trips}</h1><span>{tt.createSubmitOperate}</span></div>
        <button className="portal-primary-button" type="button" onClick={openCreate}><Plus size={16} /> {tt.createNewTrip}</button>
      </div>

      {recoverableDraft && (
        <section className="trip-draft-recovery">
          <span><Save size={19} /></span>
          <div>
            <b>{tt.unfinishedDraft}</b>
            <p>{recoverableDraft.wizard.title.trim() || tt.untitledDraft} · {tt.draftSafeMessage}</p>
          </div>
          <div className="trip-draft-recovery-actions">
            <button type="button" className="portal-primary-button" onClick={openCreate}><Pencil size={14} /> {tt.continueEditing}</button>
            <button type="button" className="portal-secondary-button" onClick={discardWorkingDraft}><Trash2 size={14} /> {tt.discardWorkingCopy}</button>
          </div>
        </section>
      )}

      <button type="button" className="trip-global-inbox" onClick={() => setView("new-bookings")}>
        <span><Inbox size={21} /></span>
        <div>
          <b>{locale === "ku" ? "هەموو حیجزە نوێیەکان" : locale === "ar" ? "كل الحجوزات الجديدة" : "All new bookings"}</b>
          <small>{locale === "ku" ? "حیجزە نەبینراوەکان لە گشت گەشتەکان" : locale === "ar" ? "الحجوزات غير المفتوحة عبر كل الرحلات" : "Unopened bookings across every trip"}</small>
        </div>
        <strong>{unseenBookings.length}</strong>
        {allCashPending.length > 0 && <em><Banknote size={13} /> {allCashPending.length} {locale === "ku" ? "نەختینە چاوەڕێیە" : locale === "ar" ? "نقد معلق" : "cash pending"}</em>}
        <ChevronRight size={18} />
      </button>

      <section className="trip-summary-grid">
        <div><span className="green"><Plane size={18} /></span><div><b>{trips.length}</b><small>{tt.totalTrips}</small></div></div>
        <div><span className="gold"><BadgeCheck size={18} /></span><div><b>{published}</b><small>{tt.published}</small></div></div>
        <div><span className="teal"><Clock3 size={18} /></span><div><b>{underReview}</b><small>{tt.underReview}</small></div></div>
        <div><span className="sand"><Users size={18} /></span><div><b>{bookedSeats}/{totalSeats || 0}</b><small>{tt.reservedSeats}</small></div></div>
      </section>

      <div className="trip-period-tabs" role="tablist" aria-label={locale === "en" ? "Trip period" : undefined}>
        <button type="button" role="tab" aria-selected={tripPeriod === "active"} className={tripPeriod === "active" ? "active" : ""} onClick={() => setTripPeriod("active")}>
          {locale === "ku" ? "چالاک" : locale === "ar" ? "النشطة" : "Active"} <span>{activeTripCount}</span>
        </button>
        <button type="button" role="tab" aria-selected={tripPeriod === "past"} className={tripPeriod === "past" ? "active" : ""} onClick={() => setTripPeriod("past")}>
          {locale === "ku" ? "پێشوو" : locale === "ar" ? "السابقة" : "Past"} <span>{pastTripCount}</span>
        </button>
      </div>

      <section className="trip-list-toolbar">
        <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tt.searchPlaceholder} /></label>
        <div><Filter size={15} />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">{locale === "ku" ? "هەموو دۆخەکان" : locale === "ar" ? "كل الحالات" : "All statuses"}</option>
            <option value="draft">{tt.draft}</option>
            <option value="needs_changes">{tt.changesRequested}</option>
            <option value="pending_review">{tt.underReview}</option>
            <option value="published">{tt.published}</option>
            <option value="paused">{tt.paused}</option>
            <option value="sold_out">{tt.soldOut}</option>
            <option value="rejected">{locale === "ku" ? "ڕەتکراوە" : locale === "ar" ? "مرفوض" : "Rejected"}</option>
            <option value="completed">{locale === "ku" ? "تەواوبوو" : locale === "ar" ? "مكتملة" : "Completed"}</option>
            <option value="archived">{locale === "ku" ? "ئەرشیفکراو" : locale === "ar" ? "مؤرشفة" : "Archived"}</option>
            <option value="expired">{tt.expired}</option>
          </select>
          <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)}>
            <option value="all">{locale === "ku" ? "هەموو ئاستەکان" : locale === "ar" ? "كل الفئات" : "All tiers"}</option>
            <option value="economy">{tt.economy}</option>
            <option value="standard">{tt.standard}</option>
            <option value="vip">{tt.vip}</option>
          </select>
          <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Departure date" />
        </div>
      </section>

      {filteredTrips.length ? (
        <section className="trip-card-grid">
          {filteredTrips.map((trip) => {
            const tripBookings = bookings.filter((booking) => booking.package_id === trip.id);
            const tripUnseen = viewedBookingIdsLoaded ? tripBookings.filter((booking) => !viewedBookingIds.has(booking.id)).length : 0;
            const tripCashPending = tripBookings.filter(isCashPending).length;
            const reserved = Number(trip.seats_reserved ?? 0);
            const capacity = Number(trip.capacity ?? 0);
            const fill = capacity ? Math.round((reserved / capacity) * 100) : 0;
            const tier = tt[trip.package_tier as keyof typeof tt] || titleCase(trip.package_tier ?? "standard");
            const group = locale === "ku"
              ? (trip.group_type === "family" ? "خێزانی" : trip.group_type === "individual" ? "تاکەکەسی" : "کۆمەڵە")
              : locale === "ar"
                ? (trip.group_type === "family" ? "عائلي" : trip.group_type === "individual" ? "فردي" : "مجموعة")
                : titleCase(trip.group_type ?? "group");
            return (
              <article
                className="trip-card"
                key={trip.id}
                role="button"
                tabIndex={0}
                onClick={() => openManage(trip)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openManage(trip); } }}
              >
                {/* Cover is a background image so a broken storage URL degrades to
                    the gradient and the plane glyph rather than a broken-image icon. */}
                <div className="trip-card-cover" style={trip.image_url ? { backgroundImage: `url("${trip.image_url}")` } : undefined}>
                  {!trip.image_url && <Plane size={22} />}
                  <div className="trip-card-status">
                    <Status value={trip.lifecycle_status} />
                    {pendingChangeTripIds.has(trip.id) && <span className="portal-status warning"><i />{locale === "ku" ? "چاوەڕێی پەسەندکردن" : locale === "ar" ? "بانتظار الموافقة" : "Awaiting approval"}</span>}
                  </div>
                  <div className="trip-card-alerts">
                    {tripUnseen > 0 && <span className="new"><i />{tripUnseen} {locale === "ku" ? "نوێ" : locale === "ar" ? "جديد" : "new"}</span>}
                    {tripCashPending > 0 && <span className="cash"><Banknote size={12} />{tripCashPending} {locale === "ku" ? "نەختینە" : locale === "ar" ? "نقد معلق" : "cash pending"}</span>}
                  </div>
                </div>
                <div className="trip-card-body">
                  <small className="trip-card-tier">{tier} · {group}</small>
                  <h3>{trip.title || tt.untitledDraft}</h3>
                  <div className="trip-card-meta">
                    <span><CalendarDays size={13} /> {trip.days} {locale === "ku" ? "ڕۆژ" : locale === "ar" ? "يوم" : "days"} · {trip.nights} {locale === "ku" ? "شەو" : locale === "ar" ? "ليلة" : "nights"}</span>
                    <span><Plane size={13} /> {trip.departure_airport || "TBA"}</span>
                  </div>
                  <div className="trip-card-facts">
                    <div><small>{locale === "ku" ? "بەڕێ کەوتن" : locale === "ar" ? "المغادرة" : "Departure"}</small><b>{formatDate(trip.departure_date)}</b></div>
                    <div><small>{locale === "ku" ? "گەڕانەوە" : locale === "ar" ? "العودة" : "Return"}</small><b>{formatDate(trip.return_date)}</b></div>
                    <div><small>{tt.startingPrice}</small><b>{formatIqd(trip.price_iqd)}</b></div>
                  </div>
                  <div className="trip-card-capacity">
                    <span><b>{reserved}</b> / {capacity || "—"} {tt.capacity}</span>
                    <small>{fill}%</small>
                    <i><b style={{ width: `${Math.min(100, fill)}%` }} /></i>
                  </div>
                  <div className="trip-card-actions" onClick={(event) => event.stopPropagation()}>
                    <button type="button" onClick={() => openManage(trip)}>
                      {locale === "ku" ? "بەڕێوەبردنی گەشت" : locale === "ar" ? "إدارة الرحلة" : "Manage trip"} <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="portal-panel trip-table-panel">
          <div className="trip-empty">
            <Plane size={24} />
            <h3>{tt.noTripsFound}</h3>
            <p>{trips.length ? tt.tryFilters : tt.createTripDraftBtn}</p>
            {!trips.length && <button type="button" onClick={openCreate}><Plus size={15} /> {tt.createNewTrip}</button>}
          </div>
        </section>
      )}
    </>
  );
}

type BookingInboxProps = {
  title: string;
  subtitle: string;
  bookings: Booking[];
  trips: Trip[];
  travellers: Traveller[];
  viewedBookingIds: Set<string>;
  onSetViewed: (bookingId: string, viewed: boolean) => Promise<void>;
  busy: string;
  runAction: Props["runAction"];
  askReason?: Props["askReason"];
  locale: "ku" | "ar" | "en";
  defaultFilter?: "all" | "new" | "cash" | "cancelled";
};

function BookingInbox({
  title,
  subtitle,
  bookings,
  trips,
  travellers,
  viewedBookingIds,
  onSetViewed,
  busy,
  runAction,
  askReason,
  locale,
  defaultFilter = "all",
}: BookingInboxProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "cash" | "cancelled">(defaultFilter);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [cashReceiptBooking, setCashReceiptBooking] = useState<Booking | null>(null);
  const gestureRef = useRef<{ booking: Booking; x: number; timer: number | null; longPressed: boolean } | null>(null);
  const suppressOpenRef = useRef(false);
  const activeTravellers = useMemo(() => onlyActiveTravellers(travellers), [travellers]);

  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId) ?? null;

  function bookingTravellers(bookingId: string) {
    return activeTravellers.filter((traveller) => traveller.booking_id === bookingId);
  }

  function clientName(booking: Booking) {
    const rows = bookingTravellers(booking.id);
    return rows.find((traveller) => traveller.is_lead)?.full_name
      || rows[0]?.full_name
      || (locale === "ku" ? "کڕیار" : locale === "ar" ? "العميل" : "Client");
  }

  function isCancelled(booking: Booking) {
    return ["cancelled", "rejected", "expired"].includes(booking.operational_stage);
  }

  const visibleBookings = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return bookings
      .filter((booking) => {
        const leadName = activeTravellers
          .filter((traveller) => traveller.booking_id === booking.id)
          .map((traveller) => `${traveller.full_name} ${traveller.phone ?? ""}`)
          .join(" ");
        const matchesSearch = !needle || `${leadName} ${booking.contact_phone ?? ""}`.toLocaleLowerCase().includes(needle);
        const matchesFilter = filter === "all"
          || (filter === "new" && !viewedBookingIds.has(booking.id))
          || (filter === "cash" && isCashPending(booking))
          || (filter === "cancelled" && isCancelled(booking));
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const cancelledDifference = Number(isCancelled(a)) - Number(isCancelled(b));
        if (cancelledDifference) return cancelledDifference;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [bookings, activeTravellers, viewedBookingIds, search, filter]);

  async function openBooking(booking: Booking) {
    if (suppressOpenRef.current) {
      suppressOpenRef.current = false;
      return;
    }
    setSelectedBookingId(booking.id);
    if (!viewedBookingIds.has(booking.id)) await onSetViewed(booking.id, true);
  }

  async function confirmCashReceipt(booking: Booking, receiptNumber: string) {
    if (!isCashPending(booking)) return;
    const result = await runAction(
      `booking-${booking.id}`,
      () => getSupabase().rpc("confirm_cash_receipt", {
        p_booking_id: booking.id,
        p_receipt_number: receiptNumber,
        p_amount_iqd: null,
      }),
      locale === "ku" ? "پسوڵە تۆمارکرا و حیجزەکە پشتڕاستکرایەوە." : locale === "ar" ? "تم تسجيل الإيصال وتأكيد الحجز." : "Receipt recorded and booking confirmed.",
    );
    if (result) setCashReceiptBooking(null);
  }

  function callBooking(booking: Booking) {
    if (booking.contact_phone) window.location.href = `tel:${booking.contact_phone}`;
  }

  function startGesture(event: ReactPointerEvent, booking: Booking) {
    // Long-press-to-mark-unread is touch-only. Cash confirmation deliberately
    // has no gesture: recording money must always pass through receipt proof.
    if (event.pointerType !== "touch") return;
    const state = { booking, x: event.clientX, timer: null as number | null, longPressed: false };
    state.timer = window.setTimeout(() => {
      state.longPressed = true;
      suppressOpenRef.current = true;
      void onSetViewed(booking.id, false);
    }, 650);
    gestureRef.current = state;
  }

  function endGesture(event: ReactPointerEvent) {
    const state = gestureRef.current;
    gestureRef.current = null;
    if (!state) return;
    if (state.timer !== null) window.clearTimeout(state.timer);
    if (state.longPressed) return;
    const distance = event.clientX - state.x;
    if (distance < -72 && state.booking.contact_phone) {
      suppressOpenRef.current = true;
      callBooking(state.booking);
    }
  }

  function cancelGesture() {
    const state = gestureRef.current;
    gestureRef.current = null;
    if (state?.timer != null) window.clearTimeout(state.timer);
  }

  function exportPassengerList() {
    const activeBookingIds = new Set(bookings.filter((booking) => !isCancelled(booking)).map((booking) => booking.id));
    const headers = [
      "Trip",
      "Departure",
      "Booking reference",
      "Passenger name",
      "Phone",
      "Gender",
      "Date of birth",
      "Nationality",
      "Passport number",
      "Passport expiry",
      "Visa status",
      "Payment method",
      "Payment status",
    ];
    const rows = activeTravellers
      .filter((traveller) => activeBookingIds.has(traveller.booking_id))
      .map((traveller) => {
        const booking = bookings.find((item) => item.id === traveller.booking_id);
        const trip = trips.find((item) => item.id === booking?.package_id);
        return [
          trip?.title ?? "",
          trip?.departure_date ?? "",
          booking ? `#${booking.id.slice(0, 8).toUpperCase()}` : "",
          traveller.full_name,
          traveller.phone || booking?.contact_phone || "",
          traveller.gender ?? "",
          traveller.date_of_birth ?? "",
          traveller.nationality ?? "",
          traveller.passport_no ?? "",
          traveller.passport_expiry_date ?? "",
          traveller.visa_status ?? "",
          booking?.pay_method ?? "",
          booking?.pay_status ?? "",
        ];
      });
    const escapeCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tawaf-passengers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="portal-panel trip-booking-inbox">
      <div className="portal-panel-header trip-booking-inbox-head">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        <button type="button" className="portal-secondary-button" onClick={exportPassengerList} disabled={!activeTravellers.length}>
          <Download size={15} /> {locale === "ku" ? "هەناردەکردنی لیستی گەشتیاران" : locale === "ar" ? "تصدير قائمة المسافرين" : "Export passenger list"}
        </button>
      </div>

      <div className="trip-booking-toolbar">
        <label><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={locale === "ku" ? "گەڕان بە ناو یان ژمارەی مۆبایل..." : locale === "ar" ? "البحث بالاسم أو الهاتف..." : "Search name or phone..."} /></label>
        <div role="tablist" aria-label="Booking filters">
          {([
            ["all", locale === "ku" ? "هەموو" : locale === "ar" ? "الكل" : "All"],
            ["new", locale === "ku" ? "نوێ" : locale === "ar" ? "جديد" : "New"],
            ["cash", locale === "ku" ? "نەختینە چاوەڕێیە" : locale === "ar" ? "نقد معلق" : "Cash pending"],
            ["cancelled", locale === "ku" ? "هەڵوەشاوە" : locale === "ar" ? "ملغي" : "Cancelled"],
          ] as const).map(([id, label]) => (
            <button type="button" key={id} role="tab" aria-selected={filter === id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {visibleBookings.length ? (
        <div className="trip-booking-list">
          {visibleBookings.map((booking) => {
            const unseen = !viewedBookingIds.has(booking.id);
            const cashPending = isCashPending(booking);
            const cancelled = isCancelled(booking);
            const trip = trips.find((item) => item.id === booking.package_id);
            return (
              <article
                key={booking.id}
                className={`trip-booking-row${unseen ? " unseen" : ""}${cancelled ? " cancelled" : ""}`}
                onClick={() => void openBooking(booking)}
                onPointerDown={(event) => startGesture(event, booking)}
                onPointerUp={endGesture}
                onPointerCancel={cancelGesture}
                onPointerLeave={cancelGesture}
                onContextMenu={(event) => {
                  event.preventDefault();
                  suppressOpenRef.current = true;
                  void onSetViewed(booking.id, false);
                }}
              >
                <div className="trip-booking-client">
                  <i className={unseen ? "is-new" : ""} aria-label={unseen ? "Unseen" : "Seen"} />
                  <span><UserRound size={16} /></span>
                  <div>
                    <b>{clientName(booking)}</b>
                    <small>{trip?.title ?? `#${booking.id.slice(0, 8).toUpperCase()}`}</small>
                  </div>
                </div>
                <div className="trip-booking-count"><b>{booking.travellers}</b><small>{locale === "ku" ? "گەشتیار" : locale === "ar" ? "مسافر" : booking.travellers === 1 ? "traveller" : "travellers"}</small></div>
                <div className="trip-booking-payment">
                  <span className={cashPending ? "cash" : booking.pay_status === "paid" ? "paid" : "neutral"}>
                    {cashPending ? (locale === "ku" ? "نەختینە چاوەڕێیە" : locale === "ar" ? "نقد معلق" : "Cash pending") : titleCase(booking.pay_status || booking.pay_method)}
                  </span>
                  <b>{formatIqd(booking.total_iqd)}</b>
                  {isAwaitingBookingPayment(booking) && (
                    <small>{formatIqd(Math.max(0, Number(booking.total_iqd) - Number(booking.amount_paid_iqd)))} {locale === "ku" ? "ماوە" : locale === "ar" ? "متبقي" : "due"}{booking.payment_deadline ? ` · ${formatDateTime(booking.payment_deadline, locale)}` : ""}</small>
                  )}
                </div>
                <time dateTime={booking.created_at}>
                  {new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(booking.created_at))}
                </time>
                <div className="trip-booking-quick" onClick={(event) => event.stopPropagation()}>
                  {cashPending && <button type="button" className="cash" disabled={busy === `booking-${booking.id}`} onClick={() => setCashReceiptBooking(booking)} title={locale === "ku" ? "تۆمارکردنی پسوڵە" : locale === "ar" ? "تسجيل الإيصال" : "Record receipt"}><Banknote size={15} /></button>}
                  <button type="button" disabled={!booking.contact_phone} onClick={() => callBooking(booking)} title="Call"><Phone size={15} /></button>
                  <button type="button" onClick={() => void onSetViewed(booking.id, unseen)} title={unseen ? "Mark seen" : "Mark unread"}>{unseen ? <UserCheck size={15} /> : <Inbox size={15} />}</button>
                  <ChevronRight size={16} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <OperationEmpty icon={BookOpenCheck} title={locale === "ku" ? "هیچ حیجزێک نەدۆزرایەوە" : locale === "ar" ? "لم يتم العثور على حجوزات" : "No bookings found"} text={locale === "ku" ? "فلتەرەکان بگۆڕە یان چاوەڕێی حیجزی نوێ بکە." : locale === "ar" ? "غيّر عوامل التصفية أو انتظر حجزاً جديداً." : "Change the filters or wait for a new booking."} />
      )}

      <p className="trip-booking-gesture-help">
        {locale === "ku" ? "ڕاکێشان بۆ چەپ: پەیوەندی · فشارێکی درێژ: نیشانکردن وەک نەخوێندراو" : locale === "ar" ? "اسحب يساراً: اتصال · ضغط مطول: تحديد كغير مقروء" : "Swipe left: call · Long-press: mark unread"}
      </p>

      {selectedBooking && (
        <BookingInboxDetail
          booking={selectedBooking}
          trip={trips.find((trip) => trip.id === selectedBooking.package_id)}
          travellers={bookingTravellers(selectedBooking.id)}
          unseen={!viewedBookingIds.has(selectedBooking.id)}
          busy={busy}
          runAction={runAction}
          askReason={askReason}
          locale={locale}
          onSetViewed={onSetViewed}
          onRecordCash={() => setCashReceiptBooking(selectedBooking)}
          onCall={callBooking}
          onClose={() => setSelectedBookingId(null)}
        />
      )}
      {cashReceiptBooking && (
        <CashReceiptDialog
          booking={cashReceiptBooking}
          locale={locale}
          busy={busy === `booking-${cashReceiptBooking.id}`}
          onCancel={() => setCashReceiptBooking(null)}
          onSubmit={(receiptNumber) => confirmCashReceipt(cashReceiptBooking, receiptNumber)}
        />
      )}
    </section>
  );
}

function BookingInboxDetail({
  booking,
  trip,
  travellers,
  unseen,
  busy,
  runAction,
  askReason,
  locale,
  onSetViewed,
  onRecordCash,
  onCall,
  onClose,
}: {
  booking: Booking;
  trip?: Trip;
  travellers: Traveller[];
  unseen: boolean;
  busy: string;
  runAction: Props["runAction"];
  askReason?: Props["askReason"];
  locale: "ku" | "ar" | "en";
  onSetViewed: BookingInboxProps["onSetViewed"];
  onRecordCash: () => void;
  onCall: (booking: Booking) => void;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<TravellerDocument[]>([]);
  const [docsRevision, setDocsRevision] = useState(0);
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);
  const [visaBatchReference, setVisaBatchReference] = useState("");
  const activeTravellers = onlyActiveTravellers(travellers);

  useScrollLock();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !lightbox) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, lightbox]);

  // Fetched per booking rather than passed down, so this works the same in the
  // per-trip Bookings tab and in the cross-trip "all new bookings" inbox.
  useEffect(() => {
    let active = true;
    (async () => {
      const result = await getSupabase()
        .from("traveller_documents")
        .select("*")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: false });
      if (active && !result.error) setDocs((result.data ?? []) as TravellerDocument[]);
    })();
    return () => { active = false; };
  }, [booking.id, docsRevision]);

  async function transition(action: "accept" | "request_information" | "reject" | "ready" | "start" | "complete") {
    let reason: string | null = null;
    if (["request_information", "reject"].includes(action)) {
      if (!askReason) return;
      reason = await askReason(action === "request_information"
        ? (locale === "ku" ? "چی زانیارییەک کەمە؟" : locale === "ar" ? "ما المعلومات الناقصة؟" : "What information is missing?")
        : (locale === "ku" ? "هۆکاری ڕەتکردنەوە بنووسە:" : locale === "ar" ? "اكتب سبب الرفض:" : "Add a rejection reason:"));
      if (!reason) return;
    }
    await runAction(
      `booking-${booking.id}`,
      () => getSupabase().rpc("transition_booking", { p_booking_id: booking.id, p_action: action, p_reason: reason }),
      locale === "ku" ? "دۆخی حیجزەکە نوێکرایەوە." : locale === "ar" ? "تم تحديث الحجز." : `Booking ${action.replaceAll("_", " ")} completed.`,
    );
  }

  async function submitVisaBatch() {
    if (!canSubmitVisaBatch) return;
    await runAction(
      `visa-batch-${booking.id}`,
      () => getSupabase().rpc("submit_visa_batch", {
        p_booking_id: booking.id,
        p_reference: visaBatchReference.trim() || null,
      }),
      locale === "ku" ? "کۆمەڵە ڤیزاکان نێردران." : locale === "ar" ? "تم إرسال دفعة التأشيرات." : "Visa batch submitted.",
    );
  }

  const lead = activeTravellers.find((traveller) => traveller.is_lead) ?? activeTravellers[0];
  const visasReady = activeTravellers.length > 0 && activeTravellers.every((traveller) => traveller.visa_status === "approved");
  const documentsReady = activeTravellers.length > 0 && activeTravellers.every((traveller) => traveller.document_status === "approved");
  const hasVisaApplicants = activeTravellers.some((traveller) => ["not_started", "documents_missing", "ready_to_apply", "rejected"].includes(traveller.visa_status));
  const hasUnresolvedVisaRejection = activeTravellers.some((traveller) => traveller.visa_status === "rejected" && traveller.visa_rejection_category !== "fixable_document");
  const visaBatchInProgress = activeTravellers.some((traveller) => ["submitted", "under_review"].includes(traveller.visa_status));
  const working = busy === `booking-${booking.id}`;
  const visaBatchBusy = busy === `visa-batch-${booking.id}`;
  // Company acceptance unlocks document review immediately. Visa submission
  // and outcomes stay behind the fully-paid confirmed-booking guard.
  const documentReviewEnabled = ["awaiting_payment", "confirmed"].includes(booking.operational_stage);
  const documentReviewWaitingForAcceptance = booking.operational_stage === "requested";
  const documentReviewWaitingForClient = booking.operational_stage === "needs_information";
  const paidOperationsEnabled = booking.operational_stage === "confirmed" && booking.pay_status === "paid";
  const canSubmitVisaBatch = paidOperationsEnabled && documentsReady && hasVisaApplicants && !hasUnresolvedVisaRejection;
  const cashLocationType = booking.cash_payment_location_type === "company_office"
    ? (locale === "ku" ? "نووسینگەی کۆمپانیای گەشت" : locale === "ar" ? "مكتب شركة السفر" : "Travel company office")
    : booking.cash_payment_location_type
      ? (locale === "ku" ? "شوێنی پارەدانی ڕێگەپێدراوی تەواف" : locale === "ar" ? "موقع دفع معتمد من طواف" : "Tawaf-authorized payment location")
      : (locale === "ku" ? "شوێن دیاری نەکراوە" : locale === "ar" ? "لم يحدد الموقع" : "Location not assigned");
  const hasCashLocation = Boolean(
    booking.cash_payment_location_type
    || booking.cash_payment_location_name
    || booking.cash_payment_location_address
    || booking.cash_payment_location_hours,
  );
  const hasPaymentProof = Boolean(
    booking.payment_receipt_number
    || booking.payment_confirmation_code
    || booking.payment_confirmed_at,
  );

  return (
    <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="portal-modal trip-booking-detail" role="dialog" aria-modal="true" aria-labelledby="booking-detail-title">
        <header>
          <div>
            <small>#{booking.id.slice(0, 8).toUpperCase()}</small>
            <h2 id="booking-detail-title">{lead?.full_name || (locale === "ku" ? "وردەکاری حیجز" : locale === "ar" ? "تفاصيل الحجز" : "Booking detail")}</h2>
            <p>{trip?.title ?? ""} · {formatDate(trip?.departure_date)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="trip-booking-detail-body">
          <div className="trip-booking-detail-summary">
            <div><small>{locale === "ku" ? "گەشتیاران" : locale === "ar" ? "المسافرون" : "Travellers"}</small><b>{booking.travellers}</b></div>
            <div><small>{locale === "ku" ? "کۆی گشتی" : locale === "ar" ? "الإجمالي" : "Total"}</small><b>{formatIqd(booking.total_iqd)}</b></div>
            <div><small>{locale === "ku" ? "دراوە" : locale === "ar" ? "المدفوع" : "Paid"}</small><b>{formatIqd(booking.amount_paid_iqd)}</b></div>
            <div><small>{locale === "ku" ? "پارەدان" : locale === "ar" ? "الدفع" : "Payment"}</small><b>{titleCase(booking.pay_method)}</b></div>
            {isAwaitingBookingPayment(booking) && <div><small>{locale === "ku" ? "ماوە" : locale === "ar" ? "المتبقي" : "Balance due"}</small><b>{formatIqd(Math.max(0, Number(booking.total_iqd) - Number(booking.amount_paid_iqd)))}</b></div>}
            {isAwaitingBookingPayment(booking) && booking.payment_deadline && <div><small>{locale === "ku" ? "کۆتایی پارەدان" : locale === "ar" ? "الموعد النهائي للدفع" : "Payment deadline"}</small><b>{formatDateTime(booking.payment_deadline, locale)}</b></div>}
          </div>
          {(booking.pay_method === "cash" || hasPaymentProof || booking.accepted_at) && (
            <section className="booking-payment-proof trip-booking-payment-proof">
              <header>
                {booking.pay_method === "cash" ? <MapPin size={16} /> : <FileCheck2 size={16} />}
                <div>
                  <small>{booking.pay_method === "cash"
                    ? (locale === "ku" ? "شوێنی پارەدانی نەختینە" : locale === "ar" ? "مكان الدفع النقدي" : "Cash payment location")
                    : (locale === "ku" ? "پشتڕاستکردنەوەی پارەدان" : locale === "ar" ? "تأكيد الدفع" : "Payment confirmation")}</small>
                  <b>{booking.pay_method === "cash" ? cashLocationType : titleCase(booking.pay_method)}</b>
                </div>
              </header>
              {booking.pay_method === "cash" && (
                hasCashLocation
                  ? <p>{[booking.cash_payment_location_name, booking.cash_payment_location_address, booking.cash_payment_location_hours].filter(Boolean).join(" · ")}</p>
                  : <p>{locale === "ku" ? "شوێنی پارەدان هێشتا بۆ ئەم حیجزە دیاری نەکراوە." : locale === "ar" ? "لم يتم تعيين مكان الدفع لهذا الحجز بعد." : "A payment location has not been assigned to this booking yet."}</p>
              )}
              <dl>
                {booking.accepted_at && <div><dt>{locale === "ku" ? "وەرگیراوە لە" : locale === "ar" ? "تم القبول في" : "Accepted at"}</dt><dd>{formatDateTime(booking.accepted_at, locale)}</dd></div>}
                {isAwaitingBookingPayment(booking) && booking.payment_deadline && <div><dt>{locale === "ku" ? "کۆتایی پارەدان" : locale === "ar" ? "الموعد النهائي للدفع" : "Payment deadline"}</dt><dd>{formatDateTime(booking.payment_deadline, locale)}</dd></div>}
                {booking.payment_receipt_number && <div><dt>{locale === "ku" ? "ژمارەی پسوڵە" : locale === "ar" ? "رقم الإيصال" : "Receipt number"}</dt><dd dir="ltr">{booking.payment_receipt_number}</dd></div>}
                {booking.payment_confirmation_code && <div><dt>{locale === "ku" ? "کۆدی پشتڕاستکردنەوە" : locale === "ar" ? "رمز التأكيد" : "Confirmation code"}</dt><dd dir="ltr">{booking.payment_confirmation_code}</dd></div>}
                {booking.payment_confirmed_at && <div><dt>{locale === "ku" ? "پارەدان پشتڕاستکرا لە" : locale === "ar" ? "تم تأكيد الدفع في" : "Payment confirmed at"}</dt><dd>{formatDateTime(booking.payment_confirmed_at, locale)}</dd></div>}
              </dl>
            </section>
          )}
          <div className="trip-booking-detail-contact">
            <div><Phone size={16} /><span><small>{locale === "ku" ? "مۆبایل" : locale === "ar" ? "الهاتف" : "Phone"}</small><b>{booking.contact_phone || "—"}</b></span></div>
            {/* Reads all four axes, not just the stage. The old pill could not
                say "Action needed" for a paid booking whose document was sent
                back, because a rejected document is not a stage. Shares its
                logic with the Flutter app via booking-display-state.ts. */}
            <BookingStatePill booking={booking} travellers={activeTravellers} locale={locale} />
          </div>
          {paidOperationsEnabled && !visasReady && (
            <section className="booking-payment-proof trip-booking-payment-proof">
              <header><FileCheck2 size={16} /><div><small>{locale === "ku" ? "کۆمەڵە ڤیزا" : locale === "ar" ? "دفعة التأشيرات" : "Visa batch"}</small><b>{visaBatchInProgress ? (locale === "ku" ? "چاوەڕێی ئەنجام" : locale === "ar" ? "بانتظار النتيجة" : "Awaiting outcome") : (locale === "ku" ? "ئامادەی ناردن" : locale === "ar" ? "جاهزة للإرسال" : "Ready to submit")}</b></div></header>
              {!documentsReady ? (
                <p className="booking-workflow-lock"><ShieldCheck size={13} /> {locale === "ku" ? "بەڵگەنامەکانی هەموو گەشتیارە چالاکەکان پەسەند بکە." : locale === "ar" ? "اعتمد مستندات جميع المسافرين النشطين أولاً." : "Approve every active traveller's documents first."}</p>
              ) : hasUnresolvedVisaRejection ? (
                <p className="booking-workflow-lock"><X size={13} /> {locale === "ku" ? "سەرەتا گۆڕینی گەشتیار یان ڕەتکردنەوەی کۆتایی چارەسەر بکە." : locale === "ar" ? "عالج استبدال المسافر أو الرفض النهائي أولاً." : "Resolve traveller replacements or final rejections first."}</p>
              ) : hasVisaApplicants ? (
                <div className="booking-inline-field">
                  <input value={visaBatchReference} onChange={(event) => setVisaBatchReference(event.target.value)} placeholder={locale === "ku" ? "ژمارەی کۆمەڵە (ئارەزوومەندانە)" : locale === "ar" ? "مرجع الدفعة (اختياري)" : "Batch reference (optional)"} disabled={visaBatchBusy} />
                  <button type="button" onClick={() => void submitVisaBatch()} disabled={!canSubmitVisaBatch || visaBatchBusy}>{visaBatchBusy ? <TawafLoadingSpinner size={13} /> : <Upload size={13} />} {locale === "ku" ? "ناردنی ڤیزاکان" : locale === "ar" ? "إرسال التأشيرات" : "Submit visas"}</button>
                </div>
              ) : <p className="booking-inline-note">{locale === "ku" ? "ڤیزاکان نێردراون؛ ئەنجامی هەر گەشتیارێک تۆمار بکە." : locale === "ar" ? "تم إرسال التأشيرات؛ سجل نتيجة كل مسافر." : "Visas are submitted; record each traveller's outcome."}</p>}
            </section>
          )}
          <div className="trip-booking-detail-travellers">
            <h3>
              {locale === "ku" ? "لیستی گەشتیاران" : locale === "ar" ? "قائمة المسافرين" : "Passenger list"}
              {activeTravellers.length > 1 && <i>{activeTravellers.length}</i>}
            </h3>
            {activeTravellers.length ? activeTravellers.map((traveller) => (
              <BookingTravellerPanel
                key={traveller.id}
                traveller={traveller}
                docs={docs.filter((document) => document.traveller_id === traveller.id)}
                busy={busy}
                runAction={runAction}
                askReason={askReason}
                locale={locale}
                documentReviewEnabled={documentReviewEnabled}
                documentReviewWaitingForAcceptance={documentReviewWaitingForAcceptance}
                documentReviewWaitingForClient={documentReviewWaitingForClient}
                paidOperationsEnabled={paidOperationsEnabled}
                onDocsChanged={() => setDocsRevision((revision) => revision + 1)}
                onOpenImage={(images, index) => setLightbox({ images, index })}
              />
            )) : (
              <p className="booking-inline-note">{locale === "ku" ? "هیچ گەشتیارێک تۆمار نەکراوە." : locale === "ar" ? "لم يسجل أي مسافر." : "No travellers recorded for this booking."}</p>
            )}
          </div>
          {booking.note && <div className="trip-booking-note"><small>{locale === "ku" ? "تێبینی کڕیار" : locale === "ar" ? "ملاحظة العميل" : "Client note"}</small><p>{booking.note}</p></div>}
        </div>
        <footer>
          <button type="button" className="portal-secondary-button" onClick={() => void onSetViewed(booking.id, unseen)}>
            {unseen ? <UserCheck size={15} /> : <Inbox size={15} />} {unseen ? (locale === "ar" ? "تحديد كمقروء" : "Mark seen") : (locale === "ar" ? "تحديد كغير مقروء" : "Mark unread")}
          </button>
          <button type="button" className="portal-secondary-button" disabled={!booking.contact_phone} onClick={() => onCall(booking)}><Phone size={15} /> {locale === "ku" ? "پەیوەندی" : locale === "ar" ? "اتصال" : "Call"}</button>
          {booking.operational_stage === "requested" && <button type="button" className="portal-primary-button" disabled={working} onClick={() => void transition("accept")}><Check size={15} /> {locale === "ku" ? "وەرگرتنی حیجز" : locale === "ar" ? "قبول الحجز" : "Accept booking"}</button>}
          {isCashPending(booking) && <button type="button" className="portal-primary-button" disabled={working} onClick={onRecordCash}><Banknote size={15} /> {locale === "ku" ? "تۆمارکردنی پسوڵە" : locale === "ar" ? "تسجيل الإيصال" : "Record receipt"}</button>}
          {booking.operational_stage === "requested" && askReason && <button type="button" className="portal-secondary-button" disabled={working} onClick={() => void transition("request_information")}>{locale === "ku" ? "داوای زانیاری" : locale === "ar" ? "طلب معلومات" : "Request info"}</button>}
          {["requested", "needs_information", "awaiting_payment"].includes(booking.operational_stage) && askReason && <button type="button" className="portal-danger-button" disabled={working} onClick={() => void transition("reject")}>{locale === "ku" ? "ڕەتکردنەوە" : locale === "ar" ? "رفض" : "Reject"}</button>}
          {booking.operational_stage === "confirmed" && booking.pay_status === "paid" && <button type="button" className="portal-primary-button" disabled={working || !visasReady} title={visasReady ? undefined : "All active traveller visas must be approved first"} onClick={() => void transition("ready")}><Check size={15} /> {locale === "ku" ? "ئامادەیە" : locale === "ar" ? "جاهز" : "Mark ready"}</button>}
          {booking.operational_stage === "ready" && <button type="button" className="portal-primary-button" disabled={working} onClick={() => void transition("start")}><Plane size={15} /> {locale === "ku" ? "دەستپێکردن" : locale === "ar" ? "بدء" : "Start trip"}</button>}
          {booking.operational_stage === "in_progress" && <button type="button" className="portal-primary-button" disabled={working} onClick={() => void transition("complete")}><Check size={15} /> {locale === "ku" ? "تەواوکردن" : locale === "ar" ? "إكمال" : "Complete"}</button>}
        </footer>
      </section>
      {lightbox && <TravellerLightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function TripManagementTab({
  tab,
  trip,
  details,
  bookings,
  allTrips,
  bookingTravellers,
  viewedBookingIds,
  onSetViewed,
  commissions,
  payments,
  busy,
  runAction,
  askReason,
  locale,
  onEdit,
  onSubmit,
  onPause,
  onResume,
  onDelete,
  onWithdraw,
  onAdjustSeats,
  canEdit,
  hasPendingRequest,
}: {
  tab: "overview" | "bookings" | "financials";
  trip: Trip;
  details: TripDetails | null;
  bookings: Booking[];
  allTrips: Trip[];
  bookingTravellers: Traveller[];
  viewedBookingIds: Set<string>;
  onSetViewed: (bookingId: string, viewed: boolean) => Promise<void>;
  commissions: Commission[];
  payments: Payment[];
  busy: string;
  runAction: Props["runAction"];
  askReason: Props["askReason"];
  locale: "ku" | "ar" | "en";
  onEdit: () => void;
  onSubmit: () => Promise<any>;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onWithdraw: () => void;
  onAdjustSeats: () => void;
  canEdit: boolean;
  hasPendingRequest: boolean;
}) {
  const activeBookings = bookings.filter((booking) => !["cancelled", "rejected", "expired"].includes(booking.operational_stage));
  const gross = bookings.reduce((sum, booking) => sum + Number(booking.total_iqd), 0);
  const received = payments.filter((payment) => payment.status === "succeeded").reduce((sum, payment) => sum + Number(payment.amount_iqd), 0);
  const commission = commissions.reduce((sum, item) => sum + Number(item.amount_iqd), 0);

  if (tab === "bookings") return (
    <BookingInbox
      title={locale === "ku" ? "حیجزەکانی گەشت" : locale === "ar" ? "حجوزات الرحلة" : "Trip bookings"}
      subtitle={locale === "ku" ? "تەنها حیجزەکانی ئەم گەشتە" : locale === "ar" ? "الحجوزات المرتبطة بهذه الرحلة فقط" : "Only bookings attached to this departure"}
      bookings={bookings}
      trips={allTrips}
      travellers={onlyActiveTravellers(bookingTravellers)}
      viewedBookingIds={viewedBookingIds}
      onSetViewed={onSetViewed}
      busy={busy}
      runAction={runAction}
      askReason={askReason}
      locale={locale}
    />
  );

  if (tab === "financials") return (
    <>
      <section className="trip-finance-grid">
        <div><span><CircleDollarSign size={19} /></span><small>Customer value</small><b>{formatIqd(gross)}</b></div>
        <div><span><Banknote size={19} /></span><small>Payments received</small><b>{formatIqd(received)}</b></div>
        <div><span><WalletCards size={19} /></span><small>Tawaf commission</small><b>{formatIqd(commission)}</b></div>
        <div><span><CheckCircle2 size={19} /></span><small>Estimated company net</small><b>{formatIqd(Math.max(0, received - commission))}</b></div>
      </section>
      <section className="portal-panel trip-operation-panel"><div className="portal-panel-header"><div><h2>Financial controls</h2><p>Trip financials are read-only and reconciled by Tawaf</p></div><ShieldCheck size={19} /></div><div className="trip-finance-notice"><ShieldCheck size={20} /><div><b>Protected financial records</b><p>Your team can view and export trip financials but cannot change payment success, commission, refunds or payouts.</p></div></div></section>
    </>
  );

  const fill = Math.round((Number(trip.seats_reserved ?? 0) / Math.max(1, Number(trip.capacity ?? 1))) * 100);
  return (
    <>
      <section className="trip-overview-metrics">
        <div><small>Starting price</small><b>{formatIqd(trip.price_iqd)}</b><span>per pilgrim</span></div>
        <div><small>Capacity</small><b>{trip.seats_reserved ?? 0} / {trip.capacity ?? "—"}</b><span>{fill}% reserved</span></div>
        <div><small>Active bookings</small><b>{activeBookings.length}</b><span>{activeBookings.reduce((sum, booking) => sum + booking.travellers, 0)} travellers</span></div>
        <div><small>Trip duration</small><b>{trip.days} days</b><span>{trip.nights} nights</span></div>
      </section>

      <section className="trip-overview-layout">
        <div className="portal-panel">
          <div className="portal-panel-header"><div><h2>Journey overview</h2><p>Hotels, transport and daily program</p></div></div>
          <div className="trip-overview-body">
            <div className="trip-route"><div><span><Plane size={17} /></span><small>Departure</small><b>{trip.departure_airport || "TBA"}</b><p>{formatDate(trip.departure_date)}</p></div><i /><div><span><Building2 size={17} /></span><small>Umrah journey</small><b>Makkah & Madinah</b><p>{trip.days} days</p></div><i /><div><span><Plane size={17} /></span><small>Return</small><b>{trip.departure_airport || "TBA"}</b><p>{formatDate(trip.return_date)}</p></div></div>
            <div className="trip-hotel-summary">{details?.hotels.map((hotel) => <article key={hotel.city}><span><Hotel size={18} /></span><div><small>{titleCase(hotel.city)}</small><b>{hotel.hotels?.name || "Hotel TBA"}</b><p>{hotel.nights} nights · {hotel.distance_from_haram_m}m from {hotel.city === "makkah" ? "Haram" : "the Prophet's Mosque"}</p></div></article>)}</div>
            <div className="trip-itinerary-summary"><h3>Daily itinerary</h3>{details?.itinerary.length ? details.itinerary.map((day) => <div key={day.day_no}><span>{day.day_no}</span><div><b>{day.title}</b><p>{day.summary || "Schedule details to be announced."}</p></div></div>) : <p className="trip-muted">No itinerary added yet.</p>}</div>
          </div>
        </div>
        <aside className="portal-panel trip-quick-actions">
          <div className="portal-panel-header"><div><h2>Trip controls</h2><p>Available for the current status</p></div></div>
          <div>
            {hasPendingRequest && <div className="trip-action-pending"><ShieldCheck size={17} /><span><b>Admin review pending</b><small>More trip requests unlock after Tawaf decides.</small></span></div>}
            {trip.lifecycle_status === "pending_review" && <div className="trip-action-pending"><ShieldCheck size={17} /><span><b>Admin review pending</b><small>Editing is locked until Tawaf decides or you withdraw.</small></span></div>}
            {canEdit && <button type="button" onClick={onEdit}><span className="green"><Pencil size={17} /></span><div><b>Edit trip</b><small>{["draft", "needs_changes", "rejected"].includes(trip.lifecycle_status) ? "Update the complete trip bundle" : "Send proposed changes to Tawaf"}</small></div><ChevronRight size={16} /></button>}
            {!hasPendingRequest && ["draft", "needs_changes", "rejected"].includes(trip.lifecycle_status) && <button type="button" onClick={onSubmit}><span className="gold"><Send size={17} /></span><div><b>Submit for review</b><small>Tawaf admin approval required</small></div><ChevronRight size={16} /></button>}
            {trip.lifecycle_status === "pending_review" && <button type="button" onClick={onWithdraw}><span className="sand"><ArrowLeft size={17} /></span><div><b>Withdraw submission</b><small>Return this trip to draft</small></div><ChevronRight size={16} /></button>}
            {!hasPendingRequest && trip.lifecycle_status === "published" && <button type="button" onClick={onPause}><span className="sand"><X size={17} /></span><div><b>Pause sales</b><small>Stop accepting new bookings</small></div><ChevronRight size={16} /></button>}
            {!hasPendingRequest && trip.lifecycle_status === "paused" && <button type="button" onClick={onResume}><span className="green"><Check size={17} /></span><div><b>Resume sales</b><small>Put this trip back on sale immediately</small></div><ChevronRight size={16} /></button>}
            {!hasPendingRequest && trip.lifecycle_status === "sold_out" && <button type="button" onClick={onAdjustSeats}><span className="gold"><Users size={17} /></span><div><b>Adjust seats</b><small>Increase capacity to reopen sales</small></div><ChevronRight size={16} /></button>}
            {!hasPendingRequest && ["draft", "needs_changes", "rejected"].includes(trip.lifecycle_status) && <button type="button" className="danger" onClick={onDelete}><span><Trash2 size={17} /></span><div><b>Delete trip</b><small>Available only while there are no bookings</small></div><ChevronRight size={16} /></button>}
          </div>
        </aside>
      </section>
    </>
  );
}

function OperationEmpty({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
  return <div className="trip-operation-empty"><span><Icon size={23} /></span><h3>{title}</h3><p>{text}</p></div>;
}

// ---------- Traveller detail: documents + visa readiness ----------
const PASSPORT_BUCKET = "booking-passports";
const isImagePath = (path?: string | null) => /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(path ?? "");
type LightboxImage = { url: string; label: string };
type DocSource = { key: string; bucket: string; path: string; label: string; image: boolean };

// The passport and selfie live on the traveller row itself; everything else is a
// traveller_documents row. Both the booking modal and the traveller modal render
// the same set, so the shape is built in one place.
function travellerDocSources(traveller: Traveller, docs: TravellerDocument[], tr: (ku: string, ar: string, en: string) => string): DocSource[] {
  const t = traveller as any;
  return [
    t.passport_image_path ? { key: `${traveller.id}-passport`, bucket: PASSPORT_BUCKET, path: t.passport_image_path as string, label: tr("پاسپۆرت", "جواز السفر", "Passport"), image: true } : null,
    t.selfie_image_path ? { key: `${traveller.id}-selfie`, bucket: PASSPORT_BUCKET, path: t.selfie_image_path as string, label: tr("وێنەی کەسی", "صورة شخصية", "Selfie"), image: true } : null,
    ...docs.map((d) => ({ key: d.id, bucket: (d as any).storage_bucket ?? "traveller-documents", path: (d as any).storage_path as string, label: titleCase(d.kind), image: isImagePath((d as any).storage_path) })),
  ].filter(Boolean) as DocSource[];
}

// Storage objects are private, so each render needs fresh signed URLs.
function useSignedDocumentUrls(sources: DocSource[]) {
  const [signed, setSigned] = useState<Record<string, string>>({});
  const signKey = sources.map((s) => `${s.bucket}:${s.path}`).join("|");
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
  return signed;
}

function TravellerLightbox({ images, index, onClose }: { images: LightboxImage[]; index: number; onClose: () => void }) {
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

function visaRejectionCategoryLabel(category: VisaRejectionCategory, locale: "ku" | "ar" | "en") {
  const labels: Record<VisaRejectionCategory, [string, string, string]> = {
    fixable_document: ["بەڵگەنامەی چاککراوە", "مستند قابل للتصحيح", "Fixable document"],
    traveller_replaced: ["زیارەتکار دەگۆڕدرێت", "سيتم استبدال المسافر", "Traveller will be replaced"],
    final_rejection: ["ڕەتکردنەوەی کۆتایی", "رفض نهائي", "Final rejection"],
  };
  const [ku, ar, en] = labels[category];
  return locale === "ku" ? ku : locale === "ar" ? ar : en;
}

// One traveller's documents and visa controls, rendered inline inside the
// booking modal so a multi-passenger booking shows every pilgrim's paperwork
// under their own name without drilling into a second screen.
function BookingTravellerPanel({ traveller, docs, busy, runAction, askReason, locale, documentReviewEnabled, documentReviewWaitingForAcceptance, documentReviewWaitingForClient, paidOperationsEnabled, onDocsChanged, onOpenImage }: {
  traveller: Traveller;
  docs: TravellerDocument[];
  busy: string;
  runAction: Props["runAction"];
  askReason?: Props["askReason"];
  locale: "ku" | "ar" | "en";
  documentReviewEnabled: boolean;
  documentReviewWaitingForAcceptance: boolean;
  documentReviewWaitingForClient: boolean;
  paidOperationsEnabled: boolean;
  onDocsChanged: () => void;
  onOpenImage: (images: LightboxImage[], index: number) => void;
}) {
  const tr = (ku: string, ar: string, en: string) => (locale === "ku" ? ku : locale === "ar" ? ar : en);
  const t = traveller as any;
  const rowBusy = busy === `traveller-${traveller.id}`;
  const [rejectionCategory, setRejectionCategory] = useState<VisaRejectionCategory | "">("");
  useEffect(() => { setRejectionCategory(""); }, [traveller.id, traveller.visa_status]);

  const sources = travellerDocSources(traveller, docs, tr);
  const signed = useSignedDocumentUrls(sources);
  const galleryImages: LightboxImage[] = sources.filter((s) => s.image && signed[s.key]).map((s) => ({ url: signed[s.key], label: s.label }));
  const docsApproved = traveller.document_status === "approved";
  const visaApproved = traveller.visa_status === "approved";
  const canResolveVisa = paidOperationsEnabled && ["submitted", "under_review"].includes(traveller.visa_status);

  async function act(rpc: () => any, success: string) {
    const result = await runAction(`traveller-${traveller.id}`, rpc, success);
    if (result) onDocsChanged();
  }
  async function approveDocuments() {
    if (!documentReviewEnabled) return;
    await act(() => getSupabase().rpc("update_traveller_operations", { p_traveller_id: traveller.id, p_document_status: "approved" }), tr("بەڵگەنامەکان پەسەندکران.", "تمت الموافقة على المستندات.", "Documents approved."));
  }
  async function rejectDocuments() {
    if (!documentReviewEnabled) return;
    if (!askReason) return;
    const reason = await askReason(tr("بۆچی بەڵگەنامەکان ڕەتدەکرێنەوە؟ (زیارەتکار ئەمە دەبینێت)", "لماذا ترفض المستندات؟ (يراها المعتمر)", "Why are the documents rejected? (the pilgrim sees this)"));
    if (!reason) return;
    await act(() => getSupabase().rpc("update_traveller_operations", { p_traveller_id: traveller.id, p_document_status: "rejected", p_document_reason: reason }), tr("بەڵگەنامەکان ڕەتکرانەوە.", "تم رفض المستندات.", "Documents rejected — the pilgrim was notified."));
  }
  async function resolveVisa(status: "approved" | "rejected") {
    if (!canResolveVisa) return;
    let reason: string | null = null;
    if (status === "rejected") {
      if (!rejectionCategory) return;
      if (!askReason) return;
      reason = await askReason(tr("هۆکاری ڕەتکردنەوەی ڤیزا:", "سبب رفض التأشيرة:", "Reason the visa was rejected:"));
      if (!reason) return;
    }
    await act(
      () => getSupabase().rpc("resolve_visa", {
        p_traveller_id: traveller.id,
        p_status: status,
        p_category: status === "rejected" ? rejectionCategory : null,
        p_reason: reason,
      }),
      status === "approved"
        ? tr("ڤیزاکە پەسەندکرا.", "تمت الموافقة على التأشيرة.", "Visa approved.")
        : tr("ڕەتکردنەوەی ڤیزا و هۆکارەکە تۆمارکرا.", "تم تسجيل رفض التأشيرة وسببه.", "Visa rejection and reason recorded."),
    );
  }

  return (
    <article className="booking-traveller-panel">
      <header>
        <span><UserRound size={15} /></span>
        <div>
          <b>{traveller.full_name}</b>
          <small>{traveller.passport_no || tr("پاسپۆرت زیاد نەکراوە", "لم يضف جواز السفر", "No passport yet")}</small>
        </div>
        <div className="booking-traveller-pills">
          <span className="booking-pill-label">{tr("بەڵگەنامە", "المستندات", "Documents")}</span><Status value={traveller.document_status || "missing"} />
          <span className="booking-pill-label">{tr("ڤیزا", "التأشيرة", "Visa")}</span><Status value={traveller.visa_status || "not_started"} />
        </div>
      </header>

      {traveller.document_status === "rejected" && t.document_reason && (
        <p className="booking-reason-note"><X size={12} /> {tr("هۆکاری ڕەتکردنەوە", "سبب الرفض", "Rejection note")}: {t.document_reason}</p>
      )}

      <div className="booking-doc-row">
        {sources.length === 0 && <div className="booking-doc-empty">{tr("هێشتا هیچ بەڵگەنامەیەک بارنەکراوە", "لم يتم رفع أي مستند بعد", "No documents uploaded yet")}</div>}
        {sources.map((s) => {
          const url = signed[s.key];
          if (s.image) {
            return (
              <button
                type="button"
                key={s.key}
                className="booking-doc-thumb"
                onClick={() => {
                  const idx = galleryImages.findIndex((g) => g.label === s.label);
                  if (idx >= 0) onOpenImage(galleryImages, idx);
                }}
                disabled={!url}
              >
                {url ? <img src={url} alt={s.label} loading="lazy" /> : <span className="booking-doc-loading"><TawafLoadingSpinner size={14} /></span>}
                <small>{s.label}</small>
              </button>
            );
          }
          return <a key={s.key} className="booking-doc-file" href={url || undefined} target="_blank" rel="noreferrer"><FileText size={16} /><small>{s.label}</small></a>;
        })}
      </div>

      {documentReviewWaitingForAcceptance && (
        <p className="booking-workflow-lock">
          <ShieldCheck size={13} />
          {tr(
            "سەرەتا حیجزەکە وەربگرە؛ پاشان پێداچوونەوەی بەڵگەنامە چالاک دەبێت.",
            "اقبل الحجز أولاً؛ بعدها تتاح مراجعة المستندات.",
            "Accept the booking before reviewing documents.",
          )}
        </p>
      )}

      {documentReviewWaitingForClient && (
        <p className="booking-workflow-lock">
          <ShieldCheck size={13} />
          {tr(
            "چاوەڕێی کڕیارە زانیارییە داواکراوەکان تەواو بکات؛ پاش گەڕانەوەی حیجزەکە پێداچوونەوە چالاک دەبێت.",
            "بانتظار أن يكمل العميل المعلومات المطلوبة؛ تتاح المراجعة بعد إعادة الحجز للموافقة.",
            "Waiting for the client to provide the requested information before document review can begin.",
          )}
        </p>
      )}

      {documentReviewEnabled && !paidOperationsEnabled && (
        <p className="booking-workflow-lock">
          <ShieldCheck size={13} />
          {tr(
            "پێداچوونەوەی بەڵگەنامە ئێستا چالاکە؛ ئەنجامی ڤیزا دوای پشتڕاستکردنەوەی تەواوی پارەدان چالاک دەبێت.",
            "مراجعة المستندات متاحة الآن؛ تتاح نتائج التأشيرة بعد تأكيد الدفع بالكامل.",
            "Document review is available now. Visa outcomes unlock after full payment is confirmed.",
          )}
        </p>
      )}

      <div className="booking-review-actions">
        <button type="button" className="approve" onClick={approveDocuments} disabled={!documentReviewEnabled || rowBusy || docsApproved || traveller.document_status === "missing"}>
          {rowBusy ? <TawafLoadingSpinner size={13} /> : <Check size={13} />} {tr("پەسەندکردنی بەڵگەنامە", "قبول المستندات", "Approve documents")}
        </button>
        <button type="button" className="danger" onClick={rejectDocuments} disabled={!documentReviewEnabled || rowBusy || traveller.document_status === "missing"}>
          <X size={13} /> {tr("ڕەتکردنەوە", "رفض", "Reject")}
        </button>
      </div>

      <label className="booking-traveller-visa-label">{tr("ئەنجامی ڤیزا", "نتيجة التأشيرة", "Visa outcome")}</label>
      {traveller.visa_reference && <small className="booking-inline-note">{tr("ژمارەی کۆمەڵە", "مرجع الدفعة", "Batch reference")}: {traveller.visa_reference}</small>}
      {!docsApproved && <p className="booking-inline-note">{tr("سەرەتا بەڵگەنامەکان پەسەند بکە.", "اعتمد المستندات أولاً.", "Approve the documents first.")}</p>}
      {canResolveVisa ? (
        <>
          <div className="booking-inline-field">
            <select value={rejectionCategory} onChange={(event) => setRejectionCategory(event.target.value as VisaRejectionCategory | "")} disabled={rowBusy}>
              <option value="">{tr("جۆری ڕەتکردنەوە هەڵبژێرە", "اختر فئة الرفض", "Choose rejection category")}</option>
              {VISA_REJECTION_CATEGORIES.map((category) => <option key={category} value={category}>{visaRejectionCategoryLabel(category, locale)}</option>)}
            </select>
          </div>
          <div className="booking-visa-steps">
            <button type="button" className="approve" onClick={() => resolveVisa("approved")} disabled={rowBusy}><Check size={13} /> {tr("پەسەندکردن", "موافقة", "Approve")}</button>
            <button type="button" className="danger" onClick={() => resolveVisa("rejected")} disabled={rowBusy || !rejectionCategory}><X size={13} /> {tr("ڕەتکردنەوە", "رفض", "Reject")}</button>
          </div>
          <small className="booking-inline-note">{tr("جۆر و هۆکار بۆ ڕەتکردنەوە پێویستن.", "فئة الرفض وسببه مطلوبان.", "A category and reason are required to reject.")}</small>
        </>
      ) : <p className="booking-inline-note">{tr("ئەنجام تەنها دوای ناردنی کۆمەڵە ڤیزا تۆمار دەکرێت.", "تسجل النتيجة فقط بعد إرسال دفعة التأشيرات.", "An outcome can be recorded only after the visa batch is submitted.")}</p>}
      {traveller.visa_rejection_category && <small className="booking-inline-note">{visaRejectionCategoryLabel(traveller.visa_rejection_category as VisaRejectionCategory, locale)}</small>}
      {traveller.visa_reason && <small className="booking-inline-note">{traveller.visa_reason}</small>}
      {visaApproved && <p className="booking-inline-note" style={{ color: "#176a50" }}><Check size={12} /> {tr("ڤیزا ئامادەیە.", "التأشيرة جاهزة.", "Visa ready.")}</p>}
    </article>
  );
}

function TripWizard({
  wizard,
  setWizard,
  error,
  savedAt,
  busy,
  uploadingImage,
  completion,
  canSubmit,
  onBack,
  onSave,
  onSubmit,
  onUploadImage,
  updateHotel,
  approvalMode,
  company,
  locale,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
  error: string;
  savedAt: string;
  busy: string;
  uploadingImage: boolean;
  completion: Array<{ label: string; done: boolean }>;
  canSubmit: boolean;
  onBack: () => void;
  onSave: () => Promise<any>;
  onSubmit: () => Promise<void>;
  onUploadImage: (file?: File) => Promise<void>;
  updateHotel: (city: "makkah" | "madinah", patch: Partial<WizardHotel>) => void;
  approvalMode: boolean;
  company: Company;
  locale: "ku" | "ar" | "en";
}) {
  const W = wizardT[locale];
  const BackIcon = locale === "en" ? ArrowLeft : ArrowRight;

  function addDay() {
    setWizard((current) => ({ ...current, itinerary: [...current.itinerary, { day_no: current.itinerary.length + 1, title: "", summary: "" }] }));
  }

  function updateDay(index: number, patch: Partial<WizardState["itinerary"][number]>) {
    setWizard((current) => ({ ...current, itinerary: current.itinerary.map((day, dayIndex) => dayIndex === index ? { ...day, ...patch } : day) }));
  }

  function removeDay(index: number) {
    setWizard((current) => ({ ...current, itinerary: current.itinerary.filter((_, dayIndex) => dayIndex !== index).map((day, dayIndex) => ({ ...day, day_no: dayIndex + 1 })) }));
  }

  const wizardSeats = Number(wizard.capacity || 0);

  return (
    <>
      <div className="trip-wizard-top">
        <button type="button" onClick={onBack}><BackIcon size={16} /> {W.backToTrips}</button>
        <div><span>{approvalMode ? W.proposingChanges : wizard.id ? W.editingDraft : W.newTripDraft}</span><b>{wizard.title || W.untitled}</b></div>
        <div className="trip-wizard-save-state">{approvalMode ? <><ShieldCheck size={15} /> {W.originalUnchanged}</> : savedAt ? <><CheckCircle2 size={15} /> {W.savedLabel} {savedAt}</> : <><ShieldCheck size={15} /> {W.secureDraft}</>}</div>
      </div>

      <form className="portal-panel trip-wizard-form" onSubmit={(event: FormEvent) => event.preventDefault()}>
        {error && <div className="trip-wizard-error"><X size={17} /> {error}</div>}

        <div className="trip-review-layout">
          <TripLivePreview wizard={wizard} setWizard={setWizard} updateHotel={updateHotel} addDay={addDay} updateDay={updateDay} removeDay={removeDay} onUploadImage={onUploadImage} uploadingImage={uploadingImage} company={company} locale={locale} W={W} />
          <div className="trip-review-side">
            <aside className="trip-submit-checklist"><header><ShieldCheck size={20} /><div><b>{W.readyTitle}</b><small>{W.readySub}</small></div></header>{completion.map((item) => <div className={item.done ? "done" : ""} key={item.label}><span>{item.done ? <Check size={13} /> : "!"}</span>{item.label}</div>)}<p>{approvalMode ? W.adminNoteApproval : W.submitNote}</p></aside>

            {/* Agency-only. These three used to sit in the preview as pills, but
                the app stopped showing them on the trip page — they defaulted to
                standard/group/regular, so nearly every trip carried the same
                three. They still drive keyword search in the app, so they are
                still collected, just no longer pretended to be something a
                pilgrim sees. */}
            <aside className="trip-internal-fields">
              <header><SlidersHorizontal size={17} /><div><b>{W.internalTitle}</b><small>{W.internalHint}</small></div></header>
              <label>
                <span>{W.packageTier}</span>
                <LiveSelect icon={BadgeCheck} value={wizard.package_tier} onChange={(value) => setWizard((current) => ({ ...current, package_tier: value as WizardState["package_tier"] }))} options={[["economy", W.tierEconomy], ["standard", W.tierStandard], ["vip", W.tierVip]]} />
              </label>
              <label>
                <span>{W.tripType}</span>
                <LiveSelect icon={Users} value={wizard.group_type} onChange={(value) => setWizard((current) => ({ ...current, group_type: value as WizardState["group_type"] }))} options={[["family", W.typeFamily], ["individual", W.typeIndividual], ["group", W.typeGroup]]} />
              </label>
              <label>
                <span>{W.season}</span>
                <LiveSelect icon={CalendarDays} value={wizard.season_tag} onChange={(value) => setWizard((current) => ({ ...current, season_tag: value as WizardState["season_tag"] }))} options={[["regular", W.seasonRegular], ["ramadan", W.seasonRamadan], ["shawwal", W.seasonShawwal], ["other", W.seasonOther]]} />
              </label>
              <label className="trip-internal-capacity">
                <span>{W.capacityLabel}</span>
                <span className="trip-internal-stepper">
                  <button type="button" aria-label="−" disabled={wizardSeats <= 0}
                    onClick={() => setWizard((current) => ({ ...current, capacity: String(Math.max(0, Number(current.capacity || 0) - 1)) }))}>
                    <Minus size={13} />
                  </button>
                  <input type="number" min={0} max={500} value={wizard.capacity}
                    onChange={(event) => setWizard((current) => ({ ...current, capacity: event.target.value }))} />
                  <button type="button" aria-label="+" disabled={wizardSeats >= 500}
                    onClick={() => setWizard((current) => ({ ...current, capacity: String(Math.min(500, Number(current.capacity || 0) + 1)) }))}>
                    <Plus size={13} />
                  </button>
                </span>
              </label>
              {/* Seats already sold cannot be un-sold, so the floor is visible
                  rather than left for the save to reject. */}
              {Number(wizard.seats_reserved || 0) > 0 && (
                <p className="trip-internal-note">
                  {W.seatsBookedNote.replace("{count}", String(wizard.seats_reserved))}
                </p>
              )}
            </aside>
          </div>
        </div>

        <footer className="trip-wizard-footer">
          <button type="button" className="portal-secondary-button" onClick={onBack}><BackIcon size={15} /> {W.cancel}</button>
          <div>
            {!approvalMode && <button type="button" className="trip-save-draft" onClick={onSave} disabled={busy === "trip-wizard-save"}>{busy === "trip-wizard-save" ? <TawafLoadingSpinner size={15} /> : <Save size={15} />} {W.saveDraftBtn}</button>}
            <button type="button" className="portal-primary-button" onClick={onSubmit} disabled={!canSubmit || busy.startsWith("trip-")}>{busy.startsWith("trip-") ? <TawafLoadingSpinner size={15} /> : <Send size={15} />} {approvalMode ? W.requestApprovalBtn : W.submitBtn}</button>
          </div>
        </footer>
      </form>
    </>
  );
}

function LiveSelect({ icon: Icon, value, options, onChange, className }: {
  icon?: typeof Plane;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option[0] === value);
  return (
    <span
      className={`trip-live-pill trip-live-select ${className ?? ""}`}
      role="button"
      tabIndex={0}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen((current) => !current); }
        else if (event.key === "Escape") setOpen(false);
      }}
    >
      {Icon && <Icon size={13} />}
      <span className="trip-live-select-value">{current ? current[1] : ""}</span>
      <ChevronDown size={12} className="trip-live-select-caret" />
      {open && <>
        <div className="trip-live-menu-backdrop" onClick={(event) => { event.stopPropagation(); setOpen(false); }} />
        <div className="trip-live-pop-menu" role="listbox" onClick={(event) => event.stopPropagation()}>
          {options.map(([optionValue, label]) => (
            <button type="button" role="option" aria-selected={optionValue === value} key={optionValue} className={optionValue === value ? "active" : ""} onClick={() => { onChange(optionValue); setOpen(false); }}>{label}</button>
          ))}
        </div>
      </>}
    </span>
  );
}

// What the app calls `few_left`. Carried over unchanged from the capacity pill
// this replaced, which turned amber at 10 or fewer.
const FEW_SEATS_LEFT = 10;

function TripLivePreview({
  wizard,
  setWizard,
  updateHotel,
  addDay,
  updateDay,
  removeDay,
  onUploadImage,
  uploadingImage,
  company,
  locale,
  W,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
  updateHotel: (city: "makkah" | "madinah", patch: Partial<WizardHotel>) => void;
  addDay: () => void;
  updateDay: (index: number, patch: Partial<WizardState["itinerary"][number]>) => void;
  removeDay: (index: number) => void;
  onUploadImage: (file?: File) => Promise<void>;
  uploadingImage: boolean;
  company: Company;
  locale: "ku" | "ar" | "en";
  W: typeof wizardT["en"];
}) {
  const minDeparture = earliestDepartureDate();
  const totalNights = wizard.hotels.reduce((sum, hotel) => sum + hotel.nights, 0);
  const totalDays = totalNights + 1;
  const capacityNum = Number(wizard.capacity || 0);
  // Remaining, not total: on a trip that already has bookings the two differ,
  // and the app shows remaining. seats_reserved never changes from this screen.
  const seatsLeft = Math.max(0, capacityNum - Number(wizard.seats_reserved || 0));
  const priceNum = Number(wizard.package_price_iqd || 0);
  const depositNum = Number(wizard.deposit_iqd || 0);
  const maxStar = Math.max(3, ...wizard.hotels.map((hotel) => hotel.star_rating || 3));
  const [starOpen, setStarOpen] = useState(false);

  // The trip length is driven by hotel nights, so keep the return date in sync
  // with the departure date automatically instead of asking for it separately.
  useEffect(() => {
    if (!wizard.departure_date) return;
    // A 10-day / 9-night trip departing the 21st returns on the 30th, so the
    // return date is offset by the night count, not the day count.
    const wanted = addDays(wizard.departure_date, totalNights);
    if (wizard.return_date !== wanted) setWizard((current) => ({ ...current, return_date: wanted }));
  }, [wizard.departure_date, wizard.return_date, totalNights, setWizard]);

  function handleStarChange(value: string) {
    const stars = Number(value);
    wizard.hotels.forEach((hotel) => updateHotel(hotel.city, { star_rating: stars }));
  }

  // Trip length is stored as hotel nights, so editing the days count spreads the
  // resulting nights back across the hotels (keeping their existing proportions).
  function setTotalDays(days: number) {
    const targetNights = Math.max(0, Math.min(59, Math.round(days || 1) - 1));
    if (targetNights === totalNights || !wizard.hotels.length) return;
    let allocated = 0;
    wizard.hotels.forEach((hotel, index) => {
      const isLast = index === wizard.hotels.length - 1;
      let nights: number;
      if (isLast) {
        nights = Math.max(0, targetNights - allocated);
      } else if (totalNights > 0) {
        nights = Math.max(0, Math.round((targetNights * hotel.nights) / totalNights));
      } else {
        nights = Math.floor(targetNights / wizard.hotels.length);
      }
      allocated += nights;
      updateHotel(hotel.city, { nights });
    });
  }

  return (
    <section className="trip-live-preview">
      <p className="trip-live-tag"><Eye size={13} /> {W.livePreviewTag}</p>
      <p className="trip-live-hint">{W.livePreviewHint}</p>

      <div className="trip-live-card">
        <div className="trip-live-hero" style={wizard.image_url ? { backgroundImage: `url("${wizard.image_url}")` } : undefined}>
          <div className="trip-live-hero-top">
            <span className="trip-live-hero-btn"><ArrowLeft size={16} /></span>
            <span className="trip-live-hero-btn"><Heart size={16} /></span>
          </div>
          <label className="trip-live-hero-upload">
            {uploadingImage ? <TawafLoadingSpinner size={16} /> : <Upload size={16} />}
            <span>{wizard.image_url ? W.replaceImage : W.addCover}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingImage} onChange={(event) => onUploadImage(event.target.files?.[0])} />
          </label>
          <div className="trip-live-hero-bottom">
            <div className="trip-live-agency-row">
              <span>{company.name}</span>
              {/* Mirrors the app hero, where the agency name became the trip's
                  only link to the agency page. Decoration here: in a preview the
                  agency is the person looking at it. */}
              <ChevronRight size={12} className="trip-live-agency-chevron" aria-hidden="true" />
              <i title={W.verifiedBadge}><BadgeCheck size={12} /></i>
              <i title={W.topRatedBadge}><Star size={12} /></i>
              <i title={W.fastResponderBadge}><Zap size={12} /></i>
            </div>
            <input className="trip-live-title-input" dir={locale === "en" ? "ltr" : "rtl"} value={wizard.title} onChange={(event) => setWizard((current) => ({ ...current, title: event.target.value }))} placeholder={W.tripTitlePh} />
            <div className="trip-live-hero-date">
              <span>{wizard.transport === "plane" ? wizard.departure_airport : (wizard.pickup_point || W.byCoach)}</span>
              <span>·</span>
              <input type="date" min={minDeparture} value={wizard.departure_date} onChange={(event) => setWizard((current) => ({ ...current, departure_date: event.target.value }))} />
            </div>
          </div>
        </div>

        <div className="trip-live-body">
          <div className="trip-live-facts">
            <div className="trip-live-fact">
              <span className="ic"><CalendarDays size={18} /></span>
              <b><input type="number" min={1} max={60} value={totalDays} onChange={(event) => setTotalDays(Number(event.target.value))} /> {W.daysWord}</b>
              <small>{totalNights} {W.nights}</small>
              <div className="trip-live-stepper-row">
                <button type="button" onClick={() => setTotalDays(totalDays - 1)} disabled={totalDays <= 1} aria-label="−"><Minus size={13} /></button>
                <button type="button" onClick={() => setTotalDays(totalDays + 1)} disabled={totalDays >= 60} aria-label="+"><Plus size={13} /></button>
              </div>
            </div>
            <div className="trip-live-fact trip-live-fact-toggle" role="button" tabIndex={0} title={wizard.transport === "plane" ? W.byCoach : W.byPlane} onClick={() => setWizard((current) => ({ ...current, transport: current.transport === "plane" ? "bus" : "plane" }))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setWizard((current) => ({ ...current, transport: current.transport === "plane" ? "bus" : "plane" })); } }}>
              <span className="ic">{wizard.transport === "plane" ? <Plane size={18} /> : <Building2 size={18} />}</span>
              <b>{wizard.transport === "plane" ? W.byPlane : W.byCoach}</b>
              <input className="trip-live-fact-sub-input" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} value={wizard.transport === "plane" ? wizard.airline_name : wizard.bus_company} onChange={(event) => setWizard((current) => ({ ...current, [current.transport === "plane" ? "airline_name" : "bus_company"]: event.target.value } as Partial<WizardState>))} placeholder={wizard.transport === "plane" ? W.airlinePh : W.busCompanyPh} />
            </div>
            <div className="trip-live-fact gold trip-live-fact-toggle" role="button" tabIndex={0} aria-haspopup="listbox" aria-expanded={starOpen} onClick={() => setStarOpen((open) => !open)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setStarOpen((open) => !open); } else if (event.key === "Escape") { setStarOpen(false); } }}>
              <span className="ic"><Hotel size={18} /></span>
              <b dir="ltr">{maxStar}-Star</b>
              <small>{W.hotelWord}</small>
              {starOpen && <>
                <div className="trip-live-menu-backdrop" onClick={(event) => { event.stopPropagation(); setStarOpen(false); }} />
                <div className="trip-live-pop-menu" role="listbox" onClick={(event) => event.stopPropagation()}>
                  {[5, 4, 3].map((star) => <button type="button" role="option" aria-selected={maxStar === star} key={star} className={maxStar === star ? "active" : ""} onClick={() => { handleStarChange(String(star)); setStarOpen(false); }}>{star}-Star</button>)}
                </div>
              </>}
            </div>
          </div>

          <div className="trip-live-section">
            <h3>{W.overviewTitle}</h3>
            <textarea rows={3} value={wizard.overview} onChange={(event) => setWizard((current) => ({ ...current, overview: event.target.value }))} placeholder={W.primaryDescriptionPh} />
          </div>

          <div className="trip-live-section">
            <h3>{W.accommodationTitle}</h3>
            <div className="trip-live-accom-card">
              {wizard.hotels.map((hotel) => <div className="trip-live-accom-row" key={hotel.city}>
                <span className="ic"><Hotel size={18} /></span>
                <div>
                  <small>{hotel.city === "makkah" ? W.makkahHotel : W.madinahHotel}</small>
                  <input className="trip-live-strong-input" value={hotel.name} onChange={(event) => updateHotel(hotel.city, { name: event.target.value })} placeholder={W.hotelName} />
                  <div className="trip-live-accom-meta">
                    <input value={hotel.description} onChange={(event) => updateHotel(hotel.city, { description: event.target.value })} placeholder={W.hotelDescriptionPh} />
                    <span>· <input type="number" min={0} value={hotel.nights} onChange={(event) => updateHotel(hotel.city, { nights: Number(event.target.value) })} /> {W.nights}</span>
                  </div>
                  <div className="trip-live-accom-foot">
                    <span className="stars">{"★".repeat(hotel.star_rating)}{"☆".repeat(Math.max(0, 5 - hotel.star_rating))}</span>
                    <span>· <input type="number" min={0} value={hotel.distance_from_haram_m} onChange={(event) => updateHotel(hotel.city, { distance_from_haram_m: Number(event.target.value) })} />m {(hotel.city === "makkah" ? W.distanceHaram : W.distanceNabawi).split("(")[0]}</span>
                  </div>
                </div>
              </div>)}
            </div>
          </div>

          <div className="trip-live-section">
            <h3>{W.transportationTitle}</h3>
            <div className="trip-live-transport-card">
              <div className="trip-live-transport-main">
                <span className="ic">{wizard.transport === "plane" ? <Plane size={18} /> : <Building2 size={18} />}</span>
                <div>
                  <b>{wizard.transport === "plane" ? `${W.byPlane} · ${wizard.flight_type === "direct" ? W.flightDirect : W.flightConnecting}` : W.byCoach}</b>
                  <small>{(wizard.transport === "plane" ? wizard.airline_name : wizard.bus_company) || "—"} · {W.groundTransfersIncluded}</small>
                </div>
              </div>
              <div className="trip-live-transport-pills">
                {wizard.transport === "plane" ? <>
                  <LiveSelect icon={Plane} value={wizard.departure_airport} onChange={(value) => setWizard((current) => ({ ...current, departure_airport: value as WizardState["departure_airport"] }))} options={[["EBL", "Erbil (EBL)"], ["BGW", "Baghdad (BGW)"], ["ISU", "Sulaymaniyah (ISU)"]]} className="bordered" />
                  <button type="button" className={`trip-live-pill toggle ${wizard.flight_type === "direct" ? "active" : ""}`} onClick={() => setWizard((current) => ({ ...current, flight_type: current.flight_type === "direct" ? "connecting" : "direct" }))}>{wizard.flight_type === "direct" ? W.flightDirect : W.flightConnecting}</button>
                </> : <input className="trip-live-pill" value={wizard.pickup_point} onChange={(event) => setWizard((current) => ({ ...current, pickup_point: event.target.value }))} placeholder={W.pickupPointPh} />}
                <button type="button" className={`trip-live-pill toggle ${wizard.bus_between_cities ? "active" : ""}`} onClick={() => setWizard((current) => ({ ...current, bus_between_cities: !current.bus_between_cities }))}>{W.busBetween}</button>
                {wizard.transport === "plane" && <button type="button" className={`trip-live-pill toggle ${wizard.airport_transfers ? "active" : ""}`} onClick={() => setWizard((current) => ({ ...current, airport_transfers: !current.airport_transfers }))}>{W.airportTransfers}</button>}
              </div>
            </div>
          </div>

          <div className="trip-live-section">
            <h3>{W.itineraryTitle}</h3>
            <div className="trip-live-itinerary">
              {wizard.itinerary.map((day, index) => <div className="trip-live-day" key={index}>
                <span className="dot" />
                <div>
                  <div className="trip-live-day-head"><span>{W.dayWord} {index + 1}</span>{wizard.itinerary.length > 1 && <button type="button" onClick={() => removeDay(index)} aria-label={`Remove day ${index + 1}`}><Trash2 size={13} /></button>}</div>
                  <input value={day.title} onChange={(event) => updateDay(index, { title: event.target.value })} placeholder={W.dayTitlePh} />
                  <textarea rows={1} value={day.summary} onChange={(event) => updateDay(index, { summary: event.target.value })} placeholder={W.daySummaryPh} />
                </div>
              </div>)}
            </div>
            <button type="button" className="trip-live-add-day" onClick={addDay}><Plus size={14} /> {W.addDay}</button>
          </div>

          <div className="trip-live-section">
            <h3>{W.includedTitle}</h3>
            <div className="trip-live-included">
              {inclusionOptions.map(([key]) => <label className={wizard.inclusions[key] ? "active" : ""} key={key}>
                <input type="checkbox" checked={Boolean(wizard.inclusions[key])} onChange={(event) => setWizard((current) => ({ ...current, inclusions: { ...current.inclusions, [key]: event.target.checked } }))} />
                <span>{wizard.inclusions[key] ? <Check size={14} /> : <Plus size={14} />}</span>
                {W[inclusionKeyToLabel[key]] as string}
              </label>)}
            </div>
          </div>

          <div className="trip-live-section">
            <h3>{W.trustTitle}</h3>
            <div className="trip-live-trust">
              <b>{W.cancellationPolicy.replace(" *", "")}</b>
              <textarea rows={2} value={wizard.cancellation_policy} onChange={(event) => setWizard((current) => ({ ...current, cancellation_policy: event.target.value }))} placeholder={W.cancellationPolicyPh} />
              <div className="trip-live-trust-row"><Banknote size={14} /> {W.depositAmount.replace(" (IQD)", "")}: <input type="number" min={0} value={wizard.deposit_iqd} onChange={(event) => setWizard((current) => ({ ...current, deposit_iqd: event.target.value }))} /> IQD</div>
              <label className="trip-live-trust-toggle"><input type="checkbox" checked={wizard.non_refundable_deposit} onChange={(event) => setWizard((current) => ({ ...current, non_refundable_deposit: event.target.checked }))} /> {W.nonRefundable}</label>
            </div>
          </div>

          <div className="trip-live-price-card">
            <div><span>{W.packagePerPerson}</span><span className="trip-live-price-input"><input type="number" min={1} value={wizard.package_price_iqd} onChange={(event) => setWizard((current) => ({ ...current, package_price_iqd: event.target.value }))} placeholder="1500000" /> IQD</span></div>
            {depositNum > 0 && <div><span>{W.depositAmount}</span><span>{formatIqd(depositNum)}</span></div>}
            <hr />
            <div className="total"><span>{W.totalFrom}</span><strong>{formatIqd(priceNum)}</strong></div>
          </div>

          <div className="trip-live-footer">
            <div>
              <small>{W.startingFrom}</small>
              <strong>{formatIqd(priceNum)}</strong>
              {seatsLeft > 0 && (
                <span className={`trip-live-seats ${seatsLeft <= FEW_SEATS_LEFT ? "few" : ""}`}>
                  {seatsLeft <= FEW_SEATS_LEFT
                    ? W.onlySeatsLeft.replace("{count}", String(seatsLeft))
                    : `${seatsLeft} ${W.seatsRemaining}`}
                </span>
              )}
            </div>
            <span className="trip-live-book-btn">{seatsLeft > 0 ? W.bookThisTrip : W.soldOutWord}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
