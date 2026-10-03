export const number = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(
    value,
  );
export const lbs = (value: number) => `${number(value, 1)} lbs`;
export const percent = (value: number) => `${number(value, 1)}%`;
export const currency = (value: number, time: string, digits = 0) =>
  `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)} ${time}`;
export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
export const timestamp = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Detroit",
  }).format(new Date(iso)) + " ET";
export const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
