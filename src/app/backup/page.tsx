import type { Metadata } from "next";
import { BackupScreen } from "@/components/backup/BackupScreen";

export const metadata: Metadata = { title: "Backup" };

export default function BackupPage() {
  return <BackupScreen />;
}
