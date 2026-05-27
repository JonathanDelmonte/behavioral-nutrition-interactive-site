import type { Metadata } from "next";
import "./globals.css";
import { fontSans, fontSerif, fontScript } from "@/styles/fonts";
import { Header } from "@/components/layout/Header/Header";

export const metadata: Metadata = {
  title: "Juliana Delmonte · Nutrição Comportamental",
  description:
    "Nutrição comportamental para quem está cansado de começar de novo toda segunda-feira.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // next/font/local generates a class name per family and exposes a CSS
  // variable through .variable. Apply all three on <html> so every descendant
  // — including CSS Modules in deeply nested sections — can resolve
  // var(--font-sans/serif/script) regardless of the deploy's basePath.
  return (
    <html
      lang="pt-BR"
      className={`${fontSans.variable} ${fontSerif.variable} ${fontScript.variable}`}
    >
      <body>
        {/* Sticky global header. Lives outside <main> so it persists across
            all sections / routes, and its sticky positioning anchors it to
            the viewport top while content scrolls beneath. */}
        <Header />
        {children}
      </body>
    </html>
  );
}
