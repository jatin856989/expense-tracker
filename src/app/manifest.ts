import type { MetadataRoute } from "next";

// Next.js serves this at /manifest.webmanifest and automatically links it
// in <head> — this is what lets a phone's browser offer "Install app" /
// "Add to Home Screen". No native app or app-store listing involved: once
// installed, it's the same website opening in its own standalone window.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Expense Tracker",
    short_name: "Expense Tracker",
    description: "Personal finance tracker — cards, accounts, expenses, portfolio and loans, all in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Lets the installed app appear in Android's share sheet — sharing a
    // GPay payment screenshot (Share → Expense Tracker) or a bank/UPI SMS
    // (Share → Expense Tracker on the text) both post to /api/share-target,
    // which reads whichever arrived and files it as a pending transaction
    // for you to confirm the next time you open the app.
    share_target: {
      action: "/api/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        text: "text",
        files: [{ name: "screenshot", accept: ["image/*"] }],
      },
    },
  };
}
