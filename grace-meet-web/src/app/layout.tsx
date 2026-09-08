import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@livekit/components-styles";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GraceMeet — Sacred Fellowship & Video Meetings",
  description: "Mobile-first, church-focused video meeting platform for prayer, scripture teaching, and church fellowship.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GraceMeet",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#090d16",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-[100dvh] h-full flex flex-col bg-[#090d16] text-slate-100 font-sans selection:bg-amber-500/30 selection:text-amber-200 overscroll-none">
        {children}
      </body>
    </html>
  );
}
