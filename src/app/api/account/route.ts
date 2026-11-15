import { observeRoute } from "@/server/observability/request";
import { DELETE as handleDELETE } from "@/server/auth/routes/account/route";

export const DELETE = observeRoute("/api/account", handleDELETE);
