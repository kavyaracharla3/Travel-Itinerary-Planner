import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// CRA/webpack breaks Leaflet's default marker image paths — point them at the bundled assets.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon, shadowUrl: markerShadow });

/* ============================================================
   API helper
   ============================================================ */
const API_BASE = '/api';

async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

/* ============================================================
   Small date / formatting helpers
   ============================================================ */
function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(startIso, endIso) {
  const ms = new Date(endIso) - new Date(startIso);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}
function weatherIcon(code) {
  if (code === 0) return '☀️';
  if ([1, 2].includes(code)) return '🌤️';
  if (code === 3) return '☁️';
  if ([45, 48].includes(code)) return '🌫️';
  if ([51, 53, 55, 56, 57].includes(code)) return '🌦️';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
  if ([95, 96, 99].includes(code)) return '⛈️';
  return '🌡️';
}
function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* ============================================================
   Toast
   ============================================================ */
function Toast({ message }) {
  return <div id="toast" className={message ? 'show' : ''}>{message}</div>;
}

/* ============================================================
   Landing page (logged-out marketing view)
   ============================================================ */
function Landing({ onStart, onLogin }) {
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('in'); });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main id="landing">
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">Trip planning, tidied up</span>
            <h1>Every journey deserves a good <em>itinerary</em>.</h1>
            <p className="lede">Map your route, track the forecast, and keep your budget honest — all in one boarding pass for your next adventure.</p>
            <div className="hero-ctas">
              <button className="btn btn-primary" onClick={onStart}>Plan a trip — it's free</button>
              <button className="btn btn-ghost" onClick={onLogin}>I already have an account</button>
            </div>
            <div className="hero-stats">
              <div><strong>2,400+</strong><span>Trips planned</span></div>
              <div><strong>190</strong><span>Countries covered</span></div>
              <div><strong>4.9★</strong><span>Traveler rating</span></div>
            </div>
          </div>
          <div className="collage" aria-hidden="true">
            <div className="polaroid p1"><img src="https://picsum.photos/id/1015/400/300" alt="" /><span>canyon, day 3</span></div>
            <div className="polaroid p2"><img src="https://picsum.photos/id/1016/400/300" alt="" /><span>lakeside</span></div>
            <div className="polaroid p3"><img src="https://picsum.photos/id/1039/400/300" alt="" /><span>the dock</span></div>
            <svg className="compass" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#C89B3C" strokeWidth="2" />
              <path d="M50 12 L58 50 L50 88 L42 50 Z" fill="#FF6B4A" />
              <circle cx="50" cy="50" r="4" fill="#122A33" />
            </svg>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <div className="section-head reveal">
            <span className="eyebrow">What's inside</span>
            <h2>Four tools, one trip.</h2>
            <p>Everything you'd otherwise juggle across five tabs and a notes app.</p>
          </div>
          <div className="feature-grid">
            <div className="feature-card reveal"><span className="icon">🗺️</span><h3>Interactive maps</h3><p>Drop a pin on your destination and see exactly where you're headed.</p></div>
            <div className="feature-card reveal"><span className="icon">⛅</span><h3>Live weather</h3><p>A day-by-day forecast for your travel dates, pulled in real time.</p></div>
            <div className="feature-card reveal"><span className="icon">🎟️</span><h3>Day-by-day itinerary</h3><p>Stack activities into a clean daily timeline, boarding-pass style.</p></div>
            <div className="feature-card reveal"><span className="icon">💰</span><h3>Budget tracker</h3><p>Log expenses by category and watch your remaining budget update live.</p></div>
          </div>
        </div>
      </section>

      <footer><div className="container">Built with Waypoint · Plan freely, wander further.</div></footer>
    </main>
  );
}

/* ============================================================
   Auth modal (login / register)
   ============================================================ */
