import { observeRoute } from "@/server/observability/request";
import { GET as handleGET } from "@/server/dashboard/route";

export const GET = observeRoute("/api/dashboard", handleGET);
