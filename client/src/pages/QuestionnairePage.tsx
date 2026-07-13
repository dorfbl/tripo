import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';
import { AppShell } from '../components/layout/AppShell';
import { PlanSubNav } from '../components/layout/PlanSubNav';
import apiClient from '../api/client';

// ─── Constants ────────────────────────────────────────────────────────────────

const VOTE_OPTIONS = [
  { id: 'MUST',       label: 'חייב לעשות!',   emoji: '🔥', activeBg: 'bg-green-500 border-green-500 text-white',           bar: 'bg-green-500'  },
  { id: 'OK',         label: 'אוקיי לעשות',    emoji: '👍', activeBg: 'bg-green-100 border-green-400 text-green-900',       bar: 'bg-green-300'  },
  { id: 'IF_OTHERS',  label: 'אם אחרים רוצים', emoji: '🤷', activeBg: 'bg-neutral-200 border-neutral-400 text-neutral-800', bar: 'bg-neutral-400' },
  { id: 'NOT_REALLY', label: 'לא ממש',         emoji: '👎', activeBg: 'bg-orange-100 border-orange-400 text-orange-900',    bar: 'bg-orange-400' },
  { id: 'AGAINST',    label: 'ממש לא בא לי',   emoji: '❌', activeBg: 'bg-red-100 border-red-400 text-red-900',             bar: 'bg-red-500'    },
] as const;

type VoteId = typeof VOTE_OPTIONS[number]['id'];

