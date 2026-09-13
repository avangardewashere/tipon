import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dump" };

export default function DumpPage() {
  return (
    <div className="space-y-3">
      <h1 className="font-serif text-3xl">Dump</h1>
      <p className="text-ink-soft">
        A blank page to empty your head onto. Press <em>Sort it</em> and review what it found before anything is added.
        Built in Block 4.
      </p>
    </div>
  );
}
