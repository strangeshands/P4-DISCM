import "./style.css";
const app = document.querySelector("#app");
const state = {
    token: sessionStorage.getItem("care-token"),
    user: null,
    staff: [],
    appointments: [],
    assigned: [],
    view: "appointments",
    catalog: null,
};
const esc = (v) =>
    String(v ?? "").replace(
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
const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const label = (s) =>
    ({
        BOOKED: "Booked",
        DONE: "Done",
        FOLLOW_UP: "For follow up",
        LAB: "Laboratory",
        SPECIALIZED: "Practitioner",
        ASSISTANT: "Assistant",
        PATIENT: "Patient",
    })[s] || s;
async function api(path, options = {}) {
    const headers = { ...options.headers };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    if (options.body && !(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(options.body);
    }
    const r = await fetch("/api" + path, { ...options, headers });
    if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw Error(e.message || e.detail || `Request failed (${r.status})`);
    }
    return r.json();
}
function notify(message, bad = false) {
    let n = document.querySelector("#notice");
    if (!n) {
        n = document.createElement("div");
        n.id = "notice";
        document.body.append(n);
    }
    n.className = bad ? "bad" : "";
    n.textContent = message;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => n.remove(), 6500);
}
const run = (fn) => async (e) => {
    e?.preventDefault();
    try {
        await fn(e);
    } catch (err) {
        notify(err.message, true);
    }
};
function authView(register = false) {
    app.innerHTML = `<div class="auth"><section class="welcome"><div class="brand">✚ care<span>portal</span></div><span class="eyebrow">CONNECTED CARE, SIMPLIFIED</span><h1>Your care.<br>Your schedule.<br>One place.</h1><p>Book appointments, connect with your care team, and keep your results within reach.</p><div class="welcome-note">Appointments · Laboratories · Results</div></section><section class="auth-form"><div class="mobile-brand">✚ Care Portal</div><span class="eyebrow">WELCOME TO CARE PORTAL</span><h2>${register ? "Create your account" : "Welcome back"}</h2><p>${register ? "A few details to get you started." : "Sign in to manage your care."}</p><form id="auth-form"><label>Account type<select name="role"><option value="PATIENT">Patient</option><option value="STAFF">Staff</option></select></label>${register ? '<div class="name-grid"><label>Last name<input name="lastName" required maxlength="80" autocomplete="family-name"></label><label>First name<input name="firstName" required maxlength="80" autocomplete="given-name"></label></div><label>Middle name <span class="muted">(optional)</span><input name="middleName" maxlength="80" autocomplete="additional-name"></label><div id="staff-fields" hidden><label>Staff type<select name="staffType"><option value="ASSISTANT">Assistant</option><option value="LAB">Lab Assigned</option><option value="SPECIALIZED">Specialized Practitioner</option></select></label><label id="specialty-field" hidden>Department / specialty<select name="specialty"></select></label></div>' : '<label>Username<input name="username" required autocomplete="username" placeholder="e.g. delacruz_juan_P001"></label>'}<label>Password<input name="password" type="password" required minlength="8" maxlength="72" autocomplete="${register ? "new-password" : "current-password"}"></label><button class="primary" type="submit">${register ? "Create account" : "Sign in"} <span>→</span></button></form><p class="switch">${register ? "Already registered?" : "New to Care Portal?"} <button class="link" id="toggle-auth">${register ? "Sign in" : "Create an account"}</button></p><p class="privacy">Your health information stays with your care team.</p></section></div>`;
    document.querySelector("#toggle-auth").onclick = () => authView(!register);
    const form = document.querySelector("#auth-form");
    if (register) {
        const update = () => {
            document.querySelector("#staff-fields").hidden =
                form.elements.namedItem("role").value !== "STAFF";
            const choices = state.catalog.specialties[form.staffType.value];
            document.querySelector("#specialty-field").hidden = !choices.length;
            form.specialty.innerHTML = choices
                .map((x) => `<option>${esc(x)}</option>`)
                .join("");
        };
        form.elements.namedItem("role").onchange = update;
        form.staffType.onchange = update;
        update();
    }
    form.onsubmit = run(async () => {
        const data = Object.fromEntries(new FormData(form));
        const button = form.querySelector("button[type=submit]");
        button.disabled = true;
        try {
            if (register) {
                const u = await api("/auth/register", {
                    method: "POST",
                    body: data,
                });
                authView(false);
                document.querySelector("[name=username]").value = u.username;
                document.querySelector("[name=role]").value = u.role;
                notify(`Account created. Your username: ${u.username}`);
                window.alert(
                    `Save your generated username:\n${u.username}\n\nUse it to sign in.`,
                );
            } else {
                const res = await api("/auth/login", {
                    method: "POST",
                    body: data,
                });
                state.token = res.token;
                state.user = res.user;
                sessionStorage.setItem("care-token", state.token);
                await load();
            }
        } finally {
            button.disabled = false;
        }
    });
}
async function load() {
    [state.staff, state.appointments, state.assigned] = await Promise.all([
        api("/staff"),
        api("/appointments"),
        api("/assignments"),
    ]);
    dashboard();
}
function dashboard() {
    const u = state.user;
    const patient = u.role === "PATIENT",
        assistant = u.staffType === "ASSISTANT";
    const views = patient
        ? [
              ["appointments", "My appointments"],
              ["book", "Book an appointment"],
              ["results", "My results"],
          ]
        : assistant
          ? [
                ["appointments", "Appointments"],
                ["assignments", "Doctor assignments"],
            ]
          : [
                ["appointments", "Appointments"],
                ["patients", "Patients"],
            ];
    if (!views.some((v) => v[0] === state.view)) state.view = "appointments";
    const pending = state.appointments.filter(
        (a) => a.status === "BOOKED",
    ).length;
    app.innerHTML = `<div class="layout"><aside><div class="brand">✚ care<span>portal</span></div><div class="workspace-label">${esc(label(u.staffType || u.role))} WORKSPACE</div><nav>${views.map(([v, l]) => `<button data-view="${v}" class="${state.view === v ? "active" : ""}"><span>${v === "book" ? "＋" : v === "results" ? "▤" : v === "assignments" ? "↔" : v === "patients" ? "♧" : "▦"}</span>${l}</button>`).join("")}</nav><div class="profile"><div class="avatar">${esc(u.name[0])}</div><div><strong>${esc(u.name)}</strong><small>${esc(u.username)}</small></div></div><button id="logout" class="logout">↪ Sign out</button></aside><main><header><div><span class="eyebrow">YOUR HEALTH, ORGANIZED</span><h1>${esc(views.find((v) => v[0] === state.view)[1])}</h1><p>${patient ? "Stay connected with your care team." : "A clear view of your day and your patients."}</p></div><span class="date-chip">${new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span></header><div class="stats"><div><span>Total appointments</span><strong>${state.appointments.length}</strong></div><div><span>Scheduled</span><strong>${pending}</strong></div><div><span>Completed</span><strong>${state.appointments.filter((a) => a.status === "DONE").length}</strong></div></div><section id="content"></section></main></div>`;
    document.querySelectorAll("[data-view]").forEach(
        (b) =>
            (b.onclick = () => {
                state.view = b.dataset.view;
                dashboard();
            }),
    );
    document.querySelector("#logout").onclick = run(async () => {
        await api("/auth/logout", { method: "POST" });
        sessionStorage.removeItem("care-token");
        state.token = null;
        state.user = null;
        authView();
    });
    if (state.view === "book") bookView();
    else if (state.view === "assignments") assignmentView();
    else if (state.view === "patients") patientsView();
    else appointmentsView();
}
function appointmentsView() {
    const c = document.querySelector("#content");
    c.innerHTML = `<div class="section-heading"><div><h2>${state.view === "results" ? "Appointment results" : "Appointment overview"}</h2><p>All the details you need, in one place.</p></div><button id="refresh" class="secondary">Refresh</button></div><div class="filters"><label>Care provider<select id="doctor-filter"><option value="">All providers</option>${state.staff.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></label><label>Date<input id="date-filter" type="date"></label><label>Status<select id="status-filter"><option value="">All statuses</option><option value="BOOKED">Booked</option><option value="DONE">Done</option><option value="FOLLOW_UP">For follow up</option></select></label><button id="clear" class="link">Clear filters</button></div><div id="appointments"></div>`;
    const update = () => {
        const doc = document.querySelector("#doctor-filter").value,
            date = document.querySelector("#date-filter").value,
            status = document.querySelector("#status-filter").value;
        const source =
            state.user.staffType === "ASSISTANT"
                ? [...state.appointments].sort(
                      (a, b) =>
                          a.staff.name.localeCompare(b.staff.name) ||
                          a.startsAt.localeCompare(b.startsAt),
                  )
                : state.appointments;
        const list = source.filter(
            (a) =>
                (!doc || String(a.staff.id) === doc) &&
                (!date || a.startsAt.startsWith(date)) &&
                (!status || a.status === status) &&
                (state.view !== "results" ||
                    a.status !== "BOOKED" ||
                    a.fileName),
        );
        document.querySelector("#appointments").innerHTML = list.length
            ? `<div class="table-wrap"><table><thead><tr><th>Patient / provider</th><th>Appointment</th><th>Status</th><th>Details</th></tr></thead><tbody>${list.map((a) => `<tr><td><strong>${esc(state.user.role === "PATIENT" ? a.staff.name : a.patient.name)}</strong><small>${esc(a.staff.specialty)} · ${esc(a.staff.name)}</small></td><td>${new Date(a.startsAt).toLocaleDateString()}<small>${new Date(a.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · 15 min</small></td><td><span class="badge ${a.status.toLowerCase()}">${label(a.status)}</span></td><td><button class="link" data-appointment="${a.id}">${state.user.role === "PATIENT" ? "View details" : "View / update"} →</button></td></tr>`).join("")}</tbody></table></div>`
            : '<div class="empty"><span>▦</span><h3>No appointments here yet</h3><p>' +
              (state.user.role === "PATIENT"
                  ? "Choose a provider and book your first visit."
                  : "Assigned appointments will appear here.") +
              "</p></div>";
        document
            .querySelectorAll("[data-appointment]")
            .forEach(
                (b) =>
                    (b.onclick = () =>
                        showAppointment(Number(b.dataset.appointment))),
            );
    };
    c.querySelectorAll("select,input").forEach((el) => (el.onchange = update));
    document.querySelector("#clear").onclick = () => {
        c.querySelectorAll("select,input").forEach((el) => (el.value = ""));
        update();
    };
    document.querySelector("#refresh").onclick = run(load);
    update();
}
function assignmentView() {
    document.querySelector("#content").innerHTML =
        `<div class="section-heading"><div><h2>Your doctor assignments</h2><p>Select the practitioners whose appointments you manage.</p></div></div><div class="cards">${
            state.staff
                .filter((s) => s.staffType === "SPECIALIZED")
                .map(
                    (s) =>
                        `<article class="provider"><div class="provider-icon">✚</div><h3>${esc(s.name)}</h3><p>${esc(s.specialty)}</p><button data-assign="${s.id}" class="${state.assigned.includes(s.id) ? "secondary" : "primary"}">${state.assigned.includes(s.id) ? "Remove assignment" : "Assign to me"}</button></article>`,
                )
                .join("") ||
            '<div class="empty">No practitioners registered yet.</div>'
        }</div>`;
    document.querySelectorAll("[data-assign]").forEach(
        (b) =>
            (b.onclick = run(async () => {
                const id = Number(b.dataset.assign);
                await api("/assignments/" + id, {
                    method: state.assigned.includes(id) ? "DELETE" : "POST",
                });
                await load();
            })),
    );
}
function patientsView() {
    const patients = [
        ...new Map(
            state.appointments.map((a) => [a.patient.id, a.patient]),
        ).values(),
    ];
    document.querySelector("#content").innerHTML =
        `<div class="section-heading"><div><h2>Patients in your care</h2><p>Select a patient to review visits and submit results.</p></div></div><div class="cards">${patients.map((p) => `<article class="provider"><div class="avatar">${esc(p.name[0])}</div><h3>${esc(p.name)}</h3><p>${state.appointments.filter((a) => a.patient.id === p.id).length} appointment(s)</p><button class="secondary" data-patient="${p.id}">View visits →</button></article>`).join("") || '<div class="empty">Patients will appear after their first booking.</div>'}</div>`;
    document.querySelectorAll("[data-patient]").forEach(
        (b) =>
            (b.onclick = () => {
                const visits = state.appointments.filter(
                    (a) => String(a.patient.id) === b.dataset.patient,
                );
                modal(
                    `<h2>${esc(visits[0].patient.name)}</h2>${visits.map((a) => `<p><button class="secondary" data-visit="${a.id}">${esc(new Date(a.startsAt).toLocaleString())} · ${label(a.status)}</button></p>`).join("")}`,
                );
                document
                    .querySelectorAll("[data-visit]")
                    .forEach(
                        (x) =>
                            (x.onclick = () =>
                                showAppointment(Number(x.dataset.visit))),
                    );
            }),
    );
}
function bookView() {
    const c = document.querySelector("#content");
    c.innerHTML = `<div class="section-heading"><div><h2>Find your next appointment</h2><p>Choose a service, care provider, and available time.</p></div></div><form id="booking" class="booking-panel"><div class="filters"><label>Service<select id="service"><option value="SPECIALIZED">Doctor consultation</option><option value="LAB">Laboratory service</option></select></label><label>Department<select id="department"></select></label><label>Date<input name="date" type="date" min="${today()}" value="${today()}" required></label></div><label>Assigned care provider<select name="staffId" required></select></label><div id="provider-info" class="provider-info"></div><h3>Available times</h3><div id="slots" class="slots"></div><div class="booking-footer"><span class="muted">Each appointment lasts 15 minutes.</span><button class="primary">Confirm booking →</button></div></form>`;
    const f = document.querySelector("#booking");
    let request = 0;
    const refresh = run(async () => {
        const seq = ++request;
        f.querySelector("button.primary").disabled = true;
        document.querySelector("#slots").innerHTML =
            '<p class="muted">Checking availability…</p>';
        if (!f.staffId.value) {
            document.querySelector("#slots").innerHTML =
                '<p class="muted">No staff registered for this service yet.</p>';
            return;
        }
        const s = state.staff.find((x) => String(x.id) === f.staffId.value);
        document.querySelector("#provider-info").textContent =
            `${s.name} · ${s.specialty}`;
        const slots = await api(
            `/availability?staffId=${f.staffId.value}&date=${f.date.value}`,
        );
        if (seq !== request) return;
        document.querySelector("#slots").innerHTML = slots.length
            ? slots
                  .map(
                      (t) =>
                          `<label class="slot"><input type="radio" name="time" required value="${t.slice(11, 16)}"><span>${t.slice(11, 16)}</span></label>`,
                  )
                  .join("")
            : '<p class="muted">No available slots for this date. Try another day.</p>';
        f.querySelector("button.primary").disabled = !slots.length;
    });
    const providers = () => {
        const values = state.staff.filter(
            (s) =>
                s.staffType === document.querySelector("#service").value &&
                s.specialty === document.querySelector("#department").value,
        );
        f.staffId.innerHTML = values
            .map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
            .join("");
        refresh();
    };
    const departments = () => {
        document.querySelector("#department").innerHTML =
            state.catalog.specialties[document.querySelector("#service").value]
                .map((s) => `<option>${esc(s)}</option>`)
                .join("");
        providers();
    };
    document.querySelector("#service").onchange = departments;
    document.querySelector("#department").onchange = providers;
    f.staffId.onchange = refresh;
    f.date.onchange = refresh;
    f.onsubmit = run(async () => {
        const data = Object.fromEntries(new FormData(f));
        data.staffId = Number(data.staffId);
        await api("/appointments", { method: "POST", body: data });
        state.view = "appointments";
        await load();
        notify("Your appointment is booked.");
    });
    departments();
}
function modal(content) {
    document.querySelector("dialog")?.remove();
    const d = document.createElement("dialog");
    d.innerHTML = `<button class="close" aria-label="Close dialog">×</button>${content}`;
    document.body.append(d);
    d.querySelector(".close").onclick = () => d.close();
    d.addEventListener("close", () => d.remove());
    d.showModal();
}
function showAppointment(id) {
    const a = state.appointments.find((x) => x.id === id);
    const patient = state.user.role === "PATIENT",
        assistant = state.user.staffType === "ASSISTANT";
    modal(
        `<span class="eyebrow">APPOINTMENT #${a.id}</span><h2>${esc(a.patient.name)}</h2><p>${esc(a.staff.name)} · ${esc(a.staff.specialty)}</p><p>${esc(new Date(a.startsAt).toLocaleString())} · 15 minutes</p><span class="badge ${a.status.toLowerCase()}">${label(a.status)}</span>${patient ? `<h3>Comments / results</h3><p class="comments">${esc(a.comments || "Your care team has not added comments yet.")}</p>` : `<form id="result-form"><label>Status<select name="status"><option value="DONE" ${a.status === "DONE" ? "selected" : ""}>Done</option><option value="FOLLOW_UP" ${a.status === "FOLLOW_UP" ? "selected" : ""}>For follow up</option></select></label><label>Comments<textarea name="comments" rows="4" maxlength="4000">${esc(a.comments)}</textarea></label>${assistant ? "" : '<label>Result file <span class="muted">(PDF, PNG, JPEG, TXT · max 10 MB)</span><input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt"></label>'}<button class="primary">Save results</button></form>`}${a.fileName ? `<p><button id="download" class="secondary">Download ${esc(a.fileName)}</button></p>` : ""}`,
    );
    if (!patient)
        document.querySelector("#result-form").onsubmit = run(async (e) => {
            const f = e.target;
            const data = new FormData(f);
            const file = data.get("file");
            if (file?.size > 10 * 1024 * 1024)
                throw Error("Result file must be at most 10 MB.");
            await api(`/appointments/${id}/results`, {
                method: "POST",
                body: data,
            });
            document.querySelector("dialog").close();
            await load();
            notify("Results saved.");
        });
    if (a.fileName)
        document.querySelector("#download").onclick = run(async () => {
            const r = await fetch(`/api/appointments/${id}/file`, {
                headers: { Authorization: `Bearer ${state.token}` },
            });
            if (!r.ok) throw Error("Could not download result.");
            const url = URL.createObjectURL(await r.blob()),
                link = document.createElement("a");
            link.href = url;
            link.download = a.fileName;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
}
async function start() {
    try {
        state.catalog = await api("/catalog");
        if (state.token) {
            try {
                state.user = await api("/me");
                await load();
                return;
            } catch {
                state.token = null;
                sessionStorage.removeItem("care-token");
            }
        }
        authView();
    } catch (e) {
        app.innerHTML =
            '<div class="empty"><h2>Care Portal is unavailable</h2><p>Start the backend service, then reload this page.</p><button onclick="location.reload()">Try again</button></div>';
    }
}
start();
