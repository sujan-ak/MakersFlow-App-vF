export function isNetworkError(err: any): boolean {
  const msg = err?.message?.toLowerCase() ?? '';
  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('failed to fetch') ||
    msg.includes('unable to connect') ||
    msg.includes('dns') ||
    msg.includes('connection aborted')
  );
}
