import { observeRoute } from "@/server/observability/request";
import { GET as handleGET } from "@/server/auth/routes/google/callback/route";

export const GET = observeRoute("/api/auth/google/callback", handleGET);
