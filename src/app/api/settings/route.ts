import { observeRoute } from "@/server/observability/request";
import { PATCH as handlePATCH } from "@/server/auth/routes/settings/route";

export const PATCH = observeRoute("/api/settings", handlePATCH);
