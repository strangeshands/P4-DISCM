(function () {
    const e = document.createElement("link").relList;
    if (e && e.supports && e.supports("modulepreload")) return;
    for (const o of document.querySelectorAll('link[rel="modulepreload"]'))
        i(o);
    new MutationObserver((o) => {
        for (const s of o)
            if (s.type === "childList")
                for (const r of s.addedNodes)
                    r.tagName === "LINK" && r.rel === "modulepreload" && i(r);
    }).observe(document, { childList: !0, subtree: !0 });
    function n(o) {
        const s = {};
        return (
            o.integrity && (s.integrity = o.integrity),
            o.referrerPolicy && (s.referrerPolicy = o.referrerPolicy),
            o.crossOrigin === "use-credentials"
                ? (s.credentials = "include")
                : o.crossOrigin === "anonymous"
                  ? (s.credentials = "omit")
                  : (s.credentials = "same-origin"),
            s
        );
    }
    function i(o) {
        if (o.ep) return;
        o.ep = !0;
        const s = n(o);
        fetch(o.href, s);
    }
})();
const b = document.querySelector("#app"),
    a = {
        token: sessionStorage.getItem("care-token"),
        user: null,
        staff: [],
        appointments: [],
        assigned: [],
        view: "appointments",
        catalog: null,
    },
    c = (t) =>
        String(t ?? "").replace(
            /[&<>"']/g,
            (e) =>
                ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;",
                })[e],
        ),
    g = () => {
        const t = new Date();
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    },
    h = (t) =>
        ({
            BOOKED: "Booked",
            DONE: "Done",
            FOLLOW_UP: "For follow up",
            LAB: "Laboratory",
            SPECIALIZED: "Practitioner",
            ASSISTANT: "Assistant",
            PATIENT: "Patient",
        })[t] || t;
