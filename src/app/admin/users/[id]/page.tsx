import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAdmin } from "@/features/account/queries";
import { SuspendUserForm, UnsuspendUserForm } from "@/features/admin/components/suspension-forms";
import { formatDateTime } from "@/features/admin/components/tab-nav";
import { getUserDetail } from "@/features/admin/queries";
import { formatDate } from "@/features/campaigns/components/campaign-bits";
import { ASSIGNMENT_STATUS_META } from "@/features/tasks/status";
import type { AssignmentStatus } from "@/domain/tasks/assignment";

export const metadata: Metadata = { title: "User" };

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getUserDetail(id);
  if (!user) notFound();
  const name = user.profile.full_name || "Unnamed user";
  const isSelf = admin.userId === id;
  const work = Object.entries(user.assignmentCounts) as [AssignmentStatus, number][];

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-muted">
        <Link href="/admin/users" className="hover:text-ink">Users</Link>
        <span aria-hidden> / </span>
        <span aria-current="page">{name}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-[-0.03em]">{name}</h1>
        {user.isAdmin ? <StatusBadge tone="dark">Admin</StatusBadge> : null}
        {user.activeSuspension ? <StatusBadge tone="danger">Suspended</StatusBadge> : <StatusBadge tone="success">Active</StatusBadge>}
      </div>

      <Card className="px-5 py-5 sm:px-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <Fact label="Email">{user.email ?? "—"}</Fact>
          <Fact label="Phone">{user.profile.phone ?? "—"}</Fact>
          <Fact label="City">{user.profile.city ?? "—"}</Fact>
          <Fact label="Joined">{formatDate(user.profile.created_at)}</Fact>
          <Fact label="Campaigns created"><span className="tabular">{user.campaignsCount}</span></Fact>
          <Fact label="Applications"><span className="tabular">{user.applicationsCount}</span></Fact>
        </dl>
        {work.length ? (
          <p className="mt-4 text-[13px] text-ink-secondary">
            Work: {work.map(([status, n]) => `${n} ${ASSIGNMENT_STATUS_META[status].label.toLowerCase()}`).join(" · ")}
          </p>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-4 px-5 py-5 sm:px-6">
        <h2 className="text-[17px] font-[650] tracking-[-0.01em]">{user.activeSuspension ? "Reinstate account" : "Suspend account"}</h2>
        {isSelf ? (
          <p className="text-sm text-ink-secondary">You can&apos;t suspend your own account.</p>
        ) : user.activeSuspension ? (
          <>
            <p className="text-sm text-ink-secondary">
              Suspended {formatDateTime(user.activeSuspension.suspended_at)} by {user.activeSuspension.suspender?.full_name || "an admin"}:
              {" "}“{user.activeSuspension.reason}”
            </p>
            <UnsuspendUserForm userId={id} />
          </>
        ) : (
          <SuspendUserForm userId={id} userName={name} />
        )}
      </Card>

      {user.suspensions.length ? (
        <Card className="overflow-hidden">
          <h2 className="border-b border-line px-5 py-4 text-[15px] font-[650] sm:px-6">Suspension history</h2>
          <ul className="divide-y divide-line-soft">
            {user.suspensions.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 px-5 py-3.5 text-[13.5px] sm:px-6">
                <span>
                  <span className="font-[550]">Suspended</span> {formatDateTime(s.suspended_at)} by {s.suspender?.full_name || "an admin"} — “{s.reason}”
                </span>
                {s.lifted_at ? (
                  <span className="text-ink-secondary">
                    <span className="font-[550]">Reinstated</span> {formatDateTime(s.lifted_at)} by {s.lifter?.full_name || "an admin"}
                    {s.lift_reason ? ` — “${s.lift_reason}”` : ""}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="truncate font-[550]">{children}</dd>
    </div>
  );
}
