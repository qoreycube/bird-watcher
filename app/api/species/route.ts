import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getApiBaseUrl } from '@/lib/apiBaseUrl';

export async function GET(request: NextRequest) {
  try {
  const base = getApiBaseUrl(request);
  const proxyRes = await fetch(`${base}/species`);
    const data = await proxyRes.json();
    return NextResponse.json(data, { status: proxyRes.status });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to proxy species', details: String(error) }, { status: 500 });
  }
}
