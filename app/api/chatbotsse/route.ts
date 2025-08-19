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
    const upstreamUrl = `${base}/ollama/stream?prompt=${encodeURIComponent(prompt)}`;

    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        Accept: "text/event-stream",
      },
    });

    const upstreamBody = upstreamRes.body;
    if (!upstreamBody) {
      return NextResponse.json({ error: "Upstream did not provide a stream" }, { status: 502 });
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const reader = upstreamBody.getReader();
        const pump = (): Promise<void> => {
          return reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }
              if (value) controller.enqueue(value);
              return pump();
            })
            .catch((err: unknown) => {
              controller.error(err);
            });
        };
        return pump();
      },
      cancel() {
        // Reader will be GC'd, upstream fetch will likely close when client disconnects
      },
    });

    return new Response(stream, {
      status: upstreamRes.status,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to proxy chatbot stream", details: String(error) },
      { status: 500 }
    );
  }
}
