"use client";
// D21: GA4 page views for public screens only (privacy policy §4). Without NEXT_PUBLIC_GA_ID nothing
// loads. gtag is loaded only from a public screen, is switched off (ga-disable-<id>) on private ones,
// and only ever sees the path without the query string — its own automatic events (engagement,
// enhanced measurement) included. Turn enhanced measurement off in GA (launch checklist).
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";
import { isTracked } from "@/lib/analytics";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export function Analytics() {
  const pathname = usePathname();
  const tracked = Boolean(pathname && isTracked(pathname));

  // Later navigations (the first view is sent by ga-init once gtag loads).
  useEffect(() => {
    if (!GA_ID || !pathname) return;
    (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] =
      !tracked;
    if (!tracked || !window.gtag) return;
    const page_location = `${window.location.origin}${pathname}`;
    window.gtag("set", { page_location, page_referrer: "" });
    window.gtag("event", "page_view", { page_location, page_path: pathname });
  }, [pathname, tracked]);

  // Never loaded from a private screen (next/script loads each script once per page life).
  if (!GA_ID || !tracked) return null;
  const id = JSON.stringify(GA_ID);
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;var l=location.origin+location.pathname;gtag('js',new Date());gtag('config',${id},{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:l,page_referrer:''});gtag('event','page_view',{page_location:l,page_path:location.pathname});`}
      </Script>
    </>
  );
}
