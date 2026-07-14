import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { AppShell } from '../components/layout/AppShell';
import { useTripStore } from '../store/tripStore';

import apiClient from '../api/client';

const GKEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const LIBRARIES: ('places')[] = ['places'];

// ─── Day colors & labels ─────────────────────────────────────────────────────
const DAY_COLORS = ['#4F6EF7','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316'];
const getDayColor = (idx: number) => DAY_COLORS[idx % DAY_COLORS.length];

const PLACE_CATEGORIES = [
  { id: 'restaurant', label: 'מסעדה' },
  { id: 'activity',   label: 'פעילות' },
  { id: 'nature',     label: 'טבע' },
  { id: 'hotel',      label: 'לינה' },
  { id: 'travel',     label: 'נסיעה' },
  { id: 'shopping',   label: 'קניות' },
  { id: 'culture',    label: 'תרבות' },
  { id: 'special',    label: 'מיוחד' },
  { id: 'other',      label: 'כללי' },
];

const getPlaceCategory = (category?: string | null) =>
  PLACE_CATEGORIES.find(c => c.id === category) ?? PLACE_CATEGORIES[PLACE_CATEGORIES.length - 1];

const getPlaceCategoryMarkerPath = (category?: string | null) => {
  switch (getPlaceCategory(category).id) {
    case 'restaurant':
      return '<path d="M7 3v8"/><path d="M5 3v4"/><path d="M9 3v4"/><path d="M5 7h4"/><path d="M7 11v10"/><path d="M16 3v18"/><path d="M16 3c3 2 3 6 0 8"/>';
    case 'activity':
      return '<path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3z"/>';
    case 'nature':
      return '<path d="M5 19c7-1 12-6 14-14"/><path d="M19 5c-8 0-14 4-14 11 0 2 1 3 3 3 7 0 11-6 11-14z"/>';
    case 'hotel':
      return '<path d="M4 11V5"/><path d="M4 14h16"/><path d="M20 19v-8a3 3 0 0 0-3-3H9v11"/><path d="M4 19v-8"/><path d="M8 8h1"/>';
    case 'travel':
      return '<path d="M5 16h14"/><path d="M7 16l1.2-5.2A3 3 0 0 1 11.1 8h1.8a3 3 0 0 1 2.9 2.8L17 16"/><path d="M7 16v2"/><path d="M17 16v2"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/>';
    case 'shopping':
      return '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>';
    case 'culture':
      return '<path d="M4 9h16"/><path d="M6 9v9"/><path d="M10 9v9"/><path d="M14 9v9"/><path d="M18 9v9"/><path d="M3 21h18"/><path d="M12 3l8 4H4l8-4z"/>';
    case 'special':
      return '<path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3z"/><circle cx="12" cy="12" r="2"/>';
    default:
      return '<circle cx="12" cy="12" r="3"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="M3 12h2"/><path d="M19 12h2"/>';
  }
};

const CategoryMarkerIcon: React.FC<{ category: string; active: boolean }> = ({ category, active }) => (
  <span className={`w-7 h-7 rounded-full flex items-center justify-center ${
    active ? 'bg-brand-500' : 'bg-neutral-400'
  }`}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <g dangerouslySetInnerHTML={{ __html: getPlaceCategoryMarkerPath(category) }} />
    </svg>
  </span>
);

