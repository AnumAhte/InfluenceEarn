import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireOnboardedAccount } from "@/features/account/queries";
import { markAllNotificationsRead, openNotification } from "@/features/notifications/actions";
import { listMyNotifications, NOTIFICATIONS_PAGE_SIZE } from "@/features/notifications/queries";
import { PageHeader } from "@/features/shell/components/page-header";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Notifications" };

function href(unread: boolean, page = 1) {
  const search = new URLSearchParams();
  if (unread) search.set("unread", "1");
  if (page > 1) search.set("page", String(page));
  const q = search.toString();
  return q ? `/notifications?${q}` : "/notifications";
}

function when(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const { userId } = await requireOnboardedAccount();
  const query = await searchParams;
  const unread = query.unread === "1";
  const page = Math.max(1, Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1);
  const { rows, total } = await listMyNotifications(userId, page, unread);

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-6">
      <PageHeader
        title="Notifications"
        description="Updates about your campaigns and applications."
        actions={
          <form action={markAllNotificationsRead}>
            <SubmitButton variant="secondary" pendingLabel="Marking…">Mark all as read</SubmitButton>
          </form>
        }
      />
      <nav aria-label="Filter notifications" className="flex w-fit gap-1 rounded-full bg-surface-muted p-1">
        {[false, true].map((u) => (
          <Link
            key={String(u)}
            href={href(u)}
            aria-current={unread === u ? "page" : undefined}
            className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-[550]", unread === u ? "bg-night text-white" : "text-ink-secondary hover:text-ink")}
          >
            {u ? "Unread" : "All"}
          </Link>
        ))}
      </nav>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={Bell} title={unread ? "You're all caught up" : "No notifications yet"} description="New applications, selections and campaign updates appear here." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((n) => (
              <li key={n.id}>
                <form action={openNotification}>
                  <input type="hidden" name="id" value={n.id} />
                  {n.link_path ? <input type="hidden" name="link" value={n.link_path} /> : null}
                  <button type="submit" className="flex w-full cursor-pointer items-start gap-3 px-4 py-4 text-left hover:bg-canvas sm:px-6">
                    <span
                      aria-hidden
                      className={cn("mt-1.5 size-2 flex-none rounded-full", n.read_at ? "bg-transparent" : "bg-primary")}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={cn("text-sm", n.read_at ? "font-[550]" : "font-[650]")}>
                        {n.title}
                        {n.read_at ? null : <span className="sr-only"> (unread)</span>}
                      </span>
                      <span className="text-[13.5px] leading-normal text-ink-secondary">{n.body}</span>
                      <span className="text-xs text-ink-muted">{when(n.created_at)} UTC</span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <Pagination label="Notifications" page={page} pageSize={NOTIFICATIONS_PAGE_SIZE} total={total} hrefFor={(p) => href(unread, p)} />
      </Card>
    </div>
  );
}
