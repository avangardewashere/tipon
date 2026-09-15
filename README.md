# Tipon

**Gather it all. Sort it out.** A project manager that turns a brain dump into projects and tasks.

*Tipon* is Tagalog for *to gather*.

See [docs/PLAN.md](docs/PLAN.md) for the build plan and [docs/blocks/](docs/blocks/) for notes on each block.

## Where it is now

Block 4 of six. **Dump** everything on your mind, press *Sort it*, and check what it found before
anything is added. **Projects** are index cards; open one for its notes and checklist. **Inbox** holds
tasks with no project. **Today** is a signpost until Block 6.

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
