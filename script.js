(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Clock and document reveal
  const clock = $("#utcClock");
  const updateClock = () => {
    clock.textContent = `${new Date().toISOString().slice(11, 19)} UTC`;
  };
  updateClock();
  setInterval(updateClock, 1000);

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  $$('[data-reveal]').forEach((el, index) => {
    el.style.transitionDelay = `${Math.min(index % 3, 2) * 80}ms`;
    revealObserver.observe(el);
  });

  let countsStarted = false;
  const heroIndex = $(".hero-index");
  new IntersectionObserver((entries, observer) => {
    if (!entries[0].isIntersecting || countsStarted) return;
    countsStarted = true;
    $$(".count").forEach((el) => {
      const target = Number(el.dataset.count);
      const start = performance.now();
      const animate = (time) => {
        const progress = reduceMotion ? 1 : Math.min(1, (time - start) / 1200);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased).toLocaleString("en-US");
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    });
    observer.disconnect();
  }, { threshold: .5 }).observe(heroIndex);

  // Network observatory
  const canvas = $("#networkCanvas");
  const ctx = canvas.getContext("2d");
  const tooltip = $("#nodeTooltip");
  const platformRail = $("#platformRail");
  const platforms = ["ORIGIN", "TT", "X", "IG", "RD", "YT", "SEARCH", "PRESS"];
  const platformNames = {
    ORIGIN: "First documented trace", TT: "TikTok", X: "X", IG: "Instagram",
    RD: "Reddit", YT: "YouTube", SEARCH: "Google Search", PRESS: "News & reference"
  };
  const nodes = [];
  const links = [];
  let width = 0, height = 0, dpr = 1, rotX = -0.14, rotY = 0.08;
  let pointer = { x: -100, y: -100 }, dragging = false, lastPointer = null, hovered = null;
  let selectedPlatform = "ALL";

  const seeded = (n) => {
    const x = Math.sin(n * 999.31) * 43758.5453;
    return x - Math.floor(x);
  };

  function buildNetwork() {
    nodes.length = 0;
    links.length = 0;
    nodes.push({ id: 0, platform: "ORIGIN", ring: 0, angle: 0, size: 6, label: "First trace", time: "00:00 UTC" });
    let id = 1;
    for (let ring = 1; ring <= 5; ring++) {
      const count = 7 + ring * 5;
      for (let i = 0; i < count; i++) {
        const platform = platforms[1 + ((i * 3 + ring) % (platforms.length - 1))];
        const angle = (i / count) * Math.PI * 2 + ring * .37 + (seeded(id) - .5) * .18;
        nodes.push({
          id, platform, ring, angle,
          size: 1.1 + seeded(id + 11) * 2.8,
          label: ["Original post", "Caption variant", "Reaction", "Remix", "Search lift", "Reference article"][Math.floor(seeded(id + 4) * 6)],
          time: `+${Math.floor(ring * 4 + seeded(id) * 8)}h ${String(Math.floor(seeded(id + 2) * 60)).padStart(2, "0")}m`
        });
        const parentPool = nodes.filter(n => n.ring === ring - 1);
        const parent = parentPool[Math.floor(seeded(id + 8) * parentPool.length)] || nodes[0];
        links.push({ a: parent.id, b: id, strength: .24 + seeded(id + 18) * .5 });
        if (i > 0 && seeded(id + 7) > .58) links.push({ a: id - 1, b: id, strength: .18 });
        id++;
      }
    }
  }

  function project(node) {
    if (node.ring === 0) return { x: width * .53, y: height * .47, z: 1 };
    const radius = Math.min(width, height) * (.075 + node.ring * .074);
    let x = Math.cos(node.angle) * radius;
    let y = Math.sin(node.angle) * radius * .69;
    let z = Math.sin(node.angle * 1.7 + node.ring) * radius * .18;
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    const cx = Math.cos(rotX), sx = Math.sin(rotX);
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    const y1 = y * cx - z1 * sx;
    const z2 = y * sx + z1 * cx;
    const perspective = 1 + z2 / 1400;
    return { x: width * .53 + x1 * perspective, y: height * .47 + y1 * perspective, z: perspective };
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width; height = rect.height;
    canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawNetwork(time) {
    ctx.clearRect(0, 0, width, height);
    const projected = nodes.map(project);
    const cx = width * .53, cy = height * .47;

    // time rings
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotY * .15);
    for (let ring = 1; ring <= 5; ring++) {
      const r = Math.min(width, height) * (.075 + ring * .074);
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * .69, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(133,158,191,${.11 - ring * .008})`;
      ctx.lineWidth = 1; ctx.setLineDash([2, 5]); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.restore();

    links.forEach(link => {
      const a = projected[link.a], b = projected[link.b];
      const aNode = nodes[link.a], bNode = nodes[link.b];
      const active = selectedPlatform === "ALL" || aNode.platform === selectedPlatform || bNode.platform === selectedPlatform;
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      const mx = (a.x + b.x) / 2 + (b.y - a.y) * .035;
      const my = (a.y + b.y) / 2 - (b.x - a.x) * .035;
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.strokeStyle = active ? `rgba(144,173,213,${link.strength})` : "rgba(85,99,118,.055)";
      ctx.lineWidth = active ? .65 : .4; ctx.stroke();
    });

    // radial spokes
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2 + .13;
      const r = Math.min(width, height) * .45;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * .69);
      ctx.strokeStyle = "rgba(125,153,191,.09)"; ctx.stroke();
    }

    hovered = null;
    nodes.forEach((node, index) => {
      const p = projected[index];
      const active = selectedPlatform === "ALL" || node.platform === selectedPlatform || node.platform === "ORIGIN";
      const pulse = node.ring === 0 ? 1 + Math.sin(time / 550) * .18 : 1;
      const size = node.size * p.z * pulse;
      const distance = Math.hypot(pointer.x - p.x, pointer.y - p.y);
      if (distance < Math.max(8, size + 5) && active) hovered = { node, p };
      ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = !active ? "rgba(82,93,108,.18)" : node.ring === 0 ? "#78aaff" : `rgba(159,190,231,${.48 + p.z * .28})`;
      if (active) { ctx.shadowColor = node.ring === 0 ? "#5e98ff" : "#78a8e7"; ctx.shadowBlur = node.ring === 0 ? 22 : 7; }
      ctx.fill(); ctx.shadowBlur = 0;
      if (node.ring === 0) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 18 + Math.sin(time / 700) * 2, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(108,161,255,.38)"; ctx.stroke();
      }
    });

    if (hovered) {
      canvas.style.cursor = dragging ? "grabbing" : "crosshair";
      tooltip.classList.add("visible");
      tooltip.style.left = `${Math.min(width - 200, hovered.p.x + 15)}px`;
      tooltip.style.top = `${Math.max(18, hovered.p.y - 32)}px`;
      tooltip.innerHTML = `<strong>${platformNames[hovered.node.platform]}</strong><br>${hovered.node.label}<br><span>${hovered.node.time}</span>`;
    } else {
      canvas.style.cursor = dragging ? "grabbing" : "grab";
      tooltip.classList.remove("visible");
    }
    if (!dragging && !reduceMotion) rotY += .00045;
    requestAnimationFrame(drawNetwork);
  }

  [{ key: "ALL", label: "ALL" }, ...platforms.slice(1).map(key => ({ key, label: key }))].forEach((item, i) => {
    const button = document.createElement("button");
    button.textContent = item.label; button.dataset.platform = item.key;
    if (i === 0) button.classList.add("active");
    button.addEventListener("click", () => {
      selectedPlatform = item.key;
      $$("button", platformRail).forEach(b => b.classList.toggle("active", b === button));
    });
    platformRail.appendChild(button);
  });
  canvas.addEventListener("pointerdown", (event) => { dragging = true; lastPointer = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect(); pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (!dragging || !lastPointer) return;
    rotY += (event.clientX - lastPointer.x) * .006;
    rotX = Math.max(-.8, Math.min(.8, rotX + (event.clientY - lastPointer.y) * .004));
    lastPointer = { x: event.clientX, y: event.clientY };
  });
  const endDrag = () => { dragging = false; lastPointer = null; };
  canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => { pointer = { x: -100, y: -100 }; if (!dragging) endDrag(); });
  buildNetwork(); resizeCanvas(); window.addEventListener("resize", resizeCanvas); requestAnimationFrame(drawNetwork);

  // Lifecycle chart
  const specimens = {
    aura: { name: "Aura Farming", stage: 0, confidence: 87, values: [4,6,7,9,13,18,26,31,39,44,56,63,69,77,83,88,91,93,94,94,95,96] },
    chill: { name: "Chill Guy", stage: 2, confidence: 81, values: [2,3,6,13,29,48,71,89,96,91,84,78,74,72,69,67,64,63,61,58,56,54] },
    moo: { name: "Moo Deng", stage: 3, confidence: 92, values: [3,4,8,16,37,62,87,98,94,91,82,72,61,50,41,35,30,27,23,20,17,14] },
    brat: { name: "Brat Summer", stage: 4, confidence: 95, values: [2,4,9,23,40,57,72,84,93,97,91,86,79,69,58,47,38,30,23,18,13,10] }
  };
  const stages = ["RISING", "PEAKING", "HOLDING", "FADING", "FADED"];
  const chartLine = $("#chartLine"), chartArea = $("#chartArea"), chartEvents = $("#chartEvents"), chartCursor = $("#chartCursor");
  const annotation = $("#chartAnnotation");
  const ns = "http://www.w3.org/2000/svg";

  function smoothPath(points) {
    if (!points.length) return "";
    return points.slice(1).reduce((path, point, i) => {
      const prev = points[i];
      const midX = (prev.x + point.x) / 2;
      return `${path} C ${midX} ${prev.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
    }, `M ${points[0].x} ${points[0].y}`);
  }

  function renderChart(key) {
    const data = specimens[key];
    const points = data.values.map((value, i) => ({ x: i / (data.values.length - 1) * 960, y: 340 - value * 3.2 }));
    const line = smoothPath(points);
    chartLine.setAttribute("d", line);
    chartArea.setAttribute("d", `${line} L 960 360 L 0 360 Z`);
    chartEvents.replaceChildren();
    [4, 9, 14, 18].forEach((index) => {
      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("cx", points[index].x); circle.setAttribute("cy", points[index].y); circle.setAttribute("r", "4"); circle.setAttribute("class", "event-node");
      chartEvents.appendChild(circle);
    });
    const cursorPoint = points[Math.min(points.length - 1, [8, 12, 16, 20, 21][data.stage])];
    chartCursor.setAttribute("x1", cursorPoint.x); chartCursor.setAttribute("x2", cursorPoint.x);
    annotation.style.left = `${Math.min(70, Math.max(15, cursorPoint.x / 9.6 - 8))}%`;
    annotation.style.top = `${Math.max(12, cursorPoint.y / 3.6 - 7)}%`;
    $("#stageLabel").textContent = stages[data.stage];
    $("#stageConfidence").textContent = `${data.confidence}% confidence`;
    $$(".stage-track button").forEach((button, i) => button.classList.toggle("active", i === data.stage));
  }
  $$(".specimen-select button").forEach(button => button.addEventListener("click", () => {
    $$(".specimen-select button").forEach(b => b.classList.toggle("active", b === button));
    renderChart(button.dataset.specimen);
  }));
  $$(".stage-track button").forEach(button => button.addEventListener("click", () => {
    const stage = Number(button.dataset.stage);
    $$(".stage-track button").forEach((b, i) => b.classList.toggle("active", i === stage));
    $("#stageLabel").textContent = stages[stage];
    $("#stageConfidence").textContent = `${[87,84,79,91,96][stage]}% confidence`;
    const x = [34,51,68,84,95][stage] * 9.6;
    chartCursor.setAttribute("x1", x); chartCursor.setAttribute("x2", x);
  }));
  renderChart("aura");

  // Forecast miss mode
  $("#calibrationToggle").addEventListener("click", (event) => {
    const active = event.currentTarget.getAttribute("aria-pressed") !== "true";
    event.currentTarget.setAttribute("aria-pressed", String(active));
    event.currentTarget.classList.toggle("active", active);
    event.currentTarget.textContent = active ? "SHOW ALL" : "SHOW MISSES";
    $("#donut").style.background = active
      ? "conic-gradient(#8f3f4b 0 20%, #d4d1c8 20% 100%)"
      : "conic-gradient(var(--blue) 0 76%, #d4d1c8 76% 100%)";
    $("#donut strong").textContent = active ? "42" : "76";
    const widths = active ? [32, 45, 24, 56] : [82, 71, 88, 64];
    $$(".forecast-bars b").forEach((bar, i) => bar.style.setProperty("--w", `${widths[i]}%`));
    $$(".forecast-bars strong").forEach((label, i) => label.textContent = `${widths[i]}%`);
  });

  // Research log; newest task appears periodically while this section is visible.
  const logData = [
    ["09:42:18", "ORIGIN RESOLUTION", "Aura Farming", "TikTok", "RESOLVED"],
    ["09:41:52", "CROSS-PLATFORM TRACE", "Chicken Jockey", "Reddit", "INDEXED"],
    ["09:41:09", "SEARCH SERIES UPDATE", "Labubu", "Trends", "UPDATED"],
    ["09:39:44", "VARIANT CLUSTERING", "Italian Brainrot", "Instagram", "62 FOUND"],
    ["09:38:17", "FORECAST RESOLUTION", "Chill Guy", "Ledger", "SCORED"],
    ["09:36:05", "ARTICLE DIFF", "Moo Deng", "Wikipedia", "VERIFIED"],
    ["09:34:31", "SOURCE HEALTH CHECK", "Global index", "8 sources", "HEALTHY"]
  ];
  const logRows = $("#logRows");
  function addLog(row, prepend = false) {
    const el = document.createElement("div"); el.className = "log-row";
    el.innerHTML = `<span>${row[0]}</span><strong>${row[1]}</strong><span>${row[2]}</span><em>${row[3]}</em><span class="log-status"><i></i>${row[4]}</span>`;
    prepend ? logRows.prepend(el) : logRows.append(el);
  }
  logData.forEach(row => addLog(row));
  let logTick = 0;
  setInterval(() => {
    if (!document.hidden && $("#ledger").getBoundingClientRect().top < innerHeight && $("#ledger").getBoundingClientRect().bottom > 0) {
      const now = new Date().toISOString().slice(11, 19);
      const tasks = [
        [now, "SIGNAL INGEST", "Emerging cluster", "Bluesky", "INDEXED"],
        [now, "SOURCE COMPARISON", "Aura Farming", "Search", "VERIFIED"],
        [now, "LIFECYCLE UPDATE", "Labubu", "Model", "UPDATED"]
      ];
      addLog(tasks[logTick++ % tasks.length], true);
      if (logRows.children.length > 8) logRows.lastElementChild.remove();
    }
  }, 6200);
})();
