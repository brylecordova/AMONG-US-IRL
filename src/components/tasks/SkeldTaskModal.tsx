import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { SkeldTaskDef } from '../../shared/skeldData';
import {
  ClearAsteroidsTask,
  DataTransferTask,
  FixWiringTask,
  SwipeCardTask,
} from './SkeldTasksPart1';
import {
  FuelEnginesTask,
  InspectSampleTask,
  MedBayScanTask,
  PrimeShieldsTask,
} from './SkeldTasksPart2';
import {
  AlignEngineTask,
  EmptyGarbageTask,
  StartReactorTask,
  UnlockManifoldsTask,
} from './SkeldTasksPart3';
import {
  CalibrateDistributorTask,
  ChartCourseTask,
  CleanO2FilterTask,
  DivertPowerTask,
} from './SkeldTasksPart4';

interface SkeldTaskModalProps {
  task: SkeldTaskDef;
  isBlackoutRepair?: boolean;
  isImpostor?: boolean;
  onComplete: () => void;
  onClose: () => void;
}

export const SkeldTaskModal: React.FC<SkeldTaskModalProps> = ({
  task,
  isBlackoutRepair = false,
  isImpostor = false,
  onComplete,
  onClose,
}) => {
  const renderTaskWidget = () => {
    switch (task.id) {
      case 'fix-wiring':
        return <FixWiringTask onComplete={onComplete} />;
      case 'swipe-card':
        return <SwipeCardTask onComplete={onComplete} />;
      case 'clear-asteroids':
        return <ClearAsteroidsTask onComplete={onComplete} />;
      case 'download-upload':
        return <DataTransferTask onComplete={onComplete} />;
      case 'fuel-engines':
        return <FuelEnginesTask onComplete={onComplete} />;
      case 'medbay-scan':
        return <MedBayScanTask onComplete={onComplete} isImpostor={isImpostor} />;
      case 'inspect-sample':
        return <InspectSampleTask onComplete={onComplete} />;
      case 'prime-shields':
        return <PrimeShieldsTask onComplete={onComplete} />;
      case 'start-reactor':
        return <StartReactorTask onComplete={onComplete} />;
      case 'unlock-manifolds':
        return <UnlockManifoldsTask onComplete={onComplete} />;
      case 'align-engine':
        return <AlignEngineTask onComplete={onComplete} />;
      case 'empty-garbage':
        return <EmptyGarbageTask onComplete={onComplete} />;
      case 'calibrate-distributor':
        return <CalibrateDistributorTask onComplete={onComplete} />;
      case 'divert-power':
        return <DivertPowerTask onComplete={onComplete} />;
      case 'clean-o2-filter':
        return <CleanO2FilterTask onComplete={onComplete} />;
      case 'chart-course':
        return <ChartCourseTask onComplete={onComplete} />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#151C28] border border-white/15 rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0F1520]">
          <div>
            <h3 className="font-display text-2xl font-bold tracking-wide text-white leading-none">
              {task.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span>{task.room}</span>
              <span aria-hidden="true">·</span>
              <span>{task.tier}</span>
              {task.isVisual && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-cyan-300">Visual</span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300"
            aria-label="Close task"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {isBlackoutRepair && (
            <div className="bg-amber-500/15 border border-amber-400/60 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-200">
              EMERGENCY BLACKOUT REPAIR · Complete wiring to restore ship power!
            </div>
          )}
          <p className="text-xs text-slate-300 leading-relaxed">{task.instruction}</p>
          {renderTaskWidget()}
        </div>
      </motion.div>
    </motion.div>
  );
};
