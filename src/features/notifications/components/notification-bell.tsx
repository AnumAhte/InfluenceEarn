import { Bell } from "lucide-react";
import Link from "next/link";

import { getUnreadNotificationCount } from "../queries";

/** Top-bar bell with the real unread count (no count is shown when there is none). */
export async function NotificationBell({ userId }: { userId: string }) {
  const unread = await getUnreadNotificationCount(userId);
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <Link
      href="/notifications"
      aria-label={label}
      className="relative flex size-[38px] flex-none items-center justify-center rounded-nav border border-line bg-surface text-ink-secondary hover:bg-canvas"
    >
      <Bell aria-hidden className="size-4" />
      {unread > 0 ? (
        <span
          aria-hidden
          className="tabular absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-danger px-1 text-[10px] font-bold text-white"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
