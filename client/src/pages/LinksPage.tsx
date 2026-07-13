import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useTripStore } from '../store/tripStore';
import type { TripLink, TripLinkType, TripLinkStatus } from '../types';

// ─── constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<TripLinkType, string> = {
  FLIGHT: 'טיסה', HOTEL: 'לינה', CAR: 'רכב', ACTIVITY: 'אטרקציה',
  RESTAURANT: 'מסעדה', BAR: 'בר', MAP: 'מפה', INSURANCE: 'ביטוח',
  DOCUMENT: 'מסמך', PAYMENT: 'תשלום', OTHER: 'אחר',
};

const TYPE_ICONS: Record<TripLinkType, string> = {
  FLIGHT: '✈️', HOTEL: '🏨', CAR: '🚗', ACTIVITY: '🎯',
  RESTAURANT: '🍽️', BAR: '🍻', MAP: '🗺️', INSURANCE: '🛡️',
  DOCUMENT: '📄', PAYMENT: '💳', OTHER: '📌',
};

const STATUS_LABELS: Record<TripLinkStatus, string> = {
  SAVED: 'שמור', PENDING: 'בהמתנה', BOOKED: 'הוזמן',
  PAID: 'שולם', MISSING: 'חסר', CANCELLED: 'בוטל',
};

const STATUS_COLORS: Record<TripLinkStatus, string> = {
  SAVED: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-amber-100 text-amber-700',
  BOOKED: 'bg-indigo-100 text-indigo-700',
  PAID: 'bg-green-100 text-green-700',
  MISSING: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-neutral-100 text-neutral-500',
};

const ALL_STATUSES: TripLinkStatus[] = ['SAVED', 'PENDING', 'BOOKED', 'PAID', 'MISSING', 'CANCELLED'];
const ALL_TYPES: TripLinkType[] = ['FLIGHT', 'HOTEL', 'CAR', 'ACTIVITY', 'RESTAURANT', 'BAR', 'MAP', 'INSURANCE', 'DOCUMENT', 'PAYMENT', 'OTHER'];

// ─── LinkCard ─────────────────────────────────────────────────────────────────

interface LinkCardProps {
  link: TripLink;
  isAdmin: boolean;
  myUserId: string;
  onPin: (linkId: string) => void;
  onDelete: (linkId: string) => void;
  onStatusTap: (link: TripLink) => void;
  onEdit: (linkId: string) => void;
}

