(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  gsap.registerPlugin(ScrollTrigger);

  // Découpe un texte en lettres (spans .ch), en gardant les mots insécables
  function split(el, { srCopy = false } = {}) {
    const text = el.textContent.trim().replace(/\s+/g, " ");
    el.textContent = "";
    const letters = [];
    if (srCopy) {
      const sr = document.createElement("span");
      sr.className = "sr";
      sr.textContent = text;
      el.appendChild(sr);
    }
    text.split(" ").forEach((w, i, words) => {
      const word = document.createElement("span");
      word.className = "word";
      word.setAttribute("aria-hidden", "true");
      for (const c of w) {
        const ch = document.createElement("span");
        ch.className = "ch";
        ch.textContent = c;
        word.appendChild(ch);
        letters.push(ch);
      }
      el.appendChild(word);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
    return letters;
  }

  /* =========================================================
     KINETIC TYPE
     ========================================================= */
  const titleLetters = [...document.querySelectorAll(".k-title .line")].flatMap((l) => split(l));

  // t entre 0 et 1 : 0 = fin et étroit, 1 = gras et large
  const setAxes = (el, t) => {
    el.style.fontVariationSettings = `"wght" ${Math.round(300 + 600 * t)}, "wdth" ${Math.round(70 + 45 * t)}`;
  };

  // Bandeaux : on duplique le contenu pour une boucle sans couture
  const marquees = [...document.querySelectorAll(".k-marq")].map((m) => {
    const track = m.querySelector(".k-track");
    const group = track.querySelector(".k-group");
    // assez de copies pour couvrir deux largeurs d'écran
    const copies = Math.max(2, Math.ceil((innerWidth * 2) / group.offsetWidth) + 1);
    for (let i = 1; i < copies; i++) track.appendChild(group.cloneNode(true));
    const dir = Number(m.dataset.dir);
    const width = group.offsetWidth;
    return { m, track, dir, width };
  });

  if (!reduce) {
    // Entrée : les lettres montent depuis sous la ligne
    gsap.from(titleLetters, { yPercent: 115, duration: 1.1, ease: "expo.out", stagger: 0.035, delay: 0.15 });

    if (finePointer) {
      // Les lettres proches de la souris s'épaississent et s'élargissent
      const mouse = { x: -9999, y: -9999 };
      const state = titleLetters.map((el) => ({ el, t: 0 }));
      addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
      const hero = document.querySelector(".k-hero");
      let heroVisible = true;
      ScrollTrigger.create({ trigger: hero, start: "top bottom", end: "bottom top", onToggle: (s) => (heroVisible = s.isActive) });
      gsap.ticker.add(() => {
        if (!heroVisible) return;
        for (const s of state) {
          const r = s.el.getBoundingClientRect();
          const d = Math.hypot(mouse.x - (r.left + r.width / 2), (mouse.y - (r.top + r.height / 2)) * 0.7);
          const target = Math.max(0, 1 - d / 300);
          s.t += (target - s.t) * 0.14;
          setAxes(s.el, s.t);
        }
      });
    } else {
      // Sans souris (mobile) : une vague parcourt les lettres
      const wave = { p: 0 };
      gsap.to(wave, {
        p: 1, duration: 3, ease: "none", repeat: -1, delay: 1.2,
        onUpdate: () => titleLetters.forEach((el, i) => setAxes(el, (Math.sin(wave.p * Math.PI * 2 - i * 0.55) + 1) / 2)),
      });
    }

    // Bandeaux : défilement continu, accéléré et incliné par la vitesse du scroll
    marquees.forEach((q) => {
      q.tween = gsap.fromTo(q.track, { x: q.dir > 0 ? -q.width : 0 }, {
        x: q.dir > 0 ? 0 : -q.width, duration: q.width / 60, ease: "none", repeat: -1,
      });
      q.skew = gsap.quickTo(q.track, "skewX", { duration: 0.4, ease: "power3" });
    });
    ScrollTrigger.create({
      trigger: ".k", start: "top bottom", end: "bottom top",
      onUpdate(self) {
        const v = self.getVelocity();
        const boost = gsap.utils.clamp(1, 7, 1 + Math.abs(v) / 350) * self.direction;
        marquees.forEach((q) => {
          gsap.timeline({ overwrite: true })
            .to(q.tween, { timeScale: boost, duration: 0.2 })
            .to(q.tween, { timeScale: self.direction, duration: 1.2, ease: "power2.out" });
          q.skew(gsap.utils.clamp(-14, 14, v / -120));
        });
        clearTimeout(this._t);
        this._t = setTimeout(() => marquees.forEach((q) => q.skew(0)), 120);
      },
    });

    // Manifeste : les lettres se remplissent au fil du scroll
    const fillLetters = split(document.querySelector("[data-fill]"), { srCopy: true });
    gsap.set(fillLetters, { opacity: 0.16 });
    gsap.timeline({
      scrollTrigger: { trigger: ".k-manifesto", start: "top top", end: "+=130%", pin: true, scrub: 0.6 },
    }).to(fillLetters, { opacity: 1, stagger: 0.02, ease: "none" });
  } else {
    marquees.forEach((q) => gsap.set(q.track, { x: -q.width / 3 }));
  }

  /* =========================================================
     LIQUID MORPH
     ========================================================= */
  const N = 8;

  // Forme molle : N points autour d'un centre, reliés par une courbe lisse
  function makeBlob(svg, R = 230) {
    const path = svg.querySelector("path");
    const s = {};
    for (let i = 0; i < N; i++) { s["b" + i] = 1; s["w" + i] = 0; }
    const draw = () => {
      const pts = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2;
        const r = R * (s["b" + i] + s["w" + i]);
        pts.push([300 + Math.cos(a) * r, 300 + Math.sin(a) * r]);
      }
      let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
      for (let i = 0; i < N; i++) {
        const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
      }
      path.setAttribute("d", d);
    };
    const wobble = (amount = 0.12) => {
      for (let i = 0; i < N; i++) {
        gsap.fromTo(s, { ["w" + i]: -amount * Math.random() }, {
          ["w" + i]: amount * Math.random(),
          duration: gsap.utils.random(1.4, 2.8), ease: "sine.inOut", repeat: -1, yoyo: true,
        });
      }
      gsap.ticker.add(draw);
    };
    draw();
    return { s, path, draw, wobble };
  }

  const heroBlob = makeBlob(document.querySelector(".l-blob--hero"));
  const flavorBlob = makeBlob(document.querySelector(".l-blob--flavor"), 210);

  const shapes = [
    [1, 0.9, 1.05, 0.95, 1, 0.92, 1.04, 0.94],      // framboise : ronde
    [1.18, 0.72, 1.1, 0.7, 1.16, 0.74, 1.08, 0.72], // pistache : fleur à 4 pétales
    [0.84, 1.12, 0.82, 1.15, 0.86, 1.1, 0.84, 1.14], // mangue : tournée
  ];
  const flavors = [
    { color: "#e8326d", bg: "#ffe1e8" },
    { color: "#7fb83e", bg: "#eef5d6" },
    { color: "#ffa51f", bg: "#fff0c9" },
  ];
  const shapeVars = (arr) => Object.fromEntries(arr.map((v, i) => ["b" + i, v]));
  Object.assign(flavorBlob.s, shapeVars(shapes[0]));
  flavorBlob.draw();

  if (!reduce) {
    heroBlob.wobble(0.13);
    flavorBlob.wobble(0.07);

    // Gouttes collantes qui suivent la souris (ou se promènent sur mobile)
    const hero = document.querySelector(".l-hero");
    const drops = [...document.querySelectorAll(".drop")];
    const wander = (el) => {
      const w = hero.clientWidth, h = hero.clientHeight;
      gsap.to(el, {
        x: gsap.utils.random(w * 0.4, w * 0.75), y: gsap.utils.random(h * 0.15, h * 0.9),
        duration: gsap.utils.random(2.5, 4.5), ease: "sine.inOut", onComplete: () => wander(el),
      });
    };
    drops.forEach((el) => {
      gsap.set(el, { x: hero.clientWidth * 0.75, y: hero.clientHeight * 0.5 });
      wander(el);
    });

    if (finePointer) {
      // Position recalculée à chaque image, pour rester juste pendant le scroll
      let followers = null;
      const pointer = { x: 0, y: 0 };
      hero.addEventListener("pointermove", (e) => {
        pointer.x = e.clientX; pointer.y = e.clientY;
        if (followers) return;
        drops.forEach((el) => gsap.killTweensOf(el));
        followers = drops.map((el, i) => ({
          x: gsap.quickTo(el, "x", { duration: 0.25 + i * 0.09, ease: "power3" }),
          y: gsap.quickTo(el, "y", { duration: 0.25 + i * 0.09, ease: "power3" }),
        }));
      });
      gsap.ticker.add(() => {
        if (!followers) return;
        const r = hero.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        const x = gsap.utils.clamp(0, r.width, pointer.x - r.left);
        const y = gsap.utils.clamp(0, r.height, pointer.y - r.top);
        followers.forEach((f) => { f.x(x); f.y(y); });
      });
    }

    // Parfums : la forme et la couleur changent au scroll
    const items = [...document.querySelectorAll(".flavor")];
    const tl = gsap.timeline({
      defaults: { ease: "power2.inOut" },
      scrollTrigger: { trigger: ".l-flavors", start: "top top", end: "+=220%", pin: true, scrub: 0.8 },
    });
    for (let i = 1; i < flavors.length; i++) {
      const at = i - 1 + 0.3;
      tl.to(items[i - 1], { opacity: 0, y: -40, duration: 0.3 }, at)
        .to(flavorBlob.s, { ...shapeVars(shapes[i]), duration: 0.6 }, at)
        .to(flavorBlob.path, { fill: flavors[i].color, duration: 0.6 }, at)
        .to(".l", { backgroundColor: flavors[i].bg, duration: 0.6 }, at)
        .fromTo(items[i], { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.3 }, at + 0.3);
    }
    tl.to({}, { duration: 0.3 }); // petite pause sur le dernier parfum
  }
})();
