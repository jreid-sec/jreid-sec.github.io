# jreid-sec.github.io

Source for my security portfolio: https://jreid-sec.github.io

A corporate security terminal that a runner has taken over to show one
portfolio. Hand-written HTML, CSS, and one small first-party script. No build
step, no framework, no trackers, no third-party requests.

## How it behaves

- **Summary card first:** name, role, education, certs, goal, and links sit at
  the top in plain type, visible before any animation runs.
- **Boot:** a three-line intrusion log types out, then the page prints in about
  a second. Any key or tap skips it. Once per browser session, never with
  "reduce motion" on, never on deep links like `/#credentials`.
- **Scrollback:** every section is a "file" printed into the terminal in order:
  `dossier.txt` (about), `case-files/` (projects), `credentials.txt`
  (certifications), `dispatches.txt` (updates), `toolkit.txt` (tools),
  `comms.txt` (contact). Each flavored name shows its plain meaning beside it.
- **Viewer:** the `[1]`-`[6]` links open that file in a native `<dialog>`
  (`showModal()`): Escape closes it, focus stays inside while it's open and
  returns to the link afterward, the page behind is inert. Drag by the title
  bar on desktop; full-screen sheet on phones. The URL hash follows it.
- **Prompt:** start typing anywhere. `help` lists commands. Tab completes,
  arrow keys walk history.
- **Write-ups use reader mode:** sans-serif body at 18px, 68-character lines,
  a summary box (what / tools / ATT&CK / outcome) at the top. No script.
- **JavaScript off:** the whole site still reads top to bottom.

## Layout

```
index.html                     the terminal; every section lives here
404.html                       "No route to this address"
assets/site.css                all styles; color and font tokens at the top
assets/term.js                 boot, prompt, commands, viewer
assets/fonts/                  self-hosted OFL fonts + fonts.css + licences
assets/diagrams/               SVG diagrams exported from Mermaid
assets/favicon.svg
case-files/                    one page per write-up (jr-001-*.html, ...)
case-files/jr-000-template.html   copy this to start a new write-up
.well-known/security.txt       RFC 9116 contact file (renew Expires yearly)
.nojekyll                      serve as-is; also lets .well-known publish
```

## Voice

Short, precise, a little noir. Runner vocabulary (ICE, trace, link, deck,
case files) where it reads naturally; never 2077-specific slang or trademarks.
Every flavored label keeps a plain subtitle so a recruiter never has to decode
anything. Japanese appears only on the corporation's own chrome, tagged
`lang="ja"` and `aria-hidden` where it duplicates English.

## Fonts

All OFL, subsetted, served from this site:

| Token | Face | Used for |
|---|---|---|
| `JR Display` | Big Shoulders Bold | condensed caps: title bar, name, headings |
| `JR Mono` | JetBrains Mono 400/700 | the terminal |
| `JR Sans` | Instrument Sans 400/400i/700 | summary card, write-ups |
| `JR JP` / `JR JP Serif` | Noto Sans / Serif CJK JP | the kanji labels and the seal |

Files are WOFF. To switch to smaller WOFF2 or to add new kanji, re-subset with
fontTools (`pip install fonttools brotli`):

```bash
pyftsubset NotoSansCJKjp-Regular.otf --text="侵入記録..." \
  --flavor=woff2 --output-file=assets/fonts/jr-jp-400.woff2
```

`--text` keeps only the listed characters; `--flavor=woff2` needs `brotli`.
Update `fonts.css` to point at the new files.

## Adding a section

Copy any `<section class="file">` in `index.html`, give it a new `id` and
`data-file`, a `<small class="plain">` subtitle, and a menu link with a
matching `data-open`. The prompt, `ls`, `cat`, and viewer pick it up.

## Diagrams

Write diagrams in Mermaid (source lives in the `homelab-soc` repo), export them
to SVG, and save them under `assets/diagrams/`. Embed them with the figure
markup in `case-files/jr-000-template.html`. Mermaid can't render here
directly: it draws with a script at view time, and the CSP only allows this
site's own script.

## Security notes

- Content-Security-Policy is the first `<meta>` in `<head>` because GitHub
  Pages can't set response headers: `default-src 'none'`; scripts, styles,
  images and fonts from this origin only. No inline scripts or `style=""`.
- `term.js` never writes user input as HTML; it uses `textContent`, and file
  output is cloned from the page's own DOM.
- `frame-ancestors` can't be set from a meta tag, so clickjacking protection
  isn't possible on Pages. Known limitation.
- No cookies. `sessionStorage` holds one flag so the boot plays once.
- Employer work appears only as anonymized case files.
