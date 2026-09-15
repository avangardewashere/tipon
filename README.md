# Tipon

**Gather it all. Sort it out.** A project manager that turns a brain dump into projects and tasks.

*Tipon* is Tagalog for *to gather*.

See [docs/PLAN.md](docs/PLAN.md) for the build plan and [docs/blocks/](docs/blocks/) for notes on each block.

## Where it is now

Block 3 of six. The screens work: **Projects** (index cards, archive), a project page with notes and
a checklist, and an **Inbox** for tasks with no project. **Today** and **Dump** are signposts for now.

Your work is **saved in the browser you use it in** and survives a refresh. `/backup` exports a JSON
file and imports one back, which is how your work reaches another device — and how it survives
clearing your browsing data. Accounts and sync are v1.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server at http://localhost:3000 |
| `npm test` | Run the Jest test suite once |
| `npm run test:watch` | Re-run tests whenever a file changes |
| `npm run typecheck` | Generate Next.js route types, then type-check with `tsc` |
| `npm run lint` | Run ESLint |
| `npm run build` | Production build |
