// app.jsx - the React frontend.
// React idea: the screen is a function of "state". When state changes, React redraws for us.
// We never touch the database here; we only call the backend API with fetch().

import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

// When index.html is double-clicked (file://) the page is not served by Flask,
// so we point the API calls at the Flask server directly.
const API_BASE = location.protocol === "file:" ? "http://localhost:5000" : "";

const STATUSES = ["Pending", "In Progress", "Completed"];
const cssClass = (status) => status.replace(" ", "");   // "In Progress" -> "InProgress" (for CSS)

// ---------- API helper: one small function for all server calls ----------
async function api(url, method = "GET", body) {
  let res;
  try {
    res = await fetch(API_BASE + url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    // fetch itself failed = the server is not running / not reachable
    throw { errors: {}, server_down: true };
  }
  const data = await res.json();
  if (!res.ok) throw data;          // the server's {errors: {...}} becomes a thrown error
  return data;
}

// Small banner shown when the Python server is not running
function ServerDown() {
  return (
    <div className="empty">
      Cannot reach the server.<br />
      Start it with <b>python app.py</b> (inside the backend folder), then refresh this page.
    </div>
  );
}

// Close a pop-up when the Escape key is pressed (same as the original demo)
function useEscapeKey(onClose) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);   // cleanup when pop-up closes
  }, []);
}

