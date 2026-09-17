import React from 'react';
import type { CustomerEmotion, CustomerSentiment, EscalationRisk } from '../types';

export const EmotionBadge: React.FC<{ emotion?: CustomerEmotion | string }> = ({ emotion }) => {
  if (!emotion) return null;
  const emo = emotion.toLowerCase();

  const colorMap: Record<string, string> = {
    happy: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    satisfied: 'bg-green-100 text-green-800 border-green-300',
    neutral: 'bg-slate-100 text-slate-800 border-slate-300',
    confused: 'bg-amber-100 text-amber-800 border-amber-300',
    worried: 'bg-orange-100 text-orange-800 border-orange-300',
    frustrated: 'bg-rose-100 text-rose-800 border-rose-300',
    angry: 'bg-red-100 text-red-800 border-red-300',
  };

  const style = colorMap[emo] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style} capitalize`}>
      {emotion}
    </span>
  );
};

export const SentimentBadge: React.FC<{ sentiment?: CustomerSentiment | string }> = ({ sentiment }) => {
  if (!sentiment) return null;
  const s = sentiment.toLowerCase();

  const style =
    s === 'positive'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : s === 'negative'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style} capitalize`}>
      {sentiment}
    </span>
  );
};

export const EscalationRiskBadge: React.FC<{ risk?: EscalationRisk | string }> = ({ risk }) => {
  if (!risk) return null;
  const r = risk.toLowerCase();

  const style =
    r === 'high'
      ? 'bg-red-600 text-white'
      : r === 'medium'
      ? 'bg-amber-500 text-white'
      : 'bg-emerald-600 text-white';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${style}`}>
      {risk}
    </span>
  );
};
