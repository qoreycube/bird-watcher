import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const proxyRes = await fetch('http://qorey.webredirect.org:9000/species');
    const data = await proxyRes.json();
    return NextResponse.json(data, { status: proxyRes.status });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to proxy species', details: String(error) }, { status: 500 });
  }
}
