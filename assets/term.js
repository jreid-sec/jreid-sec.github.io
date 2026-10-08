/* ==========================================================================
   term.js :: the runner's session on terminal 04-B
   Progressive enhancement: the page is complete without this file. This adds
   the boot sequence, a working prompt, and pop-up windows for each "file".
   Rules this file follows (the CSP enforces most of them anyway):
     - no third-party code, no network requests, no eval
     - user input is only ever written with textContent, never innerHTML
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var seen = false;
  try { seen = sessionStorage.getItem("jr-booted") === "1"; } catch (e) { /* storage blocked */ }
  // Deep links (/#receipts) skip the show: that visitor came for something specific.
  var deep = location.hash.length > 1;
  if (!reduce && !seen && !deep) root.classList.add("booting");

  document.addEventListener("DOMContentLoaded", function () {
    try { init(); }
    catch (err) {
      // If anything breaks, fall back to the plain page instead of a blank one.
      root.classList.remove("booting", "js");
      if (window.console) console.error(err);
    }
  });

  /* ---------------------------------------------------------------------- */
  var QUOTES = [
    ["The sky above the port was the color of television, tuned to a dead channel.", "William Gibson, Neuromancer"],
    ["The street finds its own uses for things.", "William Gibson, Burning Chrome"],
    ["The net is vast and infinite.", "Motoko Kusanagi, Ghost in the Shell (1995)"],
    ["All those moments will be lost in time, like tears in rain.", "Roy Batty, Blade Runner (1982)"],
    ["Hack the planet!", "Hackers (1995)"],
    ["No more secrets.", "Sneakers (1992)"],
    ["There is no spoon.", "The Matrix (1999)"],
    ["And when you gaze long into an abyss the abyss also gazes into you.", "Friedrich Nietzsche, Beyond Good and Evil"],
    ["To study the self is to forget the self.", "Dogen, Genjokoan"],
    ["Perceive those things which cannot be seen.", "Miyamoto Musashi, The Book of Five Rings"],
    ["Do nothing which is of no use.", "Miyamoto Musashi, The Book of Five Rings"],
    ["Matters of great concern should be treated lightly.", "Yamamoto Tsunetomo, Hagakure"],
    ["All warfare is based on deception.", "Sun Tzu, The Art of War"],
    ["I think, therefore I am.", "Rene Descartes"],
    ["I log, therefore I can prove it.", "jr"]
  ];

  var COMMANDS = ["help", "ls", "cat", "open", "close", "whoami", "fortune", "history",
                  "clear", "date", "echo", "exit"];

  var files = {};          // "whoami.txt" -> section element
  var byId = {};           // "whoami" -> section element
  var out, cli, wins;
  var hist = [], hpos = 0;
  var z = 60, opened = 0;

  function init() {
    out = document.getElementById("out");
    cli = document.getElementById("cli");
    wins = document.getElementById("wins");

    Array.prototype.forEach.call(document.querySelectorAll("section.file"), function (s) {
      files[s.getAttribute("data-file")] = s;
      byId[s.id] = s;
    });

    stampTimes();
    startClock();
    wireMenu();
    wirePrompt();
    wireKeys();

    boot(function () {
      try { sessionStorage.setItem("jr-booted", "1"); } catch (e) {}
      var h = location.hash.replace("#", "");
      if (byId[h]) openWin(h, null);
    });
  }

  /* ---- boot ------------------------------------------------------------ */
  function boot(done) {
    if (!root.classList.contains("booting")) { done(); return; }
    var steps = Array.prototype.slice.call(document.querySelectorAll(".boot"));
    var i = 0, timer = null, logCount = document.querySelectorAll(".log .boot").length;

    function finish() {
      if (timer) clearTimeout(timer);
      steps.forEach(function (el) { el.classList.add("on"); });
      root.classList.remove("booting");
      document.removeEventListener("keydown", skip, true);
      document.removeEventListener("pointerdown", skip, true);
      done();
    }
    function skip() { finish(); }
    // Budget: the log types out (~0.45s), then everything else prints inside
    // ~0.6s total, however many elements the page grows to.
    var rest = Math.max(1, steps.length - logCount);
    var fast = Math.max(4, Math.min(28, Math.floor(600 / rest)));
    function next() {
      if (i >= steps.length) { finish(); return; }
      steps[i].classList.add("on");
      var delay = i < logCount ? 150 : fast;
      i++;
      timer = setTimeout(next, delay);
    }
    document.addEventListener("keydown", skip, true);
    document.addEventListener("pointerdown", skip, true);
    next();
  }

  /* ---- clock, session id, log timestamps ------------------------------ */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hms(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); }

  function stampTimes() {
    var now = Date.now();
    Array.prototype.forEach.call(document.querySelectorAll(".log li[data-dt]"), function (li) {
      var t = new Date(now + parseInt(li.getAttribute("data-dt"), 10) * 1000);
      li.querySelector(".tm").textContent = "[" + hms(t) + "]";
    });
    var sid = document.querySelector("[data-session]");
    if (sid && window.crypto && crypto.getRandomValues) {
      var a = new Uint8Array(2); crypto.getRandomValues(a);
      sid.textContent = (a[0] * 256 + a[1]).toString(16).toUpperCase().padStart(4, "0");
    }
  }

  function startClock() {
    var c = document.querySelector("[data-clock]");
    var d = document.querySelector("[data-date]");
    function tick() {
      var n = new Date();
      if (c) c.textContent = hms(n);
      if (d) d.textContent = n.getFullYear() + "." + pad(n.getMonth() + 1) + "." + pad(n.getDate()) + " // ";
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---- pop-up windows -------------------------------------------------- */
  function cloneBody(id) {
    var src = byId[id];
    var frag = document.createDocumentFragment();
    var copy = src.cloneNode(true);
    // ids must stay unique on the page
    copy.removeAttribute("id");
    copy.removeAttribute("aria-labelledby");
    Array.prototype.forEach.call(copy.querySelectorAll("[id]"), function (el) { el.removeAttribute("id"); });
    Array.prototype.forEach.call(copy.querySelectorAll(".boot"), function (el) { el.classList.add("on"); });
    frag.appendChild(copy);
    return frag;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function openWin(id, opener) {
    var existing = wins.querySelector('.win[data-id="' + id + '"]');
    if (existing) { focusWin(existing); return; }

    var path = "jr-01:/public/" + byId[id].getAttribute("data-file");
    var w = el("div", "win");
    w.setAttribute("role", "dialog");
    w.setAttribute("aria-modal", "false");
    w.setAttribute("data-id", id);
    var titleId = "win-t-" + id;
    w.setAttribute("aria-labelledby", titleId);

    var bar = el("div", "win-bar");
    var seal = el("span", "win-seal", "\u76E3"); seal.setAttribute("aria-hidden", "true");
    var title = el("span", "win-title", path); title.id = titleId;
    var tag = el("span", "win-tag", "REMOTE");
    var x = el("button", "win-x", "\u00D7");
    x.type = "button";
    x.setAttribute("aria-label", "Close " + byId[id].getAttribute("data-file"));
    bar.appendChild(seal); bar.appendChild(title); bar.appendChild(tag); bar.appendChild(x);

    var body = el("div", "win-body");
    body.tabIndex = 0;
    body.appendChild(cloneBody(id));
    body.appendChild(el("p", "eof", "-- EOF -- esc or \u00D7 to close"));

    w.appendChild(bar); w.appendChild(body);
    wins.appendChild(w);

    // cascade new windows so they don't stack perfectly
    var vw = window.innerWidth, vh = window.innerHeight;
    var width = w.offsetWidth;
    var n = opened++ % 6;
    w.style.left = Math.max(12, Math.round((vw - width) / 2) + n * 28 - 70) + "px";
    w.style.top = Math.max(12, Math.round(vh * 0.1) + n * 28) + "px";

    w._opener = opener || cli;
    x.addEventListener("click", function () { closeWin(w); });
    w.addEventListener("pointerdown", function () { focusWin(w, true); });
    drag(w, bar);
    focusWin(w);
    history.replaceState(null, "", "#" + id);
  }

  function focusWin(w, keepFocus) {
    Array.prototype.forEach.call(wins.children, function (c) { c.classList.remove("front"); });
    w.classList.add("front");
    w.style.zIndex = ++z;
    if (!keepFocus) w.querySelector(".win-body").focus({ preventScroll: true });
  }

  function topWin() {
    var best = null, bz = -1;
    Array.prototype.forEach.call(wins.children, function (c) {
      var zz = parseInt(c.style.zIndex || "0", 10);
      if (zz > bz) { bz = zz; best = c; }
    });
    return best;
  }

  function closeWin(w) {
    var back = w._opener;
    w.remove();
    var t = topWin();
    if (t) { focusWin(t); history.replaceState(null, "", "#" + t.getAttribute("data-id")); }
    else {
      history.replaceState(null, "", location.pathname + location.search);
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    }
  }

  function drag(w, handle) {
    var sx, sy, ox, oy, active = false;
    handle.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".win-x")) return;
      if (window.matchMedia("(max-width: 760px)").matches) return;   // sheets don't move
      active = true;
      sx = e.clientX; sy = e.clientY;
      ox = w.offsetLeft; oy = w.offsetTop;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", function (e) {
      if (!active) return;
      var nx = ox + e.clientX - sx, ny = oy + e.clientY - sy;
      var maxX = window.innerWidth - 80, maxY = window.innerHeight - 40;
      w.style.left = Math.min(Math.max(-w.offsetWidth + 80, nx), maxX) + "px";
      w.style.top = Math.min(Math.max(0, ny), maxY) + "px";
    });
    function stop(e) { active = false; try { handle.releasePointerCapture(e.pointerId); } catch (x) {} }
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function wireMenu() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a[data-open]");
      if (!a) return;
      var id = a.getAttribute("data-open");
      if (!byId[id]) return;
      e.preventDefault();
      openWin(id, a);
    });
  }

  /* ---- prompt ---------------------------------------------------------- */
  function print(text, cls) {
    var line = el("div", "line" + (cls ? " " + cls : ""), text);
    out.appendChild(line);
    return line;
  }
  function echo(cmd) {
    var line = el("div", "line echo");
    line.appendChild(el("span", null, "ghost@jr-01:/public$ "));
    line.appendChild(el("span", "b", cmd));
    out.appendChild(line);
  }
  function scrollToPrompt() {
    cli.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }

  function resolve(arg) {
    if (!arg) return null;
    var a = arg.replace(/^\.?\/?(public\/)?/, "");
    if (files[a]) return files[a].id;
    if (files[a + ".txt"]) return files[a + ".txt"].id;
    if (files[a + "/"]) return files[a + "/"].id;
    return null;
  }

  function cols(pairs) {
    var g = el("div", "cols");
    pairs.forEach(function (p) {
      g.appendChild(el("span", p[2] || "t", p[0]));
      g.appendChild(el("span", "d", p[1]));
    });
    out.appendChild(g);
  }

  var run = {
    help: function () {
      print("jr-01 runner shell. commands:");
      cols([
        ["ls", "list the files"],
        ["cat <file>", "print a file here in the scrollback"],
        ["open <file>", "pop a file open in its own window"],
        ["close", "close the front window (or press esc)"],
        ["whoami", "who's driving"],
        ["fortune", "a line from the canon"],
        ["history", "what you've typed"],
        ["clear", "wipe the command output"],
        ["date", "the corporation's clock"],
        ["exit", "leave"]
      ]);
      print("tab completes. up and down walk your history.", "d");
    },
    ls: function (args) {
      if (args[0] && resolve(args[0]) === "textfiles") {
        Array.prototype.forEach.call(byId.textfiles.querySelectorAll(".rel"), function (r) {
          var t = r.querySelector("h3").textContent.trim();
          var s = r.querySelector(".st").textContent.trim();
          print(r.getAttribute("data-id") + "  " + t + "  " + s);
        });
        return;
      }
      cols(Object.keys(files).map(function (f) {
        var s = files[f];
        return [f, (s.querySelector(".dv") || {}).textContent || "", f.slice(-1) === "/" ? "b" : "t"];
      }));
    },
    cat: function (args) {
      if (!args[0]) { print("cat: missing file operand. try 'ls'.", "err"); return; }
      var id = resolve(args[0]);
      if (!id) { print("cat: " + args[0] + ": No such file or directory", "err"); return; }
      if (id === "textfiles") { print("cat: textfiles/: Is a directory. try 'ls textfiles' or 'open textfiles'.", "err"); return; }
      var b = el("div", "block");
      b.appendChild(cloneBody(id));
      // the clone carries its own "$ cat" line; drop it, we already echoed
      var c = b.querySelector(".cmd"); if (c) c.remove();
      out.appendChild(b);
    },
    open: function (args) {
      var id = resolve(args[0]);
      if (!id) { print("open: " + (args[0] || "") + ": No such file. try 'ls'.", "err"); return; }
      openWin(id, cli);
      print("opened " + byId[id].getAttribute("data-file") + " in a new window", "d");
    },
    close: function () {
      var t = topWin();
      if (t) closeWin(t); else print("close: no windows open", "d");
    },
    whoami: function () {
      print("uid=1337(jreid) gid=24(blue-team) groups=24(blue-team),88(nights),404(soc-candidate)");
      print("for the long version: cat whoami.txt", "d");
    },
    fortune: function () {
      var q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      print("\u201C" + q[0] + "\u201D", "b");
      print("  -- " + q[1], "d");
    },
    history: function () {
      hist.forEach(function (h, i) { print(String(i + 1).padStart(4, " ") + "  " + h); });
    },
    clear: function () { out.textContent = ""; },
    date: function () { print(new Date().toString()); },
    echo: function (args) { print(args.join(" ")); },
    exit: function () {
      Array.prototype.slice.call(wins.children).forEach(function (w) { w.remove(); });
      print("logout: this session belongs to the runner now. close the tab when you're done.", "d");
    }
  };
  run.logout = run.exit;
  run.dir = run.ls;
  run.cls = run.clear;
  run.more = run.less = run.cat;
  run.sudo = function () {
    print("jreid is not in the sudoers file. This incident will be reported.", "err");
    print("(it won't. the logs are mine now.)", "d");
  };
  run.rm = function () { print("rm: nice try.", "err"); };
  run.hack = function () { run.fortune(); };

  function exec(raw) {
    var line = raw.trim();
    echo(line);
    if (!line) return;
    hist.push(line); hpos = hist.length;
    var parts = line.split(/\s+/);
    var cmd = parts[0].toLowerCase();
    var args = parts.slice(1);
    if (Object.prototype.hasOwnProperty.call(run, cmd)) run[cmd](args);
    else if (byId[resolve(cmd) || ""]) run.cat([cmd]);   // typing a file name cats it
    else print(cmd + ": command not found. try 'help'.", "err");
  }

  function complete(v) {
    var parts = v.split(/\s+/);
    var pool, last = parts[parts.length - 1];
    if (parts.length === 1) pool = COMMANDS;
    else pool = Object.keys(files);
    var hits = pool.filter(function (p) { return p.indexOf(last) === 0; });
    if (hits.length === 1) { parts[parts.length - 1] = hits[0]; return parts.join(" ") + (parts.length === 1 ? " " : ""); }
    if (hits.length > 1) { echo(v); print(hits.join("   "), "d"); }
    return v;
  }

  function wirePrompt() {
    cli.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        exec(cli.value);
        cli.value = "";
        scrollToPrompt();
      } else if (e.key === "ArrowUp") {
        if (hpos > 0) { hpos--; cli.value = hist[hpos]; }
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        if (hpos < hist.length - 1) { hpos++; cli.value = hist[hpos]; }
        else { hpos = hist.length; cli.value = ""; }
        e.preventDefault();
      } else if (e.key === "Tab" && cli.value) {
        e.preventDefault();
        cli.value = complete(cli.value);
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        run.clear();
      }
    });
  }

  /* ---- global keys ----------------------------------------------------- */
  function wireKeys() {
    document.addEventListener("keydown", function (e) {
      if (root.classList.contains("booting")) return;
      if (e.key === "Escape") {
        var t = topWin();
        if (t) { e.preventDefault(); closeWin(t); }
        return;
      }
      // type anywhere on the page and it lands in the prompt, like a real terminal
      var a = document.activeElement;
      var typing = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable);
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (a && a.closest && a.closest(".win")) return;
      if (e.key.length === 1 && e.key !== " ") {
        e.preventDefault();
        cli.focus({ preventScroll: true });
        cli.value += e.key;
        scrollToPrompt();
      }
    });
  }
})();
