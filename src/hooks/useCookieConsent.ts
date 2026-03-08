import { useState, useCallback, useEffect } from "react";

export interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

const COOKIE_NAME = "cookie_consent";
const DEFAULT_PREFERENCES: CookiePreferences = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days: number = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
}

export function useCookieConsent() {
  const [preferences, setPreferencesState] = useState<CookiePreferences | null>(() => {
    const raw = getCookie(COOKIE_NAME);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CookiePreferences;
    } catch {
      return null;
    }
  });

  const hasConsent = useCallback(
    (category: keyof CookiePreferences): boolean => {
      if (!preferences) return false;
      return preferences[category] ?? false;
    },
    [preferences]
  );

  const setConsent = useCallback((prefs: CookiePreferences) => {
    const final = { ...prefs, necessary: true };
    setCookie(COOKIE_NAME, JSON.stringify(final));
    setPreferencesState(final);

    // Set functional cookies if allowed
    if (final.functional) {
      const lang = localStorage.getItem("preferred_language");
      if (lang) setCookie("preferred_language", lang, 365);
    } else {
      deleteCookie("preferred_language");
      deleteCookie("last_agent_viewed");
    }

    // Set analytics session if allowed
    if (final.analytics) {
      if (!getCookie("analytics_session")) {
        setCookie("analytics_session", crypto.randomUUID(), 1);
      }
    } else {
      deleteCookie("analytics_session");
    }

    // Set marketing cookies if allowed
    if (final.marketing) {
      const params = new URLSearchParams(window.location.search);
      const utm_source = params.get("utm_source");
      const utm_campaign = params.get("utm_campaign");
      if (utm_source) setCookie("utm_source", utm_source, 30);
      if (utm_campaign) setCookie("utm_campaign", utm_campaign, 30);
    } else {
      deleteCookie("utm_source");
      deleteCookie("utm_campaign");
    }
  }, []);

  const acceptAll = useCallback(() => {
    setConsent({ necessary: true, functional: true, analytics: true, marketing: true });
  }, [setConsent]);

  const acceptNecessaryOnly = useCallback(() => {
    setConsent({ ...DEFAULT_PREFERENCES });
  }, [setConsent]);

  const isConsentGiven = preferences !== null;

  // Capture UTMs on first load if marketing consent exists
  useEffect(() => {
    if (preferences?.marketing) {
      const params = new URLSearchParams(window.location.search);
      const utm_source = params.get("utm_source");
      const utm_campaign = params.get("utm_campaign");
      if (utm_source) setCookie("utm_source", utm_source, 30);
      if (utm_campaign) setCookie("utm_campaign", utm_campaign, 30);
    }
  }, [preferences?.marketing]);

  return {
    preferences,
    hasConsent,
    setConsent,
    acceptAll,
    acceptNecessaryOnly,
    isConsentGiven,
    getSessionId: () => getCookie("analytics_session"),
    getUtmSource: () => getCookie("utm_source"),
    getUtmCampaign: () => getCookie("utm_campaign"),
  };
}
