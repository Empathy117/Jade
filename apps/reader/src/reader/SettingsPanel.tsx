import type { ReaderSettings } from "./readerSettings";

interface SettingsPanelProps {
  settings: ReaderSettings;
  onChange: React.Dispatch<React.SetStateAction<ReaderSettings>>;
  onClose: () => void;
}

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  function update<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) {
    onChange((current) => ({ ...current, [key]: value }));
  }

  return (
    <aside className="settings-panel" data-interactive="true" aria-label="阅读设置">
      <div className="settings-heading">
        <div><p>阅读设置</p><span>所有设置保存在本机</span></div>
        <button type="button" aria-label="关闭设置" onClick={onClose}>×</button>
      </div>
      <ToggleSetting
        title="纯净阅读"
        note="关闭背景、音乐与环境音"
        checked={settings.pureMode}
        onChange={(checked) => update("pureMode", checked)}
      />
      <ToggleSetting
        title="静音"
        note="保留视觉演出"
        checked={settings.muted}
        onChange={(checked) => update("muted", checked)}
      />
      <ToggleSetting
        title="减少动态效果"
        note="关闭平滑滚动与长转场"
        checked={settings.reducedMotion}
        onChange={(checked) => update("reducedMotion", checked)}
      />
      <RangeSetting label="字号" value={settings.fontScale} min={0.85} max={1.3} step={0.05} display={`${Math.round(settings.fontScale * 100)}%`} onChange={(value) => update("fontScale", value)} />
      <RangeSetting label="音乐" value={settings.musicVolume} min={0} max={1} step={0.05} display={`${Math.round(settings.musicVolume * 100)}%`} onChange={(value) => update("musicVolume", value)} />
      <RangeSetting label="环境音" value={settings.ambienceVolume} min={0} max={1} step={0.05} display={`${Math.round(settings.ambienceVolume * 100)}%`} onChange={(value) => update("ambienceVolume", value)} />
    </aside>
  );
}

function ToggleSetting({ title, note, checked, onChange }: { title: string; note: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span><strong>{title}</strong><small>{note}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

interface RangeSettingProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}

function RangeSetting({ label, value, min, max, step, display, onChange }: RangeSettingProps) {
  return (
    <label className="range-setting">
      <span><strong>{label}</strong><small>{display}</small></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
