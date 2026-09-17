import React from 'react';

interface FrustrationMeterProps {
  level: number; // 0 to 10
  showLabel?: boolean;
}

export const FrustrationMeter: React.FC<FrustrationMeterProps> = ({ level, showLabel = true }) => {
  const clampedLevel = Math.max(0, Math.min(10, Math.round(level)));
  const percentage = clampedLevel * 10;

  // Determine color based on intensity
  let barColor = 'bg-emerald-500';
  let textColor = 'text-emerald-700';
  let label = 'Low';

  if (clampedLevel >= 7) {
    barColor = 'bg-red-500';
    textColor = 'text-red-700 font-bold';
    label = 'Critical';
  } else if (clampedLevel >= 4) {
    barColor = 'bg-amber-500';
    textColor = 'text-amber-700 font-semibold';
    label = 'Moderate';
  }

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1 text-xs">
          <span className="font-medium text-slate-700">Frustration Level</span>
          <span className={`font-mono text-xs ${textColor}`}>
            {clampedLevel} / 10 <span className="text-slate-400 font-normal">({label})</span>
          </span>
        </div>
      )}
      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={clampedLevel}
          aria-valuemin={0}
          aria-valuemax={10}
        />
      </div>
    </div>
  );
};
