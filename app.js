/* WPE Journal | shared page logic
   Every page sets <body data-page="home|church|classroom|court|culture|community">
   and loads data.js first. All content comes from WPE_DATA. */
(function () {
    "use strict";

    var DATA = window.WPE_DATA || {};
    var ORDER = ["church", "classroom", "court", "culture", "community"];
    var MONTHS = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };

    var page = document.body.getAttribute("data-page");
    var app = document.getElementById("app");
    if (!app) return;

    /* ---------- tiny DOM helper ---------- */
    function h(tag, attrs, kids) {
        var el = document.createElement(tag);
        Object.keys(attrs || {}).forEach(function (k) {
            var v = attrs[k];
            if (v === false || v == null) return;
            if (k === "class") el.className = v;
            else if (k === "text") el.textContent = v;
            else el.setAttribute(k, v === true ? "" : v);
        });
        [].concat(kids || []).forEach(function (c) {
            if (c == null) return;
            el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
        });
        return el;
    }

    /* ---------- helpers ---------- */
    function parseWhen(dateStr) {               // "June 17, 2026 | 8:00AM - 9:00AM" -> Date
        var parts = dateStr.split("|");
        var m = parts[0].trim().match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
        if (!m) return new Date(0);
        var hh = 0, mm = 0, t = (parts[1] || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (t) {
            hh = (parseInt(t[1], 10) % 12) + (t[3].toUpperCase() === "PM" ? 12 : 0);
            mm = parseInt(t[2], 10);
        }
        return new Date(+m[3], MONTHS[m[1]] || 0, +m[2], hh, mm);
    }

    function levelOf(role) {
        var m = /^(\d)/.exec(role || "");
        return m ? parseInt(m[1], 10) : 1;
    }

    /* Points = the number at the start of the role (e.g. "2 - Working Member" = 2). */
    function pointsOf(e) { return e.points != null ? e.points : levelOf(e.role); }

    function roleLabel(role) { return (role || "").replace(/^\d\s*-\s*/, ""); }

    /* A reflection is an array of paragraphs; a plain string is split on blank lines. */
    var REFLECTION_PARAGRAPHS = 4;

    function reflectionParagraphs(r) {
        var list = Array.isArray(r) ? r : String(r || "").split(/\n\s*\n/);
        return list.map(function (t) { return String(t).trim(); }).filter(Boolean);
    }

    /* Console warning for any entry whose reflection isn't four paragraphs (helps when editing data.js). */
    function checkReflections() {
        ORDER.forEach(function (k) {
            ((DATA[k] || {}).entries || []).forEach(function (e) {
                var n = reflectionParagraphs(e.reflection).length;
                if (n !== REFLECTION_PARAGRAPHS) {
                    console.warn("[WPE] " + k + " #" + e.id + " \"" + e.title + "\" has " + n + " reflection paragraph(s); expected " + REFLECTION_PARAGRAPHS + ".");
                }
            });
        });
    }

    function allEntries() {
        var n = 0;
        ORDER.forEach(function (k) { if (DATA[k]) n += DATA[k].entries.length; });
        return n;
    }


    /* ---------- PHOTOS (EASY SWAP) ----------
       SETTINGS: change these three numbers to taste.
         MIN_PHOTOS    every entry always shows at least this many photos
         MAX_PHOTOS    most photos an entry can show (5-10 is fine)
         SAMPLE_COUNT  how many sample images appear until real ones are added

       HOW TO ADD REAL PHOTOS (pick whichever is easier):
         A) No code: drop files into /images named
              <prefix>_<id>_photo.jpg      (photo 1, same as the "photo" field in data.js)
              <prefix>_<id>_photo_2.jpg    (photo 2)
              <prefix>_<id>_photo_3.jpg ... up to MAX_PHOTOS
            e.g. church_1_photo.jpg, church_1_photo_2.jpg. Prefixes: church, class, court, culture, community.
         B) In data.js, add to an entry:  "photos": ["a.jpg", "b.png", "c.jpg"]
            (any names/extensions; replaces option A for that entry). */
    var MIN_PHOTOS = 2;
    var MAX_PHOTOS = 8;
    var SAMPLE_COUNT = 2;

    var PHOTO_PREFIX = { church: "church", classroom: "class", court: "court", culture: "culture", community: "community" };
    var THEMES = {
        church:    { a: "#3b2a1a", b: "#b4731e", icon: "M50 14v22M40 25h20M30 70V46l20-14 20 14v24z" },
        classroom: { a: "#1b2a3b", b: "#3b82a0", icon: "M20 36l30-14 30 14-30 14zM34 46v14c0 6 32 6 32 0V46" },
        court:     { a: "#1d3326", b: "#4d9a6a", icon: "M50 20a24 24 0 1 0 .1 0zM26 44h48M50 20c-12 10-12 38 0 48M50 20c12 10 12 38 0 48" },
        culture:   { a: "#33202e", b: "#b05a8a", icon: "M42 62V26l24-6v36M42 62a8 6 0 1 1-8-6M66 56a8 6 0 1 1-8-6" },
        community: { a: "#2a2a1b", b: "#a3a03b", icon: "M50 66S26 52 26 36a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z" }
    };
    var ANGLES = [[0, 0, 1, 1], [1, 0, 0, 1], [0, 1, 1, 0], [0.5, 0, 0.5, 1], [0, 0.5, 1, 0.5]];

    /* File names for one entry, slot 0 = main photo. */
    function photoList(key, e) {
        var base = (PHOTO_PREFIX[key] || key) + "_" + e.id + "_photo";
        var main = e.photo || (base + ".jpg");
        if (Array.isArray(e.photos) && e.photos.length) {
            var list = e.photos.slice(0, MAX_PHOTOS);
            for (var j = list.length; j < MIN_PHOTOS; j++) list.push(base + "_" + (j + 1) + ".jpg");
            return { names: list, explicit: true };
        }
        var names = [main];
        for (var i = 2; i <= MAX_PHOTOS; i++) names.push(base + "_" + i + ".jpg");
        return { names: names, explicit: false };
    }

    function placeholderSrc(key, e, slot, w, hgt) {
        var t = THEMES[key] || THEMES.church;
        var an = ANGLES[slot % ANGLES.length];
        var title = String(e.title || "").replace(/[<>&"]/g, "");
        if (title.length > 44) title = title.slice(0, 43) + "…";
        var big = w > 300;
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + hgt + '" preserveAspectRatio="xMidYMid slice">' +
            '<defs><linearGradient id="g" x1="' + an[0] + '" y1="' + an[1] + '" x2="' + an[2] + '" y2="' + an[3] + '"><stop offset="0" stop-color="' + t.a + '"/><stop offset="1" stop-color="' + t.b + '"/></linearGradient></defs>' +
            '<rect width="100%" height="100%" fill="url(#g)"/>' +
            '<circle cx="' + (w * (0.15 + 0.2 * (slot % 4))) + '" cy="' + (hgt * 0.25) + '" r="' + (hgt * 0.22) + '" fill="rgba(255,255,255,.06)"/>' +
            '<g transform="translate(' + (w / 2 - 50) + ' ' + (hgt / 2 - 62) + ')" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="' + t.icon + '"/></g>' +
            (big ? '<text x="50%" y="' + (hgt / 2 + 38) + '" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="' + Math.round(w / 34) + '" font-weight="700" fill="#fff">' + title + '</text>' +
                   '<text x="50%" y="' + (hgt / 2 + 62) + '" text-anchor="middle" font-family="Courier New,monospace" font-size="' + Math.round(w / 48) + '" fill="rgba(255,255,255,.8)">SAMPLE PHOTO ' + (slot + 1) + '</text>'
                 : '<text x="50%" y="' + (hgt - 10) + '" text-anchor="middle" font-family="Courier New,monospace" font-size="12" fill="rgba(255,255,255,.85)">SAMPLE ' + (slot + 1) + '</text>') +
            '</svg>';
        return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }

    /* <img> for one photo slot: real file first, then sample, or removed if the slot is optional and empty. */
    function photoImg(key, e, slot, cls, w, hgt, hooks) {
        var info = photoList(key, e);
        var name = info.names[slot];
        var img = h("img", { class: cls, src: name, alt: "Photo " + (slot + 1) + " for " + e.title, loading: "lazy", width: w, height: hgt });
        var sampleAllowed = info.explicit ? true : slot < Math.max(SAMPLE_COUNT, MIN_PHOTOS);
        img.addEventListener("error", function () {
            if (img.getAttribute("data-sample")) return;
            if (!sampleAllowed) { if (hooks && hooks.onMissing) hooks.onMissing(); return; }
            img.setAttribute("data-sample", "1");
            img.src = placeholderSrc(key, e, slot, w, hgt);
            if (hooks && hooks.onSample) hooks.onSample(name);
        });
        return img;
    }

    /* ---------- lightbox (click a photo to enlarge) ---------- */
    var lightbox = null;
    function openLightbox(items, start) {   // items: [{src, caption}]
        closeLightbox();
        var i = start, shown = items.filter(function (x) { return x.src; });
        i = Math.min(i, shown.length - 1);
        var img = h("img", { class: "lb-img", alt: "" });
        var cap = h("p", { class: "lb-cap" });
        var prev = h("button", { class: "btn lb-btn", type: "button", "aria-label": "Previous photo", text: "←" });
        var next = h("button", { class: "btn lb-btn", type: "button", "aria-label": "Next photo", text: "→" });
        var close = h("button", { class: "btn lb-close", type: "button", "aria-label": "Close", text: "✕ Close" });
        function show(n) {
            i = (n + shown.length) % shown.length;
            img.src = shown[i].src;
            cap.textContent = (i + 1) + " / " + shown.length + "  ·  " + shown[i].caption;
        }
        prev.addEventListener("click", function () { show(i - 1); });
        next.addEventListener("click", function () { show(i + 1); });
        close.addEventListener("click", closeLightbox);
        var box = h("div", { class: "lightbox", role: "dialog", "aria-modal": "true", "aria-label": "Photo viewer" }, [
            h("div", { class: "lb-inner" }, [close, img, cap, h("div", { class: "lb-nav" }, [prev, next])])
        ]);
        box.addEventListener("click", function (ev) { if (ev.target === box) closeLightbox(); });
        box.addEventListener("keydown", function (ev) {
            if (ev.key === "ArrowLeft") show(i - 1);
            if (ev.key === "ArrowRight") show(i + 1);
        });
        document.body.appendChild(box);
        lightbox = box;
        show(i);
        close.focus();
    }
    function closeLightbox() { if (lightbox) { lightbox.remove(); lightbox = null; } }

    /* ---------- shared chrome ---------- */
    function buildHeader(withMotto) {
        return h("header", { class: "site-header" }, [
            h("h1", { class: "site-title" }, [h("a", { href: "index.html", text: "WPE Online Journal" })]),
            h("p", { class: "eyebrow", text: "College of Computer Studies • Silliman University" }),
            withMotto ? h("p", { class: "motto", text: "Building Competence. Character. Faith." }) : null
        ]);
    }

    function buildTabs() {
        var nav = h("nav", { class: "tabs", "aria-label": "Journal categories" });
        function tab(href, label, key, count) {
            var a = h("a", { class: "category-tab", href: href }, [label]);
            if (count != null) a.appendChild(h("span", { class: "tab-count", text: String(count) }));
            if (page === key) a.setAttribute("aria-current", "page");
            nav.appendChild(a);
        }
        tab("index.html", "Main", "home");
        ORDER.forEach(function (k) {
            if (DATA[k]) tab(k + ".html", DATA[k].name, k, DATA[k].entries.length);
        });
        return nav;
    }

    function buildFooter() {
        return h("footer", { class: "vintage-card site-footer" }, [
            h("div", { class: "typewriter-box" }, [
                h("p", { text: "This site was made by Jessie Rey Antique on (10/17/26)" })
            ])
        ]);
    }

    function shell(mainChildren, withMotto) {
        app.textContent = "";
        app.appendChild(h("a", { class: "skip-link", href: "#main", text: "Skip to content" }));
        app.appendChild(buildHeader(withMotto));
        app.appendChild(buildTabs());
        app.appendChild(h("main", { id: "main" }, mainChildren));
        app.appendChild(buildFooter());
    }

    /* ---------- HOME ---------- */
    var WWI_TEXT = [
        "Hello! My name is Jessie Rey C. Antique, a BSIT-1 student in the College of Computer Studies at Silliman University, and welcome to my online journal for Whole Person Education (WPE). This digital archive serves as a curated collection of my journey through spiritual worship, academic assemblies, athletic meets, cultural programs, and community service initiatives throughout the semester.",
        "Guided by Silliman's enduring motto of Building Competence, Character, and Faith, this journal reflects my active participation and growth beyond the traditional classroom. Each entry captures meaningful experiences, organized events, and personal reflections designed to cultivate a balanced, holistic character as I navigate my college life and community responsibilities."
    ];

    function renderHome() {
        var total = allEntries(), working = 0, totalPoints = 0;
        ORDER.forEach(function (k) {
            DATA[k].entries.forEach(function (e) { if (levelOf(e.role) >= 2) working++; totalPoints += pointsOf(e); });
        });

        var hero = h("section", { class: "vintage-card", "aria-label": "Banner" }, [
            h("div", { class: "hero", style: "background-image:url('cardindex.jpeg')" }, [
                h("div", { class: "hero-text" }, [
                    h("h2", { class: "hero-title", text: "Welcome to Jessie's Journal" }),
                    h("p", { class: "hero-sub", text: "GE 10A • Whole Person Education Activity Log" })
                ])
            ]),
            h("div", { class: "stats" }, [
                stat(total, "Journal entries"),
                stat(ORDER.length, "Categories"),
                stat(totalPoints, "Points accumulated")
            ])
        ]);

        var grid = h("div", { class: "category-grid" });
        ORDER.forEach(function (k) {
            var c = DATA[k];
            grid.appendChild(h("a", { class: "typewriter-box category-card", href: k + ".html" }, [
                h("h3", { text: c.name }),
                h("p", { text: c.blurb }),
                h("div", { class: "card-foot" }, [
                    h("span", { text: c.entries.length + (c.entries.length === 1 ? " entry" : " entries") }),
                    h("span", { "aria-hidden": "true", text: "→" })
                ])
            ]));
        });

        var cats = h("section", { class: "vintage-card", "aria-labelledby": "cat-h" }, [
            h("h2", { class: "card-heading", id: "cat-h", text: "Categories" }), grid
        ]);

        var prose = h("section", { class: "vintage-card prose", "aria-label": "About the theme" },
            WWI_TEXT.map(function (t) { return h("div", { class: "typewriter-box" }, [h("p", { text: t })]); }));

        document.title = "Silliman University WPE Journal Archives";
        shell([hero, cats, prose], true);
    }

    function stat(n, label) {
        return h("div", { class: "typewriter-box stat" }, [
            h("span", { class: "stat-num", text: String(n) }),
            h("span", { class: "stat-label", text: label })
        ]);
    }

    /* ---------- CATEGORY ---------- */
    var state = { q: "", level: "all", sort: "asc" };
    var lastOpened = null;

    function renderCategory() {
        var cat = DATA[page];
        if (!cat) { app.textContent = "Category not found."; return; }

        var m = /^#entry-(\d+)$/.exec(location.hash);
        var entry = m && cat.entries.filter(function (e) { return e.id === +m[1]; })[0];

        var hero = h("section", { class: "vintage-card" }, [
            h("div", { class: "hero compact", style: "background-image:url('" + cat.hero + "')" }, [
                h("div", { class: "hero-text" }, [
                    h("h2", { class: "hero-title", text: cat.name }),
                    h("p", { class: "hero-sub", text: cat.tagline + " (" + cat.entries.length + " entries)" })
                ])
            ])
        ]);

        if (entry) {
            document.title = entry.title + " – " + cat.name + " – Silliman University WPE Journal";
            shell([hero, buildDetail(cat, entry)]);
            var t = document.getElementById("detail-title");
            if (t) { t.focus({ preventScroll: true }); }
            window.scrollTo({ top: 0 });
        } else {
            document.title = cat.name + " – Silliman University WPE Journal";
            shell([hero, buildList(cat)]);
            if (lastOpened) {
                var back = document.querySelector('a[href="#entry-' + lastOpened + '"]');
                if (back) { back.focus({ preventScroll: false }); }
                lastOpened = null;
            }
        }
    }

    function buildList(cat) {
        var section = h("section", { class: "vintage-card", "aria-label": cat.name + " entries" });

        var search = h("input", { class: "field", type: "search", placeholder: "Search title, organizer, venue…", "aria-label": "Search entries", value: state.q });
        var level = h("select", { class: "field", "aria-label": "Filter by participation level" }, [
            h("option", { value: "all", text: "All levels" }),
            h("option", { value: "1", text: "Level 1" }),
            h("option", { value: "2", text: "Level 2" }),
            h("option", { value: "3", text: "Level 3" })
        ]);
        level.value = state.level;
        var sort = h("select", { class: "field", "aria-label": "Sort order" }, [
            h("option", { value: "asc", text: "Oldest first" }),
            h("option", { value: "desc", text: "Newest first" })
        ]);
        sort.value = state.sort;

        var count = h("p", { class: "result-count", role: "status", "aria-live": "polite" });
        var list = h("ul", { class: "entry-list" });

        function paint() {
            var q = state.q.trim().toLowerCase();
            var rows = cat.entries.filter(function (e) {
                if (state.level !== "all" && levelOf(e.role) !== +state.level) return false;
                if (!q) return true;
                return [e.title, e.organizer, e.venue, e.role, e.date].join(" ").toLowerCase().indexOf(q) !== -1;
            }).sort(function (a, b) {
                var d = parseWhen(a.date) - parseWhen(b.date);
                return state.sort === "asc" ? d : -d;
            });

            list.textContent = "";
            rows.forEach(function (e) { list.appendChild(h("li", {}, [entryCard(e)])); });
            if (!rows.length) list.appendChild(h("li", { class: "empty typewriter-box", text: "No entries match your search." }));
            count.textContent = "Showing " + rows.length + " of " + cat.entries.length + " entries";
        }

        search.addEventListener("input", function () { state.q = search.value; paint(); });
        level.addEventListener("change", function () { state.level = level.value; paint(); });
        sort.addEventListener("change", function () { state.sort = sort.value; paint(); });

        section.appendChild(h("div", { class: "toolbar" }, [search, level, sort]));
        section.appendChild(count);
        section.appendChild(list);
        paint();
        return section;
    }

    function entryCard(e) {
        var lv = levelOf(e.role);
        return h("a", { class: "typewriter-box entry", href: "#entry-" + e.id }, [
            photoImg(page, e, 0, "entry-thumb", 160, 120),
            h("div", { class: "entry-main" }, [
                h("h3", { class: "entry-title", text: e.title }),
                h("dl", { class: "meta" }, [
                    h("div", {}, [h("dt", { text: "Organizer" }), h("dd", { text: e.organizer })]),
                    h("div", {}, [h("dt", { text: "Date" }), h("dd", { text: e.date })]),
                    h("div", {}, [h("dt", { text: "Contribution" }),
                        h("dd", {}, [h("span", { class: "badge l" + lv, text: "L" + lv }), roleLabel(e.role)])])
                ])
            ]),
            h("span", { class: "entry-cta", text: "→ View Full Details" })
        ]);
    }

    /* ---------- DETAIL ---------- */
    function buildDetail(cat, e) {
        lastOpened = e.id;
        var idx = cat.entries.indexOf(e);
        var prev = cat.entries[idx - 1], next = cat.entries[idx + 1];
        var venueDate = e.date + (e.venue ? " — " + e.venue : "");

        function block(label, content, cls) {
            var val = typeof content === "string"
                ? h("p", { class: "field-value " + (cls || ""), text: content })
                : content;
            return h("div", { class: "field-block" }, [h("span", { class: "field-label", text: label }), val]);
        }

        var info = photoList(page, e);
        var count = info.explicit ? info.names.length : MAX_PHOTOS;
        var grid = h("div", { class: "gallery" });
        var items = [];
        function refreshNote() {
            var n = grid.querySelectorAll(".gallery-item").length;
            note.textContent = n + (n === 1 ? " photo" : " photos") + " shown. " +
                (grid.querySelector(".sample-tag:not([hidden])") ? "All Documented." : "");
        }
        var note = h("p", { class: "photo-caption" });
        for (var k = 0; k < count; k++) (function (slot) {
            var name = info.names[slot];
            var tag = h("span", { class: "sample-tag", text: "Sample", hidden: true });
            var cap = h("figcaption", { class: "photo-caption", text: "images/" + name });
            var item = h("figure", { class: "gallery-item" });
            var rec = { src: "", caption: "images/" + name };
            var img = photoImg(page, e, slot, "gallery-img", 600, 400, {
                onSample: function () { tag.hidden = false; rec.src = img.src; refreshNote(); },
                onMissing: function () { item.remove(); rec.src = ""; refreshNote(); }
            });
            img.addEventListener("load", function () { if (!img.getAttribute("data-sample")) { rec.src = img.src; } });
            var open = h("button", { class: "gallery-open", type: "button", "aria-label": "Enlarge photo " + (slot + 1) }, [img, tag]);
            open.addEventListener("click", function () {
                var live = items.filter(function (x) { return x.rec.src; });
                var idx = 0;
                live.forEach(function (x, n) { if (x.rec === rec) idx = n; });
                openLightbox(live.map(function (x) { return x.rec; }), idx);
            });
            item.appendChild(open); item.appendChild(cap);
            items.push({ rec: rec });
            grid.appendChild(item);
        })(k);
        var pic = h("div", {}, [grid, note]);
        refreshNote();

        var paras = reflectionParagraphs(e.reflection);
        var reflection = paras.length
            ? h("div", { class: "reflection" }, paras.map(function (t) { return h("p", { text: t }); }))
            : h("div", { class: "reflection pending" }, [h("p", { text: "Reflection not yet added." })]);

        var pts = pointsOf(e);
        var points = pts + (pts === 1 ? " Point" : " Points");

        var wrap = h("section", { class: "vintage-card", "aria-labelledby": "detail-title" }, [
            h("div", { class: "detail-top" }, [
                h("div", {}, [
                    h("span", { class: "detail-kicker", text: "Journal Record" }),
                    h("h2", { class: "detail-title", id: "detail-title", tabindex: "-1", text: e.title })
                ]),
                h("a", { class: "btn", href: "#", id: "back", text: "← Back" })
            ]),
            h("div", { class: "typewriter-box detail-grid" }, [
                block("Activity Name", e.title, "strong"),
                block("Category", cat.name),
                block("Date and Venue", venueDate),
                block("Organizer", e.organizer),
                block("Role / Level of Participation", e.role),
                block("Points Claimed", points),
                block("Pictures", pic),
                block("Evidence", "Picture (Verified WPE Attendance)"),
                block("Reflection", reflection)
            ]),
            h("div", { class: "detail-nav" }, [
                prev ? h("a", { class: "btn", href: "#entry-" + prev.id, text: "← " + prev.title.slice(0, 28) + (prev.title.length > 28 ? "…" : "") }) : h("span", {}),
                next ? h("a", { class: "btn", href: "#entry-" + next.id, text: next.title.slice(0, 28) + (next.title.length > 28 ? "…" : "") + " →" }) : h("span", {})
            ])
        ]);

        wrap.querySelector("#back").addEventListener("click", function (ev) {
            ev.preventDefault();
            history.pushState("", document.title, location.pathname + location.search);
            renderCategory();
        });
        return wrap;
    }

    /* ---------- boot ---------- */
    document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && lightbox) { closeLightbox(); return; }
        if (ev.key === "Escape" && /^#entry-/.test(location.hash)) {
            history.pushState("", document.title, location.pathname + location.search);
            renderCategory();
        }
    });

    checkReflections();
    if (page === "home") renderHome();
    else {
        renderCategory();
        window.addEventListener("hashchange", renderCategory);
    }
})();
