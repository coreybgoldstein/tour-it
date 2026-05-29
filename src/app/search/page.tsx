// /search → /tour redirect. The route was renamed 2026-05-29 as part
// of the home-loop redesign — "Tour" reflects the unified
// course + trip browsing surface better than the generic "Search".
// This thin redirect preserves every external link, push notif, and
// /search?tab=trips style URL.

import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SearchRedirect({ searchParams }: Props) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
    else if (v != null) qs.set(k, v);
  }
  const tail = qs.toString();
  redirect(`/tour${tail ? "?" + tail : ""}`);
}
