import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCookieConsent } from "./useCookieConsent";

export function useAnalytics() {
  const { hasConsent, getSessionId, getUtmSource, getUtmCampaign } = useCookieConsent();
  const location = useLocation();
  const pageEntryTime = useRef<number>(Date.now());

  const trackEvent = useCallback(
    async (eventType: string, eventData: Record<string, unknown> = {}) => {
      if (!hasConsent("analytics")) return;

      const sessionId = getSessionId();
      if (!sessionId) return;

      const { data: { user } } = await supabase.auth.getUser();

      try {
        await supabase.from("analytics_events" as any).insert({
          session_id: sessionId,
          event_type: eventType,
          event_data: eventData,
          page: location.pathname,
          utm_source: getUtmSource(),
          utm_campaign: getUtmCampaign(),
          user_id: user?.id || null,
        });
      } catch {
        // silently fail
      }
    },
    [hasConsent, getSessionId, getUtmSource, getUtmCampaign, location.pathname]
  );

  // Track pageview on route change
  useEffect(() => {
    if (!hasConsent("analytics")) return;

    const prevTime = pageEntryTime.current;
    pageEntryTime.current = Date.now();

    // Send time_on_page for previous page
    if (prevTime) {
      const duration = Math.round((Date.now() - prevTime) / 1000);
      if (duration > 1) {
        trackEvent("time_on_page", { duration_seconds: duration });
      }
    }

    trackEvent("pageview", { referrer: document.referrer });
  }, [location.pathname]);

  return { trackEvent };
}
