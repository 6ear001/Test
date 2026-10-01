// Kopf-/Fußzeile als gemeinsamer Baustein für alle statischen Seiten, damit
// Nav/Footer nicht in jeder .html-Datei einzeln gepflegt werden müssen.
// data-active auf <div id="site-header"> markiert den aktiven Nav-Punkt.
(function () {
    "use strict";

    // Zweisprachig (DE/AR): welche Sprache gilt, entscheidet document.documentElement.lang
    // (von jeder Seite selbst gesetzt) - kein Umschalten ohne Seitenwechsel nötig, da AR-Seiten
    // unter /ar/... als eigene, vollstaendige Kopie liegen (kein Duplicate-Content-Risiko dank
    // hreflang unten, aber auch kein JS-Übersetzungslayer noetig).
    var LANG = document.documentElement.lang === "ar" ? "ar" : "de";
    var PREFIX = LANG === "ar" ? "/ar" : "";

    // Reihenfolge nach dem Weg eines Interessenten: Was ist es? -> Was kann es? -> Worauf läuft es?
    // -> Was kostet es? -> Service für Bestandskunden -> Kontakt. Gilt für Kopfzeile, Handy-Menü und Fußzeile.
    var NAV = {
        de: [
            ["pos-pda", PREFIX + "/pos-pda/", "Kasse &amp; PDA"],
            ["funktionen", PREFIX + "/funktionen/", "Funktionen"],
            ["zubehoer", PREFIX + "/zubehoer/", "Hardware"],
            ["preise", PREFIX + "/preise/", "Preise"],
            ["downloads", PREFIX + "/downloads/", "Downloads"],
            ["kontakt", PREFIX + "/kontakt/", "Kontakt"],
        ],
        ar: [
            ["pos-pda", PREFIX + "/pos-pda/", "الكاشير وPDA"],
            ["funktionen", PREFIX + "/funktionen/", "المزايا"],
            ["zubehoer", PREFIX + "/zubehoer/", "الأجهزة"],
            ["preise", PREFIX + "/preise/", "الأسعار"],
            ["downloads", PREFIX + "/downloads/", "التحميلات"],
            ["kontakt", PREFIX + "/kontakt/", "تواصل معنا"],
        ],
    }[LANG];

    var T = {
        de: {
            skip: "Zum Inhalt springen", announcement: "Alles verbunden.", announcementRest: "Kasse, Warenwirtschaft &amp; Buchhaltung.",
            freeConsult: "Kostenlose Beratung", home: "Zur Startseite", tagline: "Kasse · Warenwirtschaft · Cloud",
            ctaNav: "Beratung anfragen", menuOpen: "Menü öffnen", ctaMobile: "Beratung",
            footerTagline: "Digitale Lösungen für den Handel", impressum: "Impressum", datenschutz: "Datenschutz",
        },
        ar: {
            skip: "الانتقال إلى المحتوى", announcement: "كل شيء مترابط.", announcementRest: "الكاشير، إدارة المخزون والمحاسبة.",
            freeConsult: "استشارة مجانية", home: "الصفحة الرئيسية", tagline: "الكاشير · إدارة المخزون · الحوسبة السحابية",
            ctaNav: "اطلب استشارة", menuOpen: "فتح القائمة", ctaMobile: "استشارة",
            footerTagline: "حلول رقمية لقطاع التجارة", impressum: "بيانات الشركة", datenschutz: "سياسة الخصوصية",
        },
    }[LANG];

    function navLinks(active, cls) {
        return NAV.map(function (n) {
            var isActive = n[0] === active;
            return '<a class="' + (cls || "") + (isActive ? " active" : "") + '"' + (isActive ? ' aria-current="page"' : '') + ' href="' + n[1] + '">' + n[2] + "</a>";
        }).join("");
    }

    function esc(value) {
        return String(value).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function langSwitchLink() {
        var current = window.location.pathname;
        var arHref = LANG === "ar" ? current : (current === "/datenschutz/" ? null : "/ar" + current);
        var deHref = LANG === "ar" ? current.replace(/^\/ar/, "") || "/" : current;
        deHref = esc(deHref);
        arHref = arHref && esc(arHref);
        return '<span class="site-language-tabs">' +
            '<a href="' + deHref + '" hreflang="de"' + (LANG === "de" ? ' class="active" aria-current="true"' : '') + '>DE</a>' +
            (arHref ? '<a href="' + arHref + '" hreflang="ar"' + (LANG === "ar" ? ' class="active" aria-current="true"' : '') + '>AR</a>' : '') +
        '</span>';
    }

    function headerHtml(active) {
        return '' +
        '<a class="skip-link" href="#main-content">' + T.skip + '</a>' +
        '<div class="site-announcement">' +
            '<span><b>' + T.announcement + '</b> ' + T.announcementRest + '</span>' +
            '<a href="' + PREFIX + '/kontakt/">' + T.freeConsult + ' <span aria-hidden="true"><svg class="uicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg></span></a>' +
        '</div>' +
        '<header class="site-header">' +
            '<div class="inner">' +
                '<a class="site-brand" href="' + (PREFIX || "/") + '" aria-label="' + T.home + '">' +
                    '<span class="brand-logo"><img src="/assets/logo-mark.png" alt="" width="512" height="512" /></span>' +
                    '<span class="site-brand-copy"><strong data-field="SiteName">D-Group IT Solutions</strong><small>' + T.tagline + '</small></span>' +
                '</a>' +
                '<nav class="site-nav" aria-label="Hauptnavigation">' +
                    navLinks(active) +
                    langSwitchLink() +
                    '<a class="cta" href="' + PREFIX + '/kontakt/">' + T.ctaNav + '</a>' +
                '</nav>' +
                '<details class="site-mobile-nav">' +
                    '<summary aria-label="' + T.menuOpen + '"><span></span><span></span><span></span></summary>' +
                    '<div class="site-mobile-panel">' +
                        navLinks(active) +
                        langSwitchLink() +
                        '<div class="site-mobile-panel-footer">' +
                            '<a class="cta" href="' + PREFIX + '/kontakt/">' + T.ctaMobile + '</a>' +
                        '</div>' +
                    '</div>' +
                '</details>' +
            '</div>' +
        '</header>';
    }

    function footerHtml() {
        return '' +
        '<footer class="site-footer"><div class="inner">' +
            '<div class="footer-brand"><span class="brand-logo"><img src="/assets/logo-mark.png" alt="" width="512" height="512" /></span><div><strong data-field="SiteName">D-Group IT Solutions</strong><small>' + T.footerTagline + '</small></div></div>' +
            '<div class="footer-links">' + navLinks(null) + '</div>' +
            '<div class="footer-legal"><a href="' + PREFIX + '/impressum/">' + T.impressum + '</a><a href="/datenschutz/">' + T.datenschutz + '</a>' +
                '<span>© <span data-field="year">' + new Date().getFullYear() + '</span> <span data-field="SiteName">D-Group IT Solutions</span></span></div>' +
        '</div></footer>';
    }

    // ---- Bewegung: Scroll-Reveal + Hero-Entrance ----
    // Zentral hier statt in jeder Seite einzeln, damit "Bewegung" ohne Änderung
    // an den einzelnen HTML-Dateien überall greift. Respektiert prefers-reduced-motion,
    // indem bei aktivierter Einstellung gar nicht erst beobachtet wird (Element
    // bleibt in seinem normalen, sofort sichtbaren Zustand).
    var REVEAL_SELECTOR = [
        ".s-feature", ".s-uc", ".s-price-card", ".s-setup", ".feature-module",
        ".s-download-card", ".hardware-product-card", ".contact-card", ".contact-aside",
        ".workflow-steps > div", ".s-bundle", ".system-node", ".system-center",
        ".s-hw-image", ".s-proof .inner > div", ".onboarding-step", ".faq-list details", ".pd-reveal", ".home-system-copy", ".home-system-image",
    ].join(",");

    function initRevealAnimations() {
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
            return;
        if (!("IntersectionObserver" in window))
            return;

        var els = document.querySelectorAll(REVEAL_SELECTOR);
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                io.unobserve(entry.target);
                entry.target.classList.add("is-visible");
                window.setTimeout(function () { entry.target.style.transitionDelay = ""; }, 900);
            });
        }, { threshold: 0.05, rootMargin: "0px 0px -20px 0px" });

        // Kinder desselben Elternknotens gemeinsam gestaffelt einblenden lassen
        // (Map statt {}, sonst würden verschiedene Elternelemente alle auf denselben
        // "[object HTMLDivElement]"-Schlüssel abgebildet).
        var siblingIndex = new Map();
        function observe(el) {
            if (el.hasAttribute("data-reveal")) return;
            var parent = el.parentElement;
            var idx = siblingIndex.get(parent) || 0;
            siblingIndex.set(parent, idx + 1);
            el.setAttribute("data-reveal", "");
            el.style.transitionDelay = Math.min(idx * 70, 420) + "ms";
            io.observe(el);
        }
        els.forEach(observe);
        // Hardware and download cards arrive asynchronously from the API.
        var main = document.querySelector(".site-main");
        if (main && "MutationObserver" in window) {
            new MutationObserver(function (records) {
                records.forEach(function (record) {
                    record.addedNodes.forEach(function (node) {
                        if (node.nodeType !== 1) return;
                        if (node.matches(REVEAL_SELECTOR)) observe(node);
                        node.querySelectorAll(REVEAL_SELECTOR).forEach(observe);
                    });
                });
            }).observe(main, { childList: true, subtree: true });
        }
    }

    function initHeroEntrance() {
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
            return;
        var copy = document.querySelector(".s-hero-copy, .feature-page-hero .s-lead");
        var visual = document.querySelector(".s-hero-visual");
        [copy, visual].forEach(function (el, i) {
            if (!el) return;
            el.setAttribute("data-hero-in", "");
            el.style.transitionDelay = (i * 110) + "ms";
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { el.classList.add("is-visible"); });
            });
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        var h = document.getElementById("site-header");
        if (h) h.outerHTML = headerHtml(h.getAttribute("data-active"));
        var f = document.getElementById("site-footer");
        if (f) f.outerHTML = footerHtml();
        var main = document.querySelector(".site-main");
        if (main && !main.id) main.id = "main-content";
        initHeroEntrance();
        initRevealAnimations();
    });
})();
