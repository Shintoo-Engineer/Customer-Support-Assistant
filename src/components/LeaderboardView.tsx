import React from 'react';
import {
  Trophy,
  Flame,
  Award,
  Sparkles,
  ShieldCheck,
  HeartHandshake,
  BookOpen,
  CheckCircle,
  Medal
} from 'lucide-react';
import { AgentProfile, LeaderboardEntry } from '../types';
import { INITIAL_LEADERBOARD } from '../data/initialData';

interface LeaderboardViewProps {
  userProfile: AgentProfile;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ userProfile }) => {
  const getBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Trophy': return Trophy;
      case 'BookOpen': return BookOpen;
      case 'HeartHandshake': return HeartHandshake;
      case 'Flame': return Flame;
      case 'ShieldCheck': return ShieldCheck;
      default: return Award;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Diamond': return 'text-sky-300 bg-sky-950/80 border-sky-700';
      case 'Platinum': return 'text-indigo-300 bg-indigo-950/80 border-indigo-700';
      case 'Gold': return 'text-amber-300 bg-amber-950/80 border-amber-700';
      default: return 'text-slate-300 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fadeIn">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 fill-amber-400" />
                Rank #2 in Team
              </span>
              <span className="text-xs text-slate-400">Platinum Tier</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Gamification, XP & Leaderboard
            </h1>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Earn XP for every resolved customer simulation, build de-escalation streaks, unlock badges, and benchmark your progress against the team.
            </p>
          </div>

          {/* XP Level Box */}
          <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-2xl space-y-2 min-w-[240px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">Level {userProfile.level} Coach</span>
              <span className="text-indigo-400 font-bold">{userProfile.xp} / {userProfile.xpToNextLevel} XP</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 rounded-full"
                style={{ width: `${(userProfile.xp / userProfile.xpToNextLevel) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 block text-right">
              {userProfile.xpToNextLevel - userProfile.xp} XP to Level {userProfile.level + 1}
            </span>
          </div>
        </div>
      </div>

      {/* Badges & Achievements Grid */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Award className="w-4 h-4 text-indigo-400" />
          Unlocked Badges & Achievements
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {userProfile.badges.map((badge) => {
            const Icon = getBadgeIcon(badge.icon);
            const isLocked = badge.progress !== undefined && badge.maxProgress !== undefined && badge.progress < badge.maxProgress;
            return (
              <div
                key={badge.id}
                className={`p-4 rounded-2xl border text-center space-y-2 flex flex-col justify-between ${
                  isLocked
                    ? 'bg-slate-900/60 border-slate-800 opacity-60'
                    : 'bg-slate-900 border-indigo-700/60 shadow-lg'
                }`}
              >
                <div className="flex justify-center">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    isLocked ? 'bg-slate-800 text-slate-500' : 'bg-indigo-950 text-indigo-400 border border-indigo-700/60'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-xs text-white">{badge.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-tight">{badge.description}</p>
                </div>

                {isLocked ? (
                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] text-slate-400">{badge.progress} / {badge.maxProgress} completed</div>
                    <div className="w-full bg-slate-800 rounded-full h-1">
                      <div
                        className="bg-indigo-500 h-full rounded-full"
                        style={{ width: `${((badge.progress || 0) / (badge.maxProgress || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-emerald-400 font-semibold block pt-1">
                    ✓ Unlocked
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Team Support Leaderboard</h3>
          </div>
          <span className="text-xs text-slate-400">Weekly Season #34</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="pb-3 font-semibold">Rank</th>
                <th className="pb-3 font-semibold">Agent</th>
                <th className="pb-3 font-semibold">Tier</th>
                <th className="pb-3 font-semibold">Avg Score</th>
                <th className="pb-3 font-semibold">Resolution %</th>
                <th className="pb-3 font-semibold">Escalation %</th>
                <th className="pb-3 font-semibold text-right">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {INITIAL_LEADERBOARD.map((agent) => (
                <tr
                  key={agent.agentId}
                  className={`transition ${agent.agentId === 'agent-001' ? 'bg-indigo-950/40 font-semibold' : 'hover:bg-slate-800/40'}`}
                >
                  <td className="py-3.5">
                    <div className="flex items-center gap-1.5">
                      {agent.rank === 1 && <Medal className="w-4 h-4 text-amber-400" />}
                      {agent.rank === 2 && <Medal className="w-4 h-4 text-slate-300" />}
                      {agent.rank === 3 && <Medal className="w-4 h-4 text-amber-600" />}
                      <span className="font-bold text-white">#{agent.rank}</span>
                    </div>
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={agent.avatar}
                        alt={agent.agentName}
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-700"
                      />
                      <span className="font-medium text-white">{agent.agentName}</span>
                    </div>
                  </td>
                  <td className="py-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getTierColor(agent.tier)}`}>
                      {agent.tier}
                    </span>
                  </td>
                  <td className="py-3.5 font-bold text-emerald-400">
                    {agent.score}%
                  </td>
                  <td className="py-3.5 text-slate-300">
                    {agent.resolutionRate}%
                  </td>
                  <td className="py-3.5 text-slate-300">
                    {agent.escalationRate}%
                  </td>
                  <td className="py-3.5 text-right font-medium text-amber-300">
                    🔥 {agent.streakDays}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
