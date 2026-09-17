import React, { useState } from 'react';
import type { KnowledgeRecommendation } from '../types';
import { BookOpen, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  recommendation: KnowledgeRecommendation;
  onUseText?: (text: string) => void;
}

export const RecommendationCard: React.FC<Props> = ({ recommendation, onUseText }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const scorePct = Math.round(recommendation.relevance_score * 100);

  const handleCopy = () => {
    navigator.clipboard.writeText(recommendation.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const docTypeBadgeColor: Record<string, string> = {
    policy: 'bg-purple-100 text-purple-800 border-purple-200',
    faq: 'bg-blue-100 text-blue-800 border-blue-200',
    support: 'bg-teal-100 text-teal-800 border-teal-200',
    support_document: 'bg-teal-100 text-teal-800 border-teal-200',
  };

  const badgeStyle =
    docTypeBadgeColor[recommendation.document_type.toLowerCase()] ||
    'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-xs hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
          <h4 className="text-sm font-semibold text-slate-800 truncate" title={recommendation.title}>
            {recommendation.title}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`px-2 py-0.5 rounded text-2xs uppercase tracking-wide font-medium border ${badgeStyle}`}>
            {recommendation.document_type}
          </span>
          <span
            className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-xs font-semibold"
            title={`Relevance: ${recommendation.relevance_score}`}
          >
            {scorePct}% match
          </span>
        </div>
      </div>

      {/* Source attribution line */}
      <div className="mt-1.5 text-xs text-slate-500 font-mono truncate" title={recommendation.source}>
        <span className="text-slate-400 font-sans">Source:</span> {recommendation.source}
      </div>

      {/* Snippet */}
      <div className="mt-2 text-xs text-slate-600 leading-relaxed">
        {expanded ? (
          <p className="whitespace-pre-wrap">{recommendation.content}</p>
        ) : (
          <p className="line-clamp-2">{recommendation.content}</p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1 cursor-pointer"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              View details <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer"
            title="Copy text snippet"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          {onUseText && (
            <button
              type="button"
              onClick={() => onUseText(recommendation.content)}
              className="text-slate-700 hover:text-indigo-600 font-medium cursor-pointer"
              title="Insert into support reply box"
            >
              Insert
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
