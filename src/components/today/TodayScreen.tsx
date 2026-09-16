"use client";

import Link from "next/link";
import { buildToday, isQuietDay, type NextInProject } from "@/lib/today/today";
import { dayKeyFromDate, todayKey } from "@/lib/dates/calendar";
import { useWorkspace } from "@/lib/workspace/store";
import { findProject } from "@/lib/workspace/selectors";
import type { Task, Workspace } from "@/lib/workspace/types";
import { Welcome } from "./Welcome";

/**
 * One page that answers "what now?" — worked out from the workspace, never stored.
 *
 * Everything on it is a line you can tick off where you stand. Anything more than that
 * (renaming, moving, deleting) belongs on the project page, which is one tap away.
 */
export function TodayScreen() {
  const { workspace, now } = useWorkspace();
  const today = todayKey(now());
  const view = buildToday(workspace, today, { dayOf: (at) => dayKeyFromDate(new Date(at)) });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl">Today</h1>
        <p className="pt-1 text-ink-soft">{today}</p>
      </header>

      <Welcome />

      {isQuietDay(view) && (
        <p className="text-ink-soft">
          Nothing needs you today.{" "}
          <Link href="/dump" className="underline">
            Write down what&apos;s on your mind
          </Link>{" "}
          and Tipon will sort it out.
        </p>
      )}

      {view.overdue.length > 0 && (
        <Section title="Overdue" tone="urgent">
          {view.overdue.map((task) => (
            <TodayTask key={task.id} task={task} workspace={workspace} showDue />
          ))}
        </Section>
      )}

      {view.dueToday.length > 0 && (
        <Section title="Due today" tone="urgent">
          {view.dueToday.map((task) => (
            <TodayTask key={task.id} task={task} workspace={workspace} />
          ))}
        </Section>
      )}

      {view.nextInProjects.length > 0 && (
        <Section title="Next in each project">
          {view.nextInProjects.map((next) => (
            <ProjectLine key={next.project.id} next={next} />
          ))}
        </Section>
      )}

      {view.inboxOpen > 0 && (
        <p className="border-t border-rule pt-4">
          <Link href="/inbox" className="underline">
            {view.inboxOpen === 1 ? "1 task waiting in the Inbox" : `${view.inboxOpen} tasks waiting in the Inbox`}
          </Link>
        </p>
      )}

      {view.doneToday.length > 0 && (
        <details className="border-t border-rule pt-4 text-sm">
          <summary className="cursor-pointer text-ink-soft">
            {view.doneToday.length === 1 ? "1 finished today" : `${view.doneToday.length} finished today`}
          </summary>
          <ul className="space-y-2 pt-3">
            {view.doneToday.map((task) => (
              <li key={task.id} className="text-ink-faint line-through">
                {task.title}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Section({
  title,
  tone = "plain",
  children,
}: Readonly<{ title: string; tone?: "plain" | "urgent"; children: React.ReactNode }>) {
  const id = `today-${title.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <section aria-labelledby={id} className="space-y-3 border-t border-rule pt-4">
      <h2 id={id} className="font-serif text-xl">
        <span className={tone === "urgent" ? "bg-highlight/60 px-1" : undefined}>{title}</span>
      </h2>
      <ul className="divide-y divide-rule">{children}</ul>
    </section>
  );
}

function TodayTask({
  task,
  workspace,
  showDue = false,
}: Readonly<{ task: Task; workspace: Workspace; showDue?: boolean }>) {
  const { run } = useWorkspace();
  const project = task.projectId === null ? null : findProject(workspace, task.projectId);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
      <input
        type="checkbox"
        id={`today-${task.id}`}
        checked={false}
        onChange={() => run({ type: "task/complete", id: task.id })}
        className="size-4 accent-[var(--highlight)]"
      />
      <label htmlFor={`today-${task.id}`} className="flex-1 basis-40">
        {task.title}
      </label>
      {showDue && task.due !== null && <span className="text-sm text-ink-soft">Due {task.due}</span>}
      <span className="text-sm text-ink-faint">
        {project === null ? (
          <Link href="/inbox" className="hover:text-ink-soft">
            Inbox
          </Link>
        ) : (
          <Link href={`/projects/${project.id}`} className="hover:text-ink-soft">
            {project.name}
          </Link>
        )}
      </span>
    </li>
  );
}

function ProjectLine({ next }: Readonly<{ next: NextInProject }>) {
  const { run } = useWorkspace();

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
      <input
        type="checkbox"
        id={`today-${next.task.id}`}
        checked={false}
        onChange={() => run({ type: "task/complete", id: next.task.id })}
        className="size-4 accent-[var(--highlight)]"
      />
      <label htmlFor={`today-${next.task.id}`} className="flex-1 basis-40">
        {next.task.title}
      </label>
      {next.task.due !== null && <span className="text-sm text-ink-soft">Due {next.task.due}</span>}
      <Link href={`/projects/${next.project.id}`} className="text-sm text-ink-faint hover:text-ink-soft">
        {next.project.name}
      </Link>
    </li>
  );
}
