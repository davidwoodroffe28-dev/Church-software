export function ComingSoon({ screen }: { screen: string }) {
  return (
    <div className="coming-soon">
      <div className="coming-soon-inner">
        <div className="coming-soon-title">{screen}</div>
        <p className="hint">This screen is specified in DESIGN-SPEC.md but not built yet — Live is the only screen wired to real data so far.</p>
      </div>
    </div>
  );
}
