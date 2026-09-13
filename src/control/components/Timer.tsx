import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Toggle } from './Toggle';

function format(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Pre-service countdown — session-only, not persisted. Lives in the store (not local state) so
 *  "Show on Program" can broadcast it to the real outputs and it keeps running across tab changes. */
export function Timer() {
  const countdown = useStore((s) => s.countdown);
  const setDuration = useStore((s) => s.setCountdownDuration);
  const start = useStore((s) => s.startCountdown);
  const pause = useStore((s) => s.pauseCountdown);
  const reset = useStore((s) => s.resetCountdown);
  const setOnProgram = useStore((s) => s.setCountdownOnProgram);

  const [minutesInput, setMinutesInput] = useState(String(Math.round(countdown.durationSec / 60)));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!countdown.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [countdown.running]);

  const remaining =
    countdown.running && countdown.endAt ? Math.ceil(Math.max(0, countdown.endAt - now) / 1000) : countdown.remainingSec;

  function applyMinutes(value: string) {
    setMinutesInput(value);
    setDuration(Math.max(1, Number(value) || 1) * 60);
  }

  return (
    <div className="timer">
      <div className="mono timer-display">{format(remaining)}</div>
      <div className="timer-controls">
        <input
          type="number"
          className="timer-minutes"
          min={1}
          max={99}
          value={minutesInput}
          onChange={(e) => applyMinutes(e.target.value)}
          disabled={countdown.running}
          title="Minutes"
        />
        <button onClick={countdown.running ? pause : start} disabled={!countdown.running && remaining === 0}>
          {countdown.running ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={() => {
            reset();
            setMinutesInput(String(Math.round(countdown.durationSec / 60)));
          }}
        >
          Reset
        </button>
      </div>
      <Toggle checked={countdown.showOnProgram} onChange={setOnProgram} label="Show on Program" />
    </div>
  );
}
