/**
 * 缩略图与转换的真实集成测试：素材用 lavfi 现场生成，不依赖下载。
 * 本机没有 ffmpeg 时整组跳过。
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildArgs, suggestOutputPath } from '../../src/lib/ffmpeg-args';
import { isAvailable, resolveBinaries } from './binary';
import { startConvert, type ProgressUpdate } from './convert';
import { probeFile } from './probe';
import { ensureThumbnail } from './thumbnail';

const paths = resolveBinaries();
const ready = isAvailable(paths.ffmpeg) && isAvailable(paths.ffprobe);

if (!ready) {
  console.warn('[integration] 本机没有可用的 ffmpeg/ffprobe，跳过缩略图与转换用例');
}

describe.skipIf(!ready)('缩略图与转换集成', () => {
  let workDir: string;
  let outDir: string;
  let cacheDir: string;
  let source: string;
  let longer: string;
  let webmSource: string;

  const makeVideo = (target: string, seconds: number, size = '640x360', codec: 'h264' | 'vp9' = 'h264'): void => {
    const codecArgs =
      codec === 'vp9'
        ? ['-c:v', 'libvpx-vp9', '-b:v', '500k', '-row-mt', '1', '-c:a', 'libopus']
        : ['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac'];

    execFileSync(
      paths.ffmpeg,
      [
        '-hide_banner', '-y',
        '-f', 'lavfi', '-i', `testsrc2=size=${size}:rate=25`,
        '-f', 'lavfi', '-i', 'sine=frequency=440',
        '-t', String(seconds),
        ...codecArgs,
        target,
      ],
      { stdio: 'ignore', timeout: 150_000 },
    );
  };

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), 'ffshift-media-'));
    outDir = join(workDir, '输出');
    cacheDir = join(workDir, '缓存');
    source = join(workDir, '素材 短片.mp4');
    longer = join(workDir, '素材 长片.mp4');

    makeVideo(source, 4);
    makeVideo(longer, 40, '1280x720');
    webmSource = join(workDir, '网页素材.webm');
    makeVideo(webmSource, 3, '640x360', 'vp9');
  }, 400_000);

  afterAll(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  describe('ensureThumbnail', () => {
    it('首次抽帧生成文件，第二次直接命中缓存', async () => {
      const cachePaths = { cacheDir, logsDir: join(workDir, 'logs') };
      const info = await probeFile(paths.ffprobe, source);

      const first = await ensureThumbnail(paths.ffmpeg, source, info.durationSec, cachePaths);
      expect(first.fromCache).toBe(false);
      expect(existsSync(first.path)).toBe(true);
      expect(statSync(first.path).size).toBeGreaterThan(500);

      const second = await ensureThumbnail(paths.ffmpeg, source, info.durationSec, cachePaths);
      expect(second.fromCache).toBe(true);
      expect(second.path).toBe(first.path);
    });

    it('时长未知时仍然能抽到一帧', async () => {
      const cachePaths = { cacheDir, logsDir: join(workDir, 'logs') };
      const result = await ensureThumbnail(paths.ffmpeg, source, null, cachePaths);
      expect(existsSync(result.path)).toBe(true);
    });

    it('文件不存在时明确报错，不静默失败', async () => {
      await expect(
        ensureThumbnail(paths.ffmpeg, join(workDir, '没有这个文件.mp4'), 10, {
          cacheDir,
          logsDir: join(workDir, 'logs'),
        }),
      ).rejects.toThrow(/不存在/);
    });
  });

  describe('startConvert', () => {
    it('均衡档转码成功，产出可被 ffprobe 读出', async () => {
      const info = await probeFile(paths.ffprobe, source);
      const output = join(outDir, '均衡输出.mp4');
      const args = buildArgs({
        input: source,
        output,
        preset: 'balanced',
        hasAudio: info.hasAudio,
      });

      const handle = startConvert({
        ffmpegPath: paths.ffmpeg,
        args,
        outputPath: output,
        durationSec: info.durationSec,
      });
      const outcome = await handle.promise;

      expect(outcome.status).toBe('done');
      expect(existsSync(output)).toBe(true);

      const converted = await probeFile(paths.ffprobe, output);
      expect(converted.videoCodec).toBe('h264');
      expect(converted.width).toBe(640);
    });

    it('进度事件逐步推进，最后到 100%', async () => {
      const info = await probeFile(paths.ffprobe, source);
      const output = join(outDir, '进度输出.mp4');
      const updates: ProgressUpdate[] = [];

      const handle = startConvert({
        ffmpegPath: paths.ffmpeg,
        args: buildArgs({ input: source, output, preset: 'balanced', hasAudio: info.hasAudio }),
        outputPath: output,
        durationSec: info.durationSec,
        onProgress: (update) => updates.push(update),
      });
      const outcome = await handle.promise;

      expect(outcome.status).toBe('done');
      expect(updates.length).toBeGreaterThan(0);

      const percents = updates.map((u) => u.percent).filter((p): p is number => p !== null);
      expect(percents.length).toBeGreaterThan(0);
      expect(percents[percents.length - 1]).toBeGreaterThan(0.9);

      const monotonic = percents.every((p, i) => i === 0 || p >= (percents[i - 1] ?? 0));
      expect(monotonic).toBe(true);
    });

    it('取消后停止任务并清理半成品文件', async () => {
      const info = await probeFile(paths.ffprobe, longer);
      const output = join(outDir, '被取消的输出.mp4');

      const handle = startConvert({
        ffmpegPath: paths.ffmpeg,
        args: buildArgs({ input: longer, output, preset: 'balanced', hasAudio: info.hasAudio }),
        outputPath: output,
        durationSec: info.durationSec,
      });

      await new Promise((resolve) => setTimeout(resolve, 700));
      handle.cancel();
      const outcome = await handle.promise;

      expect(outcome.status).toBe('cancelled');
      expect(existsSync(output)).toBe(false);
    }, 120_000);

    it('损坏文件失败，并给出人话原因而不是原始堆栈', async () => {
      const broken = join(workDir, '损坏.mp4');
      execFileSync(paths.ffmpeg, ['-hide_banner', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=25', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', broken], {
        stdio: 'ignore',
        timeout: 60_000,
      });
      // 截断一半，模拟下载中断
      const bytes = readFileSync(broken);
      writeFileSync(broken, bytes.subarray(0, Math.floor(bytes.length / 2)));

      const output = join(outDir, '损坏输出.mp4');
      const handle = startConvert({
        ffmpegPath: paths.ffmpeg,
        args: buildArgs({ input: broken, output, preset: 'balanced', hasAudio: false }),
        outputPath: output,
        durationSec: null,
      });
      const outcome = await handle.promise;

      expect(outcome.status).toBe('failed');
      if (outcome.status === 'failed') {
        expect(outcome.error.title.length).toBeGreaterThan(0);
        expect(outcome.error.kind).not.toBe('unknown');
      }
      // 失败也不留半成品：留着会让用户以为转换成功过
      expect(existsSync(output)).toBe(false);
    });

    it('目标体积模式产出明显更小的文件', async () => {
      const info = await probeFile(paths.ffprobe, longer);
      const output = join(outDir, '目标体积输出.mp4');

      const handle = startConvert({
        ffmpegPath: paths.ffmpeg,
        args: buildArgs({
          input: longer,
          output,
          preset: 'balanced',
          hasAudio: info.hasAudio,
          targetSizeMiB: 1,
          durationSec: info.durationSec,
        }),
        outputPath: output,
        durationSec: info.durationSec,
      });
      const outcome = await handle.promise;

      expect(outcome.status, outcome.status === 'failed' ? outcome.error.raw : '').toBe('done');
      const originalSize = statSync(longer).size;
      const newSize = statSync(output).size;
      expect(newSize).toBeLessThan(originalSize * 0.6);
    }, 180_000);
  });

  describe('输出格式（容器）', () => {
    it('webm 源转 mp4：容器与编码一起换掉', async () => {
      const output = join(outDir, '网页转.mp4');
      const handle = startConvert({
        ffmpegPath: paths.ffmpeg,
        args: buildArgs({ input: webmSource, output, preset: 'balanced', format: 'mp4', hasAudio: true }),
        outputPath: output,
        durationSec: 3,
      });
      const outcome = await handle.promise;
      expect(outcome.status, outcome.status === 'failed' ? outcome.error.raw : '').toBe('done');

      const info = await probeFile(paths.ffprobe, output);
      expect(info.container).toContain('mp4');
      expect(info.videoCodec).toBe('h264');
      expect(info.audioCodec).toBe('aac');
    }, 120_000);

    it('webm 源保持 webm：改用 VP9，不再撞容器限制', async () => {
      const output = join(outDir, '网页保持.webm');
      const handle = startConvert({
        ffmpegPath: paths.ffmpeg,
        args: buildArgs({ input: webmSource, output, preset: 'balanced', format: 'same', hasAudio: true }),
        outputPath: output,
        durationSec: 3,
      });
      const outcome = await handle.promise;
      expect(outcome.status, outcome.status === 'failed' ? outcome.error.raw : '').toBe('done');

      const info = await probeFile(paths.ffprobe, output);
      expect(info.container).toContain('webm');
      expect(info.videoCodec).toMatch(/vp9/);
    }, 120_000);

    it('mkv 源转 mp4：换了容器，产物被 ffprobe 认成 mp4', async () => {
      const mkv = join(workDir, '中转素材.mkv');
      execFileSync(paths.ffmpeg, ['-hide_banner', '-y', '-i', source, '-c', 'copy', mkv], {
        stdio: 'ignore',
        timeout: 60_000,
      });

      const output = join(outDir, '由mkv转来.mp4');
      const handle = startConvert({
        ffmpegPath: paths.ffmpeg,
        args: buildArgs({ input: mkv, output, preset: 'balanced', format: 'mp4', hasAudio: true }),
        outputPath: output,
        durationSec: 4,
      });
      const outcome = await handle.promise;
      expect(outcome.status, outcome.status === 'failed' ? outcome.error.raw : '').toBe('done');

      const info = await probeFile(paths.ffprobe, output);
      expect(info.container).toContain('mp4');
      expect(info.videoCodec).toBe('h264');
    }, 120_000);
  });

  describe('音频与动图输出', () => {
    it('mp4 提取成 mp3：产物只剩音频流', async () => {
      const output = join(outDir, '提取音频.mp3');
      const handle = startConvert({
        ffmpegPath: paths.ffmpeg,
        args: buildArgs({ input: source, output, preset: 'balanced', format: 'mp3', hasAudio: true }),
        outputPath: output,
        durationSec: 4,
      });
      const outcome = await handle.promise;
      expect(outcome.status, outcome.status === 'failed' ? outcome.error.raw : '').toBe('done');

      const info = await probeFile(paths.ffprobe, output);
      expect(info.videoCodec).toBeNull();
      expect(info.container).toContain('mp3');
      expect(info.hasAudio).toBe(true);
    }, 120_000);

    it('转成 GIF：调色板两遍法产出可用的动图', async () => {
      const output = join(outDir, '动图.gif');
      const handle = startConvert({
        ffmpegPath: paths.ffmpeg,
        args: buildArgs({ input: source, output, preset: 'balanced', format: 'gif', hasAudio: false }),
        outputPath: output,
        durationSec: 4,
      });
      const outcome = await handle.promise;
      expect(outcome.status, outcome.status === 'failed' ? outcome.error.raw : '').toBe('done');
      // 调色板两遍法产出的 GIF 不会是几字节的空壳
      expect(statSync(output).size).toBeGreaterThan(5_000);
    }, 180_000);

    it('无音轨的源提取音频：明确失败，不产出空文件', () => {
      expect(() =>
        buildArgs({
          input: longer,
          output: join(outDir, '不该存在.mp3'),
          preset: 'balanced',
          format: 'mp3',
          hasAudio: false,
        }),
      ).toThrow(/没有音频/);
    });
  });

  describe('Alpha 通道合成', () => {
    it('带透明通道的源转 mp4：透明区合成白底，而不是变黑', async () => {
      const alphaSource = join(workDir, '透明素材.mov');
      // qtrle 编码保留 alpha 通道
      execFileSync(
        paths.ffmpeg,
        [
          '-hide_banner', '-y',
          '-f', 'lavfi', '-i', 'color=c=red@0.5:s=320x240:r=25,format=rgba',
          '-t', '2', '-c:v', 'qtrle',
          alphaSource,
        ],
        { stdio: 'ignore', timeout: 60_000 },
      );

      const info = await probeFile(paths.ffprobe, alphaSource);
      // 先确认素材真的带 alpha，否则这个用例什么也没验证
      expect(info.hasAlpha).toBe(true);

      const output = join(outDir, '透明转mp4.mp4');
      const handle = startConvert({
        ffmpegPath: paths.ffmpeg,
        args: buildArgs({
          input: alphaSource,
          output,
          preset: 'balanced',
          format: 'mp4',
          hasAudio: false,
          source: { width: info.width, height: info.height, fps: info.fps, hasAlpha: info.hasAlpha },
        }),
        outputPath: output,
        durationSec: 2,
      });
      const outcome = await handle.promise;
      expect(outcome.status, outcome.status === 'failed' ? outcome.error.raw : '').toBe('done');

      // 把第一帧缩成 1 像素来看合成结果：白底叠半透明红 ≈ 粉红。
      // 如果没做合成，透明处会是黑色，绿蓝分量会接近 0。
      const pixel = execFileSync(
        paths.ffmpeg,
        [
          '-hide_banner', '-i', output,
          '-vf', 'select=eq(n\\,0),scale=1:1',
          '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
        ],
        { timeout: 60_000 },
      );
      expect(pixel[0] ?? 0).toBeGreaterThan(150); // 红分量高
      expect(pixel[1] ?? 0).toBeGreaterThan(80); // 绿分量说明叠了白底
    }, 180_000);
  });

  describe('输出路径', () => {
    it('默认输出落在同目录，且不与源文件重名', () => {
      const suggested = suggestOutputPath(source);
      expect(suggested).not.toBe(source);
      expect(suggested.startsWith(workDir)).toBe(true);
      expect(existsSync(suggested)).toBe(false);
    });
  });
});
