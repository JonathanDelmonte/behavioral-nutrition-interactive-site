import dynamic from "next/dynamic";

const BrainModel = dynamic(
  () => import("@/components/BrainModel").then((m) => m.BrainModel),
  { ssr: false },
);

export default function Page() {
  return (
    <main className="min-h-screen w-full bg-white flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
      {/*
        Responsive container — width is the smaller of:
          - 1400px           (hard cap on ultra-wide displays)
          - calc(100vh-2rem) (so the square container fits vertically with breathing room)
          - 100%             (so it never overflows the padded main on narrow viewports)
        aspect-square keeps the canvas 1:1 so the camera framing stays consistent.
      */}
      <div
        className="aspect-square"
        style={{ width: "min(1400px, calc(100vh - 2rem), 100%)" }}
      >
        <BrainModel />
      </div>
    </main>
  );
}
