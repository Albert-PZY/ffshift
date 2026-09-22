import { describe, expect, it } from 'vitest';
import { parseMediaInfo, parseFrameRate } from './ffprobe';

const probeJson = {
  streams: [
    {
      codec_type: 'video',
      codec_name: 'h264',
      width: 1920,
      height: 1080,
      r_frame_rate: '30000/1001',
      bit_rate: '5000000',
    },
    { codec_type: 'audio', codec_name: 'aac', channels: 2, bit_rate: '128000' },
  ],
  format: { duration: '125.5', format_name: 'mov,mp4,m4a,3gp,3g2,mj2', bit_rate: '5128000' },
};

const meta = { path: 'D:\\素材\\片子.mp4', sizeBytes: 1024 * 1024 * 50 };

describe('parseFrameRate', () => {
  it('把分数帧率换算成小数', () => {
    expect(parseFrameRate('30000/1001')).toBeCloseTo(29.97, 2);
    expect(parseFrameRate('25/1')).toBe(25);
    expect(parseFrameRate('60')).toBe(60);
  });

  it('0/0、空值与异常值返回 null', () => {
    expect(parseFrameRate('0/0')).toBeNull();
    expect(parseFrameRate('')).toBeNull();
    expect(parseFrameRate(undefined)).toBeNull();
    expect(parseFrameRate('abc')).toBeNull();
  });
});

describe('parseMediaInfo', () => {
  it('取到界面要展示的字段', () => {
    const info = parseMediaInfo(probeJson, meta);
    expect(info.path).toBe(meta.path);
    expect(info.sizeBytes).toBe(meta.sizeBytes);
    expect(info.durationSec).toBeCloseTo(125.5, 1);
    expect(info.width).toBe(1920);
    expect(info.height).toBe(1080);
    expect(info.fps).toBeCloseTo(29.97, 2);
    expect(info.videoCodec).toBe('h264');
    expect(info.audioCodec).toBe('aac');
    expect(info.channels).toBe(2);
    expect(info.container).toContain('mp4');
    expect(info.hasAudio).toBe(true);
  });

  it('无声视频：hasAudio 为 false，且不报错', () => {
    const noAudio = { ...probeJson, streams: [probeJson.streams[0]] };
    const info = parseMediaInfo(noAudio, meta);
    expect(info.hasAudio).toBe(false);
    expect(info.audioCodec).toBeNull();
  });

  it('时长缺失时返回 null，让界面降级显示而不是瞎算百分比', () => {
    const noDuration = { ...probeJson, format: { format_name: 'mp4' } };
    expect(parseMediaInfo(noDuration, meta).durationSec).toBeNull();
  });

  it('时长是 N/A 时不当成数字', () => {
    const naDuration = { ...probeJson, format: { ...probeJson.format, duration: 'N/A' } };
    expect(parseMediaInfo(naDuration, meta).durationSec).toBeNull();
  });

  it('多个视频流时取第一个', () => {
    const twoVideo = {
      streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, r_frame_rate: '25/1' },
        { codec_type: 'video', codec_name: 'mjpeg', width: 320, height: 240, r_frame_rate: '25/1' },
      ],
      format: { duration: '10', format_name: 'matroska,webm' },
    };
    const info = parseMediaInfo(twoVideo, meta);
    expect(info.width).toBe(1280);
    expect(info.videoCodec).toBe('h264');
  });

  it('纯音频文件：没有视频流时字段为 null，不算解析失败', () => {
    const audioOnly = {
      streams: [{ codec_type: 'audio', codec_name: 'mp3', channels: 2 }],
      format: { duration: '180', format_name: 'mp3' },
    };
    const info = parseMediaInfo(audioOnly, meta);
    expect(info.width).toBeNull();
    expect(info.videoCodec).toBeNull();
    expect(info.hasAudio).toBe(true);
  });

  it('结构不对时抛错，由调用方标记为无法解析', () => {
    expect(() => parseMediaInfo(null, meta)).toThrow();
    expect(() => parseMediaInfo({ foo: 1 }, meta)).toThrow();
    expect(() => parseMediaInfo('nonsense', meta)).toThrow();
  });

  it('字段类型异常（字符串宽度）时按不可用处理，不让 NaN 漏到界面', () => {
    const weird = {
      streams: [{ codec_type: 'video', codec_name: 'h264', width: 'wide', height: null }],
      format: { duration: '10', format_name: 'mp4' },
    };
    const info = parseMediaInfo(weird, meta);
    expect(info.width).toBeNull();
    expect(info.height).toBeNull();
  });
});
