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
import { useState, type DragEvent } from 'react';
import { DropOverlay } from '@/components/app/drop-overlay';
import { Inspector } from '@/components/app/inspector';
import { SettingsRail } from '@/components/app/settings-rail';
import { SettingsView, type SettingsCategory } from '@/components/app/settings/settings-view';
import { TitleBar } from '@/components/app/title-bar';
import { Workspace } from '@/components/app/workspace';
import { TooltipProvider } from '@/components/ui/tooltip';
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

  const selected = tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? null;

  /** 拖放要走真实路径：Electron 里 File 对象拿不到磁盘路径，需经 preload 的 webUtils */
  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => window.ffshift?.getPathForFile(file))
      .filter((path): path is string => Boolean(path));
    if (paths.length) await useStore.getState().addFiles(paths);
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
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
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
      </main>
    </TooltipProvider>
  );
}