/** Generic category labels — not trip-specific (no מינכן/יער) */
const CAT_LABELS: Record<string, string> = {
  nature: 'טבע',
  culture: 'תרבות',
  activity: 'פעילות',
  travel: 'נסיעה',
  food: 'אוכל',
  special: 'מיוחד',
  other: 'כללי',
  // legacy demo ids (if still present on old trips)
  forest: 'טבע',
  munich: 'תרבות',
};
const CAT_ORDER = ['nature', 'culture', 'activity', 'travel', 'food', 'special', 'other', 'forest', 'munich'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityFile { id: string; filename: string; originalName: string; mimeType: string; }
interface Activity {
  id: string; name: string; emoji: string; location?: string; description?: string;
  durationMins: number; cost?: string; category: string; mapsUrl?: string; url?: string; color: string;
  files: ActivityFile[];
}
interface VoteSummary {
  activityId: string;
  MUST: number; OK: number; IF_OTHERS: number; NOT_REALLY: number; AGAINST: number;
  voters?: Partial<Record<VoteId, Array<{ id: string; name: string; avatarUrl: string | null }>>>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const QuestionnairePage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentTrip, loadTrip } = useTripStore();

  const [activities, setActivities]   = useState<Activity[]>([]);
  const [myVotes,    setMyVotes]      = useState<Record<string, VoteId>>({});
  const [allVotes,   setAllVotes]     = useState<VoteSummary[]>([]);
  const [view,       setView]         = useState<'quiz' | 'results'>('quiz');
  const [leaving,    setLeaving]      = useState(false);
  const [loading,    setLoading]      = useState(true);
  const [saving,     setSaving]       = useState<string | null>(null);
  const [totalCount, setTotalCount]   = useState(0);

  const catSort = useCallback((a: Activity, b: Activity) => {
    const ai = CAT_ORDER.indexOf(a.category as typeof CAT_ORDER[number]);
    const bi = CAT_ORDER.indexOf(b.category as typeof CAT_ORDER[number]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  }, []);

  // Only unvoted activities, sorted by category
  const unvoted = useMemo(
    () => activities.filter(a => myVotes[a.id] === undefined).sort(catSort),
    [activities, myVotes, catSort],
  );

  useEffect(() => {
    if (!tripId) return;
    if (!currentTrip) loadTrip(tripId);
    Promise.all([
      apiClient.get(`/api/planner/${tripId}`),
      apiClient.get(`/api/planner/${tripId}/votes/mine`),
      apiClient.get(`/api/planner/${tripId}/votes`),
    ]).then(([pr, mr, ar]) => {
      const acts = pr.data.activities ?? [];
      setActivities(acts);
      setTotalCount(acts.length);
      const mv: Record<string, VoteId> = mr.data.votes ?? {};
      setMyVotes(mv);
      setAllVotes(ar.data.votes ?? []);
      if (Object.keys(mv).length > 0) setView('results');
    }).finally(() => setLoading(false));
  }, [tripId]);

  const saveVote = useCallback(async (activityId: string, vote: VoteId) => {
    setSaving(activityId);
    try {
      await apiClient.post(`/api/planner/${tripId}/votes`, { votes: [{ activityId, vote }] });
      const ar = await apiClient.get(`/api/planner/${tripId}/votes`);
      setAllVotes(ar.data.votes ?? []);
    } finally { setSaving(null); }
  }, [tripId]);

  const handleQuizVote = useCallback((vote: VoteId) => {
    const act = unvoted[0];
    if (!act) return;
    setMyVotes(prev => ({ ...prev, [act.id]: vote }));
    saveVote(act.id, vote);
    if (unvoted.length <= 1) {
      setView('results');
    } else {
      setLeaving(true);
      setTimeout(() => setLeaving(false), 180);
    }
  }, [unvoted, saveVote]);

  const handleInlineVote = useCallback(async (activityId: string, vote: VoteId) => {
    setMyVotes(prev => ({ ...prev, [activityId]: vote }));
    await saveVote(activityId, vote);
  }, [saveVote]);

  const startQuiz = useCallback(() => { setView('quiz'); }, []);

  // ── Loading / empty states ──

  if (loading) return (
    <AppShell showBottomNav>
      <PlanSubNav />
      <div className="text-center py-12 text-neutral-400 text-sm">טוען...</div>
    </AppShell>
  );

  if (activities.length === 0) return (
    <AppShell showBottomNav>
      <PlanSubNav />
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="text-6xl mb-4">📭</div>
        <h2 className="text-lg font-bold text-neutral-800 mb-2">אין פעילויות עדיין</h2>
        <p className="text-sm text-neutral-500 mb-6">הוסף פעילויות במתכנן הטיול כדי להתחיל שאלון</p>
        <button
          onClick={() => navigate(`/trip/${tripId}/plan/schedule`)}
          className="bg-brand-500 text-white px-6 py-2.5 rounded-xl font-medium text-sm"
        >
          עבור ללוח זמנים
        </button>
      </div>
    </AppShell>
  );

  const act = unvoted[0];
  const thumbnail = act?.files?.find(f => f.mimeType.startsWith('image/'));
  const durLabel = (m: number) => {
    const h = Math.floor(m / 60), mm = m % 60;
    return h && mm ? `${h}ש' ${mm}ד'` : h ? `${h}ש'` : `${mm}ד'`;
  };

  // ── Quiz: all unvoted done ──
  const quizDone = view === 'quiz' && unvoted.length === 0;

  return (
    <AppShell showBottomNav>
      <PlanSubNav />

      {/* Quiz / results toggle */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-bold text-neutral-900 text-base">🗳️ הצבעה על פעילויות</h1>
        <div className="flex gap-1">
          <button onClick={startQuiz}
            className={`relative text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${view === 'quiz' ? 'bg-brand-500 text-white' : 'text-neutral-600 bg-neutral-100'}`}>
            שאלון
            {unvoted.length > 0 && (
              <span className="absolute -top-1 -left-1 bg-amber-400 text-white text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                {unvoted.length}
              </span>
            )}
          </button>
          <button onClick={() => setView('results')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${view === 'results' ? 'bg-brand-500 text-white' : 'text-neutral-600 bg-neutral-100'}`}>
            תוצאות
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">

      {/* Quiz — all done */}
      {quizDone && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-lg font-bold text-neutral-800 mb-2">הצבעת על הכל!</h2>
          <p className="text-sm text-neutral-500 mb-6">ניתן לשנות הצבעות בכל עת דרך התוצאות</p>
          <button onClick={() => setView('results')}
            className="bg-brand-500 text-white px-6 py-3 rounded-xl font-bold text-sm">
            לתוצאות ←
          </button>
        </div>
      )}

      {/* Quiz — voting */}
      {view === 'quiz' && !quizDone && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Progress */}
          <div className="px-4 pt-3 pb-2 flex-shrink-0">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
              <span className="font-medium">נשארו {unvoted.length} לא מוצבעות</span>
              <button onClick={() => setView('results')} className="text-brand-500 font-semibold">
                חזור לתוצאות ←
              </button>
            </div>
            <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-300"
                style={{ width: `${((totalCount - unvoted.length) / Math.max(totalCount, 1)) * 100}%` }} />
            </div>
          </div>

          {/* Scrollable */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className={`max-w-lg mx-auto transition-all duration-[180ms] ${leaving ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>

              {/* Activity card */}
              <div className="bg-white rounded-3xl shadow-md overflow-hidden mb-4">
                {thumbnail ? (
                  <img src={`/uploads/planner/${thumbnail.filename}`} alt={act.name} className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-28 bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center">
                    <span className="text-7xl">{act.emoji}</span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start gap-2 mb-2.5">
                    {thumbnail && <span className="text-xl mt-0.5 flex-shrink-0">{act.emoji}</span>}
                    <div>
                      <h2 className="text-lg font-bold text-neutral-900 leading-tight">{act.name}</h2>
                      {act.location && <p className="text-sm text-neutral-500 mt-0.5">📍 {act.location}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {act.cost && <span className="text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full">💰 {act.cost}</span>}
                    <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">⏱ {durLabel(act.durationMins)}</span>
                    {act.mapsUrl && <a href={act.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-blue-50 border border-blue-200 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-100">🗺️ מפה</a>}
                    {act.url    && <a href={act.url}    target="_blank" rel="noopener noreferrer" className="text-xs bg-blue-50 border border-blue-200 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-100">🔗 קישור</a>}
                  </div>
                  {act.description && <p className="text-sm text-neutral-600 leading-relaxed">{act.description}</p>}
                </div>
              </div>

              {/* Vote buttons */}
              <div className="flex flex-col gap-2 mb-3">
                {VOTE_OPTIONS.map(opt => {
                  const selected = myVotes[act.id] === opt.id;
                  return (
                    <button key={opt.id} onClick={() => handleQuizVote(opt.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 font-semibold text-sm transition-all active:scale-[0.98] ${
                        selected ? `${opt.activeBg} shadow-sm` : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                      }`}>
                      <span className="text-2xl">{opt.emoji}</span>
                      <span className="flex-1 text-right">{opt.label}</span>
                      {selected && <span className="opacity-70">✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Back to results */}
              <button onClick={() => setView('results')}
                className="w-full py-3 text-sm text-neutral-500 border border-neutral-200 rounded-xl hover:bg-neutral-50">
                חזור לתוצאות
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {view === 'results' && (
        <ResultsView
          tripId={tripId!}
          activities={activities}
          allVotes={allVotes}
          myVotes={myVotes}
          saving={saving}
          unvotedCount={unvoted.length}
          onStartQuiz={startQuiz}
          onVote={handleInlineVote}
        />
      )}
      </div>
    </AppShell>
  );
};

// ─── Results View ─────────────────────────────────────────────────────────────

type AddToMapState =
  | { status: 'geocoding'; name: string }
  | { status: 'confirm'; name: string; displayName: string; lat: number; lng: number; mapsUrl?: string }
  | { status: 'saving' }
  | { status: 'done'; name: string }
  | { status: 'error' }
  | null;

const ResultsView: React.FC<{
  tripId:        string;
  activities:    Activity[];
  allVotes:      VoteSummary[];
  myVotes:       Record<string, VoteId>;
  saving:        string | null;
  unvotedCount:  number;
  onStartQuiz:   () => void;
  onVote:        (activityId: string, vote: VoteId) => void;
}> = ({ tripId, activities, allVotes, myVotes, saving, unvotedCount, onStartQuiz, onVote }) => {

  const [addToMap, setAddToMap] = useState<AddToMapState>(null);

  const handleAddToMap = async (name: string, mapsUrl?: string) => {
    setAddToMap({ status: 'geocoding', name });
    try {
      let q = name;
      if (mapsUrl) {
        try {
          const u = new URL(mapsUrl);
          const qParam = u.searchParams.get('q');
          if (qParam) q = qParam;
        } catch { /* ignore */ }
      }
      const res = await apiClient.get(`/api/geocode/search?q=${encodeURIComponent(q)}`);
      const results = res.data.results ?? [];
      if (!results.length) { setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000); return; }
      const top = results[0];
      if (top.lat == null && top.placeId) {
        const det = await apiClient.get(`/api/geocode/details/${top.placeId}`);
        if (!det.data?.lat) { setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000); return; }
        setAddToMap({ status: 'confirm', name, displayName: det.data.name || name, lat: det.data.lat, lng: det.data.lng, mapsUrl });
      } else if (top.lat != null) {
        setAddToMap({ status: 'confirm', name, displayName: top.name || name, lat: top.lat, lng: top.lng, mapsUrl });
      } else {
        setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000);
      }
    } catch { setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000); }
  };

  const confirmAddToMap = async () => {
    if (!addToMap || addToMap.status !== 'confirm') return;
    const { name, displayName, lat, lng, mapsUrl } = addToMap;
    setAddToMap({ status: 'saving' });
    try {
      await apiClient.post(`/api/places/${tripId}`, { name: displayName || name, lat, lng, notes: '', mapsUrl: mapsUrl || undefined });
      setAddToMap({ status: 'done', name: displayName || name });
      setTimeout(() => setAddToMap(null), 2500);
    } catch { setAddToMap({ status: 'error' }); setTimeout(() => setAddToMap(null), 3000); }
  };

  // Tabs only for categories that exist in this trip's activities
  const categories = useMemo(() => {
    const present = new Set(activities.map(a => a.category).filter(Boolean));
    const ordered = CAT_ORDER.filter(c => present.has(c));
    const extras = [...present].filter(c => !ordered.includes(c as typeof CAT_ORDER[number]));
    return [...ordered, ...extras];
  }, [activities]);
  const [tab, setTab] = useState<string>('all');
  useEffect(() => {
    if (categories.length === 0) {
      if (tab !== 'all') setTab('all');
      return;
    }
    if (tab !== 'all' && !categories.includes(tab)) setTab(categories[0]);
  }, [categories, tab]);

  const voteMap = useMemo(
    () => Object.fromEntries(allVotes.map(v => [v.activityId, v])),
    [allVotes],
  );

  const tabActivities = useMemo(() => {
    return activities
      .filter(a => tab === 'all' || a.category === tab)
      .map(act => {
        const v = voteMap[act.id] ?? { activityId: act.id, MUST: 0, OK: 0, IF_OTHERS: 0, NOT_REALLY: 0, AGAINST: 0 };
        const total = v.MUST + v.OK + v.IF_OTHERS + v.NOT_REALLY + v.AGAINST;
        const score = total > 0 ? (v.MUST * 2 + v.OK + v.NOT_REALLY * -1 + v.AGAINST * -2) / total : null;
        return { act, v, total, score };
      })
      .sort((a, b) => {
        const aUnvoted = myVotes[a.act.id] === undefined ? 0 : 1;
        const bUnvoted = myVotes[b.act.id] === undefined ? 0 : 1;
        if (aUnvoted !== bUnvoted) return aUnvoted - bUnvoted;
        if (a.score !== null && b.score !== null) return b.score - a.score;
        return a.score === null ? 1 : -1;
      });
  }, [activities, tab, voteMap, myVotes]);

  const consensusEmoji = (s: number | null) =>
    s === null ? '' : s >= 1.5 ? '🔥' : s >= 0.5 ? '👍' : s >= -0.5 ? '🤷' : s >= -1.5 ? '👎' : '❌';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Banner: unvoted items */}
      {unvotedCount > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
          <span className="text-sm font-medium text-amber-800">🆕 {unvotedCount} מקומות ממתינים להצבעה שלך</span>
          <button onClick={onStartQuiz}
            className="text-xs font-bold text-white bg-amber-400 px-3 py-1.5 rounded-full hover:bg-amber-500 active:bg-amber-600">
            הצבע עכשיו →
          </button>
        </div>
      )}

      {/* Category tabs — only when activities exist; hide empty trip-specific leftovers */}
      {activities.length > 0 && (
        <div className="flex border-b border-neutral-200 bg-white flex-shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap flex-shrink-0 border-b-2 transition-colors ${
              tab === 'all' ? 'border-brand-500 text-brand-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            הכל
            {unvotedCount > 0 && (
              <span className="bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {unvotedCount}
              </span>
            )}
          </button>
          {categories.map(c => {
            const unvotedInCat = activities.filter(a => a.category === c && myVotes[a.id] === undefined).length;
            const isActive = tab === c;
            return (
              <button key={c} type="button" onClick={() => setTab(c)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap flex-shrink-0 border-b-2 transition-colors ${
                  isActive ? 'border-brand-500 text-brand-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                }`}>
                {CAT_LABELS[c] ?? c}
                {unvotedInCat > 0 && (
                  <span className="bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {unvotedInCat}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Add-to-map banner */}
      {addToMap && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm bg-white border border-neutral-200 rounded-2xl shadow-xl px-4 py-3" dir="rtl">
          {addToMap.status === 'geocoding' && (
            <p className="text-xs text-neutral-600 flex items-center gap-2">⏳ מחפש מיקום...</p>
          )}
          {addToMap.status === 'confirm' && (
            <div>
              <p className="text-xs font-semibold text-neutral-800 mb-0.5 truncate">📍 {addToMap.displayName}</p>
              <p className="text-[11px] text-neutral-500 mb-2">הוסף למפת הטיול?</p>
              <div className="flex gap-2">
                <button onClick={confirmAddToMap}
                  className="flex-1 py-1.5 text-xs font-bold bg-brand-500 text-white rounded-xl hover:bg-brand-600">כן ✓</button>
                <button onClick={() => setAddToMap(null)}
                  className="flex-1 py-1.5 text-xs text-neutral-500 border border-neutral-200 rounded-xl hover:bg-neutral-50">לא</button>
              </div>
            </div>
          )}
          {addToMap.status === 'saving' && (
            <p className="text-xs text-neutral-600 flex items-center gap-2">⏳ שומר...</p>
          )}
          {addToMap.status === 'done' && (
            <p className="text-xs text-green-600 font-medium">✅ {addToMap.name} נוסף למפה!</p>
          )}
          {addToMap.status === 'error' && (
            <p className="text-xs text-red-500">❌ לא נמצא מיקום</p>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-3 flex flex-col gap-3">
          {tabActivities.map(({ act, v, total, score }) => {
            const myVote = myVotes[act.id] as VoteId | undefined;
            const isUnvoted = myVote === undefined;
            const isSaving  = saving === act.id;

            return (
              <div key={act.id}
                className={`bg-white rounded-2xl shadow-sm border transition-colors ${isUnvoted ? 'border-amber-200 bg-amber-50/30' : 'border-neutral-100'}`}>

                {/* Card header */}
                <div className="p-4 pb-3">
                  <div className="flex items-start gap-2.5 mb-2">
                    <span className="text-2xl mt-0.5 flex-shrink-0">{act.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-neutral-900 leading-tight">{act.name}</p>
                      {act.location && <p className="text-xs text-neutral-500 mt-0.5">📍 {act.location}</p>}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {act.mapsUrl && (
                          <a href={act.mapsUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-brand-500 hover:underline">🗺️ פתח במפות</a>
                        )}
                        <button
                          onClick={() => handleAddToMap(act.name, act.mapsUrl)}
                          className="text-xs text-neutral-500 hover:text-brand-500 border border-neutral-200 hover:border-brand-300 px-2 py-0.5 rounded-full transition-colors">
                          📍 הוסף למפה
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {score !== null && <span className="text-xl">{consensusEmoji(score)}</span>}
                      {isUnvoted && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full font-semibold">
                          לא הוצבע
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vote bars */}
                  {total > 0 && (
                    <div className="flex flex-col gap-1 mt-1">
                      {VOTE_OPTIONS.map(opt => {
                        const count = v[opt.id] ?? 0;
                        if (count === 0) return null;
                        const voters = v.voters?.[opt.id] ?? [];
                        return (
                          <div key={opt.id} className="flex items-start gap-2">
                            <span className="text-xs w-4 flex-shrink-0 pt-0.5">{opt.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="h-4 bg-neutral-100 rounded-full overflow-hidden">
                                <div className={`h-full ${opt.bar} rounded-full transition-all duration-500`}
                                  style={{ width: `${(count / total) * 100}%` }} />
                              </div>
                              {voters.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {voters.map(user => (
                                    <span key={user.id}
                                      className="inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 bg-neutral-50 border border-neutral-200 rounded-full text-[10px] font-medium text-neutral-600">
                                      {user.avatarUrl ? (
                                        <img src={user.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0" />
                                      ) : (
                                        <span className="w-3.5 h-3.5 rounded-full bg-neutral-300 text-white text-[8px] flex items-center justify-center flex-shrink-0">
                                          {user.name.trim().charAt(0) || '?'}
                                        </span>
                                      )}
                                      <span className="truncate">{user.name}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-neutral-600 w-3 text-left pt-0.5">{count}</span>
                          </div>
                        );
                      })}
                      <p className="text-[10px] text-neutral-400 mt-0.5">{total} {total === 1 ? 'הצבעה' : 'הצבעות'}</p>
                    </div>
                  )}
                </div>

                {/* Inline vote buttons */}
                <div className="flex gap-1 px-3 pb-3">
                  {VOTE_OPTIONS.map(opt => {
                    const selected = myVote === opt.id;
                    return (
                      <button key={opt.id}
                        onClick={() => !isSaving && onVote(act.id, opt.id)}
                        title={opt.label}
                        className={`flex-1 py-2 rounded-xl text-base transition-all ${
                          selected
                            ? `${opt.activeBg} shadow-sm scale-[1.06]`
                            : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 active:bg-neutral-300'
                        } ${isSaving ? 'opacity-40 cursor-wait' : 'cursor-pointer'}`}>
                        {isSaving && selected ? '⏳' : opt.emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
