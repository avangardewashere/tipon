import type { Metadata } from "next";
import { DumpScreen } from "@/components/dump/DumpScreen";

export const metadata: Metadata = { title: "Dump" };

export default function DumpPage() {
  return <DumpScreen />;
}
