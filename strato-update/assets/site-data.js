// Lädt Preise, Kontaktdaten und Hardware live vom Contabo-Server – über die
// PHP-Skripte im Wurzelverzeichnis (api-site.php, api-hardware.php,
// hardware-image.php, kontakt.php), die die Anfrage serverseitig weiterleiten.
// So bleibt die tatsächliche Backend-Adresse aus Entwicklertools/Netzwerk-Tab
// heraus – der Browser spricht ausschließlich mit der eigenen Domain.
// Läuft ohne Build-Schritt / Framework – reines Browser-JavaScript, passend
// für klassisches Datei-Hosting (Strato/IONOS Basic).
(function () {
    "use strict";

    var euroFmt = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function euro(v) { return euroFmt.format(v) + " €"; }
    function pct(v) { return (v % 1 === 0 ? String(v) : v.toFixed(1)) + " %"; }

    function fill(field, value) {
        document.querySelectorAll('[data-field="' + field + '"]').forEach(function (el) {
            el.textContent = value;
        });
    }

    function fillHref(field, value) {
        document.querySelectorAll('[data-field-href="' + field + '"]').forEach(function (el) {
            el.setAttribute("href", value);
        });
    }

    function showIf(selector, condition) {
        document.querySelectorAll(selector).forEach(function (el) {
            el.style.display = condition ? "" : "none";
        });
    }

    var SiteData = {
        euro: euro,
        pct: pct,
        logoUrl: function () { return "/assets/logo-mark.png"; },
        hardwareImageUrl: function (id) { return "/hardware-image.php?id=" + encodeURIComponent(id); },
        downloadFileUrl: function (id) { return "/download-file.php?id=" + encodeURIComponent(id); },
        contactActionUrl: function () { return "/kontakt.php"; },

        loadSiteInfo: function () {
            return fetch("/api-site.php").then(function (r) {
                if (!r.ok) throw new Error("site info " + r.status);
                return r.json();
            });
        },

        loadHardware: function () {
            return fetch("/api-hardware.php").then(function (r) {
                if (!r.ok) throw new Error("hardware " + r.status);
                return r.json();
            });
        },

        loadDownloads: function () {
            return fetch("/api-downloads.php").then(function (r) {
                if (!r.ok) throw new Error("downloads " + r.status);
                return r.json();
            });
        },

        formatFileSize: function (bytes) {
            var mb = bytes / 1024 / 1024;
            return mb >= 0.1 ? euroFmt.format(mb) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
        },

        // Die Website verwendet die festgelegte Marke und das mitgelieferte Logo.
        // Preise und Kontaktangaben werden weiterhin aus der API übernommen.
        applyCommon: function (s) {
            fill("SiteName", "D-Group IT Solutions");
            var year = document.querySelector('[data-field="year"]');
            if (year) year.textContent = new Date().getFullYear();

            if (s.contactEmail) {
                fill("ContactEmail", s.contactEmail);
                fillHref("ContactEmailHref", "mailto:" + s.contactEmail);
            }
            showIf('[data-if="ContactEmail"]', !!s.contactEmail);
            showIf('[data-if-not="ContactEmail"]', !s.contactEmail);

            if (s.contactPhone) fill("ContactPhone", s.contactPhone);
            showIf('[data-if="ContactPhone"]', !!s.contactPhone);
            showIf('[data-if-not="ContactPhone"]', !s.contactPhone);

            if (s.contactAddress) {
                document.querySelectorAll('[data-field="ContactAddress"]').forEach(function (el) {
                    el.textContent = "";
                    s.contactAddress.split("\n").forEach(function (line, i) {
                        if (i > 0) el.appendChild(document.createElement("br"));
                        el.appendChild(document.createTextNode(line));
                    });
                });
            }
            showIf('[data-if="ContactAddress"]', !!s.contactAddress);
            showIf('[data-if-not="ContactAddress"]', !s.contactAddress);

            // Impressum: Rechtsdaten, ursprünglich für die Kassen-Kunden-Rechnungen
            // angelegt (Website-Einstellungen -> Rechnungsdaten), hier zusätzlich
            // fürs öffentliche Impressum verwendet - ohne Bankdaten/Steuernummer.
            if (s.legalCompanyName) fill("LegalCompanyName", s.legalCompanyName);
            showIf('[data-if="LegalCompanyName"]', !!s.legalCompanyName);
            showIf('[data-if-not="LegalCompanyName"]', !s.legalCompanyName);

            var hasLegalAddress = !!(s.legalStreet && s.legalZipCode && s.legalCity);
            if (hasLegalAddress) {
                fill("LegalStreet", s.legalStreet);
                fill("LegalZipCode", s.legalZipCode);
                fill("LegalCity", s.legalCity);
                fill("LegalCountry", s.legalCountry || "Deutschland");
            }
            showIf('[data-if="LegalAddress"]', hasLegalAddress);
            showIf('[data-if-not="LegalAddress"]', !hasLegalAddress);

            if (s.legalVatId) fill("LegalVatId", s.legalVatId);
            showIf('[data-if="LegalVatId"]', !!s.legalVatId);
            showIf('[data-if-not="LegalVatId"]', !s.legalVatId);

            if (s.legalManagingDirector) fill("LegalManagingDirector", s.legalManagingDirector);
            showIf('[data-if="LegalManagingDirector"]', !!s.legalManagingDirector);
            showIf('[data-if-not="LegalManagingDirector"]', !s.legalManagingDirector);

            if (s.legalRegisterInfo) fill("LegalRegisterInfo", s.legalRegisterInfo);
            showIf('[data-if="LegalRegisterInfo"]', !!s.legalRegisterInfo);
            showIf('[data-if-not="LegalRegisterInfo"]', !s.legalRegisterInfo);

            if (s.websiteUrl) {
                fill("WebsiteUrl", s.websiteUrl);
                fillHref("WebsiteUrlHref", s.websiteUrl);
            }
            showIf('[data-if="WebsiteUrl"]', !!s.websiteUrl);
            showIf('[data-if-not="WebsiteUrl"]', !s.websiteUrl);

            // Datenschutzerklärung: eigene Platzhalter-Felder, ebenfalls unter
            // Website -> Rechnungsdaten im Control Panel gepflegt.
            if (s.privacyOfficerContact) fill("PrivacyOfficerContact", s.privacyOfficerContact);
            showIf('[data-if="PrivacyOfficerContact"]', !!s.privacyOfficerContact);
            showIf('[data-if-not="PrivacyOfficerContact"]', !s.privacyOfficerContact);

            if (s.logRetentionPeriod) fill("LogRetentionPeriod", s.logRetentionPeriod);
            showIf('[data-if="LogRetentionPeriod"]', !!s.logRetentionPeriod);
            showIf('[data-if-not="LogRetentionPeriod"]', !s.logRetentionPeriod);

            if (s.hostingProvider) fill("HostingProvider", s.hostingProvider);
            showIf('[data-if="HostingProvider"]', !!s.hostingProvider);
            showIf('[data-if-not="HostingProvider"]', !s.hostingProvider);

            if (s.hostingLocation) fill("HostingLocation", s.hostingLocation);
            showIf('[data-if="HostingLocation"]', !!s.hostingLocation);
            showIf('[data-if-not="HostingLocation"]', !s.hostingLocation);

            if (s.supervisoryAuthority) fill("SupervisoryAuthority", s.supervisoryAuthority);
            showIf('[data-if="SupervisoryAuthority"]', !!s.supervisoryAuthority);
            showIf('[data-if-not="SupervisoryAuthority"]', !s.supervisoryAuthority);

            var now = new Date();
            var months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
                "August", "September", "Oktober", "November", "Dezember"];
            fill("PrivacyPolicyDate", months[now.getMonth()] + " " + now.getFullYear());
        },

        // Preis-Zyklus-Umschalter (Monatlich/Quartalsweise/Jährlich), wie zuvor
        // in Preise.razor/Home.razor per Blazor @onclick - hier als reines JS-
        // Äquivalent, da eine statische Seite keine Server-Interaktivität hat.
        initCycleToggle: function (s, root) {
            root = root || document;
            var buttons = root.querySelectorAll("[data-cycle]");
            // Einheit und Spar-Hinweis richten sich nach <html lang> (Deutsch/Arabisch).
            var ar = document.documentElement.lang === "ar";
            function saveText(percent) {
                if (!(percent > 0)) return null;
                return ar ? "وفّر " + percent + "% مقارنة بالدفع الشهري"
                          : "Sie sparen " + percent + " % gegenüber monatlicher Zahlung";
            }
            var cycles = {
                monthly: {
                    gross: s.monthlyPriceGross, net: s.monthlyPriceNet, unit: ar ? "شهر" : "Monat",
                    save: null,
                },
                quarterly: {
                    gross: s.quarterlyPriceGross, net: s.quarterlyPriceNet, unit: ar ? "ربع سنة" : "Quartal",
                    save: saveText(s.quarterlyDiscountPercent),
                },
                yearly: {
                    gross: s.yearlyPriceGross, net: s.yearlyPriceNet, unit: ar ? "سنة" : "Jahr",
                    save: saveText(s.yearlyDiscountPercent),
                },
            };

            function apply(cycle) {
                var c = cycles[cycle];
                buttons.forEach(function (b) {
                    b.classList.toggle("active", b.getAttribute("data-cycle") === cycle);
                    b.setAttribute("aria-pressed", String(b.getAttribute("data-cycle") === cycle));
                });
                root.querySelectorAll('[data-cycle-field="gross"]').forEach(function (el) { el.textContent = euro(c.gross); });
                root.querySelectorAll('[data-cycle-field="net"]').forEach(function (el) { el.textContent = euro(c.net); });
                root.querySelectorAll('[data-cycle-field="unit"]').forEach(function (el) { el.textContent = c.unit; });
                root.querySelectorAll('[data-cycle-field="save"]').forEach(function (el) {
                    el.textContent = c.save || "";
                    el.style.display = c.save ? "" : "none";
                });
            }

            buttons.forEach(function (b) {
                b.addEventListener("click", function () { apply(b.getAttribute("data-cycle")); });
            });
            apply("monthly");
        },

        // Preisfelder ohne Zyklus (Preis-Card "Einmalige Bereitstellung", Bundle-Sektion).
        applyStaticPrices: function (s, root) {
            root = root || document;
            fill("VatPercent", pct(s.vatPercent));
            fill("MinimumTermMonths", s.minimumTermMonths);
            fill("SetupPriceGross", euro(s.setupPriceGross));
            fill("SetupPriceGrossWithHardware", euro(s.setupPriceGrossWithHardware));
            fill("HardwareDiscountPercent", s.hardwareDiscountPercent);
            fill("MonthlyPriceGross", euro(s.monthlyPriceGross));
            showIf('[data-if="HardwareDiscount"]', s.hardwareDiscountPercent > 0);
            showIf('[data-if-not="HardwareDiscount"]', !(s.hardwareDiscountPercent > 0));
        },
    };

    window.SiteData = SiteData;
})();
