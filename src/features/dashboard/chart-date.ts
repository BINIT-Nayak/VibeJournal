export function dateLabel(value: string, weekday = false) {
  return new Intl.DateTimeFormat(
    "en",
    weekday
      ? { weekday: "short", timeZone: "UTC" }
      : { month: "short", day: "numeric", timeZone: "UTC" }
  ).format(new Date(`${value}T12:00:00Z`));
}
