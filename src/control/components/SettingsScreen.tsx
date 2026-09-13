import { useEffect, useState } from 'react';
import type { OutputConfig } from '@shared/types';
import type { DisplayInfo } from '@shared/api';
import { useStore } from '../store';
import { Toggle } from './Toggle';

type Category = 'outputs' | 'appearance' | 'remote';

const ROLE_HELP: Record<OutputConfig['role'], string> = {
  program: 'The main audience/projector feed — background plus text, or full-frame media and slides.',
  stage: 'A confidence monitor for performers and speakers: current text, an up-next preview, and a clock.',
  stream: 'A chroma-key lower-thirds overlay for OBS/vMix Window Capture during a livestream.',
};

export function SettingsScreen() {
  const [category, setCategory] = useState<Category>('outputs');

  return (
    <div className="settings-screen">
      <div className="settings-category-column">
        <div className="column-header">
          <span className="mono column-title">SETTINGS</span>
        </div>
        <button className={'settings-category' + (category === 'outputs' ? ' settings-category-active' : '')} onClick={() => setCategory('outputs')}>
          Outputs
        </button>
        <button className={'settings-category' + (category === 'remote' ? ' settings-category-active' : '')} onClick={() => setCategory('remote')}>
          Remote Control
        </button>
        <button className={'settings-category' + (category === 'appearance' ? ' settings-category-active' : '')} onClick={() => setCategory('appearance')}>
          Appearance
        </button>
      </div>

      <div className="settings-content-column">
        {category === 'outputs' ? <OutputsSettingsPanel /> : category === 'remote' ? <RemoteSettingsPanel /> : <AppearanceSettingsPanel />}
      </div>
    </div>
  );
}

function OutputsSettingsPanel() {
  const library = useStore((s) => s.library);
  const saveOutputConfigs = useStore((s) => s.saveOutputConfigs);
  const refreshOutputStatuses = useStore((s) => s.refreshOutputStatuses);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);

  useEffect(() => {
    window.api.displays.list().then(setDisplays);
  }, []);

  if (!library) return null;

  function update(id: string, patch: Partial<OutputConfig>) {
    const configs = library!.outputConfigs.map((c) => (c.id === id ? { ...c, ...patch } : c));
    saveOutputConfigs(configs).then(refreshOutputStatuses);
  }

  return (
    <div className="settings-panel">
      <div className="screen-title">Output windows</div>
      {library.outputConfigs.map((c) => (
        <div key={c.id} className="settings-row">
          <div className="settings-row-main">
            <Toggle checked={c.enabled} onChange={(v) => update(c.id, { enabled: v })} />
            <div className="settings-row-text">
              <div className="settings-row-label">{c.name}</div>
              <div className="hint">{ROLE_HELP[c.role]}</div>
            </div>
          </div>
          <div className="settings-row-controls">
            <select
              value={c.displayId ?? ''}
              onChange={(e) => update(c.id, { displayId: e.target.value ? Number(e.target.value) : null })}
              disabled={!c.enabled}
            >
              <option value="">Windowed</option>
              {displays.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
            {c.role === 'stream' && (
              <input type="color" value={c.chromaKey} onChange={(e) => update(c.id, { chromaKey: e.target.value })} disabled={!c.enabled} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RemoteSettingsPanel() {
  const status = useStore((s) => s.remoteStatus);
  const busy = useStore((s) => s.remoteBusy);
  const startRemote = useStore((s) => s.startRemote);
  const stopRemote = useStore((s) => s.stopRemote);

  return (
    <div className="settings-panel">
      <div className="screen-title">Remote control</div>
      <div className="settings-row">
        <div className="settings-row-main">
          <Toggle checked={status.running} onChange={(v) => (v ? startRemote() : stopRemote())} disabled={busy} />
          <div className="settings-row-text">
            <div className="settings-row-label">Allow phones on this network to control Live</div>
            <div className="hint">
              Advance/back, Black, and Clear — the same as the keyboard shortcuts. Local network only; nothing
              leaves this building. Anyone with the link below can control the output, so treat it like a key.
            </div>
          </div>
        </div>
      </div>

      {status.running && status.url && (
        <div className="remote-connect">
          {status.qrDataUrl && <img className="remote-qr" src={status.qrDataUrl} alt="Scan to connect" />}
          <div className="remote-connect-text">
            <div className="hint">Scan with a phone on the same Wi-Fi, or open:</div>
            <div className="mono remote-url">{status.url}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppearanceSettingsPanel() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  return (
    <div className="settings-panel">
      <div className="screen-title">Appearance</div>
      <div className="settings-row">
        <div className="settings-row-main">
          <Toggle checked={theme === 'light'} onChange={toggleTheme} />
          <div className="settings-row-text">
            <div className="settings-row-label">Light theme</div>
            <div className="hint">Switch between dark and light interface colours. Slide monitors always stay dark.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
