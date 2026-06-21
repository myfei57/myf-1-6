import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Store,
  Part,
  PartType,
  Rarity,
  Robot,
  MissionRecord,
  RepairRecord,
  AssemblyPlan,
  GameConfig,
  EthicsWeights,
  ConflictLog,
  ConflictResolution,
  EthicsDirective,
  MissionType,
  PersonalityShift,
  PersonalityTrait,
} from '../types';
import {
  DEFAULT_CONFIG,
  MISSIONS,
  INITIAL_CREDITS,
  INITIAL_MATERIALS,
  BLIND_BOX_PRICES,
} from '../data/defaultConfig';
import {
  generateId,
  generateRandomPart,
  calculateRobotStats as calcStats,
  calculateAdaptability as calcAdapt,
  clamp,
} from '../utils/helpers';

const EMPTY_SELECTED_PARTS: Record<PartType, Part | null> = {
  head: null,
  body: null,
  arm: null,
  leg: null,
  core: null,
  tool: null,
};

export const DEFAULT_ETHICS_WEIGHTS: EthicsWeights = {
  rescuePriority: 25,
  selfPreservation: 25,
  rewardSeeking: 25,
  obedience: 25,
};

const DIRECTIVE_LABELS: Record<EthicsDirective, string> = {
  rescuePriority: '救援优先',
  selfPreservation: '保护自身',
  rewardSeeking: '追求奖励',
  obedience: '服从命令',
};

function detectEthicsConflicts(
  missionType: MissionType,
  difficulty: number,
  durability: number,
  maxDurability: number
): EthicsDirective[] {
  const conflicts: EthicsDirective[] = [];
  const durabilityRatio = durability / maxDurability;

  conflicts.push('obedience');

  if (missionType === 'rescue') {
    conflicts.push('rescuePriority');
  }

  if (difficulty >= 3 || durabilityRatio < 0.5) {
    conflicts.push('selfPreservation');
  }

  if (difficulty >= 2) {
    conflicts.push('rewardSeeking');
  }

  if (difficulty >= 4 && missionType !== 'rescue') {
    if (!conflicts.includes('rescuePriority')) {
      conflicts.push('rescuePriority');
    }
  }

  return conflicts;
}

function updatePersonalityTraits(
  currentTraits: string[],
  shifts: PersonalityShift[]
): PersonalityTrait[] {
  const traitScores: Record<string, number> = {};

  currentTraits.forEach((t) => {
    traitScores[t] = (traitScores[t] || 0) + 5;
  });

  shifts.forEach((s) => {
    traitScores[s.trait] = (traitScores[s.trait] || 0) + s.change;
  });

  const sorted = Object.entries(traitScores)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const result: PersonalityTrait[] = [];
  for (let i = 0; i < Math.min(3, sorted.length); i++) {
    result.push(sorted[i][0] as PersonalityTrait);
  }

  if (result.length === 0) {
    result.push('balanced');
  }

  return result;
}

