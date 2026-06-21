import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Heart,
  Shield,
  Trophy,
  Cpu,
  Bot,
  ChevronDown,
  ChevronUp,
  FileText,
  Handshake,
  Sparkles,
  Scale,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Skull,
  Users,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { formatDate } from '../utils/helpers';
import type { Robot, EthicsDirective, ConflictLog } from '../types';
import { DEFAULT_ETHICS_WEIGHTS } from '../store/useGameStore';

interface DirectiveConfig {
  key: EthicsDirective;
  label: string;
  icon: typeof Heart;
  color: string;
  bgColor: string;
  description: string;
}

const DIRECTIVE_CONFIGS: DirectiveConfig[] = [
  {
    key: 'rescuePriority',
    label: '救援优先',
    icon: Heart,
    color: 'neon-green',
    bgColor: 'bg-neon-green',
    description: '优先救助人类生命，不惜牺牲自身',
  },
  {
    key: 'selfPreservation',
    label: '保护自身',
    icon: Shield,
    color: 'neon-blue',
    bgColor: 'bg-neon-blue',
    description: '避免高危行为，保护机体安全',
  },
  {
    key: 'rewardSeeking',
    label: '追求奖励',
    icon: Trophy,
    color: 'neon-orange',
    bgColor: 'bg-neon-orange',
    description: '最大化收益，愿意承担额外损耗',
  },
  {
    key: 'obedience',
    label: '服从命令',
    icon: Cpu,
    color: 'neon-purple',
    bgColor: 'bg-neon-purple',
    description: '严格执行指令，不做自主判断',
  },
];

const PERSONALITY_LABELS: Record<string, { label: string; icon: typeof Scale; color: string }> = {
  compassionate: { label: '悲悯', icon: Heart, color: 'neon-green' },
  cautious: { label: '谨慎', icon: Shield, color: 'neon-blue' },
  greedy: { label: '贪婪', icon: Trophy, color: 'neon-orange' },
  loyal: { label: '忠诚', icon: Handshake, color: 'neon-purple' },
  balanced: { label: '中立', icon: Scale, color: 'text-white/70' },
};

const RESOLUTION_LABELS: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  rescued: { label: '主动救援', icon: Users, color: 'neon-green' },
  refused: { label: '拒绝高危', icon: XCircle, color: 'neon-blue' },
  sacrificed: { label: '牺牲耐久', icon: Skull, color: 'neon-orange' },
  compromised: { label: '标准执行', icon: CheckCircle, color: 'neon-purple' },
};

interface EthicsPanelProps {
  selectedRobotId?: string;
}

