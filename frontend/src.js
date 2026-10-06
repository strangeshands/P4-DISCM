import "./style.css";
const app = document.querySelector("#app");
let token = sessionStorage.getItem("hrs-session"),
    user = null,
    properties = [],
    page = "browse",
    selected = null,
    tab = "book",
    notice = "",
    authMode = "login";
const esc = (s) =>
    String(s ?? "").replace(
        /[&<>"']/g,
        (c) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[c],
    );
const money = (n) =>
    new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
    }).format(n || 0);
async function api(path, method = "GET", body) {
    const r = await fetch("/api" + path, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { "X-Session": token } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!r.ok) {
        let b = await r.json().catch(() => ({}));
        throw Error(
            b.message || b.detail || "The request could not be completed.",
        );
    }
    return r.status === 204
        ? null
        : r.text().then((t) => (t ? JSON.parse(t) : null));
}
const field = (label, name, type = "text", value = "", extra = "") =>
    `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const select = (label, name, choices) =>
    `<label>${label}<select name="${name}">${choices.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></label>`;
const empty = (s) =>
    `<div class="empty"><h3>${s}</h3><p>Your next chapter starts here.</p></div>`;
function header() {
    return `<header><div class="brand"><div class="logo">H</div><div><strong>Hotel Reservation System</strong><small>HOTELS · HOUSES · CONDOS</small></div></div><nav><button data-page="browse" class="${page === "browse" ? "active" : ""}">Explore stays</button>${user ? `<button data-page="reservations">My reservations</button>${user.role === "OWNER" ? '<button data-page="manage">My properties</button><button data-page="create">＋ List a property</button>' : ""}<button data-action="logout">${esc(user.name)} · Sign out</button>` : '<button data-page="auth">Log in / Register</button>'}</nav></header>`;
}
async function render() {
    app.innerHTML =
        header() +
        `<main>${notice ? `<div class="error" role="alert">${esc(notice)}</div>` : ""}<div id="content">Loading…</div></main><footer>BY HEPHZI TOLENTINO AND FRANCINE SANTOS · A PLACE FOR EVERY STAY</footer>`;
    try {
        let html;
        if (page === "auth") html = auth();
        else if (page === "create") html = create();
        else if (page === "detail") html = await detail();
        else if (page === "reservations") html = await reservationPage();
        else html = browse(page === "manage");
        document.querySelector("#content").innerHTML = html;
        bind();
    } catch (e) {
        document.querySelector("#content").innerHTML =
            `<div class="error">${esc(e.message)}</div>`;
    }
}
function auth() {
    return `<div class="auth panel"><span class="eyebrow">Welcome to your next stay</span><h2>${authMode === "login" ? "Welcome back." : "Make yourself at home."}</h2><p>${authMode === "login" ? "Sign in to book a stay or manage your properties." : "Create a customer account or register as a property owner."}</p><form id="auth-form">${authMode === "register" ? field("Full name", "name", "text", "", "required") : ""}${field("Email address", "email", "email", "", "required")}${field("Password", "password", "password", "", 'required minlength="8"')}${
        authMode === "register"
            ? select("I want to", "role", [
                  ["CUSTOMER", "Book stays as a customer"],
                  ["OWNER", "Register a hotel, house, or condo"],
              ])
            : ""
    }<button>${authMode === "login" ? "Log in" : "Create account"}</button></form><p><button class="secondary" data-action="auth-toggle">${authMode === "login" ? "New here? Register" : "Already registered? Log in"}</button></p></div>`;
}
function browse(manage) {
    let list = manage
        ? properties.filter((p) => p.ownerId === user?.id)
        : properties;
    return `${manage ? "<h1>Your properties.</h1><p>Manage your spaces, reservations, and rates in one place.</p>" : `<section class="hero"><div><span class="eyebrow">Familiar comfort. New destinations.</span><h1>Find a place.<br>Feel at home.</h1><p>From a room for the weekend to a home for a little longer.<br>Discover hotels, houses, and condos for your next stay.</p><div class="row"><span class="badge">THREE WAYS TO STAY</span><span class="muted">One simple reservation.</span></div></div><div class="hero-art"><div class="sun"></div><div class="building">${"<i></i>".repeat(9)}</div><div class="hero-tag">✦ A little comfort, wherever you go.</div></div></section>`}<div class="toolbar"><input id="search" placeholder="Search by property or location" aria-label="Search properties"><select id="type-filter" style="width:180px"><option value="">All property types</option><option>HOTEL</option><option>HOUSE</option><option>CONDO</option></select></div><div class="grid" id="property-grid">${cards(list)}</div>`;
}
function cards(list) {
    return list.length
        ? list
              .map(
                  (p) =>
                      `<article class="card"><div class="card-art ${p.type}"><span></span><span></span><span></span></div><div class="content"><span class="badge">${p.type === "HOTEL" ? "HOTEL ROOM" : p.type === "HOUSE" ? "ENTIRE HOUSE" : "ENTIRE CONDO"}</span><h3>${esc(p.name)}</h3><div class="muted">⌖ ${esc(p.location)}</div><p>${esc(p.description || "A comfortable space for your next stay.")}</p><div class="row" style="justify-content:space-between"><div class="price">${money(p.basePrice)}<small> / night from</small></div><button data-property="${p.id}">View stay →</button></div></div></article>`,
              )
              .join("")
        : empty("No properties yet");
}
function create() {
    return `<div class="detail-head"><div><span class="eyebrow">Open your doors</span><h1>List your property.</h1></div></div><div class="panel"><form id="listing-form"><div class="form-grid">${field("Property name", "name", "text", "", "required")}${select(
        "Property type",
        "type",
        [
            ["HOTEL", "Hotel"],
            ["HOUSE", "House"],
            ["CONDO", "Condo"],
        ],
    )}${field("Location", "location", "text", "", "required")}${field("Base nightly price (PHP)", "basePrice", "number", 1299, 'required min="100" step="0.01"')}<label class="full">About your property<textarea name="description"></textarea></label></div><div id="hotel-counts"><h3>Rooms in your hotel</h3><p>Keep a total of 1–50 rooms. Deluxe rooms cost 20% more; Executive rooms cost 35% more.</p><div class="form-grid">${field("Standard rooms", "standard", "number", 1, 'min="0" max="50"')}${field("Deluxe rooms", "deluxe", "number", 0, 'min="0" max="50"')}${field("Executive rooms", "executive", "number", 0, 'min="0" max="50"')}</div></div><p>Houses and condos are offered as an entire property. Every listing includes the three original vouchers.</p><button>Register property</button></form></div>`;
}
let currentDetails;
async function detail() {
    const d = await api(`/properties/${selected}/details`);
    currentDetails = d;
    let p = d.property,
        own = user?.id === p.ownerId;
    return `<button class="secondary" data-page="browse">← All stays</button><div class="detail-head"><div><p class="eyebrow">${p.type} · ${esc(p.location)}</p><h1>${esc(p.name)}</h1><p>${esc(p.description)}</p></div><div class="price">${money(p.basePrice)}<small> / night from</small></div></div><div class="tabs">${[
        ["book", "Book a stay"],
        ["availability", "Room & date availability"],
        ["vouchers", "Vouchers"],
        ...(own
            ? [
                  ["manage", "Manage property"],
                  ["guests", "Reservations"],
              ]
            : []),
    ]
        .map(
            ([v, l]) =>
                `<button data-tab="${v}" class="${tab === v ? "active" : ""}">${l}</button>`,
        )
        .join(
            "",
        )}</div>${tab === "book" ? booking(d) : tab === "availability" ? availability(d) : tab === "vouchers" ? voucherView(d, own) : tab === "manage" ? management(d) : await guests(p.id)}`;
}
function booking(d) {
    return `<div class="split"><div class="panel"><h2>Your stay, your way.</h2><form id="booking-form">${select(
        "Booking method",
        "mode",
        [
            ["FREE", "Free booking — choose room and dates"],
            ["DATE", "Date booking — find available rooms"],
            ["ROOM", "Room booking — check its calendar"],
        ],
    )}${select(
        d.property.type === "HOTEL" ? "Room" : "Stay",
        "unitId",
        d.units.map((u) => [u.id, `${u.name} · ${u.type}`]),
    )}<div class="form-grid">${field("Check in", "checkIn", "date", "", "required")}${field("Check out", "checkOut", "date", "", "required")}</div><button type="button" class="secondary" data-action="booking-availability">Check availability</button><div id="booking-availability"></div>${field("Guest full name", "guestName", "text", user?.name || "", "required")}${field("Voucher code (optional)", "voucherCode")}<div class="row"><button type="button" class="secondary" data-action="quote">Preview price</button><button>${user ? "Confirm reservation" : "Log in to reserve"}</button></div></form></div><div class="panel"><span class="eyebrow">Stay details</span><h2>A clear price.<br>A comfortable stay.</h2><p>Checkout day is free. Rates may vary by date. Add one eligible voucher to your reservation.</p><div id="quote">Preview your price to see the nightly breakdown and total.</div></div></div>`;
}
function availability(d) {
    return `<div class="panel"><h2>Find your dates.</h2><form id="availability-form" class="form-grid">${field("From", "start", "date", "", "required")}${field("Until (checkout)", "end", "date", "", "required")}<button>Search availability</button></form><div id="availability-results"></div><h3>Room information</h3><div class="scroll"><table><thead><tr><th>Room / space</th><th>Type</th><th>Base nightly price</th><th>Calendar</th></tr></thead><tbody>${d.units.map((u) => `<tr><td>${esc(u.name)}</td><td>${u.type}</td><td>${money(d.property.basePrice * (u.type === "DELUXE" ? 1.2 : u.type === "EXECUTIVE" ? 1.35 : 1))}</td><td><button data-calendar="${u.id}">View month</button></td></tr>`).join("")}</tbody></table></div>${field("Calendar month", "month", "month", new Date().toISOString().slice(0, 7))}<div id="calendar"></div></div>`;
}
function voucherView(d, own) {
    return `<div class="panel"><h2>A little extra for your stay.</h2><div class="scroll"><table><thead><tr><th>Code</th><th>Type</th><th>Discount</th><th>Condition</th><th></th></tr></thead><tbody>${d.vouchers.map((v) => `<tr><td>${esc(v.code)}</td><td>${v.type}</td><td>${v.percent}%</td><td>${v.type === "DATE" ? `Occupied day ${v.date1}${v.date2 ? " or " + v.date2 : ""}` : v.type === "STAY" ? `${v.minNights}+ nights; night ${v.discountedNight} discounted` : "Any stay"}</td><td>${own && !v.builtIn ? `<button class="danger" data-remove-voucher="${v.id}">Delete</button>` : ""}</td></tr>`).join("")}</tbody></table></div></div>${
        own
            ? `<div class="panel"><h3>Create a voucher</h3><form id="voucher-form"><div class="form-grid">${field("Code", "code", "text", "", "required")}${select(
                  "Voucher type",
                  "type",
                  [
                      ["DISCOUNT", "Percentage discount"],
                      ["DATE", "Qualifying date"],
                      ["STAY", "Length of stay"],
                  ],
              )}${field("Discount (%)", "percent", "number", 10, 'required min="0" max="100" step="0.01"')}${field("Qualifying day 1", "date1", "number", 15, 'min="1" max="31"')}${field("Qualifying day 2 (0 = none)", "date2", "number", 0, 'min="0" max="31"')}${field("Minimum nights", "minNights", "number", 4, 'min="1" max="365"')}${field("Discounted night", "discountedNight", "number", 1, 'min="1" max="365"')}</div><button>Create voucher</button></form></div>`
            : ""
    }`;
}
function management(d) {
    return `<div class="stats"><div><strong>${d.units.length}</strong><small>Rooms / spaces</small></div><div><strong>${money(d.earnings)}</strong><small>Estimated active reservation earnings</small></div></div><div class="panel"><h3>Property details & prices</h3><form id="edit-form"><div class="form-grid">${field("Property name", "name", "text", d.property.name, "required")}${field("Base price", "basePrice", "number", d.property.basePrice, 'min="100" step="0.01" required')}${field("Location", "location", "text", d.property.location, "required")}<label>Description<textarea name="description">${esc(d.property.description)}</textarea></label></div><button>Save changes</button></form><p>Base prices can change only when no active reservations exist.</p></div>${
        d.property.type === "HOTEL"
            ? `<div class="panel"><h3>Add or remove rooms</h3><form id="rooms-form" class="form-grid">${field("Standard", "standard", "number", 0, 'min="0" max="50"')}${field("Deluxe", "deluxe", "number", 0, 'min="0" max="50"')}${field("Executive", "executive", "number", 0, 'min="0" max="50"')}<button>Add rooms</button></form><form id="remove-range-form" class="form-grid">${select(
                  "Remove from room",
                  "firstId",
                  d.units.map((u) => [u.id, u.name]),
              )}${select(
                  "Through room",
                  "lastId",
                  d.units.map((u) => [u.id, u.name]),
              )}<button class="danger">Remove room range</button></form><div class="row">${d.units.map((u) => `<button class="secondary" data-remove-unit="${u.id}">Remove ${esc(u.name)} · ${u.type}</button>`).join("")}</div><p>Reserved rooms cannot be removed; retain at least one room.</p></div>`
            : ""
    }<div class="panel"><h3>Date price modifiers</h3><p>Set a nightly rate between 50% and 150% of the room price.</p><form id="rate-form" class="form-grid">${field("Date", "date", "date", "", "required")}${field("Rate (%)", "percent", "number", 100, 'required min="50" max="150" step="0.01"')}<button>Update daily rate</button></form><table><thead><tr><th>Date</th><th>Rate</th></tr></thead><tbody>${d.rates.map((r) => `<tr><td>${r.date}</td><td>${r.percent}%</td></tr>`).join("")}</tbody></table></div><div class="panel"><h3>Delete property</h3><p>This deletes the listing and its reservations permanently.</p><button class="danger" data-action="delete-property">Delete property</button></div>`;
}
function reservationCards(rs) {
    return rs.length
        ? rs
              .map(
                  (r) =>
                      `<div class="panel"><span class="badge">${r.status} · #${r.id}</span><h3>${esc(properties.find((p) => p.id === r.propertyId)?.name || "Property")} · ${esc(r.guestName)}</h3><p>${r.checkIn} → ${r.checkOut} · Room / space #${r.unitId}</p><div class="row"><strong>${money(r.finalPrice)}</strong>${r.status === "RESERVED" ? `<button class="danger" data-cancel="${r.id}">Cancel reservation</button>` : ""}</div><details><summary>View reservation & price breakdown</summary>${quoteHtml({ originalPrice: r.originalPrice, discount: r.discount, finalPrice: r.finalPrice, nights: JSON.parse(r.breakdown) })}<p>Voucher: ${esc(r.voucherCode || "None")}</p></details></div>`,
              )
              .join("")
        : empty("No reservations found");
}
async function reservationPage() {
    if (!user) {
        page = "auth";
        return auth();
    }
    return `<h1>Your reservations.</h1>${reservationCards(await api("/reservations"))}`;
}
async function guests(id) {
    const rs = await api(`/reservations?propertyId=${id}`);
    return `<div class="panel"><h3>Search reservations</h3><input id="guest-search" placeholder="Search guest name, dates, or reservation number"></div><div id="guest-results">${reservationCards(rs)}</div><input type="hidden" id="guest-data" value="${esc(JSON.stringify(rs))}">`;
}
function quoteHtml(q) {
    return `<table><thead><tr><th>Night</th><th>Rate</th><th>Price</th></tr></thead><tbody>${q.nights.map((n) => `<tr><td>${Array.isArray(n.date) ? n.date.join("-") : n.date}</td><td>${n.rate}%</td><td>${money(n.price)}</td></tr>`).join("")}</tbody></table><p>Original total: ${money(q.originalPrice)}<br>Voucher discount: −${money(q.discount)}</p><h3>Total ${money(q.finalPrice)}</h3>`;
}
function values(form) {
    return Object.fromEntries(new FormData(form));
}
function nums(b, keys) {
    keys.forEach((k) => {
        if (k in b) b[k] = Number(b[k]);
    });
    return b;
}
async function run(fn) {
    notice = "";
    try {
        await fn();
    } catch (e) {
        notice = e.message;
        let main = document.querySelector("main");
        let old = main.querySelector('[role="alert"]');
        if (old) old.remove();
        main.insertAdjacentHTML(
            "afterbegin",
            `<div class="error" role="alert">${esc(notice)}</div>`,
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}
function bind() {
    document.querySelectorAll("[data-page]").forEach(
        (b) =>
            (b.onclick = () =>
                run(async () => {
                    page = b.dataset.page;
                    if (["create", "manage"].includes(page) && !user)
                        page = "auth";
                    await render();
                })),
    );
    document.querySelectorAll("[data-property]").forEach(
        (b) =>
            (b.onclick = () =>
                run(async () => {
                    selected = Number(b.dataset.property);
                    page = "detail";
                    tab = "book";
                    await render();
                })),
    );
    document.querySelectorAll("[data-tab]").forEach(
        (b) =>
            (b.onclick = () =>
                run(async () => {
                    tab = b.dataset.tab;
                    await render();
                })),
    );
    const form = (id, fn) => {
        let f = document.getElementById(id);
        if (f)
            f.onsubmit = (e) => {
                e.preventDefault();
                run(async () => {
                    const submit = f.querySelector(
                        'button[type="submit"],button:not([type])',
                    );
                    if (submit) submit.disabled = true;
                    try {
                        await fn(values(f));
                    } finally {
                        if (submit) submit.disabled = false;
                    }
                });
            };
    };
    form("auth-form", async (b) => {
        const s = await api("/auth/" + authMode, "POST", b);
        token = s.token;
        user = s.user;
        sessionStorage.setItem("hrs-session", token);
        properties = await api("/properties");
        page =
            user.role === "OWNER" && authMode === "register"
                ? "create"
                : "browse";
        await render();
    });
    form("listing-form", async (b) => {
        const p = await api(
            "/properties",
            "POST",
            nums(b, ["basePrice", "standard", "deluxe", "executive"]),
        );
        properties = await api("/properties");
        selected = p.id;
        page = "detail";
        tab = "manage";
        await render();
    });
    form("edit-form", async (b) => {
        await api(`/properties/${selected}`, "PATCH", nums(b, ["basePrice"]));
        properties = await api("/properties");
        await render();
    });
    form("rooms-form", async (b) => {
        await api(
            `/properties/${selected}/units`,
            "POST",
            nums(b, ["standard", "deluxe", "executive"]),
        );
        await render();
    });
    form("remove-range-form", async (b) => {
        if (confirm("Remove all unreserved rooms in this range?")) {
            await api(
                `/properties/${selected}/units/remove-range`,
                "POST",
                nums(b, ["firstId", "lastId"]),
            );
            await render();
        }
    });
    form("rate-form", async (b) => {
        await api(`/properties/${selected}/rates`, "PUT", nums(b, ["percent"]));
        await render();
    });
    form("voucher-form", async (b) => {
        await api(
            `/properties/${selected}/vouchers`,
            "POST",
            nums(b, [
                "percent",
                "date1",
                "date2",
                "minNights",
                "discountedNight",
            ]),
        );
        await render();
    });
    form("booking-form", async (b) => {
        if (!user) {
            page = "auth";
            await render();
            return;
        }
        let r = await api("/reservations", "POST", nums(b, ["unitId"]));
        page = "reservations";
        await render();
        document
            .querySelector("#content")
            .insertAdjacentHTML(
                "afterbegin",
                `<div class="success">Reservation #${r.id} confirmed. Your stay is ready.</div>`,
            );
    });
    form("availability-form", async (b) => {
        let rs = await api(
            `/properties/${selected}/availability?start=${b.start}&end=${b.end}`,
        );
        document.querySelector("#availability-results").innerHTML = rs
            .map(
                (r) =>
                    `<p>${esc(r.unit.name)} · ${r.unit.type}: <strong>${r.available ? "Available" : "Booked"}</strong></p>`,
            )
            .join("");
    });
    const search = document.querySelector("#search");
    if (search) {
        let filter = () => {
            const q = search.value.toLowerCase(),
                type = document.querySelector("#type-filter").value;
            document.querySelector("#property-grid").innerHTML = cards(
                properties.filter(
                    (p) =>
                        (page !== "manage" || p.ownerId === user.id) &&
                        (!type || p.type === type) &&
                        (p.name + " " + p.location).toLowerCase().includes(q),
                ),
            );
            bindPropertyButtons();
        };
        search.oninput = filter;
        document.querySelector("#type-filter").onchange = filter;
    }
    const type = document.querySelector('#listing-form select[name="type"]');
    if (type)
        type.onchange = () => {
            document.querySelector("#hotel-counts").style.display =
                type.value === "HOTEL" ? "block" : "none";
        };
    document.querySelectorAll("[data-action]").forEach(
        (b) =>
            (b.onclick = () =>
                run(async () => {
                    switch (b.dataset.action) {
                        case "logout":
                            await api("/auth/logout", "POST");
                            token = null;
                            user = null;
                            sessionStorage.removeItem("hrs-session");
                            page = "browse";
                            await render();
                            break;
                        case "auth-toggle":
                            authMode =
                                authMode === "login" ? "register" : "login";
                            await render();
                            break;
                        case "quote": {
                            let f = document.querySelector("#booking-form");
                            if (!f.reportValidity()) return;
                            let q = await api(
                                "/reservations/quote",
                                "POST",
                                nums(values(f), ["unitId"]),
                            );
                            document.querySelector("#quote").innerHTML =
                                quoteHtml(q);
                            break;
                        }
                        case "booking-availability": {
                            let f = document.querySelector("#booking-form"),
                                v = values(f);
                            if (!v.checkIn || !v.checkOut)
                                throw Error(
                                    "Select check-in and check-out dates.",
                                );
                            let rs = await api(
                                `/properties/${selected}/availability?start=${v.checkIn}&end=${v.checkOut}`,
                            );
                            if (v.mode === "DATE") {
                                f.unitId.innerHTML = rs
                                    .filter((r) => r.available)
                                    .map(
                                        (r) =>
                                            `<option value="${r.unit.id}">${esc(r.unit.name)} · ${r.unit.type}</option>`,
                                    )
                                    .join("");
                            }
                            document.querySelector(
                                "#booking-availability",
                            ).innerHTML =
                                rs
                                    .filter(
                                        (r) =>
                                            v.mode !== "ROOM" ||
                                            r.unit.id === Number(v.unitId),
                                    )
                                    .map(
                                        (r) =>
                                            `<p>${esc(r.unit.name)}: ${r.available ? "Available ✓" : "Booked"}</p>`,
                                    )
                                    .join("") || "<p>No available rooms.</p>";
                            break;
                        }
                        case "delete-property": {
                            const reservations = await api(
                                `/reservations?propertyId=${selected}`,
                            );
                            if (
                                confirm(
                                    `Permanently delete this property and its ${reservations.length} reservations?`,
                                )
                            ) {
                                await api(`/properties/${selected}`, "DELETE");
                                properties = await api("/properties");
                                page = "manage";
                                await render();
                            }
                            break;
                        }
                    }
                })),
    );
    for (const [attribute, path] of [
        ["data-remove-unit", "/units/"],
        ["data-remove-voucher", "/vouchers/"],
        ["data-cancel", "/reservations/"],
    ])
        document.querySelectorAll(`[${attribute}]`).forEach(
            (b) =>
                (b.onclick = () =>
                    run(async () => {
                        if (
                            confirm(
                                attribute === "data-cancel"
                                    ? "Cancel this reservation?"
                                    : "Remove this item?",
                            )
                        ) {
                            await api(
                                path + b.getAttribute(attribute),
                                "DELETE",
                            );
                            await render();
                        }
                    })),
        );
    document.querySelectorAll("[data-calendar]").forEach(
        (b) =>
            (b.onclick = () =>
                run(async () => {
                    const m = document.querySelector('[name="month"]').value;
                    if (!m) throw Error("Select a month.");
                    const start = m + "-01",
                        days = new Date(
                            Number(m.slice(0, 4)),
                            Number(m.slice(5)),
                            0,
                        ).getDate();
                    let results = [];
                    for (let day = 1; day <= days; day++) {
                        const s = m + "-" + String(day).padStart(2, "0"),
                            date = new Date(s + "T12:00:00Z");
                        date.setUTCDate(date.getUTCDate() + 1);
                        const rows = await api(
                            `/properties/${selected}/availability?start=${s}&end=${date.toISOString().slice(0, 10)}`,
                        );
                        results.push(
                            rows.find(
                                (r) => r.unit.id === Number(b.dataset.calendar),
                            ).available,
                        );
                    }
                    document.querySelector("#calendar").innerHTML =
                        `<h3>Room ${esc(currentDetails.units.find((u) => u.id === Number(b.dataset.calendar)).name)} · ${m}</h3><p>Green: available · Rose: booked</p><div class="calendar">${results.map((free, i) => `<div class="${free ? "" : "booked"}">${i + 1}<br>${free ? "Free" : "Booked"}</div>`).join("")}</div>`;
                })),
    );
    const guestSearch = document.querySelector("#guest-search");
    if (guestSearch)
        guestSearch.oninput = () => {
            const rs = JSON.parse(document.querySelector("#guest-data").value);
            document.querySelector("#guest-results").innerHTML =
                reservationCards(
                    rs.filter((r) =>
                        (
                            r.guestName +
                            " " +
                            r.checkIn +
                            " " +
                            r.checkOut +
                            " " +
                            r.id
                        )
                            .toLowerCase()
                            .includes(guestSearch.value.toLowerCase()),
                    ),
                );
            document.querySelectorAll("[data-cancel]").forEach(
                (b) =>
                    (b.onclick = () =>
                        run(async () => {
                            if (confirm("Cancel this reservation?")) {
                                await api(
                                    "/reservations/" + b.dataset.cancel,
                                    "DELETE",
                                );
                                await render();
                            }
                        })),
            );
        };
}
function bindPropertyButtons() {
    document.querySelectorAll("[data-property]").forEach(
        (b) =>
            (b.onclick = () =>
                run(async () => {
                    selected = Number(b.dataset.property);
                    page = "detail";
                    tab = "book";
                    await render();
                })),
    );
}
async function init() {
    try {
        if (token) user = await api("/auth/me");
    } catch {
        token = null;
        sessionStorage.removeItem("hrs-session");
    }
    try {
        properties = await api("/properties");
    } catch (e) {
        notice =
            "Cannot connect to the reservation service. Start the backend to continue.";
    }
    await render();
}
init();
