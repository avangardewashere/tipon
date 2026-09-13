"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/lib/workspace/store";
import { activeProjects, archivedProjects, openTaskCount } from "@/lib/workspace/selectors";
import { findProjectNameProblem, type ProjectNameProblem } from "@/lib/workspace/rules";
import type { Project } from "@/lib/workspace/types";

export function ProjectsScreen() {
  const { workspace } = useWorkspace();
  const active = activeProjects(workspace);
  const archived = archivedProjects(workspace);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl">Projects</h1>
        <p className="pt-1 text-ink-soft">One card per project. Open one to write notes and keep its list.</p>
      </header>

      <NewProjectForm />

      <Link
        href="/inbox"
        className="block border-b border-rule pb-3 text-lg hover:text-ink-soft"
      >
        Inbox
        <span className="pl-2 text-sm text-ink-soft">{openCountLabel(openTaskCount(workspace, null))}</span>
      </Link>

      {active.length === 0 ? (
        <p className="text-ink-soft">No projects yet. Add your first one above.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {active.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} openTasks={openTaskCount(workspace, project.id)} />
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && <ArchivedProjects projects={archived} />}
    </div>
  );
}

function NewProjectForm() {
  const { workspace, run } = useWorkspace();
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<ProjectNameProblem | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // The same check the reducer runs, asked early so we can explain the refusal.
    const found = findProjectNameProblem(workspace.projects, name);
    setProblem(found);
    if (found !== null) return;

    run({ type: "project/add", name });
    setName("");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex-1 basis-56 text-sm text-ink-soft">
        <span className="block pb-1">Project name</span>
        <input
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(null);
          }}
          aria-invalid={problem !== null}
          aria-describedby={problem === null ? undefined : "new-project-problem"}
          placeholder="Website relaunch"
          className="w-full border-b border-rule bg-transparent py-1 text-base text-ink outline-none placeholder:text-ink-faint focus:border-ink"
        />
      </label>
      <button type="submit" className="border-b-2 border-highlight py-1 text-sm font-semibold">
        Add project
      </button>
      {problem !== null && (
        <p id="new-project-problem" role="alert" className="basis-full text-sm text-danger">
          {nameProblemMessage(problem)}
        </p>
      )}
    </form>
  );
}

function ProjectCard({ project, openTasks }: Readonly<{ project: Project; openTasks: number }>) {
  const { run } = useWorkspace();

  return (
    <article className="flex h-full flex-col gap-2 border border-rule bg-paper-raised p-4">
      <h2 className="font-serif text-xl">
        <Link href={`/projects/${project.id}`} className="hover:text-ink-soft">
          {project.name}
        </Link>
      </h2>
      <p className="text-sm text-ink-soft">{openCountLabel(openTasks)}</p>
      {project.notes !== "" && <p className="line-clamp-2 text-sm text-ink-faint">{project.notes}</p>}
      <button
        type="button"
        onClick={() => run({ type: "project/archive", id: project.id })}
        className="mt-auto self-start text-sm text-ink-soft underline"
      >
        Archive<span className="sr-only">{` ${project.name}`}</span>
      </button>
    </article>
  );
}

function ArchivedProjects({ projects }: Readonly<{ projects: readonly Project[] }>) {
  const { run } = useWorkspace();

  return (
    <section aria-labelledby="archived-projects" className="space-y-3 border-t border-rule pt-6">
      <h2 id="archived-projects" className="font-serif text-xl">
        Archived
      </h2>
      <ul className="space-y-2">
        {projects.map((project) => (
          <li key={project.id} className="flex items-center gap-3">
            <Link href={`/projects/${project.id}`} className="text-ink-soft hover:text-ink">
              {project.name}
            </Link>
            <button
              type="button"
              onClick={() => run({ type: "project/unarchive", id: project.id })}
              className="text-sm text-ink-soft underline"
            >
              Unarchive<span className="sr-only">{` ${project.name}`}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function openCountLabel(count: number): string {
  return count === 1 ? "1 open task" : `${count} open tasks`;
}

export function nameProblemMessage(problem: ProjectNameProblem): string {
  return problem === "empty" ? "Give the project a name." : "You already have a project with that name.";
}
