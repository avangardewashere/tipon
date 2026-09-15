import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { WorkspaceGate } from "@/components/shell/WorkspaceGate";
import { WorkspaceProvider } from "@/lib/workspace/store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Tipon", template: "%s · Tipon" },
  description: "Gather it all. Sort it out. Turn a brain dump into projects and tasks.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* One provider owns the workspace; every screen below only draws it and sends commands. */}
        <WorkspaceProvider>
          <AppShell>
            <WorkspaceGate>{children}</WorkspaceGate>
          </AppShell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
