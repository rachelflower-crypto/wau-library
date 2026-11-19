# We Are Unbecoming · The Library

The Dispatch, published monthly at library.weareunbecoming.com.

- `content/issues/<number>/` holds each issue: `issue.json`, `books/*.html`, `casefile.html`.
- `node build.mjs` builds the site into `dist/`. Netlify runs this automatically on every change.
- `netlify/edge-functions/library-door.js` is the members' door. Book pages need this month's
  password. Books marked `"access": "correspondents"` need the Correspondents' password;
  `"freeOpening": true` lets the Curious read up to the `<!--more-->` marker.

## Changing the monthly passwords
Netlify → Project configuration → Environment variables: edit `CURIOUS_PASSWORD` and
`CORRESPONDENTS_PASSWORD`, then Deploys → Trigger deploy. Old passwords stop working at once.
