type LogLevel = 'error' | 'warn' | 'info';

async function send(
  level: LogLevel,
  area: string,
  action: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  const stack = extra?.error instanceof Error ? extra.error.stack : undefined;

  // Always log to browser console too (useful during local dev)
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${area}/${action}]`, message, extra ?? '');

  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, area, action, message, stack, extra }),
    });
  } catch {
    // Never let logging itself break the app
  }
}

export const logger = {
  error: (area: string, action: string, message: string, extra?: Record<string, unknown>) =>
    send('error', area, action, message, extra),
  warn: (area: string, action: string, message: string, extra?: Record<string, unknown>) =>
    send('warn', area, action, message, extra),
  info: (area: string, action: string, message: string, extra?: Record<string, unknown>) =>
    send('info', area, action, message, extra),
};
