import { observeRoute } from "@/server/observability/request";
import {
  GET as handleGET,
  POST as handlePOST,
  DELETE as handleDELETE,
} from "@/server/journal/routes/entries/route";

export const GET = observeRoute("/api/entries", handleGET);
export const POST = observeRoute("/api/entries", handlePOST);
export const DELETE = observeRoute("/api/entries", handleDELETE);
