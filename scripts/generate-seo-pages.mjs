import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SITE_URL = "https://www.tawafiraq.com";

const copy = {
  en: {
    lang: "en",
    dir: "ltr",
    languageName: "English",
    brandTag: "UMRAH MARKETPLACE",
    openApp: "Explore Tawaf",
    signIn: "Sign in",
    nav: {
      home: "Umrah from Kurdistan",
      guide: "Planning guide",
      packages: "Compare packages",
    },
    hub: {
      path: "",
      eyebrow: "Umrah from Kurdistan and Iraq",
      title: "Umrah packages from Kurdistan & Iraq",
      description:
        "Plan Umrah from Erbil, Sulaimani, Duhok, and across Iraq. Compare company details, prices, hotels, transport, and booking terms with Tawaf.",
      lead:
        "Tawaf gives pilgrims one clear place to explore Umrah trips, understand package details, and check the company before booking.",
      sections: [
        {
          title: "Compare the complete package",
          body: "Review transport, hotel, room type, meals, duration, included services, and the final price per traveller.",
        },
        {
          title: "Check the travel company",
          body: "See the company profile, verification status, contact information, booking terms, and cancellation policy before paying.",
        },
        {
          title: "Plan from your city",
          body: "Explore departure options from Erbil, Sulaimani, Duhok, Baghdad, and other Iraqi cities.",
        },
      ],
      faq: [
        {
          q: "What is Tawaf?",
          a: "Tawaf is an Umrah marketplace for comparing trips and travel companies serving Kurdistan and Iraq.",
        },
        {
          q: "Can I compare Umrah prices?",
          a: "Yes. Tawaf is designed to show package prices together with hotels, transport, duration, rooms, and included services.",
        },
      ],
    },
    guide: {
      path: "umrah-kurdistan",
      eyebrow: "A practical local guide",
      title: "Planning Umrah from Kurdistan",
      description:
        "A practical guide to Umrah from Kurdistan: departures from Erbil, Sulaimani, and Duhok, prices, visas, documents, hotels, transport, and company checks.",
      lead:
        "Use this checklist before choosing an Umrah trip. Requirements and schedules can change, so confirm final details with the responsible company and official authorities.",
      sections: [
        {
          title: "Departure city and transport",
          body: "Confirm the exact meeting point, check-in time, airline or coach operator, baggage allowance, and transfers between Jeddah, Makkah, and Madinah.",
        },
        {
          title: "Compare the complete price",
          body: "Check visa services, transport, hotel nights, room occupancy, meals, local transfers, guide services, and every separate fee.",
        },
        {
          title: "Passport, visa, and documents",
          body: "Match every traveller name to the passport and confirm passport validity, visa steps, photos, and any current health or entry documents.",
        },
        {
          title: "Choose a company carefully",
          body: "Check the company identity, verification status, office details, written itinerary, payment receipt, and cancellation terms.",
        },
      ],
      faq: [
        {
          q: "Are there Umrah departures from Erbil, Sulaimani, or Duhok?",
          a: "Departure cities depend on the company and trip date. Confirm the meeting point, transport type, and any domestic transfer before reserving.",
        },
        {
          q: "What should an Umrah package include?",
          a: "Check visa service, transport, hotels, room occupancy, meals, transfers, guide services, and the final per-person price.",
        },
      ],
    },
    packages: {
      path: "umrah-packages",
      eyebrow: "Compare before you reserve",
      title: "Compare Umrah packages clearly",
      description:
        "Compare Umrah packages from Kurdistan and Iraq by price, transport, hotels, room type, duration, included services, company details, and booking terms.",
      lead:
        "The lowest advertised price is not always the best value. Compare what each package includes and confirm availability directly in Tawaf.",
      sections: [
        {
          title: "Price and room occupancy",
          body: "Confirm whether the price is per person and whether it changes for double, triple, or shared rooms.",
        },
        {
          title: "Hotels and distance",
          body: "Compare the hotel name, star rating, room type, nights, and stated distance from the Haram in Makkah and Madinah.",
        },
        {
          title: "Air or coach transport",
          body: "Check the operator, departure city, baggage rules, Saudi transfers, and what happens if the schedule changes.",
        },
        {
          title: "Booking and cancellation terms",
          body: "Read the deposit, remaining payment, change, refund, cancellation, and traveller-support terms before paying.",
        },
      ],
      faq: [
        {
          q: "How do I compare Umrah packages?",
          a: "Compare the final price with transport, hotels, room type, duration, meals, transfers, included services, and cancellation terms.",
        },
        {
          q: "Are package prices always available?",
          a: "Prices and seats can change. Open Tawaf and confirm current availability with the listed travel company before paying.",
        },
      ],
    },
  },
  ku: {
    lang: "ku",
    dir: "rtl",
    languageName: "کوردی",
    brandTag: "بازاڕی عومرە",
    openApp: "تەواف بکەرەوە",
    signIn: "چوونەژوورەوە",
    nav: {
      home: "عومرە لە کوردستان",
      guide: "ڕێنمایی پلاندانان",
      packages: "بەراوردی پاکێج",
    },
    hub: {
      path: "",
      eyebrow: "عومرە لە کوردستان و عێراق",
      title: "پاکێجی عومرە لە کوردستان و عێراق",
      description:
        "بۆ عومرە لە هەولێر، سلێمانی، دهۆک و شارەکانی عێراق پلان دابنێ. زانیاری کۆمپانیا، نرخ، هوتێل، گواستنەوە و مەرجی حجز بەراورد بکە.",
      lead:
        "تەواف شوێنێکی ڕوونە بۆ دۆزینەوەی گەشتی عومرە، تێگەیشتن لە وردەکاری پاکێج و پشکنینی کۆمپانیا پێش حجزکردن.",
      sections: [
        {
          title: "پاکێجی تەواو بەراورد بکە",
          body: "گواستنەوە، هوتێل، جۆری ژوور، خواردن، ماوە، خزمەتگوزارییەکان و کۆی نرخ بۆ هەر گەشتیارێک ببینە.",
        },
        {
          title: "زانیاری کۆمپانیا بپشکنە",
          body: "پڕۆفایل، دۆخی پشتڕاستکردنەوە، پەیوەندی، مەرجی حجز و سیاسەتی هەڵوەشاندنەوە بخوێنەوە.",
        },
        {
          title: "لە شارەکەتەوە پلان دابنێ",
          body: "هەڵبژاردەکانی بەڕێکەوتن لە هەولێر، سلێمانی، دهۆک، بەغدا و شارەکانی دیکە بزانە.",
        },
      ],
      faq: [
        {
          q: "تەواف چییە؟",
          a: "تەواف بازاڕێکی عومرەیە بۆ بەراوردکردنی گەشت و کۆمپانیاکانی گەشتی کوردستان و عێراق.",
        },
        {
          q: "دەتوانم نرخی عومرە بەراورد بکەم؟",
          a: "بەڵێ. تەواف نرخ لەگەڵ هوتێل، گواستنەوە، ماوە، ژوور و خزمەتگوزارییەکان پیشان دەدات.",
        },
      ],
    },
    guide: {
      path: "umrah-kurdistan",
      eyebrow: "ڕێنماییەکی ناوخۆیی و کرداری",
      title: "پلاندانان بۆ عومرە لە کوردستان",
      description:
        "ڕێنماییەکی کرداری بۆ عومرە لە کوردستان؛ بەڕێکەوتن لە هەولێر، سلێمانی و دهۆک، نرخ، ڤیزا، بەڵگەنامە، هوتێل و گواستنەوە.",
      lead:
        "پێش هەڵبژاردنی گەشتی عومرە ئەم لیستە بپشکنە. داواکاری و خشتەکان دەکرێت بگۆڕێن، بۆیە وردەکاری کۆتایی پشتڕاست بکەوە.",
      sections: [
        {
          title: "شاری بەڕێکەوتن و گواستنەوە",
          body: "شوێنی کۆبوونەوە، کاتی چێکئین، کۆمپانیای فڕۆکە یان پاس، سنووری بار و گواستنەوەکانی سعودیە پشتڕاست بکەوە.",
        },
        {
          title: "کۆی نرخ بەراورد بکە",
          body: "ڤیزا، گواستنەوە، شەوی هوتێل، جۆری ژوور، خواردن، گواستنەوەی ناوخۆ و هەر کرێیەکی جیاواز بپشکنە.",
        },
        {
          title: "پاسپۆرت، ڤیزا و بەڵگەنامە",
          body: "ناوی هەر گەشتیارێک لەگەڵ پاسپۆرت یەکسان بکە و ماوەی دروستی، ڤیزا، وێنە و بەڵگەنامە نوێکان بپشکنە.",
        },
        {
          title: "کۆمپانیا بە ئاگاداری هەڵبژێرە",
          body: "ناسنامە، دۆخی پشتڕاستکردنەوە، ناونیشانی نووسینگە، خشتەی نووسراو، وەسڵ و مەرجی هەڵوەشاندنەوە ببینە.",
        },
      ],
      faq: [
        {
          q: "ئایا گەشتی عومرە لە هەولێر، سلێمانی یان دهۆک هەیە؟",
          a: "شاری بەڕێکەوتن بە کۆمپانیا و ڕێکەوتی گەشتەکە پەیوەستە. پێش حجز هەموو وردەکارییەکان پشتڕاست بکەوە.",
        },
        {
          q: "پاکێجی عومرە دەبێت چی لەخۆبگرێت؟",
          a: "ڤیزا، گواستنەوە، هوتێل، جۆری ژوور، خواردن، گواستنەوەی ناوخۆ و کۆی نرخ بپشکنە.",
        },
      ],
    },
    packages: {
      path: "umrah-packages",
      eyebrow: "پێش حجز بەراورد بکە",
      title: "پاکێجی عومرە بە ڕوونی بەراورد بکە",
      description:
        "پاکێجی عومرە لە کوردستان و عێراق بە پێی نرخ، گواستنەوە، هوتێل، جۆری ژوور، ماوە، کۆمپانیا و مەرجی حجز بەراورد بکە.",
      lead:
        "هەمیشە کەمترین نرخی ڕیکلامکراو باشترین بەها نییە. بزانە هەر پاکێجێک چی لەخۆدەگرێت و بەردەستبوون لە تەواف پشتڕاست بکەوە.",
      sections: [
        {
          title: "نرخ و ژمارەی کەسانی ژوور",
          body: "بزانە نرخ بۆ هەر کەسێکە و بۆ ژووری دوو، سێ یان چەند کەسی چۆن دەگۆڕێت.",
        },
        {
          title: "هوتێل و دووری",
          body: "ناوی هوتێل، پلەی ئەستێرە، جۆری ژوور، ژمارەی شەو و دووری لە حەرەم بەراورد بکە.",
        },
        {
          title: "فڕۆکە یان پاس",
          body: "ناوی بەڕێوەبەر، شاری بەڕێکەوتن، یاسای بار و گواستنەوەکانی سعودیە پشتڕاست بکەوە.",
        },
        {
          title: "مەرجی حجز و هەڵوەشاندنەوە",
          body: "پێش پارەدان دەستەبەر، پارەی ماوە، گۆڕانکاری، گەڕاندنەوەی پارە و مەرجی پشتیوانی بخوێنەوە.",
        },
      ],
      faq: [
        {
          q: "چۆن پاکێجی عومرە بەراورد بکەم؟",
          a: "کۆی نرخ لەگەڵ گواستنەوە، هوتێل، ژوور، ماوە، خواردن، خزمەتگوزاری و مەرجی هەڵوەشاندنەوە بەراورد بکە.",
        },
        {
          q: "ئایا نرخ و کورسی هەمیشە بەردەستە؟",
          a: "نرخ و کورسی دەکرێت بگۆڕێت. لە تەواف بەردەستبوونی نوێ لە کۆمپانیا پشتڕاست بکەوە.",
        },
      ],
    },
  },
  ar: {
    lang: "ar",
    dir: "rtl",
    languageName: "العربية",
    brandTag: "سوق العمرة",
    openApp: "استكشف طواف",
    signIn: "تسجيل الدخول",
    nav: {
      home: "العمرة من كردستان",
      guide: "دليل التخطيط",
      packages: "مقارنة الباقات",
    },
    hub: {
      path: "",
      eyebrow: "العمرة من كردستان والعراق",
      title: "باقات العمرة من كردستان والعراق",
      description:
        "خطط للعمرة من أربيل والسليمانية ودهوك ومدن العراق. قارن بيانات الشركات والأسعار والفنادق والنقل وشروط الحجز مع طواف.",
      lead:
        "يوفر طواف مكاناً واضحاً لاستكشاف رحلات العمرة وفهم تفاصيل الباقات والتحقق من الشركة قبل الحجز.",
      sections: [
        {
          title: "قارن الباقة كاملة",
          body: "راجع النقل والفندق ونوع الغرفة والوجبات والمدة والخدمات المشمولة والسعر النهائي لكل مسافر.",
        },
        {
          title: "تحقق من شركة السفر",
          body: "راجع ملف الشركة وحالة التوثيق وبيانات الاتصال وشروط الحجز وسياسة الإلغاء قبل الدفع.",
        },
        {
          title: "خطط من مدينتك",
          body: "تعرّف إلى خيارات الانطلاق من أربيل والسليمانية ودهوك وبغداد ومدن العراق الأخرى.",
        },
      ],
      faq: [
        {
          q: "ما هو طواف؟",
          a: "طواف سوق للعمرة يساعد على مقارنة الرحلات وشركات السفر التي تخدم كردستان والعراق.",
        },
        {
          q: "هل يمكنني مقارنة أسعار العمرة؟",
          a: "نعم. يعرض طواف السعر مع الفنادق والنقل والمدة والغرف والخدمات المشمولة.",
        },
      ],
    },
    guide: {
      path: "umrah-kurdistan",
      eyebrow: "دليل محلي عملي",
      title: "دليل التخطيط للعمرة من كردستان",
      description:
        "دليل عملي للعمرة من كردستان: الانطلاق من أربيل والسليمانية ودهوك، والأسعار والتأشيرة والوثائق والفنادق والنقل.",
      lead:
        "استخدم هذه القائمة قبل اختيار رحلة عمرة. قد تتغير المتطلبات والمواعيد، لذلك أكد التفاصيل النهائية مع الشركة والجهات الرسمية.",
      sections: [
        {
          title: "مدينة الانطلاق والنقل",
          body: "أكد نقطة التجمع ووقت الحضور وشركة الطيران أو الحافلة ووزن الأمتعة والتنقل بين جدة ومكة والمدينة.",
        },
        {
          title: "قارن السعر الكامل",
          body: "تحقق من التأشيرة والنقل وليالي الفندق ونوع الغرفة والوجبات والتنقل الداخلي وأي رسوم منفصلة.",
        },
        {
          title: "الجواز والتأشيرة والوثائق",
          body: "طابق أسماء المسافرين مع الجوازات وتحقق من الصلاحية وإجراءات التأشيرة والصور وأحدث وثائق الدخول.",
        },
        {
          title: "اختر الشركة بعناية",
          body: "راجع هوية الشركة وحالة التوثيق وعنوان المكتب والبرنامج المكتوب والإيصال وشروط الإلغاء.",
        },
      ],
      faq: [
        {
          q: "هل توجد رحلات عمرة من أربيل أو السليمانية أو دهوك؟",
          a: "تعتمد مدينة الانطلاق على الشركة وتاريخ الرحلة. أكد نقطة التجمع ونوع النقل قبل الحجز.",
        },
        {
          q: "ماذا يجب أن تشمل باقة العمرة؟",
          a: "تحقق من التأشيرة والنقل والفنادق ونوع الغرفة والوجبات والتنقل والسعر النهائي للفرد.",
        },
      ],
    },
    packages: {
      path: "umrah-packages",
      eyebrow: "قارن قبل الحجز",
      title: "قارن باقات العمرة بوضوح",
      description:
        "قارن باقات العمرة من كردستان والعراق حسب السعر والنقل والفنادق ونوع الغرفة والمدة والخدمات والشركة وشروط الحجز.",
      lead:
        "ليس السعر المعلن الأقل دائماً أفضل قيمة. قارن ما تشمله كل باقة وأكد توفر المقاعد مباشرة في طواف.",
      sections: [
        {
          title: "السعر وعدد الأشخاص في الغرفة",
          body: "تأكد إن كان السعر للفرد وكيف يتغير للغرف الثنائية أو الثلاثية أو المشتركة.",
        },
        {
          title: "الفنادق والمسافة",
          body: "قارن اسم الفندق وتصنيفه ونوع الغرفة وعدد الليالي والمسافة المعلنة عن الحرم.",
        },
        {
          title: "الطيران أو النقل البري",
          body: "تحقق من الشركة ومدينة الانطلاق ووزن الأمتعة والتنقلات داخل السعودية.",
        },
        {
          title: "شروط الحجز والإلغاء",
          body: "اقرأ العربون والدفعة المتبقية وشروط التغيير والاسترداد والإلغاء والدعم قبل الدفع.",
        },
      ],
      faq: [
        {
          q: "كيف أقارن باقات العمرة؟",
          a: "قارن السعر النهائي مع النقل والفنادق والغرفة والمدة والوجبات والخدمات وشروط الإلغاء.",
        },
        {
          q: "هل تبقى الأسعار والمقاعد متاحة دائماً؟",
          a: "قد تتغير الأسعار والمقاعد. افتح طواف وأكد التوفر الحالي مع شركة السفر قبل الدفع.",
        },
      ],
    },
  },
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localizedUrl(locale, path = "") {
  return `${SITE_URL}/${locale}/${path ? `${path}/` : ""}`;
}

function structuredData(locale, page) {
  const canonical = localizedUrl(locale, page.path);
  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Tawaf",
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/brand/tawaf-logo.png`,
    },
    {
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: page.title,
      description: page.description,
      inLanguage: locale,
      isPartOf: {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "Tawaf",
        url: `${SITE_URL}/`,
      },
      about: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Tawaf",
          item: `${SITE_URL}/${locale}/`,
        },
        ...(page.path
          ? [
              {
                "@type": "ListItem",
                position: 2,
                name: page.title,
                item: canonical,
              },
            ]
          : []),
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: page.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    },
  ];

  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replaceAll(
    "<",
    "\\u003c",
  );
}

function renderPage(locale, pageKey) {
  const language = copy[locale];
  const page = language[pageKey];
  const canonical = localizedUrl(locale, page.path);
  const alternates = ["ku", "ar", "en"]
    .map(
      (code) =>
        `<link rel="alternate" hreflang="${code}" href="${localizedUrl(
          code,
          page.path,
        )}">`,
    )
    .join("\n");
  const cards = page.sections
    .map(
      (section, index) => `
        <article class="card">
          <span class="number">${String(index + 1).padStart(2, "0")}</span>
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.body)}</p>
        </article>`,
    )
    .join("");
  const faq = page.faq
    .map(
      (item) => `
        <details>
          <summary>${escapeHtml(item.q)}</summary>
          <p>${escapeHtml(item.a)}</p>
        </details>`,
    )
    .join("");

  return `<!doctype html>
<html lang="${language.lang}" dir="${language.dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)} | Tawaf</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="application-name" content="Tawaf">
  <meta name="theme-color" content="#04382f">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <link rel="canonical" href="${canonical}">
  ${alternates}
  <link rel="alternate" hreflang="x-default" href="${localizedUrl("en", page.path)}">
  <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="icon" href="/favicon-192.png" sizes="192x192" type="image/png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Tawaf">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SITE_URL}/brand/tawaf.png">
  <meta property="og:image:alt" content="Tawaf Umrah marketplace logo">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(page.title)}">
  <meta name="twitter:description" content="${escapeHtml(page.description)}">
  <meta name="twitter:image" content="${SITE_URL}/brand/tawaf.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Vazirmatn:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script type="application/ld+json">${structuredData(locale, page)}</script>
  <style>
    :root{--ink:#10251f;--muted:#607069;--green:#04382f;--green-2:#0b5949;--gold:#c89b39;--cream:#f6f1e7;--paper:#fffdf8;--line:#ddd8cc}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--cream);color:var(--ink);font-family:"Vazirmatn",system-ui,sans-serif;line-height:1.75}
    a{color:inherit}.shell{width:min(1120px,calc(100% - 36px));margin:auto}.top{height:86px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(4,56,47,.14)}
    .brand{display:flex;align-items:center;gap:12px;text-decoration:none}.brand img{width:48px;height:48px;border-radius:12px}.brand strong{display:block;font-family:"Amiri",serif;font-size:26px;line-height:1}.brand small{color:var(--gold);font-weight:800;letter-spacing:.12em}
    nav{display:flex;gap:24px;align-items:center}nav a{text-decoration:none;font-weight:700;color:var(--muted)}nav a:hover{color:var(--green)}
    .lang{display:flex;gap:7px}.lang a{border:1px solid var(--line);padding:4px 10px;border-radius:999px;font-size:13px}.lang a[aria-current="true"]{background:var(--green);border-color:var(--green);color:white}
    .hero{padding:92px 0 72px;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.65fr);gap:60px;align-items:center}.eyebrow{color:var(--gold);font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    h1{font-family:"Amiri",serif;font-size:clamp(48px,7vw,82px);line-height:1.08;margin:12px 0 22px}h2{font-family:"Amiri",serif;font-size:28px;line-height:1.25;margin:10px 0}
    .lead{font-size:20px;color:var(--muted);max-width:720px}.hero-mark{min-height:320px;border-radius:42% 58% 52% 48%;background:radial-gradient(circle at 38% 36%,#12806b 0,#075044 42%,#032a24 100%);display:grid;place-items:center;box-shadow:0 28px 80px rgba(4,56,47,.18)}
    .hero-mark img{width:170px;height:170px;border-radius:36px;box-shadow:0 20px 45px rgba(0,0,0,.24)}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.button{display:inline-flex;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:800;border:1px solid var(--green)}
    .button.primary{background:var(--green);color:white}.button.secondary{background:transparent;color:var(--green)}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;padding:0 0 72px}.card{background:var(--paper);border:1px solid var(--line);border-radius:24px;padding:28px;min-height:210px;box-shadow:0 16px 44px rgba(24,42,35,.05)}
    .card .number{color:var(--gold);font-weight:800}.card p,details p{color:var(--muted);margin-bottom:0}.faq{padding:70px 0;border-top:1px solid var(--line)}.faq h2{font-size:42px}.faq-list{display:grid;gap:12px;margin-top:26px}details{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:18px 22px}summary{cursor:pointer;font-weight:800}
    .footer{background:var(--green);color:white;padding:36px 0;margin-top:40px}.footer .shell{display:flex;justify-content:space-between;gap:18px;align-items:center}.footer p{color:#c6d6d1;margin:0}.footer a{color:white}
    @media(max-width:820px){.top{height:auto;padding:18px 0;align-items:flex-start}.top nav{display:none}.hero{grid-template-columns:1fr;padding-top:64px}.hero-mark{min-height:250px}.grid{grid-template-columns:1fr}.footer .shell{display:block}.footer p{margin-top:8px}}
  </style>
</head>
<body>
  <header class="shell top">
    <a class="brand" href="/">
      <img src="/brand/tawaf-logo.png" alt="Tawaf logo">
      <span><strong>Tawaf</strong><small>${escapeHtml(language.brandTag)}</small></span>
    </a>
    <nav aria-label="Main navigation">
      <a href="/${locale}/">${escapeHtml(language.nav.home)}</a>
      <a href="/${locale}/umrah-kurdistan/">${escapeHtml(language.nav.guide)}</a>
      <a href="/${locale}/umrah-packages/">${escapeHtml(language.nav.packages)}</a>
    </nav>
    <div class="lang" aria-label="Languages">
      <a href="/ku/${page.path ? `${page.path}/` : ""}" aria-current="${locale === "ku"}">کوردی</a>
      <a href="/ar/${page.path ? `${page.path}/` : ""}" aria-current="${locale === "ar"}">عربي</a>
      <a href="/en/${page.path ? `${page.path}/` : ""}" aria-current="${locale === "en"}">EN</a>
    </div>
  </header>
  <main>
    <section class="shell hero">
      <div>
        <div class="eyebrow">${escapeHtml(page.eyebrow)}</div>
        <h1>${escapeHtml(page.title)}</h1>
        <p class="lead">${escapeHtml(page.lead)}</p>
        <div class="actions">
          <a class="button primary" href="/#packages">${escapeHtml(language.openApp)}</a>
          <a class="button secondary" href="/sign-in">${escapeHtml(language.signIn)}</a>
        </div>
      </div>
      <div class="hero-mark" aria-hidden="true"><img src="/brand/tawaf-logo.png" alt=""></div>
    </section>
    <section class="shell grid" aria-label="${escapeHtml(page.title)}">
      ${cards}
    </section>
    <section class="shell faq">
      <div class="eyebrow">Tawaf</div>
      <h2>${locale === "en" ? "Common questions" : locale === "ar" ? "أسئلة شائعة" : "پرسیارە باوەکان"}</h2>
      <div class="faq-list">${faq}</div>
    </section>
  </main>
  <footer class="footer">
    <div class="shell">
      <strong>Tawaf · ${escapeHtml(language.brandTag)}</strong>
      <p>© 2026 Tawaf · <a href="mailto:hello@tawaf.app">hello@tawaf.app</a></p>
    </div>
  </footer>
</body>
</html>`;
}

export async function writeSeoStaticPages(outDir) {
  for (const locale of Object.keys(copy)) {
    for (const pageKey of ["hub", "guide", "packages"]) {
      const page = copy[locale][pageKey];
      const directory = join(outDir, locale, page.path);
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "index.html"), renderPage(locale, pageKey));
    }
  }
}