const HEB_DAYS = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `יום ${HEB_DAYS[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
}

function buildTripDays(start?: string | null, end?: string | null): string[] {
  if (!start || !end) return [];
  const days: string[] = [];
  const s = new Date(start.slice(0, 10) + 'T12:00:00');
  const e = new Date(end.slice(0, 10) + 'T12:00:00');
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1))
    days.push(d.toISOString().slice(0, 10));
  return days;
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface PlacePhoto { id: string; url: string; caption: string | null }
interface Place {
  id: string;
  name: string;
  nameOriginal?: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  description?: string | null;
  location?: string | null;
  order: number;
  mapsUrl?: string | null;
  url?: string | null;
  date?: string | null;
  category?: string | null;
  placeId?: string | null;
  openingHours?: any;
  rating?: number | null;
  ratingCount?: number | null;
  cost?: string | null;
  durationMins?: number | null;
  estimatedDuration?: string | null;
  photos: PlacePhoto[];
}
interface GeoResult { placeId?: string; lat?: number; lng?: number; name: string; subtitle: string }

const placePosition = (place: Place): google.maps.LatLngLiteral | null => {
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

async function searchPlaces(q: string): Promise<GeoResult[]> {
  try { return (await apiClient.get(`/api/geocode/search?q=${encodeURIComponent(q)}`)).data.results ?? []; }
  catch { return []; }
}
async function fetchPlaceCoords(placeId: string): Promise<{ lat: number; lng: number; name: string } | null> {
  try { return (await apiClient.get(`/api/geocode/details/${placeId}`)).data; }
  catch { return null; }
}

// ─── DayPicker (used inside modals) ──────────────────────────────────────────
const DayPicker: React.FC<{
  tripDays: string[];
  value: string | null;
  onChange: (date: string | null) => void;
  allowNull?: boolean;
}> = ({ tripDays, value, onChange, allowNull = true }) => {
  if (!tripDays.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowNull && (
        <button onClick={() => onChange(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            value === null
              ? 'bg-neutral-800 text-white border-neutral-800'
              : 'bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50'
          }`}>ללא יום</button>
      )}
      {tripDays.map((date, idx) => {
        const color = getDayColor(idx);
        const active = value === date;
        return (
          <button key={date} onClick={() => onChange(date)}
            style={active ? { background: color, borderColor: color, color: 'white' } : { borderColor: color + '55' }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              active ? '' : 'bg-white text-neutral-600 hover:bg-neutral-50'
            }`}>{formatDayLabel(date)}</button>
        );
      })}
    </div>
  );
};

const CategoryPicker: React.FC<{
  value: string;
  onChange: (category: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled = false }) => (
  <div className="grid grid-cols-4 gap-1.5">
    {PLACE_CATEGORIES.map(cat => {
      const active = value === cat.id;
      return (
        <button key={cat.id} onClick={() => onChange(cat.id)} disabled={disabled}
          className={`h-14 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-colors disabled:opacity-60 ${
            active
              ? 'bg-brand-50 border-brand-500 text-brand-700'
              : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
          }`}>
          <CategoryMarkerIcon category={cat.id} active={active} />
          <span>{cat.label}</span>
        </button>
      );
    })}
  </div>
);

// ─── AddPlaceModal ────────────────────────────────────────────────────────────
interface AddPlaceModalProps {
  tripId: string;
  tripDays: string[];
  onClose: () => void;
  onAdded: (place: Place) => void;
}

const AddPlaceModal: React.FC<AddPlaceModalProps> = ({ tripId, tripDays, onClose, onAdded }) => {
  const [query,       setQuery]       = useState('');
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [selected,    setSelected]    = useState<GeoResult | null>(null);
  const [name,        setName]        = useState('');
  const [notes,       setNotes]       = useState('');
  const [date,        setDate]        = useState<string | null>(null);
  const [category,    setCategory]    = useState('other');
  const [saving,      setSaving]      = useState(false);
  const [resolving,   setResolving]   = useState(false);
  const [error,       setError]       = useState('');
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQuery = (val: string) => {
    setQuery(val); setSelected(null); setSuggestions([]); setError('');
    if (debRef.current) clearTimeout(debRef.current);
    if (val.trim().length < 2) return;
    debRef.current = setTimeout(async () => {
      setSearching(true);
      const r = await searchPlaces(val.trim());
      setSearching(false); setSuggestions(r);
      if (!r.length) setError('לא נמצאו תוצאות');
    }, 450);
  };

  const handlePick = async (r: GeoResult) => {
    setSuggestions([]); setQuery(r.name);
    if (!name) setName(r.name);
    if (r.lat != null && r.lng != null) { setSelected(r); return; }
    if (!r.placeId) return;
    setResolving(true);
    const det = await fetchPlaceCoords(r.placeId);
    setResolving(false);
    if (!det) { setError('לא ניתן לקבל מיקום'); return; }
    setSelected({ ...r, lat: det.lat, lng: det.lng });
    if (!name) setName(det.name || r.name);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('שם המקום חסר'); return; }
    if (!selected?.lat) { setError('בחר מקום מהרשימה'); return; }
    setSaving(true);
    try {
      const res = await apiClient.post(`/api/places/${tripId}`, {
        name: name.trim(), lat: selected.lat, lng: selected.lng, notes, date: date || undefined, category,
      });
      onAdded(res.data.place);
    } catch { setError('שגיאה בשמירה'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-end justify-center"
      onTouchMove={e => e.preventDefault()}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full max-w-lg rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '85dvh' }} onTouchMove={e => e.stopPropagation()}>
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="font-bold text-neutral-900">הוספת מקום</h2>
          <button onClick={onClose} className="text-neutral-400 text-2xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto overflow-x-hidden flex-1 px-5 py-4 flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">חיפוש מקום</label>
            <div className="relative">
              <input type="text" value={query} onChange={e => handleQuery(e.target.value)}
                placeholder="מגדל אייפל, יורו דיסני..." autoComplete="off"
                className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 pl-8" />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">
                {(searching || resolving) ? '⟳' : '🔍'}
              </span>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-1 border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                {suggestions.map((r, i) => (
                  <button key={i} onClick={() => handlePick(r)}
                    className="w-full flex flex-col items-start px-4 py-3 hover:bg-brand-50 border-b border-neutral-100 last:border-0 text-right">
                    <span className="text-sm font-medium text-neutral-900">{r.name}</span>
                    <span className="text-xs text-neutral-400 mt-0.5">{r.subtitle}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selected && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <span className="text-green-500">✓</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 truncate">{selected.name}</p>
                <p className="text-xs text-green-600 truncate">{selected.subtitle}</p>
              </div>
              <button onClick={() => { setSelected(null); setQuery(''); }} className="text-green-400 text-lg leading-none">×</button>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">שם לתצוגה</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="שם המקום"
              className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">הערות (אופציונלי)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">קטגוריה</label>
            <CategoryPicker value={category} onChange={setCategory} />
          </div>
          {tripDays.length > 0 && (
            <div>
              <label className="text-sm font-medium text-neutral-700 block mb-1.5">📅 שייך ליום</label>
              <DayPicker tripDays={tripDays} value={date} onChange={setDate} />
            </div>
          )}
          {error && !suggestions.length && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex-shrink-0 px-5 py-4 border-t border-neutral-100">
          <button onClick={handleSave}
            disabled={saving || resolving || !selected || selected.lat == null || !name.trim()}
            className="w-full py-3 bg-brand-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
            {saving ? 'שומר...' : '+ הוסף למסלול'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── PlaceDetailModal ─────────────────────────────────────────────────────────
interface PlaceDetailModalProps {
  place: Place;
  tripDays: string[];
  onClose: () => void;
  onDeleted: (id: string) => void;
  onPhotoAdded: (placeId: string, photo: PlacePhoto) => void;
  onPhotoDeleted: (placeId: string, photoId: string) => void;
  onDateChanged: (placeId: string, date: string | null) => void;
  onCategoryChanged: (placeId: string, category: string) => void;
}

const PlaceDetailModal: React.FC<PlaceDetailModalProps> = ({
  place, tripDays, onClose, onDeleted, onPhotoAdded, onPhotoDeleted, onDateChanged, onCategoryChanged,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading,    setUploading]    = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [changingDate, setChangingDate] = useState(false);
  const [changingCategory, setChangingCategory] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const form = new FormData(); form.append('photo', file);
      const res = await apiClient.post(`/api/places/${place.id}/photos`, form, { headers: { 'Content-Type': undefined } });
      onPhotoAdded(place.id, res.data.photo);
    } catch { alert('שגיאה בהעלאת תמונה'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleDelete = async () => {
    if (!confirm(`למחוק את "${place.name}"?`)) return;
    setDeleting(true);
    try { await apiClient.delete(`/api/places/${place.id}`); onDeleted(place.id); }
    catch { alert('שגיאה במחיקה'); setDeleting(false); }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try { await apiClient.delete(`/api/places/photos/${photoId}`); onPhotoDeleted(place.id, photoId); }
    catch { alert('שגיאה במחיקת תמונה'); }
  };

  const handleDateChange = async (date: string | null) => {
    setChangingDate(true);
    try {
      await apiClient.put(`/api/places/${place.id}`, { date: date ?? '' });
      onDateChanged(place.id, date);
    } catch { alert('שגיאה בשינוי יום'); }
    finally { setChangingDate(false); }
  };

  const handleCategoryChange = async (category: string) => {
    if (category === (place.category ?? 'other')) return;
    setChangingCategory(true);
    try {
      await apiClient.put(`/api/places/${place.id}`, { category });
      onCategoryChanged(place.id, category);
    } catch { alert('שגיאה בשינוי קטגוריה'); }
    finally { setChangingCategory(false); }
  };

  const dayIdx = tripDays.indexOf(place.date ?? '');
  const categoryMeta = getPlaceCategory(place.category);

  return (
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-end justify-center"
      onTouchMove={e => e.preventDefault()}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full max-w-lg rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '85dvh' }} onTouchMove={e => e.stopPropagation()}>
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div>
            <h2 className="font-bold text-neutral-900 flex items-center gap-1.5">
              <CategoryMarkerIcon category={categoryMeta.id} active />
              <span>{place.name}</span>
            </h2>
            {place.notes && <p className="text-xs text-neutral-400 mt-0.5">{place.notes}</p>}
            <p className="text-xs text-neutral-500 mt-0.5">{categoryMeta.label}</p>
            {dayIdx >= 0 && (
              <p className="text-xs font-semibold mt-0.5" style={{ color: getDayColor(dayIdx) }}>
                {formatDayLabel(place.date!)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-neutral-400 text-2xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto overflow-x-hidden flex-1 px-5 py-4 flex flex-col gap-4">
          <div className="flex gap-2">
            <a href={place.mapsUrl || `https://www.google.com/maps?q=${place.lat},${place.lng}`}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 py-2.5 border border-brand-500 text-brand-500 rounded-xl text-sm font-medium text-center">🗺️ Maps</a>
            <a href={`waze://?q=${place.lat},${place.lng}&navigate=yes`}
              className="flex-1 py-2.5 border border-[#05C3F7] text-[#05C3F7] rounded-xl text-sm font-medium flex items-center justify-center gap-1.5">
              <img src="/uploads/icon-waze.png" alt="Waze" className="w-4 h-4 object-contain" />
              Waze
            </a>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex-1 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {uploading ? 'מעלה...' : '📷 תמונה'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>

          {tripDays.length > 0 && (
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-2">
                📅 {changingDate ? 'שומר...' : 'שייך ליום'}
              </p>
              <DayPicker tripDays={tripDays} value={place.date ?? null} onChange={handleDateChange} />
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-neutral-500 mb-2">
              {changingCategory ? 'שומר...' : 'קטגוריה'}
            </p>
            <CategoryPicker value={place.category ?? 'other'} onChange={handleCategoryChange} disabled={changingCategory} />
          </div>

          {/* Opening Hours */}
          {place.openingHours || place.openingHours === null ? (
            <div className="bg-neutral-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-neutral-700 mb-1.5">🕐 שעות פתיחה</p>
              {place.openingHours === null ? (
                <p className="text-sm text-neutral-600">פתוח 24/7</p>
              ) : typeof place.openingHours === 'object' && place.openingHours.weekday_text ? (
                <div className="space-y-0.5">
                  {(place.openingHours.weekday_text as string[]).map((day, i) => (
                    <p key={i} className="text-xs text-neutral-600">{day}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-600">{JSON.stringify(place.openingHours)}</p>
              )}
            </div>
          ) : null}

          {/* Rating, Cost, Duration */}
          <div className="flex flex-wrap gap-2">
            {place.rating && (
              <div className="bg-neutral-50 rounded-lg px-3 py-2 flex-shrink-0">
                <p className="text-xs font-semibold text-neutral-700">⭐ דירוג</p>
                <p className="text-sm text-neutral-900 font-medium">
                  {place.rating.toFixed(1)}
                  {place.ratingCount ? ` (${place.ratingCount.toLocaleString()})` : ''}
                </p>
              </div>
            )}
            {place.cost && (
              <div className="bg-neutral-50 rounded-lg px-3 py-2 flex-shrink-0">
                <p className="text-xs font-semibold text-neutral-700">💰 מחיר</p>
                <p className="text-sm text-neutral-900">{place.cost}</p>
              </div>
            )}
            {place.estimatedDuration && (
              <div className="bg-neutral-50 rounded-lg px-3 py-2 flex-shrink-0">
                <p className="text-xs font-semibold text-neutral-700">⏱️ משך</p>
                <p className="text-sm text-neutral-900">{place.estimatedDuration}</p>
              </div>
            )}
          </div>

          {/* Description */}
          {place.description && (
            <div className="bg-neutral-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-neutral-700 mb-1">📝 תיאור</p>
              <p className="text-sm text-neutral-600 whitespace-pre-wrap">{place.description}</p>
            </div>
          )}

          {/* Website */}
          {place.url && (
            <a href={place.url} target="_blank" rel="noopener noreferrer"
              className="block bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-sm text-blue-700 hover:bg-blue-100 transition-colors">
              🌐 אתר רשמי ↗
            </a>
          )}

          {place.photos.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-2">תמונות ({place.photos.length})</p>
              <div className="grid grid-cols-3 gap-1.5">
                {place.photos.map(photo => (
                  <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden group">
                    <img src={photo.url} alt={photo.caption || place.name} className="w-full h-full object-cover" />
                    <button onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute top-1 left-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity">×</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-neutral-400">
              <p className="text-3xl mb-2">📷</p>
              <p className="text-sm">לא הועלו תמונות עדיין</p>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 px-5 py-4 border-t border-neutral-100">
          <button onClick={handleDelete} disabled={deleting}
            className="w-full py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-medium disabled:opacity-50">
            {deleting ? 'מוחק...' : 'מחק מקום'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── PlacesPanel ──────────────────────────────────────────────────────────────
const MIN_PANEL_HEIGHT = 128;
const DEFAULT_PANEL_HEIGHT = 312;
const MAX_PANEL_HEIGHT = 620;

interface PlacesPanelProps {
  places: Place[];
  tripDays: string[];
  height: number;
  onHeightChange: (height: number) => void;
  onSelect: (place: Place) => void;
}

const PlacesPanel: React.FC<PlacesPanelProps> = ({ places, tripDays, height, onHeightChange, onSelect }) => {
  const [search, setSearch] = useState('');
  const [day, setDay] = useState<'all' | 'none' | string>('all');
  const [category, setCategory] = useState('all');
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const panelHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(height, MAX_PANEL_HEIGHT));
  const expanded = panelHeight > 180;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return places
      .filter(p => {
        if (!q) return true;
        return p.name.toLowerCase().includes(q) ||
          p.notes?.toLowerCase().includes(q) ||
          getPlaceCategory(p.category).label.toLowerCase().includes(q);
      })
      .filter(p => category === 'all' || getPlaceCategory(p.category).id === category)
      .filter(p => day === 'all' || (day === 'none' ? !p.date : p.date === day))
      .sort((a, b) => {
        const ad = a.date ?? '';
        const bd = b.date ?? '';
        if (ad !== bd) return ad.localeCompare(bd);
        return a.order - b.order;
      });
  }, [places, search, day, category]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    places.forEach(p => {
      const id = getPlaceCategory(p.category).id;
      m.set(id, (m.get(id) ?? 0) + 1);
    });
    return m;
  }, [places]);

  const dayCounts = useMemo(() => {
    const m = new Map<string, number>();
    places.forEach(p => m.set(p.date ?? 'none', (m.get(p.date ?? 'none') ?? 0) + 1));
    return m;
  }, [places]);

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startHeight: panelHeight };
  };

  const dragPanel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const nextHeight = dragRef.current.startHeight + dragRef.current.startY - e.clientY;
    onHeightChange(Math.max(MIN_PANEL_HEIGHT, Math.min(nextHeight, MAX_PANEL_HEIGHT)));
  };

  const stopDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className="absolute left-0 right-0 bottom-0 z-[520] pointer-events-none">
      <div className="bg-white/95 backdrop-blur-sm rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col pointer-events-auto sm:mx-3 sm:mb-3"
        style={{ height: panelHeight }}>
        <div className="flex-none px-3 pt-2 pb-2 border-b border-neutral-100">
          <div
            className="flex items-center justify-center mb-2 h-6 cursor-ns-resize touch-none"
            onPointerDown={startDrag}
            onPointerMove={dragPanel}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}>
            <span className="w-12 h-1.5 rounded-full bg-neutral-300" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 text-right">
              <p className="text-sm font-bold text-neutral-900 leading-tight">מקומות</p>
              <p className="text-xs text-neutral-400 leading-tight">{filtered.length} מתוך {places.length}</p>
            </div>
          </div>

          {expanded && (
            <>
              <div className="relative mt-2">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="חיפוש מקום..."
                  className="w-full border border-neutral-200 rounded-xl px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">🔍</span>
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute left-9 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">×</button>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pt-2 pb-1">
                <button onClick={() => setDay('all')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${day === 'all' ? 'bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                  כל הימים
                </button>
                {tripDays.map((date, idx) => (
                  <button key={date} onClick={() => setDay(date)}
                    style={day === date ? { background: getDayColor(idx), color: 'white' } : undefined}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${day === date ? '' : 'bg-neutral-100 text-neutral-600'}`}>
                    {formatDayLabel(date)} {dayCounts.get(date) ? `(${dayCounts.get(date)})` : ''}
                  </button>
                ))}
                {dayCounts.get('none') && (
                  <button onClick={() => setDay('none')}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${day === 'none' ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                    ללא יום ({dayCounts.get('none')})
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button onClick={() => setCategory('all')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${category === 'all' ? 'bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                  כל הסוגים
                </button>
                {PLACE_CATEGORIES.filter(cat => categoryCounts.has(cat.id)).map(cat => (
                  <button key={cat.id} onClick={() => setCategory(cat.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${category === cat.id ? 'bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                    {cat.label} ({categoryCounts.get(cat.id)})
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-28 text-sm text-neutral-400">לא נמצאו מקומות</div>
          ) : (
            filtered.map((place, idx) => {
              const dayIdx = tripDays.indexOf(place.date ?? '');
              const color = dayIdx >= 0 ? getDayColor(dayIdx) : '#9CA3AF';
              const categoryMeta = getPlaceCategory(place.category);
              return (
                <button key={place.id} onClick={() => onSelect(place)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-neutral-100 text-right hover:bg-neutral-50 active:bg-neutral-100 transition-colors">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: color }}>
                    {idx + 1}
                  </span>
                  <CategoryMarkerIcon category={categoryMeta.id} active={false} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-neutral-800 truncate">{place.name}</span>
                    <span className="block text-xs text-neutral-400 truncate">
                      {place.date ? formatDayLabel(place.date) : 'ללא יום'} · {categoryMeta.label}
                      {place.notes ? ` · ${place.notes}` : ''}
                      {place.photos.length > 0 ? ` · ${place.photos.length} תמונות` : ''}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// ─── ReorderDrawer ────────────────────────────────────────────────────────────
const ROW_H = 52;

interface ReorderDrawerProps {
  places: Place[];
  tripId: string;
  tripDays: string[];
  onClose: () => void;
  onSaved: (updated: Place[]) => void;
}

const ReorderDrawer: React.FC<ReorderDrawerProps> = ({ places, tripId, tripDays, onClose, onSaved }) => {
  const [, setLocalOrder]        = useState<Place[]>(() => [...places]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);
  const localRef = useRef<Place[]>([...places]);
  const drag = useRef<{ id: string; date: string | null; curIdx: number; startY: number } | null>(null);

  const getDayItems = (date: string | null) =>
    localRef.current.filter(p => (p.date ?? null) === date).sort((a, b) => a.order - b.order);

  const onDragStart = (e: React.PointerEvent, place: Place, idxInDay: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: place.id, date: place.date ?? null, curIdx: idxInDay, startY: e.clientY };
    setDraggingId(place.id);
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const { date, curIdx, startY } = drag.current;
    const delta = Math.round((e.clientY - startY) / ROW_H);
    if (delta === 0) return;
    const dayItems = getDayItems(date);
    const newIdx = Math.max(0, Math.min(dayItems.length - 1, curIdx + delta));
    if (newIdx === curIdx) return;
    const items = [...dayItems];
    const [moved] = items.splice(curIdx, 1);
    items.splice(newIdx, 0, moved);
    const reordered = items.map((p, i) => ({ ...p, order: i }));
    const others = localRef.current.filter(p => (p.date ?? null) !== date);
    const newLocal = [...others, ...reordered];
    localRef.current = newLocal;
    setLocalOrder(newLocal);
    drag.current.curIdx = newIdx;
    drag.current.startY = e.clientY;
  };

  const onDragEnd = () => { drag.current = null; setDraggingId(null); };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const date of [...tripDays, null as string | null]) {
        const ids = getDayItems(date).map(p => p.id);
        if (ids.length) await apiClient.put(`/api/places/${tripId}/reorder`, { ids });
      }
      onSaved(localRef.current);
      onClose();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const groups: { date: string | null; label: string; color: string; items: Place[] }[] = [];
  tripDays.forEach((date, idx) => {
    const items = getDayItems(date);
    if (items.length) groups.push({ date, label: formatDayLabel(date), color: getDayColor(idx), items });
  });
  const undated = getDayItems(null);
  if (undated.length) groups.push({ date: null, label: 'ללא יום', color: '#9CA3AF', items: undated });

  return (
    <div className="fixed inset-0 z-[8000]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '82dvh' }} onClick={e => e.stopPropagation()}>

        <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div>
            <h2 className="font-bold text-neutral-900">סדר מקומות</h2>
            <p className="text-xs text-neutral-400 mt-0.5">גרור שורה לשינוי סדר</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 && (
            <div className="flex items-center justify-center h-24 text-sm text-neutral-400">אין מקומות עדיין</div>
          )}
          {groups.map(group => (
            <div key={group.date ?? 'undated'}>
              <div className="flex items-center gap-2 px-4 py-2 bg-neutral-50 border-b border-neutral-100 sticky top-0 z-10">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.color }} />
                <span className="text-xs font-semibold text-neutral-700">{group.label}</span>
                <span className="text-xs text-neutral-400 mr-auto">{group.items.length}</span>
              </div>
              {group.items.map((place, idx) => (
                <div key={place.id}
                  className={`flex items-center gap-3 px-4 border-b border-neutral-50 select-none ${
                    draggingId === place.id ? 'bg-brand-50 shadow-sm z-20 relative' : 'bg-white'
                  }`}
                  style={{ height: ROW_H }}>
                  <span
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-neutral-300 cursor-grab active:cursor-grabbing touch-none"
                    onPointerDown={e => onDragStart(e, place, idx)}
                    onPointerMove={onDragMove}
                    onPointerUp={onDragEnd}
                    onPointerCancel={onDragEnd}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="4" y="5" width="16" height="2.5" rx="1.25"/>
                      <rect x="4" y="11" width="16" height="2.5" rx="1.25"/>
                      <rect x="4" y="17" width="16" height="2.5" rx="1.25"/>
                    </svg>
                  </span>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: group.color }}>{idx + 1}</span>
                  <CategoryMarkerIcon category={getPlaceCategory(place.category).id} active={false} />
                  <span className="flex-1 text-sm font-medium text-neutral-800 truncate">{place.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex-none px-5 pt-4 border-t border-neutral-100"
          style={{ paddingBottom: `calc(${BOTTOM_H}px + env(safe-area-inset-bottom, 0px) + 8px)` }}>
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-brand-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
            {saving ? 'שומר...' : 'שמור סדר'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MapPage ──────────────────────────────────────────────────────────────────
const TOP_H    = 56;  // TripTopBar h-14
const BOTTOM_H = 64;  // BottomNav base height (without safe-area)

const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy',
  mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
};

export const MapPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const { currentTrip, loadTrip } = useTripStore();
  const [places,        setPlaces]        = useState<Place[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [placesError,   setPlacesError]   = useState<string | null>(null);
  const [showAdd,       setShowAdd]       = useState(false);
  const [showReorder,   setShowReorder]   = useState(false);
  const [selected,      setSelected]      = useState<Place | null>(null);
  const [hiddenDays,    setHiddenDays]    = useState<Set<string>>(new Set());
  const [dayFilterOpen, setDayFilterOpen] = useState(false);
  const [panelHeight,   setPanelHeight]   = useState(DEFAULT_PANEL_HEIGHT);
  const [mapReady,      setMapReady]      = useState(false);
  const mapRef       = useRef<google.maps.Map | null>(null);
  const centeredOnce = useRef(false);

  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: GKEY, libraries: LIBRARIES, language: 'he' });

  useEffect(() => {
    if (loadError) console.error('[MapPage] Google Maps load error:', loadError);
  }, [loadError]);

  const tripDays = useMemo(
    () => buildTripDays(currentTrip?.startDate, currentTrip?.endDate),
    [currentTrip?.startDate, currentTrip?.endDate],
  );


  const fitVisible = (visible: Place[]) => {
    if (!mapRef.current || !window.google) return;
    const positioned = visible
      .map(placePosition)
      .filter((pos): pos is google.maps.LatLngLiteral => pos !== null);
    if (!positioned.length) return;

    // The bottom places panel covers part of the map — pad the bounds so
    // markers stay in the visible area above it (clamped for small screens).
    const mapDiv = mapRef.current.getDiv();
    const panelCovers = places.length && !showAdd ? panelHeight : 0;
    const bottomPad = Math.min(panelCovers + 60, Math.max(60, mapDiv.clientHeight - 160));

    if (positioned.length === 1) {
      mapRef.current.panTo(positioned[0]);
      mapRef.current.setZoom(13);
      mapRef.current.panBy(0, panelCovers / 2);
    } else {
      const bounds = new window.google.maps.LatLngBounds();
      positioned.forEach(pos => bounds.extend(pos));
      mapRef.current.fitBounds(bounds, { top: 60, right: 50, bottom: bottomPad, left: 50 });
    }
  };

  // Fit to visible places once on initial data load
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google || centeredOnce.current) return;
    const visible = places.filter(p => !p.date || !hiddenDays.has(p.date));
    if (!visible.length) return;
    centeredOnce.current = true;
    fitVisible(visible);
  }, [mapReady, places, hiddenDays]);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    setLoading(true);
    setPlacesError(null);
    if (currentTrip?.id !== tripId) loadTrip(tripId);
    apiClient.get(`/api/places/${tripId}`)
      .then(r => {
        if (cancelled) return;
        setPlaces(Array.isArray(r.data.places) ? r.data.places : []);
      })
      .catch(err => {
        console.error('[MapPage] Failed to load places:', err);
        if (cancelled) return;
        setPlaces([]);
        setPlacesError('לא ניתן לטעון את המקומות כרגע');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tripId, currentTrip?.id, loadTrip]);

  // Markers: exclude hidden days, number each day independently from 1
  const visibleMarkers = useMemo(() => {
    const result: { place: Place; position: google.maps.LatLngLiteral; num: number }[] = [];
    const byDay = new Map<string, Place[]>();
    const undated: Place[] = [];

    places.forEach(p => {
      if (!placePosition(p)) return;
      if (!p.date) { undated.push(p); return; }
      if (hiddenDays.has(p.date)) return;
      const arr = byDay.get(p.date) ?? [];
      arr.push(p);
      byDay.set(p.date, arr);
    });

    byDay.forEach(dayPlaces =>
      dayPlaces.sort((a, b) => a.order - b.order)
               .forEach((p, i) => {
                 const position = placePosition(p);
                 if (position) result.push({ place: p, position, num: i + 1 });
               })
    );
    undated.sort((a, b) => a.order - b.order)
           .forEach((p, i) => {
             const position = placePosition(p);
             if (position) result.push({ place: p, position, num: i + 1 });
           });

    return result;
  }, [places, hiddenDays]);

  // Place count per day for the filter panel
  const dayCounts = useMemo(() => {
    const m = new Map<string, number>();
    places.forEach(p => { if (p.date) m.set(p.date, (m.get(p.date) ?? 0) + 1); });
    return m;
  }, [places]);

  const center = useMemo(() => {
    const positioned = places
      .map(placePosition)
      .filter((pos): pos is google.maps.LatLngLiteral => pos !== null);
    if (!positioned.length) return { lat: 31.5, lng: 35.0 };
    return {
      lat: positioned.reduce((s, p) => s + p.lat, 0) / positioned.length,
      lng: positioned.reduce((s, p) => s + p.lng, 0) / positioned.length,
    };
  }, [places]);

  const getPlaceColor = useCallback((p: Place) => {
    const i = p.date ? tripDays.indexOf(p.date) : -1;
    return i >= 0 ? getDayColor(i) : '#9CA3AF';
  }, [tripDays]);

  const markerIcon = useCallback((num: number, color: string, category?: string | null) => {
    if (!window.google) return undefined;
    const path = getPlaceCategoryMarkerPath(category);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42"><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.8" flood-color="#0f172a" flood-opacity=".22"/></filter><g filter="url(#s)"><circle cx="19" cy="19" r="14" fill="${color}" stroke="white" stroke-width="2.5"/><g transform="translate(7 7)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</g><circle cx="30" cy="30" r="9" fill="${color}" stroke="white" stroke-width="2.5"/><text x="30" y="34" text-anchor="middle" fill="white" font-size="11" font-weight="700" font-family="Arial,sans-serif">${num}</text></g></svg>`;
    return {
      url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(42, 42),
      anchor: new window.google.maps.Point(21, 21),
    };
  }, []);

  const toggleDay = (date: string) => {
    const next = new Set(hiddenDays);
    next.has(date) ? next.delete(date) : next.add(date);
    setHiddenDays(next);
    const visible = places.filter(p => !p.date || !next.has(p.date));
    if (visible.length && mapRef.current && window.google) fitVisible(visible);
  };

  const handleAdded = (place: Place) => {
    setPlaces(prev => [...prev, place]);
    setShowAdd(false);
    const position = placePosition(place);
    if (position) mapRef.current?.panTo(position);
  };

  const handleDeleted    = (id: string) => { setPlaces(prev => prev.filter(p => p.id !== id)); setSelected(null); };
  const handlePhotoAdded = (placeId: string, photo: PlacePhoto) => {
    setPlaces(prev => prev.map(p => p.id === placeId ? { ...p, photos: [...p.photos, photo] } : p));
    setSelected(prev => prev?.id === placeId ? { ...prev, photos: [...prev.photos, photo] } : prev);
  };
  const handlePhotoDeleted = (placeId: string, photoId: string) => {
    setPlaces(prev => prev.map(p => p.id === placeId ? { ...p, photos: p.photos.filter(ph => ph.id !== photoId) } : p));
    setSelected(prev => prev?.id === placeId ? { ...prev, photos: prev.photos.filter(ph => ph.id !== photoId) } : prev);
  };
  const handleDateChanged = (placeId: string, date: string | null) => {
    setPlaces(prev => prev.map(p => p.id === placeId ? { ...p, date } : p));
    setSelected(prev => prev?.id === placeId ? { ...prev, date } : prev);
  };
  const handleCategoryChanged = (placeId: string, category: string) => {
    setPlaces(prev => prev.map(p => p.id === placeId ? { ...p, category } : p));
    setSelected(prev => prev?.id === placeId ? { ...prev, category } : prev);
  };

  const handleListSelect = (place: Place) => {
    setSelected(place);
    const position = placePosition(place);
    if (position) {
      mapRef.current?.panTo(position);
      mapRef.current?.setZoom(14);
    }
  };

  return (
    <AppShell showBottomNav noPadding>
      {/* Full-screen map filling space between topbar and bottomnav */}
      <div className="fixed left-0 right-0"
        style={{ top: `${TOP_H}px`, bottom: `calc(${BOTTOM_H}px + env(safe-area-inset-bottom, 0px))` }}>

        {/* + Add button — top left */}
        <button onClick={() => setShowAdd(true)}
          className="absolute top-2 left-4 z-[500] w-10 h-10 bg-brand-500 text-white rounded-full shadow-lg text-2xl flex items-center justify-center active:bg-brand-600 transition-colors">+</button>

        {/* Pin count + reorder button — top right */}
        {places.length > 0 && (
          <div className="absolute top-2 right-4 z-[500] flex items-center gap-1.5">
            <button onClick={() => setPanelHeight(h => h <= 180 ? DEFAULT_PANEL_HEIGHT : MIN_PANEL_HEIGHT)}
              className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow text-xs font-semibold text-neutral-700 active:bg-neutral-100 transition-colors">
              📍 {places.length}
            </button>
            <button onClick={() => setShowReorder(true)}
              className="w-9 h-9 bg-white/95 backdrop-blur-sm rounded-full shadow flex items-center justify-center text-neutral-500 active:bg-neutral-100 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        )}

        {/* Google Map */}
        {loadError ? (
          <div className="flex flex-col items-center justify-center h-full text-red-500 p-4 text-center">
            <p className="text-lg font-bold mb-2">❌ שגיאה בטעינת המפה</p>
            <p className="text-sm text-neutral-600">{loadError.message}</p>
            <p className="text-xs text-neutral-400 mt-2">נא לבדוק את חיבור האינטרנט ולרענן את הדף</p>
          </div>
        ) : isLoaded ? (
          <>
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={mapReady ? undefined : center}
              zoom={mapReady ? undefined : (visibleMarkers.length ? 10 : 7)}
              options={MAP_OPTIONS}
              onLoad={map => {
                mapRef.current = map;
                map.setOptions({ zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER } });
                setMapReady(true);
              }}
              onClick={() => setDayFilterOpen(false)}>
              {visibleMarkers.map(({ place, position, num }) => (
                <Marker key={place.id}
                  position={position}
                  icon={markerIcon(num, getPlaceColor(place), place.category)}
                  onClick={() => setSelected(place)}
                />
              ))}
            </GoogleMap>
            {loading && (
              <div className="absolute inset-x-0 top-14 z-[450] flex justify-center pointer-events-none">
                <div className="bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow text-sm font-medium text-neutral-600">
                  טוען מקומות...
                </div>
              </div>
            )}
            {placesError && (
              <div className="absolute inset-x-4 top-14 z-[450] flex justify-center pointer-events-none">
                <div className="bg-white/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow text-sm font-medium text-red-600 text-center">
                  {placesError}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-400">
            <div className="text-center">
              <div className="text-3xl mb-2">🗺️</div>
              <p>טוען מפה...</p>
            </div>
          </div>
        )}

        {/* Day filter — bottom left */}
        {tripDays.length > 0 && (
          <>
            {dayFilterOpen && (
              <div className="absolute z-[600]" style={{ bottom: `${places.length && !showAdd ? panelHeight + 24 : 60}px`, left: '12px' }}>
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
                  <div className="flex border-b border-neutral-100">
                    <button onClick={() => { setHiddenDays(new Set()); fitVisible(places); }}
                      className="flex-1 py-2 text-xs font-semibold text-brand-500 hover:bg-brand-50 active:bg-brand-100 transition-colors border-l border-neutral-100">
                      הכל
                    </button>
                    <button onClick={() => setHiddenDays(new Set(tripDays))}
                      className="flex-1 py-2 text-xs font-semibold text-neutral-400 hover:bg-neutral-50 active:bg-neutral-100 transition-colors">
                      ללא
                    </button>
                  </div>
                  {tripDays.map((date, idx) => {
                    const hidden = hiddenDays.has(date);
                    const color  = getDayColor(idx);
                    const count  = dayCounts.get(date) ?? 0;
                    return (
                      <button key={date} onClick={() => toggleDay(date)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 w-full transition-colors hover:bg-neutral-50 active:bg-neutral-100 ${hidden ? 'opacity-35' : ''}`}>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-sm font-semibold text-neutral-800">{formatDayLabel(date)}</span>
                        {count > 0 && <span className="text-xs text-neutral-400 ml-1">{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <button
              onClick={() => setDayFilterOpen(prev => !prev)}
              style={{ bottom: `${places.length && !showAdd ? panelHeight + 12 : 12}px`, left: '12px' }}
              className={`absolute z-[500] w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-colors ${
                dayFilterOpen ? 'bg-neutral-800 text-white' : 'bg-white/95 text-neutral-600'
              }`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="10" y1="18" x2="14" y2="18"/>
              </svg>
            </button>
          </>
        )}

        {places.length > 0 && !showAdd && (
          <PlacesPanel
            places={places}
            tripDays={tripDays}
            height={panelHeight}
            onHeightChange={setPanelHeight}
            onSelect={handleListSelect}
          />
        )}
      </div>

      {/* Reorder drawer */}
      {showReorder && tripId && (
        <ReorderDrawer
          places={places}
          tripId={tripId}
          tripDays={tripDays}
          onClose={() => setShowReorder(false)}
          onSaved={updated => setPlaces(updated)}
        />
      )}

      {/* Modals */}
      {showAdd && tripId && (
        <AddPlaceModal tripId={tripId} tripDays={tripDays}
          onClose={() => setShowAdd(false)} onAdded={handleAdded} />
      )}
      {selected && (
        <PlaceDetailModal place={selected} tripDays={tripDays}
          onClose={() => setSelected(null)}
          onDeleted={handleDeleted}
          onPhotoAdded={handlePhotoAdded}
          onPhotoDeleted={handlePhotoDeleted}
          onDateChanged={handleDateChanged}
          onCategoryChanged={handleCategoryChanged} />
      )}
    </AppShell>
  );
};
