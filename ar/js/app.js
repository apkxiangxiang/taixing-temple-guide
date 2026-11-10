// =====================================================================
// AR 導覽主程式
//   掃描（MindAR 平面影像辨識）→ 連續追蹤確認 → 目標描邊發光
//   → 點擊 → 導覽人站在目標旁的地面上淡入 → 講解／提問／互動 → 淡出、蓋章
// 內容都在 config.js，這個檔案通常不用改
// =====================================================================
import * as THREE from "three";
import { MindARThree } from "mindar-image-three";
import { Compiler } from "mindar-image";
import { CONFIG } from "./config.js";

const $ = (id) => document.getElementById(id);
const NAME = CONFIG.guide.name;
const fill = (s) => s.replaceAll("{name}", NAME);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();
const params = new URLSearchParams(location.search);
const DEBUG = params.has("debug");

document.querySelectorAll("#foundHint .sub, #lostHint").forEach((el) => (el.innerHTML = fill(el.innerHTML)));

// 只有「有辨識照片、有劇本」的點會被辨識；順序 = .mind 檔裡的目標順序
const points = CONFIG.points.filter((p) => p.image && p.script.length);

// ---------------------------------------------------------------------
// 集章紀錄（只存在這支手機）
// ---------------------------------------------------------------------
const STORE = "templego-ar-stamps";
const stamps = new Set(readStore());
function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; }
}
function writeStore() {
  try { localStorage.setItem(STORE, JSON.stringify([...stamps])); } catch {}
}

function renderProgress() {
  $("progressNum").textContent = CONFIG.points.filter((p) => stamps.has(p.id)).length;
  $("progressTotal").textContent = CONFIG.points.length;
  $("pointList").innerHTML = CONFIG.points.map((p) => {
    const done = stamps.has(p.id);
    const soon = !(p.image && p.script.length);
    return `<li class="${done ? "done" : ""} ${soon ? "soon" : ""}">
      <span class="hall">${p.hall}</span><span>${p.name}${soon ? "（製作中）" : ""}</span>
      <span class="mark">${done ? p.stamp : ""}</span></li>`;
  }).join("");
}

function renderMenu() {
  renderProgress();
  $("targetLinks").innerHTML = points.map((p) =>
    `<a href="${p.image}" target="_blank" rel="noopener"><img src="${p.image}" alt="">${p.name}</a>`).join("");
  $("credits").innerHTML = CONFIG.credits.map((c) => `<li>${c}</li>`).join("");
  $("menuBtn").onclick = () => ($("menu").hidden = false);
  $("menuClose").onclick = () => ($("menu").hidden = true);
  $("menu").onclick = (e) => { if (e.target.id === "menu") $("menu").hidden = true; };
  $("resetBtn").onclick = () => { stamps.clear(); writeStore(); renderProgress(); };
}

