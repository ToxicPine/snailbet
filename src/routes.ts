import { join } from "node:path";
import { INTERNAL_PREFIXES } from "./constants.ts";
import { err, ok, type Result } from "./result.ts";
import type { RouteError } from "./errors.ts";

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export type RouteId = string;

export type PublicRoute = {
  id: RouteId;
  targetOrigin: URL;
};

export type RouteTargetGetter = (
  id: RouteId,
) => Promise<Result<URL, RouteError>>;

export function createDirectoryRouteTargetGetter(
  routesDirectory: string,
): RouteTargetGetter {
  return (id) => getRouteTargetFromDirectory(routesDirectory, id);
}

export function routeIdFromUrl(url: URL): Result<RouteId, RouteError> {
  const [id = ""] = url.pathname.slice(1).split("/");

  if (!id) {
    return err({
      category: "bad-route",
      status: 404,
      message: "Route id required.",
    });
  }

  return parsePublicRouteId(id);
}

export async function resolvePublicRoute(
  url: URL,
  getRouteTarget: RouteTargetGetter,
): Promise<Result<PublicRoute, RouteError>> {
  const id = routeIdFromUrl(url);
  if (!id.ok) return id;

  const targetOrigin = await getRouteTarget(id.value);
  if (!targetOrigin.ok) return targetOrigin;

  return ok({ id: id.value, targetOrigin: targetOrigin.value });
}

async function getRouteTargetFromDirectory(
  routesDirectory: string,
  id: RouteId,
): Promise<Result<URL, RouteError>> {
  const idResult = parseConfiguredRouteId(id);
  if (!idResult.ok) return idResult;

  let rawOrigin: string;
  try {
    rawOrigin = await Deno.readTextFile(join(routesDirectory, id));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return err({
        category: "unknown-id",
        status: 404,
        message: `Unknown route id: ${id}`,
      });
    }

    return err({
      category: "config-error",
      status: 500,
      message: `Cannot read route ${id}: ${messageFrom(error)}`,
    });
  }

  return parseRouteTarget(id, rawOrigin);
}

export async function listRouteIds(
  routesDirectory: string,
): Promise<Result<RouteId[], RouteError>> {
  const ids: RouteId[] = [];

  let entries: Deno.DirEntry[];
  try {
    entries = [];
    for await (const entry of Deno.readDir(routesDirectory)) {
      entries.push(entry);
    }
  } catch (error) {
    return err({
      category: "config-error",
      status: 500,
      message: `Cannot read route directory: ${messageFrom(error)}`,
    });
  }

  for (
    const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name)
    )
  ) {
    if (!entry.isFile) continue;

    const idResult = parseConfiguredRouteId(entry.name);
    if (!idResult.ok) return idResult;
    ids.push(idResult.value);
  }

  return ok(ids);
}

export function canTransportTo(remote: URL, target: URL): boolean {
  if (!["http:", "https:", "ws:", "wss:"].includes(remote.protocol)) {
    return false;
  }

  if (!isLocalHost(remote.hostname)) {
    return false;
  }

  return equivalentOrigin(remote, target);
}

export function parsePublicRouteId(id: string): Result<RouteId, RouteError> {
  if (INTERNAL_PREFIXES.includes(id as never)) {
    return err({
      category: "bad-route",
      status: 404,
      message: "Internal route.",
    });
  }

  if (!isRouteId(id)) {
    return err({
      category: "bad-route",
      status: 400,
      message: "Invalid route id.",
    });
  }

  return ok(id);
}

function parseConfiguredRouteId(id: string): Result<RouteId, RouteError> {
  if (INTERNAL_PREFIXES.includes(id as never) || !isRouteId(id)) {
    return err({
      category: "config-error",
      status: 500,
      message: `Invalid route id: ${id}`,
    });
  }

  return ok(id);
}

function parseRouteTarget(
  id: RouteId,
  rawOrigin: string,
): Result<URL, RouteError> {
  const origin = rawOrigin.trim();
  if (!origin) {
    return err({
      category: "config-error",
      status: 500,
      message: `Empty route target: ${id}`,
    });
  }

  let target: URL;
  try {
    target = new URL(origin);
  } catch {
    return err({
      category: "config-error",
      status: 500,
      message: `Invalid target origin: ${id}`,
    });
  }

  if (
    !["http:", "https:"].includes(target.protocol) ||
    !isLocalHost(target.hostname)
  ) {
    return err({
      category: "config-error",
      status: 500,
      message: `Target must be localhost: ${id}`,
    });
  }

  if (target.pathname !== "/" || target.search || target.hash) {
    return err({
      category: "config-error",
      status: 500,
      message: `Target must be an origin only: ${id}`,
    });
  }

  return ok(target);
}

function isRouteId(id: string): id is RouteId {
  return ID_PATTERN.test(id);
}

function equivalentOrigin(remote: URL, target: URL): boolean {
  const remoteProtocol = remote.protocol === "ws:"
    ? "http:"
    : remote.protocol === "wss:"
    ? "https:"
    : remote.protocol;
  return remoteProtocol === target.protocol &&
    remote.hostname === target.hostname &&
    remote.port === target.port;
}

function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host.toLowerCase());
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
