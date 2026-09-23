import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** 选项右侧的一句说明；给"不知道该选哪个"的人看的 */
  note?: string;
}

/**
 * 带说明的下拉：选项分两列——名字在左、说明靠右。
 *
 * 单列纯名字的下拉在这个项目里不够用：用户看「更小」不知道小多少，
 * 看「M4A」不知道那是音频。说明文字必须同屏。
 */
export function SelectField<T extends string>({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  className,
}: {
  id?: string;
  ariaLabel: string;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next: T | null) => {
        if (next !== null) onChange(next);
      }}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex w-full min-w-0 items-center gap-3">
              <span className="truncate">{option.label}</span>
              {option.note && (
                <span className={cn('ml-auto shrink-0 text-xs text-muted-foreground')}>{option.note}</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
