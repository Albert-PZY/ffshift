/**
 * 质量档位。
 *
 * 三档是产品承诺的一部分：用户不需要知道 CRF 和码率，只需要知道
 * "我要存档"还是"我要发出去"。所以档位文案只说用途，不说参数。
 */
import type { Preset } from './ffmpeg-args';

export interface QualityTier {
  id: Preset;
  label: string;
  /** 悬停与下拉里的一句说明：什么场景选它 */
  note: string;
}

export const QUALITY_TIERS: ReadonlyArray<QualityTier> = [
  { id: 'clear', label: '更清晰', note: '存档、还要再剪辑' },
  { id: 'balanced', label: '均衡', note: '日常使用' },
  { id: 'small', label: '更小', note: '发手机、省空间' },
];
