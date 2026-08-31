const COLOMBIA_TZ = 'America/Bogota';

export function getColombiaEmissionDateTime(now: Date = new Date()): { date: string; time: string } {
  const date = now.toLocaleDateString('en-CA', { timeZone: COLOMBIA_TZ }); // YYYY-MM-DD
  const time = now.toLocaleTimeString('en-GB', {
    timeZone: COLOMBIA_TZ,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }); // HH:mm:ss
  return { date, time };
}
