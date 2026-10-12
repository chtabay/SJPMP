/* SJPMP — interactions du site : menu mobile, schéma « écluse », formulaire de contact. */
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

  /* ---------- Schéma « écluse » ----------
     Des usages dispersés de l'IA convergent vers la charte (la porte), puis
     suivent l'un des quatre couloirs : libre, encadré, supervisé (pause pour
     validation humaine) ou proscrit (arrêt à la barrière). */
  var canvas = document.getElementById("flow-canvas");
  if (canvas && canvas.getContext) initFlow(canvas);

  function initFlow(canvas) {
    var ctx = canvas.getContext("2d");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var LANES = [
      { label: "LIBRE", weight: 0.4, token: "--lane-libre" },
      { label: "ENCADRÉ", weight: 0.3, token: "--lane-encadre" },
      { label: "SUPERVISÉ", weight: 0.2, token: "--lane-supervise" },
      { label: "PROSCRIT", weight: 0.1, token: "--lane-proscrit" }
    ];
    var TAU = Math.PI * 2;
    var W = 0, H = 0, geo = null, colors = null;
    var particles = [];
    var running = false, visible = true, last = 0, rafId = 0;

    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    function readColors() {
      var cs = getComputedStyle(document.documentElement);
      var get = function (name) { return cs.getPropertyValue(name).trim(); };
      colors = {
        ink: get("--ink"),
        soft: get("--ink-soft"),
        muted: get("--muted"),
        line: get("--line"),
        signal: get("--signal"),
        lanes: LANES.map(function (l) { return get(l.token); })
      };
    }

    function pickLane() {
      var r = Math.random();
      for (var i = 0; i < LANES.length; i++) {
        r -= LANES[i].weight;
        if (r <= 0) return i;
      }
      return 0;
    }

    function spawn(p, scatter) {
      p = p || {};
      p.lane = pickLane();
      p.x = scatter ? Math.random() * W : -6 - Math.random() * W * 0.25;
      if (p.lane === 3) p.x = Math.min(p.x, geo.barrierX - 4);
      p.baseY = geo.top + Math.random() * (geo.bottom - geo.top);
      p.amp = 8 + Math.random() * 22;
      p.freq = 0.008 + Math.random() * 0.02;
      p.phase = Math.random() * TAU;
      p.off = (Math.random() - 0.5) * geo.laneH * 0.48;
      p.speed = 38 + Math.random() * 34;
      p.r = 1.3 + Math.random() * 1.2;
      p.life = 1;
      p.y = p.baseY;
      return p;
    }

    function layout() {
      var rect = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var top = 26, bottom = H - 4;
      var gateX = Math.round(W * (W < 600 ? 0.34 : 0.42));
      var laneH = (bottom - top) / LANES.length;
      geo = {
        top: top,
        bottom: bottom,
        gateX: gateX,
        laneH: laneH,
        laneY: LANES.map(function (_, i) { return top + laneH * (i + 0.5); }),
        barrierX: gateX + Math.max(40, (W - gateX) * 0.14),
        nodeX: gateX + (W - gateX) * 0.5,
        compact: W < 600
      };

      var target = Math.round(clamp(W / 6, 60, 190));
      while (particles.length < target) particles.push(spawn(null, true));
      particles.length = target;
    }

    function step(p, dt) {
      var g = geo;
      var v = p.speed;
      if (p.lane === 2 && Math.abs(p.x - g.nodeX) < 16) v *= 0.22;
      if (p.lane === 3 && p.x >= g.barrierX - 4) {
        p.x = g.barrierX - 4;
        v = 0;
        p.life -= dt * 1.1;
      }
      p.x += v * dt;

      var target = g.laneY[p.lane] + p.off;
      var t = clamp((p.x - g.gateX * 0.3) / (g.gateX * 0.7), 0, 1);
      var e = t * t * (3 - 2 * t);
      var wy = clamp(p.baseY + p.amp * Math.sin(p.x * p.freq + p.phase), g.top + 2, g.bottom - 2);
      p.y = wy + (target - wy) * e;

      if (p.x > W + 8 || p.life <= 0) spawn(p, false);
    }

    function draw() {
      var g = geo, c = colors, i;
      ctx.clearRect(0, 0, W, H);

      // Couloirs après la porte
      ctx.lineWidth = 1;
      ctx.strokeStyle = c.line;
      ctx.beginPath();
      for (i = 0; i <= LANES.length; i++) {
        var ly = Math.round(g.top + g.laneH * i) + 0.5;
        ctx.moveTo(g.gateX, ly);
        ctx.lineTo(W, ly);
      }
      ctx.stroke();

      // Porte (charte) : une ouverture par couloir
      var gap = g.laneH * 0.32;
      ctx.lineWidth = 3;
      ctx.lineCap = "butt";
      ctx.strokeStyle = c.ink;
      ctx.beginPath();
      var y0 = g.top;
      for (i = 0; i < LANES.length; i++) {
        ctx.moveTo(g.gateX, y0);
        ctx.lineTo(g.gateX, g.laneY[i] - gap);
        y0 = g.laneY[i] + gap;
      }
      ctx.moveTo(g.gateX, y0);
      ctx.lineTo(g.gateX, g.bottom);
      ctx.stroke();
      ctx.fillStyle = c.signal;
      ctx.fillRect(g.gateX - 6, g.top - 5, 12, 4);

      // Validation humaine (couloir supervisé)
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = c.lanes[2];
      ctx.beginPath();
      ctx.arc(g.nodeX, g.laneY[2], g.laneH * 0.3, 0, TAU);
      ctx.stroke();

      // Barrière (couloir proscrit)
      ctx.lineWidth = 3;
      ctx.strokeStyle = c.lanes[3];
      ctx.beginPath();
      ctx.moveTo(g.barrierX, g.laneY[3] - g.laneH * 0.34);
      ctx.lineTo(g.barrierX, g.laneY[3] + g.laneH * 0.34);
      ctx.stroke();

      // Usages
      for (i = 0; i < particles.length; i++) {
        var p = particles[i];
        var before = p.x < g.gateX;
        ctx.globalAlpha = clamp(p.life, 0, 1) * (before ? 0.7 : 1);
        ctx.fillStyle = before ? c.muted : c.lanes[p.lane];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Étiquettes
      ctx.font = '500 11px "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = c.soft;
      ctx.textAlign = "left";
      ctx.fillText(g.compact ? "USAGES" : "USAGES SPONTANÉS", 0, 12);
      ctx.textAlign = "center";
      ctx.fillText("CHARTE IA", g.gateX, 12);
      ctx.textAlign = "right";
      for (i = 0; i < LANES.length; i++) {
        var top = g.top + g.laneH * i;
        ctx.fillStyle = c.lanes[i];
        ctx.fillRect(W - 2 - ctx.measureText(LANES[i].label).width - 14, top + 6, 8, 8);
        ctx.fillStyle = c.soft;
        ctx.fillText(LANES[i].label, W - 2, top + 14);
      }
    }

    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      for (var i = 0; i < particles.length; i++) step(particles[i], dt);
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

    // Image fixe représentative : on simule quelques secondes de flux.
    function settle() {
      for (var n = 0; n < 240; n++) {
        for (var i = 0; i < particles.length; i++) step(particles[i], 1 / 30);
      }
      draw();
    }

    function refresh() {
      readColors();
      if (!running) draw();
    }

    readColors();
    layout();
    settle();
    start();

    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { layout(); draw(); }, 120);
    });

    var onMotionChange = function () { if (reduceMotion.matches) { stop(); draw(); } else { start(); } };
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

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!running) draw(); });
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
      if (count) count.textContent = shown + (shown > 1 ? " briques" : " brique");
    };
    buttons.forEach(function (b) {
      b.addEventListener("click", function () { apply(b.getAttribute("data-filter")); });
    });
    apply("tout");
  });

  /* ---------- Copier l'adresse e-mail ---------- */
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
        button.textContent = "Sélectionné";
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
     L'adresse de destination se règle dans l'attribut data-email du formulaire. */
  var form = document.getElementById("contact-form");
  if (form) {
    var status = document.getElementById("form-status");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = new FormData(form);
      var to = form.getAttribute("data-email");
      var who = String(data.get("entreprise") || data.get("nom") || "").trim();
      var subject = "[Site SJPMP] " + data.get("sujet") + (who ? " · " + who : "");
      var body = [
        String(data.get("message") || "").trim(),
        "",
        "—",
        "Nom : " + String(data.get("nom") || "").trim(),
        "Entreprise : " + String(data.get("entreprise") || "").trim(),
        "E-mail : " + String(data.get("email") || "").trim()
      ].join("\n");
      var url = "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);

      if (status) {
        status.hidden = false;
        status.textContent = "Votre messagerie devrait s'ouvrir avec le message prérempli. Si rien ne s'ouvre, écrivez-nous directement à " + to + ".";
      }
      try { window.location.href = url; } catch (err) { /* le message ci-dessus reste affiché */ }
    });
  }
})();
