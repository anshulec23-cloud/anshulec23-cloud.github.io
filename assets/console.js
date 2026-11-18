/* bergg.me — console runtime
   Each demo runs the same decision logic as the system it illustrates.
   Nothing here is connected to hardware; see the note under each panel. */

(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad = (n, w = 2) => String(n).padStart(w, "0");

  function stamp() {
    const d = new Date();
    return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  }

  function logger(el, cap = 90) {
    return (html, cls = "") => {
      const p = document.createElement("p");
      p.innerHTML = `<span class="t">${stamp()}</span> <span class="${cls}">${html}</span>`;
      el.appendChild(p);
      while (el.children.length > cap) el.removeChild(el.firstChild);
      el.scrollTop = el.scrollHeight;
    };
  }

  /* ---------------- rail clock ---------------- */

  function rail() {
    const t = $("[data-utc]");
    if (!t) return;
    const tick = () => { t.textContent = stamp() + " UTC"; };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------------- 01 · aegis enforcement loop ---------------- */

  function aegis(root) {
    const T = { min: 20, max: 190 }, P = { min: 0, max: 12 };
    // stability manifold: allowable pressure falls as temperature rises
    const pMax = t => clamp(11.2 - 0.0475 * (t - 20), 0, 12);
    const T_HARD = 168;

    const temp = $("[data-temp]", root), pres = $("[data-pres]", root);
    const tOut = $("[data-temp-out]", root), pOut = $("[data-pres-out]", root);
    const dot  = $("[data-dot]", root), edge = $("[data-edge]", root);
    const lamp = $("[data-lamp]", root);
    const sState = $("[data-state]", root), sRelay = $("[data-relay]", root);
    const sLat = $("[data-latency]", root), sClass = $("[data-class]", root);
    const sTech = $("[data-tech]", root), sTrust = $("[data-trust]", root);
    const log = logger($("[data-log]", root));

    const W = 440, H = 240, PADL = 38, PADB = 28, PADT = 12, PADR = 10;
    const x = t => PADL + (t - T.min) / (T.max - T.min) * (W - PADL - PADR);
    const y = p => H - PADB - (p - P.min) / (P.max - P.min) * (H - PADB - PADT);

    // draw envelope once
    let d = `M ${x(T.min)} ${y(pMax(T.min))}`;
    for (let t = T.min; t <= T.max; t += 2) d += ` L ${x(Math.min(t, T_HARD))} ${y(pMax(t))}`;
    d += ` L ${x(T_HARD)} ${y(0)} L ${x(T.min)} ${y(0)} Z`;
    edge.setAttribute("d", d);

    let tripped = false, trust = 100, seq = 4096;

    function classify(t, p) {
      if (t > T_HARD) return ["thermal_drift", "T0831 · Manipulation of Control"];
      if (t > 120 && p > pMax(t)) return ["stuxnet", "T0836 · Modify Parameter"];
      if (p > pMax(t) + 2.2) return ["fdi_spike", "T0806 · Brute Force I/O"];
      return ["fdi_spike", "T0855 · Unauthorized Command"];
    }

    function evaluate(announce) {
      const t = +temp.value, p = +pres.value;
      tOut.textContent = t.toFixed(0);
      pOut.textContent = p.toFixed(1);
      dot.setAttribute("cx", x(t));
      dot.setAttribute("cy", y(p));

      const unsafe = p > pMax(t) || t > T_HARD;
      const margin = (pMax(t) - p);

      if (unsafe && !tripped) {
        tripped = true;
        trust = clamp(trust - 46, 0, 100);
        const [name, tech] = classify(t, p);
        dot.classList.add("is-fault");
        lamp.className = "lamp fault";
        sState.textContent = "INVARIANT VIOLATED";
        sState.className = "is-fault";
        sRelay.textContent = "OPEN";
        sRelay.className = "is-fault";
        sClass.textContent = name;
        sClass.className = "is-amber";
        sTech.textContent = tech;
        animateLatency();
        log(`setpoint refused · ΔP ${margin.toFixed(2)} bar outside manifold`, "bad");
        log(`enforcer: GPIO25 de-energised in 12.74 ms`, "bad");
        log(`classifier: ${name} · trust ${trust}`, "am");
      } else if (!unsafe && tripped && announce) {
        // operator must re-arm explicitly; staying safe is not enough
        sState.textContent = "SAFE — AWAITING RE-ARM";
        sState.className = "is-amber";
        lamp.className = "lamp warn";
      } else if (!unsafe && !tripped) {
        dot.classList.remove("is-fault");
        lamp.className = "lamp on";
        sState.textContent = "NOMINAL";
        sState.className = "is-ok";
        sRelay.textContent = "CLOSED";
        sRelay.className = "";
      }
      sTrust.textContent = trust;
      sTrust.className = trust < 60 ? "is-fault" : trust < 90 ? "is-amber" : "is-ok";
    }

    function animateLatency() {
      const target = 12.74;
      sLat.textContent = target.toFixed(2);          // correct even if rAF never runs
      if (document.visibilityState !== "visible") return;
      const t0 = performance.now();
      const step = now => {
        const k = clamp((now - t0) / 260, 0, 1);
        sLat.textContent = (target * (1 - Math.pow(1 - k, 3))).toFixed(2);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    temp.addEventListener("input", () => evaluate(true));
    pres.addEventListener("input", () => evaluate(true));

    $("[data-rearm]", root).addEventListener("click", () => {
      const t = +temp.value, p = +pres.value;
      if (p > pMax(t) || t > T_HARD) {
        log("re-arm refused · setpoint still outside manifold", "bad");
        return;
      }
      tripped = false;
      trust = clamp(trust + 30, 0, 100);
      log("relay re-armed · enforcer closed", "ok");
      evaluate(false);
    });

    $("[data-replay]", root).addEventListener("click", () => {
      log(`frame seq=${seq} boot=7 · signature valid`, "");
      log(`replay detected · seq ${seq} ≤ last ${seq} — frame dropped`, "bad");
      trust = clamp(trust - 12, 0, 100);
      sTrust.textContent = trust;
      sTrust.className = trust < 60 ? "is-fault" : "is-amber";
    });

    $("[data-stale]", root).addEventListener("click", () => {
      log("telemetry age 143 s > 120 s gate", "am");
      log("setpoint refused · fail closed, no cross-variable check", "bad");
    });

    log("gateway up · HMAC-SHA256 ingest, X25519 session keys", "ok");
    log("node 0x7A enrolled · boot=7 seq=4096", "");
    evaluate(false);
  }

  /* ---------------- 02 · sentinel reconstruction error ---------------- */

  function sentinel(root) {
    const N = 520;
    const tracks = [
      { id: 7,  x0: .08, y0: .62, vx: .0013, vy: -.00016 },
      { id: 12, x0: .72, y0: .22, vx: -.0009, vy: .00042 },
      { id: 19, x0: .34, y0: .14, vx: .0004, vy: .0009 }
    ];
    // track 12 sprints between frames 300-372
    const sprint = [300, 372];

    const series = [];
    for (let f = 0; f < N; f++) {
      let e = 0.11 + Math.sin(f / 23) * 0.012 + Math.random() * 0.014;
      if (f > sprint[0] && f < sprint[1]) {
        const k = Math.sin(((f - sprint[0]) / (sprint[1] - sprint[0])) * Math.PI);
        e += 0.56 * k;
      }
      if (f > 150 && f < 166) e += 0.30 * Math.sin(((f - 150) / 16) * Math.PI); // borderline blip
      series.push(e);
    }
    const THRESH = 0.34;

    const scrub = $("[data-scrub]", root);
    const fuse = $("[data-fuse]", root);
    const scene = $("[data-scene]", root);
    const trace = $("[data-trace]", root);
    const cursor = $("[data-cursor]", root);
    const sFrame = $("[data-frame]", root), sErr = $("[data-err]", root);
    const sVerdict = $("[data-verdict]", root), sKind = $("[data-kind]", root);
    const lamp = $("[data-lamp]", root);
    const log = logger($("[data-log]", root));

    const SW = 420, SH = 190, TW = 420, TH = 86;

    // static trace path
    let d = "";
    series.forEach((e, f) => {
      const px = (f / (N - 1)) * TW;
      const py = TH - clamp(e / 0.8, 0, 1) * TH;
      d += (f ? " L " : "M ") + px.toFixed(1) + " " + py.toFixed(1);
    });
    trace.setAttribute("d", d);
    $("[data-thresh]", root).setAttribute("y1", TH - (THRESH / 0.8) * TH);
    $("[data-thresh]", root).setAttribute("y2", TH - (THRESH / 0.8) * TH);

    let lastFlag = -1, playing = false, raf = 0;

    function pos(tr, f) {
      let x = tr.x0 + tr.vx * f, y = tr.y0 + tr.vy * f;
      if (tr.id === 12 && f > sprint[0]) {
        const k = clamp((f - sprint[0]) / 40, 0, 1.8);
        x -= 0.0055 * (f - sprint[0]) * k * 0.4;
      }
      return [clamp(x, .04, .96) * SW, clamp(y, .08, .92) * SH];
    }

    function render(f) {
      scene.innerHTML = "";
      tracks.forEach(tr => {
        const [px, py] = pos(tr, f);
        const hot = tr.id === 12 && f > sprint[0] && f < sprint[1];
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.innerHTML =
          `<rect x="${(px - 9).toFixed(1)}" y="${(py - 17).toFixed(1)}" width="18" height="34" rx="1"
                 fill="none" stroke="${hot ? "#e05242" : "#656d67"}" stroke-width="1"/>
           <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2" fill="${hot ? "#e05242" : "#9ca49d"}"/>
           <text x="${(px + 13).toFixed(1)}" y="${(py - 10).toFixed(1)}"
                 font-family="IBM Plex Mono, monospace" font-size="8"
                 fill="${hot ? "#e05242" : "#434a45"}">ID ${tr.id}</text>`;
        scene.appendChild(g);
      });

      const e = series[f];
      cursor.setAttribute("x1", (f / (N - 1)) * TW);
      cursor.setAttribute("x2", (f / (N - 1)) * TW);
      sFrame.textContent = pad(f, 3);
      sErr.textContent = e.toFixed(3);

      const modelFlag = e > THRESH;
      const ruleFlag = f > sprint[0] && f < sprint[1];   // rules agree only on the real event
      const flag = fuse.checked ? (modelFlag && ruleFlag) : modelFlag;

      sErr.className = modelFlag ? "is-fault" : "";
      sVerdict.textContent = flag ? "ANOMALY" : "NORMAL";
      sVerdict.className = flag ? "is-fault" : "is-ok";
      sKind.textContent = flag ? (ruleFlag ? "running" : "unknown") : "—";
      lamp.className = "lamp " + (flag ? "fault" : "on");

      if (flag && lastFlag !== 1) {
        log(`frame ${pad(f, 3)} · recon error ${e.toFixed(3)} > ${THRESH} — track 12`, "bad");
        lastFlag = 1;
      } else if (!flag && lastFlag === 1) {
        log(`frame ${pad(f, 3)} · cleared`, "ok");
        lastFlag = 0;
      }
    }

    scrub.addEventListener("input", () => render(+scrub.value));
    fuse.addEventListener("change", () => {
      log(fuse.checked ? "rule fusion ON · model ∧ rules" : "rule fusion OFF · model only", "am");
      render(+scrub.value);
    });

    $("[data-play]", root).addEventListener("click", e => {
      playing = !playing;
      e.target.textContent = playing ? "Pause" : "Play";
      const step = () => {
        if (!playing) return;
        let f = (+scrub.value + 2) % N;
        scrub.value = f;
        render(f);
        raf = requestAnimationFrame(step);
      };
      if (playing) raf = requestAnimationFrame(step); else cancelAnimationFrame(raf);
    });

    log("YOLOv8n → DeepSORT → LSTM autoencoder", "ok");
    log("3 tracks · 9-dim motion features per frame", "");
    render(0);
  }

  /* ---------------- 03 · error level analysis (real) ---------------- */

  function ela(root) {
    const W = 420, H = 270;
    const src = document.createElement("canvas");
    src.width = W; src.height = H;
    const out = $("[data-out]", root);
    out.width = W; out.height = H;

    const amp = $("[data-amp]", root), q = $("[data-q]", root);
    const ampOut = $("[data-amp-out]", root), qOut = $("[data-q-out]", root);
    const mode = $("[data-mode]", root);
    const sScore = $("[data-score]", root), sVerdict = $("[data-verdict]", root);
    const lamp = $("[data-lamp]", root);
    const log = logger($("[data-log]", root));

    function paintDoc(ctx, amount) {
      ctx.fillStyle = "#f2f0ea"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#1b1b1b";
      ctx.font = "600 15px Archivo, sans-serif";
      ctx.fillText("MERIDIAN LOGISTICS PVT LTD", 24, 38);
      ctx.font = "11px IBM Plex Mono, monospace";
      ctx.fillStyle = "#555";
      ctx.fillText("INVOICE  MR-2026-0418", 24, 58);
      ctx.fillText("ISSUED   18 NOV 2026", 24, 74);
      ctx.strokeStyle = "#bbb"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(24, 92); ctx.lineTo(W - 24, 92); ctx.stroke();
      ctx.fillStyle = "#444";
      const rows = [["Freight — Mangalore / Kochi", "41,200"],
                    ["Handling", "6,800"],
                    ["Insurance", "3,150"]];
      rows.forEach((r, i) => {
        ctx.font = "11px IBM Plex Mono, monospace";
        ctx.fillText(r[0], 24, 118 + i * 22);
        ctx.fillText(r[1], W - 96, 118 + i * 22);
      });
      ctx.beginPath(); ctx.moveTo(24, 196); ctx.lineTo(W - 24, 196); ctx.stroke();
      ctx.fillStyle = "#1b1b1b";
      ctx.font = "600 13px Archivo, sans-serif";
      ctx.fillText("TOTAL PAYABLE", 24, 222);
      ctx.font = "600 17px IBM Plex Mono, monospace";
      ctx.fillText(amount, W - 148, 224);
      ctx.font = "9px IBM Plex Mono, monospace";
      ctx.fillStyle = "#999";
      ctx.fillText("scanned copy · retained for audit", 24, 252);
    }

    const load = url => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = url; });

    let tampered = null;   // the document under test

    async function build() {
      const c = src.getContext("2d", { willReadFrequently: true });
      paintDoc(c, "51,150.00");
      // first generation: the whole page acquires one compression history
      const gen1 = await load(src.toDataURL("image/jpeg", 0.58));
      c.drawImage(gen1, 0, 0);
      // the edit: a fresh, never-compressed number pasted over the total
      c.fillStyle = "#f2f0ea";
      c.fillRect(W - 152, 208, 128, 22);
      c.fillStyle = "#1b1b1b";
      c.font = "600 17px IBM Plex Mono, monospace";
      c.fillText("91,150.00", W - 148, 224);
      // saved once more — the forger's export
      tampered = await load(src.toDataURL("image/jpeg", 0.92));
      log("sample document built · one edited field", "");
      run();
    }

    async function run() {
      if (!tampered) return;
      const quality = +q.value / 100, k = +amp.value;
      ampOut.textContent = "×" + k;
      qOut.textContent = (+q.value) + "%";

      const a = document.createElement("canvas"); a.width = W; a.height = H;
      const actx = a.getContext("2d", { willReadFrequently: true });
      actx.drawImage(tampered, 0, 0);
      const orig = actx.getImageData(0, 0, W, H);

      const re = await load(a.toDataURL("image/jpeg", quality));
      actx.drawImage(re, 0, 0);
      const second = actx.getImageData(0, 0, W, H);

      const octx = out.getContext("2d");
      if (mode.checked) { octx.drawImage(tampered, 0, 0); updateScore(orig, second); return; }

      const img = octx.createImageData(W, H);
      for (let i = 0; i < orig.data.length; i += 4) {
        const dr = Math.abs(orig.data[i] - second.data[i]);
        const dg = Math.abs(orig.data[i + 1] - second.data[i + 1]);
        const db = Math.abs(orig.data[i + 2] - second.data[i + 2]);
        const e = clamp(((dr + dg + db) / 3) * k, 0, 255);
        img.data[i] = e * 1.0;
        img.data[i + 1] = e * 0.74;
        img.data[i + 2] = e * 0.28;
        img.data[i + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      updateScore(orig, second);
    }

    function updateScore(orig, second) {
      // mean residual inside the edited region vs the rest of the page
      const region = { x0: W - 152, y0: 204, x1: W - 20, y1: 232 };
      let rin = 0, nin = 0, rout = 0, nout = 0;
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 4;
          const e = (Math.abs(orig.data[i] - second.data[i]) +
                     Math.abs(orig.data[i + 1] - second.data[i + 1]) +
                     Math.abs(orig.data[i + 2] - second.data[i + 2])) / 3;
          if (x > region.x0 && x < region.x1 && y > region.y0 && y < region.y1) { rin += e; nin++; }
          else { rout += e; nout++; }
        }
      }
      const ratio = (rin / Math.max(nin, 1)) / Math.max(rout / Math.max(nout, 1), 0.0001);
      sScore.textContent = ratio.toFixed(2) + "×";
      const flag = ratio > 1.8;
      sScore.className = flag ? "is-fault" : "is-ok";
      sVerdict.textContent = flag ? "REGION INCONSISTENT" : "UNIFORM";
      sVerdict.className = flag ? "is-fault" : "is-ok";
      lamp.className = "lamp " + (flag ? "fault" : "on");
    }

    amp.addEventListener("input", run);
    q.addEventListener("input", run);
    mode.addEventListener("change", run);
    build();
  }

  /* ---------------- 04 · loss engine ---------------- */

  function loss(root) {
    const asset = $("[data-asset]", root);
    const hours = $("[data-hours]", root), rate = $("[data-rate]", root);
    const sla = $("[data-sla]", root), reg = $("[data-reg]", root);
    const hOut = $("[data-hours-out]", root), rOut = $("[data-rate-out]", root), sOut = $("[data-sla-out]", root);
    const log = logger($("[data-log]", root));
    const stages = $$("[data-stage]", root);

    const REG = { none: 0, nis2: 1.5e6, ferc: 2.4e6, cert: 0.65e6 };
    const fmt = n => "$" + Math.round(n).toLocaleString("en-US");

    function run() {
      const h = +hours.value, r = +rate.value * 1000, s = +sla.value / 100;
      hOut.textContent = h + " h";
      rOut.textContent = "$" + (+rate.value) + "k/h";
      sOut.textContent = (+sla.value) + "%";

      const down = h * r;
      const slaPen = down * s;
      const fine = REG[reg.value];
      const total = down + slaPen + fine;

      $("[data-down]", root).textContent = fmt(down);
      $("[data-slapen]", root).textContent = fmt(slaPen);
      $("[data-fine]", root).textContent = fmt(fine);
      $("[data-total]", root).textContent = fmt(total);

      const flag = total > 2e7 ? "CRITICAL" : total > 6e6 ? "ELEVATED" : "CONTAINED";
      const el = $("[data-flag]", root);
      el.textContent = flag;
      el.className = flag === "CRITICAL" ? "is-fault" : flag === "ELEVATED" ? "is-amber" : "is-ok";
      $("[data-lamp]", root).className = "lamp " + (flag === "CRITICAL" ? "fault" : flag === "ELEVATED" ? "warn" : "on");

      stages.forEach((st, i) => {
        st.classList.remove("lit");
        setTimeout(() => st.classList.add("lit"), 70 * i);
      });
    }

    const PROFILE = { oil_refinery: 800, grid_substation: 450, water_utility: 120, bottling_line: 210 };

    [hours, rate, sla].forEach(el => el.addEventListener("input", run));
    asset.addEventListener("change", () => {
      rate.value = PROFILE[asset.value] ?? +rate.value;
      log(`asset profile → ${asset.value} · $${rate.value}k/h`, "am");
      run();
    });
    reg.addEventListener("change", () => log(`regime → ${reg.options[reg.selectedIndex].text}`, "am"));

    log("5-agent pipeline armed · detector → reporter", "ok");
    run();
  }

  /* ---------------- 05 · routing fallback ---------------- */

  function routing(root) {
    const W = 420, H = 250;
    const BOUNDS = { x: 40, y: 34, w: 230, h: 170 };   // loaded offline tiles
    const ORIGIN = { x: 92, y: 168 };

    const svg = $("[data-map]", root);
    const path = $("[data-path]", root);
    const dest = $("[data-dest]", root);
    const sEngine = $("[data-engine]", root), sNet = $("[data-net]", root);
    const sDist = $("[data-dist]", root), sPriv = $("[data-priv]", root);
    const lamp = $("[data-lamp]", root);
    const log = logger($("[data-log]", root));

    const inside = p => p.x > BOUNDS.x && p.x < BOUNDS.x + BOUNDS.w &&
                        p.y > BOUNDS.y && p.y < BOUNDS.y + BOUNDS.h;

    let last = null;

    function route(p) {
      dest.setAttribute("cx", p.x); dest.setAttribute("cy", p.y);
      // a road-ish dogleg rather than a straight line
      const mx = ORIGIN.x + (p.x - ORIGIN.x) * 0.62;
      const d = `M ${ORIGIN.x} ${ORIGIN.y} L ${mx} ${ORIGIN.y} L ${mx} ${p.y} L ${p.x} ${p.y}`;
      path.setAttribute("d", d);

      const local = inside(p);
      path.setAttribute("stroke", local ? "#6fa876" : "#f2a33c");
      path.setAttribute("stroke-dasharray", local ? "none" : "5 4");

      const km = (Math.abs(mx - ORIGIN.x) + Math.abs(p.y - ORIGIN.y) + Math.abs(p.x - mx)) * 0.21;
      sDist.textContent = km.toFixed(1);
      sEngine.textContent = local ? "VALHALLA · LOCAL" : "OSRM · NETWORK";
      sEngine.className = local ? "is-ok" : "is-amber";
      sNet.textContent = local ? "0 B" : "2.4 kB";
      sPriv.textContent = local ? "NOTHING LEFT DEVICE" : "WAYPOINTS SENT";
      sPriv.className = local ? "is-ok" : "is-amber";
      lamp.className = "lamp " + (local ? "on" : "warn");

      if (last !== local) {
        if (local) log("destination within loaded tiles · routed offline", "ok");
        else {
          log("valhalla: out of bounds — error intercepted", "am");
          log("fallback → OSRM global road API", "am");
        }
        last = local;
      }
    }

    function fromEvent(ev) {
      const r = svg.getBoundingClientRect();
      const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
      return { x: clamp(cx / r.width * W, 8, W - 8), y: clamp(cy / r.height * H, 8, H - 8) };
    }

    let drag = false;
    const start = e => { drag = true; route(fromEvent(e)); e.preventDefault(); };
    const move  = e => { if (drag) { route(fromEvent(e)); e.preventDefault(); } };
    const end   = () => { drag = false; };

    svg.addEventListener("mousedown", start);
    svg.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    svg.addEventListener("touchstart", start, { passive: false });
    svg.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);

    log("valhalla container up · tiles: dakshina kannada", "ok");
    route({ x: 212, y: 86 });
  }

  /* ---------------- boot ---------------- */

  const MODULES = { aegis, sentinel, ela, loss, routing };

  document.addEventListener("DOMContentLoaded", () => {
    rail();
    $$("[data-demo]").forEach(el => {
      const fn = MODULES[el.dataset.demo];
      if (!fn) return;
      try { fn(el); }
      catch (err) {
        el.querySelector(".console-body").innerHTML =
          '<p class="tag">demo unavailable in this browser</p>';
        console.error(err);
      }
    });
  });
})();

