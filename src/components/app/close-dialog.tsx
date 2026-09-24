import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogDescription, DialogFooter, DialogPopup, DialogTitle } from '@/components/ui/dialog';
import type { CloseAction } from '@/lib/settings';

/**
 * 关窗口时的确认。
 *
 * 转换可能要跑十几分钟，用户随手点关闭就把活儿掐了。所以给两个走法：
 * 缩到托盘继续转（默认），或者真的退出。勾上"记住"就写进设置，下次直接执行。
 *
 * 只有主进程拦下 close 时才会开（用户偏好为 `ask`）。
 */
interface Props {
  onAnswer: (choice: CloseAction, remember: boolean) => void;
  open: boolean;
}

export function CloseDialog({ onAnswer, open }: Props) {
  const [remember, setRemember] = useState(false);

  const answer = (choice: CloseAction) => {
    onAnswer(choice, remember);
    setRemember(false);
  };

  return (
    <Dialog open={open}>
      <DialogPopup>
        <DialogTitle>要后台运行，还是退出？</DialogTitle>
        <DialogDescription>
          缩到托盘可以继续跑没转完的文件，图标一直在这里。退出会停掉正在进行的转换。
        </DialogDescription>

        <div className="mt-4 flex items-center gap-2">
          <Checkbox
            aria-label="记住我的选择"
            checked={remember}
            data-slot="remember-close"
            id="remember-close"
            onCheckedChange={(checked) => setRemember(checked === true)}
          />
          <label className="cursor-pointer text-xs text-muted-foreground" htmlFor="remember-close">
            记住我的选择，下次不再询问
          </label>
        </div>

        <DialogFooter>
          {/* 只有一个高强调按钮：这里是"后台运行"——它不打断正在跑的转换 */}
          <Button onClick={() => answer('quit')} size="sm" variant="ghost">
            退出应用
          </Button>
          <Button onClick={() => answer('tray')} size="sm">
            后台运行
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
