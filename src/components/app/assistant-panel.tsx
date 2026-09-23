import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { SectionLabel } from '@/components/app/section-label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { describeSuggestion, type Suggestion } from '@/lib/ai-suggest';
import { useStore } from '@/store';

interface Advice {
  suggestion: Suggestion;
  text: string;
  note: string;
}

/**
 * AI 参数建议。
 *
 * 来源标签不是装饰：模型不可用时会退回本地规则，这时候必须如实说"这是规则给的"，
 * 否则用户会以为自己看到的是一句模型判断。见 docs/design-system.md 的可访达性条款。
 */
export function AssistantPanel() {
  const applySuggestion = useStore((s) => s.applySuggestion);
  const [idea, setIdea] = useState('');
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [thinking, setThinking] = useState(false);

  const ask = async () => {
    if (!window.ffshift || idea.trim().length === 0) return;
    setThinking(true);
    try {
      const response = await window.ffshift.suggest(idea);
      setAdvice({
        suggestion: response.suggestion,
        text: describeSuggestion(response.suggestion),
        note: response.note,
      });
    } finally {
      setThinking(false);
    }
  };

  const empty = idea.trim().length === 0;

  return (
    <section className="space-y-2" data-slot="rail-section">
      <SectionLabel>让 AI 给建议</SectionLabel>

      <Input
        aria-label="描述用途"
        placeholder="一句话说用途，比如：压到 50MB 发微信"
        value={idea}
        onChange={(event) => setIdea(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void ask();
        }}
      />

      <Button className="w-full" disabled={thinking || empty} onClick={() => void ask()} size="sm" variant="outline">
        <Sparkles className="h-3.5 w-3.5" />
        {thinking ? <span className="t-shimmer" data-text="正在想…">正在想…</span> : '给出建议'}
      </Button>

      {advice && (
        <div
          className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs/relaxed"
          data-slot="advice"
        >
          <Badge variant={advice.suggestion.source === 'ai' ? 'info' : 'outline'}>
            {advice.suggestion.source === 'ai' ? '模型建议' : '本地规则'}
          </Badge>
          <p>
            {advice.text}
            <span className="text-muted-foreground">（{advice.note}）</span>
          </p>
          <Button
            className="w-full"
            onClick={() => applySuggestion(advice.suggestion.preset, advice.suggestion.targetSizeMiB)}
            size="sm"
            variant="outline"
          >
            用这个档
          </Button>
        </div>
      )}
    </section>
  );
}
