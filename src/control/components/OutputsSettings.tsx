import { useEffect, useState } from 'react';
import type { OutputConfig } from '@shared/types';
import type { DisplayInfo } from '@shared/api';
import { useStore } from '../store';
import { Toggle } from './Toggle';

interface Props {
  onClose: () => void;
}

export function OutputsSettings({ onClose }: Props) {
  const library = useStore((s) => s.library);
  const saveOutputConfigs = useStore((s) => s.saveOutputConfigs);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [configs, setConfigs] = useState<OutputConfig[]>(library?.outputConfigs ?? []);

  useEffect(() => {
    window.api.displays.list().then(setDisplays);
  }, []);

  function update(id: string, patch: Partial<OutputConfig>) {
    setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function save() {
    await saveOutputConfigs(configs);
    onClose();
  }

  return (
    <div className="modal-backdrop">
      <div className="modal outputs-settings">
        <h2>Output Windows</h2>
        <p className="hint">
          <strong>Program</strong> is the main audience/projector feed. <strong>Stage Display</strong> is a
          confidence monitor for performers/speakers (current + next + clock). <strong>Stream</strong> is a
          chroma-key lower-thirds overlay window for OBS/vMix Window Capture during livestream.
        </p>
        <table className="outputs-table">
          <thead>
            <tr>
              <th>Enabled</th>
              <th>Output</th>
              <th>Display</th>
              <th>Chroma key</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((c) => (
              <tr key={c.id}>
                <td>
                  <Toggle checked={c.enabled} onChange={(checked) => update(c.id, { enabled: checked })} />
                </td>
                <td>{c.name} <span className="role-badge">{c.role}</span></td>
                <td>
                  <select
                    value={c.displayId ?? ''}
                    onChange={(e) => update(c.id, { displayId: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">Windowed (not pinned to a display)</option>
                    {displays.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {c.role === 'stream' ? (
                    <input type="color" value={c.chromaKey} onChange={(e) => update(c.id, { chromaKey: e.target.value })} />
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>Save &amp; Apply</button>
        </div>
      </div>
    </div>
  );
}
