"use client";
// PRM-08 / F2-3: 「○○님 링크로 들어왔어요」 for ?ref= visits. Counts the click once per page view
// (the server dedupes per visitor per 24h) and keeps the code for a claim after login.
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { recordShareClick } from "@/actions/recipe";
import { Callout } from "@/components/ds";
import { saveShareRef } from "@/lib/share-ref";

export function ShareRefBand({ publicId }: { publicId: string }) {
  const code = useSearchParams().get("ref");
  const [creator, setCreator] = useState<string | null>(null);
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!code || !/^[a-z0-9]{6,12}$/.test(code) || sent.current === code)
      return;
    sent.current = code;
    recordShareClick({ publicId, code }).then((res) => {
      if (!res.creator) return;
      saveShareRef(publicId, code);
      setCreator(res.creator);
    });
  }, [code, publicId]);

  if (!creator) return null;
  return (
    <Callout color="primary" icon={null}>
      {creator}님 링크로 들어왔어요.
    </Callout>
  );
}
