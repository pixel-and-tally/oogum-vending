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
    "Family-owned Oogum Vending places refrigerated smart AI vending machines in Charlotte, NC and surrounding areas. Tap, grab and go. We stock, monitor and maintain everything, at no cost to the host.",
  hometown: "Belmont, NC",
  serviceArea: "Charlotte, NC and surrounding areas",
  // Towns Blake listed (2026-11-20). Shown on the home and About pages.
  towns: ["Charlotte", "Gastonia", "Belmont", "Mount Holly", "Cramerton"],

  // Contact, from the owners' flier. Empty values are hidden on the site.
  email: "Connect@OogumVending.com",
  phone: "704-559-9650",
  // Machine platform, e.g. "Nayax" or the cooler maker. Shown on the hub only.
  machinePlatform: "",
  // Path under public/. Their current logo; swap the file if they pick a new one. Empty shows a text sign.
  logo: "/oogum-logo.png",
  // The main button on every page (the owners' wording, 2026-11-21).
  cta: "Bring vending to my location",
} as const;

/**
 * About Us. Stephen and Nancy liked a "meet the family" page that says it is a
 * family-owned business that delivers personalized attention. Everything here
 * is a promise about how they work, not a made-up story.
 */
export const family = {
  promise: "A family-owned business that delivers personalized attention.",
  // TODO: a line about each owner in their own words. Empty bios are hidden.
  owners: [
    { name: "Stephen", bio: "" },
    { name: "Nancy", bio: "" },
  ],
  // What "personalized attention" means in practice. Facts from the flier and the owners.
  attention: [
    { title: "You get one of us", body: "Call or text and Stephen or Nancy picks up. No call center, no ticket number." },
    { title: "A menu picked for your spot", body: "We choose the drinks and snacks for the people who walk past your machine, and change them when tastes change." },
    { title: "We see it before you do", body: "The machine tracks its own stock and alerts us when it runs low, so we restock before it's empty." },
    { title: "We fix it ourselves", body: "Cleaning, repairs and restocking are on us. You don't lift a finger or pay a cent." },
  ],
};

/** Short promises from the flier, shown on the navy strip. */
export const promises = ["Improve satisfaction", "Hassle-free service", "No cost to you"];

/** Where machines are today. Real locations only. */
export const locations: { name: string; city: string; note?: string }[] = [
  { name: "Firestone", city: "Belmont, NC" },
];

/** The flier's "Why choose Oogum Vending?" points: the five cornerstones on the home page. */
export type Cornerstone = {
  title: string;
  body: string;
  icon: "tap" | "basket" | "wrench" | "support" | "free";
  tone: "orange" | "lime" | "sky" | "sun" | "ink";
};

export const cornerstones: Cornerstone[] = [
  { title: "Modern machines", body: "Refrigerated smart AI machines with cashless payment. Just tap, grab and go.", icon: "tap", tone: "sky" },
  { title: "Quality products", body: "Popular snacks, beverages and healthier options, customized to your needs.", icon: "basket", tone: "lime" },
  { title: "Full service", body: "We stock, monitor and maintain everything, so you don't have to.", icon: "wrench", tone: "sun" },
  { title: "Reliable support", body: "Local, family service you can count on. Proudly serving Charlotte and the surrounding area.", icon: "support", tone: "ink" },
  { title: "100% free service", body: "Absolutely no cost to you. We bring the machine; you give it a plug and a spot.", icon: "free", tone: "orange" },
];

/** How a customer buys, shown as three steps. */
export const steps = [
  { title: "Tap", body: "Swipe or tap a card or phone on the reader." },
  { title: "Grab", body: "The door unlocks. Take what you want." },
  { title: "Go", body: "Close the door and checkout happens on its own." },
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
