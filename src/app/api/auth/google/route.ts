import { observeRoute } from "@/server/observability/request";
import { GET as handleGET } from "@/server/auth/routes/google/route";

export const GET = observeRoute("/api/auth/google", handleGET);
