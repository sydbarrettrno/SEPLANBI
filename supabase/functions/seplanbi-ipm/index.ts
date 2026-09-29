import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@6.1.2";

const PROJECT_ID = "prj_loKnGqz2d61q2qVGRCaWA0M2xwcS";
const OWNER_ID = "team_YHqYV43I9aTrLE99I87WRmdG";
const OWNER_SLUG = "anibalnisgo";
const ALLOWED_ISSUERS = [
  `https://oidc.vercel.com/${OWNER_SLUG}`,
  "https://oidc.vercel.com",
];
const ALLOWED_AUDIENCES = [
  `https://vercel.com/${OWNER_SLUG}`,
  "https://vercel.com",
];
const JWKS = createRemoteJWKSet(new URL("https://oidc.vercel.com/.well-known/jwks"));

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function authorize(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) throw new Error("missing_token");

  const decoded = decodeJwt(token);
  if (!decoded.iss || !ALLOWED_ISSUERS.includes(decoded.iss)) throw new Error("invalid_issuer");

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: ALLOWED_ISSUERS,
    audience: ALLOWED_AUDIENCES,
  });

  if (payload.project_id !== PROJECT_ID) throw new Error("invalid_project");
  if (payload.owner_id !== OWNER_ID) throw new Error("invalid_owner");
  if (!["production", "preview"].includes(String(payload.environment || ""))) throw new Error("invalid_environment");
  return payload;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SECRET_KEY = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function adminFetch(path: string, init: RequestInit = {}) {
  if (!SECRET_KEY) throw new Error("missing_supabase_secret");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SECRET_KEY);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
}

