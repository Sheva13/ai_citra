// Format waktu WIB (Asia/Jakarta) untuk tampilan UI.

export function formatWib(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...options,
  });
}

export function formatWibTime(iso: string | null | undefined): string {
  return formatWib(iso, {
    day: undefined,
    month: undefined,
    year: undefined,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Awal & akhir hari (WIB) dari input tanggal YYYY-MM-DD → ISO UTC untuk API.
export function wibDayRange(date: string): { from: string; to: string } {
  const from = new Date(`${date}T00:00:00+07:00`);
  const to = new Date(`${date}T23:59:59.999+07:00`);
  return { from: from.toISOString(), to: to.toISOString() };
}
