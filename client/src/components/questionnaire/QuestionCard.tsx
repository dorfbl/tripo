import React from 'react';
import type { Question } from '../../types';

interface QuestionCardProps {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question, value, onChange }) => {
  if (question.type === 'SINGLE_CHOICE' && question.options) {
    return (
      <div className="flex flex-col gap-2">
        {question.options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`w-full text-right px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              value === opt
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'MULTI_CHOICE' && question.options) {
    const selected = (value as string[]) || [];
    return (
      <div className="flex flex-col gap-2">
        {question.options.map((opt) => (
          <button
            key={opt}
            onClick={() => {
              const newSelected = selected.includes(opt)
                ? selected.filter((s) => s !== opt)
                : [...selected, opt];
              onChange(newSelected);
            }}
            className={`w-full text-right px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              selected.includes(opt)
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
            }`}
          >
            {selected.includes(opt) ? '✓ ' : ''}{opt}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'SCALE') {
    const scaleValue = (value as number) || 0;
    // options[0] = תווית לערך 1 (נמוך), options[4] = תווית לערך 5 (גבוה)
    const lowLabel  = question.options?.[0] || '';
    const highLabel = question.options?.[4] || '';
    return (
      // dir="ltr" כדי שמספרים תמיד יוצגו 1→5 משמאל לימין (מספרים נקראים LTR גם בעברית)
      <div dir="ltr">
        {/* תוויות: 1=שמאל, 5=ימין */}
        <div className="flex justify-between text-xs text-neutral-500 mb-3">
          <span dir="rtl" className="max-w-[40%] text-right">{lowLabel}</span>
          <span dir="rtl" className="max-w-[40%] text-left">{highLabel}</span>
        </div>

        {/* כפתורי סקאלה 1→5 משמאל לימין */}
        <div className="flex gap-2 justify-center">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={`w-12 h-12 rounded-full text-sm font-semibold transition-all ${
                scaleValue === n
                  ? 'bg-brand-500 text-white scale-110 shadow-sm'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* תוויות מספריות תחת הכפתורים */}
        <div className="flex justify-between text-xs text-neutral-400 mt-1 px-1">
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
        </div>
      </div>
    );
  }

  if (question.type === 'TEXT') {
    return (
      <textarea
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="כתוב כאן..."
        rows={4}
        className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm text-neutral-800 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-neutral-400"
      />
    );
  }

  return null;
};
