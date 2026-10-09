/* ==========================================================================
   term.js :: the runner's session on terminal 04-B
   Progressive enhancement: the page is complete without this file. This adds
   the boot sequence, a working prompt, and a file viewer built on <dialog>.
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
  // Deep links (/#credentials) skip the show: that visitor came for something specific.
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
    ["And when you gaze long into an abyss the abyss also gazes into you.", "Friedrich Nietzsche, Beyond Good and Evil"],
    ["To study the self is to forget the self.", "Dogen, Genjokoan"],
    ["Perceive those things which cannot be seen.", "Miyamoto Musashi, The Book of Five Rings"],
    ["Do nothing which is of no use.", "Miyamoto Musashi, The Book of Five Rings"],
    ["Matters of great concern should be treated lightly.", "Yamamoto Tsunetomo, Hagakure"],
    ["All warfare is based on deception.", "Sun Tzu, The Art of War"],
    ["I think, therefore I am.", "Rene Descartes"],
    ["I log, therefore I can prove it.", "J. Reid"]
  ];

  var COMMANDS = ["help", "ls", "cat", "open", "close", "whoami", "fortune", "history",
                  "clear", "date", "echo", "exit"];
  var PROMPT = "runner@jr-01:/public$ ";

  var files = {};          // "dossier.txt" -> section element
  var byId = {};           // "dossier" -> section element
  var out, cli, viewer, vTitle, vBody, opener = null;
  var hist = [], hpos = 0;

  function init() {
    out = document.getElementById("out");
    cli = document.getElementById("cli");
    viewer = document.getElementById("viewer");
    vTitle = document.getElementById("viewer-title");
    vBody = viewer.querySelector(".win-body");

    Array.prototype.forEach.call(document.querySelectorAll("section.file"), function (s) {
      files[s.getAttribute("data-file")] = s;
      byId[s.id] = s;
    });

    stampTimes();
    startClock();
    wireViewer();
    wireMenu();
    wirePrompt();
    wireKeys();

    boot(function () {
      try { sessionStorage.setItem("jr-booted", "1"); } catch (e) {}
      var h = location.hash.replace("#", "");
      if (byId[h]) openFile(h, null);
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
      document.removeEventListener("keydown", finish, true);
      document.removeEventListener("pointerdown", finish, true);
      done();
    }
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
    document.addEventListener("keydown", finish, true);
    document.addEventListener("pointerdown", finish, true);
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

  /* ---- file viewer (native <dialog>) ----------------------------------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function cloneBody(id) {
    var copy = byId[id].cloneNode(true);
    // ids must stay unique on the page
    copy.removeAttribute("id");
    copy.removeAttribute("aria-labelledby");
    Array.prototype.forEach.call(copy.querySelectorAll("[id]"), function (n) { n.removeAttribute("id"); });
    Array.prototype.forEach.call(copy.querySelectorAll(".boot"), function (n) { n.classList.add("on"); });
    var frag = document.createDocumentFragment();
    frag.appendChild(copy);
    return frag;
  }

  function centre() {
    // forget any position from a previous drag; CSS centres the dialog again
    viewer.style.margin = "";
    viewer.style.left = "";
    viewer.style.top = "";
  }

  function openFile(id, from) {
    if (!viewer.showModal) {               // very old browser: jump to the section
      location.hash = "#" + id;
      return;
    }
    vTitle.textContent = "jr-01:/public/" + byId[id].getAttribute("data-file");
    vBody.textContent = "";
    vBody.appendChild(cloneBody(id));
    vBody.appendChild(el("p", "eof", "-- EOF -- esc or \u00D7 to close"));
    vBody.scrollTop = 0;
    if (!viewer.open) {
      opener = from || cli;
      centre();
      viewer.showModal();
    }
    vBody.focus({ preventScroll: true });
    history.replaceState(null, "", "#" + id);
  }

  function wireViewer() {
    viewer.querySelector(".win-x").addEventListener("click", function () { viewer.close(); });
    // Escape fires "cancel" then "close"; the close handler covers both paths
    viewer.addEventListener("close", function () {
      history.replaceState(null, "", location.pathname + location.search);
      var back = opener; opener = null;
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    });
    // a click on the backdrop lands on the dialog element itself
    viewer.addEventListener("click", function (e) { if (e.target === viewer) viewer.close(); });
    drag(viewer.querySelector(".win-bar"));
  }

  function drag(handle) {
    var sx, sy, ox, oy, active = false;
    handle.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".win-x")) return;
      if (window.matchMedia("(max-width: 760px)").matches) return;   // sheets don't move
      var r = viewer.getBoundingClientRect();
      active = true;
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      viewer.style.margin = "0";
      viewer.style.left = ox + "px";
      viewer.style.top = oy + "px";
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", function (e) {
      if (!active) return;
      var nx = ox + e.clientX - sx, ny = oy + e.clientY - sy;
      var maxX = window.innerWidth - 80, maxY = window.innerHeight - 40;
      viewer.style.left = Math.min(Math.max(-viewer.offsetWidth + 80, nx), maxX) + "px";
      viewer.style.top = Math.min(Math.max(0, ny), maxY) + "px";
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
      openFile(id, a);
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
    line.appendChild(el("span", null, PROMPT));
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
        ["cat <file>", "print a file into the scrollback"],
        ["open <file>", "open a file in the viewer"],
        ["whoami", "who's on the line"],
        ["fortune", "one line from the canon"],
        ["history", "what you've typed"],
        ["clear", "wipe the command output"],
        ["date", "the corporation's clock"],
        ["exit", "close the link"]
      ]);
      print("tab completes. up and down walk your history. esc closes the viewer.", "d");
    },
    ls: function (args) {
      if (args[0] && resolve(args[0]) === "case-files") {
        Array.prototype.forEach.call(byId["case-files"].querySelectorAll(".rel"), function (r) {
          var t = r.querySelector(".x") ? "(redacted)" : r.querySelector("h3").textContent.trim();
          var s = r.querySelector(".st").textContent.trim();
          print(r.getAttribute("data-id") + "  " + t + "  " + s);
        });
        return;
      }
      cols(Object.keys(files).map(function (f) {
        var plain = files[f].querySelector(".dv .plain");
        return [f, plain ? plain.textContent : "", f.slice(-1) === "/" ? "b" : "t"];
      }));
    },
    cat: function (args) {
      if (!args[0]) { print("cat: missing file operand. try 'ls'.", "err"); return; }
      var id = resolve(args[0]);
      if (!id) { print("cat: " + args[0] + ": No such file or directory", "err"); return; }
      if (id === "case-files") { print("cat: case-files/: Is a directory. try 'ls case-files' or 'open case-files'.", "err"); return; }
      var b = el("div", "block");
      b.appendChild(cloneBody(id));
      var c = b.querySelector(".cmd"); if (c) c.remove();   // we already echoed the command
      out.appendChild(b);
    },
    open: function (args) {
      var id = resolve(args[0]);
      if (!id) { print("open: " + (args[0] || "") + ": No such file. try 'ls'.", "err"); return; }
      openFile(id, cli);
    },
    close: function () {
      if (viewer.open) viewer.close(); else print("close: the viewer isn't open", "d");
    },
    whoami: function () {
      print("uid=1337(jreid) gid=24(blue-team) groups=24(blue-team),88(nights)");
      print("the long version: cat dossier", "d");
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
      if (viewer.open) viewer.close();
      print("link closed. close the tab when you're done; nothing here follows you out.", "d");
    }
  };
  run.logout = run.exit;
  run.dir = run.ls;
  run.cls = run.clear;
  run.more = run.less = run.cat;
  run.sudo = function () {
    print("jreid is not in the sudoers file. This incident will be reported.", "err");
    print("(it won't. the logs answer to me now.)", "d");
  };
  run.rm = function () { print("rm: permission denied. good instinct, though.", "err"); };

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
    var last = parts[parts.length - 1];
    var pool = parts.length === 1 ? COMMANDS : Object.keys(files);
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
      if (root.classList.contains("booting") || viewer.open) return;   // the dialog handles its own keys
      // type anywhere on the page and it lands in the prompt, like a real terminal
      var a = document.activeElement;
      var typing = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable);
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 && e.key !== " ") {
        e.preventDefault();
        cli.focus({ preventScroll: true });
        cli.value += e.key;
        scrollToPrompt();
      }
    });
  }
})();