function AuthModal({ mode, onClose, onSwitch, onAuthed }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };
      const data = await apiRequest(path, { method: 'POST', body });
      onAuthed(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        {mode === 'login' ? (
          <>
            <h2>Welcome back</h2>
            <p className="sub">Log in to see your saved trips.</p>
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={submit}>
              <div className="field"><label>Email</label><input type="email" required value={form.email} onChange={update('email')} /></div>
              <div className="field"><label>Password</label><input type="password" required value={form.password} onChange={update('password')} /></div>
              <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
            </form>
            <div className="form-switch">New here? <button onClick={() => onSwitch('register')}>Create an account</button></div>
          </>
        ) : (
          <>
            <h2>Create your account</h2>
            <p className="sub">Free — save unlimited trips.</p>
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={submit}>
              <div className="field"><label>Name</label><input type="text" required value={form.name} onChange={update('name')} /></div>
              <div className="field"><label>Email</label><input type="email" required value={form.email} onChange={update('email')} /></div>
              <div className="field"><label>Password</label><input type="password" required minLength={6} value={form.password} onChange={update('password')} /></div>
              <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
            </form>
            <div className="form-switch">Already have an account? <button onClick={() => onSwitch('login')}>Log in</button></div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Trip card (boarding-pass styled)
   ============================================================ */
function TripCard({ trip, onOpen, onDelete }) {
  const days = daysBetween(trip.startDate, trip.endDate);
  return (
    <div className="boarding-pass">
      <div className="bp-main" onClick={() => onOpen(trip.id)}>
        <img className="bp-photo" src={trip.image} alt={trip.destination} />
        <p className="bp-dest">{trip.destination}</p>
        <p className="bp-country">{trip.country || ''}</p>
        <div className="bp-meta">
          <div><strong>{formatDate(trip.startDate)}</strong>Depart</div>
          <div><strong>{formatDate(trip.endDate)}</strong>Return</div>
          <div><strong>{days}d</strong>Duration</div>
        </div>
      </div>
      <div className="bp-stub">
        <span className="rot">WAYPOINT</span>
        <button title="Delete trip" onClick={(e) => { e.stopPropagation(); onDelete(trip.id); }}>🗑</button>
      </div>
    </div>
  );
}

/* ============================================================
   My trips panel
   ============================================================ */
function TripsPanel({ trips, onOpen, onDelete }) {
  const sorted = [...trips].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  return (
    <div>
      <div className="panel-title">
        <div><h2>My trips</h2><p>Every trip you've planned, saved to your account.</p></div>
      </div>
      {sorted.length === 0 ? (
        <div className="empty-state">
          <span className="icon">🧳</span>
          <strong>No trips yet</strong>
          <p>Start your first itinerary — it only takes a minute.</p>
        </div>
      ) : (
        <div className="trip-grid">
          {sorted.map((t) => <TripCard key={t.id} trip={t} onOpen={onOpen} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   New trip form (with live city geocoding)
   ============================================================ */
function NewTripPanel({ token, onCreated, showToast }) {
  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [picked, setPicked] = useState(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef(null);

  const onDestinationChange = (e) => {
    const val = e.target.value;
    setDestination(val);
    setPicked(null);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(val.trim())}&count=5&language=en&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(data.results || []);
      } catch {
        setSuggestions([]);
      }
    }, 400);
  };

  const pickSuggestion = (r) => {
    setPicked(r);
    setDestination(r.name);
    setSuggestions([]);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!destination.trim() || !start || !end) { setError('Fill in a destination and both dates.'); return; }
    if (new Date(end) < new Date(start)) { setError("The return date needs to be after the start date."); return; }

    setBusy(true);
    try {
      let geo = picked;
      if (!geo) {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destination.trim())}&count=1&language=en&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        geo = (data.results && data.results[0]) || null;
      }
      const image = `https://picsum.photos/seed/${encodeURIComponent(geo ? geo.name : destination)}/700/500`;
      const trip = await apiRequest('/trips', {
        method: 'POST',
        token,
        body: {
          destination: geo ? geo.name : destination.trim(),
          country: geo ? geo.country : '',
          lat: geo ? geo.latitude : null,
          lon: geo ? geo.longitude : null,
          startDate: start,
          endDate: end,
          budget: budget || 0,
          image
        }
      });
      showToast('Trip created!');
      setDestination(''); setPicked(null); setStart(''); setEnd(''); setBudget('');
      onCreated(trip);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="panel-title">
        <div><h2>Plan a new trip</h2><p>Tell us where you're headed and we'll pull the map and forecast.</p></div>
      </div>
      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={submit}>
          <div className="field">
            <label>Destination city</label>
            <input placeholder="e.g. Lisbon" autoComplete="off" value={destination} onChange={onDestinationChange} required />
          </div>
          <div style={{ margin: '-8px 0 14px', fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
            {picked && `✓ Located: ${picked.name}, ${picked.country}`}
            {!picked && suggestions.length > 0 && suggestions.map((r, i) => (
              <button type="button" key={i} onClick={() => pickSuggestion(r)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '4px 0', color: 'var(--teal)', fontWeight: 600 }}>
                {r.name}{r.admin1 ? ', ' + r.admin1 : ''}, {r.country}
              </button>
            ))}
          </div>
          <div className="field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label>Start date</label><input type="date" required value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><label>End date</label><input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="field">
            <label>Total budget (USD)</label>
            <input type="number" min="0" placeholder="1500" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create itinerary'}</button>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   Leaflet map
   ============================================================ */
function MapView({ lat, lon, label }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!lat || !lon || !containerRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const map = L.map(containerRef.current).setView([lat, lon], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    L.marker([lat, lon]).addTo(map).bindPopup(label).openPopup();
    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, [lat, lon, label]);

  if (!lat || !lon) return <p style={{ padding: 16, color: 'var(--ink-soft)' }}>No coordinates for this destination.</p>;
  return <div id="map" ref={containerRef} />;
}

/* ============================================================
   Weather strip
   ============================================================ */
function WeatherStrip({ trip }) {
  const [days, setDays] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!trip.lat || !trip.lon) return;
    let cancelled = false;
    setDays(null);
    setError('');
    (async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${trip.lat}&longitude=${trip.lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${trip.startDate}&end_date=${trip.endDate}`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        if (!data.daily || !data.daily.time.length) { setError("Forecast isn't available that far out yet — check back closer to your trip."); return; }
        setDays(data.daily);
      } catch {
        if (!cancelled) setError('Could not load the forecast right now.');
      }
    })();
    return () => { cancelled = true; };
  }, [trip.lat, trip.lon, trip.startDate, trip.endDate]);

  if (!trip.lat || !trip.lon) return <p style={{ color: 'var(--ink-soft)' }}>No weather available for this destination.</p>;
  if (error) return <p style={{ color: 'var(--ink-soft)' }}>{error}</p>;
  if (!days) return <span className="spinner" />;

  return (
    <div className="weather-strip">
      {days.time.map((date, i) => (
        <div className="weather-day" key={date}>
          <div className="wd-date">{formatDate(date)}</div>
          <div className="wd-icon">{weatherIcon(days.weathercode[i])}</div>
          <div className="wd-temp">{Math.round(days.temperature_2m_max[i])}° / {Math.round(days.temperature_2m_min[i])}°</div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Itinerary panel
   ============================================================ */
function ItineraryPanel({ trip, onUpdate }) {
  const totalDays = daysBetween(trip.startDate, trip.endDate);
  const [day, setDay] = useState(1);
  const [time, setTime] = useState('09:00');
  const [title, setTitle] = useState('');

  const addActivity = async () => {
    if (!title.trim()) return;
    const itinerary = [...trip.itinerary, { id: newId(), day: Number(day), time, title: title.trim() }];
    await onUpdate({ itinerary });
    setTitle('');
  };
  const removeActivity = async (id) => {
    await onUpdate({ itinerary: trip.itinerary.filter((a) => a.id !== id) });
  };

  const blocks = [];
  for (let d = 1; d <= totalDays; d++) {
    const items = trip.itinerary.filter((a) => a.day === d).sort((a, b) => a.time.localeCompare(b.time));
    blocks.push(
      <div className="day-block" key={d}>
        <h4>Day {d} — {formatDate(addDays(trip.startDate, d - 1))}</h4>
        {items.length === 0 && <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>Nothing planned yet.</p>}
        {items.map((a) => (
          <div className="activity" key={a.id}>
            <span className="time">{a.time}</span>
            <div className="txt"><strong>{a.title}</strong></div>
            <button className="del" onClick={() => removeActivity(a.id)}>✕</button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Day-by-day plan</h3>
      {blocks}
      <div className="field" style={{ marginTop: 18 }}>
        <label>Add an activity</label>
        <div className="inline-add">
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Day {d}</option>)}
          </select>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <input type="text" placeholder="Visit the old town" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn btn-sm btn-primary" onClick={addActivity}>Add</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Budget panel
   ============================================================ */
function BudgetPanel({ trip, onUpdate }) {
  const [category, setCategory] = useState('Flights');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [showToastMsg, setShowToastMsg] = useState(null);

  const spent = trip.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const pct = trip.budget > 0 ? Math.min(100, Math.round((spent / trip.budget) * 100)) : 0;
  const byCategory = {};
  trip.expenses.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); });

  const addExpense = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setShowToastMsg('Enter an amount greater than zero.'); return; }
    const expenses = [...trip.expenses, { id: newId(), category, label: label.trim() || category, amount: amt }];
    await onUpdate({ expenses });
    setLabel(''); setAmount('');
  };
  const removeExpense = async (id) => {
    await onUpdate({ expenses: trip.expenses.filter((e) => e.id !== id) });
  };

  return (
    <div className="two-col">
      <div className="card">
        <h3>Budget overview</h3>
        <div className="budget-total"><span>Spent so far</span><strong>${spent.toLocaleString()}</strong></div>
        <div className="progress-track"><div className="progress-fill" style={{ width: pct + '%', background: pct > 100 ? 'var(--coral-dark)' : undefined }} /></div>
        <p className="budget-caption">${spent.toLocaleString()} of ${Number(trip.budget).toLocaleString()} budgeted</p>
        {Object.keys(byCategory).length === 0 ? (
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>No expenses logged yet.</p>
        ) : (
          Object.entries(byCategory).map(([cat, amt]) => (
            <div className="expense-row" key={cat}><span><span className="cat-tag">{cat}</span></span><strong>${amt.toLocaleString()}</strong></div>
          ))
        )}
      </div>
      <div className="card">
        <h3>Expenses</h3>
        {trip.expenses.length === 0 ? (
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>Nothing logged yet — add your first expense.</p>
        ) : (
          [...trip.expenses].reverse().map((e) => (
            <div className="expense-row" key={e.id}>
              <span><span className="cat-tag">{e.category}</span>{e.label}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>${Number(e.amount).toLocaleString()}</strong>
                <button className="del" onClick={() => removeExpense(e.id)}>✕</button>
              </span>
            </div>
          ))
        )}
        {showToastMsg && <div className="form-error" style={{ marginTop: 10 }}>{showToastMsg}</div>}
        <div className="inline-add-expense">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option>Flights</option><option>Stay</option><option>Food</option>
            <option>Activities</option><option>Transport</option><option>Other</option>
          </select>
          <input type="text" placeholder="Label (e.g. Hotel deposit)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input type="number" placeholder="$" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="btn btn-sm btn-primary" onClick={addExpense}>Add</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Trip detail
   ============================================================ */
function TripDetail({ trip, token, onUpdated, onDelete }) {
  const [tab, setTab] = useState('itinerary');

  const persist = useCallback(async (patch) => {
    const updated = await apiRequest(`/trips/${trip.id}`, { method: 'PUT', token, body: patch });
    onUpdated(updated);
  }, [trip.id, token, onUpdated]);

  return (
    <div>
      <div className="trip-detail-hero">
        <img src={trip.image} alt={trip.destination} />
        <div className="overlay">
          <h2>{trip.destination}{trip.country ? `, ${trip.country}` : ''}</h2>
          <span className="dates">{formatDate(trip.startDate)} → {formatDate(trip.endDate)} · {daysBetween(trip.startDate, trip.endDate)} days</span>
        </div>
      </div>

      <div className="detail-tabs">
        <button className={`dtab ${tab === 'itinerary' ? 'active' : ''}`} onClick={() => setTab('itinerary')}>Itinerary</button>
        <button className={`dtab ${tab === 'mapweather' ? 'active' : ''}`} onClick={() => setTab('mapweather')}>Map &amp; weather</button>
        <button className={`dtab ${tab === 'budget' ? 'active' : ''}`} onClick={() => setTab('budget')}>Budget</button>
        <button className="btn btn-sm btn-danger" style={{ marginLeft: 'auto' }} onClick={() => onDelete(trip.id)}>Delete trip</button>
      </div>

      {tab === 'itinerary' && <ItineraryPanel trip={trip} onUpdate={persist} />}
      {tab === 'mapweather' && (
        <div className="two-col">
          <div className="card"><h3>Where you're headed</h3><MapView lat={trip.lat} lon={trip.lon} label={trip.destination} /></div>
          <div className="card"><h3>Forecast for your dates</h3><WeatherStrip trip={trip} /></div>
        </div>
      )}
      {tab === 'budget' && <BudgetPanel trip={trip} onUpdate={persist} />}
    </div>
  );
}

/* ============================================================
   Dashboard (logged-in shell)
   ============================================================ */
function Dashboard({ user, token, onLogout, showToast }) {
  const [trips, setTrips] = useState([]);
  const [sidebarTab, setSidebarTab] = useState('trips');
  const [activeTripId, setActiveTripId] = useState(null);

  const loadTrips = useCallback(async () => {
    try {
      const data = await apiRequest('/trips', { token });
      setTrips(data);
    } catch (err) {
      showToast(err.message);
    }
  }, [token, showToast]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  const activeTrip = trips.find((t) => t.id === activeTripId) || null;

  const openTrip = (id) => { setActiveTripId(id); setSidebarTab('detail'); };

  const handleCreated = (trip) => {
    setTrips((prev) => [...prev, trip]);
    openTrip(trip.id);
  };

  const handleUpdated = (updated) => {
    setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this trip? This can't be undone.")) return;
    try {
      await apiRequest(`/trips/${id}`, { method: 'DELETE', token });
      setTrips((prev) => prev.filter((t) => t.id !== id));
      showToast('Trip deleted.');
      if (activeTripId === id) { setActiveTripId(null); setSidebarTab('trips'); }
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <div className="app-shell">
      <div className="container app-grid">
        <aside className="sidebar">
          <button className={sidebarTab === 'trips' ? 'active' : ''} onClick={() => setSidebarTab('trips')}>📋 My trips</button>
          <button className={sidebarTab === 'new' ? 'active' : ''} onClick={() => setSidebarTab('new')}>➕ New trip</button>
          {activeTrip && (
            <button className={sidebarTab === 'detail' ? 'active' : ''} onClick={() => setSidebarTab('detail')}>✈️ Trip detail</button>
          )}
          <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '10px 0' }} />
          <button onClick={onLogout}>🚪 Log out</button>
        </aside>

        <section>
          {sidebarTab === 'trips' && <TripsPanel trips={trips} onOpen={openTrip} onDelete={handleDelete} />}
          {sidebarTab === 'new' && <NewTripPanel token={token} onCreated={handleCreated} showToast={showToast} />}
          {sidebarTab === 'detail' && activeTrip && (
            <TripDetail trip={activeTrip} token={token} onUpdated={handleUpdated} onDelete={handleDelete} />
          )}
        </section>
      </div>
    </div>
  );
}

/* ============================================================
   Nav bar
   ============================================================ */
function Nav({ user, onLoginClick, onRegisterClick, onLogout }) {
  return (
    <nav className="nav">
      <div className="brand"><span className="stamp-dot">W</span> Waypoint</div>
      <div className="nav-links">
        {user ? (
          <>
            <div className="user-pill"><span className="avatar">{user.name[0].toUpperCase()}</span>{user.name.split(' ')[0]}</div>
            <button className="btn btn-ghost btn-sm" onClick={onLogout}>Log out</button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={onLoginClick}>Log in</button>
            <button className="btn btn-primary" onClick={onRegisterClick}>Get started</button>
          </>
        )}
      </div>
    </nav>
  );
}

/* ============================================================
   Root App
   ============================================================ */
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('waypoint_token'));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('waypoint_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [authMode, setAuthMode] = useState(null); // null | 'login' | 'register'
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2600);
  }, []);

  const handleAuthed = (tok, usr) => {
    localStorage.setItem('waypoint_token', tok);
    localStorage.setItem('waypoint_user', JSON.stringify(usr));
    setToken(tok);
    setUser(usr);
    setAuthMode(null);
    showToast(`Welcome${authMode === 'register' ? ' to Waypoint' : ' back'}, ${usr.name.split(' ')[0]}!`);
  };

  const handleLogout = () => {
    localStorage.removeItem('waypoint_token');
    localStorage.removeItem('waypoint_user');
    setToken(null);
    setUser(null);
  };

  return (
    <>
      <Nav
        user={user}
        onLoginClick={() => setAuthMode('login')}
        onRegisterClick={() => setAuthMode('register')}
        onLogout={handleLogout}
      />

      {user && token ? (
        <Dashboard user={user} token={token} onLogout={handleLogout} showToast={showToast} />
      ) : (
        <Landing onStart={() => setAuthMode('register')} onLogin={() => setAuthMode('login')} />
      )}

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSwitch={setAuthMode}
          onAuthed={handleAuthed}
        />
      )}

      <Toast message={toastMsg} />
    </>
  );
}
