export function logEvent(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...fields }));
}
