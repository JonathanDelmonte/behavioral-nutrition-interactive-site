import { Hero } from "@/components/sections/Hero";

/**
 * Landing page. Sections are composed top-to-bottom in scroll order — add
 * future sections (manifesto, services, contact, etc.) directly below <Hero />.
 */
export default function Page() {
  return (
    <main>
      <Hero />
      {/* Future sections go here. */}
    </main>
  );
}
