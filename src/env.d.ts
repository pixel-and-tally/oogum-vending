/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Signed-in hub user, set by middleware on /hub/ pages. */
    user?: string;
  }
}
