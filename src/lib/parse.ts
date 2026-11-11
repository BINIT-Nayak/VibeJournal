export function parseNumber(value: unknown, fallback: number, min: number, max: number) {
  const nextValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, nextValue));
}

export function parseInteger(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value === "number" && !Number.isInteger(value)) {
    throw new Error("Scores and exercise minutes must be whole numbers.");
  }
  return parseNumber(value, fallback, min, max);
}

export function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}
