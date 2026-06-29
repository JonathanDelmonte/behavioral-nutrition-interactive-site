import type { Metadata } from "next";
import "./globals.css";
import { fontSans, fontSerif, fontScript, fontQuestion } from "@/styles/fonts";
import { Header } from "@/components/layout/Header/Header";
import { SitePreloader } from "@/components/Preloader/SitePreloader";
import { VideoLightboxProvider } from "@/components/video/VideoLightbox";
import { PolaroidLightboxProvider } from "@/components/polaroid/PolaroidLightbox";

export const metadata: Metadata = {
  title: "Juliana Delmonte · Nutrição Comportamental",
  description:
    "Nutrição comportamental para sair do ciclo de recomeçar toda segunda-feira.",
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
      className={`${fontSans.variable} ${fontSerif.variable} ${fontScript.variable} ${fontQuestion.variable}`}
    >
      <body>
        {/* VideoLightboxProvider wraps the header AND the page so both share one
            video-viewer state: the Testimonials tiles open it, and the header's
            hamburger reads it to morph into an X that closes the playing video. */}
        <VideoLightboxProvider>
          {/* PolaroidLightboxProvider shares one pile-viewer state the same way:
              the Testimonials expand buttons open it, and the header's hamburger
              reads it to morph into the same X that closes it. */}
          <PolaroidLightboxProvider>
            {/* Sticky global header. Lives outside <main> so it persists across
                all sections / routes, and its sticky positioning anchors it to
                the viewport top while content scrolls beneath. */}
            <Header />
            {children}
          </PolaroidLightboxProvider>
        </VideoLightboxProvider>
        {/* Boot loading screen — covers everything (incl. the header) until the
            heavy first-screen assets are down and the brain has painted. */}
        <SitePreloader />
      </body>
    </html>
  );
}
