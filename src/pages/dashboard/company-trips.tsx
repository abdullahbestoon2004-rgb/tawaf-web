/* eslint-disable @typescript-eslint/no-explicit-any */

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
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Hotel,
  Image as ImageIcon,
  LoaderCircle,
  MapPin,
  Pencil,
  Plane,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";

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
  travellers: number;
  total_iqd: number;
  amount_paid_iqd: number;
  operational_stage: string;
  pay_method: string;
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
  passport_no: string | null;
  document_status: string;
  visa_status: string;
  phone: string | null;
  transport_seat: string | null;
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
    createSubmitOperate: "گشت گەشتەکانی عومرە دروست بکە، پێشکەش بکە و بەڕێوەبەرە لە یەک شوێنەوە.",
    createNewTrip: "گەشتی نوێ دروست بکە",
    totalTrips: "کۆی گەشتەکان",
    published: "بڵاوکراوەتەوە",
    underReview: "لەژێر پێداچوونەوەدایە",
    reservedSeats: "شوێنە گیراوەکان",
    searchTripCarrier: "گەڕان بەپێی گەشت، فرۆکەخانە یان هێڵی ئاسمانی...",
    allStatus: "هەموو دۆخەکان",
    allTiers: "هەموو ئاستەکان",
    selectDepartureDate: "ڕێکەوتی بەڕێ کەوتن دیاری بکە",
    duplicate: "کۆپیکردن",
    editTrip: "دەستکاری گەشت",
    allTrips: "هەموو گەشتەکان",
    overview: "پوختە",
    bookings: "حیجزەکان",
    travellers: "گەشتیاران",
    documents: "بەڵگەنامەکان",
    financials: "دارایی",
    loadingTrips: "بارکردنی چالاکییەکانی گەشت...",
    adminFeedback: "تێبینی بەڕێوەبەر",
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
    departureAirport: "فڕۆکەخانەی بەڕێ کەوتن",
    duration: "ماوە",
    startingPrice: "نرخی سەرەکی",
    capacity: "توانا/شوێن",
    status: "دۆخ",
    actions: "کردارەکان",
    searchPlaceholder: "گەڕان بەپێی گەشت، فڕۆکەخانە یان هێڵی ئاسمانی...",
    tryFilters: "هەوڵ بدە فلتەرەکان بگۆڕیت.",
    createTripDraftBtn: "یەکەم ڕەشنووسی گەشتت دروست بکە بۆ دەستپێکردن."
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
    createTripDraftBtn: "أنشئ أول مسودة رحلة للبدء."
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
    createTripDraftBtn: "Create your first Umrah trip draft to get started."
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
      ["پێداچوونەوە", "پێشبینینی زیارەتکار و ناردن"],
    ],
    backToTrips: "گەڕانەوە بۆ گەشتەکان", proposingChanges: "پێشنیاری گۆڕانکاری گەشت", editingDraft: "دەستکاری ڕەشنووس", newTripDraft: "ڕەشنووسی گەشتی نوێ", untitled: "گەشتی عومرەی بێ ناونیشان",
    originalUnchanged: "ئەسڵەکە بەبێ گۆڕانکاری دەمێنێتەوە", savedLabel: "پاشەکەوت کرا", secureDraft: "ڕەشنووسی پارێزراو",
    requestChangesTag: "داواکاری گۆڕانکاری", createTripTag: "دروستکردنی گەشت", stepWord: "هەنگاوی", ofWord: "لە",
    adminProtected: "پارێزراوە لەلایەن بەڕێوەبەرەوە", adminNoteApproval: "گەشتە بڵاوکراوەکەت ناگۆڕدرێت هەتا تەواف ئەم داواکارییە پەسەند نەکات.", adminNoteNormal: "تەواف پێداچوونەوە بە هەموو گەشتێکدا دەکات پێش ئەوەی زیارەتکاران بتوانن حیجزی بکەن.",
    tripIdentity: "ناسنامەی گەشت", tripIdentityDesc: "ناونیشانێکی ڕوون بەکاربهێنە کە زیارەتکاران خێرا تێی بگەن.",
    tripTitle: "ناونیشانی گەشت *", tripTitlePh: "عومرەی ڕەمەزان لە هەولێرەوە", englishTitle: "ناونیشانی ئینگلیزی", arabicTitle: "ناونیشانی عەرەبی",
    packageTier: "ئاستی پاکێج", tierEconomy: "ئابووری", tierStandard: "ئاسایی", tierVip: "تایبەت (VIP)",
    tripType: "جۆری گەشت", typeGroup: "بە کۆمەڵ", typeFamily: "خێزانی", typeIndividual: "تاکەکەسی",
    season: "وەرز", seasonRegular: "ئاسایی", seasonRamadan: "ڕەمەزان", seasonShawwal: "شەوال", seasonOther: "هیتر",
    totalSeats: "کۆی شوێنەکان *",
    schedule: "خشتەی کات", scheduleDesc: "بەرواری گەشتە بڵاوکراوەکان دوای حیجزکردن دەپارێزرێن.",
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
    hotelName: "ناوی هۆتێل *", starRating: "پلەی ئەستێرە", starsWord: "ئەستێرە", nights: "شەو", distanceHaram: "دووری لە حەرەمەوە (مەتر)",
    hotelDescription: "پێناسەی هۆتێل *", hotelDescriptionPh: "شوێن، ژوورەکان، ژەمەکان و زانیاری گواستنەوە…",
    priceTitle: "نرخی پاکێج", priceDesc: "یەک نرخی تەواو بۆ هەر زیارەتکارێک دابنێ. مانەوەی هۆتێل پێشتر لە پاکێجەکەدا لەخۆگیراوە.",
    pricePerPilgrim: "نرخ بۆ هەر زیارەتکارێک (IQD) *", depositAmount: "بڕی پێشەکی (IQD)", mealsPerDay: "ژەم لە ڕۆژێکدا", depositTerms: "مەرجەکانی پێشەکی", depositTermsPh: "کەی بڕە ماوەکە دەدرێت…",
    servicesTitle: "خزمەتگوزارییە لەخۆگیراوەکان", servicesDesc: "بە ڕوونی پیشانی زیارەتکاران بدە نرخەکەیان چی دەگرێتەوە.",
    customerPrice: "نرخی کڕیار", customerPriceSub: "نرخی تەواوی پاکێج", tawafCommission: "کۆمسیۆنی تەواف", tawafCommissionSub: "خەمڵێنراو بە ٥٪", companyNet: "خەمڵێنراوی داهاتی کۆمپانیا", companyNetSub: "پێش کرێی دەروازەی پارەدان",
    itineraryTitle: "بەرنامەی ڕۆژانە", itineraryDesc: "هەر ڕۆژێک کورت، بەسوود و ئاسان بێت بۆ خوێندنەوەی زیارەتکاران.",
    dayWord: "ڕۆژی", dayTitlePh: "گەیشتن و چوونەژوورەوەی هۆتێل", daySummaryPh: "چالاکییە سەرەکییەکان باس بکە…", addDay: "زیادکردنی ڕۆژ", 
    policiesTitle: "سیاسەتەکان", policiesDesc: "سیاسەتی هەڵوەشاندنەوە پێویستە پێش پێداچوونەوە.",
    cancellationPolicy: "سیاسەتی هەڵوەشاندنەوە و گەڕاندنەوەی پارە *", cancellationPolicyPh: "کاتە دیاریکراوەکان، کرێکان، گەڕاندنەوەی پارە و مەرجەکانی ڕەتکردنەوەی ڤیزا ڕوون بکەرەوە…",
    videoUrl: "بەستەری ڤیدیۆی ناساندن", nonRefundable: "پێشەکییەکە ناگەڕێندرێتەوە", nonRefundableSub: "دڵنیابە ئەمە بە ڕوونی لە سیاسەتەکەدا باسکراوە.",
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
    hotelName: "اسم الفندق *", starRating: "تصنيف النجوم", starsWord: "نجوم", nights: "ليالٍ", distanceHaram: "المسافة عن الحرم (متر)",
    hotelDescription: "وصف الفندق *", hotelDescriptionPh: "الموقع والغرف والوجبات ومعلومات النقل…",
    priceTitle: "سعر الباقة", priceDesc: "حدد سعراً كاملاً واحداً لكل معتمر. الإقامة الفندقية مشمولة في الباقة.",
    pricePerPilgrim: "السعر لكل معتمر (IQD) *", depositAmount: "مبلغ العربون (IQD)", mealsPerDay: "الوجبات في اليوم", depositTerms: "شروط العربون", depositTermsPh: "متى يستحق المبلغ المتبقي…",
    servicesTitle: "الخدمات المشمولة", servicesDesc: "أظهر للمعتمرين بوضوح ما يغطيه السعر.",
    customerPrice: "سعر العميل", customerPriceSub: "سعر الباقة الكامل", tawafCommission: "عمولة طواف", tawafCommissionSub: "تقديرياً ٥٪", companyNet: "صافي الشركة التقديري", companyNetSub: "قبل رسوم بوابة الدفع",
    itineraryTitle: "البرنامج اليومي", itineraryDesc: "اجعل كل يوم قصيراً ومفيداً وسهل القراءة للمعتمرين.",
    dayWord: "اليوم", dayTitlePh: "الوصول وتسجيل الدخول في الفندق", daySummaryPh: "صف الأنشطة الرئيسية…", addDay: "إضافة يوم",
    policiesTitle: "السياسات", policiesDesc: "سياسة الإلغاء مطلوبة قبل المراجعة.",
    cancellationPolicy: "سياسة الإلغاء والاسترداد *", cancellationPolicyPh: "اشرح المواعيد النهائية والرسوم والاسترداد وشروط رفض التأشيرة…",
    videoUrl: "رابط فيديو تعريفي", nonRefundable: "العربون غير قابل للاسترداد", nonRefundableSub: "تأكد من شرح ذلك بوضوح في السياسة.",
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
    hotelName: "Hotel name *", starRating: "Star rating", starsWord: "stars", nights: "Nights", distanceHaram: "Distance from Haram (metres)",
    hotelDescription: "Hotel description *", hotelDescriptionPh: "Location, rooms, meals and shuttle information…",
    priceTitle: "Package price", priceDesc: "Set one complete price per pilgrim. Hotel accommodation is already included in the package.",
    pricePerPilgrim: "Price per pilgrim (IQD) *", depositAmount: "Deposit amount (IQD)", mealsPerDay: "Meals per day", depositTerms: "Deposit terms", depositTermsPh: "When the remaining balance is due…",
    servicesTitle: "Included services", servicesDesc: "Clearly show pilgrims what their price covers.",
    customerPrice: "Customer price", customerPriceSub: "Complete package price", tawafCommission: "Tawaf commission", tawafCommissionSub: "Estimated at 5%", companyNet: "Estimated company net", companyNetSub: "Before gateway fees",
    itineraryTitle: "Daily itinerary", itineraryDesc: "Keep each day short, useful and easy for pilgrims to scan.",
    dayWord: "Day", dayTitlePh: "Arrival and hotel check-in", daySummaryPh: "Describe the main activities…", addDay: "Add itinerary day",
    policiesTitle: "Policies", policiesDesc: "A cancellation policy is required before review.",
    cancellationPolicy: "Cancellation and refund policy *", cancellationPolicyPh: "Explain deadlines, fees, refunds and visa rejection terms…",
    videoUrl: "Introduction video URL", nonRefundable: "Deposit is non-refundable", nonRefundableSub: "Make sure this is explained clearly in the policy.",
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

