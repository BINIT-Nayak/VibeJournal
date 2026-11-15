import { observeRoute } from "@/server/observability/request";
import { GET as handleGET } from "@/server/auth/routes/me/route";

export const GET = observeRoute("/api/auth/me", handleGET);
