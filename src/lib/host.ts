// "Host a machine" requests from store managers: field checks shared by the
// browser and the server, the email to the owners, and the record the hub keeps.
import { buildCallIcs, formatDate, formatTime, isBookable, type Availability } from "./schedule";
import type { RequestStage } from "../site";

export const hostFields = ["name", "email", "phone", "business", "address", "traffic"] as const;
export const optionalHostFields = ["details"] as const;
export type HostField = (typeof hostFields)[number] | "callTime";
export type HostMessage = Record<(typeof hostFields)[number] | (typeof optionalHostFields)[number] | "callDate" | "callTime", string>;

export type HostRequest = HostMessage & {
  id: string;
  receivedAt: string;
  stage: RequestStage;
  notes: string;
};

export const honeypotField = "company-website";

export const trafficOptions = ["Under 50 a day", "50 to 150 a day", "150 to 300 a day", "Over 300 a day", "Not sure"] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[\d\s().+-]{10,}$/;

export type HostParse =
  | { ok: true; message: HostMessage }
  | { ok: false; spam: true }
  | { ok: false; spam: false; invalid: HostField[] };

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim().slice(0, 3000);

export function parseHost(form: FormData, availability: Availability, now: Date): HostParse {
  if (text(form, honeypotField)) return { ok: false, spam: true };
  const message = Object.fromEntries(
    [...hostFields, ...optionalHostFields, "callDate", "callTime"].map((f) => [f, text(form, f)]),
  ) as HostMessage;

  const invalid: HostField[] = hostFields.filter((f) => {
    const v = message[f];
    if (!v) return true;
    if (f === "email") return !EMAIL.test(v);
    if (f === "phone") return !PHONE.test(v);
    if (f === "traffic") return !(trafficOptions as readonly string[]).includes(v);
    return false;
  });
  if (message.callDate || message.callTime) {
    if (!isBookable(message.callDate, message.callTime, availability, now)) invalid.push("callTime");
  }
  return invalid.length ? { ok: false, spam: false, invalid } : { ok: true, message };
}

export const callLabel = (m: HostMessage) => (m.callDate ? `${formatDate(m.callDate)} at ${formatTime(m.callTime)} Eastern` : "");

export function hostEmailText(m: HostMessage): string {
  return [
    `New host request from ${m.business}`,
    "",
    `Name: ${m.name}`,
    `Email: ${m.email}`,
    `Phone: ${m.phone}`,
    `Address: ${m.address}`,
    `Customers a day: ${m.traffic}`,
    `Call: ${callLabel(m) || "None picked, reach out to set one up"}`,
    ...(m.details ? ["", m.details] : []),
    "",
    "It's also in the owner hub under Requests.",
  ].join("\n");
}

type SendConfig = { apiKey: string; to: string; from: string };

export async function sendHostEmail(m: HostMessage, cfg: SendConfig, availability: Availability, now: Date, fetcher: typeof fetch = fetch) {
  const attachments = m.callDate
    ? [
        {
          filename: "call.ics",
          content: Buffer.from(
            buildCallIcs(
              {
                uid: `${now.getTime()}-${m.email}@oogum`,
                date: m.callDate,
                time: m.callTime,
                summary: `Host call: ${m.business}`,
                description: `${m.name}, ${m.phone}, ${m.email}\n${m.address}`,
              },
              availability,
              now,
            ),
          ).toString("base64"),
        },
      ]
    : undefined;
  const res = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: cfg.from,
      to: cfg.to.split(",").map((s) => s.trim()).filter(Boolean),
      reply_to: m.email,
      subject: m.callDate ? `Host call request: ${m.business}, ${callLabel(m)}` : `Host request: ${m.business}`,
      text: hostEmailText(m),
      attachments,
    }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
}
