import { observeRoute } from "@/server/observability/request";
import {
  GET as handleGET,
  PATCH as handlePATCH,
  DELETE as handleDELETE,
} from "@/server/journal/routes/entries/[id]/route";

export const GET = observeRoute("/api/entries/[id]", handleGET);
export const PATCH = observeRoute("/api/entries/[id]", handlePATCH);
export const DELETE = observeRoute("/api/entries/[id]", handleDELETE);