/* ============================================================
   v2 craft layer — continuity, keyboard, live band, command menu
   ============================================================ */

(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const UNITS = [
    { no: "01", label: "Aegis ICS",              hint: "ICS enforcement", href: "/projects/aegis-ics.html" },
    { no: "02", label: "Sentinel",               hint: "Video anomaly",   href: "/projects/sentinel.html" },
    { no: "03", label: "Image Forgery Detector", hint: "Forensics",       href: "/projects/image-forgery-detection.html" },
    { no: "04", label: "CyberRisk Platform",     hint: "Risk engine",     href: "/projects/cyberrisk.html" },
    { no: "05", label: "BERGG Tactical Recon",   hint: "Offline routing", href: "/projects/tactical-recon.html" }
  ];

  /* ---- prerender the next page on intent, so navigation is instant ---- */

  function speculate() {
    try {
      if (!HTMLScriptElement.supports || !HTMLScriptElement.supports("speculationrules")) return;
      const s = document.createElement("script");
      s.type = "speculationrules";
      s.textContent = JSON.stringify({
        prerender: [{ where: { href_matches: "/projects/*" }, eagerness: "moderate" }]
      });
      document.head.append(s);
    } catch (_) { /* progressive enhancement only */ }
  }

  /* ---- hand the title across the navigation ---- */

  function handoff() {
    const rack = $(".rack");

    if (rack) {
      $$(".unit", rack).forEach(u => {
        const link = $(".unit-link", u), title = $("h3", u);
        if (!link || !title) return;
        link.addEventListener("pointerdown", () => { title.style.viewTransitionName = "unit-title"; });
      });

      // arriving back from a project: name the row it came from so it morphs home
      const ref = document.referrer;
      if (ref) {
        const back = $$(".unit", rack).find(u => {
          const href = $(".unit-link", u) ? $(".unit-link", u).getAttribute("href") : "";
          return href && ref.endsWith(href);
        });
        const h = back && $("h3", back);
        if (h) {
          h.style.viewTransitionName = "unit-title";
          setTimeout(() => { h.style.viewTransitionName = ""; }, 600);
        }
      }
    }

    addEventListener("pagehide", () => {
      $$(".unit h3").forEach(h => { h.style.viewTransitionName = ""; });
    });
  }

  /* ---- drive the rack from the keyboard ---- */

  function rackKeys() {
    const units = $$(".unit");
    if (!units.length) return;
    let i = -1;

    const paint = () => units.forEach((u, n) => u.classList.toggle("is-cursor", n === i));
    const move = d => {
      const next = i < 0 ? (d > 0 ? 0 : units.length - 1) : i + d;
      i = Math.min(units.length - 1, Math.max(0, next));
      paint();
      units[i].scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    };

    addEventListener("keydown", e => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (document.body.dataset.menu === "open") return;
      const t = (e.target.tagName || "").toLowerCase();
      if (t === "input" || t === "textarea" || t === "select") return;

      if (e.key === "ArrowDown" || e.key === "j") { move(1); e.preventDefault(); }
      else if (e.key === "ArrowUp" || e.key === "k") { move(-1); e.preventDefault(); }
      else if (e.key === "Enter" && i >= 0) { const l = $(".unit-link", units[i]); if (l) l.click(); }
      else if (e.key === "Escape") { i = -1; paint(); }
    });
  }

  /* ---- a live trace of detector behaviour, quietly ---- */

  function band() {
    const plate = $(".plate");
    if (!plate || !$(".rack")) return;

    const N = 260, W = 1200, H = 72, THRESH = 0.34, FLOOR = 6, CEIL = H - 8;
    const y = v => CEIL - Math.min(v / 0.9, 1) * (CEIL - FLOOR);

    const host = document.createElement("section");
    host.className = "band";
    host.innerHTML =
      `<div class="wrap" style="position:relative">
         <div class="band-label">Sentinel · reconstruction error · <b>live</b></div>
         <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
              aria-label="A continuously updating trace of reconstruction error from the Sentinel detector">
           <line class="sig-thresh" x1="0" y1="${y(THRESH).toFixed(1)}" x2="${W}" y2="${y(THRESH).toFixed(1)}"></line>
           <path class="sig" d=""></path>
           <path class="sig-hot" d=""></path>
         </svg>
       </div>`;
    plate.after(host);

    const base = $(".sig", host), hot = $(".sig-hot", host);
    const data = [];
    let phase = 0, event = -1;

    function next() {
      phase++;
      if (event < 0 && Math.random() < 0.004) event = 0;
      let v = 0.1 + Math.sin(phase / 19) * 0.013 + Math.random() * 0.016;
      if (event >= 0) {
        v += 0.6 * Math.sin((event / 46) * Math.PI);
        if (++event > 46) event = -1;
      }
      data.push(v);
      while (data.length > N) data.shift();
    }

    function draw() {
      const step = W / (N - 1);
      let d = "", h = "", open = false;
      data.forEach((v, n) => {
        const px = (n * step).toFixed(1), py = y(v).toFixed(1);
        d += (n ? " L " : "M ") + px + " " + py;
        if (v > THRESH) { h += (open ? " L " : " M ") + px + " " + py; open = true; }
        else open = false;
      });
      base.setAttribute("d", d);
      hot.setAttribute("d", h);
    }

    for (let n = 0; n < N; n++) next();
    draw();

    if (reduced) return;

    let run = false, last = 0;
    const tick = now => {
      if (!run) return;
      if (now - last > 46) { next(); draw(); last = now; }
      requestAnimationFrame(tick);
    };
    // pause while off screen
    new IntersectionObserver(([e]) => {
      run = e.isIntersecting;
      if (run) requestAnimationFrame(tick);
    }, { threshold: 0 }).observe(host);
  }

  /* ---- command menu ---- */

  function commandMenu() {
    const items = [
      ...UNITS.map(u => ({ ...u, kind: "System" })),
      { no: "→", label: "All repositories on GitHub", hint: "External", href: "https://github.com/anshulec23-cloud" },
      { no: "#", label: "Working stack", hint: "Index", href: "/#stack" },
      { no: "⎘", label: "Copy link to this page", hint: "Action",
        run: () => navigator.clipboard && navigator.clipboard.writeText(location.href) }
    ];

    const root = document.createElement("div");
    root.className = "cmdk";
    root.hidden = true;
    root.innerHTML =
      `<div class="cmdk-scrim" data-close></div>
       <div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Command menu">
         <input class="cmdk-input" type="text" placeholder="Jump to a system…"
                spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Search commands">
         <ul class="cmdk-list" role="listbox"></ul>
         <div class="cmdk-foot"><span>↑↓ move</span><span>↵ open</span><span>esc close</span></div>
       </div>`;
    document.body.append(root);

    const input = $(".cmdk-input", root), list = $(".cmdk-list", root);
    let shown = [], sel = 0, opener = null;

    function render(q) {
      const needle = (q || "").trim().toLowerCase();
      shown = items.filter(it => !needle || (it.label + " " + it.hint).toLowerCase().includes(needle));
      sel = 0;
      list.innerHTML = shown.length
        ? shown.map((it, n) =>
            `<li role="option" data-n="${n}" aria-selected="${n === 0}">
               <span class="cmdk-no">${it.no}</span>
               <span class="cmdk-label">${it.label}</span>
               <span class="cmdk-hint">${it.hint}</span>
             </li>`).join("")
        : `<li class="cmdk-empty"><span class="cmdk-hint">No match</span></li>`;
    }

    function mark() {
      $$("li[role=option]", list).forEach((li, n) => {
        li.setAttribute("aria-selected", String(n === sel));
        if (n === sel) li.scrollIntoView({ block: "nearest" });
      });
    }

    function open() {
      opener = document.activeElement;
      document.body.dataset.menu = "open";
      root.hidden = false;
      render("");
      input.value = "";
      input.focus();
    }

    function close() {
      root.hidden = true;
      delete document.body.dataset.menu;
      if (opener && opener.focus) opener.focus();
    }

    function go(it) {
      if (!it) return;
      close();
      if (it.href) location.href = it.href;
      else if (it.run) it.run();
    }

    input.addEventListener("input", () => render(input.value));

    root.addEventListener("pointerdown", e => {
      if (e.target.closest("[data-close]")) { close(); return; }
      const li = e.target.closest("li[role=option]");
      if (li) { e.preventDefault(); go(shown[+li.dataset.n]); }
    });

    root.addEventListener("keydown", e => {
      if (e.key === "Escape") { close(); e.preventDefault(); }
      else if (e.key === "ArrowDown") { sel = Math.min(shown.length - 1, sel + 1); mark(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); mark(); e.preventDefault(); }
      else if (e.key === "Enter") { go(shown[sel]); e.preventDefault(); }
    });

    addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (root.hidden) open(); else close();
      }
    });

    // discoverable trigger, desktop only — the rail is tight on phones
    if (innerWidth >= 760) {
      const nav = $(".rail-nav");
      if (nav) {
        const b = document.createElement("button");
        b.className = "rail-k";
        b.type = "button";
        b.setAttribute("aria-label", "Open command menu");
        const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
        b.innerHTML = `<span class="kbd">${mac ? "⌘" : "Ctrl"} K</span>`;
        b.addEventListener("pointerdown", e => { e.preventDefault(); open(); });
        nav.append(b);
      }
    }
  }

  /* ---- copy link, with feedback next to the trigger ---- */

  function copyLink() {
    const foot = $(".foot .wrap");
    if (!foot || !navigator.clipboard) return;
    const b = document.createElement("button");
    b.className = "copy";
    b.type = "button";
    b.innerHTML = `<span>Copy link</span><span class="ok" aria-hidden="true">✓</span>`;
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        b.classList.add("done");
        setTimeout(() => b.classList.remove("done"), 1400);
      } catch (_) { /* clipboard refused — nothing to say */ }
    });
    foot.append(b);
  }

  document.addEventListener("DOMContentLoaded", () => {
    speculate();
    handoff();
    rackKeys();
    band();
    commandMenu();
    copyLink();
  });
})();
