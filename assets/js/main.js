/* SJPMP — interactions du site : menu mobile, schéma d'analyse d'impact, catalogue, formulaire de contact. */
(function () {
  "use strict";

  /* ---------- Menu mobile ---------- */
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".menu-toggle");
  if (header && toggle) {
    var setOpen = function (open) {
      header.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Fermer" : "Menu";
    };
    toggle.addEventListener("click", function () {
      setOpen(!header.classList.contains("is-open"));
    });
    header.querySelectorAll(".site-nav a").forEach(function (link) {
      link.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && header.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ---------- Année du pied de page ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Schéma d'analyse d'impact ----------
     Une demande de modification touche un élément (outil, processus, rôle ou
     poste). Le socle suit les liens et signale, de proche en proche, les
     éléments à revoir avant approbation. */
  var canvas = document.getElementById("impact-canvas");
  if (canvas && canvas.getContext) initImpact(canvas);

  function initImpact(canvas) {
    var ctx = canvas.getContext("2d");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var COLS = ["OUTILS", "PROCESSUS", "RÔLES", "POSTES"];
    var NODES = [
      { id: "T1", col: 0, row: 0, label: "ERP", short: "ERP", v: [5, 2] },
      { id: "T2", col: 0, row: 1, label: "Plateforme agréée", short: "Plateforme", v: [1, 0] },
      { id: "T3", col: 0, row: 2, label: "Banque en ligne", short: "Banque", v: [2, 1] },
      { id: "P1", col: 1, row: 0, label: "PR-ACH-01 Achats", short: "Achats", v: [2, 3] },
      { id: "P2", col: 1, row: 1, label: "PR-FIN-02 Factures", short: "Factures", v: [4, 0] },
      { id: "P3", col: 1, row: 2, label: "PR-FIN-03 Paiements", short: "Paiements", v: [3, 2] },
      { id: "R1", col: 2, row: 0, label: "Approbateur", short: "Approbateur", v: [1, 4] },
      { id: "R2", col: 2, row: 1, label: "Traitement des factures", short: "Traitement", v: [2, 0] },
      { id: "R3", col: 2, row: 2, label: "Ordonnateur", short: "Ordonnateur", v: [1, 1] },
      { id: "S1", col: 3, row: 0, label: "Acheteur", short: "Acheteur", v: [3, 0] },
      { id: "S2", col: 3, row: 1, label: "Comptable fournisseurs", short: "Comptable", v: [2, 2] },
      { id: "S3", col: 3, row: 2, label: "DAF", short: "DAF", v: [1, 3] }
    ];
    var EDGES = [
      ["T1", "P1"], ["T1", "P2"], ["T1", "P3"], ["T2", "P2"], ["T3", "P3"],
      ["P1", "R1"], ["P2", "R1"], ["P2", "R2"], ["P3", "R3"],
      ["R1", "S1"], ["R1", "S3"], ["R2", "S2"], ["R3", "S3"]
    ];
    var STEP = 0.75, LEAD = 0.6, HOLD = 1.6, FADE = 0.6;
    var byId = {};
    NODES.forEach(function (n) { byId[n.id] = n; n.links = []; });
    EDGES.forEach(function (e) {
      byId[e[0]].links.push(byId[e[1]]);
      byId[e[1]].links.push(byId[e[0]]);
    });

    var W = 0, H = 0, geo = null, colors = null;
    var dm = 41, cycle = null, lastSource = null;
    var running = false, visible = true, last = 0, rafId = 0;

    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
    function ver(n) { return "v" + n.v[0] + "." + n.v[1]; }
    function next(n) { return "v" + n.v[0] + "." + (n.v[1] + 1); }
    function tagFor(n, state) {
      if (state === "flag") return geo.compact ? "à revoir" : ver(n) + " · à revoir";
      if (state === "source") return geo.compact ? next(n) : ver(n) + " → " + next(n);
      return ver(n);
    }

    function readColors() {
      var cs = getComputedStyle(document.documentElement);
      var get = function (name) { return cs.getPropertyValue(name).trim(); };
      colors = {
        ink: get("--ink"), soft: get("--ink-soft"), muted: get("--muted"),
        line: get("--line"), surface: get("--surface"),
        petrol: get("--petrol"), signal: get("--signal")
      };
    }

    function fonts() {
      var small = geo.compact;
      return {
        name: "500 " + (small ? 11 : 13) + 'px "Archivo", "Arial Narrow", Arial, sans-serif',
        mono: (small ? 9.5 : 11) + 'px "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace'
      };
    }

    function layout() {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var top = 34, bottom = H - 30;
      geo = {
        compact: W < 760,
        colW: W / COLS.length,
        top: top,
        rowH: (bottom - top) / 3
      };
      var f = fonts();
      NODES.forEach(function (n) {
        n.x = Math.round(n.col * geo.colW) + 0.5;
        n.y = Math.round(geo.top + geo.rowH * (n.row + 0.5) - 6) + 0.5;
        n.text = geo.compact ? n.short : n.label;
        ctx.font = f.name;
        var nameW = ctx.measureText(n.text).width;
        ctx.font = f.mono;
        var tagW = Math.max(ctx.measureText(tagFor(n, "flag")).width, ctx.measureText(tagFor(n, "source")).width);
        n.textW = Math.max(nameW, tagW);
      });
    }

    // Prépare un cycle : source, profondeur de chaque élément lié, chemins.
    function newCycle(source) {
      if (!source) {
        do { source = NODES[Math.floor(Math.random() * NODES.length)]; } while (source === lastSource);
      }
      lastSource = source;
      var depth = {}, paths = [], frontier = [source], d = 0;
      depth[source.id] = 0;
      while (frontier.length && d < 3) {
        d++;
        var next = [];
        frontier.forEach(function (from) {
          from.links.forEach(function (to) {
            var away = Math.abs(to.col - source.col) > Math.abs(from.col - source.col);
            if (away && depth[to.id] === undefined) {
              depth[to.id] = d;
              next.push(to);
              paths.push({ from: from, to: to, d: d });
            }
          });
        });
        frontier = next;
      }
      var reach = Math.max.apply(null, paths.map(function (p) { return p.d; }).concat([0]));
      return {
        source: source, depth: depth, paths: paths,
        count: paths.length, t: 0,
        from: ver(source),
        to: "v" + source.v[0] + "." + (source.v[1] + 1),
        end: LEAD + reach * STEP + HOLD + FADE,
        bumped: false
      };
    }

    // Courbe entre la fin du libellé de gauche et le repère de droite.
    function edgePoints(a, b) {
      var left = a.col < b.col ? a : b, right = left === a ? b : a;
      var sx = left.x + 14 + left.textW + 6, sy = left.y;
      var ex = right.x - 4, ey = right.y;
      if (ex - sx < 8) sx = ex - 8;
      var mx = (sx + ex) / 2;
      return { sx: sx, sy: sy, c1x: mx, c1y: sy, c2x: mx, c2y: ey, ex: ex, ey: ey, reversed: left !== a };
    }

    function bezier(p, t) {
      if (p.reversed) t = 1 - t;
      var u = 1 - t;
      return {
        x: u * u * u * p.sx + 3 * u * u * t * p.c1x + 3 * u * t * t * p.c2x + t * t * t * p.ex,
        y: u * u * u * p.sy + 3 * u * u * t * p.c1y + 3 * u * t * t * p.c2y + t * t * t * p.ey
      };
    }

    function stroke(p) {
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy);
      ctx.bezierCurveTo(p.c1x, p.c1y, p.c2x, p.c2y, p.ex, p.ey);
      ctx.stroke();
    }

    function draw() {
      var c = colors, cy = cycle, f = fonts(), i;
      var t = cy.t;
      var fade = 1 - ease((t - (cy.end - FADE)) / FADE);
      ctx.clearRect(0, 0, W, H);

      // Titres de colonnes
      ctx.font = f.mono;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillStyle = c.muted;
      COLS.forEach(function (label, k) { ctx.fillText(label, Math.round(k * geo.colW), 12); });

      // Liens au repos
      ctx.lineWidth = 1;
      ctx.strokeStyle = c.line;
      EDGES.forEach(function (e) { stroke(edgePoints(byId[e[0]], byId[e[1]])); });

      // Liens parcourus et impulsions
      cy.paths.forEach(function (p) {
        var start = LEAD + (p.d - 1) * STEP;
        var k = (t - start) / STEP;
        if (k <= 0) return;
        var pts = edgePoints(p.from, p.to);
        ctx.globalAlpha = fade;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = c.petrol;
        stroke(pts);
        if (k < 1) {
          var pos = bezier(pts, ease(k));
          ctx.fillStyle = c.petrol;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      });

      // Éléments
      for (i = 0; i < NODES.length; i++) {
        var n = NODES[i];
        var d = cy.depth[n.id];
        var isSource = n === cy.source;
        var flagged = d !== undefined && d > 0 && t >= LEAD + d * STEP;
        var lit = isSource ? ease(t / LEAD) * fade : flagged ? fade : 0;

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = c.ink;
        ctx.fillStyle = c.surface;
        ctx.fillRect(n.x - 0.5, n.y - 4.5, 9, 9);
        ctx.strokeRect(n.x - 0.5, n.y - 4.5, 9, 9);
        if (lit > 0) {
          ctx.globalAlpha = lit;
          ctx.fillStyle = isSource ? c.signal : c.petrol;
          ctx.fillRect(n.x - 0.5, n.y - 4.5, 9, 9);
          if (flagged) {
            ctx.strokeStyle = c.petrol;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(n.x + 4, n.y, 9, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }

        ctx.font = f.name;
        ctx.fillStyle = c.ink;
        ctx.fillText(n.text, n.x + 14, n.y + 4);

        ctx.font = f.mono;
        var tag = ver(n);
        if (isSource && lit > 0 && !cy.bumped) tag = tagFor(n, "source");
        else if (flagged && fade > 0.5) tag = tagFor(n, "flag");
        ctx.fillStyle = isSource && lit > 0 ? c.ink : c.muted;
        ctx.fillText(tag, n.x + 14, n.y + 19);
      }

      // Ligne d'état de la demande
      var shown = cy.paths.filter(function (p) { return t >= LEAD + p.d * STEP; }).length;
      var name = geo.compact ? cy.source.short : cy.source.label;
      var status = "DM-2026-0" + dm + " · " + name + " " + cy.from + " → " + cy.to + " · " +
        shown + (geo.compact ? " à revoir" : (shown > 1 ? " éléments à revoir" : " élément à revoir"));
      ctx.globalAlpha = Math.max(0.35, fade);
      ctx.font = f.mono;
      ctx.fillStyle = c.soft;
      ctx.fillText(status, 0, H - 6);
      ctx.globalAlpha = 1;
    }

    function advance(dt) {
      cycle.t += dt;
      if (!cycle.bumped && cycle.t >= cycle.end - FADE) {
        cycle.source.v[1] += 1;
        cycle.bumped = true;
      }
      if (cycle.t >= cycle.end) {
        dm = dm >= 99 ? 41 : dm + 1;
        cycle = newCycle();
      }
    }

    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      advance(dt);
      draw();
      rafId = requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduceMotion.matches || !visible || document.hidden) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(rafId);
    }

    // Image fixe : la demande sur la plateforme, tous les liens parcourus.
    function still() {
      cycle = newCycle(byId.T2);
      cycle.t = cycle.end - FADE - 0.01;
      draw();
    }

    readColors();
    layout();
    if (reduceMotion.matches) {
      still();
    } else {
      cycle = newCycle(byId.T2);
      cycle.t = LEAD + 3 * STEP;
      draw();
      start();
    }

    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { layout(); draw(); }, 120);
    });

    var refresh = function () { readColors(); if (!running) draw(); };
    var onMotionChange = function () {
      if (reduceMotion.matches) { stop(); still(); } else { start(); }
    };
    if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", onMotionChange);

    var scheme = window.matchMedia("(prefers-color-scheme: dark)");
    if (scheme.addEventListener) scheme.addEventListener("change", refresh);
    new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(canvas);
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { layout(); if (!running) draw(); });
    }
  }

  /* ---------- Catalogue des briques : filtre par type ---------- */
  document.querySelectorAll("[data-catalog]").forEach(function (catalog) {
    var buttons = catalog.querySelectorAll("[data-filter]");
    var rows = catalog.querySelectorAll("[data-type]");
    var count = catalog.querySelector("[data-catalog-count]");
    var apply = function (filter) {
      var shown = 0;
      rows.forEach(function (row) {
        var match = filter === "tout" || row.getAttribute("data-type") === filter;
        row.hidden = !match;
        if (match) shown++;
      });
      buttons.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-filter") === filter));
      });
      if (count) {
        var active = catalog.querySelector('[data-filter="' + filter + '"]');
        count.textContent = shown + (shown > 1 ? "\u00A0briques" : "\u00A0brique") +
          (filter === "tout" || !active ? "" : " · " + active.textContent.toLowerCase());
      }
    };
    buttons.forEach(function (b) {
      b.addEventListener("click", function () { apply(b.getAttribute("data-filter")); });
    });
    apply("tout");
  });

  /* ---------- Copier l’adresse e-mail ---------- */
  document.querySelectorAll("[data-copy-target]").forEach(function (button) {
    button.addEventListener("click", function () {
      var source = document.getElementById(button.getAttribute("data-copy-target"));
      if (!source) return;
      var text = source.textContent.trim();
      var done = function () {
        button.textContent = "Copié";
        setTimeout(function () { button.textContent = "Copier"; }, 1800);
      };
      var fallback = function () {
        var range = document.createRange();
        range.selectNodeContents(source);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        button.textContent = "Adresse sélectionnée";
        setTimeout(function () { button.textContent = "Copier"; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
    });
  });

  /* ---------- Formulaire de contact ----------
     Sans serveur : le message est préparé dans la messagerie du visiteur.
     L’adresse de destination se règle dans l’attribut data-email du formulaire. */
  var form = document.getElementById("contact-form");
  if (form) {
    var status = document.getElementById("form-status");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var messageField = form.elements.message;
      if (!messageField.value.trim()) {
        messageField.setCustomValidity("Décrivez le cas en quelques lignes.");
        messageField.reportValidity();
        messageField.addEventListener("input", function () { messageField.setCustomValidity(""); }, { once: true });
        return;
      }
      var data = new FormData(form);
      var to = form.getAttribute("data-email");
      var who = String(data.get("entreprise") || data.get("nom") || "").trim();
      var subject = "[Site SJPMP] " + data.get("sujet") + (who ? " · " + who : "");
      var body = [
        String(data.get("message") || "").trim(),
        "",
        "—",
        "Nom\u00A0: " + String(data.get("nom") || "").trim(),
        "Entreprise\u00A0: " + String(data.get("entreprise") || "").trim(),
        "E-mail\u00A0: " + String(data.get("email") || "").trim()
      ].join("\n");
      var url = "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);

      if (status) {
        status.textContent = "";
        setTimeout(function () {
          status.textContent = "Si votre messagerie ne s’est pas ouverte, écrivez directement à " + to + ".";
        }, 50);
      }
      try { window.location.href = url; } catch (err) { /* le message ci-dessus reste affiché */ }
    });
  }
})();
