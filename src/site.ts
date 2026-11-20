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

/** The flier's "Why choose Oogum Vending?" points. Shown big on the home page. */
export const points: { title: string; body: string; tone: "orange" | "lime" | "sky" | "sun" }[] = [
  { title: "Modern machines", body: "Smart market machines with cashless payment. Just tap, grab and go.", tone: "sky" },
  { title: "Quality products", body: "Popular snacks, beverages and healthier options, customized to your needs.", tone: "lime" },
  { title: "Full service", body: "We stock, monitor and maintain everything, so you don't have to.", tone: "sun" },
  { title: "Reliable support", body: "Local service you can count on. Proudly serving Gaston County.", tone: "sky" },
  { title: "100% free service", body: "Absolutely no cost to you.", tone: "orange" },
];

/** Short promises from the flier, shown on the LED strip. */
export const promises = ["Improve satisfaction", "Hassle-free service", "No cost to you"];

/** Where machines are today. Real locations only. */
export const locations: { name: string; city: string; note?: string }[] = [
  { name: "Firestone", city: "Belmont, NC" },
];

/**
 * The slots in the machine window. Each one is a section of the home page.
 * Codes follow a real machine: row letter, then column number.
 */
export type Slot = {
  code: string;
  label: string;
  /** Short line on the slot's price tag. */
  tag: string;
  title: string;
  body: string[];
  link?: { href: string; label: string };
  tone: "orange" | "lime" | "sky" | "sun";
  /** Short "brand name" printed on the item. */
  brand: string;
  /** What the item on the coil looks like. */
  product: "bottle" | "can" | "chips" | "bar" | "water" | "box";
};

export const slots: Slot[] = [
  {
    code: "A1",
    brand: "STOCKED",
    label: "Always stocked",
    tag: "No empty coils",
    title: "It tells us before it runs low",
    body: [
      "Our machines count what's inside them. When something starts to run low, we get a notice and restock it.",
      "So the thing you came for is there when you walk up. Not sold out since Tuesday.",
    ],
    tone: "lime",
    product: "bottle",
  },
  {
    code: "A2",
    brand: "ICE COLD",
    label: "Kept cold",
    tag: "Fridge, not shelf",
    title: "Refrigerated, start to finish",
    body: [
      "Popular snacks, beverages and healthier options, picked to fit your location.",
      "The machines are refrigerated, so drinks stay cold and fresh food stays fresh.",
    ],
    tone: "sky",
    product: "can",
  },
  {
    code: "B1",
    brand: "HOW TO",
    label: "How it works",
    tag: "Tap, open, grab",
    title: "Tap, open, grab, go",
    body: [
      "Swipe or tap your card or phone to unlock the door. Grab what you want and close it. The machine sees what you took and checks you out on its own.",
    ],
    tone: "sun",
    product: "chips",
  },
  {
    code: "B2",
    brand: "HOST ME",
    label: "Host a machine",
    tag: "Free for hosts",
    title: "Want one at your shop?",
    body: [
      "100% free service. We bring the machine, stock it, monitor it and keep it running. You give it a plug and a spot your customers walk past.",
      "We're adding machines at Firestone stores across North Carolina, and we're open to other busy waiting rooms too.",
    ],
    link: { href: "/host/", label: "Request a machine" },
    tone: "orange",
    product: "bar",
  },
  {
    code: "C1",
    brand: "FIND US",
    label: "Where we are",
    tag: "Belmont, NC",
    title: "Where to find us",
    body: [],
    tone: "sky",
    product: "water",
  },
  {
    code: "C2",
    brand: "HELLO",
    label: "Who we are",
    tag: "Local owners",
    title: "Stephen and Nancy",
    body: [
      "Oogum Vending is owned and run by Stephen and Nancy Turner in Belmont. When you call, you get one of us.",
      // TODO: a line or two in their own words.
    ],
    tone: "lime",
    product: "box",
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
