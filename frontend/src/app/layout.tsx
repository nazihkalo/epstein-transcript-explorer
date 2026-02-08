import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "../components/Nav";
import TranscriptProvider from "../components/TranscriptProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Epstein Transcript Explorer",
  description: "Search, explore, and ask questions about the Epstein-Ehud recording transcript",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <TranscriptProvider>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </TranscriptProvider>
      </body>
    </html>
  );
}
