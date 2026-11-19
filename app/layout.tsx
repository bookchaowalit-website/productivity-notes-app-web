import type { Metadata } from "next";
import { Geist, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Geist has no Thai glyphs: Thai titles and text fall through to Noto Sans Thai, not the system font.
const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai"],
});

export const metadata: Metadata = {
  title: "Notes App | Bookchaowalit",
  description: "Plain-text notes with search, saved in this browser only. No account, no sync.",
  keywords: ["notes","localStorage","search"],
  authors: [{ name: "Bookchaowalit", url: "https://bookchaowalit.com" }],
  creator: "Bookchaowalit",
  publisher: "Bookchaowalit",
  metadataBase: new URL("https://notes-app.bookchaowalit.com"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Notes App | Bookchaowalit",
    description: "Plain-text notes with search, saved in this browser only. No account, no sync.",
    siteName: "Bookchaowalit",
  },
  twitter: {
    card: "summary_large_image",
    title: "Notes App | Bookchaowalit",
    description: "Plain-text notes with search, saved in this browser only. No account, no sync.",
    creator: "@bookchaowalit",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variable sits on <html>: the App shell tokens live on :root and read it from there.
    <html lang="en" className={`${geistSans.variable} ${notoThai.variable}`}>
      <body>{children}</body>
    </html>
  );
}
