import { Hero } from "@/components/sections/Hero";
import { IdentifySection } from "@/components/sections/Identify";
import { BrainStage, BrainStageProvider } from "@/components/BrainStage";
import { ScrollRestoration } from "@/components/ScrollRestoration";

/**
 * Landing page. Sections are composed top-to-bottom in scroll order — add
 * future sections (manifesto, services, contact, etc.) directly below the
 * existing ones.
 *
 * The <BrainStageProvider> wraps everything so each section can register a
 * "brain slot" (a DOM spacer the brain canvas should sit over). <BrainStage />
 * mounts the single page-global 3D canvas in a fixed layer and follows the
 * active slot. This lets the brain travel between sections on scroll without
 * tearing down and re-creating the WebGL context.
 */
export default function Page() {
  return (
    <BrainStageProvider>
      <ScrollRestoration />
      <main>
        <Hero />
        <IdentifySection />
        {/* Future sections go here. */}
      </main>
      <BrainStage />
    </BrainStageProvider>
  );
}
