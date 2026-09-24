/**
 * 应用外壳：标题栏 + 两种页面。
 *
 *   转换界面：设置栏 + 工作区 + 详情栏，只放"这次要转成什么"
 *   设置界面：分类 + 内容，放"设置一次长期有效"的偏好
 *
 * 布局与样式来自 EnsoCode 的设计语言（见 docs/design-system.md）：
 * 所有面板同一个底色，层级只由 1px 边框与半透明叠加表达；
 * 颜色只留给状态与那一个实心主按钮。
 *
 * 与数据的关系没变：界面上的每个控件都对应一个已实现的能力，
 * 没有编码器滑块、帧率下拉这类"画了但接不上"的东西。
 */
import { useEffect, useState, type DragEvent } from 'react';
import { CloseDialog } from '@/components/app/close-dialog';
import { DropOverlay } from '@/components/app/drop-overlay';
import { Inspector } from '@/components/app/inspector';
import { SettingsRail } from '@/components/app/settings-rail';
import { SettingsView, type SettingsCategory } from '@/components/app/settings/settings-view';
import { TitleBar } from '@/components/app/title-bar';
import { Workspace } from '@/components/app/workspace';
import { TooltipProvider } from '@/components/ui/tooltip';
import { pathsFromText } from '@/lib/drop';
import { useStore } from '@/store';

export default function App() {
  const tasks = useStore((s) => s.tasks);
  const hardware = useStore((s) => s.hardware);

  const [dragging, setDragging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  // 页面不持久化：每次启动都从转换界面开始，那是这个应用的主职
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [category, setCategory] = useState<SettingsCategory>('output');
  /** 主进程拦下关闭按钮时会亮起，问用户缩托盘还是退出 */
  const [closeAsk, setCloseAsk] = useState(false);

  const selected = tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? null;

  useEffect(() => {
    const unsubscribe = window.ffshift?.onCloseRequest(() => setCloseAsk(true));
    return () => unsubscribe?.();
  }, []);

  /** 拖放要走真实路径：Electron 里 File 对象拿不到磁盘路径，需经 preload 的 webUtils */
  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);

    const paths: string[] = [];
    const push = (path: string | null | undefined) => {
      if (path && !paths.includes(path)) paths.push(path);
    };

    // 1) 资源管理器来的 File：磁盘路径只能问 preload
    for (const file of Array.from(event.dataTransfer.files)) {
      push(window.ffshift?.getPathForFile(file));
    }

    // 2) 有些来源只给 items，files 是空的
    if (paths.length === 0) {
      for (const item of Array.from(event.dataTransfer.items ?? [])) {
        if (item.kind !== 'file') continue;
        const file = item.getAsFile();
        if (file) push(window.ffshift?.getPathForFile(file));
      }
    }

    // 3) 浏览器、压缩包窗口、部分下载工具只给 URI
    if (paths.length === 0) {
      for (const type of ['text/uri-list', 'text/plain']) {
        const text = event.dataTransfer.getData(type);
        if (!text) continue;
        for (const path of pathsFromText(text)) push(path);
      }
    }

    if (paths.length === 0) {
      // 以前这里是静默返回，用户看到的是"拖进去没反应"。说清楚为什么。
      useStore
        .getState()
        .setNotice('这些内容没有可读取的磁盘路径。手机、压缩包或网页里的文件，先保存到本地再拖。');
      return;
    }

    await useStore.getState().addFiles(paths);
  };

  const openSettings = (target: SettingsCategory) => {
    setCategory(target);
    setSettingsOpen(true);
  };

  return (
    <TooltipProvider>
      <main
        className="flex h-screen flex-col overflow-hidden bg-background text-foreground"
        data-slot="app-shell"
        onDragLeave={(event) => {
          // 移到子元素上也会触发 dragleave；只有真的离开窗口才收起提示，
          // 否则鼠标划过行内按钮时整块遮罩会闪一下
          const next = event.relatedTarget as Node | null;
          if (!next || !event.currentTarget.contains(next)) setDragging(false);
        }}
        onDragOver={(event) => {
          // 无条件放行：能不能用放到 drop 里判断。
          // 以前这里先看 dataTransfer.types 里有没有 Files，没有就提前 return ——
          // 于是浏览器不把窗口当可投放目标，连 drop 事件都不派发。
          // 从浏览器、压缩包窗口、部分下载工具拖过来的文件只带 text/uri-list，
          // 正好撞在这条上：用户看到的是"拖进去毫无反应"。
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
          if (!dragging) setDragging(true);
        }}
        onDrop={(event) => void handleDrop(event)}
      >
        <TitleBar
          engineLabel={hardware.length > 0 ? `硬件加速：${hardware.join(' / ')}` : 'CPU 编码'}
          engineReady={hardware.length > 0}
          onCloseSettings={() => setSettingsOpen(false)}
          onOpenSettings={() => openSettings('output')}
          onToggleRail={() => setRailOpen((open) => !open)}
          railOpen={railOpen}
          settingsOpen={settingsOpen}
        />

        {settingsOpen ? (
          <SettingsView category={category} onCategoryChange={setCategory} />
        ) : (
          <div className="flex min-h-0 flex-1">
            {railOpen && <SettingsRail onOpenSettings={() => openSettings('params')} />}

            <Workspace
              dragging={dragging}
              inspectorOpen={inspectorOpen}
              onSelect={(id) => {
                setSelectedId(id);
                setInspectorOpen(true);
              }}
              onToggleInspector={() => setInspectorOpen((open) => !open)}
              selectedId={selected?.id ?? null}
            />

            {inspectorOpen && selected && <Inspector onClose={() => setInspectorOpen(false)} task={selected} />}
          </div>
        )}

        {dragging && <DropOverlay />}

        <CloseDialog
          onAnswer={(choice, remember) => {
            setCloseAsk(false);
            void window.ffshift?.respondCloseRequest(choice, remember);
          }}
          open={closeAsk}
        />
      </main>
    </TooltipProvider>
  );
}
