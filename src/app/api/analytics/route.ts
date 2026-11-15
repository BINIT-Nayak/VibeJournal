import { observeRoute } from "@/server/observability/request";
import { GET as handleGET } from "@/server/analytics/route";

export const GET = observeRoute("/api/analytics", handleGET);
