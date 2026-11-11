import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, LogOut, MapPin, Save, Star, Trash2, Users } from 'lucide-react';
import { apiRequest, getApiUrl, getLocalDateString } from './api.js';

export function AuthPage({ mode, onModeChange, onSubmit, busy, error }) {
  const [role, setRole] = useState('student');

  function submit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit(Object.fromEntries(formData.entries()));
  }

  return (
    <main className="auth-page">
      <a className="auth-back" href="/" onClick={event => { event.preventDefault(); onModeChange('home'); }}><ArrowLeft size={16} /> Back to MoraGuide</a>
      <section className="auth-card">
        <img className="brand-logo auth-logo" src="/moraguide-icon.svg" alt="" />
        <span className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'JOIN MORAGUIDE'}</span>
        <h1>{mode === 'login' ? 'Log in to your account' : 'Create your account'}</h1>
        <p>{mode === 'login' ? 'Continue to your role-based campus page.' : 'Choose a student or event organizer account.'}</p>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <>
              <div className="form-row">
                <label>First name<input name="firstName" required maxLength="50" autoComplete="given-name" /></label>
                <label>Last name<input name="lastName" required maxLength="50" autoComplete="family-name" /></label>
              </div>
              <label>Account type
                <select name="role" value={role} onChange={event => setRole(event.target.value)}>
                  <option value="student">Student</option>
                  <option value="organizer">Event organizer</option>
                </select>
              </label>
              {role === 'student' ? (
                <>
                  <label>Student registration number<input name="registrationNumber" required maxLength="30" /></label>
                  <div className="form-row">
                    <label>Faculty <span className="optional">(optional)</span><input name="faculty" maxLength="100" /></label>
                    <label>Department <span className="optional">(optional)</span><input name="department" maxLength="100" /></label>
                  </div>
                </>
              ) : (
                <>
                  <label>Organization <span className="optional">(optional)</span><input name="organizationName" maxLength="150" /></label>
                  <label>Designation <span className="optional">(optional)</span><input name="designation" maxLength="100" /></label>
                </>
              )}
            </>
          )}
          <label>Email address<input name="email" type="email" required maxLength="100" autoComplete="email" /></label>
          <label>Password<input name="password" type="password" required minLength="8" maxLength="72" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary submit-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        <p className="auth-switch">
          {mode === 'login' ? 'New to MoraGuide?' : 'Already have an account?'}
          <button type="button" onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </button>
        </p>
      </section>
    </main>
  );
}

