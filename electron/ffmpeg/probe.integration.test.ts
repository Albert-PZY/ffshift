/**
 * 真实 ffprobe 集成测试。
 * 本机没有 ffmpeg 时整组跳过（不阻塞其他机器与 CI）。
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assessConvertibility } from '../../src/lib/ffprobe';
import { isAvailable, resolveBinaries } from './binary';
import { probeFile, probeMany } from './probe';

const paths = resolveBinaries();
const ffmpegReady = isAvailable(paths.ffmpeg) && isAvailable(paths.ffprobe);

if (!ffmpegReady) {
  console.warn('[integration] 本机没有可用的 ffmpeg/ffprobe，跳过媒体探测用例');
}

describe.skipIf(!ffmpegReady)('ffprobe 集成', () => {
  let workDir: string;
  let withAudio: string;
  let silent: string;
  let truncated: string;
  let garbage: string;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), 'ffshift-probe-'));
    // 中文 + 空格路径：架构里点名要覆盖的场景
    withAudio = join(workDir, '中文 样本 带音轨.mp4');
    silent = join(workDir, '无声.mp4');
    truncated = join(workDir, '下载中断.mp4');
    garbage = join(workDir, '垃圾数据.mp4');

    const common = { stdio: 'ignore' as const, timeout: 150_000 };
    execFileSync(
      paths.ffmpeg,
      [
        '-hide_banner', '-y',
        '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30',
        '-f', 'lavfi', '-i', 'sine=frequency=440',
        '-t', '3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
        withAudio,
      ],
      common,
    );
    execFileSync(
      paths.ffmpeg,
      [
        '-hide_banner', '-y',
        '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25',
        '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        silent,
      ],
      common,
    );
    // 真实 mp4 截断一半：moov 在文件末尾，截断后 ffprobe 会明确报错
    const source = readFileSync(withAudio);
    writeFileSync(truncated, source.subarray(0, Math.floor(source.length / 2)));
    // 垃圾数据：ffprobe 不会报错，会猜成某种音频——由可转换性判断拦下
    writeFileSync(garbage, Buffer.alloc(64 * 1024, 9));
  }, 300_000);

  afterAll(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  it('读出中文与空格路径视频的信息', async () => {
    const info = await probeFile(paths.ffprobe, withAudio);

    expect(info.path).toBe(withAudio);
    expect(info.width).toBe(1280);
    expect(info.height).toBe(720);
    expect(info.fps).toBeCloseTo(30, 1);
    expect(info.videoCodec).toBe('h264');
    expect(info.audioCodec).toBe('aac');
    expect(info.hasAudio).toBe(true);
    expect(info.durationSec).toBeGreaterThan(2.5);
    expect(info.durationSec).toBeLessThan(3.5);
    expect(info.sizeBytes).toBeGreaterThan(1000);
    expect(info.container).toContain('mp4');
  });

  it('无声视频不报错，只是 hasAudio 为 false', async () => {
    const info = await probeFile(paths.ffprobe, silent);
    expect(info.hasAudio).toBe(false);
    expect(info.audioCodec).toBeNull();
    expect(info.width).toBe(640);
  });

  it('下载中断的文件（截断 mp4）被 ffprobe 明确拒绝', async () => {
    await expect(probeFile(paths.ffprobe, truncated)).rejects.toThrow(/无法读取|解析失败/);
  });

  it('垃圾数据不报错，但可转换性判断会拦下它', async () => {
    const info = await probeFile(paths.ffprobe, garbage);
    const verdict = assessConvertibility(info);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBeTruthy();
  });

  it('文件不存在时抛出错误而不是挂起', async () => {
    await expect(probeFile(paths.ffprobe, join(workDir, '不存在.mp4'))).rejects.toThrow();
  });

  it('批量探测：单个文件失败不影响其他文件', async () => {
    const results = await probeMany(paths.ffprobe, [withAudio, truncated, silent]);

    expect(results).toHaveLength(3);
    expect(results[0]?.info?.width).toBe(1280);
    expect(results[1]?.error).toBeTruthy();
    expect(results[2]?.info?.hasAudio).toBe(false);
  });
});
