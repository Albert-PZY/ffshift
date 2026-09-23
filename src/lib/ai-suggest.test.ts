import { describe, expect, it } from 'vitest';
import { describeSuggestion, fallbackSuggestion, parseSuggestion, suggestionSystemPrompt } from './ai-suggest';

describe('parseSuggestion', () => {
  it('接受合法 JSON', () => {
    const result = parseSuggestion('{"preset":"small","targetSizeMiB":50,"reason":"微信限制 50MB"}');
    expect(result).toEqual({ preset: 'small', targetSizeMiB: 50, reason: '微信限制 50MB' });
  });

  it('容忍 ```json 包裹和前后废话', () => {
    const raw = '好的，这是建议：\n```json\n{"preset":"clear","reason":"存档用"}\n```\n希望有帮助';
    expect(parseSuggestion(raw)?.preset).toBe('clear');
  });

  it('拒绝白名单之外的 preset，不猜也不修正', () => {
    expect(parseSuggestion('{"preset":"ultra-fast"}')).toBeNull();
    expect(parseSuggestion('{"preset":""}')).toBeNull();
  });

  it('丢弃不在白名单里的字段，只保留允许项', () => {
    const result = parseSuggestion(
      '{"preset":"balanced","reason":"日常","crf":51,"extraArgs":["-vf","scale=1:1"],"codec":"libx265"}',
    );
    expect(result).toEqual({ preset: 'balanced', targetSizeMiB: null, reason: '日常' });
    expect(JSON.stringify(result)).not.toContain('crf');
    expect(JSON.stringify(result)).not.toContain('extraArgs');
  });

  it('targetSizeMiB 越界或非数字时置空，但不让整条建议失效', () => {
    expect(parseSuggestion('{"preset":"small","targetSizeMiB":0}')?.targetSizeMiB).toBeNull();
    expect(parseSuggestion('{"preset":"small","targetSizeMiB":99999}')?.targetSizeMiB).toBeNull();
    expect(parseSuggestion('{"preset":"small","targetSizeMiB":"50"}')?.targetSizeMiB).toBe(50);
  });

  it('理由过长时截断，避免把模型的话原样搬进界面', () => {
    const long = '很'.repeat(120);
    const result = parseSuggestion(`{"preset":"small","reason":"${long}"}`);
    expect(result?.reason.length).toBeLessThanOrEqual(60);
  });

  it('不是 JSON 或结构不对时返回 null', () => {
    expect(parseSuggestion('我觉得用均衡档就好')).toBeNull();
    expect(parseSuggestion('')).toBeNull();
    expect(parseSuggestion('[1,2,3]')).toBeNull();
    expect(parseSuggestion('{"reason":"没有 preset"}')).toBeNull();
  });
});

describe('fallbackSuggestion', () => {
  it('提到微信或手机时选更小档', () => {
    expect(fallbackSuggestion('压一下发微信').preset).toBe('small');
    expect(fallbackSuggestion('放到手机上看看').preset).toBe('small');
  });

  it('提到存档或剪辑时选更清晰档', () => {
    expect(fallbackSuggestion('留着以后剪辑用').preset).toBe('clear');
    expect(fallbackSuggestion('要存档，画质高一点').preset).toBe('clear');
  });

  it('从描述里认出体积要求', () => {
    const result = fallbackSuggestion('压到 50MB 以内');
    expect(result.targetSizeMiB).toBe(50);
  });

  it('认不出意图时给均衡档，并说明这是默认值', () => {
    const result = fallbackSuggestion('随便弄一下');
    expect(result.preset).toBe('balanced');
    expect(result.reason).toContain('默认');
  });

  it('降级结果带来源标记，界面要能告诉用户这不是模型给的', () => {
    expect(fallbackSuggestion('发微信').source).toBe('rules');
  });
});

describe('describeSuggestion', () => {
  it('把建议写成一句人话', () => {
    const text = describeSuggestion({ preset: 'small', targetSizeMiB: 50, reason: '微信限制', source: 'ai' });
    expect(text).toContain('更小');
    expect(text).toContain('50 MiB');
  });

  it('没有目标体积时不提体积', () => {
    const text = describeSuggestion({ preset: 'clear', targetSizeMiB: null, reason: '存档', source: 'ai' });
    expect(text).toContain('更清晰');
    expect(text).not.toContain('MiB');
  });
});

describe('模型不守格式时的散文提取', () => {
  it('从一大段分析里认出档位与体积', () => {
    // 实测：网关上的模型会回这种长篇分析，而不是 JSON
    const prose =
      '需要把视频压到 50MB 以内发微信，画质尽量好。核心思路：控制码率，而非简单改分辨率。\n' +
      '## 快速方案\n```bash\n# 视频码率 = (50MB * 8 * 0.95) / 时长(秒)\n```';
    const result = parseSuggestion(prose);
    expect(result?.preset).toBe('small');
    expect(result?.targetSizeMiB).toBe(50);
    expect(result?.viaProse).toBe(true);
  });

  it('两个方向都提到且给了体积上限时，按体积选更小档', () => {
    const result = parseSuggestion('既要保留画质，又要压到 100MB，发微信');
    expect(result?.preset).toBe('small');
    expect(result?.targetSizeMiB).toBe(100);
  });

  it('体积优先取用户输入里的数字，而不是模型回答里的', () => {
    const prose = '微信聊天发送限制 100MB，所以要压到很小才行，建议控制码率。';
    const result = parseSuggestion(prose, '压到 50MB 发微信');
    expect(result?.targetSizeMiB).toBe(50);
  });

  it('JSON 合法但没给体积时，回落到用户输入里的数字', () => {
    const result = parseSuggestion('{"preset":"small","targetSizeMiB":null,"reason":"发微信"}', '压到 30MB');
    expect(result?.targetSizeMiB).toBe(30);
  });

  it('与转码无关的闲聊内容不硬猜', () => {
    expect(parseSuggestion('这是一段和视频转换无关的内容，讲的是别的事情。')).toBeNull();
  });

  it('JSON 里 preset 非法时不再从原文里二次猜档位', () => {
    expect(parseSuggestion('{"preset":"turbo","reason":"随便"}')).toBeNull();
  });
});

describe('suggestionSystemPrompt', () => {
  it('把白名单写进系统提示，明确禁止自由发挥', () => {
    const prompt = suggestionSystemPrompt();
    expect(prompt).toContain('preset');
    expect(prompt).toContain('targetSizeMiB');
    expect(prompt).toMatch(/不要|禁止/);
    expect(prompt).toContain('小');
  });

  it('要求只输出一行 JSON 并附上示例，减少模型自由发挥', () => {
    const prompt = suggestionSystemPrompt();
    expect(prompt).toContain('示例');
    expect(prompt).toMatch(/只输出一行 JSON/);
  });
});
