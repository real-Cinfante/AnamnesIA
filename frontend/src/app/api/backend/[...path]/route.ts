import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const BACKEND_URL =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001";

async function proxy(req: NextRequest, method: string): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;
  const backendPath = pathname.replace(/^\/api\/backend/, "");
  const url = `${BACKEND_URL}${backendPath}${search}`;

  const headers: Record<string, string> = {};

  // 1. Cookie anamnesia_token — set explicitly at login, most reliable
  const anamnesiaToken = req.cookies.get("anamnesia_token")?.value;
  if (anamnesiaToken) {
    headers["Authorization"] = `Bearer ${anamnesiaToken}`;
  }

  // 2. Supabase SSR session from cookies
  if (!headers["Authorization"]) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    } catch {
      // Supabase not configured — skip
    }
  }

  // 3. Authorization header forwarded by api.ts
  if (!headers["Authorization"]) {
    const forwarded = req.headers.get("authorization");
    if (forwarded) headers["Authorization"] = forwarded;
  }

  // Forward Content-Type for all requests (including multipart with boundary)
  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  const body = method === "GET" || method === "HEAD" ? undefined : await req.blob();

  const res = await fetch(url, { method, headers, body });
  const data = await res.blob();

  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET(req: NextRequest) { return proxy(req, "GET"); }
export async function POST(req: NextRequest) { return proxy(req, "POST"); }
export async function PATCH(req: NextRequest) { return proxy(req, "PATCH"); }
export async function PUT(req: NextRequest) { return proxy(req, "PUT"); }
export async function DELETE(req: NextRequest) { return proxy(req, "DELETE"); }
