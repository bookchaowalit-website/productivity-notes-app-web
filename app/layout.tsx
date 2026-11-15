import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Notes App | Bookchaowalit",
  description: "Local notes list with search and markdown-ish body text.",
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
    description: "Local notes list with search and markdown-ish body text.",
    siteName: "Bookchaowalit",
  },
  twitter: {
    card: "summary_large_image",
    title: "Notes App | Bookchaowalit",
    description: "Local notes list with search and markdown-ish body text.",
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
    <html lang="en" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
