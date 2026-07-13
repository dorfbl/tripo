import React, { useEffect, useState } from 'react';
import { useOfflineStore } from '../../store/offlineStore';
import { flushOfflineQueue } from '../../lib/offline/sync';

export const OfflineChip: React.FC = () => {
  const { online, pending, syncing, lastSyncAt, lastError, refreshPending } = useOfflineStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  if (online && pending.length === 0 && !lastError) {
    return null;
  }

  const label = !online
    ? '🟡 ללא אינטרנט'
    : syncing
      ? '⏳ מסנכרן...'
      : pending.length > 0
        ? `🟡 ${pending.length} ממתינים לסנכרון`
        : lastError
          ? '⚠️ שגיאת סנכרון'
          : '✔ מסונכרן';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed z-[9998] left-3 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm border ${
          !online || pending.length
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-green-50 text-green-700 border-green-200'
        }`}
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-t-3xl p-5 pb-10 shadow-2xl max-h-[70dvh] overflow-y-auto">
            <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold text-neutral-900 mb-1">סנכרון</h2>
            <p className="text-sm text-neutral-500 mb-4">
              {online ? 'מחובר לרשת' : 'אין חיבור — שינויים נשמרים במכשיר'}
            </p>

            <div className="flex flex-col gap-2 text-sm mb-4">
              <div className="flex justify-between px-3 py-2 rounded-xl bg-neutral-50">
                <span className="text-neutral-500">סטטוס</span>
                <span className="font-medium">{online ? 'אונליין' : 'אופליין'}</span>
              </div>
              <div className="flex justify-between px-3 py-2 rounded-xl bg-neutral-50">
                <span className="text-neutral-500">ממתינים</span>
                <span className="font-medium">{pending.length}</span>
              </div>
              <div className="flex justify-between px-3 py-2 rounded-xl bg-neutral-50">
                <span className="text-neutral-500">סנכרון אחרון</span>
                <span className="font-medium">
                  {lastSyncAt
                    ? new Date(lastSyncAt).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </span>
              </div>
            </div>

            {pending.length > 0 && (
              <ul className="flex flex-col gap-1.5 mb-4">
                {pending.map((p) => (
                  <li
                    key={p.id}
                    className="text-xs text-neutral-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2"
                  >
                    {p.label}
                    <span className="text-neutral-400 mr-2">
                      · {new Date(p.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {lastError && (
              <p className="text-xs text-red-500 mb-3 text-center">{lastError}</p>
            )}

            <button
              disabled={!online || syncing || pending.length === 0}
              onClick={async () => {
                await flushOfflineQueue();
              }}
              className="w-full bg-brand-500 text-white font-bold py-3 rounded-2xl disabled:opacity-40"
            >
              {syncing ? 'מסנכרן...' : 'סנכרון ידני'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
