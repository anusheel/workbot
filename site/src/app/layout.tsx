import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });

const description =
  "An AI assistant and workflow engine for operations, finance and support teams.";

export const metadata: Metadata = {
  title: { default: "WorkBot", template: "%s · WorkBot" },
  description,
  openGraph: { title: "WorkBot", description, type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <footer className="flex flex-wrap gap-x-6 gap-y-2 px-6 py-8 text-sm">
          <a href="https://joinplank.com/ai-fde-course" className="underline">
            Plank AI FDE Course
          </a>
          <a href="https://joinplank.com/fde/anusheel" className="underline">
            Day-by-day build log
          </a>
        </footer>
      </body>
    </html>
  );
}
