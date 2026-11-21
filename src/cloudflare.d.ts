// The Worker's bindings (see wrangler.jsonc). Only importable inside the Worker.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