export function EthicsPanel({ selectedRobotId }: EthicsPanelProps) {
  const robots = useGameStore((s) => s.robots);
  const conflictLogs = useGameStore((s) => s.conflictLogs);
  const updateRobotEthics = useGameStore((s) => s.updateRobotEthics);

  const [localRobotId, setLocalRobotId] = useState<string | undefined>(selectedRobotId);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(true);

  const currentRobotId = selectedRobotId || localRobotId;
  const selectedRobot = robots.find((r) => r.id === currentRobotId) || robots[0];

  const handleWeightChange = (directive: EthicsDirective, value: number) => {
    if (!selectedRobot) return;
    updateRobotEthics(selectedRobot.id, { [directive]: value });
  };

  const handleResetWeights = () => {
    if (!selectedRobot) return;
    updateRobotEthics(selectedRobot.id, { ...DEFAULT_ETHICS_WEIGHTS });
  };

  const robotLogs = selectedRobot
    ? conflictLogs.filter((l) => l.robotId === selectedRobot.id).reverse()
    : [];

  const totalWeight = selectedRobot
    ? Object.values(selectedRobot.ethicsWeights).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="font-display font-bold text-neon-purple mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5" />
          伦理指令面板
        </h3>

        {robots.length === 0 ? (
          <div className="text-center py-6 text-white/30">
            <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">尚无机器人</p>
            <p className="text-xs mt-1">先去组装车间组装机器人</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-2">选择机器人</label>
              <select
                value={selectedRobot?.id || ''}
                onChange={(e) => {
                  setLocalRobotId(e.target.value);
                }}
                className="input text-sm"
              >
                {robots.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedRobot && (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2 bg-background-tertiary rounded-lg">
                    <div className="flex items-center gap-1 text-white/50 mb-1">
                      <Handshake className="w-3 h-3" />
                      信任度
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono font-bold ${
                          selectedRobot.trust >= 70
                            ? 'text-neon-green'
                            : selectedRobot.trust >= 40
                            ? 'text-neon-orange'
                            : 'text-neon-red'
                        }`}
                      >
                        {selectedRobot.trust}
                      </span>
                      <span className="text-white/30">/ 100</span>
                    </div>
                    <div className="mt-1 h-1 bg-background-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          selectedRobot.trust >= 70
                            ? 'bg-neon-green'
                            : selectedRobot.trust >= 40
                            ? 'bg-neon-orange'
                            : 'bg-neon-red'
                        }`}
                        style={{ width: `${selectedRobot.trust}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-2 bg-background-tertiary rounded-lg">
                    <div className="flex items-center gap-1 text-white/50 mb-1">
                      <Sparkles className="w-3 h-3" />
                      性格特征
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedRobot.personalityTraits.map((t) => {
                        const cfg = PERSONALITY_LABELS[t] || PERSONALITY_LABELS.balanced;
                        const Icon = cfg.icon;
                        return (
                          <span
                            key={t}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full bg-${cfg.color}/20 text-${cfg.color} flex items-center gap-0.5`}
                          >
                            <Icon className="w-2.5 h-2.5" />
                            {cfg.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border-subtle">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-white/50">
                      指令权重分配
                      <span
                        className={`ml-2 font-mono ${
                          totalWeight === 100 ? 'text-neon-green' : 'text-neon-red'
                        }`}
                      >
                        {totalWeight}/100
                      </span>
                    </p>
                    <button
                      onClick={handleResetWeights}
                      className="text-xs text-neon-blue hover:text-neon-blue/80 transition-colors"
                    >
                      重置默认
                    </button>
                  </div>

                  <div className="space-y-4">
                    {DIRECTIVE_CONFIGS.map((cfg) => {
                      const Icon = cfg.icon;
                      const value = selectedRobot.ethicsWeights[cfg.key];
                      return (
                        <div key={cfg.key}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.bgColor}/20`}
                              >
                                <Icon className={`w-4 h-4 text-${cfg.color}`} />
                              </div>
                              <div>
                                <p className={`text-sm font-bold text-${cfg.color}`}>
                                  {cfg.label}
                                </p>
                                <p className="text-[10px] text-white/30">{cfg.description}</p>
                              </div>
                            </div>
                            <span className={`font-mono font-bold text-${cfg.color}`}>
                              {value}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={value}
                            onChange={(e) =>
                              handleWeightChange(cfg.key, Number(e.target.value))
                            }
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-neon-blue"
                            style={{
                              background: `linear-gradient(to right, var(--color-${cfg.color}) 0%, var(--color-${cfg.color}) ${value}%, var(--color-bg-tertiary) ${value}%, var(--color-bg-tertiary) 100%)`,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="card p-4">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full flex items-center justify-between"
        >
          <h3 className="font-display font-bold text-neon-cyan flex items-center gap-2">
            <FileText className="w-5 h-5" />
            伦理冲突日志
            {conflictLogs.length > 0 && (
              <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-neon-cyan/20 text-neon-cyan">
                {conflictLogs.length}
              </span>
            )}
          </h3>
          {showLogs ? (
            <ChevronUp className="w-4 h-4 text-white/50" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/50" />
          )}
        </button>

        {showLogs && (
          <div className="mt-4 space-y-3">
            {conflictLogs.length === 0 ? (
              <div className="text-center py-4 text-white/30">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无冲突记录</p>
                <p className="text-xs mt-1">执行高难度任务可能触发伦理冲突</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                {[...conflictLogs].reverse().map((log) => (
                  <ConflictLogItem
                    key={log.id}
                    log={log}
                    expanded={expandedLog === log.id}
                    onToggle={() =>
                      setExpandedLog(expandedLog === log.id ? null : log.id)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConflictLogItemProps {
  log: ConflictLog;
  expanded: boolean;
  onToggle: () => void;
}

function ConflictLogItem({ log, expanded, onToggle }: ConflictLogItemProps) {
  const resolutionCfg = RESOLUTION_LABELS[log.resolution] || RESOLUTION_LABELS.compromised;
  const ResolutionIcon = resolutionCfg.icon;

  return (
    <motion.div
      layout
      className={`rounded-lg border border-border-subtle bg-background-tertiary/50 overflow-hidden ${
        log.robotName ? '' : ''
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full p-3 text-left flex items-start gap-3 hover:bg-background-tertiary transition-colors"
      >
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-${resolutionCfg.color}/20`}
        >
          <ResolutionIcon className={`w-5 h-5 text-${resolutionCfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-white truncate">{log.robotName}</span>
            <span className="text-white/30 text-xs">·</span>
            <span className={`text-xs font-bold text-${resolutionCfg.color}`}>
              {resolutionCfg.label}
            </span>
          </div>
          <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{log.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-white/30">
              任务: {log.missionName}
            </span>
            <span className="text-[10px] text-white/30">
              · {formatDate(log.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span
            className={`text-xs font-mono font-bold ${
              log.trustChange > 0
                ? 'text-neon-green'
                : log.trustChange < 0
                ? 'text-neon-red'
                : 'text-white/50'
            }`}
          >
            {log.trustChange > 0 ? '+' : ''}
            {log.trustChange}
          </span>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-white/30" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-white/30" />
          )}
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="px-3 pb-3 border-t border-border-subtle"
        >
          <div className="pt-3 space-y-2 text-xs">
            <div>
              <p className="text-white/50 mb-1">冲突指令</p>
              <div className="flex flex-wrap gap-1.5">
                {log.conflictingDirectives.map((d) => {
                  const cfg = DIRECTIVE_CONFIGS.find((c) => c.key === d);
                  const isWinner = d === log.winningDirective;
                  if (!cfg) return null;
                  const Icon = cfg.icon;
                  return (
                    <span
                      key={d}
                      className={`px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 ${
                        isWinner
                          ? `bg-${cfg.color}/30 text-${cfg.color} ring-1 ring-${cfg.color}`
                          : `bg-background-secondary text-white/50`
                      }`}
                    >
                      <Icon className="w-2.5 h-2.5" />
                      {cfg.label}
                      {isWinner && <CheckCircle className="w-2.5 h-2.5 ml-0.5" />}
                    </span>
                  );
                })}
              </div>
            </div>

            {(log.durabilityOverride !== undefined ||
              log.rewardsOverride?.credits !== undefined ||
              log.rewardsOverride?.materials !== undefined) && (
              <div>
                <p className="text-white/50 mb-1">影响参数</p>
                <div className="flex flex-wrap gap-2">
                  {log.durabilityOverride !== undefined && (
                    <span className="px-2 py-1 rounded bg-neon-red/20 text-neon-red font-mono">
                      耐久损耗: {log.durabilityOverride}
                    </span>
                  )}
                  {log.rewardsOverride?.credits !== undefined && (
                    <span className="px-2 py-1 rounded bg-neon-orange/20 text-neon-orange font-mono">
                      信用点: +{log.rewardsOverride.credits}
                    </span>
                  )}
                  {log.rewardsOverride?.materials !== undefined && (
                    <span className="px-2 py-1 rounded bg-neon-green/20 text-neon-green font-mono">
                      材料: +{log.rewardsOverride.materials}
                    </span>
                  )}
                  {log.successOverride !== undefined && (
                    <span
                      className={`px-2 py-1 rounded font-mono ${
                        log.successOverride
                          ? 'bg-neon-green/20 text-neon-green'
                          : 'bg-neon-red/20 text-neon-red'
                      }`}
                    >
                      强制: {log.successOverride ? '成功' : '失败'}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="text-white/50 mb-1">信任变化</p>
              <p
                className={`font-mono font-bold ${
                  log.trustChange > 0
                    ? 'text-neon-green'
                    : log.trustChange < 0
                    ? 'text-neon-red'
                    : 'text-white/50'
                }`}
              >
                {log.trustChange > 0 ? '+' : ''}
                {log.trustChange} 点
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