async function responseJson(res: Response) {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`supabase_${res.status}:${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : null;
}

function safeRunId(value: unknown) {
  const text = String(value || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(text)) throw new Error("invalid_run_id");
  return text;
}

function sanitizeSearch(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s\/._-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";

  if (action === "ping") {
    return json({ ok: true, service: "seplanbi-ipm", storage: "supabase" });
  }

  if (action === "baseline-info") {
    const res = await adminFetch("/rest/v1/protocols?select=protocol_id&limit=1", {
      headers: { Prefer: "count=exact", Range: "0-0" },
    });
    if (!res.ok) return json({ ok: false, error: await res.text() }, res.status);
    const range = res.headers.get("content-range") || "*/0";
    const total = Number(range.split("/").pop() || 0);
    return json({ ok: true, protocol_count: Number.isFinite(total) ? total : 0 });
  }

  if (action === "claim-next") {
    const res = await adminFetch("/rest/v1/rpc/claim_next_ipm_import", {
      method: "POST",
      body: JSON.stringify({}),
    });
    return json({ ok: true, result: await responseJson(res) });
  }

  if (action === "finish-worker") {
    const payload = await req.json();
    const res = await adminFetch("/rest/v1/rpc/finish_ipm_import_worker", {
      method: "POST",
      body: JSON.stringify({
        p_run_id: safeRunId(payload.run_id),
        p_lease_token: safeRunId(payload.lease_token),
        p_error: payload.error ? String(payload.error).slice(0, 500) : null,
      }),
    });
    return json({ ok: true, result: await responseJson(res) });
  }

  if (action === "create-run") {
    const payload = await req.json();
    const body = {
      reference_date: payload.reference_date,
      source_filename: String(payload.source_filename || "").slice(0, 240),
      status: "validating",
      source_rows: Number(payload.source_rows || 0),
      duplicate_count: Number(payload.duplicate_count || 0),
      invalid_date_count: Number(payload.invalid_date_count || 0),
      validation_summary: payload.validation_summary || {},
      source_metadata: payload.source_metadata || {},
    };
    const res = await adminFetch("/rest/v1/ipm_import_runs?select=*", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    const rows = await responseJson(res);
    return json({ ok: true, run: rows?.[0] });
  }

  if (action === "upload-file") {
    const runId = safeRunId(req.headers.get("x-run-id"));
    const referenceDate = String(req.headers.get("x-reference-date") || "");
    const canonicalName = String(req.headers.get("x-canonical-name") || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) throw new Error("invalid_reference_date");
    if (!/^BASEIPM_\d{8}\.xlsx$/i.test(canonicalName)) throw new Error("invalid_canonical_name");

    const [year, month] = referenceDate.split("-");
    const objectPath = `raw/${year}/${month}/${runId}/${canonicalName}`;
    const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
    const body = await req.arrayBuffer();

    const storageRes = await adminFetch(`/storage/v1/object/ipm-raw/${encodedPath}`, {
      method: "POST",
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "x-upsert": "false",
      },
      body,
    });
    await responseJson(storageRes);

    const patchRes = await adminFetch(`/rest/v1/ipm_import_runs?id=eq.${runId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ stored_path: objectPath }),
    });
    await responseJson(patchRes);
    return json({ ok: true, stored_path: objectPath });
  }

  if (action === "download-file") {
    const payload = await req.json();
    const runId = safeRunId(payload.run_id);
    const runRes = await adminFetch(`/rest/v1/ipm_import_runs?select=stored_path&id=eq.${runId}&limit=1`);
    const runs = await responseJson(runRes);
    const storedPath = runs?.[0]?.stored_path;
    if (!storedPath) return json({ ok: false, error: "Arquivo original não encontrado." }, 404);

    const encodedPath = String(storedPath).split("/").map(encodeURIComponent).join("/");
    const fileRes = await adminFetch(`/storage/v1/object/authenticated/ipm-raw/${encodedPath}`);
    if (!fileRes.ok) {
      return json({ ok: false, error: await fileRes.text() }, fileRes.status);
    }
    return new Response(await fileRes.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "cache-control": "no-store",
      },
    });
  }

  if (action === "stage") {
    const payload = await req.json();
    const runId = safeRunId(payload.run_id);
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    if (!rows.length || rows.length > 500) throw new Error("invalid_stage_batch");
    for (const row of rows) row.import_run_id = runId;

    const res = await adminFetch("/rest/v1/ipm_stage_protocols?on_conflict=import_run_id,protocol_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
    await responseJson(res);
    return json({ ok: true, inserted: rows.length });
  }

  if (action === "stage-removed") {
    const payload = await req.json();
    const runId = safeRunId(payload.run_id);
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    if (!rows.length || rows.length > 500) throw new Error("invalid_removed_batch");
    for (const row of rows) row.import_run_id = runId;

    const res = await adminFetch("/rest/v1/ipm_stage_removed_protocols?on_conflict=import_run_id,protocol_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
    await responseJson(res);
    return json({ ok: true, inserted: rows.length });
  }

  if (action === "classify" || action === "validate" || action === "approve") {
    const payload = await req.json();
    const runId = safeRunId(payload.run_id);
    const fn =
      action === "classify" ? "classify_ipm_stage" :
      action === "validate" ? "validate_ipm_import" :
      "approve_ipm_import";
    const res = await adminFetch(`/rest/v1/rpc/${fn}`, {
      method: "POST",
      body: JSON.stringify({ p_run_id: runId }),
    });
    const result = await responseJson(res);
    return json({ ok: true, result });
  }

  if (action === "reject") {
    const payload = await req.json();
    const runId = safeRunId(payload.run_id);
    const res = await adminFetch("/rest/v1/rpc/reject_ipm_import", {
      method: "POST",
      body: JSON.stringify({
        p_run_id: runId,
        p_reason: String(payload.reason || "").slice(0, 1000) || null,
      }),
    });
    const result = await responseJson(res);
    return json({ ok: true, result });
  }

  if (action === "history") {
    const limit = Math.max(1, Math.min(30, Number(url.searchParams.get("limit") || 10)));
    const res = await adminFetch(
      `/rest/v1/ipm_import_validation_summary?select=*&order=created_at.desc&limit=${limit}`
    );
    const rows = await responseJson(res);
    return json({ ok: true, runs: rows || [], count: rows?.length || 0 });
  }

  if (action === "status") {
    const runId = safeRunId(url.searchParams.get("id"));
    const [runRes, issuesRes] = await Promise.all([
      adminFetch(`/rest/v1/ipm_import_validation_summary?select=*&import_run_id=eq.${runId}&limit=1`),
      adminFetch(`/rest/v1/ipm_validation_issues?select=severity,issue_code,issue_message,protocol_id,details&import_run_id=eq.${runId}&order=severity.desc,id.asc`),
    ]);
    const runs = await responseJson(runRes);
    const issues = await responseJson(issuesRes);
    if (!runs?.length) return json({ ok: false, error: "Importação não encontrada." }, 404);
    return json({ ok: true, run: runs[0], issues: issues || [] });
  }

  if (action === "review-rows") {
    const payload = await req.json();
    const runId = safeRunId(payload.run_id);
    const limit = Math.max(1, Math.min(200, Number(payload.limit || 100)));
    const offset = Math.max(0, Number(payload.offset || 0));
    const diff = ["new", "changed", "unchanged"].includes(payload.diff) ? payload.diff : "";
    const q = sanitizeSearch(payload.q);

    const params = new URLSearchParams();
    params.set("select", "protocol_id,opened_at,last_movement_at,closed_at,source_status,subject,current_sector,diff_status,diff_fields,validation_errors");
    params.set("import_run_id", `eq.${runId}`);
    params.set("order", "protocol_id.asc");
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    if (diff) params.set("diff_status", `eq.${diff}`);
    if (q) {
      params.set("or", `(protocol_id.ilike.*${q}*,subject.ilike.*${q}*,current_sector.ilike.*${q}*,source_status.ilike.*${q}*)`);
    }

    const res = await adminFetch(`/rest/v1/ipm_stage_protocols?${params.toString()}`, {
      headers: { Prefer: "count=exact" },
    });
    const rows = await responseJson(res);
    const range = res.headers.get("content-range") || "*/0";
    const total = Number(range.split("/").pop() || 0);
    return json({ ok: true, rows: rows || [], total: Number.isFinite(total) ? total : 0, limit, offset });
  }

  if (action === "fail") {
    const payload = await req.json();
    const runId = safeRunId(payload.run_id);
    const res = await adminFetch(`/rest/v1/ipm_import_runs?id=eq.${runId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "failed",
        review_notes: String(payload.reason || "Falha durante a carga do staging.").slice(0, 1000),
      }),
    });
    await responseJson(res);
    return json({ ok: true });
  }

  return json({ ok: false, error: "Ação inválida." }, 400);
}

Deno.serve(async (req: Request) => {
  let authPayload: Record<string, unknown>;
  try {
    authPayload = await authorize(req) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Origem não autorizada." }, 401);
  }

  try {
    const action = new URL(req.url).searchParams.get("action") || "";
    if (authPayload.environment === "preview" && action === "approve") {
      return json({
        ok: false,
        error: "A aprovação da base oficial é bloqueada em Preview.",
      }, 403);
    }
    return await handle(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha interna.";
    return json({ ok: false, error: message }, 500);
  }
});
