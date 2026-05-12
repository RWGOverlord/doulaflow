import { NextRequest, NextResponse } from 'next/server';

type LogPayload = {
  level: 'error' | 'warn' | 'info';
  area: string;
  action: string;
  message: string;
  stack?: string;
  extra?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LogPayload;
    const { level = 'error', area, action, message, stack, extra } = body;

    const label = `[${area}/${action}]`;
    const details = extra && Object.keys(extra).length ? extra : undefined;

    if (level === 'error') {
      console.error(label, message, ...(stack ? ['\n' + stack] : []), ...(details ? [details] : []));
    } else if (level === 'warn') {
      console.warn(label, message, ...(details ? [details] : []));
    } else {
      console.log(label, message, ...(details ? [details] : []));
    }
  } catch {
    console.error('[logger/route] failed to parse log payload');
  }

  return NextResponse.json({ ok: true });
}