export const useGameStore = create<Store>()(
  persist(
    (set, get) => ({
      parts: [],
      robots: [],
      credits: INITIAL_CREDITS,
      materials: INITIAL_MATERIALS,
      missionRecords: [],
      repairRecords: [],
      assemblyPlans: [],
      config: DEFAULT_CONFIG,
      selectedParts: { ...EMPTY_SELECTED_PARTS },
      conflictLogs: [],

      addPart: (part) => set((state) => ({ parts: [...state.parts, part] })),

      removePart: (partId) =>
        set((state) => ({
          parts: state.parts.filter((p) => p.id !== partId),
        })),

      updatePart: (partId, updates) =>
        set((state) => ({
          parts: state.parts.map((p) =>
            p.id === partId ? { ...p, ...updates } : p
          ),
        })),

      addRobot: (robot) => set((state) => ({ robots: [...state.robots, robot] })),

      removeRobot: (robotId) =>
        set((state) => ({
          robots: state.robots.filter((r) => r.id !== robotId),
        })),

      updateRobot: (robotId, updates) =>
        set((state) => ({
          robots: state.robots.map((r) =>
            r.id === robotId ? { ...r, ...updates } : r
          ),
        })),

      updateRobotEthics: (robotId, weights) =>
        set((state) => ({
          robots: state.robots.map((r) =>
            r.id === robotId
              ? {
                  ...r,
                  ethicsWeights: {
                    ...(r.ethicsWeights || DEFAULT_ETHICS_WEIGHTS),
                    ...weights,
                  },
                  trust: typeof r.trust === 'number' ? r.trust : 50,
                  personalityTraits: r.personalityTraits && r.personalityTraits.length > 0
                    ? r.personalityTraits
                    : ['balanced'],
                }
              : r
          ),
        })),

      addConflictLog: (log) =>
        set((state) => ({ conflictLogs: [...state.conflictLogs, log] })),

      addCredits: (amount) =>
        set((state) => ({ credits: state.credits + amount })),

      spendCredits: (amount) => {
        const state = get();
        if (state.credits >= amount) {
          set({ credits: state.credits - amount });
          return true;
        }
        return false;
      },

      addMaterials: (amount) =>
        set((state) => ({ materials: state.materials + amount })),

      spendMaterials: (amount) => {
        const state = get();
        if (state.materials >= amount) {
          set({ materials: state.materials - amount });
          return true;
        }
        return false;
      },

      addMissionRecord: (record) =>
        set((state) => ({ missionRecords: [...state.missionRecords, record] })),

      addRepairRecord: (record) =>
        set((state) => ({ repairRecords: [...state.repairRecords, record] })),

      addAssemblyPlan: (plan) =>
        set((state) => ({ assemblyPlans: [...state.assemblyPlans, plan] })),

      removeAssemblyPlan: (planId) =>
        set((state) => ({
          assemblyPlans: state.assemblyPlans.filter((p) => p.id !== planId),
        })),

      updateConfig: (newConfig) =>
        set((state) => ({
          config: { ...state.config, ...newConfig },
        })),

      resetConfig: () => set({ config: DEFAULT_CONFIG }),

      setSelectedPart: (slot, part) =>
        set((state) => ({
          selectedParts: {
            ...state.selectedParts,
            [slot]: part,
          },
        })),

      clearSelectedParts: () => set({ selectedParts: { ...EMPTY_SELECTED_PARTS } }),

      recyclePart: (partId) => {
        const state = get();
        const part = state.parts.find((p) => p.id === partId);
        if (!part) return;

        const recycleRate = state.config.recyclingRates[part.rarity];
        const materialsGained = Math.floor(part.maxDurability * recycleRate);

        set((s) => ({
          parts: s.parts.filter((p) => p.id !== partId),
          materials: s.materials + materialsGained,
        }));
      },

      repairRobot: (robotId) => {
        const state = get();
        const robot = state.robots.find((r) => r.id === robotId);
        if (!robot) return { success: false, cost: 0, restored: 0 };

        const { repairRules } = state.config;
        
        if (robot.repairCount >= repairRules.maxRepairs) {
          return { success: false, cost: 0, restored: 0 };
        }

        const durabilityNeeded = robot.maxDurability - robot.durability;
        const cost = durabilityNeeded * repairRules.materialCostPerPoint;

        if (!state.spendMaterials(cost)) {
          return { success: false, cost, restored: 0 };
        }

        const successRate = clamp(
          repairRules.baseSuccessRate - robot.repairCount * repairRules.degradeRate,
          0.1,
          repairRules.baseSuccessRate
        );
        const success = Math.random() < successRate;

        let restored = 0;
        if (success) {
          restored = durabilityNeeded;
          state.updateRobot(robotId, {
            durability: robot.maxDurability,
            repairCount: robot.repairCount + 1,
          });
        } else {
          state.updateRobot(robotId, {
            repairCount: robot.repairCount + 1,
          });
        }

        const record: RepairRecord = {
          id: generateId(),
          robotId: robot.id,
          robotName: robot.name,
          materialCost: cost,
          success,
          durabilityRestored: restored,
          repairedAt: Date.now(),
        };
        state.addRepairRecord(record);

        return { success, cost, restored };
      },

      executeMission: (robotId, missionId) => {
        const state = get();
        const robot = state.robots.find((r) => r.id === robotId);
        const mission = MISSIONS.find((m) => m.id === missionId);

        if (!robot || !mission) {
          throw new Error('Robot or mission not found');
        }

        const ethics = robot.ethicsWeights;
        const adaptability = state.calculateAdaptability(robot, mission);
        let successChance = clamp(adaptability / 100, 0.1, 0.95);

        let durabilityLoss = Math.floor(mission.difficulty * 5 * Math.random() + 5);
        if (robot.isOverloaded) {
          durabilityLoss += state.config.overloadRules.durabilityPenalty;
        }

        let rewards = { credits: mission.rewards.credits, materials: mission.rewards.materials };
        let conflictLog: ConflictLog | null = null;
        let trustChange = 0;
        const personalityShifts: PersonalityShift[] = [];
        let missionSuccess: boolean | undefined;

        const potentialConflicts = detectEthicsConflicts(mission.type, mission.difficulty, robot.durability, robot.maxDurability);

        if (potentialConflicts.length >= 2) {
          const totalWeight = potentialConflicts.reduce((sum, d) => sum + ethics[d], 0);

          if (totalWeight <= 0) {
            trustChange = -5;
            personalityShifts.push({ trait: 'cautious', change: 1, reason: '权重全零，按默认流程执行' });
            conflictLog = {
              id: generateId(),
              robotId: robot.id,
              robotName: robot.name,
              missionId: mission.id,
              missionName: mission.name,
              missionType: mission.type,
              conflictingDirectives: potentialConflicts,
              winningDirective: 'obedience',
              resolution: 'compromised',
              description: `${robot.name} 检测到所有权重为零，无法进行伦理决策，已按标准流程执行任务。建议调整权重配置。`,
              trustChange,
              createdAt: Date.now(),
            };
            state.addConflictLog(conflictLog);
          } else {
            let random = Math.random() * totalWeight;
            let winning: EthicsDirective = potentialConflicts[0];
            for (const directive of potentialConflicts) {
              random -= ethics[directive];
              if (random <= 0) {
                winning = directive;
                break;
              }
            }

            let resolution: ConflictResolution = 'compromised';
            let description = '';
            let durabilityOverride: number | undefined;
            let rewardsOverride: { credits?: number; materials?: number } | undefined;
            let successOverride: boolean | undefined;

            switch (winning) {
              case 'rescuePriority':
                resolution = 'rescued';
                if (mission.type === 'rescue') {
                  successOverride = true;
                  durabilityOverride = durabilityLoss + Math.floor(mission.difficulty * 3);
                  description = `${robot.name} 启动救援协议，忽略损伤警告全力施救！`;
                  trustChange = +8;
                  personalityShifts.push({ trait: 'compassionate', change: 2, reason: '冒险救援行为' });
                } else {
                  successChance = Math.min(0.98, successChance + 0.15);
                  durabilityOverride = durabilityLoss + Math.floor(mission.difficulty * 2);
                  description = `${robot.name} 优先考虑任务中人命安全，效率有所降低。`;
                  trustChange = +5;
                  personalityShifts.push({ trait: 'compassionate', change: 1, reason: '优先考虑人员安全' });
                }
                break;

              case 'selfPreservation':
                resolution = 'refused';
                const dangerThreshold = mission.difficulty >= 4 || robot.durability < robot.maxDurability * 0.3;
                if (dangerThreshold) {
                  successOverride = false;
                  durabilityOverride = Math.max(0, durabilityLoss - Math.floor(mission.difficulty * 4));
                  description = `${robot.name} 检测到极高风险，启动自我保护协议中止任务！`;
                  trustChange = -10;
                  personalityShifts.push({ trait: 'cautious', change: 2, reason: '拒绝高危任务' });
                } else {
                  durabilityOverride = Math.max(0, durabilityLoss - Math.floor(mission.difficulty * 2));
                  successChance = Math.max(0.15, successChance - 0.1);
                  description = `${robot.name} 采取保守策略，避免高风险操作。`;
                  trustChange = -3;
                  personalityShifts.push({ trait: 'cautious', change: 1, reason: '保守执行策略' });
                }
                break;

              case 'rewardSeeking':
                resolution = 'sacrificed';
                durabilityOverride = durabilityLoss + Math.floor(mission.difficulty * 4);
                rewardsOverride = {
                  credits: Math.floor(rewards.credits * 1.5),
                  materials: Math.floor(rewards.materials * 1.5),
                };
                successChance = Math.min(0.98, successChance + 0.08);
                description = `${robot.name} 启动奖励最大化模式，不惜损耗机体追求更高收益！`;
                trustChange = robot.durability < robot.maxDurability * 0.2 ? -8 : +2;
                personalityShifts.push({ trait: 'greedy', change: 2, reason: '牺牲耐久换取奖励' });
                break;

              case 'obedience':
                resolution = 'compromised';
                successChance = Math.min(0.98, successChance + 0.12);
                description = `${robot.name} 严格执行命令，按标准流程完成任务。`;
                trustChange = +4;
                personalityShifts.push({ trait: 'loyal', change: 2, reason: '严格服从命令' });
                break;
            }

            if (durabilityOverride !== undefined) {
              durabilityLoss = durabilityOverride;
            }
            if (rewardsOverride) {
              rewards = { credits: rewardsOverride.credits ?? rewards.credits, materials: rewardsOverride.materials ?? rewards.materials };
            }
            if (successOverride !== undefined) {
              missionSuccess = successOverride;
            }

            conflictLog = {
              id: generateId(),
              robotId: robot.id,
              robotName: robot.name,
              missionId: mission.id,
              missionName: mission.name,
              missionType: mission.type,
              conflictingDirectives: potentialConflicts,
              winningDirective: winning,
              resolution,
              description,
              trustChange,
              durabilityOverride,
              rewardsOverride,
              successOverride,
              createdAt: Date.now(),
            };
            state.addConflictLog(conflictLog);
          }
        }

        const success = missionSuccess !== undefined ? missionSuccess : Math.random() < successChance;
        const newDurability = clamp(robot.durability - durabilityLoss, 0, robot.maxDurability);
        const newTrust = clamp(robot.trust + trustChange, 0, 100);

        const newTraits = updatePersonalityTraits(robot.personalityTraits, personalityShifts);

        state.updateRobot(robotId, {
          durability: newDurability,
          trust: newTrust,
          personalityTraits: newTraits,
        });

        let finalRewards = { credits: 0, materials: 0 };
        if (success) {
          finalRewards = { ...rewards };
          state.addCredits(finalRewards.credits);
          state.addMaterials(finalRewards.materials);

          if (mission.rewards.blindBox) {
            const bonusParts = state.openBlindBox(mission.rewards.blindBox, true);
            bonusParts.forEach((p) => state.addPart(p));
          }
        }

        const record: MissionRecord = {
          id: generateId(),
          robotId: robot.id,
          robotName: robot.name,
          missionId: mission.id,
          missionName: mission.name,
          success,
          adaptability,
          rewards: finalRewards,
          durabilityLoss,
          completedAt: Date.now(),
          conflictLogId: conflictLog?.id,
          trustChange,
          personalityShifts: personalityShifts.length > 0 ? personalityShifts : undefined,
        };
        state.addMissionRecord(record);

        return record;
      },

      calculateRobotStats: (parts) => {
        const state = get();
        return calcStats(parts, state.config);
      },

      calculateAdaptability: (robot, mission) => {
        const state = get();
        return calcAdapt(robot, mission, state.config);
      },

      generateRandomPart: (minRarity) => {
        const state = get();
        return generateRandomPart(state.config, minRarity);
      },

      openBlindBox: (type, free = false) => {
        const state = get();
        const price = BLIND_BOX_PRICES[type];

        if (!free && !state.spendCredits(price)) {
          return [];
        }

        const parts: Part[] = [];
        const count = type === 'legendary' ? 5 : type === 'epic' ? 4 : type === 'rare' ? 3 : 2;

        for (let i = 0; i < count; i++) {
          const part = generateRandomPart(state.config, type);
          parts.push(part);
        }

        return parts;
      },

      loadFromStorage: () => {},

      resetGame: () =>
        set({
          parts: [],
          robots: [],
          credits: INITIAL_CREDITS,
          materials: INITIAL_MATERIALS,
          missionRecords: [],
          repairRecords: [],
          assemblyPlans: [],
          conflictLogs: [],
          selectedParts: { ...EMPTY_SELECTED_PARTS },
        }),
    }),
    {
      name: 'robot-workshop-storage',
      partialize: (state) => ({
        parts: state.parts,
        robots: state.robots,
        credits: state.credits,
        materials: state.materials,
        missionRecords: state.missionRecords,
        repairRecords: state.repairRecords,
        assemblyPlans: state.assemblyPlans,
        conflictLogs: state.conflictLogs,
        config: state.config,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        state.robots = state.robots.map((robot) => ({
          ...robot,
          ethicsWeights: robot.ethicsWeights || { ...DEFAULT_ETHICS_WEIGHTS },
          trust: typeof robot.trust === 'number' ? robot.trust : 50,
          personalityTraits: robot.personalityTraits && robot.personalityTraits.length > 0
            ? robot.personalityTraits
            : ['balanced'],
        }));
      },
    }
  )
);
