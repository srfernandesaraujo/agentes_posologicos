import { useState } from "react";
import { invokeFunction } from "@/lib/invokeFunction";

export type AgentBackupScope = "native" | "custom";

interface BackupResult {
  filename: string;
  count: number;
  zip_base64: string;
}

interface RestoreResult {
  restored: number;
  renamed: string[];
}

function base64ToBlob(base64: string, type: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useAgentBackup(scope: AgentBackupScope) {
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const backup = async () => {
    setBackingUp(true);
    try {
      const data = await invokeFunction<BackupResult>("backup-agents", { scope });
      const blob = base64ToBlob(data.zip_base64, "application/zip");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      return data;
    } finally {
      setBackingUp(false);
    }
  };

  const restore = async (file: File) => {
    setRestoring(true);
    try {
      const zip_base64 = await fileToBase64(file);
      return await invokeFunction<RestoreResult>("restore-agents", { scope, zip_base64 });
    } finally {
      setRestoring(false);
    }
  };

  return { backup, backingUp, restore, restoring };
}
