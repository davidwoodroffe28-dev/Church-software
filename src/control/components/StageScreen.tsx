import { useEffect, useState } from 'react';
import { useStore, useActivePlaylist } from '../store';
import { buildLiveSlide, getNextSlide } from '../slideBuilder';
import { Toggle } from './Toggle';
import { Timer } from './Timer';

function useClock(enabled: boolean): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function StageScreen() {
  const library = useStore((s) => s.library);
  const playlist = useActivePlaylist();
  const liveItemId = useStore((s) => s.liveItemId);
  const liveSubIndex = useStore((s) => s.liveSubIndex);
  const stageMessage = useStore((s) => s.stageMessage);
  const setStageMessage = useStore((s) => s.setStageMessage);
  const stageClock = useStore((s) => s.stageClock);
  const setStageClock = useStore((s) => s.setStageClock);
  const countdown = useStore((s) => s.countdown);

  const clockText = useClock(stageClock);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!countdown.showOnProgram || !countdown.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [countdown.showOnProgram, countdown.running]);

  if (!library) return null;

  // Mirror sendProgramState's override exactly, so this mock never lies about what the room sees.
  const liveItem = playlist?.items.find((i) => i.id === liveItemId) ?? null;
  const currentSlide = countdown.showOnProgram
    ? { kind: 'countdown' as const }
    : liveItem
      ? buildLiveSlide(liveItem, liveSubIndex, library)
      : { kind: 'blank' as const };
  const nextSlide = countdown.showOnProgram ? undefined : getNextSlide(playlist ?? null, liveItemId, liveSubIndex, library);
  const countdownRemaining =
    countdown.running && countdown.endAt ? Math.ceil(Math.max(0, countdown.endAt - now) / 1000) : countdown.remainingSec;

  return (
    <div className="stage-screen">
      <div className="screen-title">Stage Display</div>

      <div className="stage-mock">
        {stageClock && <div className="mono stage-mock-clock">{clockText}</div>}
        <div className="stage-mock-lyric">
          {countdown.showOnProgram
            ? formatCountdown(countdownRemaining)
            : currentSlide.text || (liveItem ? currentSlide.label : 'Nothing on air')}
        </div>
        {nextSlide && (
          <div className="stage-mock-next">
            <span className="mono stage-mock-next-tag">NEXT</span>
            <span className="stage-mock-next-text">{nextSlide.text || nextSlide.label}</span>
          </div>
        )}
        {stageMessage && <div className="stage-mock-message">{stageMessage}</div>}
      </div>

      <div className="stage-controls-row">
        <label className="stage-message-field">
          Stage message
          <input
            value={stageMessage}
            onChange={(e) => setStageMessage(e.target.value)}
            placeholder="e.g. 5 minutes to sermon"
          />
        </label>
        <Toggle checked={stageClock} onChange={setStageClock} label="Show clock on stage display" />
        <Timer />
      </div>
    </div>
  );
}
