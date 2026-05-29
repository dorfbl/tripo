import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { AppShell, NAV_H } from '../components/layout/AppShell';
import apiClient from '../api/client';

const GKEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string;
const LIBRARIES: ('places')[] = ['places'];

// ─── טיפוסים ────────────────────────────────────────────────────────────────
interface PlacePhoto { id: string; url: string; caption: string | null }
interface Place {
  id: string; name: string; lat: number; lng: number;
  notes: string | null; order: number;
  photos: PlacePhoto[];
}

// ─── Geocoding דרך proxy בשרת ────────────────────────────────────────────────
interface GeoResult { placeId?: string; lat?: number; lng?: number; name: string; subtitle: string }

async function searchPlaces(query: string): Promise<GeoResult[]> {
  try {
    const res = await apiClient.get(`/api/geocode/search?q=${encodeURIComponent(query)}`);
    return res.data.results ?? [];
  } catch { return []; }
}

async function fetchPlaceCoords(placeId: string): Promise<{ lat: number; lng: number; name: string } | null> {
  try {
    const res = await apiClient.get(`/api/geocode/details/${placeId}`);
    return res.data;
  } catch { return null; }
}

// ─── מודל הוספת מקום ─────────────────────────────────────────────────────────
interface AddPlaceModalProps {
  tripId: string;
  onClose: () => void;
  onAdded: (place: Place) => void;
}

