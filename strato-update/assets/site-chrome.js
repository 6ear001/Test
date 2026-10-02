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

    // ---- Menü: eine einzige Liste für Kopfzeile, Handy-Menü und Fußzeile ----
    // Eintrag: [Schlüssel (= data-active der Seite), Adresse, Beschriftung, Kurzbeschreibung, Symbol, optionales Schild]
    // Neue Seite aufnehmen: eine Zeile in der passenden Gruppe ergänzen. Menü, Handy-Menü und Fußzeile folgen automatisch.
    // Reihenfolge nach dem Weg eines Interessenten: Kassensoftware (Was ist es? Was kann es? Ausprobieren)
    // -> Hardware & Service (Worauf läuft es? Treiber/Updates, Beratung) -> Preise.
    var MENU = {
        de: {
            groups: [
                { id: "software", title: "Kassensoftware", items: [
                    ["pos-pda", PREFIX + "/pos-pda/", "Kasse &amp; PDA", "Touch-Kasse mit mobiler Bestandsprüfung", "cart"],
                    ["funktionen", PREFIX + "/funktionen/", "Funktionen", "Vom ersten Scan bis zur Buchhaltung", "layers"],
                    ["demo", PREFIX + "/pos-pda/#demo", "Live-Demo", "Kasse und PDA direkt ausprobieren", "play", "Neu"],
                ] },
                { id: "service", title: "Hardware &amp; Service", items: [
                    ["zubehoer", PREFIX + "/zubehoer/", "Hardware", "Terminals, Drucker, Scanner &amp; PDA", "device"],
                    ["downloads", PREFIX + "/downloads/", "Downloads", "Treiber, Tools &amp; Updates", "download"],
                    ["kontakt", PREFIX + "/kontakt/", "Kontakt", "Kostenlose Beratung anfragen", "mail"],
                ] },
            ],
            direct: ["preise", PREFIX + "/preise/", "Preise", "Ein Preis pro Kasse, TSE inklusive", "tag"],
            legal: "Rechtliches",
        },
        ar: {
            groups: [
                { id: "software", title: "برنامج الكاشير", items: [
                    ["pos-pda", PREFIX + "/pos-pda/", "الكاشير وPDA", "كاشير باللمس مع فحص مخزون متنقل", "cart"],
                    ["funktionen", PREFIX + "/funktionen/", "المزايا", "من أول عملية مسح حتى المحاسبة", "layers"],
                    ["demo", PREFIX + "/pos-pda/#demo", "تجربة مباشرة", "جرّب الكاشير وPDA بنفسك", "play", "جديد"],
                ] },
                { id: "service", title: "الأجهزة والخدمات", items: [
                    ["zubehoer", PREFIX + "/zubehoer/", "الأجهزة", "أجهزة الكاشير وPDA والملحقات", "device"],
                    ["downloads", PREFIX + "/downloads/", "التحميلات", "التعريفات والأدوات والتحديثات", "download"],
                    ["kontakt", PREFIX + "/kontakt/", "تواصل معنا", "استشارة مجانية وغير ملزمة", "mail"],
                ] },
            ],
            direct: ["preise", PREFIX + "/preise/", "الأسعار", "سعر واحد لكل كاشير، TSE مشمول", "tag"],
            legal: "قانوني",
        },
    }[LANG];

    var ICONS = {
        cart: "M3 4h2.2l2.1 10.2a1 1 0 0 0 1 .8h8.4a1 1 0 0 0 1-.8L19.5 8H6.2M9 18.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM17 18.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z",
        layers: "M12 3 3 8l9 5 9-5-9-5zM3 12.5l9 5 9-5M3 17l9 5 9-5",
        play: "M8 5.5v13l11-6.5z",
        device: "M3 5h18v11H3zM9 20h6M12 16v4",
        download: "M12 4v11M7.5 11 12 15.5 16.5 11M5 20h14",
        mail: "M3 6h18v12H3zM3 7l9 6 9-6",
        tag: "M3.5 12.5V4.5h8l9 9-8 8-9-9zM8 8.5h.01",
        chev: "M6 9l6 6 6-6",
        arrow: "M5 12h14M13 6l6 6-6 6",
    };
    function icon(name, cls) {
        return '<svg class="uicon' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + ICONS[name] + '"/></svg>';
    }

    var T = {
        de: {
            skip: "Zum Inhalt springen", announcement: "Alles verbunden.", announcementRest: "Kasse, Warenwirtschaft &amp; Buchhaltung.",
            freeConsult: "Kostenlose Beratung", home: "Zur Startseite", tagline: "Kasse · Warenwirtschaft · Cloud",
            ctaNav: "Beratung anfragen", menuOpen: "Menü öffnen", ctaMobile: "Beratung", navLabel: "Hauptnavigation",
            footerLead: "Touch-Kasse, Warenwirtschaft und mobiler PDA in einem System – mit Cloud-TSE inklusive.",
            footerTagline: "Digitale Lösungen für den Handel", impressum: "Impressum", datenschutz: "Datenschutz",
        },
        ar: {
            skip: "الانتقال إلى المحتوى", announcement: "كل شيء مترابط.", announcementRest: "الكاشير، إدارة المخزون والمحاسبة.",
            freeConsult: "استشارة مجانية", home: "الصفحة الرئيسية", tagline: "الكاشير · إدارة المخزون · الحوسبة السحابية",
            ctaNav: "اطلب استشارة", menuOpen: "فتح القائمة", ctaMobile: "استشارة", navLabel: "التنقل الرئيسي",
            footerLead: "كاشير يعمل باللمس وإدارة مخزون وPDA متنقل في نظام واحد – مع TSE سحابي مشمول.",
            footerTagline: "حلول رقمية لقطاع التجارة", impressum: "بيانات الشركة", datenschutz: "سياسة الخصوصية",
        },
    }[LANG];

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

    // Eintrag mit Symbol, Beschriftung und Kurzbeschreibung (Aufklappfeld und Handy-Menü)
    function itemHtml(it, active, cls) {
        var isActive = it[0] === active;
        return '<a class="' + cls + (isActive ? " active" : "") + '"' + (isActive ? ' aria-current="page"' : "") + ' href="' + it[1] + '">' +
            '<span class="mn-ic">' + icon(it[4]) + '</span>' +
            '<span class="mn-tx"><strong>' + it[2] + '</strong><small>' + it[3] + '</small></span>' +
            (it[5] ? '<span class="mn-badge">' + it[5] + '</span>' : "") +
        '</a>';
    }

    function groupHtml(group, active) {
        var id = "mn-" + group.id;
        var hasActive = group.items.some(function (it) { return it[0] === active; });
        return '<div class="mn-group">' +
            '<button type="button" class="mn-trigger' + (hasActive ? " is-active" : "") + '" id="' + id + '-btn" aria-expanded="false" aria-controls="' + id + '">' + group.title + icon("chev", "mn-chev") + '</button>' +
            '<div class="mn-panel" id="' + id + '" role="group" aria-labelledby="' + id + '-btn">' +
                group.items.map(function (it) { return itemHtml(it, active, "mn-item"); }).join("") +
            '</div>' +
        '</div>';
    }

    function directHtml(it, active) {
        var isActive = it[0] === active;
        return '<a class="mn-link' + (isActive ? " active" : "") + '"' + (isActive ? ' aria-current="page"' : "") + ' href="' + it[1] + '">' + it[2] + '</a>';
    }

    // Im Handy-Menü und in der Fußzeile gehören die Preise zur Kassensoftware.
    function mobileHtml(active) {
        return MENU.groups.map(function (g, i) {
            var items = i === 0 ? g.items.concat([MENU.direct]) : g.items;
            return '<p class="mn-m-title">' + g.title + '</p>' + items.map(function (it) { return itemHtml(it, active, "mn-m-item"); }).join("");
        }).join("");
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
                '<nav class="site-nav" aria-label="' + T.navLabel + '">' +
                    MENU.groups.map(function (g) { return groupHtml(g, active); }).join("") +
                    directHtml(MENU.direct, active) +
                    langSwitchLink() +
                    '<a class="cta" href="' + PREFIX + '/kontakt/">' + T.ctaNav + '</a>' +
                '</nav>' +
                '<details class="site-mobile-nav">' +
                    '<summary aria-label="' + T.menuOpen + '"><span></span><span></span><span></span></summary>' +
                    '<div class="site-mobile-panel mn-mobile">' +
                        mobileHtml(active) +
                        '<div class="site-mobile-panel-footer">' +
                            langSwitchLink() +
                            '<a class="cta" href="' + PREFIX + '/kontakt/">' + T.ctaMobile + '</a>' +
                        '</div>' +
                    '</div>' +
                '</details>' +
            '</div>' +
        '</header>';
    }

    // Fußzeile mit Überschriften: Kassensoftware | Hardware & Service | Rechtliches
    function footerColumn(title, links) {
        return '<nav class="mn-foot-col" aria-label="' + title.replace(/&amp;/g, "&") + '">' +
            '<p class="mn-foot-title">' + title + '</p><ul>' +
            links.map(function (it) {
                return '<li><a href="' + it[1] + '">' + it[2] + (it[5] ? ' <span class="mn-badge">' + it[5] + '</span>' : "") + '</a></li>';
            }).join("") + '</ul></nav>';
    }

    function footerHtml() {
        var legal = [["impressum", PREFIX + "/impressum/", T.impressum], ["datenschutz", "/datenschutz/", T.datenschutz]];
        return '' +
        '<footer class="site-footer"><div class="inner mn-footer">' +
            '<div class="mn-foot-brand">' +
                '<div class="footer-brand"><span class="brand-logo"><img src="/assets/logo-mark.png" alt="" width="512" height="512" /></span><div><strong data-field="SiteName">D-Group IT Solutions</strong><small>' + T.footerTagline + '</small></div></div>' +
                '<p class="mn-foot-lead">' + T.footerLead + '</p>' +
                '<a class="mn-foot-cta" href="' + PREFIX + '/kontakt/">' + T.freeConsult + ' ' + icon("arrow") + '</a>' +
            '</div>' +
            footerColumn(MENU.groups[0].title, MENU.groups[0].items.concat([MENU.direct])) +
            footerColumn(MENU.groups[1].title, MENU.groups[1].items) +
            footerColumn(MENU.legal, legal) +
            '<div class="footer-legal"><span>© <span data-field="year">' + new Date().getFullYear() + '</span> <span data-field="SiteName">D-Group IT Solutions</span></span></div>' +
        '</div></footer>';
    }

    // ---- Aufklappmenü: Maus, Tastatur, Touch ----
    function initMenu() {
        var groups = Array.prototype.slice.call(document.querySelectorAll(".mn-group"));
        if (!groups.length) return;
        var canHover = !!(window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches);

        function trigger(g) { return g.querySelector(".mn-trigger"); }
        function close(g) {
            window.clearTimeout(g._timer);
            g.classList.remove("is-open");
            trigger(g).setAttribute("aria-expanded", "false");
        }
        function open(g) {
            groups.forEach(function (other) { if (other !== g) close(other); });
            window.clearTimeout(g._timer);
            g.classList.add("is-open");
            trigger(g).setAttribute("aria-expanded", "true");
            // Ragt das Feld über den Rand, am anderen Ende des Menüpunkts ausrichten
            var panel = g.querySelector(".mn-panel");
            panel.classList.remove("mn-end");
            var r = panel.getBoundingClientRect();
            if (r.right > window.innerWidth - 12 || r.left < 12) panel.classList.add("mn-end");
        }
        function items(g) { return Array.prototype.slice.call(g.querySelectorAll(".mn-item")); }

        groups.forEach(function (g) {
            trigger(g).addEventListener("click", function () {
                if (g.classList.contains("is-open") && !canHover) close(g); else open(g);
            });
            if (canHover) {
                g.addEventListener("mouseenter", function () { open(g); });
                g.addEventListener("mouseleave", function () { g._timer = window.setTimeout(function () { close(g); }, 180); });
            }
            g.addEventListener("focusout", function (event) {
                if (!event.relatedTarget || !g.contains(event.relatedTarget)) close(g);
            });
            g.addEventListener("keydown", function (event) {
                var list = items(g), index = list.indexOf(document.activeElement), next = null;
                if (event.key === "Escape") { close(g); trigger(g).focus(); return; }
                if (event.key === "ArrowDown") { next = index < 0 ? 0 : (index + 1) % list.length; }
                else if (event.key === "ArrowUp" && index >= 0) { next = (index + list.length - 1) % list.length; }
                else if (event.key === "Home" && index >= 0) { next = 0; }
                else if (event.key === "End" && index >= 0) { next = list.length - 1; }
                if (next === null) return;
                event.preventDefault();
                if (!g.classList.contains("is-open")) open(g);
                list[next].focus();
            });
        });
        document.addEventListener("click", function (event) {
            groups.forEach(function (g) { if (!g.contains(event.target)) close(g); });
        });
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
        initMenu();
        initHeroEntrance();
        initRevealAnimations();
    });
})();
