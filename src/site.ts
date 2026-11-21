/*
 * THE CONTENT FILE. Business facts and copy for Oogum Vending.
 *
 * Rules: no em dashes, no invented reviews, stats or locations. Leave a field
 * empty ("") rather than guess; the pages hide anything that is empty.
 * Fields marked TODO are waiting on Stephen and Nancy.
 */
import type { Availability } from "./lib/schedule";

export const site = {
  name: "Oogum Vending",
  owners: "Stephen and Nancy Turner",
  // From the owners' flier.
  tagline: "Convenience, Reimagined.",
  url: "https://oogumvending.com",
  description:
    "Oogum Vending places smart market machines in Gaston County, NC. Tap, grab and go. We stock, monitor and maintain everything, at no cost to the host.",
  hometown: "Belmont, NC",
  serviceArea: "Gaston County, NC",

  // Contact, from the owners' flier. Empty values are hidden on the site.
  email: "Connect@OogumVending.com",
  phone: "704-559-9650",
  // Machine platform, e.g. "Nayax" or the cooler maker. Shown on the hub only.
  machinePlatform: "",
  // Path under public/. Their current logo; swap the file if they pick a new one. Empty shows a text sign.
  logo: "/oogum-logo.png",
} as const;

/** Short promises from the flier, shown on the LED strip. */
export const promises = ["Improve satisfaction", "Hassle-free service", "No cost to you"];

/** Where machines are today. Real locations only. */
export const locations: { name: string; city: string; note?: string }[] = [
  { name: "Firestone", city: "Belmont, NC" },
];

/**
 * The cards on the fridge shelves, in order: two per door on each shelf, eight in all.
 * The first five are the flier's "Why choose Oogum Vending?" points.
 */
export type ShelfCard = {
  title: string;
  body: string;
  tone: "orange" | "lime" | "sky" | "sun";
  link?: { href: string; label: string };
  /** Show the locations list under the body. */
  showLocations?: boolean;
};

export const cards: ShelfCard[] = [
  { title: "Modern machines", body: "Smart market machines with cashless payment. Just tap, grab and go.", tone: "sky" },
  { title: "Quality products", body: "Popular snacks, beverages and healthier options, customized to your needs.", tone: "lime" },
  { title: "Full service", body: "We stock, monitor and maintain everything, so you don't have to.", tone: "sun" },
  { title: "Reliable support", body: "Local service you can count on. Proudly serving Gaston County.", tone: "sky" },
  { title: "100% free service", body: "Absolutely no cost to you. We bring the machine; you give it a plug and a spot.", tone: "orange" },
  {
    title: "Host a machine",
    body: "Want one at your shop or waiting room? Tell us about your spot and we'll come take a look.",
    tone: "sky",
    link: { href: "/host/", label: "Request a machine" },
  },
  { title: "How it works", body: "Swipe or tap your card or phone. Open the door and grab what you want. Checkout happens on its own.", tone: "sun" },
  {
    title: "Who we are",
    body: "Owned and run by Stephen and Nancy Turner in Belmont. When you call, you get one of us. Find our machine at:",
    tone: "lime",
    showLocations: true,
  },
];

// When a host can request a call with the owners (Eastern). TODO: their real hours.
export const availability: Availability = {
  timeZone: "America/New_York",
  callMinutes: 20,
  stepMinutes: 30,
  noticeHours: 18,
  daysAhead: 14,
  weekly: {
    1: [["09:00", "17:00"]],
    2: [["09:00", "17:00"]],
    3: [["09:00", "17:00"]],
    4: [["09:00", "17:00"]],
    5: [["09:00", "17:00"]],
  },
};

/** Stores the price tracker compares. Add or remove freely. */
export const stores = ["Costco", "Sam's Club", "Walmart", "Target", "Amazon", "Other"] as const;
export type Store = (typeof stores)[number];

/** Stages a host request moves through in the hub. */
export const requestStages = ["New", "Called", "Visited", "Signed", "Not a fit"] as const;
export type RequestStage = (typeof requestStages)[number];
