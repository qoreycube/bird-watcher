import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import sharp from "sharp";

// Store upload timestamps per IP
type BirdUploadRateLimiterGlobal = typeof globalThis & {
  __birdUploadRateLimiter?: Map<string, number[]>;
};

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const image = formData.get("image");
  // Simple in-memory rate limiter (per process)
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxUploads = 5;
// Resize image to 400px wide before proxying

if (image && image instanceof File) {
    const arrayBuffer = await image.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Use sharp for resizing
    const resizedBuffer = await sharp(inputBuffer)
        .resize({ width: 400 })
        .toBuffer();

    // Create a new File for the resized image
    const resizedImage = new File([new Uint8Array(resizedBuffer)], image.name, {
        type: image.type,
    });

    formData.set("image", resizedImage);
}
  const globalWithLimiter = globalThis as BirdUploadRateLimiterGlobal;

  if (!globalWithLimiter.__birdUploadRateLimiter) {
    globalWithLimiter.__birdUploadRateLimiter = new Map<string, number[]>();
  }
  const rateLimiter = globalWithLimiter.__birdUploadRateLimiter as Map<
    string,
    number[]
  >;

  const uploads = rateLimiter.get(ip) || [];
  // Remove timestamps older than windowMs
  const recentUploads = uploads.filter((ts) => now - ts < windowMs);

  if (recentUploads.length >= maxUploads) {
    return NextResponse.json(
      { error: "Too many uploads, please wait before trying again." },
      { status: 429 }
    );
  }

  recentUploads.push(now);
  rateLimiter.set(ip, recentUploads);

  if (!image || !(image instanceof File)) {
    return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
  }

  // You can process the image here (e.g., save to disk, cloud, etc.)
  // For now, just return a success response

  // Proxy the image to the external API
  const proxyFormData = new FormData();
  proxyFormData.append("image", image);

  try {
    const proxyRes = await fetch("https://bird-watcher-backend.onrender.com:5000/predict", {
      method: "POST",
      body: proxyFormData,
    });
    const data = await proxyRes.json();
    return NextResponse.json(data, { status: proxyRes.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to proxy image", details: String(error) },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Image received successfully" });
}
