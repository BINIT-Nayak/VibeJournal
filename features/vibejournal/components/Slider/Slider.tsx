import styles from "./Slider.module.css";

type SliderProps = {
  label: string;
  onChange: (value: number) => void;
  value: number;
};

export function Slider({ label, onChange, value }: SliderProps) {
  return (
    <label className={styles.sliderRow}>
      <span>{label}</span>
      <input
        min="1"
        max="10"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
      />
      <strong>{value}</strong>
    </label>
  );
}
