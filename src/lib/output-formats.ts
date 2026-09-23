/**
 * 输出格式选项表。
 *
 * 界面下拉与历史记录都用这一份：分成两处写，加一个格式就会有一处漏掉，
 * 而"历史里显示不出格式"这种 bug 不会有人报，只会让人以为记录坏了。
 */
import type { OutputFormat } from './ffmpeg-args';

export interface FormatOption {
  value: OutputFormat;
  label: string;
  /** 选它意味着什么——用户看「M4A」不会自动知道那是"只留声音" */
  note: string;
  /** 分组标题；同组连续排列 */
  group: '视频' | '动图' | '音频';
}

export const FORMAT_OPTIONS: ReadonlyArray<FormatOption> = [
  { value: 'same', label: '保持原格式', note: '跟随源文件容器', group: '视频' },
  { value: 'mp4', label: 'MP4', note: '最通用', group: '视频' },
  { value: 'mkv', label: 'MKV', note: '装得下几乎一切', group: '视频' },
  { value: 'mov', label: 'MOV', note: '苹果生态', group: '视频' },
  { value: 'webm', label: 'WebM', note: '网页、体积小', group: '视频' },
  { value: 'gif', label: 'GIF', note: '动图，自动调色板', group: '动图' },
  { value: 'mp3', label: 'MP3', note: '只留声音', group: '音频' },
  { value: 'm4a', label: 'M4A', note: '只留声音', group: '音频' },
  { value: 'opus', label: 'Opus', note: '只留声音', group: '音频' },
  { value: 'flac', label: 'FLAC', note: '只留声音，无损', group: '音频' },
  { value: 'wav', label: 'WAV', note: '只留声音，无损', group: '音频' },
];

/** 取显示名。遇到表里没有的值就原样回显，不显示空白 */
export function formatLabel(format: OutputFormat): string {
  return FORMAT_OPTIONS.find((option) => option.value === format)?.label ?? format;
}
