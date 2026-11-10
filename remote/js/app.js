(() => {
  const T = window.TOUR;
  const $ = (id) => document.getElementById(id);

  // ---------- 印章存檔（失敗也不影響使用） ----------
  const STAMP_KEY = "templego-stamps";
  const loadStamps = () => {
    try { return JSON.parse(localStorage.getItem(STAMP_KEY)) || []; } catch { return []; }
  };
  const saveStamp = (id) => {
    const s = new Set(loadStamps()); s.add(id);
    try { localStorage.setItem(STAMP_KEY, JSON.stringify([...s])); } catch {}
    return s.size;
  };

  // ---------- 狀態 ----------
  let stopIndex = 0;
  let step = 0;
  let typing = null;
  let lineFull = "";
  let mode = "talk";          // talk | quiz | explore | busy
  let seen = new Set();

  const stop = () => T.stops[stopIndex];
  const line = () => stop().script[step];
  const fill = (s) => s.replaceAll("{name}", T.guide.name).replaceAll("{lunarHint}", lunarHint);

  // ---------- 動畫工具 ----------
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // 換志永哥的動作：先預載，淡出 → 換圖 → 淡入，不會瞬間跳圖
  function swapImg(el, src) {
    if (!el || !src || el.getAttribute("src") === src) return;
    const token = (el._swap = (el._swap || 0) + 1);
    const pre = new Image(); pre.src = src;
    el.classList.add("swap");
    const go = () => {
      if (token !== el._swap) return;
      el.src = src;
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("swap")));
    };
    setTimeout(() => (pre.complete ? go() : (pre.onload = pre.onerror = go)), reduceMotion ? 0 : 140);
  }
  // 打字機：逐字出現，遇到標點停頓一下；說話時志永哥跟著輕輕擺動
  function typeText(el, text, guide, onDone) {
    clearTimeout(el._type);
    el.textContent = "";
    el.classList.add("typing");
    guide?.classList.add("talking");
    const chars = [...text];
    let i = 0;
    const end = () => {
      clearTimeout(el._type); el._type = null; el._finish = null;
      el.textContent = text; el.classList.remove("typing");
      guide?.classList.remove("talking");
      onDone?.();
    };
    el._finish = end;
    if (reduceMotion) return end();
    const tick = () => {
      el.textContent = chars.slice(0, ++i).join("");
      if (i >= chars.length) return end();
      const c = chars[i - 1];
      el._type = setTimeout(tick, "。！？：".includes(c) ? 260 : "，、；".includes(c) ? 140 : 32);
    };
    tick();
  }
  // 小光點綻開（找到熱點、答對）
  function burst(el) {
    if (!el || reduceMotion) return;
    const b = document.createElement("span");
    b.className = "burst";
    el.appendChild(b);
    setTimeout(() => b.remove(), 900);
  }

  // ---------- 農曆犒將日提示（瀏覽器不支援農曆時改用通用說法） ----------
  function lunarHint() {
    const fallback = "每月農曆初二、十六下午三點到五點來，就有機會看到犒將喔！";
    try {
      const parts = new Intl.DateTimeFormat("zh-TW-u-ca-chinese", { month: "long", day: "numeric" })
        .formatToParts(new Date());
      const month = parts.find((p) => p.type === "month")?.value;
      const day = Number(parts.find((p) => p.type === "day")?.value);
      if (!month || !(day >= 1 && day <= 30)) return fallback;
      const n = "一二三四五六七八九十";
      const dayName = day <= 10 ? "初" + n[day - 1]
        : day < 20 ? "十" + n[day - 11]
        : day === 20 ? "二十"
        : day < 30 ? "廿" + n[day - 21] : "三十";
      const today = `今天是農曆${month}${dayName}`;
      if (day === 2 || day === 16) return `${today}，剛好就是犒將日！下午三點到五點來，就有機會看到。`;
      const next = day < 2 ? "這個月初二" : day < 16 ? "這個月十六" : "下個月初二";
      return `${today}，下一次犒將是${next}下午，有空可以再來看看！`;
    } catch {
      return fallback;
    }
  }

  // ---------- 開場 ----------
  $("templeName").textContent = T.temple.name;
  $("templeSub").textContent = T.temple.subtitle;
  T.guide.poses = T.guide.styles[T.guide.style] || T.guide.styles.q;
  $("introGuide").src = T.guide.poses.intro || T.guide.poses.default;
  $("speaker").textContent = T.guide.name;
  $("guideImg").src = T.guide.poses.default;
  $("guideImg").alt = T.guide.name;

  const show = (id) => {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  };

  $("startBtn").onclick = showOverview;
  $("mapHomeBtn").onclick = showOverview;
  $("ovHomeBtn").onclick = () => show("intro");
  $("homeBtn").onclick = () => { finishTyping(); stopVoice(); destroyPano(); showMap(); };
  $("replayBtn").onclick = () => startStop(stopIndex);
  $("toMapBtn").onclick = showMap;

  // ---------- 照片與資料來源 ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function renderCredits() {
    const lic = T.photoLicense;
    const all = Object.values(T.photos || {});
    const own = all.filter((p) => p.own).map((p) => esc(p.title)).join("、");
    const photos = all.filter((p) => !p.own).map((p) =>
      `<li>${esc(p.title)}：${esc(p.author)}／<a href="${esc(p.page)}" target="_blank" rel="noopener">Wikimedia Commons</a>${p.license ? `（${esc(p.license)}）` : ""}（${esc(p.edit)}）</li>`).join("");
    $("creditsList").innerHTML = `
      <p class="note">以下照片依 <a href="${lic.url}" target="_blank" rel="noopener">${lic.name}</a> 授權使用；經縮放、裁切後的版本同樣以 ${lic.name} 釋出。</p>
      <ul>${photos}</ul>
      ${own ? `<p class="note">${own}：本團隊 2026 年 11 月實地拍攝，路人臉部與車牌已模糊處理。</p>` : ""}
      <p class="note">插畫、鳥瞰圖、正殿環景為本團隊繪製的示意圖，非實際比例。</p>
      <p class="note">導覽內容參考：邱民雄〈大茅埔泰興宮三山國王〉、徐登志〈犒將〉（教育部臺灣客語辭典）、《茅埔成庄》（臺中市文化局）、農業部〈我的幸福小地方〉、維基百科〈慶東泰興宮〉、東勢後生添手團〈泰興宮裝置藝術調查〉。</p>`;
  }
  $("creditsBtn").onclick = () => { renderCredits(); $("creditsSheet").hidden = false; };
  $("creditsClose").onclick = () => ($("creditsSheet").hidden = true);

  // ---------- 大茅埔總覽圖 ----------
  const OV = T.overview;
  $("ovImg").src = OV.image;
  $("ovWrap").style.setProperty("--ov-aspect", OV.aspect);
  $("ovGuideImg").src = T.guide.poses.point || T.guide.poses.default;
  $("ovSpeaker").textContent = T.guide.name;
  $("ovLine").textContent = fill(OV.say);
  {
    const t = document.createElement("button");
    t.className = "ov-temple";
    t.style.left = OV.temple.x + "%"; t.style.top = OV.temple.y + "%";
    t.textContent = OV.temple.label;
    t.onclick = showMap;
    $("ovWrap").appendChild(t);
    OV.camps.forEach((c) => {
      const b = document.createElement("button");
      b.className = "ov-camp";
      b.style.left = c.x + "%"; b.style.top = c.y + "%";
      b.setAttribute("aria-label", c.name);
      b.onclick = () => {
        $("campTitle").textContent = c.name;
        $("campDesc").textContent = c.desc || OV.campDesc;
        $("campSheet").hidden = false;
      };
      $("ovWrap").appendChild(b);
    });
  }
  $("campClose").onclick = () => ($("campSheet").hidden = true);

  let ovCentered = false;
  function showOverview() {
    show("overview");
    $("campSheet").hidden = true;
    typeText($("ovLine"), fill(OV.say), $("ovGuideImg"));
    if (ovCentered) return;
    const center = () => {
      const a = $("ovArea"), w = $("ovWrap").offsetWidth;
      if (!w) return;
      a.scrollLeft = Math.max(0, w * OV.focus / 100 - a.clientWidth / 2);
      ovCentered = true;
    };
    requestAnimationFrame(center);
    $("ovImg").addEventListener("load", center, { once: true });
  }

  // ---------- 鳥瞰地圖 ----------
  $("mapImg").src = T.map.image;
  $("mapWrap").style.setProperty("--map-aspect", T.map.aspect);
  $("mapGuideImg").src = T.guide.poses.default;
  $("mapSpeaker").textContent = T.guide.name;
  $("mapLine").textContent = fill(T.map.say);

  let pinStop = null;

  function showMap() {
    show("map");
    $("pinSheet").hidden = true;
    const done = new Set(loadStamps());
    const ready = T.stops.filter((s) => s.ready);
    const got = ready.filter((s) => done.has(s.id)).length;
    $("mapStamps").textContent = got === ready.length ? "🏅 完成卡" : `印章 ${got} / ${ready.length} ›`;
    $("mapStamps").classList.toggle("complete", got === ready.length);
    typeText($("mapLine"), fill(got === ready.length && T.map.doneSay ? T.map.doneSay : T.map.say), $("mapGuideImg"));
    $("mapWrap").querySelectorAll(".pin, .route").forEach((p) => p.remove());
    // 建議路線：依站號連起來，兩端都走過的段落變紅色
    const pins = T.stops.filter((s) => s.pin).sort((a, b) => a.pin.n - b.pin.n);
    const route = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    route.setAttribute("class", "route");
    route.setAttribute("viewBox", "0 0 100 100");
    route.setAttribute("preserveAspectRatio", "none");
    route.setAttribute("aria-hidden", "true");
    route.innerHTML = pins.slice(1).map((s, k) => {
      const a = pins[k].pin, b = s.pin, w = done.has(pins[k].id) && done.has(s.id);
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${w ? "walked" : ""}" style="--d:${(0.2 + k * 0.12).toFixed(2)}s"/>`;
    }).join("");
    $("mapWrap").appendChild(route);
    T.stops.forEach((s, i) => {
      if (!s.pin) return;
      const b = document.createElement("button");
      const state = done.has(s.id) ? "done" : s.ready ? "ready" : "soon";
      b.className = `pin ${state}`;
      b.style.setProperty("--d", `${(s.pin.n - 1) * 0.08}s`);
      b.style.left = s.pin.x + "%";
      b.style.top = s.pin.y + "%";
      b.innerHTML = `<span class="dot">${state === "done" ? "✓" : s.pin.n}</span><span class="tag">${s.title}</span>`;
      b.onclick = () => openPin(i);
      $("mapWrap").appendChild(b);
    });
  }

  function openPin(i) {
    const s = T.stops[i];
    pinStop = i;
    $("pinNo").textContent = s.pin.n;
    $("pinTitle").textContent = s.title;
    $("pinIntro").textContent = s.intro || "";
    // 縮圖用這一站一開始看到的畫面（環景或實景照片）
    const thumb = (s.script[0]?.scene === "pano" && (s.script[0].pano || s.pano)) || s.script.find((l) => l.image && T.photos?.[l.image])?.image
      || (T.photos?.[s.image] ? s.image : null) || s.pano || s.image;
    $("pinThumb").style.backgroundImage = thumb ? `url("${thumb}")` : "";
    $("pinThumb").hidden = !thumb;
    const n = (t) => s.script.filter((l) => l.type === t).length;
    const chips = [
      n("explore") && `🔍 找細節 ${n("explore")} 次`,
      (n("choice") + n("quiz")) && `❓ 問答 ${n("choice") + n("quiz")} 題`,
      n("lookup") && `👀 抬頭看 ${n("lookup")} 次`,
      (s.pano || s.script.some((l) => l.scene === "pano")) && "🔄 可轉動環景",
      `⏱ 約 ${Math.max(2, Math.round(s.script.length * 0.3))} 分鐘`,
    ].filter(Boolean);
    $("pinMeta").innerHTML = chips.map((c) => `<span>${c}</span>`).join("");
    const done = loadStamps().includes(s.id);
    $("pinGo").disabled = !s.ready;
    $("pinGo").textContent = !s.ready ? "製作中，敬請期待" : done ? "再看一次" : "進入導覽";
    $("pinSheet").hidden = false;
  }
  $("pinGo").onclick = () => { if (T.stops[pinStop].ready) startStop(pinStop); };
  $("pinClose").onclick = () => ($("pinSheet").hidden = true);

  // ---------- 導覽點 ----------
  function startStop(i) {
    stopIndex = i; step = 0; seen = new Set();
    stopVoice();
    const s = stop();
    show("stop");
    $("stopTitle").textContent = s.title;
    $("progress").textContent = s.pin ? `第 ${s.pin.n} 站` : "";
    ["stampLayer", "lookup", "sheet", "counter", "choice"].forEach((id) => ($(id).hidden = true));
    clearHotspots();
    destroyPano();
    currentImage = null;
    // 第一句有指定 image（例如先看實景照片）就直接開那張，不會先閃過長卷
    // 第一句是 scene: "pano" 的站（例如先看中庭環景），直接開環景
    const first = s.script[0]?.scene === "pano" && (s.script[0].pano || s.pano) ? null : s.script[0]?.image || s.image;
    if (first) {
      showImage(first, () => playStep());
    } else {
      setScene("pano", s.script[0]?.focus, s.script[0]);
      playStep();
    }
  }

  // ---------- 切換圖片（長卷、照片） ----------
  // step 加 image: "路徑" 可在同一站換成另一張圖；照片會自動顯示來源標示
  let currentImage = null;
  function showImage(src, onReady) {
    const img = $("sceneImg");
    const meta = T.photos?.[src];
    const vertical = meta?.fit === "width";
    currentImage = src;
    scene.classList.toggle("vertical", vertical);
    setScene("image");
    $("sceneHint").textContent = vertical ? "↑ 上下滑動看看 ↓" : "← 左右滑動看看 →";
    showCredit(meta);
    const inner = $("sceneInner");
    const done = () => {
      scene.scrollLeft = 0; scene.scrollTop = 0; inner.classList.remove("fading");
      if (!reduceMotion) { inner.classList.remove("enter"); void inner.offsetWidth; inner.classList.add("enter"); }
      onReady?.();
    };
    if (img.getAttribute("src") === src && img.complete) return done();
    ghostScene();
    img.onload = done;
    img.onerror = done;
    img.alt = meta?.title || stop().title;
    img.src = src;
  }

  // 把目前畫面複製一份蓋在上面再淡出，做成交叉淡化
  function ghostScene() {
    const inner = $("sceneInner");
    if (reduceMotion || inner.hidden || !$("sceneImg").getAttribute("src")) return;
    document.querySelectorAll(".scene-ghost").forEach((g) => g.remove());
    const g = document.createElement("div");
    g.className = "scene-ghost";
    g.classList.toggle("vertical", scene.classList.contains("vertical"));
    const clone = inner.cloneNode(true);
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    clone.querySelectorAll(".hotspot").forEach((e) => e.remove());
    clone.classList.remove("enter", "fading");
    g.appendChild(clone);
    scene.parentNode.insertBefore(g, scene.nextSibling);
    g.scrollLeft = scene.scrollLeft; g.scrollTop = scene.scrollTop;
    requestAnimationFrame(() => requestAnimationFrame(() => g.classList.add("out")));
    setTimeout(() => g.remove(), 800);
  }

  function showCredit(meta) {
    const el = $("credit");
    if (!meta) { el.hidden = true; return; }
    if (meta.own) {
      el.removeAttribute("href");
      el.textContent = "照片：團隊實地拍攝";
    } else {
      el.href = meta.page;
      el.textContent = `照片：${meta.author}／Wikimedia Commons／${meta.license || T.photoLicense.name}`;
    }
    el.hidden = false;
  }

  function playStep() {
    const l = line();
    if (!l) return finishStop();
    setPose(l.pose);
    if (l.image && (l.image !== currentImage || sceneMode !== "image")) {
      clearHotspots();
      // 換圖要等圖片載入後，才能捲到 focus 的位置、放熱點
      return showImage(l.image, () => runStep(l, true));
    }
    runStep(l, false);
  }

  function runStep(l, imageJustChanged) {
    if (l.scene && (l.scene !== sceneMode || (l.scene === "pano" && (l.pano || stop().pano) !== viewerSrc))) {
      clearHotspots();
      showCredit(null);
      setScene(l.scene, l.focus, l);
    } else if (l.focus != null) {
      typeof l.focus === "object" ? panoLook(l.focus) : focusOn(l.focus, imageJustChanged);
    }

    mode = "talk";
    if (l.type === "quiz") {
      mode = "quiz";
      renderHotspots(stop().hotspots.filter((h) => l.choices.includes(h.id)), "?");
    } else if (l.type === "explore") {
      mode = "explore";
      renderHotspots(exploreTargets(), "");
      updateCounter();
    } else if (l.type === "choice") {
      mode = "choice";
      renderChoice(l);
    } else if (l.type === "lookup") {
      mode = "busy";
      $("lookupText").textContent = fill(l.say);
      $("lookup").hidden = false;
    }
    say(fill(l.say), l);
  }

  function next() {
    if (typing) return finishTyping();
    if (mode !== "talk") return;
    step++;
    playStep();
  }
  $("guidePanel").onclick = next;

  // ---------- 對話打字效果 ----------
  // media：{ video, audio }，有的話志永哥會真的講出這句
  function say(text, media) {
    lineFull = text;
    $("bubble").classList.toggle("waiting", mode !== "talk");
    $("bubble").classList.remove("pop"); void $("bubble").offsetWidth; $("bubble").classList.add("pop");
    typing = true;
    typeText($("line"), text, $("guideImg"), () => { typing = null; });
    voiceFor(media);
  }

  // ---------- 虛擬志永哥（AI 講話影片／錄音） ----------
  // 有 video：播 AI 講話影片（透明背景，聲音在裡面），講完回到待機
  // 只有 audio：照片 + 聲音
  // T.guide.idle：沒講話時循環的待機影片；沒有就顯示動作照片
  const gv = $("guideVideo");
  const voice = new Audio();
  const SOUND_KEY = "templego-sound";
  let soundOn = (() => { try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; } })();

  function showVideo(src, { loop, withSound }) {
    $("guideImg").hidden = true;
    gv.hidden = false;
    if (gv.getAttribute("src") !== src) gv.src = src;
    gv.loop = loop;
    gv.muted = !withSound || !soundOn;
    try { gv.currentTime = 0; } catch {}
    gv.play().catch(() => { gv.muted = true; gv.play().catch(() => {}); });
  }
  function showIdle() {
    gv.onended = null;
    if (T.guide.idle) return showVideo(T.guide.idle, { loop: true, withSound: false });
    gv.pause();
    gv.hidden = true;
    $("guideImg").hidden = false;
  }
  function stopVoice() {
    voice.pause();
    voice.removeAttribute("src");
    if (!gv.hidden && !gv.loop) showIdle();
  }
  function voiceFor(m) {
    stopVoice();
    if (!m) return;
    if (m.video) {
      showVideo(m.video, { loop: false, withSound: true });
      gv.onended = showIdle;
    } else if (m.audio && soundOn) {
      voice.src = m.audio;
      voice.play().catch(() => {});
    }
  }
  // 聲音開關（放在志永哥的對話區右上角，設定會記住）
  const soundBtn = document.createElement("button");
  soundBtn.className = "sound-btn";
  const renderSound = () => (soundBtn.textContent = soundOn ? "聲音：開" : "聲音：關");
  soundBtn.onclick = (e) => {
    e.stopPropagation();
    soundOn = !soundOn;
    try { localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off"); } catch {}
    renderSound();
    voice.muted = !soundOn;
    if (!gv.loop) gv.muted = !soundOn;
  };
  renderSound();
  $("guidePanel").appendChild(soundBtn);
  showIdle();
  function finishTyping() {
    $("line")._finish?.();
    typing = null;
  }

  function setPose(pose) {
    swapImg($("guideImg"), T.guide.poses[pose] || T.guide.poses.default);
  }
  function cheer() {
    $("guideImg").classList.remove("hop");
    void $("guideImg").offsetWidth;
    $("guideImg").classList.add("hop");
    gv.classList.remove("hop"); void gv.offsetWidth; gv.classList.add("hop");
  }

  // ---------- 場景捲動 ----------
  const scene = $("scene");
  // 橫式圖：pct 是水平位置；直式照片（上下滑動）：pct 是垂直位置
  function focusOn(pct, instant) {
    gyroPause(800);
    const behavior = instant ? "auto" : "smooth";
    if (scene.classList.contains("vertical")) {
      const h = $("sceneInner").scrollHeight;
      scene.scrollTo({ top: h * pct / 100 - scene.clientHeight / 2, behavior });
      return;
    }
    const w = $("sceneInner").scrollWidth;
    scene.scrollTo({ left: w * pct / 100 - scene.clientWidth / 2, behavior });
  }
  scene.addEventListener("scroll", () => $("sceneHint").classList.add("gone"), { passive: true });

  // ---------- 轉動手機看（陀螺儀） ----------
  // 以開啟當下的方向為基準：往右轉 → 畫面往右；轉約 ±45° 就能看到長卷兩端
  const gyro = { on: false, got: false, a0: null, base: 0, target: 0, pauseUntil: 0, raf: 0 };
  const DEG_RANGE = 90;

  function toast(msg, ms = 2600) {
    $("toast").textContent = msg;
    $("toast").hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => ($("toast").hidden = true), ms);
  }

  function gyroPause(ms) {
    gyro.pauseUntil = performance.now() + ms;
    gyro.a0 = null; // 暫停結束後，從當時的位置重新對準
  }

  function onOrientation(e) {
    if (e.alpha == null) return;
    gyro.got = true;
    if (!gyro.on || performance.now() < gyro.pauseUntil) return;
    if (gyro.a0 === null) { gyro.a0 = e.alpha; gyro.base = scene.scrollLeft; }
    const turnedLeft = ((e.alpha - gyro.a0 + 540) % 360) - 180; // alpha 往左轉會變大
    const range = scene.scrollWidth - scene.clientWidth;
    gyro.target = Math.max(0, Math.min(range, gyro.base - turnedLeft * range / DEG_RANGE));
  }

  function gyroLoop() {
    if (!gyro.on) return;
    if (sceneMode === "image" && !scene.classList.contains("vertical") && gyro.a0 !== null && performance.now() >= gyro.pauseUntil) {
      const cur = scene.scrollLeft;
      const next = cur + (gyro.target - cur) * 0.18;
      if (Math.abs(gyro.target - cur) > 0.5) scene.scrollLeft = next;
    }
    gyro.raf = requestAnimationFrame(gyroLoop);
  }

  async function setGyro(on) {
    if (on) {
      const DOE = window.DeviceOrientationEvent;
      if (!DOE) return toast("這台裝置不支援轉動感測，請用手指滑動");
      if (typeof DOE.requestPermission === "function") {
        try {
          if ((await DOE.requestPermission()) !== "granted") return toast("需要允許「動作與方向」才能轉動手機看");
        } catch { return toast("需要允許「動作與方向」才能轉動手機看"); }
      }
      window.addEventListener("deviceorientation", onOrientation);
      gyro.on = true; gyro.a0 = null; gyro.pauseUntil = 0;
      cancelAnimationFrame(gyro.raf); gyroLoop();
      toast("舉起手機，原地慢慢左右轉身看看！");
      setTimeout(() => {
        if (gyro.on && !gyro.got) { setGyro(false); toast("偵測不到手機轉動，請用手指滑動"); }
      }, 1500);
    } else {
      gyro.on = false;
      window.removeEventListener("deviceorientation", onOrientation);
      cancelAnimationFrame(gyro.raf);
    }
    $("gyroBtn").setAttribute("aria-pressed", String(gyro.on));
    renderGyroBtn();
    onGyroChange?.(gyro.on);
  }
  let onGyroChange = null;
  const PHONE_ICON = '<svg width="12" height="16" viewBox="0 0 12 16" aria-hidden="true"><rect x="1" y="1" width="10" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="6" cy="12.3" r="1" fill="currentColor"/></svg>';
  function renderGyroBtn() {
    $("gyroBtn").innerHTML = PHONE_ICON + (gyro.on ? "轉動中・點此關閉" : "轉動手機看");
  }
  renderGyroBtn();
  $("gyroBtn").onclick = () => setGyro(!gyro.on);
  // 手指滑動時暫停感測，放開後從新位置接續
  scene.addEventListener("touchstart", () => gyroPause(1e9), { passive: true });
  scene.addEventListener("touchend", () => gyroPause(150), { passive: true });

  // ---------- 360° 環景（Pannellum） ----------
  // 有 yaw / pitch 的熱點屬於環景；step 加 scene: "pano" 或 "image" 可在同一站切換場景
  let sceneMode = "image";
  let viewer = null;
  let panoDivs = {};

  // step 可以加 pano / panoView，在同一站換另一張環景；沒寫就用這一站的 pano
  let viewerSrc = null;
  function setScene(mode, focus, l) {
    sceneMode = mode;
    const panoSrc = l?.pano || stop().pano;
    const pv = l?.pano ? l.panoView : stop().panoView;
    const pano = mode === "pano";
    scene.classList.toggle("pano-mode", pano);
    // 照片與環景滿版（標題列浮在上面）；插畫長卷的標題在圖上，標題列改回一般位置
    $("stop").classList.toggle("immersive", pano || !!T.photos?.[currentImage]);
    if (pano) { scene.classList.remove("vertical"); showCredit(T.photos?.[panoSrc]); }
    if (pano && !$("sceneInner").hidden) ghostScene();
    $("sceneInner").hidden = pano;
    $("pano").hidden = !pano;
    $("sceneHint").textContent = pano ? "拖曳畫面，或轉動手機看四周" : "← 左右滑動看看 →";
    $("sceneHint").classList.remove("gone");
    if (!pano) return;
    scene.scrollLeft = 0;
    const f = typeof focus === "object" && focus ? focus : { yaw: 0, pitch: 0 };
    if (viewer && viewerSrc === panoSrc) return panoLook(f);
    if (viewer) destroyPano();
    if (!window.pannellum) { toast("環景元件載入失敗，請確認網路連線"); return; }
    // 半圈環景（手機全景模式拍的）：panoView 設定水平 / 垂直涵蓋角度，畫面不會轉出照片外
    let fov = { hfov: 100, minHfov: 50, maxHfov: 115 };
    if (pv) {
      // 直式螢幕的上下視角比左右大，依螢幕比例算出不會露出照片上下邊界的最大左右視角
      const el = $("pano"), ar = (el.clientHeight || 600) / (el.clientWidth || 390);
      const rad = Math.PI / 180;
      const fit = 2 * Math.atan(Math.tan((pv.vaov / 2) * rad) / ar) / rad * 0.96;
      const h = Math.min(100, fit);
      fov = { hfov: h, minHfov: Math.min(30, h), maxHfov: h };
    }
    viewer = pannellum.viewer("pano", {
      type: "equirectangular",
      panorama: panoSrc,
      autoLoad: true,
      showControls: false,
      compass: false,
      ...fov,
      // 不用 avoidShowingBackground（Pannellum 2.5.6 搭配半圈環景會算出 NaN、畫面變黑），改用明確的上下左右邊界
      ...(pv ? { haov: pv.haov, vaov: pv.vaov, vOffset: pv.vOffset || 0,
        minYaw: -pv.haov / 2, maxYaw: pv.haov / 2, minPitch: -pv.vaov / 2, maxPitch: pv.vaov / 2 } : {}),
      yaw: f.yaw, pitch: f.pitch,
      hotSpots: [],
    });
    viewerSrc = panoSrc;
    viewer.on("load", () => { if (gyro.on) viewer.startOrientation(); });
    const hideHint = () => $("sceneHint").classList.add("gone");
    viewer.on("mousedown", hideHint);
    viewer.on("touchstart", hideHint);
    // 手指拖曳會中斷轉動感測，放開後自動接續
    const resume = () => { if (gyro.on) setTimeout(() => viewer?.startOrientation(), 300); };
    viewer.on("mouseup", resume);
    viewer.on("touchend", resume);
  }

  function panoLook(f) {
    if (!viewer) return;
    try { viewer.lookAt(f.pitch ?? 0, f.yaw ?? 0, viewer.getHfov(), 900); } catch {}
  }

  function destroyPano() {
    panoDivs = {};
    viewerSrc = null;
    if (viewer) { try { viewer.destroy(); } catch {} viewer = null; }
    $("pano").innerHTML = "";
  }

  onGyroChange = (on) => {
    if (!viewer || sceneMode !== "pano") return;
    try { on ? viewer.startOrientation() : viewer.stopOrientation(); } catch {}
  };

  // ---------- 熱點 ----------
  function clearHotspots() {
    $("sceneInner").querySelectorAll(".hotspot").forEach((h) => h.remove());
    if (viewer) Object.keys(panoDivs).forEach((id) => { try { viewer.removeHotSpot(id); } catch {} });
    panoDivs = {};
  }
  function renderHotspots(list, label) {
    clearHotspots();
    for (const h of list) {
      if (h.yaw != null) {
        if (!viewer) continue;
        viewer.addHotSpot({
          id: h.id, pitch: h.pitch, yaw: h.yaw,
          cssClass: "hotspot pano-hs" + (mode === "explore" && seen.has(h.id) ? " seen" : ""),
          createTooltipFunc: (div) => {
            div.innerHTML = `<span>${label}</span>`;
            div.setAttribute("aria-label", h.title);
            div.setAttribute("role", "button");
            panoDivs[h.id] = div;
          },
          clickHandlerFunc: (e) => { e.stopPropagation(); onHotspot(h, panoDivs[h.id]); },
        });
        continue;
      }
      // 只放屬於目前這張圖的熱點（沒寫 img 的熱點屬於這一站的主圖）
      if ((h.img || stop().image) !== currentImage) continue;
      const b = document.createElement("button");
      b.className = "hotspot" + (mode === "explore" && seen.has(h.id) ? " seen" : "");
      b.style.left = h.x + "%";
      b.style.top = h.y + "%";
      b.setAttribute("aria-label", h.title);
      b.innerHTML = `<span>${label}</span>`;
      b.onclick = (e) => { e.stopPropagation(); onHotspot(h, b); };
      $("sceneInner").appendChild(b);
    }
  }

  function onHotspot(h, el) {
    const l = line();
    if (mode === "quiz") {
      if (h.id === l.answer) {
        el.classList.add("right");
        burst(el);
        mode = "talk";
        cheer();
        say(fill(l.right), { video: l.rightVideo, audio: l.rightAudio });
        openSheet(h);
        setTimeout(clearHotspots, 600);
      } else {
        el.classList.remove("wrong"); void el.offsetWidth; el.classList.add("wrong");
        say(fill(l.wrong), { video: l.wrongVideo, audio: l.wrongAudio });
        $("bubble").classList.add("waiting");
      }
    } else if (mode === "explore") {
      seen.add(h.id);
      el.classList.add("seen");
      burst(el);
      openSheet(h);
      updateCounter();
    }
  }

  // 找細節：有寫 targets 就只用那幾個熱點，否則用所有 explore: true 的熱點
  function exploreTargets() {
    const t = line().targets;
    return t ? stop().hotspots.filter((h) => t.includes(h.id))
             : stop().hotspots.filter((h) => h.explore);
  }

  // ---------- 選擇題 ----------
  function renderChoice(l) {
    const box = $("choice");
    box.innerHTML = "";
    l.options.forEach((text, i) => {
      const b = document.createElement("button");
      b.textContent = text;
      b.onclick = () => {
        if (mode !== "choice") return;
        if (i === l.answer) {
          b.classList.add("right");
          burst(b);
          mode = "talk";
          cheer();
          say(fill(l.right), { video: l.rightVideo, audio: l.rightAudio });
          setTimeout(() => (box.hidden = true), 700);
        } else {
          b.classList.remove("wrong"); void b.offsetWidth; b.classList.add("wrong");
          say(fill(l.wrong), { video: l.wrongVideo, audio: l.wrongAudio });
        }
      };
      box.appendChild(b);
    });
    box.hidden = false;
  }

  function updateCounter() {
    const need = exploreTargets();
    const got = need.filter((h) => seen.has(h.id)).length;
    $("sceneHint").classList.add("gone");
    $("counter").hidden = false;
    $("counter").textContent = `已發現 ${got} / ${need.length}`;
    if (got === need.length) {
      $("counter").textContent = "全部找到了！";
      mode = "talk";
      $("bubble").classList.remove("waiting");
    }
  }

  // ---------- 說明卡 ----------
  function openSheet(h) {
    $("sheetTitle").textContent = h.title;
    $("sheetDesc").textContent = h.desc;
    $("sheet").hidden = false;
  }
  $("sheetClose").onclick = () => {
    $("sheet").hidden = true;
    if (mode === "talk" && line()?.type === "explore") {
      cheer();
      say(fill(line().done || "厲害喔，細節都被你找到了！"), { video: line().doneVideo, audio: line().doneAudio });
      $("counter").hidden = true;
      clearHotspots();
    }
  };

  // ---------- 抬頭看 ----------
  $("lookupDone").onclick = () => {
    $("lookup").hidden = true;
    step++;
    playStep();
  };

  // ---------- 離線快取 ----------
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
    // 有新版離線快取接手時，自動重新整理一次，遊客就不會一直看到舊版
    // （第一次造訪沒有舊版，不需要重新整理）
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
  }
  window.addEventListener("offline", () => toast("目前沒有網路，導覽會使用手機裡已存好的內容"));

  // ---------- 蓋章 ----------
  function finishStop() {
    mode = "busy";
    stopVoice();
    const s = stop();
    $("stampName").textContent = s.stamp;
    const got = saveStamp(s.id);
    const total = T.stops.filter((x) => x.ready).length;
    $("stampMsg").innerHTML = got >= total
      ? `🎉 恭喜！${total} 枚印章全部收集完成<br>謝謝你走完泰興宮！`
      : `已收集 <b>${got}</b> / ${total} 枚印章`;
    const complete = got >= total;
    if (complete && !store.get(DONE_KEY)) store.set(DONE_KEY, new Date().toISOString());
    $("cardFromStamp").hidden = !complete;
    $("toMapBtn").className = complete ? "btn ghost" : "btn primary";
    $("toMapBtn").textContent = complete ? "回到地圖" : "回到地圖，選下一站";
    $("stampLayer").hidden = false;
    const st = $("stamp");
    st.classList.remove("stamped"); void st.offsetWidth; st.classList.add("stamped");
    if (!reduceMotion) {
      setTimeout(() => {
        $("stop").classList.remove("thump"); void $("stop").offsetWidth; $("stop").classList.add("thump");
        try { navigator.vibrate?.(35); } catch {}
      }, 380);
    }
    $("stampLayer").querySelectorAll(".confetti").forEach((c) => c.remove());
    if (complete && !reduceMotion) {
      const colors = ["#e3b54a", "#d9382c", "#f6e7c1", "#6fae3e", "#4f97c4"];
      for (let k = 0; k < 40; k++) {
        const c = document.createElement("i");
        c.className = "confetti";
        c.style.left = Math.random() * 100 + "%";
        c.style.background = colors[k % colors.length];
        c.style.setProperty("--x", (Math.random() * 120 - 60).toFixed(0) + "px");
        c.style.setProperty("--r", (Math.random() * 720 - 360).toFixed(0) + "deg");
        c.style.animationDelay = (0.4 + Math.random() * 0.9).toFixed(2) + "s";
        c.style.animationDuration = (1.8 + Math.random() * 1.4).toFixed(2) + "s";
        $("stampLayer").appendChild(c);
      }
    }
  }

  // ---------- 大茅埔山水籤（在地創作的趣味籤詩） ----------
  const Y = T.guoqian;
  const GAN = "甲乙丙丁戊己庚辛壬癸";
  const zhNum = (n) => { const d = "一二三四五六七八九"; return n <= 10 ? (d + "十")[n - 1] : (n < 20 ? "十" : d[Math.floor(n / 10) - 1] + "十") + (n % 10 ? d[n % 10 - 1] : ""); };
  const tubeSvg = () => `<svg class="tube" viewBox="0 0 160 230" aria-hidden="true">
    ${[30, 44, 58, 72, 86, 100, 114, 128].map((x, i) =>
      `<rect x="${x - 4}" y="${8 + (i % 3) * 9}" width="8" height="120" rx="3" fill="${i % 2 ? "#e2bd72" : "#cfa257"}"/>`).join("")}
    <path d="M18 70 h124 l-8 150 a8 8 0 0 1 -8 8 h-92 a8 8 0 0 1 -8 -8 z" fill="#7a1712"/>
    <path d="M18 70 h124 l-1.2 18 h-121.6 z" fill="#a3241b"/>
    <rect x="22" y="196" width="116" height="10" fill="#5a100c"/>
    <rect x="52" y="104" width="56" height="78" rx="4" fill="#f4e7c8"/>
    <text x="80" y="136" text-anchor="middle" font-family="Noto Serif TC, serif" font-weight="900" font-size="26" fill="#7a1712">${Y.tube[0]}</text>
    <text x="80" y="168" text-anchor="middle" font-family="Noto Serif TC, serif" font-weight="900" font-size="26" fill="#7a1712">${Y.tube[1]}</text>
  </svg>`;
  // 籤紙上的小插圖（viewBox 0 0 100 100）
  const LEAF = `<path d="M52 18 C62 6, 80 8, 84 14 C74 22, 60 24, 52 18 Z" fill="#5f8f3a"/>`;
  const STEM = `<path d="M50 14 v10" stroke="#6b4a2a" stroke-width="4" stroke-linecap="round"/>`;
  const ICONS = {
    pear: `${STEM}${LEAF}
      <path d="M50 24 C38 24, 36 40, 38 48 C24 58, 22 88, 50 90 C78 88, 76 58, 62 48 C64 40, 62 24, 50 24 Z" fill="#d9d77a" stroke="#9a9a3c" stroke-width="2"/>
      <ellipse cx="40" cy="62" rx="5" ry="10" fill="#fff" opacity=".45"/>`,
    persimmon: `<path d="M50 32 C82 30, 90 50, 86 66 C82 84, 64 88, 50 88 C36 88, 18 84, 14 66 C10 50, 18 30, 50 32 Z" fill="#e8642c" stroke="#b84418" stroke-width="2"/>
      <path d="M50 66 V86" stroke="#b84418" stroke-width="1.5" opacity=".5"/>
      <path d="M50 36 L28 26 L38 40 L24 46 L50 42 L76 46 L62 40 L72 26 Z" fill="#4f7a2c"/>
      <path d="M50 22 v10" stroke="#6b4a2a" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="36" cy="54" rx="7" ry="10" fill="#fff" opacity=".3"/>`,
    citrus: `${STEM}${LEAF}
      <ellipse cx="50" cy="58" rx="36" ry="32" fill="#f39a1e" stroke="#c96f0c" stroke-width="2"/>
      ${[[36, 48], [58, 44], [66, 64], [44, 70], [52, 58]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#c96f0c"/>`).join("")}
      <ellipse cx="36" cy="52" rx="7" ry="10" fill="#fff" opacity=".3"/>`,
    tree: `<path d="M6 90 H94" stroke="#8a5a34" stroke-width="4" stroke-linecap="round"/>
      <path d="M40 90 C42 74, 42 62, 44 52 H56 C58 62, 58 74, 60 90 Z" fill="#7a4e2c"/>
      <circle cx="50" cy="34" r="24" fill="#4f7a2c"/><circle cx="30" cy="46" r="16" fill="#5f8f3a"/>
      <circle cx="70" cy="46" r="16" fill="#5f8f3a"/><circle cx="50" cy="22" r="14" fill="#6fae3e"/>
      <rect x="42" y="64" width="16" height="6" fill="#c2401c"/>
      <path d="M84 90 V74" stroke="#4f7a2c" stroke-width="3" stroke-linecap="round"/>
      <path d="M84 80 C77 80, 75 74, 75 71 C81 71, 84 75, 84 80 Z M84 77 C91 77, 93 71, 93 68 C87 68, 84 72, 84 77 Z" fill="#6fae3e"/>`,
    firefly: `<circle cx="50" cy="50" r="46" fill="#1f2a44"/>
      ${[[24, 30, 5], [70, 24, 4], [80, 58, 5], [30, 70, 4], [56, 80, 3], [16, 52, 3]].map(([x, y, r]) =>
        `<circle cx="${x}" cy="${y}" r="${r * 2.4}" fill="#f6e27a" opacity=".25"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fff6a8"/>`).join("")}
      <circle cx="56" cy="52" r="14" fill="#f6e27a" opacity=".3"/>
      <ellipse cx="50" cy="44" rx="6" ry="9" fill="#3a2a22" transform="rotate(-30 50 44)"/>
      <ellipse cx="56" cy="52" rx="6" ry="7" fill="#fff6a8"/>
      <path d="M46 40 L36 30 M50 38 L46 26" stroke="#3a2a22" stroke-width="2" stroke-linecap="round"/>`,
    leopardcat: `<path d="M18 40 L24 10 L44 28 Z M82 40 L76 10 L56 28 Z" fill="#b8874a"/>
      <path d="M24 34 L27 18 L38 29 Z M76 34 L73 18 L62 29 Z" fill="#5a3a22"/>
      <ellipse cx="50" cy="56" rx="36" ry="32" fill="#c99a5b"/>
      <path d="M44 26 C44 34, 44 40, 45 46 M56 26 C56 34, 56 40, 55 46" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M40 30 C40 36, 40 40, 41 44 M60 30 C60 36, 60 40, 59 44" stroke="#3a2a22" stroke-width="2.5" stroke-linecap="round"/>
      ${[[24, 54], [76, 54], [28, 68], [72, 68], [22, 44], [78, 44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#5a3a22"/>`).join("")}
      <ellipse cx="50" cy="72" rx="16" ry="11" fill="#f4ead8"/>
      <ellipse cx="38" cy="54" rx="6" ry="7" fill="#e8c34a"/><ellipse cx="62" cy="54" rx="6" ry="7" fill="#e8c34a"/>
      <ellipse cx="38" cy="54" rx="2.2" ry="5" fill="#1d1410"/><ellipse cx="62" cy="54" rx="2.2" ry="5" fill="#1d1410"/>
      <path d="M46 66 H54 L50 71 Z" fill="#d9707a"/>
      <path d="M36 70 H16 M36 74 L18 80 M64 70 H84 M64 74 L82 80" stroke="#fff" stroke-width="1.5"/>`,
    peach: `${STEM}${LEAF}
      <path d="M50 30 C70 20, 92 36, 86 60 C80 82, 62 90, 50 90 C38 90, 20 82, 14 60 C8 36, 30 20, 50 30 Z" fill="#f6b3a8" stroke="#d9707a" stroke-width="2"/>
      <ellipse cx="66" cy="62" rx="16" ry="20" fill="#ee6b7a" opacity=".45"/>
      <path d="M50 32 C44 50, 44 70, 50 88" stroke="#d9707a" stroke-width="2" fill="none"/>
      <ellipse cx="32" cy="52" rx="6" ry="10" fill="#fff" opacity=".4"/>`,
    grape: `<path d="M50 6 V18" stroke="#6b4a2a" stroke-width="4" stroke-linecap="round"/>
      <path d="M52 14 C62 4, 82 6, 86 16 C76 22, 62 22, 52 14 Z" fill="#5f8f3a"/>
      ${[[38, 26], [50, 26], [62, 26], [32, 38], [44, 38], [56, 38], [68, 38], [38, 50], [50, 50], [62, 50], [44, 62], [56, 62], [50, 74]].map(([x, y]) =>
        `<circle cx="${x}" cy="${y}" r="7.5" fill="#5b2d6e" stroke="#3e1c4c" stroke-width="1.2"/><circle cx="${x - 2.5}" cy="${y - 2.5}" r="2" fill="#fff" opacity=".45"/>`).join("")}`,
    canal: `<path d="M50 8 C88 8, 94 50, 90 66 C84 88, 66 92, 50 92 C30 92, 12 86, 10 64 C6 40, 14 8, 50 8 Z" fill="#cfe6f2" stroke="#4f97c4" stroke-width="7"/>
      <path d="M22 76 q6 -5 12 0 t12 0 M58 82 q6 -5 12 0 t12 0" stroke="#4f97c4" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M30 52 L50 34 L70 52 Z" fill="#b5452f"/>
      <rect x="34" y="52" width="32" height="20" fill="#f4e7c8" stroke="#7a4e2c" stroke-width="2"/>
      <rect x="46" y="58" width="8" height="14" fill="#7a4e2c"/>`,
    banyan: `<path d="M18 86 Q50 70 82 86 L84 92 L16 92 Z" fill="#a8742a"/>
      <path d="M30 86 C32 70, 36 60, 42 54 M50 86 V52 M70 86 C68 70, 64 60, 58 54" stroke="#7a4e2c" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M36 66 V84 M44 62 V84 M58 62 V84 M64 66 V84" stroke="#8a5e38" stroke-width="2" opacity=".8"/>
      <ellipse cx="50" cy="34" rx="40" ry="22" fill="#4f7a2c"/><ellipse cx="30" cy="40" rx="18" ry="12" fill="#5f8f3a"/>
      <ellipse cx="70" cy="40" rx="18" ry="12" fill="#5f8f3a"/><ellipse cx="50" cy="24" rx="22" ry="12" fill="#6fae3e"/>
      <path d="M44 66 Q50 70 56 66" stroke="#c2401c" stroke-width="3" fill="none"/>`,
    pearflower: `<path d="M20 90 C40 70, 52 60, 80 30" stroke="#6b4a2a" stroke-width="4" fill="none" stroke-linecap="round"/>
      ${[[36, 58, 1], [62, 40, 1.15], [52, 70, .85]].map(([x, y, k]) => `<g transform="translate(${x} ${y}) scale(${k})">${[0, 72, 144, 216, 288].map((a) =>
        `<ellipse cx="0" cy="-10" rx="7" ry="10" fill="#fff" stroke="#d9cfc0" stroke-width="1.2" transform="rotate(${a})"/>`).join("")}
        <circle r="4" fill="#f2c94c"/></g>`).join("")}
      <path d="M74 74 L88 60" stroke="#8a5a34" stroke-width="4" stroke-linecap="round"/><path d="M70 78 L76 72" stroke="#e8d6b0" stroke-width="7" stroke-linecap="round"/>`,
    urtica: `<path d="M50 94 V58" stroke="#4f7a2c" stroke-width="4"/>
      <path d="M50 60 L30 54 L36 48 L24 40 L34 36 L26 26 L38 26 L36 14 L46 22 L50 8 L54 22 L64 14 L62 26 L74 26 L66 36 L76 40 L64 48 L70 54 Z" fill="#5f9a3a" stroke="#3f6a24" stroke-width="2" stroke-linejoin="round"/>
      <path d="M50 58 V14 M50 40 L36 30 M50 40 L64 30 M50 50 L38 44 M50 50 L62 44" stroke="#3f6a24" stroke-width="1.5" fill="none"/>
      ${[[50, 66], [50, 74], [50, 82], [44, 70], [56, 78], [42, 80], [58, 68]].map(([x, y]) => `<path d="M${x} ${y} l${x < 50 ? -6 : 6} -3" stroke="#e8f0e4" stroke-width="1.5" stroke-linecap="round"/>`).join("")}`,
    paperboat: `<rect x="0" y="0" width="100" height="100" rx="18" fill="#1f2a44"/>
      <path d="M0 72 Q25 66 50 72 T100 72 V100 H0 Z" fill="#16303f"/>
      <circle cx="50" cy="56" r="24" fill="#f6d77a" opacity=".22"/>
      <path d="M22 64 L40 48 L48 64 Z M52 64 L60 48 L78 64 Z M38 64 L50 36 L62 64 Z" fill="#d9382c" stroke="#8e1f16" stroke-width="2" stroke-linejoin="round"/>
      <path d="M18 64 H82 L72 76 H28 Z" fill="#d9382c" stroke="#8e1f16" stroke-width="2" stroke-linejoin="round"/>
      <path d="M24 70 H76 L72 76 H28 Z" fill="#e8b54a"/>
      <circle cx="20" cy="20" r="1.6" fill="#fff8d8"/><circle cx="78" cy="16" r="1.4" fill="#fff8d8"/><circle cx="62" cy="28" r="1.2" fill="#fff8d8"/>`,
    mountain: `<path d="M2 70 L30 30 L46 50 L66 18 L98 70 Z" fill="#4f7a49"/>
      <path d="M2 70 L30 44 L48 62 L70 40 L98 70 Z" fill="#6f9a4a"/>
      <path d="M0 74 H100 V96 H0 Z" fill="#8fb8cf"/><path d="M8 84 q8 -5 16 0 t16 0 t16 0 t16 0 t16 0" stroke="#e6f2f8" stroke-width="2" fill="none"/>
      <path d="M42 70 L50 63 L58 70 Z" fill="#c4553b"/><rect x="44" y="70" width="12" height="5" fill="#e3d4b4"/>`,
    muntjac: `<circle cx="80" cy="18" r="10" fill="#f6e7a8"/><circle cx="76" cy="15" r="9" fill="#1f2a44" opacity="0"/>
      <path d="M36 22 L32 8 M36 16 L42 10 M64 22 L68 8 M64 16 L58 10" stroke="#6b4a2a" stroke-width="3" stroke-linecap="round"/>
      <path d="M26 30 L36 22 L44 32 Z M74 30 L64 22 L56 32 Z" fill="#a86a3a"/>
      <path d="M34 30 Q50 22 66 30 L62 66 Q50 80 38 66 Z" fill="#b8783e"/>
      <path d="M44 30 L48 52 M56 30 L52 52" stroke="#5a3a22" stroke-width="3" stroke-linecap="round"/>
      <circle cx="42" cy="46" r="3.2" fill="#1d1410"/><circle cx="58" cy="46" r="3.2" fill="#1d1410"/>
      <ellipse cx="50" cy="70" rx="7" ry="5" fill="#3a2a1e"/>`,
    doorgod: `<rect x="10" y="12" width="80" height="80" rx="4" fill="#7a1712"/>
      <rect x="16" y="18" width="33" height="70" fill="#a3241b" stroke="#e3b54a" stroke-width="2"/>
      <rect x="51" y="18" width="33" height="70" fill="#a3241b" stroke="#e3b54a" stroke-width="2"/>
      <circle cx="32" cy="38" r="9" fill="#2b2f3a"/><circle cx="68" cy="38" r="9" fill="#f0d4b0"/>
      <path d="M24 30 L32 22 L40 30 Z M60 30 L68 22 L76 30 Z" fill="#e3b54a"/>
      <path d="M22 52 H42 V78 H22 Z M58 52 H78 V78 H58 Z" fill="#c9a24a" opacity=".85"/>
      <path d="M20 46 L26 84" stroke="#e3b54a" stroke-width="3"/><path d="M80 46 L74 84" stroke="#e3b54a" stroke-width="3"/>`,
    osmanthus: `<path d="M20 88 C40 70, 50 50, 82 22" stroke="#6b4a2a" stroke-width="4" fill="none" stroke-linecap="round"/>
      ${[[30, 70, -30], [46, 54, 20], [62, 38, -25], [70, 52, 30], [40, 40, -40]].map(([x, y, a]) =>
        `<ellipse cx="${x}" cy="${y}" rx="12" ry="5" fill="#4f7a2c" transform="rotate(${a} ${x} ${y})"/>`).join("")}
      ${[[50, 62], [54, 58], [48, 56], [66, 44], [70, 40], [64, 40], [36, 62], [40, 66]].map(([x, y]) =>
        `<circle cx="${x}" cy="${y}" r="3.2" fill="#f2a531" stroke="#c97a10" stroke-width=".8"/>`).join("")}`,
    bucket: `<path d="M8 84 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0" stroke="#7fb6d6" stroke-width="3" fill="none"/>
      <path d="M28 40 H72 L66 82 H34 Z" fill="#8a5a32" stroke="#5a3a1e" stroke-width="2"/>
      <path d="M30 54 H70 M32 70 H68" stroke="#5a3a1e" stroke-width="2"/>
      <ellipse cx="50" cy="40" rx="22" ry="6" fill="#7fb6d6" stroke="#4a7f9a" stroke-width="1.5"/>
      <path d="M28 40 Q50 6 72 40" stroke="#5a3a1e" stroke-width="2.5" fill="none"/>
      <path d="M50 22 C54 28, 56 32, 52 35 C48 36, 46 32, 50 22 Z" fill="#9fd3f0"/>`,
    spring: `<path d="M4 50 Q20 30 40 40 L46 60 L10 66 Z" fill="#8a8f86"/><path d="M60 36 Q82 26 96 44 L92 64 L56 58 Z" fill="#9aa096"/>
      <path d="M44 46 C48 60, 44 74, 50 92" stroke="#7fb6d6" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="M44 46 C48 60, 44 74, 50 92" stroke="#e6f2f8" stroke-width="2" fill="none" stroke-dasharray="4 6"/>
      ${[[58, 72], [36, 80], [64, 88]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#f6e27a" opacity=".3"/><circle cx="${x}" cy="${y}" r="2" fill="#fff6a8"/>`).join("")}
      <path d="M8 66 Q30 60 46 64 M56 60 Q76 62 92 66" stroke="#5f8f3a" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    dew: `${STEM}${LEAF}
      <ellipse cx="46" cy="60" rx="34" ry="30" fill="#ef8a1a" stroke="#c96f0c" stroke-width="2"/>
      <path d="M80 50 C86 60, 90 66, 84 72 C78 74, 74 68, 80 50 Z" fill="#9fd3f0" stroke="#4f97c4" stroke-width="1.5"/>
      <ellipse cx="34" cy="54" rx="7" ry="10" fill="#fff" opacity=".3"/>`,
  };
  const iconSvg = (k, cls = "") => `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${ICONS[k] || ""}</svg>`;
  const WX_COLOR = { "木": "#4f7a2c", "火": "#c2401c", "土": "#a8742a", "金": "#9a7b1c", "水": "#2f73a6" };

  // 本命天干：出生年尾數 4 = 甲、5 = 乙……3 = 癸
  const bornGan = (d) => GAN[(d + 6) % 10];
  const ganWx = (g) => "木木火火土土金金水水"[GAN.indexOf(g)];
  function relation(meWx, qWx) {
    const W = Y.wuxing;
    const t = meWx === qWx ? W.same
      : W.sheng[qWx] === meWx ? W.helpMe
      : W.sheng[meWx] === qWx ? W.iHelp
      : W.ke[meWx] === qWx ? W.iWin : W.winMe;
    return t.replaceAll("{me}", meWx).replaceAll("{q}", qWx);
  }
  function seasonLine(s) {
    const m = new Date().getMonth() + 1;
    return s.months?.includes(m) && s.now ? { now: true, text: s.now } : { now: false, text: s.text };
  }

  // 筊杯：flat = 平面朝上，round = 凸面朝上
  const jiaoSvg = (face, cls) => `<svg class="jiao ${cls}" viewBox="0 0 120 70" aria-hidden="true">
    <path d="M6 58 C14 2, 106 2, 114 58 C92 46, 28 46, 6 58 Z"
      fill="${face === "flat" ? "#d9573f" : "#9b2418"}" stroke="#4a0d08" stroke-width="2.5" stroke-linejoin="round"/>
    ${face === "flat"
      ? `<path d="M20 50 C28 16, 92 16, 100 50 C82 42, 38 42, 20 50 Z" fill="#f0b48f" opacity=".55"/>`
      : `<path d="M28 30 C40 14, 70 10, 86 18" stroke="#fff" stroke-opacity=".4" stroke-width="6" fill="none" stroke-linecap="round"/>`}
  </svg>`;

  let qian = { num: 0, last: 0, fails: 0, introStep: 0, born: null };
  const qSay = (s) => typeText($("qianLine"), s, $("qianGuide"));
  const qStage = (html) => { $("qianStage").innerHTML = html; $("qianStage").scrollTop = 0; };
  const qPose = (p) => swapImg($("qianGuide"), T.guide.poses[p] || T.guide.poses.default);
  const qClose = () => ($("qianLayer").hidden = true);
  const qRedo = () => { qian.fails = 0; qianShake(); };

  function openQian() {
    qian = { num: 0, last: qian.last, fails: 0, introStep: 0, born: qian.born };
    qPose("wave");
    $("qianSpeaker").textContent = T.guide.name;
    $("qianLayer").hidden = false;
    qianIntro();
  }
  function qianIntro() {
    const last = qian.introStep >= Y.intro.length - 1;
    qSay(Y.intro[qian.introStep]);
    qStage(`${tubeSvg()}<button class="btn primary" id="qNext">${last ? "我要求籤" : "繼續聽"}</button>`);
    $("qNext").onclick = () => {
      if (last) return qian.born === null ? qianBorn() : qianShake();
      qian.introStep++;
      qPose(qian.introStep === 1 ? "fruit" : "default");
      qianIntro();
    };
  }
  function qianBorn() {
    qPose("point");
    qSay(Y.bornSay);
    const digits = [4, 5, 6, 7, 8, 9, 0, 1, 2, 3];
    qStage(`<p class="qian-ask">出生年的最後一個數字</p>
      <div class="born-grid">${digits.map((d) =>
        `<button data-d="${d}"><b>${d}</b><small>${bornGan(d)}${ganWx(bornGan(d))}</small></button>`).join("")}</div>
      <p class="qian-hint">${Y.bornNote}</p>
      <button class="btn ghost" id="qSkip">跳過</button>`);
    $("qianStage").querySelectorAll("[data-d]").forEach((b) => {
      b.onclick = () => { qian.born = bornGan(+b.dataset.d); qianShake(); };
    });
    $("qSkip").onclick = () => { qian.born = ""; qianShake(); };
  }
  function qianShake() {
    qPose("default");
    const me = qian.born ? `你的本命是「${qian.born}${ganWx(qian.born)}」。` : "";
    qSay(me + Y.shakeSay);
    qStage(`${tubeSvg()}<button class="btn primary" id="qShake">搖籤筒</button>`);
    $("qShake").onclick = () => {
      $("qShake").disabled = true;
      $("qianStage").querySelector(".tube").classList.add("shaking");
      setTimeout(() => {
        // 不要連續抽到同一支
        do { qian.num = 1 + Math.floor(Math.random() * Y.signs.length); } while (qian.num === qian.last && Y.signs.length > 1);
        qian.last = qian.num;
        const sg = Y.signs[qian.num - 1];
        qSay(Y.jiaoSay);
        qPose("think");
        qStage(`<div class="stick">第${zhNum(qian.num)}籤 ${sg.gan}</div>
          <p class="qian-num">抽到：第${zhNum(qian.num)}籤・${sg.gan}${sg.wx}</p>
          <button class="btn primary" id="qJiao">擲筊</button>`);
        $("qJiao").onclick = qianJiao;
      }, 1250);
    };
  }
  function qianJiao() {
    // 擲兩次沒擲到聖筊，第三次一定是聖筊，免得遊客卡太久
    const r = qian.fails >= 2 ? "sheng" : ["sheng", "sheng", "xiao", "yin"][Math.floor(Math.random() * 4)];
    const faces = r === "sheng" ? (Math.random() < .5 ? ["flat", "round"] : ["round", "flat"])
                : r === "xiao" ? ["flat", "flat"] : ["round", "round"];
    qStage(`<div class="jiao-pair">${jiaoSvg(faces[0], "toss a")}${jiaoSvg(faces[1], "toss b")}</div>
      <p class="jiao-result" id="qRes"></p><div id="qAct"></div>`);
    setTimeout(() => {
      const j = Y.jiao[r];
      $("qRes").innerHTML = `<b>${j.name}</b>${j.desc}`;
      if (r === "sheng") {
        qPose("happy");
        $("qAct").innerHTML = `<button class="btn primary" id="qShow">看籤</button>`;
        $("qShow").onclick = qianResult;
      } else {
        qian.fails++;
        $("qAct").innerHTML = `<button class="btn primary" id="qAgain">重抽一支</button>`;
        $("qAgain").onclick = qianShake;
      }
    }, 900);
  }
  function qianResult() {
    const sg = Y.signs[qian.num - 1];
    const ss = seasonLine(sg.season);
    const rel = qian.born ? relation(ganWx(qian.born), sg.wx) : "";
    qPose("fruit");
    qSay(sg.say);
    qStage(`<div class="qian-paper guo" style="--wx:${WX_COLOR[sg.wx]}">
        <p class="kind">大茅埔山水籤</p>
        <h3>第${zhNum(qian.num)}籤</h3>
        <p class="gan"><span class="wx">${sg.gan}・${sg.wx}</span><span class="luck">${sg.luck}</span></p>
        ${iconSvg(sg.icon, "guo-icon")}
        <p class="guo-title">${sg.title}</p>
        <div class="poem">${sg.poem.map((l) => `<span>${l}</span>`).join("")}</div>
        <dl class="advice">${Object.entries(sg.advice).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
        ${rel ? `<p class="born"><b>本命 ${qian.born}${ganWx(qian.born)}</b>${rel}</p>` : ""}
        <p class="fruit-note"><b>小知識</b>${sg.note}</p>
        <p class="season${ss.now ? " now" : ""}">${ss.text}</p>
        <p class="note">${Y.disclaimer}</p>
      </div>
      <button class="btn primary" id="qCard">存成籤卡</button>
      <button class="btn" id="qRedo">再抽一支</button>
      <button class="btn ghost" id="qBack">回到地圖</button>`);
    $("qCard").onclick = qianCard;
    $("qRedo").onclick = qRedo;
    $("qBack").onclick = qClose;
  }

  // 籤卡：canvas 畫成 PNG（直排籤詩＋四項建議＋本命）
  function wrapText(g, text, maxW) {
    const lines = []; let cur = "";
    // 避頭尾：標點不放行首，「（ 不放行尾
    for (const ch of text) {
      if (g.measureText(cur + ch).width > maxW && cur && !"，。、；：！？」』）".includes(ch)) {
        const open = /[「『（]$/.test(cur) ? cur.slice(-1) : "";
        lines.push(open ? cur.slice(0, -1) : cur); cur = open + ch;
      } else cur += ch;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  async function renderQianCard() {
    const sg = Y.signs[qian.num - 1];
    const rel = qian.born ? `本命 ${qian.born}${ganWx(qian.born)}｜${relation(ganWx(qian.born), sg.wx)}` : "";
    const QW = 1080, PAD = 130, QR = 210;
    const all = ["大茅埔山水籤第一二三四五六七八九十籤", sg.gan, sg.wx, sg.luck, sg.title, ...sg.poem,
      ...Object.entries(sg.advice).flat(), rel, sg.note, Y.disclaimer, QIAN_CTA, QIAN_CTA2,
      "小知識東勢泰興宮手機導覽二十0123456789.｜：，！"].join("");
    try {
      await Promise.all([
        document.fonts.load(`900 80px "Noto Serif TC"`, all),
        document.fonts.load(`600 40px "Noto Serif TC"`, all),
        document.fonts.load(`500 30px "Noto Sans TC"`, all),
      ]);
    } catch {}
    const icon = await loadImg("data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="400" height="400">${ICONS[sg.icon]}</svg>`));
    const qr = await loadImg("assets/img/qr-site.png");
    // 先量本命和小知識要幾行，再決定卡片高度
    const c = document.createElement("canvas"); let g = c.getContext("2d");
    g.font = `600 30px ${SANS}`; const relLines = rel ? wrapText(g, rel, QW - PAD * 2).slice(0, 2) : [];
    g.font = `500 30px ${SANS}`; const noteLines = wrapText(g, sg.note, QW - PAD * 2 - 56).slice(0, 4);
    const relY = 1412, noteTop = relY + relLines.length * 42 + (relLines.length ? 8 : -26);
    const noteH = 26 + 40 + noteLines.length * 44 + 14;
    const footTop = noteTop + noteH + 44;
    const QH = footTop + 34 + QR + 70;
    c.width = QW; c.height = QH; g = c.getContext("2d");
    const red = "#7a1712", col = WX_COLOR[sg.wx];
    g.fillStyle = red; g.fillRect(0, 0, QW, QH);
    g.fillStyle = "#f4e7c8"; rrect(g, 36, 36, QW - 72, QH - 72, 24); g.fill();
    g.strokeStyle = "#e3b54a"; g.lineWidth = 4; rrect(g, 56, 56, QW - 112, QH - 112, 14); g.stroke();

    g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillStyle = "#6d5c4f"; g.font = `500 32px ${SANS}`; g.fillText("大 茅 埔 山 水 籤", QW / 2, 140);
    g.fillStyle = red; g.font = `900 96px ${SERIF}`; g.fillText(`第${zhNum(qian.num)}籤`, QW / 2, 250);
    // 天干五行＋吉凶
    g.font = `900 46px ${SERIF}`;
    g.fillStyle = col; rrect(g, QW / 2 - 200, 284, 190, 72, 36); g.fill();
    g.fillStyle = "#fff"; g.fillText(`${sg.gan}・${sg.wx}`, QW / 2 - 105, 337);
    g.strokeStyle = red; g.lineWidth = 4; rrect(g, QW / 2 + 10, 284, 190, 72, 36); g.stroke();
    g.fillStyle = red; g.fillText(sg.luck, QW / 2 + 105, 337);

    if (icon) g.drawImage(icon, QW / 2 - 90, 380, 180, 180);
    g.fillStyle = "#1d1410"; g.font = `600 44px ${SERIF}`; g.fillText(sg.title, QW / 2, 616);
    // 詩：四句直排，由右到左
    g.font = `900 52px ${SERIF}`; g.textBaseline = "top";
    sg.poem.forEach((line, i) => {
      const x = QW / 2 + 150 - i * 100;
      [...line].forEach((ch, j) => g.fillText(ch, x, 664 + j * 60));
    });
    g.textBaseline = "alphabetic";
    g.strokeStyle = "#c9a77b"; g.setLineDash([10, 8]); g.lineWidth = 2;
    g.beginPath(); g.moveTo(110, 1110); g.lineTo(QW - 110, 1110); g.stroke(); g.setLineDash([]);
    // 四項建議
    g.textAlign = "left";
    Object.entries(sg.advice).forEach(([k, v], i) => {
      const y = 1172 + i * 58;
      g.fillStyle = col; g.font = `900 34px ${SERIF}`; g.fillText(k, 130, y);
      g.fillStyle = "#1d1410"; g.font = `500 34px ${SANS}`; g.fillText(v, 240, y, QW - 370);
    });
    // 本命
    g.fillStyle = red; g.font = `600 30px ${SANS}`;
    relLines.forEach((l, i) => g.fillText(l, PAD, relY + i * 42));
    // 小知識（淡色底框）
    g.fillStyle = "rgba(255,255,255,.6)"; rrect(g, PAD - 16, noteTop, QW - PAD * 2 + 32, noteH, 18); g.fill();
    g.fillStyle = col; g.font = `900 32px ${SERIF}`; g.fillText("小知識", PAD + 12, noteTop + 56);
    g.fillStyle = "#1d1410"; g.font = `500 30px ${SANS}`;
    noteLines.forEach((l, i) => g.fillText(l, PAD + 12, noteTop + 104 + i * 44));
    // 底部：QR Code（掃了直接開網站）＋說明
    g.strokeStyle = "#c9a77b"; g.setLineDash([10, 8]); g.lineWidth = 2;
    g.beginPath(); g.moveTo(110, footTop); g.lineTo(QW - 110, footTop); g.stroke(); g.setLineDash([]);
    const qx = QW - PAD - QR + 10, qy = footTop + 34;
    if (qr) {
      g.fillStyle = "#fff"; rrect(g, qx - 10, qy - 10, QR + 20, QR + 20, 14); g.fill();
      g.imageSmoothingEnabled = false; g.drawImage(qr, qx, qy, QR, QR); g.imageSmoothingEnabled = true;
    }
    const tw = qx - PAD - 40;
    g.fillStyle = red; g.font = `900 40px ${SERIF}`; g.fillText(QIAN_CTA, PAD, qy + 52, tw);
    g.fillStyle = "#1d1410"; g.font = `700 30px ${SANS}`; g.fillText(QIAN_SITE, PAD, qy + 108, tw);
    g.fillStyle = "#6d5c4f"; g.font = `500 24px ${SANS}`;
    wrapText(g, Y.disclaimer, tw).slice(0, 3).forEach((l, i) => g.fillText(l, PAD, qy + 156 + i * 34));

    return new Promise((res) => c.toBlob(res, "image/png"));
  }
  const QIAN_CTA = "掃一下，換你抽！", QIAN_CTA2 = "跟著志永哥逛泰興宮，抽一支大茅埔山水籤", QIAN_SITE = "東勢泰興宮手機導覽";
  let qCardUrl = null;
  async function qianCard() {
    $("qCard").disabled = true; $("qCard").textContent = "製作中…";
    const blob = await renderQianCard();
    if (!blob) { toast("籤卡做不出來，請改用截圖保存"); $("qCard").disabled = false; $("qCard").textContent = "存成籤卡"; return; }
    if (qCardUrl) URL.revokeObjectURL(qCardUrl);
    qCardUrl = URL.createObjectURL(blob);
    const name = `大茅埔山水籤第${zhNum(qian.num)}籤.png`;
    const file = new File([blob], name, { type: "image/png" });
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    qPose("happy");
    qSay("籤卡做好了！可以存下來，或分享給朋友，看看東勢的水果跟你說了什麼。");
    qStage(`<img class="qian-card" src="${qCardUrl}" alt="大茅埔山水籤籤卡">
      <p class="qian-hint">也可以長按圖片直接儲存</p>
      ${canShare ? `<button class="btn primary" id="qShare">分享</button>` : ""}
      <a class="btn primary" href="${qCardUrl}" download="${name}">存成圖片</a>
      <button class="btn" id="qRedo">再抽一支</button>
      <button class="btn ghost" id="qBack">回到地圖</button>`);
    if (canShare) $("qShare").onclick = async () => {
      try { await navigator.share({ files: [file], title: "大茅埔山水籤", text: "我在台中東勢大茅埔泰興宮抽到一支山水籤！" }); }
      catch (e) { if (e.name !== "AbortError") toast("這支手機不支援直接分享，請改用「存成圖片」"); }
    };
    $("qRedo").onclick = qRedo;
    $("qBack").onclick = qClose;
  }
  if (Y) { $("qianBtn").hidden = false; $("qianBtn").onclick = openQian; }
  $("qianClose").onclick = qClose;



  // ---------- 集章卡（canvas 畫成 PNG，可分享或存檔） ----------
  const DONE_KEY = "templego-complete";
  const NAME_KEY = "templego-name";
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  const CW = 1080, CH = 1350;
  const SERIF = '"Noto Serif TC", serif', SANS = '"Noto Sans TC", sans-serif';
  let card = { blob: null, url: null, token: 0 };

  const loadImg = (src) => new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => res(null);
    im.src = src;
  });
  const fmtDate = (d) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function drawStamp(g, x, y, r, deg, word, seed) {
    g.save(); g.translate(x, y); g.rotate(deg * Math.PI / 180);
    const ink = "rgba(200,42,32,.92)";
    g.fillStyle = "rgba(217,56,44,.07)"; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.strokeStyle = ink;
    g.lineWidth = 9; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r - 16, 0, 7); g.stroke();
    g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `700 24px ${SERIF}`; g.fillText("泰 興 宮", 0, -r * 0.56);
    g.font = `900 ${word.length > 2 ? 54 : 72}px ${SERIF}`; g.fillText(word, 0, 4);
    g.font = `700 22px ${SERIF}`; g.fillText("到 此 一 遊", 0, r * 0.56);
    // 印泥斑駁感：用紙色點掉一些（固定亂數，每次畫都一樣）
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    g.fillStyle = "rgba(251,245,233,.55)";
    for (let i = 0; i < 70; i++) {
      const a = rnd() * 6.283, d = rnd() * (r + 6);
      g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 1 + rnd() * 3.2, 0, 7); g.fill();
    }
    g.restore();
  }
  function drawEmpty(g, x, y, r, n) {
    g.save();
    g.strokeStyle = "#cdbda6"; g.lineWidth = 4; g.setLineDash([14, 12]);
    g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    g.fillStyle = "#cdbda6"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `900 72px ${SERIF}`; g.fillText(String(n), x, y + 4);
    g.restore();
  }

  async function renderCard() {
    const token = ++card.token;
    const ready = T.stops.filter((s) => s.ready);
    const done = new Set(loadStamps());
    const got = ready.filter((s) => done.has(s.id)).length;
    const complete = got === ready.length;
    const name = $("cardName").value.trim();
    const doneAt = store.get(DONE_KEY);
    const date = complete && doneAt ? new Date(doneAt) : new Date();

    const title = "泰興宮 集章卡";
    const sub = complete ? `${ready.length} 站全部走完，印章收集完成！` : `已收集 ${got} / ${ready.length} 枚印章`;
    const say = complete ? ["謝謝你走完泰興宮，", "歡迎再來大茅埔坐坐！"]
                         : [`還有 ${ready.length - got} 站等你，`, "走完再來領完成卡！"];
    const who = `${name || "旅人"} 到此一遊`;
    const labels = ready.map((s) => s.title.split("・")[0]);
    const allText = [title, sub, ...say, who, ...labels, ...ready.map((s) => s.stamp),
      "泰興宮到此一遊台中東勢大茅埔手機導覽完成—0123456789./", T.guide.name].join("");
    try {
      await Promise.all([
        document.fonts.load(`900 80px "Noto Serif TC"`, allText),
        document.fonts.load(`600 40px "Noto Serif TC"`, allText),
        document.fonts.load(`500 30px "Noto Sans TC"`, allText),
      ]);
    } catch {}
    const guide = await loadImg(T.guide.poses[complete ? "happy" : "default"] || T.guide.poses.default);
    if (token !== card.token) return;

    const c = document.createElement("canvas"); c.width = CW; c.height = CH;
    const g = c.getContext("2d");
    // 底：紅框＋米色紙＋金線
    g.fillStyle = "#7a1712"; g.fillRect(0, 0, CW, CH);
    g.fillStyle = "#fbf5e9"; rrect(g, 36, 36, CW - 72, CH - 72, 28); g.fill();
    g.save(); rrect(g, 36, 36, CW - 72, CH - 72, 28); g.clip();

    g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillStyle = "#6d5c4f"; g.font = `500 30px ${SANS}`;
    g.fillText("台中・東勢・大茅埔", CW / 2, 140);
    g.fillStyle = "#7a1712"; g.font = `900 92px ${SERIF}`;
    g.fillText(title, CW / 2, 250);
    g.fillStyle = "#1d1410"; g.font = `500 34px ${SANS}`;
    g.fillText(sub, CW / 2, 318);

    // 印章：每排最多 3 個
    const r = 118, rows = [], degs = [-9, 6, -4, 8, -6, 4];
    for (let i = 0; i < ready.length; i += 3) rows.push(ready.slice(i, i + 3));
    rows.forEach((row, ri) => {
      const y = 510 + ri * 300;
      row.forEach((s, j) => {
        const i = ri * 3 + j;
        const x = CW / 2 + (j - (row.length - 1) / 2) * 300;
        if (done.has(s.id)) drawStamp(g, x, y, r, degs[i % degs.length], s.stamp, i + 1);
        else drawEmpty(g, x, y, r, s.pin?.n || i + 1);
        g.fillStyle = done.has(s.id) ? "#1d1410" : "#a8977f";
        g.textAlign = "center"; g.textBaseline = "alphabetic";
        g.font = `600 32px ${SERIF}`; g.fillText(labels[i], x, y + r + 52);
      });
    });

    // 志永哥＋對話框
    const baseY = CH - 60;
    if (guide) {
      const h = 330, w = h * guide.width / guide.height;
      g.drawImage(guide, 250 - w / 2, baseY - h, w, h);
    }
    const bx = 430, by = 1004, bw = 570, bh = 150;
    g.fillStyle = "#fff"; g.strokeStyle = "#7a1712"; g.lineWidth = 4;
    rrect(g, bx, by, bw, bh, 26); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(bx + 2, by + 60); g.lineTo(bx - 30, by + 88); g.lineTo(bx + 2, by + 96);
    g.fill(); g.beginPath(); g.moveTo(bx, by + 60); g.lineTo(bx - 30, by + 88); g.lineTo(bx, by + 96); g.stroke();
    g.textAlign = "left"; g.fillStyle = "#1d1410"; g.font = `600 36px ${SERIF}`;
    g.fillText(say[0], bx + 32, by + 64); g.fillText(say[1], bx + 32, by + 116);

    g.fillStyle = "#7a1712"; g.font = `900 46px ${SERIF}`;
    g.fillText(who, bx + 4, 1222, bw);
    g.fillStyle = "#6d5c4f"; g.font = `500 28px ${SANS}`;
    g.fillText(`${fmtDate(date)}${complete ? " 完成" : ""}　｜　泰興宮手機導覽`, bx + 4, 1268, bw);
    g.restore();

    // 金色內框
    g.strokeStyle = "#e3b54a"; g.lineWidth = 4; rrect(g, 54, 54, CW - 108, CH - 108, 18); g.stroke();

    const blob = await new Promise((res) => c.toBlob(res, "image/png"));
    if (token !== card.token || !blob) return;
    if (card.url) URL.revokeObjectURL(card.url);
    card.blob = blob; card.url = URL.createObjectURL(blob);
    $("cardImg").src = card.url;
    const file = new File([blob], "泰興宮集章卡.png", { type: "image/png" });
    $("cardShare").hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
  }

  function openCard() {
    $("cardName").value = store.get(NAME_KEY) || "";
    $("cardLayer").hidden = false;
    renderCard();
  }
  let nameTimer = null;
  $("cardName").oninput = () => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => { store.set(NAME_KEY, $("cardName").value.trim()); renderCard(); }, 350);
  };
  $("mapStamps").onclick = openCard;
  $("cardFromStamp").onclick = openCard;
  $("cardClose").onclick = () => ($("cardLayer").hidden = true);
  $("cardSave").onclick = () => {
    if (!card.url) return;
    const a = document.createElement("a");
    a.href = card.url; a.download = "泰興宮集章卡.png";
    document.body.appendChild(a); a.click(); a.remove();
  };
  $("cardShare").onclick = async () => {
    if (!card.blob) return;
    const file = new File([card.blob], "泰興宮集章卡.png", { type: "image/png" });
    try {
      await navigator.share({ files: [file], title: "泰興宮集章卡", text: "我在台中東勢大茅埔泰興宮集章！" });
    } catch (e) {
      if (e.name !== "AbortError") toast("這支手機不支援直接分享，請改用「存成圖片」");
    }
  };
})();
