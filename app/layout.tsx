import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { PostHogProvider } from "@/components/posthog-provider";
import { SessionIdentify } from "@/components/session-identify";

export const metadata: Metadata = {
  title: "MealMate",
  description: "Shared meal planning for your quad",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3f2f2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <PostHogProvider>
            <SessionIdentify />
            {children}
          </PostHogProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
