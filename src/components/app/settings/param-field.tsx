import { useId } from 'react';
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * 参数面板里的一格。
 *
 * 标签用 `<label htmlFor>` 绑到控件上，不是视觉摆设——焦点与读屏都靠它。
 * `data-slot="param-field"` 是端到端测试的定位锚点，改动它要同步改 e2e。
 */
function ParamField({
  label,
  htmlFor,
  wide = false,
  children,
}: {
  label: string;
  htmlFor: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', wide && 'col-span-full')} data-slot="param-field">
      <label className="text-xs text-muted-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** 数字输入：留空就是不干预（null），不填 0 也不填默认值 */
export function NumberParam({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null;
  placeholder: string;
  onChange: (next: number | null) => void;
}) {
  const id = useId();

  return (
    <ParamField htmlFor={id} label={label}>
      <Input
        id={id}
        placeholder={placeholder}
        type="number"
        value={value ?? ''}
        onChange={(event) => {
          const raw = event.target.value.trim();
          if (raw.length === 0) return onChange(null);
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : null);
        }}
      />
    </ParamField>
  );
}

export function TextParam({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onChange: (next: string | null) => void;
}) {
  const id = useId();

  return (
    <ParamField htmlFor={id} label={label} wide>
      <Input
        id={id}
        placeholder={placeholder}
        type="text"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value.trim().length > 0 ? event.target.value : null)}
      />
    </ParamField>
  );
}

/** 下拉：第一项固定是「不干预」，也是默认值——不选就不会往命令里加参数 */
export function SelectParam<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (next: T | null) => void;
}) {
  const id = useId();
  // 'auto' 与业务值同处一个下拉：用 string 承载，回调里再收敛回 T | null
  const items: Array<{ value: string; label: string }> = [{ value: 'auto', label: '不干预' }, ...options];

  return (
    <ParamField htmlFor={id} label={label}>
      <Select
        items={items}
        value={value ?? 'auto'}
        onValueChange={(next: string | null) => onChange(next === null || next === 'auto' ? null : (next as T))}
      >
        <SelectTrigger aria-label={label} id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </ParamField>
  );
}
