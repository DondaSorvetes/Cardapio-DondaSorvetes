import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
export function publicJson(request: NextRequest, data: unknown) {
  const body = JSON.stringify(data);
  const etag = '"' + createHash("sha256").update(body).digest("hex") + '"';
  const headers = {
    ETag: etag,
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Content-Type": "application/json; charset=utf-8",
  };
  if (
    request.headers
      .get("if-none-match")
      ?.split(",")
      .some((value) => value.trim().replace(/^W\//, "") === etag)
  )
    return new NextResponse(null, { status: 304, headers });
  return new NextResponse(body, { headers });
}
