import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Bus,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  GraduationCap,
  HeartPulse,
  LocateFixed,
  LocateIcon,
  MapPin,
  Menu,
  Search,
  Send,
  Trash2,
  Utensils,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { apiRequest, getLocalDateString } from './api.js';
import { AuthPage, RoleDashboard } from './AuthPages.jsx';

const CAMPUS_GATE = {
  name: 'University of Moratuwa Main Gate',
  lat: 6.7951,
  lng: 79.9009
};

const QUICK_LINKS = [
  { place: 'University Library', title: 'Study spaces', description: 'Find the University Library and campus study areas.', icon: BookOpen, color: 'lavender' },
  { place: 'Main Canteen', title: 'Food on campus', description: 'Locate the Main Canteen. Check locally for current hours.', icon: Utensils, color: 'peach' },
  { place: 'Medical Centre', title: 'Health services', description: 'Find campus medical services and confirm current details.', icon: HeartPulse, color: 'rose' },
  { place: 'University Bus Stop', title: 'Getting around', description: 'Locate the bus stop and verify routes and timings locally.', icon: Bus, color: 'mint' }
];

const NAV_ITEMS = [
  ['Explore', '#explore'],
  ['Directory', '#directory'],
  ['Essentials', '#essentials'],
  ['Events', '#events'],
  ['FAQs', '#faqs'],
  ['Contact', '#contact']
];

function MapViewport({ origin, destination }) {
  const map = useMap();

  useEffect(() => {
    const points = [origin, destination].map(point => [point.lat, point.lng]);
    map.fitBounds(points, { padding: [55, 55], maxZoom: 17 });
  }, [destination, map, origin]);

  useEffect(() => {
    const timeout = window.setTimeout(() => map.invalidateSize(), 100);
    return () => window.clearTimeout(timeout);
  }, [map]);

  return null;
}

function MapControlBridge({ onReady }) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  return null;
}

