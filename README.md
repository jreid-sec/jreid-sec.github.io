# jreid-sec.github.io

Source for my security portfolio: https://jreid-sec.github.io

A corporate security terminal that a runner has taken over to display one
portfolio. Hand-written HTML, CSS, and one small first-party script. No build
step, no framework, no trackers, no third-party requests.

## How it behaves

- **Summary card first:** name, role, education, certs, goal, and links sit at
  the very top in plain type, visible before any animation runs.
- **Boot:** a three-line intrusion log types out, then the page prints in about
  a second. Any key or tap skips it. It plays once per browser session, never
  with "reduce motion" on, and never on deep links like `/#receipts`.
- **Scrollback:** every section is a "file" printed into the terminal, in order.
- **Pop-up windows:** the `[1]`-`[6]` links open that file in its own terminal
  window. Drag by the title bar, `esc` or `x` to close. On phones they open as
  full-screen sheets. Windows set the URL hash, so `/#receipts` deep-links.
- **Prompt:** start typing anywhere. `help` lists commands (`ls`, `cat`,
  `open`, `close`, `whoami`, `fortune`, `history`, `clear`, `date`, `exit`).
  Tab completes, arrow keys walk history.
- **Write-ups use reader mode:** regular sans-serif body at 18px, 68-character
  lines, no scanlines, a summary box (what / tools / ATT&CK / outcome) at the
  top. Code and commands stay monospace. No script, no boot.
- **JavaScript off:** the whole site still reads top to bottom. Only the
  prompt and windows go away.

## Layout

```
index.html                  the terminal; every section lives here
404.html                    "No such file or directory"
assets/site.css             all styles; color tokens at the top
assets/term.js              boot, prompt, commands, windows
assets/favicon.svg
assets/diagrams/            SVG diagrams exported from Mermaid
textfiles/                  one page per write-up (jr-001-*.html, ...)
textfiles/jr-000-template.html   copy this to start a new write-up
.well-known/security.txt    RFC 9116 contact file (renew Expires yearly)
.nojekyll                   serve as-is; also lets .well-known publish
```

## Adding a section

Add a `<section class="file" id="NAME" data-file="NAME.txt">` to `index.html`
(copy an existing one), and a matching `<li>` in the menu with
`data-open="NAME"`. The prompt, `ls`, `cat`, and windows pick it up
automatically.

## Security notes

- Content-Security-Policy is a `<meta>` tag because GitHub Pages can't set
  response headers: `default-src 'none'`, scripts and styles from this origin
  only. No inline scripts or `style=""` attributes; the browser will block them.
- `term.js` never writes user input as HTML. Command echo and output use
  `textContent`; file output is cloned from the page's own DOM.
- `frame-ancestors` can't be set from a meta tag, so clickjacking protection
  isn't possible on Pages without a proxy in front. Known limitation.
- No cookies. `sessionStorage` holds one flag so the boot animation plays once.
- Employer work appears only as anonymized case studies.

## Credits

The textfile voice tips its hat to the '80s-'90s BBS and e-zine scene; the
terminal styling to cyberpunk fiction generally. All ASCII art is original.
Quotes are short and attributed to their authors and works.

## Diagrams

Write diagrams in Mermaid (source lives in the `homelab-soc` repo), export them
to SVG, and save them under `assets/diagrams/`. Embed them with the figure
markup in `textfiles/jr-000-template.html`. Mermaid can't render here directly:
it draws with a script at view time, and the CSP only allows this site's own
script. `assets/diagrams/topology-example.svg` is a placeholder; replace it.