function ProfileEditor({ user, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl('');
      return undefined;
    }

    const url = URL.createObjectURL(selectedImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  async function saveProfile(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true);
    setError('');
    try {
      if (selectedImage) {
        const updatedWithImage = await apiRequest('/api/auth/profile/image', {
          method: 'PUT',
          body: selectedImage,
          headers: { 'Content-Type': selectedImage.type }
        });
        onSaved(updatedWithImage);
        setSelectedImage(null);
      }
      const updatedProfile = await apiRequest('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(fields) });
      onSaved(updatedProfile);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function selectImage(event) {
    const image = event.target.files?.[0] || null;
    setError('');
    if (image && !['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
      setSelectedImage(null);
      setError('Choose a JPEG, PNG, or WebP image.');
      event.target.value = '';
      return;
    }
    if (image && image.size > 2 * 1024 * 1024) {
      setSelectedImage(null);
      setError('Profile images must be 2 MB or smaller.');
      event.target.value = '';
      return;
    }
    setSelectedImage(image);
  }

  async function removeImage() {
    if (selectedImage) {
      setSelectedImage(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      onSaved(await apiRequest('/api/auth/profile/image', { method: 'DELETE' }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="dashboard-card profile-form" onSubmit={saveProfile}>
      <div className="dashboard-card-heading"><div><span className="eyebrow">YOUR DETAILS</span><h2>Profile</h2></div></div>
      <div className="profile-image-row">
        {previewUrl || user.profileImage
          ? <img className="profile-image-preview" src={getApiUrl(previewUrl || user.profileImage)} crossOrigin="use-credentials" alt="Profile preview" />
          : <span className="profile-image-preview profile-image-placeholder">{user.firstName.slice(0, 1).toUpperCase()}</span>}
        <div className="profile-image-controls">
          <label>Profile image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectImage} /></label>
          <small>JPEG, PNG, or WebP · up to 2 MB. Select a photo, then save your profile.</small>
          <div className="dashboard-actions">
            {(selectedImage || user.profileImage) && <button className="dashboard-action is-danger" type="button" onClick={removeImage} disabled={busy}>{selectedImage ? 'Clear selection' : 'Remove image'}</button>}
          </div>
        </div>
      </div>
      <div className="form-row">
        <label>First name<input name="firstName" defaultValue={user.firstName} maxLength="50" required /></label>
        <label>Last name<input name="lastName" defaultValue={user.lastName} maxLength="50" required /></label>
      </div>
      <label>Email address<input value={user.email} readOnly /></label>
      <label>Phone <span className="optional">(optional)</span><input name="phone" defaultValue={user.phone || ''} maxLength="15" /></label>
      {user.role === 'student' ? (
        <>
          <label>Registration number<input name="registrationNumber" defaultValue={user.registrationNumber || ''} maxLength="30" required /></label>
          <div className="form-row">
            <label>Faculty<input name="faculty" defaultValue={user.faculty || ''} maxLength="100" /></label>
            <label>Department<input name="department" defaultValue={user.department || ''} maxLength="100" /></label>
          </div>
        </>
      ) : user.role === 'organizer' ? (
        <>
          <label>Organization<input name="organizationName" defaultValue={user.organizationName || ''} maxLength="150" /></label>
          <label>Designation<input name="designation" defaultValue={user.designation || ''} maxLength="100" /></label>
        </>
      ) : null}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary submit-button" type="submit" disabled={busy}><Save size={15} /> {busy ? 'Saving…' : 'Save profile'}</button>
    </form>
  );
}

function EventForm({ event, onSave, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(eventObject) {
    eventObject.preventDefault();
    const fields = Object.fromEntries(new FormData(eventObject.currentTarget).entries());
    setBusy(true);
    setError('');
    try {
      await onSave(fields);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="dashboard-card event-editor" onSubmit={submit}>
      <div className="dashboard-card-heading"><div><span className="eyebrow">{event ? 'UPDATE DETAILS' : 'PUBLISH ON CAMPUS'}</span><h2>{event ? 'Edit event' : 'Create an event'}</h2></div></div>
      <label>Event name<input name="title" defaultValue={event?.title || ''} maxLength="200" required /></label>
      <div className="form-row">
        <label>Date<input name="date" type="date" defaultValue={event?.date || ''} min={getLocalDateString()} required /></label>
        <label>Time<input name="time" type="time" defaultValue={event?.time || ''} required /></label>
      </div>
      <label>Location<input name="venue" defaultValue={event?.venue || ''} maxLength="200" required /></label>
      <label>Description<textarea name="description" rows="3" defaultValue={event?.description || ''} maxLength="5000" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dashboard-actions">
        <button className="button button-primary" type="submit" disabled={busy}><Save size={15} /> {busy ? 'Saving…' : event ? 'Save changes' : 'Publish event'}</button>
        {event && <button className="button button-quiet-light" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function DashboardEvent({ event, children }) {
  const date = event.date ? new Date(`${event.date}T00:00:00`) : null;
  return (
    <article className="dashboard-event">
      <div className="dashboard-event-icon"><CalendarDays size={18} /></div>
      <div className="dashboard-event-main">
        <h3>{event.title}</h3>
        <p>{date?.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {event.time || 'Time TBA'} · {event.venue || 'Location TBA'}</p>
        {event.description && <p className="dashboard-event-description">{event.description}</p>}
        {children}
      </div>
    </article>
  );
}

export function RoleDashboard({ user, onLogout, onUserChange, onHome }) {
  const [events, setEvents] = useState([]);
  const [places, setPlaces] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [attendees, setAttendees] = useState({});
  const [attendeeEvent, setAttendeeEvent] = useState(null);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      if (user.role === 'student') {
        const [eventData, registrationData, placeData, favoriteData] = await Promise.all([
          apiRequest('/api/events'),
          apiRequest('/api/events/registrations/mine'),
          apiRequest('/api/places'),
          apiRequest('/api/places/favorites')
        ]);
        setEvents(eventData);
        setRegistrations(registrationData);
        setPlaces(placeData);
        setFavorites(favoriteData);
      } else if (user.role === 'organizer') {
        setEvents(await apiRequest('/api/events/mine'));
      } else {
        const [summaryData, userData, eventData] = await Promise.all([
          apiRequest('/api/admin/summary'),
          apiRequest('/api/admin/users'),
          apiRequest('/api/events/mine')
        ]);
        setSummary(summaryData);
        setUsers(userData);
        setEvents(eventData);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [user.id, user.role]);

  async function saveEvent(fields) {
    const path = editingEvent ? `/api/events/${editingEvent.id}` : '/api/events';
    const saved = await apiRequest(path, {
      method: editingEvent ? 'PUT' : 'POST',
      body: JSON.stringify(fields)
    });
    if (editingEvent) {
      setEvents(current => current.map(item => item.id === saved.id ? saved : item));
      setEditingEvent(null);
    } else {
      setEvents(current => [...current, saved].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)));
    }
    setNotice(editingEvent ? 'Event updated.' : 'Event published.');
  }

  async function removeEvent(event) {
    if (!window.confirm(`Delete “${event.title}”? This will also remove its registrations.`)) return;
    try {
      await apiRequest(`/api/events/${event.id}`, { method: 'DELETE' });
      setEvents(current => current.filter(item => item.id !== event.id));
      setNotice('Event deleted.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function changeRegistration(event, registered) {
    try {
      await apiRequest(`/api/events/${event.id}/registration`, {
        method: registered ? 'DELETE' : 'POST',
        ...(!registered ? { body: JSON.stringify({}) } : {})
      });
      setRegistrations(current => registered
        ? current.filter(item => item.id !== event.id)
        : [...current, event]);
      setNotice(registered ? 'Registration cancelled.' : 'You are registered for this event.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function changeFavorite(place, saved) {
    try {
      await apiRequest(`/api/places/${place.id}/favorite`, {
        method: saved ? 'DELETE' : 'POST',
        ...(!saved ? { body: JSON.stringify({}) } : {})
      });
      setFavorites(current => saved
        ? current.filter(item => item.id !== place.id)
        : [...current, place]);
      setNotice(saved ? 'Place removed from favorites.' : 'Place saved to favorites.');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function toggleAttendees(event) {
    if (attendeeEvent === event.id) {
      setAttendeeEvent(null);
      return;
    }
    setAttendeeEvent(event.id);
    if (attendees[event.id]) return;
    try {
      const list = await apiRequest(`/api/events/${event.id}/attendees`);
      setAttendees(current => ({ ...current, [event.id]: list }));
    } catch (requestError) {
      setError(requestError.message);
      setAttendeeEvent(null);
    }
  }

  const title = user.role === 'student' ? 'Student dashboard'
    : user.role === 'organizer' ? 'Event organizer dashboard' : 'Admin dashboard';

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <a className="brand" href="/" onClick={event => { event.preventDefault(); onHome(); }}>
          <img className="brand-logo" src="/moraguide-icon.svg" alt="" /><span>MoraGuide</span>
        </a>
        <div className="dashboard-header-actions">
          <span className="role-badge">{user.role}</span>
          <button className="button button-quiet-light" type="button" onClick={onHome}>Campus guide</button>
          <button className="button button-quiet-light" type="button" onClick={onLogout}><LogOut size={15} /> Log out</button>
        </div>
      </header>
      <div className="dashboard-content">
        <div className="dashboard-title">
          <div><span className="eyebrow">{user.firstName} {user.lastName}</span><h1>{title}</h1><p>{user.email}</p></div>
          <DashboardAvatar key={user.profileImage || 'initials'} user={user} />
        </div>
        {error && <div className="alert alert-error" role="alert">{error}<button type="button" onClick={loadDashboard}>Try again</button></div>}
        {notice && <div className="dashboard-notice" role="status">{notice}</div>}
        {loading ? <div className="dashboard-card dashboard-loading">Loading your dashboard…</div> : (
          <>
            {user.role === 'student' && (
              <>
                <section className="dashboard-section">
                  <div className="dashboard-card-heading"><div><span className="eyebrow">CAMPUS CALENDAR</span><h2>Upcoming events</h2></div><span className="count-pill">{events.length} events</span></div>
                  <div className="dashboard-event-list">
                    {events.filter(event => event.date >= getLocalDateString()).map(event => {
                      const registered = registrations.some(item => item.id === event.id);
                      return <DashboardEvent key={event.id} event={event}><button className={registered ? 'dashboard-action is-selected' : 'dashboard-action'} type="button" onClick={() => changeRegistration(event, registered)}>{registered ? <Check size={14} /> : <CalendarDays size={14} />}{registered ? 'Registered · cancel' : 'Register'}</button></DashboardEvent>;
                    })}
                    {!events.some(event => event.date >= getLocalDateString()) && <p className="dashboard-empty">No upcoming events yet.</p>}
                  </div>
                </section>
                <section className="dashboard-section">
                  <div className="dashboard-card-heading"><div><span className="eyebrow">YOUR SHORTLIST</span><h2>Favorite places</h2></div><span className="count-pill">{favorites.length} saved</span></div>
                  <div className="favorite-grid">
                    {places.map(place => {
                      const saved = favorites.some(item => item.id === place.id);
                      return <article className="favorite-card" key={place.id}><MapPin size={18} /><div><strong>{place.name}</strong><span>{place.category}</span></div><button type="button" aria-label={`${saved ? 'Remove' : 'Save'} ${place.name}`} onClick={() => changeFavorite(place, saved)}><Star size={16} fill={saved ? 'currentColor' : 'none'} /></button></article>;
                    })}
                  </div>
                </section>
              </>
            )}
            {user.role === 'organizer' && (
              <div className="organizer-dashboard-grid">
                <EventForm key={editingEvent?.id || 'new'} event={editingEvent} onSave={saveEvent} onCancel={() => setEditingEvent(null)} />
                <section className="dashboard-card organizer-event-section">
                  <div className="dashboard-card-heading"><div><span className="eyebrow">YOUR PROGRAM</span><h2>Manage events</h2></div><span className="count-pill">{events.length} events</span></div>
                  <div className="dashboard-event-list">
                    {events.map(event => (
                      <DashboardEvent key={event.id} event={event}>
                        <div className="dashboard-actions">
                          <button className="dashboard-action" type="button" onClick={() => setEditingEvent(event)}>Edit</button>
                          <button className="dashboard-action" type="button" onClick={() => toggleAttendees(event)}><Users size={14} />{attendeeEvent === event.id ? 'Hide attendees' : `Attendees (${event.registrationCount || 0})`}</button>
                          <button className="dashboard-action is-danger" type="button" onClick={() => removeEvent(event)}><Trash2 size={14} />Delete</button>
                        </div>
                        {attendeeEvent === event.id && <AttendeeList attendees={attendees[event.id]} />}
                      </DashboardEvent>
                    ))}
                    {!events.length && <p className="dashboard-empty">You have not published any events yet.</p>}
                  </div>
                </section>
              </div>
            )}
            {user.role === 'admin' && (
              <>
                <section className="admin-stats">
                  <StatCard label="Accounts" value={summary?.users ?? 0} />
                  <StatCard label="Events" value={summary?.events ?? 0} />
                  <StatCard label="Registrations" value={summary?.registrations ?? 0} />
                </section>
                <section className="dashboard-card admin-users">
                  <div className="dashboard-card-heading"><div><span className="eyebrow">ACCOUNT DIRECTORY</span><h2>Users</h2></div></div>
                  <div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead><tbody>
                    {users.map(account => <tr key={account.id}><td>{account.firstName} {account.lastName}</td><td>{account.email}</td><td><span className="role-badge">{account.role}</span></td><td>{new Date(account.createdAt).toLocaleDateString()}</td></tr>)}
                  </tbody></table></div>
                </section>
                <section className="dashboard-section">
                  <div className="dashboard-card-heading"><div><span className="eyebrow">CAMPUS CALENDAR</span><h2>All events</h2></div></div>
                  <div className="dashboard-event-list">{events.map(event => <DashboardEvent key={event.id} event={event}><button className="dashboard-action is-danger" type="button" onClick={() => removeEvent(event)}><Trash2 size={14} />Delete event</button></DashboardEvent>)}</div>
                </section>
              </>
            )}
            <ProfileEditor user={user} onSaved={onUserChange} />
          </>
        )}
      </div>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}

function DashboardAvatar({ user }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (user.profileImage && !imageFailed) {
    return <img className="dashboard-avatar" src={getApiUrl(user.profileImage)} crossOrigin="use-credentials" alt={`${user.firstName} ${user.lastName}`} onError={() => setImageFailed(true)} />;
  }
  return <span className="dashboard-avatar">{user.firstName.slice(0, 1).toUpperCase()}</span>;
}

function AttendeeList({ attendees }) {
  if (!attendees) return <p className="attendee-list">Loading attendees…</p>;
  if (!attendees.length) return <p className="attendee-list">No students have registered yet.</p>;
  return <ul className="attendee-list">{attendees.map((attendee, index) => <li key={`${attendee.registrationNumber}-${index}`}><strong>{attendee.firstName} {attendee.lastName}</strong><span>{attendee.registrationNumber} · {attendee.email}</span></li>)}</ul>;
}

function StatCard({ label, value }) {
  return <article className="dashboard-card stat-card"><span>{label}</span><strong>{value}</strong></article>;
}
