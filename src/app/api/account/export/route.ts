import { observeRoute } from "@/server/observability/request";
import { GET as handleGET } from "@/server/data-export/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = observeRoute("/api/account/export", handleGET);
