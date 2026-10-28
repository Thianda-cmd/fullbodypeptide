import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: {
    default: "Peptide Library · Full Body",
    template: "%s · Full Body Peptide Library",
  },
  description:
    "Every peptide, placed on the body: 152 FDA-approved drugs, clinical-trial candidates, gray-market compounds and skincare actives, sorted by where they act.",
  openGraph: {
    type: "website",
    siteName: "Full Body Peptide Library",
    title: "Where every peptide works in the body",
    description: "An interactive 3D map of 152 peptides, from approved drugs to compounds still in trials.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
