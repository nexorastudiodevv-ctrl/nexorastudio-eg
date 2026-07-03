// Simple front-end i18n without frameworks.
// Usage:
//  - Add <html lang="en" dir="ltr"> default.
//  - Add elements with data-i18n-key="...".
//  - Add a toggle button with id="langToggle" and data-lang attributes (en/ar).

(function () {
  const dict = {
    en: {
      nav_about: "About",
      nav_services: "Services",
      nav_portfolio: "Portfolio",
      nav_contact: "Contact",
      nav_myapps: "My Apps",
      hero_badge: "Premium Studio",
      hero_title: "Build Smart Apps.\nCreate Modern Websites.\nPower Digital Businesses.",
      hero_lead:
        "Nexora Studio EG develops Android applications, web experiences, AI-powered solutions, and digital products — crafted with precision, performance, and trust.",
      hero_download: "Download MegaBit WiFi",
      hero_contact: "Contact Us",
      hero_chip_fast: "Fast Delivery",
      hero_chip_secure: "Secure by Design",
      hero_chip_ui: "Modern UI/UX",
      about_title: "Who we are",
      about_mission: "Mission",
      about_vision: "Vision",
      about_why: "Why choose us",
      about_stats1: "المشاريع المميزة التي تم تنفيذها",
      about_stats2: "سنوات من الخبرة في الفريق",
      about_stats3: "المستخدمون الذين وصلوا إلى جميع أنحاء العالم",
      about_stats4: "Products & Downloads (placeholder)",
      services_title: "Services built for impact",
      portfolio_title: "Portfolio",
      contact_title: "Contact",
      footer_privacy: "Privacy Policy",
      footer_terms: "Terms"
    },
    ar: {
      nav_about: "من نحن",
      nav_services: "الخدمات",
      nav_portfolio: "أعمالنا",
      nav_contact: "تواصل معنا",
      nav_myapps: "تطبيقاتي",
      hero_badge: "استوديو فاخر",
      hero_title: "ابنِ تطبيقات ذكية.\nأنشئ مواقع حديثة.\nحوّل أعمالك إلى قيمة.",
      hero_lead:
        "يُطوّر Nexora Studio EG تطبيقات أندرويد وتجارب ويب وحلولاً مدعومة بالذكاء الاصطناعي ومنتجات رقمية — بدقة وأداء وثقة.",
      hero_download: "حمّل MegaBit WiFi",
      hero_contact: "تواصل معنا",
      hero_chip_fast: "تسليم سريع",
      hero_chip_secure: "أمان بالتصميم",
      hero_chip_ui: "واجهة عصرية",
      about_title: "من نحن",
      about_mission: "الرسالة",
      about_vision: "الرؤية",
      about_why: "لماذا نحن؟",
      about_stats1: "المشاريع المميزة التي تم تنفيذها",
      about_stats2: "سنوات من الخبرة في الفريق",
      about_stats3: "المستخدمون الذين وصلوا إلى جميع أنحاء العالم",
      about_stats4: "منتجات وتحميلات (قالب)",
      services_title: "خدمات مبنية على الأثر",
      portfolio_title: "الـ Portfolio",
      contact_title: "تواصل معنا",
      footer_privacy: "سياسة الخصوصية",
      footer_terms: "الشروط"
    }
  };

  function setDirLang(lang) {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
  }

  function applyLang(lang) {
    if (!dict[lang]) lang = "en";

    setDirLang(lang);

    const nodes = document.querySelectorAll("[data-i18n-key]");
    nodes.forEach((node) => {
      const key = node.getAttribute("data-i18n-key");
      const value = dict[lang][key];
      if (value != null) {
        // Keep newlines for titles
        node.textContent = value;
        if (node.tagName === "H1" || node.tagName === "H2" || node.tagName === "H3") {
          node.innerHTML = value.replace(/\n/g, "<br/>");
        }
      }
    });

    document.documentElement.classList.toggle("lang-ar", lang === "ar");
    document.documentElement.classList.toggle("lang-en", lang === "en");

    try {
      localStorage.setItem("lang", lang);
    } catch (e) {
      // ignore
    }
  }

  function init() {
    const saved = (() => {
      try {
        return localStorage.getItem("lang");
      } catch (e) {
        return null;
      }
    })();

    const lang = saved || (navigator.language && navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en");
    applyLang(lang);

    const toggle = document.getElementById("langToggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("lang") || "en";
        applyLang(current === "ar" ? "en" : "ar");
      });
    }

    const toggleLinks = document.querySelectorAll("[data-set-lang]");
    toggleLinks.forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const lang = el.getAttribute("data-set-lang");
        applyLang(lang);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

