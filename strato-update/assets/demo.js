// Interaktive Demo für Kasse und PDA auf /pos-pda/ und /ar/pos-pda/.
// Reines Browser-JavaScript ohne Build-Schritt und ohne Backend: Artikel und Texte stehen unten in
// dieser Datei (Deutsch und Arabisch). Es werden keine echten Buchungen oder TSE-Signaturen erzeugt.
// Die Sprache richtet sich nach <html lang>, genau wie in site-chrome.js.
(function () {
    "use strict";

    var LANG = document.documentElement.lang === "ar" ? "ar" : "de";
    var CONTACT_URL = (LANG === "ar" ? "/ar" : "") + "/kontakt/?produkt=" + encodeURIComponent("Kasse & PDA");

    // ---- Texte ---------------------------------------------------------------------------------
    var TEXT = {
        de: {
            cashier: "Kasse", cashierName: "Kassierer: Demo", demo: "Demo",
            search: "Artikel suchen …", searchLabel: "Artikel suchen", groups: "Warengruppen", articles: "Artikelauswahl",
            cart: "Warenkorb", pos: "Pos.", cancel: "Bon abbrechen",
            emptyTitle: "Noch keine Artikel.", emptyHint: "Tippen Sie auf einen Artikel.",
            toPay: "Zu zahlen", cash: "Bar", card: "Karte", noResult: "Kein Artikel gefunden.",
            vatIncl: "inkl. {0} % MwSt.", deposit: "Pfand", withDeposit: "zuzüglich Pfand", add: "hinzufügen",
            less: "Menge verringern", more: "Menge erhöhen", qty: "Menge",
            rcTitle: "D-GROUP DEMO-MARKT", rcSub: "Beispielbeleg – kein echter Kassenbon", rcSum: "SUMME",
            rcGiven: "Bar gegeben", rcChange: "Rückgeld", rcCard: "Karte (kontaktlos)",
            rcTse: "In der echten Kasse sichert die Cloud-TSE jeden Verkauf ab.", rcNo: "Bon-Nr.", rcThanks: "Vielen Dank für Ihren Einkauf!",
            newSale: "Neuer Verkauf", inquire: "Beratung anfragen",
            pdaHome: "Hauptmenü", stock: "Bestand prüfen", find: "Produkte suchen", capture: "Daten erfassen", scan: "Barcode scannen",
            connected: "Verbunden mit Kasse 1", synced: "Datenstand aktuell",
            start: "Scan starten", next: "Nächsten Artikel scannen", scanning: "Scannt …", reading: "Barcode wird gelesen …",
            inStock: "Bestand im Lager", pcs: "Stk.", pdaLabel: "Interaktive Demo des D-Group PDA"
        },
        ar: {
            cashier: "الكاشير", cashierName: "أمين الصندوق: تجريبي", demo: "تجريبي",
            search: "ابحث عن صنف …", searchLabel: "البحث عن الأصناف", groups: "مجموعات السلع", articles: "اختيار الأصناف",
            cart: "سلة الشراء", pos: "بند", cancel: "إلغاء الإيصال",
            emptyTitle: "لا توجد أصناف بعد.", emptyHint: "انقر على صنف لإضافته.",
            toPay: "المبلغ المستحق", cash: "نقدًا", card: "بالبطاقة", noResult: "لم يتم العثور على أي صنف.",
            vatIncl: "شامل ضريبة القيمة المضافة {0}%", deposit: "رسم العبوة (Pfand)", withDeposit: "بالإضافة إلى رسم العبوة", add: "إضافة",
            less: "تقليل الكمية", more: "زيادة الكمية", qty: "الكمية",
            rcTitle: "D-GROUP متجر تجريبي", rcSub: "إيصال تجريبي – ليس إيصالًا حقيقيًا", rcSum: "الإجمالي",
            rcGiven: "المبلغ المدفوع نقدًا", rcChange: "الباقي", rcCard: "بطاقة (دون تلامس)",
            rcTse: "في الكاشير الحقيقية، يؤمّن TSE السحابي كل عملية بيع.", rcNo: "رقم الإيصال", rcThanks: "شكرًا لتسوّقكم!",
            newSale: "عملية بيع جديدة", inquire: "اطلب استشارة",
            pdaHome: "القائمة الرئيسية", stock: "فحص المخزون", find: "البحث عن المنتجات", capture: "إدخال بيانات متنقل", scan: "مسح الباركود",
            connected: "متصل بالكاشير 1", synced: "البيانات محدّثة",
            start: "ابدأ المسح", next: "امسح الصنف التالي", scanning: "جارٍ المسح …", reading: "جارٍ قراءة الباركود …",
            inStock: "المخزون في المستودع", pcs: "قطعة", pdaLabel: "عرض تفاعلي لجهاز D-Group PDA"
        }
    };
    var T = TEXT[LANG];

    // ---- Demo-Artikel (Preise in Cent, brutto; vat = MwSt.-Satz; deposit = Pfand je Stück) -------
    var CATEGORIES = [
        { id: "alle", de: "Alle Artikel", ar: "كل الأصناف" },
        { id: "getraenke", de: "Getränke", ar: "مشروبات" },
        { id: "backwaren", de: "Backwaren", ar: "مخبوزات" },
        { id: "obst", de: "Obst", ar: "فواكه" },
        { id: "snacks", de: "Snacks", ar: "وجبات خفيفة" },
        { id: "haushalt", de: "Haushalt", ar: "مستلزمات المنزل" }
    ];
    var ITEMS = [
        { id: "wasser", icon: "💧", cat: "getraenke", price: 89, vat: 19, deposit: 25, de: "Mineralwasser 1 L", ar: "مياه معدنية 1 لتر" },
        { id: "cola", icon: "🥤", cat: "getraenke", price: 149, vat: 19, deposit: 25, de: "Cola 0,5 L", ar: "كولا 0٫5 لتر" },
        { id: "saft", icon: "🧃", cat: "getraenke", price: 179, vat: 19, deposit: 25, de: "Apfelsaft 1 L", ar: "عصير تفاح 1 لتر" },
        { id: "broetchen", icon: "🥐", cat: "backwaren", price: 45, vat: 7, de: "Brötchen", ar: "خبز صغير" },
        { id: "vollkornbrot", icon: "🍞", cat: "backwaren", price: 249, vat: 7, de: "Vollkornbrot", ar: "خبز القمح الكامل" },
        { id: "banane", icon: "🍌", cat: "obst", price: 39, vat: 7, de: "Banane", ar: "موز" },
        { id: "apfel", icon: "🍎", cat: "obst", price: 299, vat: 7, de: "Äpfel 1 kg", ar: "تفاح 1 كغ" },
        { id: "schoko", icon: "🍫", cat: "snacks", price: 129, vat: 7, de: "Schokoriegel", ar: "لوح شوكولاتة" },
        { id: "chips", icon: "🥔", cat: "snacks", price: 199, vat: 7, de: "Chips 150 g", ar: "رقائق بطاطس 150 غ" },
        { id: "reiniger", icon: "🧴", cat: "haushalt", price: 279, vat: 19, de: "Haushaltsreiniger", ar: "منظف منزلي" },
        { id: "spuelmittel", icon: "🧼", cat: "haushalt", price: 159, vat: 19, de: "Spülmittel", ar: "سائل غسيل الأطباق" }
    ];

    // ---- Helfer --------------------------------------------------------------------------------
    var euroFmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
    function money(cents) { return euroFmt.format(cents / 100); }
    function fmt(text, value) { return text.replace("{0}", value); }
    function itemName(item) { return item[LANG]; }

    function motionReduced() {
        return document.documentElement.classList.contains("motion-paused") ||
            (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }

    function el(tag, props, children) {
        var node = document.createElement(tag);
        Object.keys(props || {}).forEach(function (key) {
            var value = props[key];
            if (value === null || value === undefined || value === false) return;
            if (key === "class") node.className = value;
            else if (key === "text") node.textContent = value;
            else node.setAttribute(key, value === true ? "" : value);
        });
        (children || []).forEach(function (child) {
            if (child === null || child === undefined || child === false) return;
            node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
        });
        return node;
    }

    // Zahlen und Währung bleiben auch in der arabischen Seite links-nach-rechts lesbar.
    function num(text, cls) { return el("span", { "class": "dm-num" + (cls ? " " + cls : ""), text: text }); }

    var ICONS = {
        search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
        cart: "M3 4h2.2l2.1 10.2a1 1 0 0 0 1 .8h8.4a1 1 0 0 0 1-.8L19.5 8H6.2M9 18.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM17 18.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z",
        cash: "M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6.5 10v4M17.5 10v4",
        card: "M3 6h18v12H3zM3 10h18M7 15h4",
        scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 9v6M12 9v6M16 9v6",
        box: "M12 3l8 4.2v9.6L12 21l-8-4.2V7.2L12 3zM4 7.2l8 4.3 8-4.3M12 11.5V21",
        clip: "M9 4h6v3H9zM7 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M9 12h6M9 16h4",
        chevron: "M9 6l6 6-6 6"
    };
    function icon(name) {
        var NS = "http://www.w3.org/2000/svg";
        var svg = document.createElementNS(NS, "svg");
        svg.setAttribute("class", "uicon");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");
        var path = document.createElementNS(NS, "path");
        path.setAttribute("d", ICONS[name]);
        svg.appendChild(path);
        return svg;
    }

    // ---- Kassen-Demo ---------------------------------------------------------------------------
    function initPos(mount) {
        var items = {};
        ITEMS.forEach(function (item) { items[item.id] = item; });
        var cart = {};      // id -> Menge
        var order = [];     // Reihenfolge der Positionen
        var category = "alle";
        var query = "";
        var billNo = 0;

        var searchInput = el("input", { type: "search", placeholder: T.search, autocomplete: "off" });
        var catsEl = el("div", { "class": "dm-cats", role: "group", "aria-label": T.groups });
        var gridEl = el("div", { "class": "dm-grid" });
        var linesEl = el("ul", { "class": "dm-lines", "aria-live": "polite" });
        var emptyEl = el("div", { "class": "dm-empty" }, [icon("cart"), el("p", {}, [T.emptyTitle, el("br"), el("small", { text: T.emptyHint })])]);
        var sumsEl = el("dl", { "class": "dm-sums", hidden: true });
        var countEl = el("span", { "class": "dm-count", text: "0 " + T.pos });
        var clearBtn = el("button", { "class": "dm-link", type: "button", hidden: true, text: T.cancel });
        var totalEl = num(money(0), "dm-total-value");
        var cashBtn = el("button", { "class": "dm-pay", type: "button", disabled: true }, [icon("cash"), " " + T.cash]);
        var cardBtn = el("button", { "class": "dm-pay dm-pay-primary", type: "button", disabled: true }, [icon("card"), " " + T.card]);

        mount.appendChild(el("div", { "class": "dm-top" }, [
            el("div", { "class": "dm-title" }, [
                el("strong", { text: T.cashier }),
                el("span", { text: T.cashierName })
            ]),
            el("label", { "class": "dm-search" }, [icon("search"), el("span", { "class": "dm-sr", text: T.searchLabel }), searchInput]),
            el("span", { "class": "dm-badge" }, [el("i", { "class": "status-dot", "aria-hidden": "true" }), " " + T.demo])
        ]));
        mount.appendChild(el("div", { "class": "dm-body" }, [
            el("section", { "class": "dm-main", "aria-label": T.articles }, [catsEl, gridEl]),
            el("aside", { "class": "dm-cart", "aria-label": T.cart }, [
                el("div", { "class": "dm-cart-head" }, [el("h3", { text: T.cart }), countEl, clearBtn]),
                linesEl, emptyEl, sumsEl,
                el("div", { "class": "dm-total", "aria-live": "polite" }, [el("span", { text: T.toPay }), totalEl]),
                el("div", { "class": "dm-payrow" }, [cashBtn, cardBtn])
            ])
        ]));

        CATEGORIES.forEach(function (cat) {
            catsEl.appendChild(el("button", { "class": "dm-cat", type: "button", "data-cat": cat.id, "aria-pressed": String(cat.id === category), text: cat[LANG] }));
        });

        function renderTiles() {
            var q = query.trim().toLowerCase();
            var list = ITEMS.filter(function (item) {
                return (category === "alle" || item.cat === category) && (!q || itemName(item).toLowerCase().indexOf(q) !== -1);
            });
            gridEl.textContent = "";
            if (!list.length) { gridEl.appendChild(el("p", { "class": "dm-status", text: T.noResult })); return; }
            list.forEach(function (item) {
                var label = itemName(item) + ", " + money(item.price) + (item.deposit ? " " + T.withDeposit : "") + ", " + T.add;
                gridEl.appendChild(el("button", { "class": "dm-tile", type: "button", "data-id": item.id, "aria-label": label }, [
                    el("span", { "class": "dm-tile-icon", "aria-hidden": "true", text: item.icon }),
                    el("span", { "class": "dm-tile-name", text: itemName(item) }),
                    num(money(item.price), "dm-tile-price")
                ]));
            });
            updateBadges();
        }

        // Nur die Zähler aktualisieren, damit der Fokus auf der Kachel bleibt (Tastatur, Screenreader)
        function updateBadges() {
            Array.prototype.forEach.call(gridEl.querySelectorAll(".dm-tile"), function (tile) {
                var qty = cart[tile.getAttribute("data-id")] || 0;
                var badge = tile.querySelector(".dm-tile-qty");
                if (!qty) { if (badge) badge.remove(); return; }
                if (!badge) { badge = el("span", { "class": "dm-tile-qty" }); tile.insertBefore(badge, tile.firstChild); }
                badge.textContent = qty;
            });
        }

        function totals() {
            var gross = 0, deposit = 0, byRate = {};
            order.forEach(function (id) {
                var item = items[id], qty = cart[id];
                gross += item.price * qty;
                deposit += (item.deposit || 0) * qty;
                byRate[item.vat] = (byRate[item.vat] || 0) + item.price * qty;
            });
            var vat = Object.keys(byRate).map(Number).sort(function (a, b) { return a - b; }).map(function (rate) {
                return { rate: rate, amount: Math.round(byRate[rate] * rate / (100 + rate)) };
            });
            return { total: gross + deposit, deposit: deposit, vat: vat };
        }

        function renderCart(focusKey) {
            var t = totals();
            var has = order.length > 0;

            linesEl.textContent = "";
            order.forEach(function (id) {
                var item = items[id], qty = cart[id];
                var meta = qty + " × " + money(item.price) + (item.deposit ? " · " + T.deposit + " " + money(item.deposit * qty) : "");
                linesEl.appendChild(el("li", { "class": "dm-line" }, [
                    el("span", { "class": "dm-line-name", text: itemName(item) }),
                    num(money(item.price * qty), "dm-line-sum"),
                    num(meta, "dm-line-meta"),
                    el("span", { "class": "dm-stepper" }, [
                        el("button", { type: "button", "data-action": "dec", "data-id": id, "aria-label": T.less + ": " + itemName(item), text: "−" }),
                        el("output", { "aria-label": T.qty + " " + qty, text: qty }),
                        el("button", { type: "button", "data-action": "inc", "data-id": id, "aria-label": T.more + ": " + itemName(item), text: "+" })
                    ])
                ]));
            });

            emptyEl.hidden = has;
            sumsEl.hidden = !has;
            clearBtn.hidden = !has;
            cashBtn.disabled = cardBtn.disabled = !has;
            countEl.textContent = order.length + " " + T.pos;
            totalEl.textContent = money(t.total);

            sumsEl.textContent = "";
            t.vat.forEach(function (v) { sumsEl.appendChild(el("div", {}, [el("dt", { text: fmt(T.vatIncl, v.rate) }), el("dd", {}, [num(money(v.amount))])])); });
            if (t.deposit) sumsEl.appendChild(el("div", {}, [el("dt", { text: T.deposit }), el("dd", {}, [num(money(t.deposit))])]));

            if (focusKey) {
                var parts = focusKey.split(":");
                var target = linesEl.querySelector('button[data-action="' + parts[0] + '"][data-id="' + parts[1] + '"]') || linesEl.querySelector("button");
                if (target) target.focus({ preventScroll: true });
            }
        }

        function change(id, delta) {
            var qty = (cart[id] || 0) + delta;
            if (qty <= 0) { delete cart[id]; order = order.filter(function (x) { return x !== id; }); }
            else { if (!cart[id]) order.push(id); cart[id] = Math.min(qty, 99); }
            renderCart((delta > 0 ? "inc" : "dec") + ":" + id);
            updateBadges();
        }

        function resetSale() {
            cart = {}; order = [];
            renderCart();
            updateBadges();
        }

        catsEl.addEventListener("click", function (event) {
            var btn = event.target.closest(".dm-cat");
            if (!btn) return;
            category = btn.getAttribute("data-cat");
            Array.prototype.forEach.call(catsEl.children, function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
            renderTiles();
        });
        searchInput.addEventListener("input", function () { query = searchInput.value; renderTiles(); });
        gridEl.addEventListener("click", function (event) {
            var tile = event.target.closest(".dm-tile");
            if (tile) change(tile.getAttribute("data-id"), 1);
        });
        linesEl.addEventListener("click", function (event) {
            var btn = event.target.closest("button[data-action]");
            if (btn) change(btn.getAttribute("data-id"), btn.getAttribute("data-action") === "inc" ? 1 : -1);
        });
        clearBtn.addEventListener("click", resetSale);

        // ---- Bon ----
        var dialog = el("dialog", { "class": "dm-dialog", "aria-labelledby": "dm-receipt-title" });
        var paper = el("div", { "class": "dm-paper" });
        var newBtn = el("button", { "class": "btn btn-ghost-dark", type: "button", text: T.newSale });
        var ctaLink = el("a", { "class": "btn btn-primary", href: CONTACT_URL, text: T.inquire });
        dialog.appendChild(paper);
        dialog.appendChild(el("div", { "class": "dm-dialog-actions" }, [newBtn, ctaLink]));
        (document.querySelector(".site") || document.body).appendChild(dialog);

        function row(left, right, cls) { return el("div", { "class": "dm-rc-row" + (cls ? " " + cls : "") }, [el("span", { text: left }), num(right)]); }

        function openReceipt(method) {
            var t = totals();
            billNo += 1;
            var payment;
            if (method === "cash") {
                var bills = [500, 1000, 2000, 5000, 10000];
                var given = bills.filter(function (b) { return b >= t.total; })[0] || Math.ceil(t.total / 5000) * 5000;
                payment = [row(T.rcGiven, money(given)), row(T.rcChange, money(given - t.total))];
            } else {
                payment = [row(T.rcCard, money(t.total))];
            }
            var stamp = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
            var rows = [];
            order.forEach(function (id) {
                var item = items[id], qty = cart[id];
                rows.push(row(qty + "× " + itemName(item), money(item.price * qty)));
                if (item.deposit) rows.push(row(T.deposit, money(item.deposit * qty), "dm-rc-sub"));
            });

            paper.textContent = "";
            [].concat(
                [el("div", { "class": "dm-rc-head" }, [el("strong", { id: "dm-receipt-title", text: T.rcTitle }), el("small", { text: T.rcSub })]), el("hr")],
                rows,
                [el("hr"), row(T.rcSum, money(t.total), "dm-rc-total")],
                t.vat.map(function (v) { return row(fmt(T.vatIncl, v.rate), money(v.amount), "dm-rc-sub"); }),
                [el("hr")], payment, [el("hr"),
                    el("p", { "class": "dm-rc-note", text: T.rcTse }),
                    el("p", { "class": "dm-rc-foot" }, [T.rcNo + " ", num(("000" + billNo).slice(-4)), " · ", num(stamp)]),
                    el("p", { "class": "dm-rc-foot", text: T.rcThanks })]
            ).forEach(function (node) { paper.appendChild(node); });

            if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
        }
        // Beim Schließen setzt das close-Ereignis die Kasse zurück; ohne <dialog>-Unterstützung direkt.
        function closeReceipt() {
            if (typeof dialog.close === "function") dialog.close();
            else { dialog.removeAttribute("open"); resetSale(); }
        }

        cashBtn.addEventListener("click", function () { openReceipt("cash"); });
        cardBtn.addEventListener("click", function () { openReceipt("card"); });
        newBtn.addEventListener("click", closeReceipt);
        ctaLink.addEventListener("click", closeReceipt);
        dialog.addEventListener("click", function (event) { if (event.target === dialog) closeReceipt(); });
        dialog.addEventListener("close", resetSale);

        renderTiles();
        renderCart();
    }

    // ---- PDA-Demo ------------------------------------------------------------------------------
    function initPda(mount) {
        var index = Math.floor(Math.random() * ITEMS.length);
        var busy = false;

        var menu = el("div", { "class": "dm-phone-home" }, [
            el("ul", { "class": "dm-phone-menu" }, [["box", T.stock], ["search", T.find], ["clip", T.capture], ["scan", T.scan]].map(function (entry) {
                return el("li", {}, [icon(entry[0]), el("span", { text: entry[1] }), (function () { var c = icon("chevron"); c.setAttribute("class", "uicon dm-chev"); return c; })()]);
            })),
            el("div", { "class": "dm-phone-sync" }, [el("i", { "class": "status-dot", "aria-hidden": "true" }), el("span", {}, [el("strong", { text: T.connected }), el("small", { text: T.synced })])])
        ]);
        var finder = el("div", { "class": "dm-finder", "aria-hidden": "true" }, [el("span", { "class": "dm-bars" }), el("span", { "class": "dm-laser" })]);
        var result = el("div", { "class": "dm-result", "aria-live": "polite" });
        var scanPanel = el("div", { "class": "dm-phone-scan", hidden: true }, [finder, result]);
        var label = el("span", { text: T.start });
        var button = el("button", { "class": "dm-phone-btn", type: "button" }, [icon("scan"), label]);

        mount.appendChild(el("span", { "class": "dm-key dm-key-1", "aria-hidden": "true" }));
        mount.appendChild(el("span", { "class": "dm-key dm-key-2", "aria-hidden": "true" }));
        mount.appendChild(el("div", { "class": "dm-phone-screen" }, [
            el("div", { "class": "dm-phone-status", "aria-hidden": "true" }, [el("span", { text: "10:24" }), el("span", { text: "100%" })]),
            el("div", { "class": "dm-phone-brand" }, [el("strong", { text: "D-Group" })]),
            menu, scanPanel, button
        ]));
        mount.setAttribute("role", "group");
        mount.setAttribute("aria-label", T.pdaLabel);

        // Stabile Beispieldaten je Artikel: gleicher Artikel = gleiche EAN und gleicher Bestand
        function hash(text) { var h = 7; for (var i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) >>> 0; return h; }
        function fakeEan(id) {
            var seed = hash(id), digits = [], sum = 0, i;
            for (i = 0; i < 12; i++) { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; digits.push((seed >>> 16) % 10); }
            digits[0] = 4; digits[1] = 0;
            for (i = 0; i < 12; i++) sum += digits[i] * (i % 2 ? 3 : 1);
            digits.push((10 - (sum % 10)) % 10);
            return digits.join("");
        }

        button.addEventListener("click", function () {
            if (busy) return;
            busy = true;
            button.disabled = true;
            label.textContent = T.scanning;
            menu.hidden = true;
            scanPanel.hidden = false;
            finder.classList.add("is-scanning");
            result.textContent = "";
            result.appendChild(el("p", { "class": "dm-hint", text: T.reading }));

            window.setTimeout(function () {
                var item = ITEMS[index % ITEMS.length];
                index += 1;
                finder.classList.remove("is-scanning");
                result.textContent = "";
                result.appendChild(el("div", { "class": "dm-result-card" }, [
                    el("div", { "class": "dm-result-name" }, [el("span", { "class": "dm-emoji", "aria-hidden": "true", text: item.icon }), el("span", { text: itemName(item) })]),
                    el("div", { "class": "dm-result-ean" }, ["EAN ", num(fakeEan(item.id))]),
                    el("div", { "class": "dm-result-stock" }, [el("span", { text: T.inStock }), el("strong", {}, [num(String(3 + (hash(item.id) % 46))), " " + T.pcs])])
                ]));
                label.textContent = T.next;
                button.disabled = false;
                busy = false;
            }, motionReduced() ? 250 : 1300);
        });
    }

    function init() {
        var pos = document.querySelector("[data-dm-pos]");
        var pda = document.querySelector("[data-dm-pda]");
        if (pos) initPos(pos);
        if (pda) initPda(pda);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