const LinkCard: React.FC<LinkCardProps> = ({ link, isAdmin, myUserId, onPin, onDelete, onStatusTap, onEdit }) => {
  const canDelete = link.createdByUserId === myUserId || isAdmin;
  const canEdit = link.createdByUserId === myUserId || isAdmin;

  const safeUrl = link.url
    ? (/^https?:\/\//i.test(link.url) ? link.url : `https://${link.url}`)
    : null;

  const displayUrl = link.url
    ? link.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
    : null;

  const isImage = link.fileUrl && /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(link.fileUrl);

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${link.isPinned ? 'border-brand-200' : 'border-neutral-200'}`}>
      <div className="p-4">
        {/* Top row: badges */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className="text-xs font-medium text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
            {TYPE_ICONS[link.type]} {TYPE_LABELS[link.type]}
          </span>
          <button
            onClick={() => onStatusTap(link)}
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[link.status]}`}
          >
            {STATUS_LABELS[link.status]}
          </button>
          {link.isPrivate && (
            <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">🔒 פרטי</span>
          )}
          {link.isPinned && (
            <span className="text-xs text-brand-500 font-bold">📌</span>
          )}
          <div className="flex-1" />
          {isAdmin && (
            <button
              onClick={() => onPin(link.id)}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                link.isPinned ? 'text-brand-500 bg-brand-50' : 'text-neutral-400 bg-neutral-100'
              }`}
            >
              {link.isPinned ? 'בטל נעיצה' : 'נעץ'}
            </button>
          )}
        </div>

        {/* Title + open buttons */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {(safeUrl || link.fileUrl) ? (
              <a
                href={safeUrl ?? link.fileUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-right active:opacity-70"
              >
                <h3 className="font-bold text-base leading-snug text-brand-600">{link.title}</h3>
              </a>
            ) : (
              <h3 className="font-bold text-base leading-snug text-neutral-900">{link.title}</h3>
            )}
            {displayUrl && (
              <p className="text-xs text-neutral-400 mt-0.5 truncate">{displayUrl}</p>
            )}
            {link.fileName && (
              <p className="text-xs text-neutral-400 mt-0.5 truncate">📎 {link.fileName}</p>
            )}
            {link.description && (
              <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{link.description}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5 flex-shrink-0 mt-0.5">
            {safeUrl && (
              <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 active:opacity-70">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
              </a>
            )}
            {link.fileUrl && (
              <a href={link.fileUrl} target="_blank" rel="noopener noreferrer" className="text-neutral-500 active:opacity-70">
                {isImage ? (
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                )}
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-100">
          <span className="text-xs text-neutral-400 flex-1">{link.createdBy.name}</span>
          {canEdit && (
            <button
              onClick={() => onEdit(link.id)}
              className="text-xs text-neutral-500 font-medium px-2 py-1 rounded-lg bg-neutral-100 active:bg-neutral-200"
            >
              עריכה
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(link.id)}
              className="text-xs text-red-500 font-medium px-2 py-1 rounded-lg bg-red-50 active:bg-red-100"
            >
              מחק
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

type PrivacyFilter = 'all' | 'public' | 'mine';

export const LinksPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentTrip, loadTrip } = useTripStore();

  const [links, setLinks] = useState<TripLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TripLinkType | 'all'>('all');
  const [privacyFilter, setPrivacyFilter] = useState<PrivacyFilter>('all');
  const [statusModal, setStatusModal] = useState<TripLink | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Only trust currentTrip when it matches the URL trip
  const trip = currentTrip?.id === tripId ? currentTrip : null;
  const myMember = trip?.members.find(m => m.userId === user?.id);
  const isAdmin = myMember?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      // Ensure trip context matches URL (deep-links from notifications)
      if (useTripStore.getState().currentTrip?.id !== tripId) {
        await loadTrip(tripId);
      }
      const { data } = await apiClient.get<TripLink[]>(`/api/links/${tripId}`);
      setLinks(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tripId, loadTrip]);

  useEffect(() => {
    setLoading(true);
    setLinks([]); // clear previous trip's links immediately
    load();
  }, [load]);

  const filtered = links.filter(l => {
    const matchesSearch = !search || l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.description?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || l.type === typeFilter;
    const matchesPrivacy =
      privacyFilter === 'all' ? true :
      privacyFilter === 'public' ? !l.isPrivate :
      l.createdByUserId === user?.id;
    return matchesSearch && matchesType && matchesPrivacy;
  });

  const pinned = filtered.filter(l => l.isPinned);
  const unpinned = filtered.filter(l => !l.isPinned);

  const handlePin = async (linkId: string) => {
    try {
      const { data } = await apiClient.patch<TripLink>(`/api/links/${linkId}/pin`);
      setLinks(prev => prev.map(l => l.id === linkId ? data : l));
    } catch {
      // silent
    }
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm('למחוק את הקישור?')) return;
    try {
      await apiClient.delete(`/api/links/${linkId}`);
      setLinks(prev => prev.filter(l => l.id !== linkId));
    } catch {
      // silent
    }
  };

  const handleStatusChange = async (status: TripLinkStatus) => {
    if (!statusModal) return;
    setUpdatingStatus(true);
    try {
      const { data } = await apiClient.patch<TripLink>(`/api/links/${statusModal.id}/status`, { status });
      setLinks(prev => prev.map(l => l.id === data.id ? data : l));
      setStatusModal(null);
    } catch {
      // silent
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <AppShell showBottomNav>
      <div>
        <div className="mb-3">
          <h1 className="text-xl font-bold text-neutral-900">🔗 קישורים והזמנות</h1>
          {trip?.name && (
            <p className="text-xs text-brand-600 font-medium mt-0.5">✈️ {trip.name}</p>
          )}
        </div>
        {/* Search + new button */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש..."
              className="w-full border border-neutral-200 rounded-xl pr-9 pl-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 bg-white"
            />
          </div>
          <button
            onClick={() => navigate(`/trip/${tripId}/links/new`)}
            className="flex-shrink-0 text-sm font-bold px-3 py-2.5 rounded-xl bg-brand-500 text-white active:bg-brand-600"
          >
            + קישור
          </button>
        </div>

        {/* Privacy filter */}
        <div className="flex gap-1.5 mb-2">
          {([['all', 'הכול'], ['public', 'ציבורי'], ['mine', 'שלי']] as [PrivacyFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPrivacyFilter(key)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                privacyFilter === key ? 'bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {key === 'mine' ? '🔒 ' : ''}{label}
            </button>
          ))}
        </div>

        {/* Type filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 no-scrollbar">
          <button
            onClick={() => setTypeFilter('all')}
            className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
              typeFilter === 'all' ? 'bg-neutral-700 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            כל הסוגים
          </button>
          {ALL_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                typeFilter === t ? 'bg-neutral-700 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {TYPE_ICONS[t]} {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-12 text-neutral-400 text-sm">טוען...</div>
        )}

        {!loading && links.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="text-4xl mb-3">🔗</div>
            <h3 className="font-bold text-neutral-800 text-lg mb-2">אין עדיין קישורים</h3>
            <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
              שמרו כאן קישורים לטיסות, מלונות, אטרקציות<br />
              וכל דבר אחר שקשור לטיול.
            </p>
            <button
              onClick={() => navigate(`/trip/${tripId}/links/new`)}
              className="bg-brand-500 text-white font-bold px-6 py-3 rounded-2xl active:bg-brand-600"
            >
              + הוסף קישור ראשון
            </button>
          </div>
        )}

        {!loading && links.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 text-neutral-400 text-sm">לא נמצאו קישורים</div>
        )}

        {pinned.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-neutral-500 mb-2">📌 נעוצים</p>
            <div className="flex flex-col gap-3">
              {pinned.map(link => (
                <LinkCard key={link.id} link={link} isAdmin={isAdmin} myUserId={user?.id ?? ''}
                  onPin={handlePin} onDelete={handleDelete} onStatusTap={setStatusModal}
                  onEdit={id => navigate(`/trip/${tripId}/links/edit/${id}`)} />
              ))}
            </div>
          </div>
        )}

        {unpinned.length > 0 && (
          <div className="flex flex-col gap-3">
            {pinned.length > 0 && <p className="text-xs font-bold text-neutral-500 mt-1">שאר הקישורים</p>}
            {unpinned.map(link => (
              <LinkCard key={link.id} link={link} isAdmin={isAdmin} myUserId={user?.id ?? ''}
                onPin={handlePin} onDelete={handleDelete} onStatusTap={setStatusModal}
                onEdit={id => navigate(`/trip/${tripId}/links/edit/${id}`)} />
            ))}
          </div>
        )}
      </div>

      {/* Status change sheet */}
      {statusModal && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setStatusModal(null)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl p-6 pb-10">
            <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-4" />
            <h2 className="text-base font-bold text-neutral-900 mb-1 truncate">{statusModal.title}</h2>
            <p className="text-sm text-neutral-500 mb-4">בחר סטטוס</p>
            <div className="flex flex-col gap-2">
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  disabled={updatingStatus}
                  onClick={() => handleStatusChange(s)}
                  className={`text-right px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    statusModal.status === s
                      ? 'border-brand-400 bg-brand-50 text-brand-800'
                      : 'border-neutral-200 text-neutral-700 active:bg-neutral-50'
                  } disabled:opacity-50`}
                >
                  {STATUS_LABELS[s]}{statusModal.status === s && ' ✓'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