function MapPanel({ places, selectedPlace, onSelect, origin, onLocate, locationLoading, onResetOrigin }) {
  const [map, setMap] = useState(null);
  const [route, setRoute] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  useEffect(() => {
    if (!selectedPlace) {
      setRoute([]);
      setRouteError('');
      setRouteLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'geojson',
      steps: 'false'
    });
    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${origin.lng},${origin.lat};${selectedPlace.lng},${selectedPlace.lat}?${params}`;

    setRoute([]);
    setRouteError('');
    setRouteLoading(true);

    async function loadRoute() {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Walking route service returned HTTP ${response.status}.`);
        }

        const result = await response.json();
        const coordinates = result.routes?.[0]?.geometry?.coordinates;
        if (result.code !== 'Ok' || !Array.isArray(coordinates) || coordinates.length < 2 ||
          coordinates.some(point => !Array.isArray(point) || point.length < 2 ||
            !Number.isFinite(point[0]) || !Number.isFinite(point[1]))) {
          throw new Error('No walkable route was returned for these locations.');
        }

        setRoute(coordinates.map(([longitude, latitude]) => [latitude, longitude]));
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Walking route request failed:', error);
        setRouteError('Walking route is unavailable right now. Try again in a moment.');
      } finally {
        if (!controller.signal.aborted) {
          setRouteLoading(false);
        }
      }
    }

    loadRoute();
    return () => controller.abort();
  }, [origin.lat, origin.lng, selectedPlace]);

  return (
    <div className="map-panel">
      <div className="map-toolbar">
        <p aria-live="polite"><span className="status-dot" /> {routeError || (routeLoading ? 'Loading walking route…' : 'OpenStreetMap walking route')}</p>
        <div className="map-actions">
          <button type="button" aria-label="Zoom in" onClick={() => map?.zoomIn()}><ZoomIn size={16} /></button>
          <button type="button" aria-label="Zoom out" onClick={() => map?.zoomOut()}><ZoomOut size={16} /></button>
          <button type="button" aria-label="Recenter map" onClick={() => map?.setView([origin.lat, origin.lng], 16)}><LocateFixed size={16} /></button>
        </div>
      </div>
      <MapContainer
        center={[CAMPUS_GATE.lat, CAMPUS_GATE.lng]}
        zoom={16}
        scrollWheelZoom
        className="campus-map"
        ref={setMap}
      >
        <MapControlBridge onReady={setMap} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport
          origin={origin}
          destination={selectedPlace || CAMPUS_GATE}
        />
        <CircleMarker center={[CAMPUS_GATE.lat, CAMPUS_GATE.lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#111827', fillOpacity: 1 }}>
          <Tooltip>{CAMPUS_GATE.name}</Tooltip>
        </CircleMarker>
        {origin.name === 'your location' && (
          <CircleMarker center={[origin.lat, origin.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#10b981', fillOpacity: 1 }}>
            <Tooltip>Your location</Tooltip>
          </CircleMarker>
        )}
        {places.map(place => (
          <CircleMarker
            key={place.id}
            center={[place.lat, place.lng]}
            radius={place.id === selectedPlace?.id ? 10 : 7}
            pathOptions={{
              color: '#fff',
              weight: 3,
              fillColor: place.id === selectedPlace?.id ? '#5e5ce6' : '#718096',
              fillOpacity: 1
            }}
            eventHandlers={{ click: () => onSelect(place) }}
          >
            <Tooltip>{place.name}</Tooltip>
          </CircleMarker>
        ))}
        {route.length > 0 && <Polyline positions={route} pathOptions={{ color: '#5e5ce6', weight: 5, opacity: 0.85 }} />}
      </MapContainer>
      <div className="map-legend">
        <span><i className="legend-gate" /> Main Gate</span>
        <span><i className="legend-place" /> Campus place</span>
      </div>
      <button className="locate-button" type="button" onClick={onLocate} disabled={locationLoading}>
        <LocateIcon size={16} /> {locationLoading ? 'Finding you…' : 'Use my location'}
      </button>
      {origin.name === 'your location' && <button className="reset-origin" type="button" onClick={onResetOrigin}>Reset origin</button>}
    </div>
  );
}

function EventCard({ event, onRemove }) {
  const date = new Date(`${event.date}T00:00:00`);
  const time = event.time ? new Date(`1970-01-01T${event.time}`) : null;

  return (
    <article className="event-card">
      <div className="event-date">
        <span>{date.toLocaleDateString(undefined, { month: 'short' })}</span>
        <strong>{date.toLocaleDateString(undefined, { day: 'numeric' })}</strong>
      </div>
      <div className="event-content">
        <h3>{event.title}</h3>
        <p className="event-meta">{date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · {time ? time.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'Time TBA'}</p>
        <p className="event-venue"><MapPin size={14} /> {event.venue || 'Location TBA'}</p>
        {event.description && <p className="event-description">{event.description}</p>}
      </div>
      {onRemove && <button className="icon-button delete-button" type="button" onClick={() => onRemove(event)} aria-label={`Remove ${event.title}`}><Trash2 size={17} /></button>}
    </article>
  );
}

export default function App() {
  const [places, setPlaces] = useState([]);
  const [events, setEvents] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [origin, setOrigin] = useState(CAMPUS_GATE);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authPage, setAuthPage] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [placeData, eventData, faqData] = await Promise.all([
        apiRequest('/api/places'),
        apiRequest('/api/events'),
        apiRequest('/api/faqs')
      ]);
      setPlaces(placeData);
      setEvents(eventData);
      setFaqs(faqData);
      setSelectedPlace(current => placeData.find(place => place.id === current?.id) || placeData.find(place => place.name === 'University Library') || placeData[0] || null);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let active = true;
    apiRequest('/api/auth/me')
      .then(user => { if (active) setAuthUser(user); })
      .catch(error => {
        if (!active || error.status === 401) return;
        setNotice(error.message);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const categories = useMemo(() => ['all', ...new Set(places.map(place => place.category).sort())], [places]);
  const visiblePlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return places.filter(place =>
      (category === 'all' || place.category === category) &&
      (!normalizedQuery || `${place.name} ${place.category} ${place.description}`.toLowerCase().includes(normalizedQuery))
    );
  }, [category, places, query]);
  const upcomingEvents = useMemo(() => events
    .filter(event => event.date >= getLocalDateString())
    .sort((first, second) => `${first.date}T${first.time}`.localeCompare(`${second.date}T${second.time}`)), [events]);
  const distanceKm = selectedPlace ? getDistanceKm(origin, selectedPlace) : 0;
  const walkingMinutes = Math.max(1, Math.round(distanceKm / 4.5 * 60));

  function choosePlace(place) {
    setSelectedPlace(place);
    document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleAuthSubmit(fields) {
    setAuthBusy(true);
    setAuthError('');
    try {
      const path = authPage === 'register' ? '/api/auth/register' : '/api/auth/login';
      const user = await apiRequest(path, { method: 'POST', body: JSON.stringify(fields) });
      setAuthUser(user);
      setAuthPage('dashboard');
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
      setAuthUser(null);
      setAuthPage(null);
      setNotice('You have logged out.');
    } catch (error) {
      setNotice(error.message);
    }
  }

  function handleLocate() {
    if (!navigator.geolocation) {
      setNotice('Location is not supported by this browser.');
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(position => {
      setOrigin({
        name: 'your location',
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
      setLocationLoading(false);
      setNotice('Your location is shown. Distances are straight-line estimates.');
    }, error => {
      setLocationLoading(false);
      setNotice(error.code === error.PERMISSION_DENIED
        ? 'Location permission was denied. You can explore from the Main Gate.'
        : 'Could not get your location. You can explore from the Main Gate.');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  async function handleContactSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setContactSubmitting(true);
    try {
      const response = await apiRequest('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name: String(formData.get('name') || '').trim(),
          email: String(formData.get('email') || '').trim(),
          subject: String(formData.get('subject') || '').trim(),
          message: String(formData.get('message') || '').trim()
        })
      });
      form.reset();
      setNotice(response?.message || 'Your message has been received.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setContactSubmitting(false);
    }
  }

  if (authPage === 'login' || authPage === 'register') {
    return (
      <AuthPage
        mode={authPage}
        onModeChange={mode => setAuthPage(mode === 'home' ? null : mode)}
        onSubmit={handleAuthSubmit}
        busy={authBusy}
        error={authError}
      />
    );
  }

  if (authPage === 'dashboard') {
    if (!authUser) {
      return <AuthPage mode="login" onModeChange={mode => setAuthPage(mode === 'home' ? null : mode)} onSubmit={handleAuthSubmit} busy={authBusy} error={authError || 'Please log in to open your dashboard.'} />;
    }
    return <RoleDashboard user={authUser} onLogout={handleLogout} onUserChange={setAuthUser} onHome={() => setAuthPage(null)} />;
  }

  return (
    <div className="min-h-screen">
      <header className="site-header">
        <div className="nav-shell">
          <a className="brand" href="#home" aria-label="MoraGuide home">
            <img className="brand-logo" src="/moraguide-icon.svg" alt="" /><span>MoraGuide</span>
          </a>
          <nav className={`desktop-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
            {NAV_ITEMS.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
            {!authUser && <button type="button" className="auth-nav-link" onClick={() => { setAuthPage('register'); setMenuOpen(false); }}>Sign up</button>}
          </nav>
          <button className="nav-cta" type="button" onClick={() => setAuthPage(authUser ? 'dashboard' : 'login')}>
            {authUser ? 'Dashboard' : 'Log in'} <ArrowRight size={15} />
          </button>
          <button className="mobile-menu-button" type="button" onClick={() => setMenuOpen(open => !open)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      <main>
        <section id="home" className="hero-section">
          <div className="hero-inner">
            <div className="hero-copy">
              <span className="eyebrow eyebrow-dark"><span className="eyebrow-spark" /> YOUR CAMPUS, MADE SIMPLE</span>
              <h1>Find your place<br />at <span>Moratuwa.</span></h1>
              <p>Explore campus landmarks, find the essentials, and see what’s happening—all in one guide.</p>
              <div className="hero-actions">
                <a className="button button-primary" href="#explore">Explore the campus <ArrowRight size={17} /></a>
                <a className="button button-quiet" href="#events"><CalendarDays size={17} /> Upcoming events</a>
              </div>
              <div className="hero-trust">
                <span><GraduationCap size={16} /> Made for students</span>
                <span><MapPin size={15} /> University of Moratuwa</span>
                <span><Check size={15} /> Free to explore</span>
              </div>
            </div>
            <div className="hero-card">
              <div className="hero-card-top"><span className="live-dot" /> CAMPUS SPOTLIGHT</div>
              <div className="hero-orbit">
                <span className="orbit-ring orbit-ring-one" />
                <span className="orbit-ring orbit-ring-two" />
                <span className="orbit-pin"><MapPin size={30} fill="currentColor" /></span>
                <span className="orbit-dot orbit-dot-one" />
                <span className="orbit-dot orbit-dot-two" />
              </div>
              <div className="hero-card-caption"><span>START YOUR JOURNEY</span><strong>University of Moratuwa</strong><small>Katubedda, Sri Lanka</small></div>
              <a href="#directory" className="hero-card-link">Browse campus places <ArrowRight size={15} /></a>
            </div>
          </div>
          <a className="scroll-cue" href="#explore"><ArrowDown size={16} /> SCROLL TO EXPLORE</a>
        </section>

        <section id="explore" className="section-wrap explore-section">
          <div className="section-heading">
            <div><span className="eyebrow">THE CAMPUS, AT A GLANCE</span><h2>Explore the map</h2><p>Select a landmark to see details and walking directions.</p></div>
            <span className="map-note"><span className="status-dot" /> OpenStreetMap powered</span>
          </div>
          {loadError && <div className="alert alert-error" role="alert">{loadError} <button type="button" onClick={loadData}>Try again</button></div>}
          {loading && <div className="loading-bar"><span /></div>}
          <div className="explore-grid">
            <MapPanel
              places={visiblePlaces}
              selectedPlace={selectedPlace}
              onSelect={setSelectedPlace}
              origin={origin}
              onLocate={handleLocate}
              locationLoading={locationLoading}
              onResetOrigin={() => setOrigin(CAMPUS_GATE)}
            />
            <aside className="place-detail-card">
              {selectedPlace ? (
                <>
                  <div className="detail-topline"><span className="detail-kicker">SELECTED PLACE</span><span className="category-chip">{selectedPlace.category}</span></div>
                  <h3>{selectedPlace.name}</h3>
                  <p className="detail-description">{selectedPlace.description || 'Campus location.'}</p>
                  <div className="distance-box">
                    <div><span>Approx. distance from {origin.name === 'your location' ? 'you' : 'Main Gate'}</span><strong>{distanceKm.toFixed(2)} km</strong></div>
                    <div><span>Estimated walk time</span><strong>~{walkingMinutes} mins</strong></div>
                  </div>
                  <a
                    className="button button-primary directions-link"
                    href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${encodeURIComponent(`${origin.lat},${origin.lng};${selectedPlace.lat},${selectedPlace.lng}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  ><LocateFixed size={16} /> Get walking directions</a>
                  <p className="fine-print">The map route follows walkable roads and paths from OpenStreetMap. Distance and time are estimates; check local access and conditions.</p>
                  <div className="detail-divider" />
                  <span className="detail-kicker">QUICK PICK</span>
                  <div className="quick-picks">
                    {places.slice(0, 5).map(place => (
                      <button key={place.id} type="button" className={place.id === selectedPlace.id ? 'quick-pick active' : 'quick-pick'} onClick={() => setSelectedPlace(place)}>
                        <span>{place.name}</span><ArrowRight size={14} />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state"><MapPin size={25} /><h3>{loading ? 'Loading campus places…' : 'Campus places unavailable'}</h3><p>Connect to the MoraGuide server to load the place directory.</p></div>
              )}
            </aside>
          </div>
        </section>

        <section id="directory" className="section-wrap directory-section">
          <div className="section-heading">
            <div><span className="eyebrow">FIND WHAT YOU NEED</span><h2>Campus directory</h2><p>Search landmarks, services, faculties, and facilities.</p></div>
            <span className="count-pill">{visiblePlaces.length} places</span>
          </div>
          <div className="directory-controls">
            <label className="search-field"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search campus places…" aria-label="Search campus places" /></label>
            <label className="category-field"><span className="sr-only">Filter by category</span><select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item} value={item}>{item === 'all' ? 'All categories' : item}</option>)}</select><ChevronDown size={16} /></label>
          </div>
          {visiblePlaces.length ? (
            <div className="place-grid">
              {visiblePlaces.map((place, index) => (
                <button key={place.id} className="place-card" type="button" onClick={() => choosePlace(place)}>
                  <span className={`place-index index-${index % 4}`}>{String(index + 1).padStart(2, '0')}</span>
                  <span className="place-card-content"><span className="place-category">{place.category}</span><strong>{place.name}</strong><span>{place.description}</span></span>
                  <ArrowRight className="place-card-arrow" size={17} />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state directory-empty"><Search size={24} /><h3>{loading ? 'Loading directory…' : 'No places found'}</h3><p>Try a different search or category.</p></div>
          )}
        </section>

        <section id="essentials" className="essentials-section">
          <div className="section-wrap">
            <div className="section-heading">
              <div><span className="eyebrow">A GOOD PLACE TO START</span><h2>Student essentials</h2><p>Handy shortcuts for your everyday campus life.</p></div>
              <a className="text-link" href="#directory">View full directory <ArrowRight size={15} /></a>
            </div>
            <div className="essentials-grid">
              {QUICK_LINKS.map(({ place, title, description, icon: Icon, color }) => (
                <button className="essential-card" type="button" key={place} onClick={() => {
                  const target = places.find(item => item.name === place);
                  if (target) choosePlace(target);
                  else setNotice(`Could not find ${place} in the campus directory.`);
                }}>
                  <span className={`essential-icon ${color}`}><Icon size={21} /></span>
                  <strong>{title}</strong><span>{description}</span>
                  <span className="essential-link">Show on map <ArrowRight size={14} /></span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="events" className="section-wrap events-section">
          <div className="section-heading">
            <div><span className="eyebrow">CAMPUS CALENDAR</span><h2>Upcoming events</h2><p>See what’s happening around campus.</p></div>
            <span className="count-pill"><CalendarDays size={14} /> {upcomingEvents.length} upcoming</span>
          </div>
          <div className="public-events">
            {upcomingEvents.length ? upcomingEvents.map(event => <EventCard key={event.id} event={event} />) : (
              <div className="empty-state events-empty"><CalendarDays size={25} /><h3>{loadError ? 'Events unavailable' : 'No upcoming events yet'}</h3><p>{loadError ? 'Start the backend server and refresh to load shared events.' : 'Event organizers can publish new events after signing in.'}</p></div>
            )}
          </div>
          <button className="text-link organizer-signin" type="button" onClick={() => setAuthPage(authUser ? 'dashboard' : 'login')}>
            {authUser?.role === 'organizer' ? 'Manage your events' : authUser ? 'Open your dashboard' : 'Event organizer? Sign in to manage events'} <ArrowRight size={15} />
          </button>
        </section>

        <section id="faqs" className="faq-section">
          <div className="section-wrap faq-layout">
            <div className="faq-intro"><span className="eyebrow">NEED A HAND?</span><h2>Frequently asked questions</h2><p>Quick answers to common questions about finding your way around campus.</p><CircleHelp size={42} strokeWidth={1.3} /></div>
            <div className="faq-list">
              {faqs.length ? faqs.map(faq => <details className="faq-item" key={faq.id}><summary>{faq.question}<ChevronDown size={18} /></summary><p>{faq.answer}</p></details>) : <div className="empty-state"><CircleHelp size={24} /><p>{loading ? 'Loading FAQs…' : 'No FAQs have been added yet.'}</p></div>}
            </div>
          </div>
        </section>

        <section id="contact" className="section-wrap contact-section">
          <div className="contact-copy"><span className="eyebrow">WE’RE LISTENING</span><h2>Help us make campus easier to explore.</h2><p>Send a question or suggestion to the MoraGuide team.</p><div className="contact-note"><Clock3 size={17} /> Your message goes to the site administrator.</div></div>
          <form className="contact-form form-card" onSubmit={handleContactSubmit}>
            <div className="form-row"><label>Your name<input name="name" type="text" maxLength="100" required placeholder="Full name" /></label><label>Email address<input name="email" type="email" maxLength="150" required placeholder="you@example.com" /></label></div>
            <label>Subject <span className="optional">(optional)</span><input name="subject" type="text" maxLength="200" placeholder="What is this about?" /></label>
            <label>Message<textarea name="message" rows="4" maxLength="5000" required placeholder="Write your message…" /></label>
            <button className="button button-primary submit-button" type="submit" disabled={contactSubmitting}><Send size={16} /> {contactSubmitting ? 'Sending…' : 'Send message'}</button>
          </form>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand"><a className="brand" href="#home" aria-label="MoraGuide home"><img className="brand-logo" src="/moraguide-icon.svg" alt="" /><span>MoraGuide</span></a><p>A simpler way to find your way around the University of Moratuwa.</p></div>
          <div className="footer-links"><strong>EXPLORE</strong><a href="#explore">Campus map</a><a href="#directory">Places directory</a><a href="#events">Upcoming events</a></div>
          <div className="footer-links"><strong>STUDENT LIFE</strong><a href="#essentials">Student essentials</a><a href="#faqs">FAQs</a><a href="#contact">Contact us</a></div>
          <div className="footer-callout"><span>YOUR CAMPUS IS WAITING</span><a href="#explore">Let’s explore <ArrowRight size={16} /></a></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} MoraGuide · University of Moratuwa Campus Guide</span><span>Map data © OpenStreetMap contributors</span></div>
      </footer>

      {notice && <div className="toast" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16} /></button></div>}
    </div>
  );
}

function getDistanceKm(from, to) {
  const radians = value => value * Math.PI / 180;
  const latDelta = radians(to.lat - from.lat);
  const lngDelta = radians(to.lng - from.lng);
  const a = Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) *
    Math.sin(lngDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
