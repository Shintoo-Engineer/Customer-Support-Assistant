import re

with open('final_project/frontend/src/components/SupportConsole.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add Escalation Risk Monitor to SupportConsole.tsx
monitor_ui_console = """
              {/* Task 6 Phase 2: Escalation Risk Monitor */}
              {decisionSupport.escalation_monitor && (
                <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 relative">
                  <span className="absolute -top-2.5 left-3 px-1.5 bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-sm border border-slate-200 border-b-0">Escalation Monitor</span>
                  
                  <div className="flex items-center justify-between mt-1 mb-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-slate-800">{Math.round(decisionSupport.escalation_monitor.risk_score)}</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">/ 100</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      decisionSupport.escalation_monitor.risk_level === 'Critical' ? 'bg-red-100 text-red-800 border-red-200' :
                      decisionSupport.escalation_monitor.risk_level === 'High' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                      decisionSupport.escalation_monitor.risk_level === 'Medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                      'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}>
                      {decisionSupport.escalation_monitor.risk_level} Risk
                    </span>
                  </div>

                  {decisionSupport.escalation_monitor.risk_indicators.length > 0 && (
                     <div className="flex flex-wrap gap-1 mb-2">
                        {decisionSupport.escalation_monitor.risk_indicators.map((ind, i) => (
                           <span key={i} className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase">{ind}</span>
                        ))}
                     </div>
                  )}

                  <p className="text-[11px] text-slate-700 leading-relaxed border-t border-slate-100 pt-2">
                    <span className="font-semibold text-slate-900 block mb-0.5">Reasoning:</span>
                    {decisionSupport.escalation_monitor.risk_reasoning}
                  </p>
                </div>
              )}
"""

content = content.replace("{/* Response Suggestion */}", monitor_ui_console + "\n              {/* Response Suggestion */}")

with open('final_project/frontend/src/components/SupportConsole.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
