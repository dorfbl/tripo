import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useTripStore } from '../store/tripStore';
import type { Decision, DecisionStatus, DecisionCategory, DecisionOption } from '../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<DecisionCategory, string> = {
  DESTINATION: 'יעד',
  DATES: 'תאריכים',
  HOTEL: 'לינה',
  TRANSPORT: 'תחבורה',
  ACTIVITY: 'אטרקציות',
  BUDGET: 'תקציב',
  OTHER: 'אחר',
};

const STATUS_LABELS: Record<DecisionStatus, string> = {
  VOTING: 'בהצבעה',
  DECIDED: 'נסגר',
};

const STATUS_COLORS: Record<DecisionStatus, string> = {
  VOTING: 'bg-blue-100 text-blue-700',
  DECIDED: 'bg-green-100 text-green-700',
};

const MEDALS = ['🥇', '🥈', '🥉'];

// ─── VoteBar ──────────────────────────────────────────────────────────────────

interface VoteBarProps {
  option: DecisionOption;
  totalVotes: number;
  votesForOption: number;
  isMyVote: boolean;
  isFinalOption: boolean;
  canVote: boolean;
  onVote: (optionId: string) => void;
  isSecretVote: boolean;
  hideResults: boolean;
  voterNames: string[];
}

const VoteBar: React.FC<VoteBarProps> = ({
  option, totalVotes, votesForOption, isMyVote, isFinalOption, canVote, onVote, isSecretVote, hideResults, voterNames,
}) => {
  const pct = totalVotes > 0 ? Math.round((votesForOption / totalVotes) * 100) : 0;

  return (
    <button
      onClick={() => canVote && onVote(option.id)}
      disabled={!canVote}
      className={`w-full text-right rounded-xl p-3 border transition-all ${
        isMyVote
          ? 'border-brand-500 bg-brand-50'
          : isFinalOption
          ? 'border-green-400 bg-green-50'
          : 'border-neutral-200 bg-neutral-50'
      } ${canVote ? 'active:scale-[0.98] cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isMyVote && <span className="text-brand-500 text-xs font-bold">✓</span>}
          {isFinalOption && <span className="text-green-600 text-xs font-bold">★</span>}
          <span className={`text-sm font-medium ${isMyVote ? 'text-brand-700' : isFinalOption ? 'text-green-700' : 'text-neutral-800'}`}>
            {option.text}
          </span>
        </div>
        {!hideResults && (
          <span className="text-xs text-neutral-500">{votesForOption} {votesForOption === 1 ? 'קול' : 'קולות'}</span>
        )}
      </div>
      {!hideResults && (
        <>
          <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden mt-1.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isFinalOption ? 'bg-green-500' : isMyVote ? 'bg-brand-500' : 'bg-neutral-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {!isSecretVote && voterNames.length > 0 && (
            <p className="text-xs text-neutral-400 mt-1.5 text-right">{voterNames.join(' · ')}</p>
          )}
        </>
      )}
    </button>
  );
};

// ─── Top3VoterUI ──────────────────────────────────────────────────────────────

interface Top3VoterUIProps {
  decision: Decision;
  myUserId: string;
  canVote: boolean;
  onSubmit: (votes: { optionId: string; rank: number }[]) => Promise<void>;
}

const Top3VoterUI: React.FC<Top3VoterUIProps> = ({ decision, myUserId, canVote, onSubmit }) => {
  const myServerVotes = decision.votes
    .filter(v => v.userId === myUserId && v.rank != null)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

  const [draft, setDraft] = useState<(string | null)[]>([
    myServerVotes.find(v => v.rank === 1)?.optionId ?? null,
    myServerVotes.find(v => v.rank === 2)?.optionId ?? null,
    myServerVotes.find(v => v.rank === 3)?.optionId ?? null,
  ]);
  const [submitting, setSubmitting] = useState(false);

  // Resync draft when server votes change (after successful submit)
  const serverKey = myServerVotes.map(v => `${v.optionId}:${v.rank}`).join(',');
  const [lastKey, setLastKey] = useState(serverKey);
  if (serverKey !== lastKey) {
    setLastKey(serverKey);
    setDraft([
      myServerVotes.find(v => v.rank === 1)?.optionId ?? null,
      myServerVotes.find(v => v.rank === 2)?.optionId ?? null,
      myServerVotes.find(v => v.rank === 3)?.optionId ?? null,
    ]);
  }

  const isDirty = [0, 1, 2].some(
    i => (draft[i] ?? null) !== (myServerVotes.find(v => v.rank === i + 1)?.optionId ?? null)
  );

  const poolOptions = decision.options.filter(o => !draft.includes(o.id));

  const addToSlot = (optionId: string) => {
    const nextEmpty = draft.findIndex(d => d === null);
    if (nextEmpty === -1) return;
    setDraft(d => d.map((v, i) => i === nextEmpty ? optionId : v));
  };

  const removeFromSlot = (i: number) => {
    setDraft(d => d.map((v, idx) => idx === i ? null : v));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const votes = draft
      .map((id, i) => id ? { optionId: id, rank: i + 1 } : null)
      .filter(Boolean) as { optionId: string; rank: number }[];
    await onSubmit(votes);
    setSubmitting(false);
  };

  // Weighted scores per option: 🥇=3pts, 🥈=2pts, 🥉=1pt
  const points: Record<string, number> = {};
  decision.options.forEach(o => { points[o.id] = 0; });
  decision.votes.forEach(v => {
    if (v.rank) points[v.optionId] = (points[v.optionId] ?? 0) + (4 - v.rank);
  });
  const maxPts = Math.max(...Object.values(points), 1);
  const voterCount = new Set(decision.votes.map(v => v.userId)).size;
  const sortedByPoints = [...decision.options].sort((a, b) => (points[b.id] ?? 0) - (points[a.id] ?? 0));

  return (
    <div className="px-4 pb-3">
      {/* Voting section */}
      {canVote && (
        <div className="mb-4">
          <p className="text-xs font-bold text-neutral-500 mb-2">הדירוג שלך</p>

          {/* Ranked slots */}
          <div className="flex flex-col gap-1.5 mb-2">
            {[0, 1, 2].map(i => {
              const optionId = draft[i];
              const option = optionId ? decision.options.find(o => o.id === optionId) : null;
              return (
                <div key={i} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors ${
                  option ? 'border-brand-300 bg-brand-50' : 'border-dashed border-neutral-300 bg-white'
                }`}>
                  <span className="text-lg w-7 text-center flex-shrink-0">{MEDALS[i]}</span>
                  {option ? (
                    <>
                      <span className="flex-1 text-sm font-semibold text-brand-700">{option.text}</span>
                      <button onClick={() => removeFromSlot(i)} className="text-neutral-400 text-sm px-1 active:text-red-500">✕</button>
                    </>
                  ) : (
                    <span className="text-sm text-neutral-400 flex-1">מקום {i + 1} — לחץ על אפשרות</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pool */}
          {poolOptions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {poolOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => addToSlot(opt.id)}
                  disabled={draft.every(d => d !== null)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 active:bg-brand-50 active:border-brand-300 active:text-brand-700 disabled:opacity-40"
                >
                  {opt.text}
                </button>
              ))}
            </div>
          )}

          {isDirty && (
            <>
              {draft.some(d => d === null) && (
                <p className="text-xs text-amber-600 font-medium mb-1.5 text-center">יש לבחור 3 אפשרויות כדי לשמור</p>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting || draft.some(d => d === null)}
                className="w-full bg-brand-500 text-white font-bold py-2.5 rounded-xl active:bg-brand-600 disabled:opacity-50 text-sm"
              >
                {submitting ? 'שומר...' : 'שמור דירוג'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Group results */}
      {decision.hideResultsUntilClosed && decision.status !== 'DECIDED' ? (
        voterCount > 0 && (
          <p className="text-xs text-neutral-400 text-center py-1">🔒 {voterCount} {voterCount === 1 ? 'אדם דירג' : 'אנשים דירגו'} · התוצאות יוצגו בסגירת ההצבעה</p>
        )
      ) : voterCount > 0 ? (
        <div>
          <p className="text-xs font-bold text-neutral-500 mb-2">
            תוצאות הקבוצה · {voterCount} דירגו
          </p>
          <div className="flex flex-col gap-2">
            {sortedByPoints.map((opt, rank) => {
              const optVotes = decision.votes.filter(v => v.optionId === opt.id);
              const r1 = optVotes.filter(v => v.rank === 1).length;
              const r2 = optVotes.filter(v => v.rank === 2).length;
              const r3 = optVotes.filter(v => v.rank === 3).length;
              const medalSummary = [
                r1 && `${r1}×🥇`,
                r2 && `${r2}×🥈`,
                r3 && `${r3}×🥉`,
              ].filter(Boolean).join(' ');

              return (
                <div key={opt.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={`font-semibold ${rank === 0 ? 'text-amber-600' : 'text-neutral-500'}`}>
                      {points[opt.id] ?? 0} נק׳{!decision.isSecretVote && medalSummary ? ` · ${medalSummary}` : ''}
                    </span>
                    <span className={`font-medium ${rank === 0 ? 'text-neutral-800' : 'text-neutral-600'}`}>
                      {rank === 0 && '🏆 '}{opt.text}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${rank === 0 ? 'bg-amber-400' : 'bg-neutral-300'}`}
                      style={{ width: `${((points[opt.id] ?? 0) / maxPts) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-neutral-400 mt-2 text-center">🥇=3נק׳ · 🥈=2נק׳ · 🥉=1נק׳</p>
        </div>
      ) : (
        canVote && !decision.hideResultsUntilClosed && <p className="text-xs text-neutral-400 text-center py-1">אין עדיין דירוגים — היה הראשון!</p>
      )}
    </div>
  );
};

// ─── DecisionCard ─────────────────────────────────────────────────────────────

interface DecisionCardProps {
  decision: Decision;
  myUserId: string;
  isAdmin: boolean;
  onVote: (decisionId: string, optionId: string) => void;
  onTop3Vote: (decisionId: string, votes: { optionId: string; rank: number }[]) => Promise<void>;
  onClose: (decision: Decision) => void;
  onReopen: (decisionId: string) => void;
  onDelete: (decisionId: string) => void;
  onAddOption: (decisionId: string) => void;
}

const DecisionCard: React.FC<DecisionCardProps> = ({
  decision, myUserId, isAdmin, onVote, onTop3Vote, onClose, onReopen, onDelete, onAddOption,
}) => {
  const isTop3 = decision.type === 'TOP3';
  const isMulti = decision.type === 'MULTI_CHOICE';
  const myVotes = decision.votes.filter(v => v.userId === myUserId);
  const myVote = myVotes[0];
  const totalVoters = new Set(decision.votes.map(v => v.userId)).size;
  const totalVotes = isMulti ? totalVoters : decision.votes.length;
  const canVote = decision.status !== 'DECIDED';
  const canClose = decision.status !== 'DECIDED' && (decision.createdByUserId === myUserId || isAdmin);
  const canReopen = decision.status === 'DECIDED' && isAdmin;
  const canDelete = isAdmin;

  // Weighted points for TOP3 decided display
  const top3Points: Record<string, number> = {};
  if (isTop3) {
    decision.options.forEach(o => { top3Points[o.id] = 0; });
    decision.votes.forEach(v => {
      if (v.rank) top3Points[v.optionId] = (top3Points[v.optionId] ?? 0) + (4 - v.rank);
    });
  }

  return (
    <div className={`bg-white rounded-2xl border shadow overflow-hidden ${
      decision.status === 'DECIDED' ? 'border-green-200' : 'border-neutral-200'
    }`}>
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-neutral-900 text-base leading-snug flex-1">{decision.title}</h3>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex items-center gap-1">
              {decision.isSecretVote && (
                <span title="הצבעה חשאית — לא רואים מי הצביע על מה" className="text-sm">👤</span>
              )}
              {decision.hideResultsUntilClosed && decision.status !== 'DECIDED' && (
                <span title="תוצאות מוסתרות עד סגירה" className="text-sm">🔒</span>
              )}
              {isTop3 && <span className="text-xs font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">טופ 3</span>}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[decision.status]}`}>
                {STATUS_LABELS[decision.status]}
              </span>
            </div>
            <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
              {CATEGORY_LABELS[decision.category]}
            </span>
          </div>
        </div>
        {decision.description && (
          <p className="text-sm text-neutral-600 leading-relaxed">{decision.description}</p>
        )}
      </div>

      {/* Decided banner */}
      {decision.status === 'DECIDED' && (
        <div className="mx-4 mb-3 p-3 bg-green-50 rounded-xl border border-green-200">
          <p className="text-xs font-bold text-green-700 mb-0.5">ההחלטה הסופית</p>
          <p className="text-sm font-semibold text-green-900">
            {decision.finalDecision ||
              decision.options.find(o => o.id === decision.finalOptionId)?.text ||
              '—'}
          </p>
          {decision.actionNote && (
            <div className="mt-2 pt-2 border-t border-green-200">
              <p className="text-xs text-green-600 font-medium">פעולה נדרשת: {decision.actionNote}</p>
            </div>
          )}
          {totalVoters > 0 && (
            <p className="text-xs text-green-600 mt-1">{totalVoters} {totalVoters === 1 ? 'הצביע' : 'הצביעו'}</p>
          )}
        </div>
      )}

      {/* TOP3 voting UI */}
      {isTop3 && decision.status !== 'DECIDED' && (
        <Top3VoterUI
          decision={decision}
          myUserId={myUserId}
          canVote={canVote}
          onSubmit={votes => onTop3Vote(decision.id, votes)}
        />
      )}

      {/* TOP3 decided — show ranking */}
      {isTop3 && decision.status === 'DECIDED' && decision.options.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs font-bold text-neutral-500 mb-2">תוצאות</p>
          <div className="flex flex-col gap-1">
            {[...decision.options]
              .sort((a, b) => (top3Points[b.id] ?? 0) - (top3Points[a.id] ?? 0))
              .map((opt, rank) => (
                <div key={opt.id} className={`flex items-center justify-between text-sm ${rank === 0 ? 'font-semibold text-amber-700' : 'text-neutral-500'}`}>
                  <span>{top3Points[opt.id] ?? 0} נק׳</span>
                  <span>{rank === 0 && '🏆 '}{opt.text}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Regular vote options (non-TOP3) */}
      {!isTop3 && decision.options.length > 0 && decision.status !== 'DECIDED' && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          {decision.options.map(opt => {
            const optVotes = decision.votes.filter(v => v.optionId === opt.id);
            const voterNames = optVotes.map(v => v.user?.name ?? '').filter(Boolean);
            return (
              <VoteBar
                key={opt.id}
                option={opt}
                totalVotes={totalVotes}
                votesForOption={optVotes.length}
                isMyVote={myVotes.some(v => v.optionId === opt.id)}
                isFinalOption={false}
                canVote={canVote}
                onVote={optId => onVote(decision.id, optId)}
                isSecretVote={decision.isSecretVote}
                hideResults={decision.hideResultsUntilClosed && decision.status !== 'DECIDED'}
                voterNames={voterNames}
              />
            );
          })}
        </div>
      )}

      {/* Regular decided — vote summary */}
      {!isTop3 && decision.options.length > 0 && decision.status === 'DECIDED' && (
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {decision.options.map(opt => {
            const count = decision.votes.filter(v => v.optionId === opt.id).length;
            const isFinal = opt.id === decision.finalOptionId;
            return (
              <div key={opt.id} className={`flex items-center justify-between text-sm ${isFinal ? 'font-semibold text-green-700' : 'text-neutral-500'}`}>
                <span>{count} קולות</span>
                <span>{isFinal && '★ '}{opt.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* No options hint */}
      {decision.options.length === 0 && decision.status !== 'DECIDED' && (
        <div className="px-4 pb-3">
          <p className="text-sm text-neutral-400 text-center py-2">אין עדיין אפשרויות</p>
        </div>
      )}

      {/* My vote indicator (non-TOP3) */}
      {!isTop3 && myVotes.length > 0 && decision.status !== 'DECIDED' && (
        <div className="px-4 pb-2">
          {isMulti ? (
            <p className="text-xs text-brand-600">
              הבחירות שלך: {myVotes.map(v => decision.options.find(o => o.id === v.optionId)?.text).filter(Boolean).join(' · ')}
              <span className="text-neutral-400"> · לחץ שוב לביטול</span>
            </p>
          ) : (
            <p className="text-xs text-brand-600">
              ההצבעה שלך: {decision.options.find(o => o.id === myVote?.optionId)?.text}
              <span className="text-neutral-400"> · לחץ שוב לביטול</span>
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      {(canClose || canReopen || canDelete || decision.status !== 'DECIDED') && (
        <div className="border-t border-neutral-100 px-4 py-2.5 flex flex-wrap items-center gap-2">
          {(decision.type === 'SINGLE_CHOICE' || decision.type === 'MULTI_CHOICE' || decision.type === 'TOP3') && decision.status !== 'DECIDED' && (
            <button
              onClick={() => onAddOption(decision.id)}
              className="text-xs text-brand-600 font-medium px-2.5 py-1 rounded-lg bg-brand-50 active:bg-brand-100"
            >
              + אפשרות
            </button>
          )}
          {canClose && (
            <button
              onClick={() => onClose(decision)}
              className="text-xs text-neutral-600 font-medium px-2.5 py-1 rounded-lg bg-neutral-100 active:bg-neutral-200"
            >
              סגור החלטה
            </button>
          )}
          {canReopen && (
            <button
              onClick={() => onReopen(decision.id)}
              className="text-xs text-blue-600 font-medium px-2.5 py-1 rounded-lg bg-blue-50 active:bg-blue-100"
            >
              פתח מחדש
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(decision.id)}
              className="text-xs text-red-500 font-medium px-2.5 py-1 rounded-lg bg-red-50 active:bg-red-100 mr-auto"
            >
              מחק
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | DecisionStatus;

const FILTER_LABELS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'הכול' },
  { key: 'VOTING', label: 'בהצבעה' },
  { key: 'DECIDED', label: 'נסגר' },
];

interface CloseForm {
  decision: Decision | null;
  finalOptionId: string;
  finalDecision: string;
  actionNote: string;
}

interface AddOptionForm {
  decisionId: string | null;
  text: string;
}

export const DecisionsPage: React.FC = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentTrip } = useTripStore();

  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('VOTING');

  const [closeForm, setCloseForm] = useState<CloseForm>({ decision: null, finalOptionId: '', finalDecision: '', actionNote: '' });
  const [closing, setClosing] = useState(false);

  const [addOptForm, setAddOptForm] = useState<AddOptionForm>({ decisionId: null, text: '' });
  const [addingOpt, setAddingOpt] = useState(false);

  const myMember = currentTrip?.members.find(m => m.userId === user?.id);
  const isAdmin = myMember?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      const { data } = await apiClient.get<Decision[]>(`/api/decisions/${tripId}`);
      setDecisions(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  const votingCount = decisions.filter(d => d.status === 'VOTING').length;
  const decidedCount = decisions.filter(d => d.status === 'DECIDED').length;

  const filtered = filter === 'all' ? decisions : decisions.filter(d => d.status === filter);

  // ── Vote (regular) ────────────────────────────────────────────────────────
  const handleVote = async (decisionId: string, optionId: string) => {
    try {
      const { data } = await apiClient.post<Decision>(`/api/decisions/${decisionId}/vote`, { optionId });
      setDecisions(prev => prev.map(d => d.id === decisionId ? data : d));
    } catch {
      // silent
    }
  };

  // ── Vote (TOP3) ───────────────────────────────────────────────────────────
  const handleTop3Vote = async (decisionId: string, votes: { optionId: string; rank: number }[]) => {
    try {
      const { data } = await apiClient.post<Decision>(`/api/decisions/${decisionId}/vote`, { votes });
      setDecisions(prev => prev.map(d => d.id === decisionId ? data : d));
    } catch {
      // silent
    }
  };

  // ── Close ─────────────────────────────────────────────────────────────────
  const handleCloseSubmit = async () => {
    if (!closeForm.decision) return;
    setClosing(true);
    try {
      const { data } = await apiClient.put<Decision>(
        `/api/decisions/${closeForm.decision.id}/close`,
        {
          finalOptionId: closeForm.finalOptionId || null,
          finalDecision: closeForm.finalDecision || null,
          actionNote: closeForm.actionNote || null,
        },
      );
      setDecisions(prev => prev.map(d => d.id === data.id ? data : d));
      setCloseForm({ decision: null, finalOptionId: '', finalDecision: '', actionNote: '' });
    } catch {
      // silent
    } finally {
      setClosing(false);
    }
  };

  // ── Reopen ────────────────────────────────────────────────────────────────
  const handleReopen = async (decisionId: string) => {
    try {
      const { data } = await apiClient.put<Decision>(`/api/decisions/${decisionId}/reopen`, {});
      setDecisions(prev => prev.map(d => d.id === decisionId ? data : d));
    } catch {
      // silent
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (decisionId: string) => {
    if (!confirm('למחוק את ההחלטה?')) return;
    try {
      await apiClient.delete(`/api/decisions/${decisionId}`);
      setDecisions(prev => prev.filter(d => d.id !== decisionId));
    } catch {
      // silent
    }
  };

  // ── Add option ────────────────────────────────────────────────────────────
  const handleAddOptionSubmit = async () => {
    if (!addOptForm.decisionId || !addOptForm.text.trim()) return;
    setAddingOpt(true);
    try {
      const { data } = await apiClient.post<Decision>(
        `/api/decisions/${addOptForm.decisionId}/options`,
        { text: addOptForm.text.trim() },
      );
      setDecisions(prev => prev.map(d => d.id === data.id ? data : d));
      setAddOptForm({ decisionId: null, text: '' });
    } catch {
      // silent
    } finally {
      setAddingOpt(false);
    }
  };

  // Close modal: compute TOP3 weighted ranking for display
  const top3ClosePoints: Record<string, number> = {};
  if (closeForm.decision?.type === 'TOP3') {
    closeForm.decision.options.forEach(o => { top3ClosePoints[o.id] = 0; });
    closeForm.decision.votes.forEach(v => {
      if (v.rank) top3ClosePoints[v.optionId] = (top3ClosePoints[v.optionId] ?? 0) + (4 - v.rank);
    });
  }

  return (
    <AppShell showBottomNav>
      <div>

        {/* Status summary */}
        {decisions.length > 0 && (
          <p className="text-sm text-neutral-500 mb-3 text-center">
            {votingCount > 0 && <><span className="text-blue-600 font-semibold">{votingCount} בהצבעה</span> · </>}
            <span className="text-green-600 font-semibold">{decidedCount} נסגרו</span>
          </p>
        )}

        {/* Filter tabs + new button */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1 flex-1 overflow-x-auto pb-1">
            {FILTER_LABELS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                  filter === f.key ? 'bg-brand-500 text-white' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate(`/trip/${tripId}/decisions/new`)}
            className="flex-shrink-0 text-sm font-bold px-3 py-1.5 rounded-full bg-brand-500 text-white active:bg-brand-600"
          >
            + החלטה
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-12 text-neutral-400 text-sm">טוען...</div>
        )}

        {!loading && decisions.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="text-4xl mb-3">🤔</div>
            <h3 className="font-bold text-neutral-800 text-lg mb-2">אין עדיין החלטות</h3>
            <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
              זה המקום לסגור דברים שלא כדאי שייעלמו בוואטסאפ:<br />
              יעד, מלון, רכב, אטרקציות, תקציב וכל דבר שצריך עליו תשובה.
            </p>
            <button
              onClick={() => navigate(`/trip/${tripId}/decisions/new`)}
              className="bg-brand-500 text-white font-bold px-6 py-3 rounded-2xl active:bg-brand-600"
            >
              + צור החלטה ראשונה
            </button>
          </div>
        )}

        {!loading && decisions.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 text-neutral-400 text-sm">אין החלטות בסטטוס זה</div>
        )}

        <div className="flex flex-col gap-4">
          {filtered.map(decision => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              myUserId={user?.id ?? ''}
              isAdmin={isAdmin}
              onVote={handleVote}
              onTop3Vote={handleTop3Vote}
              onClose={d => setCloseForm({
                decision: d,
                finalOptionId: (d.type === 'SINGLE_CHOICE' || d.type === 'YES_NO') ? (d.options[0]?.id ?? '') : '',
                finalDecision: '',
                actionNote: '',
              })}
              onReopen={handleReopen}
              onDelete={handleDelete}
              onAddOption={decId => setAddOptForm({ decisionId: decId, text: '' })}
            />
          ))}
        </div>
      </div>

      {/* ── Close decision modal ─────────────────────────────────────────── */}
      {closeForm.decision && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCloseForm(f => ({ ...f, decision: null }))} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl p-6 pb-10">
            <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold text-neutral-900 mb-1">סגירת ההחלטה</h2>
            <p className="text-sm text-neutral-500 mb-4">{closeForm.decision.title}</p>

            <div className="flex flex-col gap-3">
              {/* YES_NO / SINGLE_CHOICE — pick winner */}
              {(closeForm.decision.type === 'YES_NO' || closeForm.decision.type === 'SINGLE_CHOICE') && closeForm.decision.options.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-neutral-600 mb-2 block">ההחלטה הסופית</label>
                  <div className="flex flex-col gap-2">
                    {closeForm.decision.options.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setCloseForm(f => ({ ...f, finalOptionId: opt.id, finalDecision: opt.text }))}
                        className={`text-right px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                          closeForm.finalOptionId === opt.id
                            ? 'border-green-400 bg-green-50 text-green-800'
                            : 'border-neutral-200 text-neutral-700'
                        }`}
                      >
                        {opt.text}
                        <span className="text-xs text-neutral-400 mr-2">
                          ({closeForm.decision!.votes.filter(v => v.optionId === opt.id).length} קולות)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* MULTI_CHOICE — summary */}
              {closeForm.decision.type === 'MULTI_CHOICE' && (
                <div>
                  <label className="text-xs font-bold text-neutral-600 mb-2 block">תוצאות ההצבעה</label>
                  <div className="flex flex-col gap-1 mb-3">
                    {closeForm.decision.options
                      .map(opt => ({ opt, count: closeForm.decision!.votes.filter(v => v.optionId === opt.id).length }))
                      .sort((a, b) => b.count - a.count)
                      .map(({ opt, count }) => (
                        <div key={opt.id} className="flex justify-between text-sm text-neutral-600">
                          <span>{count} בחרו</span>
                          <span>{opt.text}</span>
                        </div>
                      ))}
                  </div>
                  <label className="text-xs font-bold text-neutral-600 mb-1 block">סיכום ההחלטה</label>
                  <input
                    type="text"
                    value={closeForm.finalDecision}
                    onChange={e => setCloseForm(f => ({ ...f, finalDecision: e.target.value }))}
                    placeholder='לדוגמה: הולכים לפארק + ביר גרדן'
                    className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}

              {/* TOP3 — show weighted ranking + summary */}
              {closeForm.decision.type === 'TOP3' && (
                <div>
                  <label className="text-xs font-bold text-neutral-600 mb-2 block">תוצאות הדירוג</label>
                  <div className="flex flex-col gap-1 mb-3">
                    {[...closeForm.decision.options]
                      .sort((a, b) => (top3ClosePoints[b.id] ?? 0) - (top3ClosePoints[a.id] ?? 0))
                      .map((opt, rank) => (
                        <div key={opt.id} className={`flex justify-between text-sm ${rank === 0 ? 'font-semibold text-amber-700' : 'text-neutral-500'}`}>
                          <span>{top3ClosePoints[opt.id] ?? 0} נק׳</span>
                          <span>{rank === 0 && '🏆 '}{opt.text}</span>
                        </div>
                      ))}
                  </div>
                  <label className="text-xs font-bold text-neutral-600 mb-1 block">סיכום ההחלטה</label>
                  <input
                    type="text"
                    value={closeForm.finalDecision}
                    onChange={e => setCloseForm(f => ({ ...f, finalDecision: e.target.value }))}
                    placeholder='לדוגמה: הולכים לאמסטרדם'
                    className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}

              {/* Action note */}
              <div>
                <label className="text-xs font-bold text-neutral-600 mb-1 block">פעולה נדרשת (אופציונלי)</label>
                <input
                  type="text"
                  value={closeForm.actionNote}
                  onChange={e => setCloseForm(f => ({ ...f, actionNote: e.target.value }))}
                  placeholder='לדוגמה: לקנות כרטיסים עד יום שישי'
                  className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <button
              onClick={handleCloseSubmit}
              disabled={
                closing ||
                ((closeForm.decision.type === 'MULTI_CHOICE' || closeForm.decision.type === 'TOP3') && !closeForm.finalDecision.trim()) ||
                ((closeForm.decision.type === 'YES_NO' || closeForm.decision.type === 'SINGLE_CHOICE') && closeForm.decision.options.length > 0 && !closeForm.finalOptionId)
              }
              className="w-full mt-5 bg-green-500 text-white font-bold py-3.5 rounded-2xl active:bg-green-600 disabled:opacity-50"
            >
              {closing ? 'סוגר...' : 'סגור את ההחלטה'}
            </button>
          </div>
        </div>
      )}

      {/* ── Add option modal ─────────────────────────────────────────────── */}
      {addOptForm.decisionId && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddOptForm({ decisionId: null, text: '' })} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl p-6 pb-10">
            <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold text-neutral-900 mb-4">הוסף אפשרות</h2>
            <input
              type="text"
              value={addOptForm.text}
              onChange={e => setAddOptForm(f => ({ ...f, text: e.target.value }))}
              placeholder="שם האפשרות"
              className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 mb-4"
              autoFocus
            />
            <button
              onClick={handleAddOptionSubmit}
              disabled={addingOpt || !addOptForm.text.trim()}
              className="w-full bg-brand-500 text-white font-bold py-3.5 rounded-2xl active:bg-brand-600 disabled:opacity-50"
            >
              {addingOpt ? 'מוסיף...' : 'הוסף'}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
};