// ---------------------------------------------------------------------
// 語音：有音檔就播音檔；沒有就用手機朗讀（佔位）；再不行就只算時間
// 可以暫停／繼續（鏡頭跟丟時用）
// ---------------------------------------------------------------------
class Speaker {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.job = null;
    this.paused = false;
    this.voice = null;
    const pick = () => {
      const vs = speechSynthesis.getVoices();
      this.voice = vs.find((v) => v.lang === CONFIG.voice.lang) ||
        vs.find((v) => v.lang.startsWith("zh")) || null;
    };
    if ("speechSynthesis" in window) { pick(); speechSynthesis.onvoiceschanged = pick; }
  }
  // video：AI 虛擬人的對嘴影片（聲音在影片裡），優先於 audio
  say(text, audioSrc, video = null) {
    this.cancel();
    return new Promise((resolve) => {
      const job = { text, audioSrc, video, resolve, mode: null, remaining: 0 };
      this.job = job;
      this._start(job);
    });
  }
  _start(job) {
    if (this.paused || this.job !== job) return;
    const text = job.text.replace(/[「」『』]/g, "");
    if (job.video) {
      job.mode = "video";
      const v = job.video;
      v.currentTime = 0;
      v.onended = () => this._done(job);
      v.play().catch(() => { v.muted = true; v.play().catch(() => this._done(job)); });
    } else if (job.audioSrc) {
      job.mode = "audio";
      this.audio.src = job.audioSrc;
      this.audio.onended = () => this._done(job);
      const fallback = () => { if (this.job === job) { job.audioSrc = null; this._start(job); } };
      this.audio.onerror = fallback;
      this.audio.play().catch(fallback);
    } else if (CONFIG.voice.ttsFallback && "speechSynthesis" in window) {
      job.mode = "tts";
      const u = new SpeechSynthesisUtterance(text);
      u.lang = CONFIG.voice.lang;
      u.rate = CONFIG.voice.rate;
      if (this.voice) u.voice = this.voice;
      job.utt = u;
      u.onend = () => { if (job.utt === u) this._done(job); };
      u.onerror = (e) => { if (job.utt === u && e.error !== "interrupted" && e.error !== "canceled") this._done(job); };
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      // 部分 Android 不會觸發 onend，用時間保底
      job.safety = setTimeout(() => { if (job.utt === u) this._done(job); }, text.length * 420 + 4000);
    } else {
      job.mode = "timer";
      job.remaining = job.remaining || text.length * CONFIG.voice.msPerChar + 600;
      job.startedAt = now();
      job.timer = setTimeout(() => this._done(job), job.remaining);
    }
  }
  _done(job) {
    if (this.job !== job) return;
    clearTimeout(job.timer); clearTimeout(job.safety);
    job.utt = null;
    this.job = null;
    job.resolve();
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    const j = this.job;
    if (!j) return;
    if (j.mode === "audio") this.audio.pause();
    else if (j.mode === "video") j.video.pause();
    else if (j.mode === "tts") { j.utt = null; clearTimeout(j.safety); speechSynthesis.cancel(); } // 繼續時整句重講
    else if (j.mode === "timer") { clearTimeout(j.timer); j.remaining -= now() - j.startedAt; }
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    const j = this.job;
    if (!j) return;
    if (j.mode === "audio") this.audio.play().catch(() => {});
    else if (j.mode === "video") j.video.play().catch(() => {});
    else this._start(j);
  }
  cancel() {
    const j = this.job;
    this.job = null;
    if (j) {
      clearTimeout(j.timer); clearTimeout(j.safety); j.utt = null;
      if (j.video) { j.video.onended = null; j.video.pause(); }
    }
    this.audio.onended = this.audio.onerror = null;
    this.audio.pause();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }
  unlock() {
    // 必須在使用者點擊時呼叫一次，之後才能自動出聲
    try { if ("speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch {}
    try { this.audio.muted = true; this.audio.play().catch(() => {}); this.audio.pause(); this.audio.muted = false; } catch {}
  }
}
const speaker = new Speaker();

// ---------------------------------------------------------------------
// 著色器
// ---------------------------------------------------------------------
// 目標描邊：圓角框線 + 外光暈 + 繞圈的亮點，整體呼吸閃爍（若隱若現）
const GLOW_VS = /* glsl */ `
  uniform vec2 uSize;
  varying vec2 vP;
  void main() {
    vP = (uv - 0.5) * uSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const GLOW_FS = /* glsl */ `
  uniform float uTime, uOpacity;
  uniform vec2 uHalf;
  uniform vec3 uColor;
  varying vec2 vP;
  float sdBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    float d = sdBox(vP, uHalf, 0.03);
    float line = exp(-abs(d) * 110.0);
    float halo = d > 0.0 ? exp(-d * 22.0) * 0.55 : exp(d * 40.0) * 0.18;
    float ang = atan(vP.y, vP.x);
    float sweep = pow(0.5 + 0.5 * sin(ang * 2.0 - uTime * 2.4), 8.0);
    float pulse = 0.5 + 0.5 * sin(uTime * 2.8);
    float a = (line * (0.55 + 1.2 * sweep) + halo * (0.4 + 0.6 * pulse)) * (0.45 + 0.55 * pulse) * uOpacity;
    gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
  }`;

// 導覽人：透明 PNG/WebP 或綠幕影片（去背），底部淡出
const GUIDE_VS = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GUIDE_FS = /* glsl */ `
  uniform sampler2D map;
  uniform float uOpacity, uUseChroma, uFade;
  uniform vec3 uChroma;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(map, vUv);
    float a = c.a;
    if (uUseChroma > 0.5) {
      float kY = dot(uChroma, vec3(0.299, 0.587, 0.114));
      vec2 kC = vec2(uChroma.b - kY, uChroma.r - kY);
      float y = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      float dist = distance(vec2(c.b - y, c.r - y), kC);
      a *= smoothstep(0.07, 0.15, dist);
      c.g -= max(0.0, c.g - max(c.r, c.b)) * 0.7;   // 去綠邊
    }
    a *= smoothstep(0.0, uFade, vUv.y);
    gl_FragColor = vec4(c.rgb, a * uOpacity);
  }`;

// ---------------------------------------------------------------------
// 導覽人（一個實體，走到哪個目標就掛到哪個目標下）
// 單位：公分。掛上去時整組縮放成目標座標（目標寬 = 1）
// ---------------------------------------------------------------------
class Guide {
  constructor() {
    this.group = new THREE.Group();     // 站立位置（地面上）
    this.body = new THREE.Group();      // 原點在腳底，縮放／彈跳以腳為支點
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: null }, uOpacity: { value: 0 }, uUseChroma: { value: 0 },
        uChroma: { value: new THREE.Color("#00b140") }, uFade: { value: 0.12 },
      },
      vertexShader: GUIDE_VS, fragmentShader: GUIDE_FS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.body.add(this.mesh);
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.set(34, 13, 1);
    this.shadow.position.y = 0.5;
    this.group.add(this.shadow, this.body);
    this.clips = {};
    this.cur = null;
    this.opacity = 0;
    this.targetOpacity = 0;
    this.poke = 0;
    this.t = 0;
  }

  // 載入一段影片當貼圖。透明背景 WebM（VP9 alpha）直接用；綠幕影片要在設定寫 chroma
  static async loadVideo(src, { muted = true, loop = true } = {}) {
    const video = document.createElement("video");
    Object.assign(video, { src, muted, loop, playsInline: true, preload: "auto", crossOrigin: "anonymous" });
    video.setAttribute("playsinline", "");
    await new Promise((res, rej) => {
      video.onloadeddata = res;
      video.onerror = () => rej(new Error("讀不到影片：" + src));
      video.load();
    });
    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return { video, tex, aspect: video.videoWidth / video.videoHeight };
  }

  async preload(onProgress) {
    const entries = Object.entries(CONFIG.guide.clips);
    let n = 0;
    await Promise.all(entries.map(async ([name, clip]) => {
      let loaded;
      if (clip.video) loaded = await Guide.loadVideo(clip.video, { loop: clip.loop !== false });
      else {
        const tex = await new THREE.TextureLoader().loadAsync(clip.img);
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        loaded = { tex, video: null, aspect: tex.image.width / tex.image.height };
      }
      this.clips[name] = { ...clip, ...loaded };
      onProgress?.(++n / entries.length);
    }));
  }

  // 講話片段（AI 虛擬人對嘴影片，聲音在影片裡）。載過的會留著，重播不用再下載
  talks = new Map();
  loadTalk(src) {
    if (!this.talks.has(src)) {
      const p = Guide.loadVideo(src, { muted: false, loop: false })
        .then((t) => ({ ...CONFIG.guide.talk, ...t }));
      p.catch(() => this.talks.delete(src));
      this.talks.set(src, p);
    }
    return this.talks.get(src);
  }
  useTalk(t) { this.apply(t, false); }

  attach(s, x) {
    s.guideRoot.add(this.group);
    this.group.position.set(x, 0, 0);
    this.cur = null;
    this.setClip(this.clips.idle ? "idle" : "default");
  }

  setClip(name) {
    const c = this.clips[name] || this.clips.idle || this.clips.default;
    if (this.cur === c) return;
    this.apply(c, true);
  }

  apply(c, autoplay) {
    if (this.cur?.video && this.cur !== c) this.cur.video.pause();
    this.cur = c;
    if (c.video && autoplay) { c.video.currentTime = 0; c.video.play().catch(() => {}); }
    this.mat.uniforms.map.value = c.tex;
    this.mat.uniforms.uUseChroma.value = c.chroma ? 1 : 0;
    if (c.chroma) this.mat.uniforms.uChroma.value.set(c.chroma);
    const h = c.heightCm, w = h * c.aspect;
    this.mesh.scale.set(w, h, 1);
    this.mesh.position.set(0, c.bottomCm + h / 2, 0);
    this.swap = 1; // 換動作時的小跳動
  }

  show() { this.targetOpacity = 1; this.opacity = 0; }
  hide() { this.targetOpacity = 0; }
  pokeIt() { this.poke = 1; }

  // 頭頂在螢幕上的位置（給對話泡泡用）
  headWorld() {
    const c = this.cur;
    return this.body.localToWorld(new THREE.Vector3(0, c.bottomCm + c.heightCm + 8, 0));
  }

  update(dt) {
    this.t += dt;
    const k = this.targetOpacity > this.opacity ? 2.2 : 3.0;
    this.opacity += (this.targetOpacity - this.opacity) * Math.min(1, dt * k);
    this.mat.uniforms.uOpacity.value = this.opacity;
    // 腳有踩到地（全身素材）才畫影子；半身照的影子會飄在下面很怪
    this.shadow.material.opacity = this.cur && this.cur.bottomCm < 15 ? 0.32 * this.opacity : 0;

    // 呼吸 + 被點到時的擠壓彈跳 + 換動作時的小彈
    const breathe = Math.sin(this.t * 2.1) * 0.006;
    this.poke = Math.max(0, this.poke - dt * 1.6);
    this.swap = Math.max(0, (this.swap || 0) - dt * 4);
    const squash = Math.sin(this.poke * Math.PI * 3) * this.poke * 0.09 + this.swap * 0.02;
    this.body.scale.set(1 + squash * 0.6, 1 + breathe - squash, 1);
    const rise = (1 - this.opacity) * -14;                      // 淡入時從下方升起
    const hop = Math.max(0, Math.sin(this.poke * Math.PI * 2)) * this.poke * 9;
    this.body.position.y = rise + hop;
  }
}
const guide = new Guide();

// ---------------------------------------------------------------------
// 辨識資料：config.mindFile，或現場編譯（結果快取在瀏覽器）
// ---------------------------------------------------------------------
function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("讀不到圖片：" + src));
    im.src = src;
  });
}

let compiledBuffer = null;
async function getMindSrc(images, msg) {
  if (CONFIG.mindFile) return CONFIG.mindFile;
  const key = new URL(`__mind__/v${CONFIG.targetsVersion || 1}/${points.map((p) => p.image).join("|")}`, location.href).href;
  let cache = null;
  try {
    cache = await caches.open("temple-ar-targets");
    const hit = await cache.match(key);
    if (hit) return URL.createObjectURL(await hit.blob());
  } catch {}
  const compiler = new Compiler();
  await compiler.compileImageTargets(images, (p) => msg(`第一次開啟，正在學習要辨識的圖案… ${Math.round(p)}%`));
  compiledBuffer = compiler.exportData();
  try { await cache?.put(key, new Response(compiledBuffer)); } catch {}
  return URL.createObjectURL(new Blob([compiledBuffer]));
}

// ---------------------------------------------------------------------
// AR 場景
// ---------------------------------------------------------------------
let mindar, renderer, camera;
const spots = []; // 每個可辨識目標的狀態

function buildSpot(p, index, img) {
  const aspect = img.naturalHeight / img.naturalWidth;
  const anchor = mindar.addAnchor(index);
  const pad = 0.14;
  const glowMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color("#ffc94d") },
      uSize: { value: new THREE.Vector2(1 + pad * 2, aspect + pad * 2) },
      uHalf: { value: new THREE.Vector2(0.5, aspect / 2) },
    },
    vertexShader: GLOW_VS, fragmentShader: GLOW_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1 + pad * 2, aspect + pad * 2), glowMat);
  anchor.group.add(glow);

  // 導覽人的參考座標：原點在「目標正下方的地面、離牆往前 frontCm」，單位公分
  const u = 1 / p.widthCm;
  const guideRoot = new THREE.Group();
  guideRoot.scale.setScalar(u);
  guideRoot.position.set(0, -aspect / 2 - (p.bottomCm || 0) * u, (p.stand?.frontCm ?? 50) * u);
  anchor.group.add(guideRoot);

  const s = { p, index, anchor, glow, glowMat, guideRoot, visible: false, glowTarget: 0 };
  anchor.onTargetFound = () => onFound(s);
  anchor.onTargetLost = () => onLost(s);
  return s;
}

// 導覽人要站哪裡：先試 config 的 stand.x，看不到就往目標中間挪，直到在螢幕上
// （遊客站多遠、手機直拿橫拿都不一樣，固定位置常常會跑出畫面）
function standX(s) {
  const pref = (s.p.stand?.x ?? 0.3) * s.p.widthCm;
  const c = guide.clips.default;
  const y = c.bottomCm + c.heightCm * 0.6;
  s.anchor.group.updateWorldMatrix(true, true);
  const r = renderer.domElement.getBoundingClientRect();
  const fits = (x) => {
    const v = s.guideRoot.localToWorld(new THREE.Vector3(x, y, 0)).project(camera);
    const sx = r.left + ((v.x + 1) / 2) * r.width;
    return sx > innerWidth * 0.2 && sx < innerWidth * 0.8;
  };
  const N = 30;
  for (let i = 0; i <= N; i++) { const x = pref * (1 - i / N); if (fits(x)) return x; }
  for (let i = 1; i <= N; i++) { const x = -pref * (i / N); if (fits(x)) return x; }
  return pref;
}

// ---------------------------------------------------------------------
// 狀態機
//   scanning：找目標　locked：目標發光、等點擊　touring：導覽中
// ---------------------------------------------------------------------
let state = "scanning";
let candidate = null, confirmTimer = null, unlockTimer = null, lostTimer = null;
let locked = null, active = null;
let running = true, runWaiters = [];
let tapWaiter = null;
let session = 0;
const cooldown = new Map();

function show(id, on = true) { $(id).hidden = !on; }

function setScanUI() {
  show("scanHint", state === "scanning");
  show("foundHint", state === "locked");
  if (state !== "touring") { show("lostHint", false); show("subtitle", false); show("askBubble", false); }
}

function onFound(s) {
  s.visible = true;
  if (state === "touring") {
    if (s === active) {
      clearTimeout(lostTimer);
      show("lostHint", false);
      setRunning(true);
    } else if (!running) {
      abortTour();           // 原本的目標跟丟很久，又找到別的 → 換過去
      onFound(s);
    }
    return;
  }
  if (state === "locked" && s === locked) { clearTimeout(unlockTimer); return; }
  if (state !== "scanning") return;
  if ((cooldown.get(s.p.id) || 0) > now()) return;
  candidate = s;
  clearTimeout(confirmTimer);
  // 連續追蹤一段時間才算數，避免一閃而過就跳出來
  confirmTimer = setTimeout(() => {
    if (candidate === s && s.visible && state === "scanning") lock(s);
  }, CONFIG.detect.confirmMs);
}

function onLost(s) {
  s.visible = false;
  if (candidate === s) { clearTimeout(confirmTimer); candidate = null; }
  if (state === "locked" && s === locked) {
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => {
      if (!s.visible && state === "locked") { state = "scanning"; s.glowTarget = 0; locked = null; setScanUI(); }
    }, 900);
  }
  if (state === "touring" && s === active) {
    $("lostName").textContent = s.p.name;
    show("lostHint", true);
    show("askBubble", false);
    clearTimeout(lostTimer);
    lostTimer = setTimeout(() => setRunning(false), CONFIG.detect.lostGraceMs);
  }
}

function lock(s) {
  state = "locked";
  locked = s;
  s.glowTarget = 1;
  $("foundName").textContent = `發現「${s.p.name}」`;
  setScanUI();
  navigator.vibrate?.(40);
}

function setRunning(on) {
  if (running === on) return;
  running = on;
  if (on) { speaker.resume(); runWaiters.splice(0).forEach((f) => f()); }
  else speaker.pause();
}
const whenRunning = () => (running ? Promise.resolve() : new Promise((r) => runWaiters.push(r)));

// ---------------------------------------------------------------------
// 導覽流程
// ---------------------------------------------------------------------
let typeTimer = null;
function subtitle(text, gloss = "") {
  clearInterval(typeTimer);
  show("subtitle", true);
  $("subName").textContent = NAME;
  const el = $("subText");
  const full = fill(text) + (gloss ? `（${gloss}）` : "");
  let i = 0;
  el.textContent = "";
  typeTimer = setInterval(() => {
    if (!running) return;
    el.textContent = full.slice(0, ++i);
    if (i >= full.length) clearInterval(typeTimer);
  }, 55);
}

// 講一句：line = { say, gloss?, video?, audio?, clip? }
//   video：AI 虛擬人對嘴影片（有就用它，畫面和聲音都在影片裡）
//   沒有 video 時：顯示 clip 動作 + 播 audio（或暫用朗讀）
// 志永哥的聲音（AI 複製聲音，tools/voice_gen.py 產生）：manifest 是 key → 原句，這裡反查成 原句 → 檔案
// 台詞改過就對不上、不會播到舊的錄音
const VOICE_DIR = "../shared/voice/ar/";
const voiceByText = {};
fetch(VOICE_DIR + "manifest.json").then((r) => (r.ok ? r.json() : {}))
  .then((m) => Object.entries(m).forEach(([k, raw]) => (voiceByText[raw] = VOICE_DIR + k + ".mp3"))).catch(() => {});

let speakSeq = 0;
async function speak(line, fallbackClip = "default") {
  if (!line.audio && voiceByText[line.say]) line = { ...line, audio: voiceByText[line.say] };
  const my = ++speakSeq;
  subtitle(line.say, line.gloss);
  let video = null;
  if (line.video) {
    try {
      const t = await guide.loadTalk(line.video);
      if (my !== speakSeq) return new Promise(() => {});   // 載入期間已經換下一句（例如遊客先點了），這句作廢
      guide.useTalk(t);
      video = t.video;
    } catch (e) { console.warn(e.message); }
  }
  if (!video) guide.setClip(line.clip || fallbackClip);
  await speaker.say(fill(line.say), line.audio, video);
  if (video) guide.setClip(guide.clips.idle ? "idle" : line.clip || fallbackClip); // 講完回到待機動作
  await whenRunning();
}
// 先在背景下載下一句的影片，講話之間才不會卡
const prefetch = (line) => { if (line?.video) guide.loadTalk(line.video).catch(() => {}); };

function waitTap() {
  return new Promise((resolve) => (tapWaiter = () => { tapWaiter = null; resolve(); }));
}

function askChoice(options, wrongs) {
  return new Promise((resolve) => {
    $("choices").innerHTML = "";
    options.forEach((label, i) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (wrongs.has(i)) { b.className = "wrong"; b.disabled = true; }
      b.onclick = () => { $("choices").innerHTML = ""; resolve(i); };
      $("choices").appendChild(b);
    });
  });
}

async function stepAsk(step, alive) {
  const a = { ...CONFIG.guide.ask, ...step };
  const r = { ...CONFIG.guide.react, ...(step.react || {}) };
  prefetch(r);
  $("askSay").textContent = a.say;
  $("askGloss").textContent = a.gloss ? `（${a.gloss}）` : "";
  $("askHint").textContent = a.hint;
  bubbleOn = true;
  speak(a, "think");                     // 邊講邊等，講完前點也可以
  await waitTap();
  if (!alive()) return;
  bubbleOn = false;
  show("askBubble", false);
  speaker.cancel();
  navigator.vibrate?.(25);
  guide.pokeIt();
  await speak(r, "happy");
}

// 選擇題。step.right / step.wrong 可以是字串，或 { say, video, audio }
const asLine = (x) => (typeof x === "string" ? { say: x } : x);
async function stepChoice(step, alive) {
  const right = asLine(step.right), wrong = asLine(step.wrong);
  prefetch(right); prefetch(wrong);
  await speak(step, "think");
  const wrongs = new Set();
  while (alive()) {
    const pick = await askChoice(step.options, wrongs);
    if (!alive()) return;
    if (pick === step.answer) {
      guide.pokeIt();
      await speak(right, "happy");
      return;
    }
    wrongs.add(pick);
    await speak(wrong, "think");
  }
}

async function startTour(s) {
  const my = ++session;
  const alive = () => my === session;
  state = "touring";
  active = s;
  locked = null;
  s.glowTarget = 0;
  setScanUI();
  guide.attach(s, standX(s));
  guide.show();
  await sleep(900);

  const script = s.p.script;
  prefetch(script[0]);
  for (let i = 0; i < script.length; i++) {
    const step = script[i];
    if (!alive()) return;
    await whenRunning();
    if (!alive()) return;
    prefetch(script[i + 1]);
    if (step.type === "ask") await stepAsk(step, alive);
    else if (step.type === "choice") await stepChoice(step, alive);
    else await speak(step);
    await sleep(280);
  }
  if (!alive()) return;

  // 結束：揮手、淡出、蓋章
  guide.setClip("wave");
  await sleep(500);
  guide.hide();
  show("subtitle", false);
  stamps.add(s.p.id);
  writeStore();
  renderProgress();
  const left = CONFIG.points.filter((p) => !stamps.has(p.id)).length;
  $("stampText").textContent = s.p.stamp;
  $("stampMsg").textContent = left ? `收集到「${s.p.stamp}」章！還有 ${left} 個故事點` : "六個故事點都找到了，謝謝你來泰興宮！";
  show("stampToast", true);
  navigator.vibrate?.([30, 60, 30]);
  await sleep(2400);
  show("stampToast", false);
  if (!alive()) return;
  endTour(s);
}

function endTour(s) {
  cooldown.set(s.p.id, now() + 8000);   // 剛聽完的目標，8 秒內不會再跳出來
  candidate = null;
  state = "scanning";
  active = null;
  setScanUI();
}

function abortTour() {
  session++;
  speaker.cancel();
  clearInterval(typeTimer);
  clearTimeout(lostTimer);
  tapWaiter = null;
  bubbleOn = false;
  $("choices").innerHTML = "";
  guide.hide();
  const s = active;
  running = true;
  runWaiters.splice(0).forEach((f) => f());
  speaker.paused = false;
  if (s) endTour(s);
}

// ---------------------------------------------------------------------
// 點擊
// ---------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
function hitGuide(e) {
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObject(guide.mesh).length > 0;
}

$("tap").addEventListener("pointerdown", (e) => {
  if (state === "locked" && locked) { startTour(locked); return; }
  if (state === "touring" && tapWaiter && active?.visible) {
    if (hitGuide(e)) tapWaiter();
    else { const b = $("askBubble"); b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; }
  }
});
$("askBubble").addEventListener("click", () => tapWaiter?.());
$("subtitle").addEventListener("click", () => { clearInterval(typeTimer); }); // 點字幕：停止打字效果（之後可改成跳下一句）

// ---------------------------------------------------------------------
// 每一幀
// ---------------------------------------------------------------------
let bubbleOn = false;
let last = now();
function frame() {
  const t = now();
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;

  for (const s of spots) {
    const u = s.glowMat.uniforms;
    u.uTime.value += dt;
    u.uOpacity.value += (s.glowTarget - u.uOpacity.value) * Math.min(1, dt * 5);
    // 冷卻結束、目標還在畫面上 → 再給一次機會
    if (state === "scanning" && s.visible && candidate !== s && (cooldown.get(s.p.id) || 0) < t) onFound(s);
  }
  guide.update(dt);

  // 對話泡泡跟著導覽人的頭
  const b = $("askBubble");
  if (bubbleOn && active?.visible && guide.cur) {
    const v = guide.headWorld().project(camera);
    const r = renderer.domElement.getBoundingClientRect();
    const half = b.offsetWidth / 2 + 10;
    const x = Math.min(innerWidth - half, Math.max(half, r.left + ((v.x + 1) / 2) * r.width));
    const y = Math.min(innerHeight * 0.6, Math.max(150, r.top + ((1 - v.y) / 2) * r.height));
    b.style.left = x + "px";
    b.style.top = y + "px";
    b.hidden = false;
  } else if (!b.hidden) b.hidden = true;

  renderer.render(mindar.scene, camera);
}

// ---------------------------------------------------------------------
// 啟動
// ---------------------------------------------------------------------
// 在 LINE、Facebook、Instagram 等 App 裡面打開的網頁，常常不能開相機
const IN_APP = /\bLine\/|FBAN|FBAV|Instagram|MicroMessenger|; wv\)/i.test(navigator.userAgent);
let stage = "";

function fail(err) {
  console.error(stage, err);
  const name = err?.name || "";
  let text;
  if (!window.isSecureContext) text = "相機只能在 https 網址下使用。";
  else if (!navigator.mediaDevices?.getUserMedia) text = "這個瀏覽器不能開相機。";
  else if (name === "NotAllowedError" || name === "SecurityError")
    text = IN_APP ? "這個 App 裡的瀏覽器不讓網頁開相機。"
      : "相機權限沒有開。① 如果出現「This site can't ask for your permission」：是畫面上有其他 App 的懸浮視窗"
        + "（聊天泡泡、螢幕錄影、護眼／夜間濾鏡、懸浮球），先把它們關掉。"
        + "② 或直接手動開：點網址列左邊的圖示 → 權限（或「網站設定」）→ 相機 → 允許，再按下面的重新整理。"
        + "③ 還是不行：手機「設定 → 應用程式 → Chrome → 權限 → 相機」要是允許。";
  else if (name === "NotReadableError" || name === "AbortError") text = "相機被其他 App 佔用了（例如相機、視訊通話）。請先關掉它們再試。";
  else if (name === "NotFoundError" || name === "OverconstrainedError") text = "找不到可以用的相機。";
  else text = (err?.message || String(err ?? "未知錯誤"));
  if (IN_APP || !navigator.mediaDevices?.getUserMedia) text += " 請改用 Chrome 開啟這個網址。";
  const el = $("error");
  el.innerHTML = "";
  const p = document.createElement("p");
  p.textContent = `啟動失敗（${stage}）：${text}`;
  const detail = document.createElement("p");
  detail.className = "fine";
  detail.textContent = `錯誤代碼：${name || "無"}｜${navigator.userAgent.match(/\(([^)]+)\)/)?.[1] || ""}`;
  const retry = document.createElement("button");
  retry.className = "primary";
  retry.textContent = "重新整理再試一次";
  retry.onclick = () => location.reload();
  el.append(p, detail, retry);
  if (IN_APP && /Android/i.test(navigator.userAgent)) {
    const a = document.createElement("a");
    a.className = "primary";
    a.style.cssText = "display:inline-block;margin-left:8px;text-decoration:none";
    a.textContent = "用 Chrome 開啟";
    a.href = `intent://${location.host}${location.pathname}#Intent;scheme=https;package=com.android.chrome;end`;
    el.append(a);
  }
  show("error", true);
}