async function d(t, e = {}) {
    const n = { ...e.headers };
    (a.token && (n.Authorization = `Bearer ${a.token}`),
        e.body &&
            !(e.body instanceof FormData) &&
            ((n["Content-Type"] = "application/json"),
            (e.body = JSON.stringify(e.body))));
    const i = await fetch("/api" + t, { ...e, headers: n });
    if (!i.ok) {
        const o = await i.json().catch(() => ({}));
        throw Error(o.message || o.detail || `Request failed (${i.status})`);
    }
    return i.json();
}
function m(t, e = !1) {
    let n = document.querySelector("#notice");
    (n ||
        ((n = document.createElement("div")),
        (n.id = "notice"),
        document.body.append(n)),
        (n.className = e ? "bad" : ""),
        (n.textContent = t),
        clearTimeout(m.timer),
        (m.timer = setTimeout(() => n.remove(), 6500)));
}
const u = (t) => async (e) => {
    e?.preventDefault();
    try {
        await t(e);
    } catch (n) {
        m(n.message, !0);
    }
};
function y(t = !1) {
    ((b.innerHTML = `<div class="auth"><section class="welcome"><div class="brand">✚ care<span>portal</span></div><span class="eyebrow">CONNECTED CARE, SIMPLIFIED</span><h1>Your care.<br>Your schedule.<br>One place.</h1><p>Book appointments, connect with your care team, and keep your results within reach.</p><div class="welcome-note">Appointments · Laboratories · Results</div></section><section class="auth-form"><div class="mobile-brand">✚ Care Portal</div><span class="eyebrow">WELCOME TO CARE PORTAL</span><h2>${t ? "Create your account" : "Welcome back"}</h2><p>${t ? "A few details to get you started." : "Sign in to manage your care."}</p><form id="auth-form"><label>Account type<select name="role"><option value="PATIENT">Patient</option><option value="STAFF">Staff</option></select></label>${t ? '<div class="name-grid"><label>Last name<input name="lastName" required maxlength="80" autocomplete="family-name"></label><label>First name<input name="firstName" required maxlength="80" autocomplete="given-name"></label></div><label>Middle name <span class="muted">(optional)</span><input name="middleName" maxlength="80" autocomplete="additional-name"></label><div id="staff-fields" hidden><label>Staff type<select name="staffType"><option value="ASSISTANT">Assistant</option><option value="LAB">Lab Assigned</option><option value="SPECIALIZED">Specialized Practitioner</option></select></label><label id="specialty-field" hidden>Department / specialty<select name="specialty"></select></label></div>' : '<label>Username<input name="username" required autocomplete="username" placeholder="e.g. delacruz_juan_P001"></label>'}<label>Password<input name="password" type="password" required minlength="8" maxlength="72" autocomplete="${t ? "new-password" : "current-password"}"></label><button class="primary" type="submit">${t ? "Create account" : "Sign in"} <span>→</span></button></form><p class="switch">${t ? "Already registered?" : "New to Care Portal?"} <button class="link" id="toggle-auth">${t ? "Sign in" : "Create an account"}</button></p><p class="privacy">Your health information stays with your care team.</p></section></div>`),
        (document.querySelector("#toggle-auth").onclick = () => y(!t)));
    const e = document.querySelector("#auth-form");
    if (t) {
        const n = () => {
            document.querySelector("#staff-fields").hidden =
                e.elements.namedItem("role").value !== "STAFF";
            const i = a.catalog.specialties[e.staffType.value];
            ((document.querySelector("#specialty-field").hidden = !i.length),
                (e.specialty.innerHTML = i
                    .map((o) => `<option>${c(o)}</option>`)
                    .join("")));
        };
        ((e.elements.namedItem("role").onchange = n),
            (e.staffType.onchange = n),
            n());
    }
    e.onsubmit = u(async () => {
        const n = Object.fromEntries(new FormData(e)),
            i = e.querySelector("button[type=submit]");
        i.disabled = !0;
        try {
            if (t) {
                const o = await d("/auth/register", {
                    method: "POST",
                    body: n,
                });
                (y(!1),
                    (document.querySelector("[name=username]").value =
                        o.username),
                    (document.querySelector("[name=role]").value = o.role),
                    m(`Account created. Your username: ${o.username}`),
                    window.alert(`Save your generated username:
${o.username}

Use it to sign in.`));
            } else {
                const o = await d("/auth/login", { method: "POST", body: n });
                ((a.token = o.token),
                    (a.user = o.user),
                    sessionStorage.setItem("care-token", a.token),
                    await f());
            }
        } finally {
            i.disabled = !1;
        }
    });
}
async function f() {
    (([a.staff, a.appointments, a.assigned] = await Promise.all([
        d("/staff"),
        d("/appointments"),
        d("/assignments"),
    ])),
        S());
}
function S() {
    const t = a.user,
        e = t.role === "PATIENT",
        n = t.staffType === "ASSISTANT",
        i = e
            ? [
                  ["appointments", "My appointments"],
                  ["book", "Book an appointment"],
                  ["results", "My results"],
              ]
            : n
              ? [
                    ["appointments", "Appointments"],
                    ["assignments", "Doctor assignments"],
                ]
              : [
                    ["appointments", "Appointments"],
                    ["patients", "Patients"],
                ];
    i.some((s) => s[0] === a.view) || (a.view = "appointments");
    const o = a.appointments.filter((s) => s.status === "BOOKED").length;
    ((b.innerHTML = `<div class="layout"><aside><div class="brand">✚ care<span>portal</span></div><div class="workspace-label">${c(h(t.staffType || t.role))} WORKSPACE</div><nav>${i.map(([s, r]) => `<button data-view="${s}" class="${a.view === s ? "active" : ""}"><span>${s === "book" ? "＋" : s === "results" ? "▤" : s === "assignments" ? "↔" : s === "patients" ? "♧" : "▦"}</span>${r}</button>`).join("")}</nav><div class="profile"><div class="avatar">${c(t.name[0])}</div><div><strong>${c(t.name)}</strong><small>${c(t.username)}</small></div></div><button id="logout" class="logout">↪ Sign out</button></aside><main><header><div><span class="eyebrow">YOUR HEALTH, ORGANIZED</span><h1>${c(i.find((s) => s[0] === a.view)[1])}</h1><p>${e ? "Stay connected with your care team." : "A clear view of your day and your patients."}</p></div><span class="date-chip">${new Date().toLocaleDateString(void 0, { weekday: "short", month: "short", day: "numeric" })}</span></header><div class="stats"><div><span>Total appointments</span><strong>${a.appointments.length}</strong></div><div><span>Scheduled</span><strong>${o}</strong></div><div><span>Completed</span><strong>${a.appointments.filter((s) => s.status === "DONE").length}</strong></div></div><section id="content"></section></main></div>`),
        document.querySelectorAll("[data-view]").forEach(
            (s) =>
                (s.onclick = () => {
                    ((a.view = s.dataset.view), S());
                }),
        ),
        (document.querySelector("#logout").onclick = u(async () => {
            (await d("/auth/logout", { method: "POST" }),
                sessionStorage.removeItem("care-token"),
                (a.token = null),
                (a.user = null),
                y());
        })),
        a.view === "book"
            ? E()
            : a.view === "assignments"
              ? A()
              : a.view === "patients"
                ? q()
                : T());
}
function T() {
    const t = document.querySelector("#content");
    t.innerHTML = `<div class="section-heading"><div><h2>${a.view === "results" ? "Appointment results" : "Appointment overview"}</h2><p>All the details you need, in one place.</p></div><button id="refresh" class="secondary">Refresh</button></div><div class="filters"><label>Care provider<select id="doctor-filter"><option value="">All providers</option>${a.staff.map((n) => `<option value="${n.id}">${c(n.name)}</option>`).join("")}</select></label><label>Date<input id="date-filter" type="date"></label><label>Status<select id="status-filter"><option value="">All statuses</option><option value="BOOKED">Booked</option><option value="DONE">Done</option><option value="FOLLOW_UP">For follow up</option></select></label><button id="clear" class="link">Clear filters</button></div><div id="appointments"></div>`;
    const e = () => {
        const n = document.querySelector("#doctor-filter").value,
            i = document.querySelector("#date-filter").value,
            o = document.querySelector("#status-filter").value,
            r = (
                a.user.staffType === "ASSISTANT"
                    ? [...a.appointments].sort(
                          (l, p) =>
                              l.staff.name.localeCompare(p.staff.name) ||
                              l.startsAt.localeCompare(p.startsAt),
                      )
                    : a.appointments
            ).filter(
                (l) =>
                    (!n || String(l.staff.id) === n) &&
                    (!i || l.startsAt.startsWith(i)) &&
                    (!o || l.status === o) &&
                    (a.view !== "results" ||
                        l.status !== "BOOKED" ||
                        l.fileName),
            );
        ((document.querySelector("#appointments").innerHTML = r.length
            ? `<div class="table-wrap"><table><thead><tr><th>Patient / provider</th><th>Appointment</th><th>Status</th><th>Details</th></tr></thead><tbody>${r.map((l) => `<tr><td><strong>${c(a.user.role === "PATIENT" ? l.staff.name : l.patient.name)}</strong><small>${c(l.staff.specialty)} · ${c(l.staff.name)}</small></td><td>${new Date(l.startsAt).toLocaleDateString()}<small>${new Date(l.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · 15 min</small></td><td><span class="badge ${l.status.toLowerCase()}">${h(l.status)}</span></td><td><button class="link" data-appointment="${l.id}">${a.user.role === "PATIENT" ? "View details" : "View / update"} →</button></td></tr>`).join("")}</tbody></table></div>`
            : '<div class="empty"><span>▦</span><h3>No appointments here yet</h3><p>' +
              (a.user.role === "PATIENT"
                  ? "Choose a provider and book your first visit."
                  : "Assigned appointments will appear here.") +
              "</p></div>"),
            document
                .querySelectorAll("[data-appointment]")
                .forEach(
                    (l) => (l.onclick = () => $(Number(l.dataset.appointment))),
                ));
    };
    (t.querySelectorAll("select,input").forEach((n) => (n.onchange = e)),
        (document.querySelector("#clear").onclick = () => {
            (t.querySelectorAll("select,input").forEach((n) => (n.value = "")),
                e());
        }),
        (document.querySelector("#refresh").onclick = u(f)),
        e());
}
function A() {
    ((document.querySelector("#content").innerHTML =
        `<div class="section-heading"><div><h2>Your doctor assignments</h2><p>Select the practitioners whose appointments you manage.</p></div></div><div class="cards">${
            a.staff
                .filter((t) => t.staffType === "SPECIALIZED")
                .map(
                    (t) =>
                        `<article class="provider"><div class="provider-icon">✚</div><h3>${c(t.name)}</h3><p>${c(t.specialty)}</p><button data-assign="${t.id}" class="${a.assigned.includes(t.id) ? "secondary" : "primary"}">${a.assigned.includes(t.id) ? "Remove assignment" : "Assign to me"}</button></article>`,
                )
                .join("") ||
            '<div class="empty">No practitioners registered yet.</div>'
        }</div>`),
        document.querySelectorAll("[data-assign]").forEach(
            (t) =>
                (t.onclick = u(async () => {
                    const e = Number(t.dataset.assign);
                    (await d("/assignments/" + e, {
                        method: a.assigned.includes(e) ? "DELETE" : "POST",
                    }),
                        await f());
                })),
        ));
}
function q() {
    const t = [
        ...new Map(
            a.appointments.map((e) => [e.patient.id, e.patient]),
        ).values(),
    ];
    ((document.querySelector("#content").innerHTML =
        `<div class="section-heading"><div><h2>Patients in your care</h2><p>Select a patient to review visits and submit results.</p></div></div><div class="cards">${t.map((e) => `<article class="provider"><div class="avatar">${c(e.name[0])}</div><h3>${c(e.name)}</h3><p>${a.appointments.filter((n) => n.patient.id === e.id).length} appointment(s)</p><button class="secondary" data-patient="${e.id}">View visits →</button></article>`).join("") || '<div class="empty">Patients will appear after their first booking.</div>'}</div>`),
        document.querySelectorAll("[data-patient]").forEach(
            (e) =>
                (e.onclick = () => {
                    const n = a.appointments.filter(
                        (i) => String(i.patient.id) === e.dataset.patient,
                    );
                    (w(
                        `<h2>${c(n[0].patient.name)}</h2>${n.map((i) => `<p><button class="secondary" data-visit="${i.id}">${c(new Date(i.startsAt).toLocaleString())} · ${h(i.status)}</button></p>`).join("")}`,
                    ),
                        document
                            .querySelectorAll("[data-visit]")
                            .forEach(
                                (i) =>
                                    (i.onclick = () =>
                                        $(Number(i.dataset.visit))),
                            ));
                }),
        ));
}
function E() {
    const t = document.querySelector("#content");
    t.innerHTML = `<div class="section-heading"><div><h2>Find your next appointment</h2><p>Choose a service, care provider, and available time.</p></div></div><form id="booking" class="booking-panel"><div class="filters"><label>Service<select id="service"><option value="SPECIALIZED">Doctor consultation</option><option value="LAB">Laboratory service</option></select></label><label>Department<select id="department"></select></label><label>Date<input name="date" type="date" min="${g()}" value="${g()}" required></label></div><label>Assigned care provider<select name="staffId" required></select></label><div id="provider-info" class="provider-info"></div><h3>Available times</h3><div id="slots" class="slots"></div><div class="booking-footer"><span class="muted">Each appointment lasts 15 minutes.</span><button class="primary">Confirm booking →</button></div></form>`;
    const e = document.querySelector("#booking");
    let n = 0;
    const i = u(async () => {
            const r = ++n;
            if (
                ((e.querySelector("button.primary").disabled = !0),
                (document.querySelector("#slots").innerHTML =
                    '<p class="muted">Checking availability…</p>'),
                !e.staffId.value)
            ) {
                document.querySelector("#slots").innerHTML =
                    '<p class="muted">No staff registered for this service yet.</p>';
                return;
            }
            const l = a.staff.find((v) => String(v.id) === e.staffId.value);
            document.querySelector("#provider-info").textContent =
                `${l.name} · ${l.specialty}`;
            const p = await d(
                `/availability?staffId=${e.staffId.value}&date=${e.date.value}`,
            );
            r === n &&
                ((document.querySelector("#slots").innerHTML = p.length
                    ? p
                          .map(
                              (v) =>
                                  `<label class="slot"><input type="radio" name="time" required value="${v.slice(11, 16)}"><span>${v.slice(11, 16)}</span></label>`,
                          )
                          .join("")
                    : '<p class="muted">No available slots for this date. Try another day.</p>'),
                (e.querySelector("button.primary").disabled = !p.length));
        }),
        o = () => {
            const r = a.staff.filter(
                (l) =>
                    l.staffType === document.querySelector("#service").value &&
                    l.specialty === document.querySelector("#department").value,
            );
            ((e.staffId.innerHTML = r
                .map((l) => `<option value="${l.id}">${c(l.name)}</option>`)
                .join("")),
                i());
        },
        s = () => {
            ((document.querySelector("#department").innerHTML =
                a.catalog.specialties[document.querySelector("#service").value]
                    .map((r) => `<option>${c(r)}</option>`)
                    .join("")),
                o());
        };
    ((document.querySelector("#service").onchange = s),
        (document.querySelector("#department").onchange = o),
        (e.staffId.onchange = i),
        (e.date.onchange = i),
        (e.onsubmit = u(async () => {
            const r = Object.fromEntries(new FormData(e));
            ((r.staffId = Number(r.staffId)),
                await d("/appointments", { method: "POST", body: r }),
                (a.view = "appointments"),
                await f(),
                m("Your appointment is booked."));
        })),
        s());
}
function w(t) {
    document.querySelector("dialog")?.remove();
    const e = document.createElement("dialog");
    ((e.innerHTML = `<button class="close" aria-label="Close dialog">×</button>${t}`),
        document.body.append(e),
        (e.querySelector(".close").onclick = () => e.close()),
        e.addEventListener("close", () => e.remove()),
        e.showModal());
}
function $(t) {
    const e = a.appointments.find((o) => o.id === t),
        n = a.user.role === "PATIENT",
        i = a.user.staffType === "ASSISTANT";
    (w(
        `<span class="eyebrow">APPOINTMENT #${e.id}</span><h2>${c(e.patient.name)}</h2><p>${c(e.staff.name)} · ${c(e.staff.specialty)}</p><p>${c(new Date(e.startsAt).toLocaleString())} · 15 minutes</p><span class="badge ${e.status.toLowerCase()}">${h(e.status)}</span>${n ? `<h3>Comments / results</h3><p class="comments">${c(e.comments || "Your care team has not added comments yet.")}</p>` : `<form id="result-form"><label>Status<select name="status"><option value="DONE" ${e.status === "DONE" ? "selected" : ""}>Done</option><option value="FOLLOW_UP" ${e.status === "FOLLOW_UP" ? "selected" : ""}>For follow up</option></select></label><label>Comments<textarea name="comments" rows="4" maxlength="4000">${c(e.comments)}</textarea></label>${i ? "" : '<label>Result file <span class="muted">(PDF, PNG, JPEG, TXT · max 10 MB)</span><input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt"></label>'}<button class="primary">Save results</button></form>`}${e.fileName ? `<p><button id="download" class="secondary">Download ${c(e.fileName)}</button></p>` : ""}`,
    ),
        n ||
            (document.querySelector("#result-form").onsubmit = u(async (o) => {
                const s = o.target,
                    r = new FormData(s);
                if (r.get("file")?.size > 10 * 1024 * 1024)
                    throw Error("Result file must be at most 10 MB.");
                (await d(`/appointments/${t}/results`, {
                    method: "POST",
                    body: r,
                }),
                    document.querySelector("dialog").close(),
                    await f(),
                    m("Results saved."));
            })),
        e.fileName &&
            (document.querySelector("#download").onclick = u(async () => {
                const o = await fetch(`/api/appointments/${t}/file`, {
                    headers: { Authorization: `Bearer ${a.token}` },
                });
                if (!o.ok) throw Error("Could not download result.");
                const s = URL.createObjectURL(await o.blob()),
                    r = document.createElement("a");
                ((r.href = s),
                    (r.download = e.fileName),
                    r.click(),
                    setTimeout(() => URL.revokeObjectURL(s), 1e3));
            })));
}
async function L() {
    try {
        if (((a.catalog = await d("/catalog")), a.token))
            try {
                ((a.user = await d("/me")), await f());
                return;
            } catch {
                ((a.token = null), sessionStorage.removeItem("care-token"));
            }
        y();
    } catch {
        b.innerHTML =
            '<div class="empty"><h2>Care Portal is unavailable</h2><p>Start the backend service, then reload this page.</p><button onclick="location.reload()">Try again</button></div>';
    }
}
L();
