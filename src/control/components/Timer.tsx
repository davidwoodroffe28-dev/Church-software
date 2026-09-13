import { useEffect, useRef, useState } from 'react';

function format(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** A simple countdown timer for the Stage screen — session-only, not persisted. */
export function Timer() {
  const [minutes, setMinutes] = useState(5);
  const [remaining, setRemaining] = useState(5 * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 0) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running]);

  function reset(mins: number) {
    setRunning(false);
    setMinutes(mins);
    setRemaining(mins * 60);
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
          value={minutes}
          onChange={(e) => reset(Math.max(1, Number(e.target.value) || 1))}
          disabled={running}
          title="Minutes"
        />
        <button onClick={() => setRunning((r) => !r)} disabled={remaining === 0}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button onClick={() => reset(minutes)}>Reset</button>
      </div>
    </div>
  );
}
