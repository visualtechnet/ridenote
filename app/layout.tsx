import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Barlow_Condensed, Sometype_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { SideNav } from "@/components/SideNav";
import { COPY } from "@/lib/messages";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  // Next has no fallback metrics for this font; it warns on every request and skips the step anyway.
  adjustFontFallback: false,
});

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const sometype = Sometype_Mono({
  variable: "--font-sometype",
  subsets: ["latin"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: COPY.appName,
  description: COPY.appDescription,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${atkinson.variable} ${barlow.variable} ${sometype.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="focus:bg-accent focus:text-accent-ink sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:px-3 focus:py-2"
        >
          {COPY.skipToContent}
        </a>
        <Providers>
          <SideNav />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
