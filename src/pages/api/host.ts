import type { APIRoute } from "astro";
import { parseHost, sendHostEmail, type HostRequest } from "../../lib/host";
import { getStore, newId } from "../../lib/store";
import { availability } from "../../site";

// Runs as a Netlify function. Saves the request for the hub, then emails the owners.
export const prerender = false;

// Netlify > Site configuration > Environment variables.
// HOST_TO_EMAIL can hold both owners, comma separated.
const config = () => ({
  apiKey: process.env.RESEND_API_KEY ?? "",
  to: process.env.HOST_TO_EMAIL ?? "",
  from: process.env.HOST_FROM_EMAIL || "Oogum Vending website <onboarding@resend.dev>",
});

const wantsJson = (request: Request) => request.headers.get("accept")?.includes("application/json") ?? false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const json = wantsJson(request);
  const reply = (status: number, body: Record<string, unknown>, to: string) =>
    json ? Response.json(body, { status }) : redirect(to, 303);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(400, { ok: false, error: "bad_request" }, "/host/?error=1#request");
  }

  const now = new Date();
  const result = parseHost(form, availability, now);
  if (!result.ok && result.spam) return reply(200, { ok: true }, "/host/thanks/");
  if (!result.ok) return reply(422, { ok: false, invalid: result.invalid }, "/host/?error=1#request");

  // Save first, so a request is never lost if email is down.
  let saved = false;
  try {
    const store = await getStore();
    const rows = await store.read<HostRequest>("requests");
    rows.unshift({ ...result.message, id: newId(), receivedAt: now.toISOString(), stage: "New", notes: "" });
    await store.write("requests", rows);
    saved = true;
  } catch (err) {
    console.error("Host form: save failed", err);
  }

  const cfg = config();
  let emailed = false;
  if (cfg.apiKey && cfg.to) {
    try {
      await sendHostEmail(result.message, cfg, availability, now);
      emailed = true;
    } catch (err) {
      console.error("Host form: email failed", err);
    }
  } else {
    console.warn("Host form: RESEND_API_KEY or HOST_TO_EMAIL is not set, request saved to the hub only");
  }

  if (!saved && !emailed) return reply(502, { ok: false, error: "send_failed" }, "/host/?error=1#request");
  return reply(200, { ok: true }, "/host/thanks/");
};
