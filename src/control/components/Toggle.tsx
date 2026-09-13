interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

/** DESIGN-SPEC.md §6: "Toggle on → track --accent, knob flush right." */
export function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <label className={'toggle-row' + (disabled ? ' toggle-row-disabled' : '')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={'toggle-switch' + (checked ? ' toggle-switch-on' : '')}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
      >
        <span className="toggle-knob" />
      </button>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  );
}