const AddPlaceModal: React.FC<AddPlaceModalProps> = ({ tripId, onClose, onAdded }) => {
  const [query,       setQuery]       = useState('');
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [selected,    setSelected]    = useState<GeoResult | null>(null);
  const [name,        setName]        = useState('');
  const [notes,       setNotes]       = useState('');
  const [saving,      setSaving]      = useState(false);
  const [resolving,   setResolving]   = useState(false);
  const [error,       setError]       = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSelected(null);
    setSuggestions([]);
    setError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) return;
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchPlaces(val.trim());
      setSearching(false);
      setSuggestions(results);
      if (results.length === 0) setError('לא נמצאו תוצאות');
    }, 450);
  };

  const handlePick = async (r: GeoResult) => {
    setSuggestions([]);
    setQuery(r.name);
    if (!name) setName(r.name);
    if (r.lat != null && r.lng != null) { setSelected(r); return; }
    if (!r.placeId) return;
    setResolving(true);
    const details = await fetchPlaceCoords(r.placeId);
    setResolving(false);
    if (!details) { setError('לא ניתן לקבל מיקום'); return; }
    setSelected({ ...r, lat: details.lat, lng: details.lng });
    if (!name) setName(details.name || r.name);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('שם המקום חסר'); return; }
    if (!selected?.lat) { setError('בחר מקום מהרשימה'); return; }
    setSaving(true);
    try {
      const res = await apiClient.post(`/api/places/${tripId}`, {
        name: name.trim(), lat: selected.lat, lng: selected.lng, notes,
      });
      onAdded(res.data.place);
    } catch { setError('שגיאה בשמירה'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-end justify-center"
      onTouchMove={e => e.preventDefault()}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-lg rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '85dvh' }}
        onTouchMove={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="font-bold text-neutral-900">הוספת מקום</h2>
          <button onClick={onClose} className="text-neutral-400 text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden flex-1 px-5 py-4 flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">חיפוש מקום</label>
            <div className="relative">
              <input type="text" value={query} onChange={e => handleQueryChange(e.target.value)}
                placeholder="מגדל אייפל, יורו דיסני, רומא..." autoComplete="off"
                className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 pl-8"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-sm pointer-events-none">
                {(searching || resolving) ? '⟳' : '🔍'}
              </span>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-1 border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                {suggestions.map((r, i) => (
                  <button key={i} onClick={() => handlePick(r)}
                    className="w-full flex flex-col items-start px-4 py-3 hover:bg-brand-50 active:bg-brand-100 transition-colors border-b border-neutral-100 last:border-0 text-right"
                  >
                    <span className="text-sm font-medium text-neutral-900">{r.name}</span>
                    <span className="text-xs text-neutral-400 mt-0.5">{r.subtitle}</span>
                  </button>
                ))}
              </div>
            )}
            {suggestions.length === 0 && !searching && query.length >= 2 && !selected && error && (
              <p className="text-xs text-neutral-400 mt-1.5">💡 נסה גם בשפה המקומית</p>
            )}
          </div>

          {selected && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <span className="text-green-500">✓</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 truncate">{selected.name}</p>
                <p className="text-xs text-green-600 truncate">{selected.subtitle}</p>
              </div>
              <button onClick={() => { setSelected(null); setQuery(''); }}
                className="text-green-400 text-lg leading-none flex-shrink-0">×</button>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">
              שם לתצוגה <span className="text-xs font-normal text-neutral-400">ניתן לשינוי</span>
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="שם המקום"
              className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 block mb-1.5">הערות (אופציונלי)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="מה עשינו שם, טיפים..." rows={3}
              className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {error && !suggestions.length && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex-shrink-0 px-5 py-4 border-t border-neutral-100">
          <button onClick={handleSave}
            disabled={saving || resolving || !selected || selected.lat == null || !name.trim()}
            className="w-full py-3 bg-brand-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
          >
            {saving ? 'שומר...' : '+ הוסף למסלול'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── מודל פרטי מקום ───────────────────────────────────────────────────────────
interface PlaceDetailModalProps {
  place: Place;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onPhotoAdded: (placeId: string, photo: PlacePhoto) => void;
  onPhotoDeleted: (placeId: string, photoId: string) => void;
}

const PlaceDetailModal: React.FC<PlaceDetailModalProps> = ({
  place, onClose, onDeleted, onPhotoAdded, onPhotoDeleted,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('photo', file);
      const res = await apiClient.post(`/api/places/${place.id}/photos`, form, {
        headers: { 'Content-Type': undefined },
      });
      onPhotoAdded(place.id, res.data.photo);
    } catch { alert('שגיאה בהעלאת תמונה'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleDelete = async () => {
    if (!confirm(`למחוק את "${place.name}"?`)) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/api/places/${place.id}`);
      onDeleted(place.id);
    } catch { alert('שגיאה במחיקה'); setDeleting(false); }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await apiClient.delete(`/api/places/photos/${photoId}`);
      onPhotoDeleted(place.id, photoId);
    } catch { alert('שגיאה במחיקת תמונה'); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-end justify-center"
      onTouchMove={e => e.preventDefault()}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-lg rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '85dvh' }}
        onTouchMove={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div>
            <h2 className="font-bold text-neutral-900">{place.name}</h2>
            {place.notes && <p className="text-xs text-neutral-400 mt-0.5">{place.notes}</p>}
          </div>
          <button onClick={onClose} className="text-neutral-400 text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden flex-1 px-5 py-4 flex flex-col gap-4">
          <div className="flex gap-2">
            <a href={`https://www.google.com/maps?q=${place.lat},${place.lng}`}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 py-2.5 border border-brand-500 text-brand-500 rounded-xl text-sm font-medium text-center"
            >🗺️ Google Maps</a>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex-1 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >{uploading ? 'מעלה...' : '📷 הוסף תמונה'}</button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>

          {place.photos.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-2">תמונות ({place.photos.length})</p>
              <div className="grid grid-cols-3 gap-1.5">
                {place.photos.map(photo => (
                  <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden group">
                    <img src={photo.url} alt={photo.caption || place.name} className="w-full h-full object-cover" />
                    <button onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute top-1 left-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity"
                    >×</button>
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
            className="w-full py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-medium disabled:opacity-50"
          >{deleting ? 'מוחק...' : 'מחק מקום'}</button>
        </div>
      </div>
    </div>
  );
};

// ─── MapPage ─────────────────────────────────────────────────────────────────
const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'greedy',
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
};

export const MapPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const [places,   setPlaces]   = useState<Place[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GKEY,
    libraries: LIBRARIES,
    language: 'he',
  });

  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      const res = await apiClient.get(`/api/places/${tripId}`);
      setPlaces(res.data.places);
    } catch { /**/ }
    finally { setLoading(false); }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  // מרכז המפה
  const center = places.length
    ? { lat: places.reduce((s, p) => s + p.lat, 0) / places.length,
        lng: places.reduce((s, p) => s + p.lng, 0) / places.length }
    : { lat: 31.5, lng: 35.0 };

  const handleAdded = (place: Place) => {
    setPlaces(prev => [...prev, place]);
    setShowAdd(false);
    mapRef.current?.panTo({ lat: place.lat, lng: place.lng });
  };

  const handleDeleted = (id: string) => { setPlaces(prev => prev.filter(p => p.id !== id)); setSelected(null); };

  const handlePhotoAdded = (placeId: string, photo: PlacePhoto) => {
    setPlaces(prev => prev.map(p => p.id === placeId ? { ...p, photos: [...p.photos, photo] } : p));
    setSelected(prev => prev?.id === placeId ? { ...prev, photos: [...prev.photos, photo] } : prev);
  };

  const handlePhotoDeleted = (placeId: string, photoId: string) => {
    setPlaces(prev => prev.map(p => p.id === placeId ? { ...p, photos: p.photos.filter(ph => ph.id !== photoId) } : p));
    setSelected(prev => prev?.id === placeId ? { ...prev, photos: prev.photos.filter(ph => ph.id !== photoId) } : prev);
  };

  const routePath = places.map(p => ({ lat: p.lat, lng: p.lng }));


  return (
    <AppShell showBottomNav noPadding>
      {/* כפתור הוספת מקום */}
      <button
        onClick={() => setShowAdd(true)}
        className="absolute top-4 left-4 z-[500] w-10 h-10 bg-brand-500 text-white rounded-full shadow-lg text-2xl flex items-center justify-center active:bg-brand-600 transition-colors"
      >+</button>

      {/* מספר מקומות */}
      {places.length > 0 && (
        <div className="absolute top-4 right-4 z-[500] bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow text-xs font-semibold text-neutral-700">
          📍 {places.length} מקומות
        </div>
      )}

      {/* Google Map */}
      {isLoaded && !loading ? (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: `calc(100dvh - ${NAV_H}px)` }}
          center={center}
          zoom={places.length ? 10 : 7}
          options={MAP_OPTIONS}
          onLoad={map => { mapRef.current = map; }}
        >
          {/* קו מסלול */}
          {routePath.length >= 2 && (
            <Polyline
              path={routePath}
              options={{ strokeColor: '#4F6EF7', strokeWeight: 3, strokeOpacity: 0.8, geodesic: true }}
            />
          )}

          {/* סמנים */}
          {places.map((place, idx) => (
            <Marker
              key={place.id}
              position={{ lat: place.lat, lng: place.lng }}
              label={{ text: String(idx + 1), color: 'white', fontWeight: 'bold', fontSize: '12px' }}
              onClick={() => setSelected(place)}
            >
              {selected?.id === place.id && (
                <InfoWindow onCloseClick={() => setSelected(null)}>
                  <div dir="rtl" className="text-right min-w-[120px]">
                    <p className="font-semibold text-sm">{place.name}</p>
                    {place.notes && <p className="text-xs text-gray-500 mt-0.5">{place.notes}</p>}
                    {place.photos.length > 0 && <p className="text-xs text-gray-400 mt-0.5">📷 {place.photos.length}</p>}
                    <button
                      onClick={() => setSelected(place)}
                      className="mt-1.5 text-xs text-blue-600 underline"
                    >פרטים ותמונות</button>
                  </div>
                </InfoWindow>
              )}
            </Marker>
          ))}
        </GoogleMap>
      ) : (
        <div className="flex items-center justify-center text-neutral-400"
          style={{ height: `calc(100dvh - ${NAV_H}px)` }}>
          טוען מפה...
        </div>
      )}

      {/* רשימה תחתונה */}
      {places.length > 0 && !showAdd && (
        <div className="absolute z-[500] left-0 right-0 px-3"
          style={{ bottom: `calc(${NAV_H}px + env(safe-area-inset-bottom, 0px) + 8px)` }}>
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg overflow-x-auto">
            <div className="flex gap-2 p-2.5">
              {places.map((place, idx) => (
                <button key={place.id} onClick={() => {
                  setSelected(place);
                  mapRef.current?.panTo({ lat: place.lat, lng: place.lng });
                  mapRef.current?.setZoom(14);
                }}
                  className="flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-neutral-50 active:bg-neutral-100 transition-colors min-w-[68px]"
                >
                  <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-neutral-700 font-medium text-center leading-tight max-w-[68px] truncate">
                    {place.name}
                  </span>
                  {place.photos.length > 0 && (
                    <span className="text-[10px] text-neutral-400">📷{place.photos.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* מצב ריק */}
      {!loading && places.length === 0 && !showAdd && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]"
          style={{ bottom: `${NAV_H}px` }}>
          <div className="bg-white rounded-2xl shadow-lg px-6 py-5 text-center mx-4">
            <p className="text-3xl mb-2">🗺️</p>
            <p className="font-semibold text-neutral-800 mb-1">אין מקומות עדיין</p>
            <p className="text-sm text-neutral-400">לחץ + כדי להוסיף מקום</p>
          </div>
        </div>
      )}

      {/* מודלים */}
      {showAdd && tripId && (
        <AddPlaceModal tripId={tripId} onClose={() => setShowAdd(false)} onAdded={handleAdded} />
      )}
      {selected && (
        <PlaceDetailModal
          place={selected}
          onClose={() => setSelected(null)}
          onDeleted={handleDeleted}
          onPhotoAdded={handlePhotoAdded}
          onPhotoDeleted={handlePhotoDeleted}
        />
      )}
    </AppShell>
  );
};