// ---------- Client pop-up form (add + edit) ----------
function ClientModal({ client, onClose, onSaved }) {
  useEscapeKey(onClose);
  const [form, setForm] = useState({
    name: client?.name || "", email: client?.email || "",
    phone: client?.phone || "", company: client?.company || "",
  });
  const [errors, setErrors] = useState({});

  const change = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function save() {
    try {
      if (client) await api(`/api/clients/${client.id}`, "PUT", form);
      else await api("/api/clients", "POST", form);
      onSaved(client ? "Client updated" : "Client added");
    } catch (err) {
      setErrors(err.server_down ? { general: "Cannot reach the server. Is python app.py running?" } : err.errors || {});
    }
  }

  return (
    <div className="modal open">
      <div className="dlg" role="dialog" aria-modal="true">
        <h2>{client ? "Edit client" : "Add client"}</h2>

        <label htmlFor="cn">Name *</label>
        <input id="cn" maxLength="60" autoFocus value={form.name} onChange={change("name")}
               className={errors.name ? "bad" : ""} />
        <div className="err">{errors.name}</div>

        <label htmlFor="ce">Email *</label>
        <input id="ce" type="text" inputMode="email" value={form.email} onChange={change("email")}
               className={errors.email ? "bad" : ""} />
        <div className="err">{errors.email}</div>

        <label htmlFor="cp">Phone</label>
        <input id="cp" inputMode="tel" placeholder="+880 1700 000000" value={form.phone}
               onChange={change("phone")} className={errors.phone ? "bad" : ""} />
        <div className="err">{errors.phone}</div>

        <label htmlFor="cc">Company</label>
        <input id="cc" maxLength="60" value={form.company} onChange={change("company")} />

        <div className="err">{errors.general}</div>
        <div className="actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>Save client</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Activity pop-up form (add + edit) ----------
function ActivityModal({ clientId, activity, onClose, onSaved }) {
  useEscapeKey(onClose);
  const [form, setForm] = useState({
    title: activity?.title || "", description: activity?.description || "",
    status: activity?.status || "Pending", due_date: activity?.due_date || "",
  });
  const [errors, setErrors] = useState({});

  const change = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function save() {
    try {
      if (activity) await api(`/api/activities/${activity.id}`, "PUT", form);
      else await api(`/api/clients/${clientId}/activities`, "POST", form);
      onSaved(activity ? "Activity updated" : "Activity added");
    } catch (err) {
      setErrors(err.server_down ? { general: "Cannot reach the server. Is python app.py running?" } : err.errors || {});
    }
  }

  return (
    <div className="modal open">
      <div className="dlg" role="dialog" aria-modal="true">
        <h2>{activity ? "Edit activity" : "Add activity"}</h2>

        <label htmlFor="at">Title *</label>
        <input id="at" maxLength="80" autoFocus value={form.title} onChange={change("title")}
               className={errors.title ? "bad" : ""} />
        <div className="err">{errors.title}</div>

        <label htmlFor="ad">Description</label>
        <textarea id="ad" rows="3" maxLength="300" value={form.description} onChange={change("description")} />

        <label htmlFor="as">Status</label>
        <select id="as" value={form.status} onChange={change("status")}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>

        <label htmlFor="ae">Due date</label>
        <input id="ae" type="date" value={form.due_date} onChange={change("due_date")} />
        <div className="err">{errors.due_date}</div>

        <div className="err">{errors.general}</div>
        <div className="actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>Save activity</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Page 1: list of clients ----------
function ClientList({ onOpen, showToast }) {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [down, setDown] = useState(false);

  // Runs on first load AND every time `search` changes
  function loadClients() {
    api("/api/clients?q=" + encodeURIComponent(search))
      .then((data) => { setClients(data); setLoaded(true); setDown(false); })
      .catch(() => setDown(true));
  }
  useEffect(loadClients, [search]);

  if (down) return <ServerDown />;

  return (
    <div>
      <div className="bar">
        <input placeholder="Search clients" aria-label="Search clients" value={search}
               onChange={(e) => setSearch(e.target.value)} />
        <button className="primary" onClick={() => setShowForm(true)}>Add client</button>
      </div>

      {loaded && clients.length === 0 && (
        <div className="empty">
          {search ? "No clients match your search." : "No clients yet. Add your first client to get started."}
        </div>
      )}

      <div className="grid">
        {clients.map((c) => (
          <div className="card click" key={c.id} onClick={() => onOpen(c.id)}>
            <div className="row"><h3>{c.name}</h3></div>
            <div className="muted">{c.company || "No company"}</div>
            <div className="muted">{c.email}</div>
            <div className="stats">
              <span className="badge Pending">{c.pending} pending</span>
              <span className="badge InProgress">{c.in_progress} in progress</span>
              <span className="badge Completed">{c.completed} done</span>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <ClientModal
          onClose={() => setShowForm(false)}
          onSaved={(msg) => { setShowForm(false); loadClients(); showToast(msg); }}
        />
      )}
    </div>
  );
}

// ---------- Page 2: one client + their activities ----------
function ClientDetail({ clientId, onBack, showToast }) {
  const [client, setClient] = useState(null);
  const [activities, setActivities] = useState([]);
  const [filter, setFilter] = useState("All");
  const [editingClient, setEditingClient] = useState(false);
  const [activityForm, setActivityForm] = useState(null);   // null = closed, {} = add, {...} = edit
  const [notFound, setNotFound] = useState(false);
  const [down, setDown] = useState(false);

  function loadAll() {
    api(`/api/clients/${clientId}`)
      .then(setClient)
      .catch((err) => (err.server_down ? setDown(true) : setNotFound(true)));
    api(`/api/clients/${clientId}/activities?status=${encodeURIComponent(filter)}`)
      .then(setActivities)
      .catch(() => {});
  }
  useEffect(loadAll, [clientId, filter]);

  async function deleteClient() {
    if (!confirm(`Delete "${client.name}" and all of their activities?`)) return;
    await api(`/api/clients/${clientId}`, "DELETE");
    showToast("Client deleted");
    onBack();
  }

  async function changeStatus(id, status) {
    await api(`/api/activities/${id}/status`, "PATCH", { status });
    loadAll();
    showToast("Status updated");
  }

  async function deleteActivity(id) {
    if (!confirm("Delete this activity?")) return;
    await api(`/api/activities/${id}`, "DELETE");
    loadAll();
    showToast("Activity deleted");
  }

  if (down) return <ServerDown />;
  if (notFound) {
    return (
      <div className="empty">
        Client not found. It may have been deleted.<br /><br />
        <button className="primary" onClick={onBack}>Back to clients</button>
      </div>
    );
  }
  if (!client) return null;

  return (
    <div>
      <button className="link" onClick={onBack}>&larr; All clients</button>

      <div className="card" style={{ margin: "8px 0 16px" }}>
        <div className="row">
          <div>
            <h3>{client.name}</h3>
            <div className="muted">{client.company || "No company"}</div>
            <div className="muted">{client.email}{client.phone ? " · " + client.phone : ""}</div>
          </div>
          <div>
            <button onClick={() => setEditingClient(true)}>Edit</button>{" "}
            <button className="danger" onClick={deleteClient}>Delete</button>
          </div>
        </div>
      </div>

      <div className="bar">
        <select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {["All", ...STATUSES].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="primary" onClick={() => setActivityForm({})}>Add activity</button>
      </div>

      {activities.length === 0 && (
        <div className="empty">
          {filter === "All"
            ? "No activities yet. Add one to start tracking work for this client."
            : "No activities with this status."}
        </div>
      )}

      {activities.map((a) => (
        <div className={"act " + cssClass(a.status)} key={a.id}>
          <div className="row">
            <span className="t">{a.title}</span>
            <span className={"badge " + cssClass(a.status)}>{a.status}</span>
          </div>
          {a.description && <div className="muted">{a.description}</div>}
          <div className="row" style={{ marginTop: 8 }}>
            <span className="muted">{a.due_date ? "Due " + a.due_date : "No due date"}</span>
            <span>
              <select aria-label="Change status" value={a.status}
                      onChange={(e) => changeStatus(a.id, e.target.value)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>{" "}
              <button className="link" onClick={() => setActivityForm(a)}>Edit</button>
              <button className="link danger" onClick={() => deleteActivity(a.id)}>Delete</button>
            </span>
          </div>
        </div>
      ))}

      {editingClient && (
        <ClientModal
          client={client}
          onClose={() => setEditingClient(false)}
          onSaved={(msg) => { setEditingClient(false); loadAll(); showToast(msg); }}
        />
      )}
      {activityForm && (
        <ActivityModal
          clientId={clientId}
          activity={activityForm.id ? activityForm : null}
          onClose={() => setActivityForm(null)}
          onSaved={(msg) => { setActivityForm(null); loadAll(); showToast(msg); }}
        />
      )}
    </div>
  );
}

// ---------- Main App: header, theme button, and which page to show ----------
function App() {
  const [clientId, setClientId] = useState(null);   // null = list page, number = detail page
  const [toast, setToast] = useState("");

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(""), 2200);
  }

  function toggleTheme() {
    const root = document.documentElement;
    const isDark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = isDark ? "light" : "dark";
  }

  return (
    <div className="wrap">
      <header>
        <h1 onClick={() => setClientId(null)}>Client Activity Manager</h1>
        <button aria-label="Toggle theme" onClick={toggleTheme}>Theme</button>
      </header>

      {clientId === null
        ? <ClientList onOpen={setClientId} showToast={showToast} />
        : <ClientDetail clientId={clientId} onBack={() => setClientId(null)} showToast={showToast} />}

      {toast && <div id="toast" role="status" style={{ display: "block" }}>{toast}</div>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
