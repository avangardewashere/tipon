# Cutting a release

Everything here is a command you can run or a thing you can see. Nothing is "have a quick click
around": that's what the test suite and the browser pass in each block's notes are for.

## Before tagging

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

All five must pass on a clean checkout. CI runs the same five on every push.

Then, once, in a real browser against **`npm run build` + `npm start`** — not `npm run dev`.
The service worker is off in development, and a production build is where the last two bugs
were found:

| Check | Why it's on the list |
|---|---|
| Dump something, sort it, add it, then **refresh** | The one path that touches every block |
| `/backup` → Export, then import that file into a fresh browser profile | Proves the backup is real |
| Open two tabs, add a project in one, look at the other | Two tabs used to overwrite each other |
| Phone width (375 px) on every page | Android is a supported device |
| The browser console | A warning here is a bug you haven't found yet |
| **Airplane mode, then reload** | The cold start is the whole point of the service worker |
| **Offline: sort a dump and add it** | The rules never needed a network; only Claude does |
| **Offline: the banner appears, and goes when the network returns** | A stuck banner is its own bug |
| **DevTools → Application → Manifest** | Installable, with no icon warnings |
| **Deploy, then reload a page that's already open** | The "newer version" line should appear and work |

And on a phone, once per release: **add it to the home screen and open it from there.** No amount
of desktop checking substitutes for that one.

## Tagging

v0 is tagged on the default branch, after the last block's pull request is merged:

```bash
git checkout master && git pull
git tag -a v0 -m "Tipon v0: dump, projects, tasks, today"
git push origin v0
```

## Deploying

Vercel builds the default branch. The app needs no environment variables; set
`ANTHROPIC_API_KEY` and `TIPON_ACCESS_CODE` only if you want Claude to sort dumps (see the README),
and set a monthly spend limit in the Claude Console at the same time.

## After tagging

- Open the deployed URL on an Android phone and a desktop browser, and add one real task on each.
- Export a backup from the deployed app and keep it. It's also the first real test of the file that
  a future version will have to migrate.
