import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Public, HTTP-referrer-restricted browser key (Google Cloud Console → Credentials),
// restricted to the Picker API + this app's domain. Safe to ship in the bundle — same
// trust model as e.g. a Google Maps JS key. Override via VITE_GOOGLE_PICKER_API_KEY if set.
const PICKER_API_KEY = import.meta.env.VITE_GOOGLE_PICKER_API_KEY || "AIzaSyC2WySptSWIsvCDAg0kAEqhMLWyymOlfHc";
// Google Cloud project number (not project id) — required by PickerBuilder.setAppId() for
// the picker to actually register a drive.file grant for the picked file. Without it, later
// Drive API calls to the picked file fail with "appNotAuthorizedToFile" even though Picker's
// own callback reports success.
const PICKER_APP_ID = import.meta.env.VITE_GOOGLE_PICKER_APP_ID || "367453704158";

declare global {
  interface Window {
    gapi?: any;
  }
}

let pickerLibraryPromise: Promise<void> | null = null;

function loadPickerLibrary(): Promise<void> {
  if (pickerLibraryPromise) return pickerLibraryPromise;

  pickerLibraryPromise = new Promise((resolve, reject) => {
    if (window.gapi?.picker) {
      resolve();
      return;
    }

    const onGapiReady = () => {
      window.gapi!.load("picker", { callback: () => resolve(), onerror: () => reject(new Error("Falha ao carregar o Google Picker.")) });
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-google-api-loader="true"]');
    if (existing) {
      if (window.gapi) onGapiReady();
      else existing.addEventListener("load", onGapiReady, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.defer = true;
    script.dataset.googleApiLoader = "true";
    script.onload = onGapiReady;
    script.onerror = () => reject(new Error("Falha ao carregar a API do Google."));
    document.head.appendChild(script);
  });

  return pickerLibraryPromise;
}

export interface PickedDoc {
  id: string;
  name: string;
}

export function useGooglePicker() {
  const openingRef = useRef(false);

  const openPicker = useCallback(async (): Promise<PickedDoc | null> => {
    if (openingRef.current) return null;
    openingRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke("meeting-google-picker-token", { body: {} });
      if (error) throw error;
      if (data?.error === "google_not_connected") {
        throw new Error("google_not_connected");
      }
      const accessToken: string = data.accessToken;

      await loadPickerLibrary();

      return await new Promise<PickedDoc | null>((resolve, reject) => {
        const google = (window as any).google;
        try {
          const docsView = new google.picker.DocsView(google.picker.ViewId.DOCS)
            .setIncludeFolders(false)
            .setMimeTypes("application/vnd.google-apps.document");

          const picker = new google.picker.PickerBuilder()
            .addView(docsView)
            .setOAuthToken(accessToken)
            .setDeveloperKey(PICKER_API_KEY)
            .setAppId(PICKER_APP_ID)
            .setTitle("Selecione o documento de anotações do Gemini")
            .setLocale("pt-BR")
            .setCallback((pickerData: any) => {
              if (pickerData.action === google.picker.Action.PICKED) {
                const doc = pickerData.docs[0];
                resolve({ id: doc.id, name: doc.name });
              } else if (pickerData.action === google.picker.Action.CANCEL) {
                resolve(null);
              }
            })
            .build();
          picker.setVisible(true);
        } catch (e) {
          reject(e);
        }
      });
    } finally {
      openingRef.current = false;
    }
  }, []);

  return { openPicker };
}