const wizardSteps = [
  ["Basics", "Trip identity, dates and capacity"],
  ["Journey", "Flights, buses and transfers"],
  ["Hotels", "Makkah and Madinah stay"],
  ["Price & inclusions", "Package price and included services"],
  ["Program", "Daily itinerary and policies"],
  ["Review", "Customer preview and submission"],
] as const;

function formatIqd(value: number | string | null | undefined) {
  return `${Math.round(Number(value ?? 0)).toLocaleString("en-US")} IQD`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

export default function CompanyTripsWorkspace({ company, trips, changeRequests, bookings, commissions, payments, busy, runAction, askReason, locale }: Props) {
  const tt = tripTranslations[locale];
  const [view, setView] = useState<"list" | "manage" | "wizard">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<TripDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [tab, setTab] = useState<"overview" | "bookings" | "travellers" | "documents" | "financials">("overview");
  const [wizard, setWizard] = useState<WizardState>(() => defaultWizard());
  const [step, setStep] = useState(0);
  const [wizardError, setWizardError] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [changeRequestMode, setChangeRequestMode] = useState(false);

  const selectedTrip = trips.find((trip) => trip.id === selectedId) ?? null;
  const selectedPendingRequest = changeRequests.find((request) => request.package_id === selectedId && request.status === "pending") ?? null;
  const selectedBookings = bookings.filter((booking) => booking.package_id === selectedId);
  const selectedBookingIds = new Set(selectedBookings.map((booking) => booking.id));

  const filteredTrips = useMemo(() => trips.filter((trip) => {
    const matchesQuery = `${trip.title} ${trip.departure_airport ?? ""} ${trip.airline_name ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || trip.lifecycle_status === statusFilter;
    const matchesTier = tierFilter === "all" || trip.package_tier === tierFilter;
    const matchesDate = !dateFilter || trip.departure_date === dateFilter;
    return matchesQuery && matchesStatus && matchesTier && matchesDate;
  }), [trips, query, statusFilter, tierFilter, dateFilter]);

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
      bookingIds.length ? supabase.from("booking_travellers").select("*").in("booking_id", bookingIds).order("created_at") : Promise.resolve({ data: [], error: null }),
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
    setStep(0);
    setWizardError("");
    setSavedAt("");
    setView("wizard");
  }

  function openCreate() {
    setWizard(defaultWizard());
    setSelectedId(null);
    setChangeRequestMode(false);
    setStep(0);
    setWizardError("");
    setSavedAt("");
    setView("wizard");
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

  async function saveDraft(quiet = false) {
    if (!wizard.title.trim()) {
      setWizardError(wizardT[locale].errTitle);
      setStep(0);
      return null;
    }
    setWizardError("");
    if (changeRequestMode) {
      setSavedAt("Ready for approval request");
      return wizard.id;
    }
    const payload = bundlePayload(wizard);
    const result = await runAction(
      "trip-wizard-save",
      () => wizard.id
        ? getSupabase().rpc("update_offer_bundle", {
            p_offer_id: wizard.id,
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
    const id = wizard.id ?? result.data;
    if (id) {
      setWizard((current) => ({ ...current, id }));
      setSelectedId(id);
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }
    return id as string | null;
  }

  async function goNext() {
    if (step < wizardSteps.length - 1) setStep((current) => current + 1);
  }

  const completion = useMemo(() => {
    const hotelNights = wizard.hotels.reduce((sum, hotel) => sum + Number(hotel.nights || 0), 0);
    const W = wizardT[locale];
    return [
      { label: W.cTitleDesc, done: Boolean(wizard.title.trim() && wizard.overview.trim()) },
      { label: W.cDates, done: Boolean(wizard.departure_date && wizard.return_date && wizard.departure_date >= new Date().toISOString().slice(0, 10) && wizard.return_date >= wizard.departure_date) },
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
        setView("list");
        setSelectedId(null);
        setChangeRequestMode(false);
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
      setView("list");
      setSelectedId(null);
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
      if (!wizard.title.trim()) {
        setWizardError(wizardT[locale].errTitleImage);
        return;
      }
      draftId = await saveDraft(true);
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
    setWizard((current) => ({ ...current, image_url: imageUrl }));
    setUploadingImage(false);
  }

  async function pauseTrip(trip: Trip) {
    const reason = await askReason(locale === "ku" ? "بۆچی حیجزکردن بۆ ئەم گەشتە دادەخەیت؟" : locale === "ar" ? "لماذا تغلق الحجوزات لهذه الرحلة؟" : "Why are you closing bookings for this trip?");
    if (!reason) return;
    await runAction(
      `trip-change-${trip.id}`,
      () => getSupabase().rpc("request_trip_change", {
        p_package_id: trip.id,
        p_request_type: "pause",
        p_fields: {},
        p_itinerary: [],
        p_pricing: [],
        p_hotels: [],
        p_inclusions: [],
        p_reason: reason,
      }),
      "Pause request sent to Tawaf for admin approval.",
    );
  }

  async function deleteDraft(trip: Trip) {
    const reason = await askReason(locale === "ku" ? `بۆچی «${trip.title}» بسڕدرێتەوە؟` : locale === "ar" ? `لماذا يجب إزالة «${trip.title}»؟` : `Why should “${trip.title}” be removed?`);
    if (!reason) return;
    const result = await runAction(
      `trip-change-${trip.id}`,
      () => getSupabase().rpc("request_trip_change", {
        p_package_id: trip.id,
        p_request_type: "remove",
        p_fields: {},
        p_itinerary: [],
        p_pricing: [],
        p_hotels: [],
        p_inclusions: [],
        p_reason: reason,
      }),
      "Removal request sent to Tawaf for admin approval.",
    );
    if (result) {
      setView("list");
      setSelectedId(null);
    }
  }

  if (view === "wizard") {
    return (
      <TripWizard
        wizard={wizard}
        setWizard={setWizard}
        step={step}
        setStep={setStep}
        error={wizardError}
        savedAt={savedAt}
        busy={busy}
        uploadingImage={uploadingImage}
        completion={completion}
        canSubmit={canSubmit}
        onBack={() => setView(wizard.id ? "manage" : "list")}
        onSave={() => saveDraft(false)}
        onContinue={goNext}
        onSubmit={submitForReview}
        onUploadImage={uploadMainImage}
        updateHotel={updateHotel}
        approvalMode={changeRequestMode}
        locale={locale}
      />
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

        {selectedTrip.review_reason && <div className="trip-review-banner"><FileText size={19} /><div><b>{tt.adminFeedback}</b><p>{selectedTrip.review_reason}</p></div>{canEdit && <button type="button" onClick={() => openEdit(selectedTrip)}>{tt.resolveFeedback}</button>}</div>}
        {selectedPendingRequest && <div className="trip-review-banner pending"><ShieldCheck size={19} /><div><b>Waiting for admin approval</b><p>Your {selectedPendingRequest.request_type} request is pending. The current trip stays unchanged until Tawaf reviews it.</p></div><Status value="pending" /></div>}

        <nav className="trip-tabs" aria-label="Trip management">
          {([
            ["overview", tt.overview, Eye],
            ["bookings", tt.bookings, BookOpenCheck],
            ["travellers", tt.travellers, Users],
            ["documents", tt.documents, FileCheck2],
            ["financials", tt.financials, WalletCards],
          ] as const).map(([id, label, Icon]) => (
            <button type="button" key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              <Icon size={16} /> {label}
              {id === "bookings" && tripBookings.length > 0 && <i>{tripBookings.length}</i>}
            </button>
          ))}
        </nav>

        {detailsLoading ? <div className="trip-detail-loading"><LoaderCircle className="spin" size={22} /> {tt.loadingTrips}</div> : (
          <TripManagementTab
            tab={tab}
            trip={selectedTrip}
            details={details}
            bookings={tripBookings}
            commissions={commissions.filter((item) => selectedBookingIds.has(item.booking_id))}
            payments={payments.filter((item) => selectedBookingIds.has(item.booking_id))}
            busy={busy}
            runAction={runAction}
            onEdit={() => openEdit(selectedTrip)}
            onSubmit={() => runAction(`trip-${selectedTrip.id}`, () => getSupabase().rpc("submit_package", { p_package_id: selectedTrip.id }), locale === "ku" ? "گەشتەکە پێشکەش کرا بۆ پێداچوونەوە." : locale === "ar" ? "تم إرسال الرحلة للمراجعة." : "Trip submitted for review.")}
            onPause={() => pauseTrip(selectedTrip)}
            onDelete={() => deleteDraft(selectedTrip)}
            canEdit={canEdit}
            hasPendingRequest={Boolean(selectedPendingRequest)}
          />
        )}
      </>
    );
  }

  const published = trips.filter((trip) => trip.lifecycle_status === "published").length;
  const underReview = trips.filter((trip) => trip.lifecycle_status === "pending_review").length;
  const totalSeats = trips.reduce((sum, trip) => sum + Number(trip.capacity ?? 0), 0);
  const bookedSeats = trips.reduce((sum, trip) => sum + Number(trip.seats_reserved ?? 0), 0);

  return (
    <>
      <div className="portal-page-heading">
        <div><p>{tt.tripCatalogue}</p><h1>{tt.trips}</h1><span>{tt.createSubmitOperate}</span></div>
        <button className="portal-primary-button" type="button" onClick={openCreate}><Plus size={16} /> {tt.createNewTrip}</button>
      </div>

      <section className="trip-summary-grid">
        <div><span className="green"><Plane size={18} /></span><div><b>{trips.length}</b><small>{tt.totalTrips}</small></div></div>
        <div><span className="gold"><BadgeCheck size={18} /></span><div><b>{published}</b><small>{tt.published}</small></div></div>
        <div><span className="teal"><Clock3 size={18} /></span><div><b>{underReview}</b><small>{tt.underReview}</small></div></div>
        <div><span className="sand"><Users size={18} /></span><div><b>{bookedSeats}/{totalSeats || 0}</b><small>{tt.reservedSeats}</small></div></div>
      </section>

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

      <section className="portal-panel trip-table-panel">
        <div className="portal-table-wrap">
          <table className="portal-table trip-list-table">
            <thead>
              <tr>
                <th>{tt.tripName}</th>
                <th>{locale === "ku" ? "بەڕێ کەوتن" : locale === "ar" ? "المغادرة" : "Departure"}</th>
                <th>{tt.duration}</th>
                <th>{tt.startingPrice}</th>
                <th>{tt.capacity}</th>
                <th>{tt.status}</th>
                <th className="right">{tt.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrips.map((trip) => {
                const reserved = Number(trip.seats_reserved ?? 0);
                const capacity = Number(trip.capacity ?? 0);
                const fill = capacity ? Math.round((reserved / capacity) * 100) : 0;
                return (
                  <tr key={trip.id} onClick={() => openManage(trip)}>
                    <td><div className="trip-table-name"><span style={trip.image_url ? { backgroundImage: `url("${trip.image_url}")` } : undefined}>{!trip.image_url && <Plane size={18} />}</span><div><b>{trip.title}</b><small>{tt[trip.package_tier as keyof typeof tt] || titleCase(trip.package_tier ?? "standard")} · {locale === "ku" ? (trip.group_type === "family" ? "خێزانی" : trip.group_type === "individual" ? "تاکەکەسی" : "کۆمەڵە") : locale === "ar" ? (trip.group_type === "family" ? "عائلي" : trip.group_type === "individual" ? "فردي" : "مجموعة") : titleCase(trip.group_type ?? "group")}</small></div></div></td>
                    <td><b>{trip.departure_airport || "TBA"}</b><span className="portal-cell-sub">{formatDate(trip.departure_date)}</span></td>
                    <td>{trip.days} {locale === "ku" ? "ڕۆژ" : locale === "ar" ? "يوم" : "days"}<span className="portal-cell-sub">{trip.nights} {locale === "ku" ? "شەو" : locale === "ar" ? "ليلة" : "nights"}</span></td>
                    <td><b>{formatIqd(trip.price_iqd)}</b></td>
                    <td><div className="trip-capacity-cell"><span><b>{reserved}</b> / {capacity || "—"}</span><small>{fill}%</small><i><b style={{ width: `${Math.min(100, fill)}%` }} /></i></div></td>
                    <td><Status value={trip.lifecycle_status} /></td>
                    <td className="right"><button type="button" className="portal-icon-button" aria-label={`Manage ${trip.title}`} onClick={(event) => { event.stopPropagation(); openManage(trip); }}><ChevronRight size={16} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filteredTrips.length && (
          <div className="trip-empty">
            <Plane size={24} />
            <h3>{tt.noTripsFound}</h3>
            <p>{trips.length ? tt.tryFilters : tt.createTripDraftBtn}</p>
            {!trips.length && <button type="button" onClick={openCreate}><Plus size={15} /> {tt.createNewTrip}</button>}
          </div>
        )}
      </section>
    </>
  );
}

function TripManagementTab({
  tab,
  trip,
  details,
  bookings,
  commissions,
  payments,
  busy,
  runAction,
  onEdit,
  onSubmit,
  onPause,
  onDelete,
  canEdit,
  hasPendingRequest,
}: {
  tab: "overview" | "bookings" | "travellers" | "documents" | "financials";
  trip: Trip;
  details: TripDetails | null;
  bookings: Booking[];
  commissions: Commission[];
  payments: Payment[];
  busy: string;
  runAction: Props["runAction"];
  onEdit: () => void;
  onSubmit: () => Promise<any>;
  onPause: () => void;
  onDelete: () => void;
  canEdit: boolean;
  hasPendingRequest: boolean;
}) {
  const activeBookings = bookings.filter((booking) => !["cancelled", "rejected", "expired"].includes(booking.operational_stage));
  const bookingIds = new Set(bookings.map((booking) => booking.id));
  const gross = bookings.reduce((sum, booking) => sum + Number(booking.total_iqd), 0);
  const received = payments.filter((payment) => payment.status === "succeeded").reduce((sum, payment) => sum + Number(payment.amount_iqd), 0);
  const commission = commissions.reduce((sum, item) => sum + Number(item.amount_iqd), 0);

  if (tab === "bookings") return (
    <section className="portal-panel trip-operation-panel">
      <div className="portal-panel-header"><div><h2>Trip bookings</h2><p>Only bookings attached to this departure are shown</p></div><span className="portal-period">{bookings.length} records</span></div>
      {bookings.length ? <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Reference</th><th>Travellers</th><th>Total</th><th>Paid</th><th>Method</th><th>Status</th><th className="right">Action</th></tr></thead><tbody>
        {bookings.map((booking) => <tr key={booking.id}><td><b>#{booking.id.slice(0, 8).toUpperCase()}</b><span className="portal-cell-sub">{booking.contact_phone || "No contact"}</span></td><td>{booking.travellers}</td><td>{formatIqd(booking.total_iqd)}</td><td>{formatIqd(booking.amount_paid_iqd)}</td><td>{titleCase(booking.pay_method)}</td><td><Status value={booking.operational_stage} /></td><td className="right"><div className="portal-row-actions">{booking.operational_stage === "requested" && <button type="button" className="approve" disabled={busy === `booking-${booking.id}`} onClick={() => runAction(`booking-${booking.id}`, () => getSupabase().rpc("transition_booking", { p_booking_id: booking.id, p_action: "accept", p_reason: null }), "Booking accepted.")}><Check size={13} /> Accept</button>}</div></td></tr>)}
      </tbody></table></div> : <OperationEmpty icon={BookOpenCheck} title="No bookings yet" text="Bookings will appear here when pilgrims reserve this trip." />}
    </section>
  );

  if (tab === "travellers") return (
    <section className="portal-panel trip-operation-panel">
      <div className="portal-panel-header"><div><h2>Traveller manifest</h2><p>Passenger and visa readiness for this trip</p></div><span className="portal-period">{details?.travellers.length ?? 0} travellers</span></div>
      {details?.travellers.length ? <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Traveller</th><th>Passport</th><th>Booking</th><th>Documents</th><th>Visa</th><th>Seat</th></tr></thead><tbody>
        {details.travellers.map((traveller) => <tr key={traveller.id}><td><div className="trip-person"><span><UserRound size={16} /></span><div><b>{traveller.full_name}</b><small>{traveller.phone || "No phone"}</small></div></div></td><td>{traveller.passport_no || "Not provided"}</td><td>#{traveller.booking_id.slice(0, 8).toUpperCase()}</td><td><Status value={traveller.document_status || "missing"} /></td><td><Status value={traveller.visa_status || "not_started"} /></td><td>{traveller.transport_seat || "Unassigned"}</td></tr>)}
      </tbody></table></div> : <OperationEmpty icon={Users} title="No travellers yet" text="Traveller records appear after a booking is created." />}
    </section>
  );

  if (tab === "documents") {
    const docs = details?.documents.filter((document) => bookingIds.has(document.booking_id)) ?? [];
    return (
      <section className="portal-panel trip-operation-panel">
        <div className="portal-panel-header"><div><h2>Traveller documents</h2><p>Review documents only for pilgrims on this trip</p></div><span className="portal-period">{docs.length} files</span></div>
        {docs.length ? <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Document</th><th>Traveller</th><th>Booking</th><th>Submitted</th><th>Status</th></tr></thead><tbody>
          {docs.map((document) => <tr key={document.id}><td><b>{titleCase(document.kind)}</b></td><td>{details?.travellers.find((traveller) => traveller.id === document.traveller_id)?.full_name ?? "Traveller"}</td><td>#{document.booking_id.slice(0, 8).toUpperCase()}</td><td>{formatDate(document.created_at.slice(0, 10))}</td><td><Status value={document.status} /></td></tr>)}
        </tbody></table></div> : <OperationEmpty icon={FileCheck2} title="No documents submitted" text="Passport, visa and traveller files will be organized here." />}
      </section>
    );
  }

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
            <div className="trip-hotel-summary">{details?.hotels.map((hotel) => <article key={hotel.city}><span><Hotel size={18} /></span><div><small>{titleCase(hotel.city)}</small><b>{hotel.hotels?.name || "Hotel TBA"}</b><p>{hotel.nights} nights · {hotel.distance_from_haram_m}m from Haram</p></div></article>)}</div>
            <div className="trip-itinerary-summary"><h3>Daily itinerary</h3>{details?.itinerary.length ? details.itinerary.map((day) => <div key={day.day_no}><span>{day.day_no}</span><div><b>{day.title}</b><p>{day.summary || "Schedule details to be announced."}</p></div></div>) : <p className="trip-muted">No itinerary added yet.</p>}</div>
          </div>
        </div>
        <aside className="portal-panel trip-quick-actions">
          <div className="portal-panel-header"><div><h2>Trip controls</h2><p>Available for the current status</p></div></div>
          <div>
            {hasPendingRequest && <div className="trip-action-pending"><ShieldCheck size={17} /><span><b>Admin review pending</b><small>More trip requests unlock after Tawaf decides.</small></span></div>}
            {canEdit && <button type="button" onClick={onEdit}><span className="green"><Pencil size={17} /></span><div><b>Edit trip</b><small>{["draft", "needs_changes", "rejected"].includes(trip.lifecycle_status) ? "Update the complete trip bundle" : "Send proposed changes to Tawaf"}</small></div><ChevronRight size={16} /></button>}
            {!hasPendingRequest && ["draft", "needs_changes", "rejected", "paused"].includes(trip.lifecycle_status) && <button type="button" onClick={onSubmit}><span className="gold"><Send size={17} /></span><div><b>Submit for review</b><small>Tawaf admin approval required</small></div><ChevronRight size={16} /></button>}
            {!hasPendingRequest && trip.lifecycle_status === "published" && <button type="button" onClick={onPause}><span className="sand"><X size={17} /></span><div><b>Request booking closure</b><small>Admin approval is required to pause it</small></div><ChevronRight size={16} /></button>}
            {!hasPendingRequest && !["pending_review", "removed"].includes(trip.lifecycle_status) && <button type="button" className="danger" onClick={onDelete}><span><Trash2 size={17} /></span><div><b>Request trip removal</b><small>The trip stays available until approved</small></div><ChevronRight size={16} /></button>}
          </div>
        </aside>
      </section>
    </>
  );
}

function OperationEmpty({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
  return <div className="trip-operation-empty"><span><Icon size={23} /></span><h3>{title}</h3><p>{text}</p></div>;
}

function TripWizard({
  wizard,
  setWizard,
  step,
  setStep,
  error,
  savedAt,
  busy,
  uploadingImage,
  completion,
  canSubmit,
  onBack,
  onSave,
  onContinue,
  onSubmit,
  onUploadImage,
  updateHotel,
  approvalMode,
  locale,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  error: string;
  savedAt: string;
  busy: string;
  uploadingImage: boolean;
  completion: Array<{ label: string; done: boolean }>;
  canSubmit: boolean;
  onBack: () => void;
  onSave: () => Promise<any>;
  onContinue: () => Promise<void>;
  onSubmit: () => Promise<void>;
  onUploadImage: (file?: File) => Promise<void>;
  updateHotel: (city: "makkah" | "madinah", patch: Partial<WizardHotel>) => void;
  approvalMode: boolean;
  locale: "ku" | "ar" | "en";
}) {
  const W = wizardT[locale];
  const commissionRate = 0.05;
  const displayPrice = Number(wizard.package_price_iqd || 0);
  const today = new Date().toISOString().slice(0, 10);
  const BackIcon = locale === "en" ? ArrowLeft : ArrowRight;
  const NextIcon = locale === "en" ? ArrowRight : ArrowLeft;

  function addDay() {
    setWizard((current) => ({ ...current, itinerary: [...current.itinerary, { day_no: current.itinerary.length + 1, title: "", summary: "" }] }));
  }

  function updateDay(index: number, patch: Partial<WizardState["itinerary"][number]>) {
    setWizard((current) => ({ ...current, itinerary: current.itinerary.map((day, dayIndex) => dayIndex === index ? { ...day, ...patch } : day) }));
  }

  function removeDay(index: number) {
    setWizard((current) => ({ ...current, itinerary: current.itinerary.filter((_, dayIndex) => dayIndex !== index).map((day, dayIndex) => ({ ...day, day_no: dayIndex + 1 })) }));
  }

  return (
    <>
      <div className="trip-wizard-top">
        <button type="button" onClick={onBack}><BackIcon size={16} /> {W.backToTrips}</button>
        <div><span>{approvalMode ? W.proposingChanges : wizard.id ? W.editingDraft : W.newTripDraft}</span><b>{wizard.title || W.untitled}</b></div>
        <div className="trip-wizard-save-state">{approvalMode ? <><ShieldCheck size={15} /> {W.originalUnchanged}</> : savedAt ? <><CheckCircle2 size={15} /> {W.savedLabel} {savedAt}</> : <><ShieldCheck size={15} /> {W.secureDraft}</>}</div>
      </div>

      <div className="trip-wizard-layout">
        <aside className="trip-wizard-steps">
          <p>{approvalMode ? W.requestChangesTag : W.createTripTag}</p>
          {W.steps.map(([title, description], index) => <button type="button" key={title} className={`${step === index ? "active" : ""} ${index < step ? "done" : ""}`} onClick={() => setStep(index)}><span>{index < step ? <Check size={14} /> : index + 1}</span><div><b>{title}</b><small>{description}</small></div></button>)}
          <div className="trip-wizard-help"><ShieldCheck size={19} /><b>{W.adminProtected}</b><p>{approvalMode ? W.adminNoteApproval : W.adminNoteNormal}</p></div>
        </aside>

        <form className="portal-panel trip-wizard-form" onSubmit={(event: FormEvent) => event.preventDefault()}>
          <header><div><p>{W.stepWord} {step + 1} {W.ofWord} {W.steps.length}</p><h1>{W.steps[step][0]}</h1><span>{W.steps[step][1]}</span></div><span>{Math.round(((step + 1) / W.steps.length) * 100)}%</span></header>
          {error && <div className="trip-wizard-error"><X size={17} /> {error}</div>}

          <div className="trip-wizard-content">
            {step === 0 && <>
              <WizardSection icon={Plane} title={W.tripIdentity} text={W.tripIdentityDesc}>
                <div className="portal-form-grid trip-form-grid">
                  <label className="full"><span>{W.tripTitle}</span><input value={wizard.title} onChange={(event) => setWizard((current) => ({ ...current, title: event.target.value }))} placeholder={W.tripTitlePh} /></label>
                  <label dir="ltr"><span>{W.englishTitle}</span><input value={wizard.title_en} onChange={(event) => setWizard((current) => ({ ...current, title_en: event.target.value }))} /></label>
                  <label dir="rtl"><span>{W.arabicTitle}</span><input value={wizard.title_ar} onChange={(event) => setWizard((current) => ({ ...current, title_ar: event.target.value }))} /></label>
                  <label><span>{W.packageTier}</span><select value={wizard.package_tier} onChange={(event) => setWizard((current) => ({ ...current, package_tier: event.target.value as WizardState["package_tier"] }))}><option value="economy">{W.tierEconomy}</option><option value="standard">{W.tierStandard}</option><option value="vip">{W.tierVip}</option></select></label>
                  <label><span>{W.tripType}</span><select value={wizard.group_type} onChange={(event) => setWizard((current) => ({ ...current, group_type: event.target.value as WizardState["group_type"] }))}><option value="group">{W.typeGroup}</option><option value="family">{W.typeFamily}</option><option value="individual">{W.typeIndividual}</option></select></label>
                  <label><span>{W.season}</span><select value={wizard.season_tag} onChange={(event) => setWizard((current) => ({ ...current, season_tag: event.target.value as WizardState["season_tag"] }))}><option value="regular">{W.seasonRegular}</option><option value="ramadan">{W.seasonRamadan}</option><option value="shawwal">{W.seasonShawwal}</option><option value="other">{W.seasonOther}</option></select></label>
                  <label><span>{W.totalSeats}</span><input type="number" min="1" max="500" value={wizard.capacity} onChange={(event) => setWizard((current) => ({ ...current, capacity: event.target.value }))} /></label>
                </div>
              </WizardSection>
              <WizardSection icon={CalendarDays} title={W.schedule} text={W.scheduleDesc}>
                <div className="portal-form-grid trip-form-grid">
                  <label><span>{W.departureDate}</span><input type="date" min={today} value={wizard.departure_date} onChange={(event) => setWizard((current) => ({ ...current, departure_date: event.target.value }))} /></label>
                  <label><span>{W.returnDate}</span><input type="date" min={wizard.departure_date || today} value={wizard.return_date} onChange={(event) => setWizard((current) => ({ ...current, return_date: event.target.value }))} /></label>
                  <label className="full"><span>{W.primaryDescription}</span><textarea rows={5} value={wizard.overview} onChange={(event) => setWizard((current) => ({ ...current, overview: event.target.value }))} placeholder={W.primaryDescriptionPh} /></label>
                  <label dir="ltr"><span>{W.englishDescription}</span><textarea rows={4} value={wizard.overview_en} onChange={(event) => setWizard((current) => ({ ...current, overview_en: event.target.value }))} /></label>
                  <label dir="rtl"><span>{W.arabicDescription}</span><textarea rows={4} value={wizard.overview_ar} onChange={(event) => setWizard((current) => ({ ...current, overview_ar: event.target.value }))} /></label>
                </div>
              </WizardSection>
              <WizardSection icon={ImageIcon} title={W.mainImage} text={W.mainImageDesc}>
                <div className="trip-image-uploader" style={wizard.image_url ? { backgroundImage: `linear-gradient(rgba(5,44,35,.25), rgba(5,44,35,.4)), url("${wizard.image_url}")` } : undefined}><div><Upload size={22} /><b>{wizard.image_url ? W.imageReady : W.addCover}</b><small>{W.imageHint}</small></div><label>{uploadingImage ? <LoaderCircle className="spin" size={15} /> : <ImageIcon size={15} />}{wizard.image_url ? W.replaceImage : W.uploadImage}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingImage} onChange={(event) => onUploadImage(event.target.files?.[0])} /></label></div>
              </WizardSection>
            </>}

            {step === 1 && <>
              <WizardSection icon={Plane} title={W.transportTitle} text={W.transportDesc}>
                <div className="trip-choice-grid"><button type="button" className={wizard.transport === "plane" ? "active" : ""} onClick={() => setWizard((current) => ({ ...current, transport: "plane" }))}><Plane size={21} /><b>{W.byPlane}</b><small>{W.byPlaneSub}</small></button><button type="button" className={wizard.transport === "bus" ? "active" : ""} onClick={() => setWizard((current) => ({ ...current, transport: "bus" }))}><Building2 size={21} /><b>{W.byCoach}</b><small>{W.byCoachSub}</small></button></div>
                <div className="portal-form-grid trip-form-grid">
                  {wizard.transport === "plane" ? <><label><span>{W.departureAirport}</span><select value={wizard.departure_airport} onChange={(event) => setWizard((current) => ({ ...current, departure_airport: event.target.value as WizardState["departure_airport"] }))}><option value="EBL">Erbil (EBL)</option><option value="BGW">Baghdad (BGW)</option><option value="ISU">Sulaymaniyah (ISU)</option></select></label><label><span>{W.airline}</span><input value={wizard.airline_name} onChange={(event) => setWizard((current) => ({ ...current, airline_name: event.target.value }))} placeholder={W.airlinePh} /></label><label><span>{W.flightType}</span><select value={wizard.flight_type} onChange={(event) => setWizard((current) => ({ ...current, flight_type: event.target.value as WizardState["flight_type"] }))}><option value="direct">{W.flightDirect}</option><option value="connecting">{W.flightConnecting}</option></select></label></> : <><label><span>{W.busCompany}</span><input value={wizard.bus_company} onChange={(event) => setWizard((current) => ({ ...current, bus_company: event.target.value }))} placeholder={W.busCompanyPh} /></label><label><span>{W.pickupPoint}</span><input value={wizard.pickup_point} onChange={(event) => setWizard((current) => ({ ...current, pickup_point: event.target.value }))} placeholder={W.pickupPointPh} /></label></>}
                  <label className="full"><span>{W.transportNotes}</span><textarea rows={4} value={wizard.transport_notes} onChange={(event) => setWizard((current) => ({ ...current, transport_notes: event.target.value }))} placeholder={W.transportNotesPh} /></label>
                </div>
                <div className="trip-toggle-row"><label><input type="checkbox" checked={wizard.bus_between_cities} onChange={(event) => setWizard((current) => ({ ...current, bus_between_cities: event.target.checked }))} /><span><b>{W.busBetween}</b><small>{W.busBetweenSub}</small></span></label>{wizard.transport === "plane" && <label><input type="checkbox" checked={wizard.airport_transfers} onChange={(event) => setWizard((current) => ({ ...current, airport_transfers: event.target.checked }))} /><span><b>{W.airportTransfers}</b><small>{W.airportTransfersSub}</small></span></label>}</div>
              </WizardSection>
            </>}

            {step === 2 && <WizardSection icon={Hotel} title={W.hotelsTitle} text={W.hotelsDesc}>
              <div className="trip-hotel-editor-grid">{wizard.hotels.map((hotel) => <article key={hotel.city}><header><span><Hotel size={18} /></span><div><b>{hotel.city === "makkah" ? W.makkahHotel : W.madinahHotel}</b><small>{hotel.city === "makkah" ? W.makkahSub : W.madinahSub}</small></div></header><div className="portal-form-grid trip-form-grid"><label className="full"><span>{W.hotelName}</span><input value={hotel.name} onChange={(event) => updateHotel(hotel.city, { name: event.target.value })} /></label><label><span>{W.starRating}</span><select value={hotel.star_rating} onChange={(event) => updateHotel(hotel.city, { star_rating: Number(event.target.value) })}>{[3,4,5].map((star) => <option value={star} key={star}>{star} {W.starsWord}</option>)}</select></label><label><span>{W.nights}</span><input type="number" min="1" value={hotel.nights} onChange={(event) => updateHotel(hotel.city, { nights: Number(event.target.value) })} /></label><label className="full"><span>{W.distanceHaram}</span><input type="number" min="0" value={hotel.distance_from_haram_m} onChange={(event) => updateHotel(hotel.city, { distance_from_haram_m: Number(event.target.value) })} /></label><label className="full"><span>{W.hotelDescription}</span><textarea rows={4} value={hotel.description} onChange={(event) => updateHotel(hotel.city, { description: event.target.value })} placeholder={W.hotelDescriptionPh} /></label></div></article>)}</div>
            </WizardSection>}

            {step === 3 && <>
              <WizardSection icon={Banknote} title={W.priceTitle} text={W.priceDesc}>
                <div className="portal-form-grid trip-form-grid"><label><span>{W.pricePerPilgrim}</span><input type="number" min="1" value={wizard.package_price_iqd} onChange={(event) => setWizard((current) => ({ ...current, package_price_iqd: event.target.value }))} placeholder="1500000" /></label><label><span>{W.depositAmount}</span><input type="number" min="0" value={wizard.deposit_iqd} onChange={(event) => setWizard((current) => ({ ...current, deposit_iqd: event.target.value }))} /></label><label><span>{W.mealsPerDay}</span><input type="number" min="0" max="5" value={wizard.meals_per_day} onChange={(event) => setWizard((current) => ({ ...current, meals_per_day: event.target.value }))} /></label><label><span>{W.depositTerms}</span><input value={wizard.deposit_terms} onChange={(event) => setWizard((current) => ({ ...current, deposit_terms: event.target.value }))} placeholder={W.depositTermsPh} /></label></div>
              </WizardSection>
              <WizardSection icon={CheckCircle2} title={W.servicesTitle} text={W.servicesDesc}>
                <div className="trip-inclusion-grid">{inclusionOptions.map(([key]) => <label className={wizard.inclusions[key] ? "active" : ""} key={key}><input type="checkbox" checked={Boolean(wizard.inclusions[key])} onChange={(event) => setWizard((current) => ({ ...current, inclusions: { ...current.inclusions, [key]: event.target.checked } }))} /><span>{wizard.inclusions[key] ? <Check size={14} /> : <Plus size={14} />}</span>{W[inclusionKeyToLabel[key]] as string}</label>)}</div>
              </WizardSection>
              <div className="trip-commission-card"><div><CircleDollarSign size={20} /><span><b>{W.customerPrice}</b><small>{W.customerPriceSub}</small></span><strong>{formatIqd(displayPrice)}</strong></div><div><WalletCards size={20} /><span><b>{W.tawafCommission}</b><small>{W.tawafCommissionSub}</small></span><strong>{formatIqd(displayPrice * commissionRate)}</strong></div><div><Banknote size={20} /><span><b>{W.companyNet}</b><small>{W.companyNetSub}</small></span><strong>{formatIqd(displayPrice * (1 - commissionRate))}</strong></div></div>
            </>}

            {step === 4 && <>
              <WizardSection icon={CalendarDays} title={W.itineraryTitle} text={W.itineraryDesc}>
                <div className="trip-itinerary-editor">{wizard.itinerary.map((day, index) => <article key={index}><span>{W.dayWord} {index + 1}</span><div><input value={day.title} onChange={(event) => updateDay(index, { title: event.target.value })} placeholder={W.dayTitlePh} /><textarea rows={2} value={day.summary} onChange={(event) => updateDay(index, { summary: event.target.value })} placeholder={W.daySummaryPh} /></div>{wizard.itinerary.length > 1 && <button type="button" onClick={() => removeDay(index)} aria-label={`Remove day ${index + 1}`}><Trash2 size={15} /></button>}</article>)}<button type="button" className="trip-add-day" onClick={addDay}><Plus size={15} /> {W.addDay}</button></div>
              </WizardSection>
              <WizardSection icon={FileText} title={W.policiesTitle} text={W.policiesDesc}>
                <div className="portal-form-grid trip-form-grid"><label className="full"><span>{W.cancellationPolicy}</span><textarea rows={6} value={wizard.cancellation_policy} onChange={(event) => setWizard((current) => ({ ...current, cancellation_policy: event.target.value }))} placeholder={W.cancellationPolicyPh} /></label><label className="full"><span>{W.videoUrl}</span><input type="url" value={wizard.video_url} onChange={(event) => setWizard((current) => ({ ...current, video_url: event.target.value }))} placeholder="https://youtube.com/…" /></label><label className="full trip-checkbox-line"><input type="checkbox" checked={wizard.non_refundable_deposit} onChange={(event) => setWizard((current) => ({ ...current, non_refundable_deposit: event.target.checked }))} /><span><b>{W.nonRefundable}</b><small>{W.nonRefundableSub}</small></span></label></div>
              </WizardSection>
            </>}

            {step === 5 && <div className="trip-review-layout">
              <section className="trip-customer-preview">
                <div className="trip-preview-image" style={wizard.image_url ? { backgroundImage: `linear-gradient(rgba(5,44,35,.1), rgba(5,44,35,.55)), url("${wizard.image_url}")` } : undefined}><span>{wizard.package_tier === "economy" ? W.tierEconomy : wizard.package_tier === "vip" ? W.tierVip : W.tierStandard}</span><div><small>{(wizard.transport === "plane" ? wizard.departure_airport : wizard.pickup_point || W.byCoach)} · {formatDate(wizard.departure_date)}</small><h2>{wizard.title || W.previewFallbackTitle}</h2></div></div>
                <div className="trip-preview-body"><p>{wizard.overview || W.previewFallbackDesc}</p><div><span><CalendarDays size={16} /><b>{wizard.hotels.reduce((sum, hotel) => sum + hotel.nights, 0) + 1} {W.daysWord}</b></span><span><Plane size={16} /><b>{wizard.transport === "plane" ? W.byPlane : W.byCoach}</b></span><span><Users size={16} /><b>{wizard.capacity || 0} {W.seatsWord}</b></span></div><footer><div><small>{W.startingFrom}</small><strong>{formatIqd(displayPrice)}</strong></div><button type="button">{W.viewPackage} <NextIcon size={15} /></button></footer></div>
              </section>
              <aside className="trip-submit-checklist"><header><ShieldCheck size={20} /><div><b>{W.readyTitle}</b><small>{W.readySub}</small></div></header>{completion.map((item) => <div className={item.done ? "done" : ""} key={item.label}><span>{item.done ? <Check size={13} /> : "!"}</span>{item.label}</div>)}<p>{W.submitNote}</p></aside>
            </div>}
          </div>

          <footer className="trip-wizard-footer">
            <button type="button" className="portal-secondary-button" onClick={() => step ? setStep((current) => current - 1) : onBack()}><BackIcon size={15} /> {step ? W.previous : W.cancel}</button>
            <div>
              {!approvalMode && <button type="button" className="trip-save-draft" onClick={onSave} disabled={busy === "trip-wizard-save"}>{busy === "trip-wizard-save" ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} {W.saveDraftBtn}</button>}
              {step < W.steps.length - 1 ? <button type="button" className="portal-primary-button" onClick={onContinue}>{approvalMode ? W.continueBtn : W.nextBtn} <NextIcon size={15} /></button> : <button type="button" className="portal-primary-button" onClick={onSubmit} disabled={!canSubmit || busy.startsWith("trip-")}>{busy.startsWith("trip-") ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} {approvalMode ? W.requestApprovalBtn : W.submitBtn}</button>}
            </div>
          </footer>
        </form>
      </div>
    </>
  );
}

function WizardSection({ icon: Icon, title, text, children }: { icon: typeof Plane; title: string; text: string; children: React.ReactNode }) {
  return <section className="trip-wizard-section"><header><span><Icon size={19} /></span><div><h2>{title}</h2><p>{text}</p></div></header>{children}</section>;
}
