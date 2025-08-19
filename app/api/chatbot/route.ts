import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get("prompt");
  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt parameter" }, { status: 400 });
  }
  try {
    const base = getApiBaseUrl(request);
    const res = await fetch(`${base}/ollama?prompt=${encodeURIComponent(prompt)}`, {
      headers: {
        Accept: "application/json, text/plain, */*",
      },
    });

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } else {
      const text = await res.text();
      // Return plain text from upstream wrapped in JSON so the client can render it
      return NextResponse.json(
        { response: text, note: "Upstream returned non-JSON response" },
        { status: res.status }
      );
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to proxy chatbot request", details: String(error) }, { status: 500 });
  }
}