// 先自己開一次相機，拿到真正的錯誤原因（MindAR 失敗時不會告訴我們為什麼）
async function checkCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no getUserMedia"), { name: "NotSupportedError" });
  let s;
  try { s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }); }
  catch (e) {
    if (e.name !== "OverconstrainedError") throw e;
    s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
  s.getTracks().forEach((t) => t.stop());
}

async function start() {
  const btn = $("startBtn");
  btn.disabled = true;
  speaker.unlock();
  const msg = (t) => { $("loadMsg").textContent = t; show("loadMsg", true); };
  try {
    stage = "開啟相機";
    msg("開啟相機…（請按「允許」）");
    await checkCamera();
    stage = "載入素材";
    msg("載入素材…");
    const images = await Promise.all(points.map((p) => loadImage(p.image)));
    stage = `載入${NAME}`;
    await guide.preload((f) => msg(`載入${NAME}… ${Math.round(f * 100)}%`));
    stage = "載入辨識資料";
    const src = await getMindSrc(images, msg);
    stage = "啟動辨識";
    msg("啟動辨識…");
    mindar = new MindARThree({
      container: $("ar"), imageTargetSrc: src, maxTrack: 1,
      uiLoading: "no", uiScanning: "no", uiError: "no",
      warmupTolerance: 5, missTolerance: 10,
    });
    renderer = mindar.renderer;
    camera = mindar.camera;
    points.forEach((p, i) => spots.push(buildSpot(p, i, images[i])));
    // MindAR 失敗時不帶錯誤原因，這裡補上
    await mindar.start().catch((e) => { throw e || new Error("相機或辨識引擎啟動失敗"); });
    show("start", false);
    show("hud", true);
    setScanUI();
    renderer.setAnimationLoop(frame);
    if (DEBUG) debugTools();
  } catch (err) {
    btn.disabled = false;
    fail(err);
  }
}

function debugTools() {
  window.__ar = {
    spots, guide, get state() { return state; },
    // 導覽人身體中心在螢幕上的位置（測試用）
    guideScreen() {
      const c = guide.cur;
      const v = guide.body.localToWorld(new THREE.Vector3(0, c.bottomCm + c.heightCm / 2, 0)).project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
  };
  if (compiledBuffer) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([compiledBuffer]));
    a.download = "targets.mind";
    a.textContent = "下載 targets.mind（編譯好的辨識檔）";
    a.className = "fine";
    $("targetLinks").after(a);
  }
}

renderMenu();
$("startBtn").addEventListener("click", start);
