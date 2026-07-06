import { timingSafeEqual } from "crypto";
import { envValue } from "@/lib/env.server";

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export function isCronAuthorized(request: Request) {
  const provided =
    request.headers.get("apikey") ??
    request.headers.get("Authorization")?.replace(/^Bearer\s+/, "");
  const expected = envValue("CRON_SECRET");
  return !!provided && !!expected && safeEqual(provided, expected);
}
