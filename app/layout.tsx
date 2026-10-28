import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Atkinson_Hyperlegible_Mono } from "next/font/google";
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

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  variable: "--font-atkinson-mono",
  subsets: ["latin"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: COPY.appName,
  description: COPY.appDescription,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${atkinson.variable} ${atkinsonMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col md:flex-row">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-zinc-900"
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
