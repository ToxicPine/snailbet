import { baremuxPath } from "npm:@mercuryworkshop/bare-mux@2.1.9/node";
import { scramjetPath } from "npm:@mercuryworkshop/scramjet@1.1.0/path";
import { javascript, json, serveStatic } from "./assets.ts";
import {
  SCRAMJET_HOST,
  SCRAMJET_PORT,
  SCRAMJET_ROUTES_DIR,
} from "./constants.ts";
import { renderError } from "./errors.ts";
import {
  createDirectoryRouteTargetGetter,
  listRouteIds,
  resolvePublicRoute,
} from "./routes.ts";
import { scramjetServiceWorkerScript, shellResponse } from "./scramjet.ts";
import { handleTransport, localTransportModule } from "./transport.ts";

const SCRAMJET_ASSET_PREFIX = "/__scramjet/";
const BAREMUX_ASSET_PREFIX = "/__baremux/";
const TRANSPORT_PREFIX = "/__transport/";

if (
  !Number.isInteger(SCRAMJET_PORT) || SCRAMJET_PORT < 1 || SCRAMJET_PORT > 65535
) {
  console.error("SCRAMJET_PORT must be an integer from 1 to 65535.");
  Deno.exit(1);
}

const getRouteTarget = createDirectoryRouteTargetGetter(SCRAMJET_ROUTES_DIR);

Deno.serve({ hostname: SCRAMJET_HOST, port: SCRAMJET_PORT }, handleRequest);

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/__health") {
    const ids = await listRouteIds(SCRAMJET_ROUTES_DIR);
    if (!ids.ok) {
      return json({ ok: false, error: ids.error.message }, ids.error.status);
    }

    return json({ ok: true, routes: ids.value });
  }

  if (url.pathname === "/__scramjet-sw.js") {
    return javascript(scramjetServiceWorkerScript());
  }

  if (url.pathname === "/__route-proxy/transport.js") {
    return javascript(localTransportModule());
  }

  if (url.pathname.startsWith(SCRAMJET_ASSET_PREFIX)) {
    return serveStatic(url.pathname, SCRAMJET_ASSET_PREFIX, scramjetPath);
  }

  if (url.pathname.startsWith(BAREMUX_ASSET_PREFIX)) {
    return serveStatic(url.pathname, BAREMUX_ASSET_PREFIX, baremuxPath);
  }

  if (url.pathname.startsWith(TRANSPORT_PREFIX)) {
    return handleTransport(request, getRouteTarget);
  }

  const route = await resolvePublicRoute(url, getRouteTarget);
  if (!route.ok) {
    return renderError(route.error);
  }

  return shellResponse(route.value.id, route.value.targetOrigin);
}
