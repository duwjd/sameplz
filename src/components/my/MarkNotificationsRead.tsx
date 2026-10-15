"use client";
// NOTI-02: opening the list reads everything; the GNB count follows right away.
import { useEffect } from "react";
import { markAllNotificationsRead } from "@/actions/account";

export function MarkNotificationsRead({ unread }: { unread: number }) {
  useEffect(() => {
    if (unread === 0) return;
    void markAllNotificationsRead().then(() =>
      window.dispatchEvent(new Event("sameplz:notifications")),
    );
  }, [unread]);
  return null;
}
