// =====================================================================
// 內容設定：改導覽內容、換素材，只要動這個檔案
// 標 【待實測】 的數字是佔位值，要到現場量過再改
// =====================================================================

export const CONFIG = {
  temple: "慶東泰興宮",
  title: "跟志永哥逛泰興宮",

  // 已經編譯好的辨識檔（用 tools/compile.html 產生）。
  // 留空 = 每次開網頁時現場編譯 targets 裡的圖片（較慢，開發時用）
  // ⚠ 換了辨識照片、或增減有劇本的導覽點，都要重新編譯這個檔案（順序 = points 裡有 image 的順序）
  mindFile: "assets/targets.mind",
  // 換了任何一張辨識照片（檔名沒變、內容變了）就把這個數字加 1，手機才會重新編譯
  targetsVersion: 1,

  // ---------- 辨識判定 ----------
  detect: {
    confirmMs: 450,      // 連續追蹤到多久才算「掃到了」（避免一閃而過誤觸）
    lostGraceMs: 1800,   // 跟丟後多久才暫停講解（短暫晃到不會中斷）
  },

  // ---------- 導覽人 ----------
  guide: {
    name: "志永哥",
    // 每個「動作」對應一個素材。
    //   圖片：{ img: "...webp" }（透明背景）
    //   綠幕影片：{ video: "...mp4", chroma: "#00b140", loop: true }
    // heightCm = 素材畫面代表的實際高度；bottomCm = 素材底邊離地面多高
    // 目前是隊友版本的半身照（佔位），之後換成志永哥綠幕全身影片
    clips: {
      default: { img: "assets/guide/guide-real-default.webp", heightCm: 92, bottomCm: 80 },
      wave:    { img: "assets/guide/guide-real-wave.webp",    heightCm: 92, bottomCm: 80 },
      point:   { img: "assets/guide/guide-real-point.webp",   heightCm: 92, bottomCm: 80 },
      think:   { img: "assets/guide/guide-real-think.webp",   heightCm: 92, bottomCm: 80 },
      happy:   { img: "assets/guide/guide-real-happy.webp",   heightCm: 92, bottomCm: 80 },
      intro:   { img: "assets/guide/guide-real-intro.webp",   heightCm: 120, bottomCm: 50 },
    },
    // ★ AI 虛擬人版本：每一句台詞配一段「對嘴講話影片」，寫在那一步的 video 欄位，例如
    //     { say: "門上這兩位是門神…", video: "assets/clips/door-02.webm" }
    //   影片自己有聲音，播完才進下一句；沒有 video 的句子才用上面的 clips 動作圖。
    //   建議另外做一段 idle（待機：站著、眨眼、微微晃動、循環播放），寫進 clips：
    //     idle: { video: "assets/clips/idle.webm", heightCm: 172, bottomCm: 0 },
    // talk：所有講話影片共用的尺寸設定（影片畫面代表的實際高度、底邊離地、去背）
    //   透明背景 WebM 不用寫 chroma；綠幕影片寫 chroma: "#00b140"（綠幕的顏色）
    talk: { heightCm: 172, bottomCm: 0 },

    // 志永 10 個動作影片拍好後的對應建議（檔名自訂）：
    //   happy 開心笑 / angry 插腰生氣 / point 指前面激動 / think 抓頭疑惑
    //   sweat 摸額頭擦汗 / smart 手指指頭聰明樣 / idle 待機 / poked 被點到 / wave 揮手

    // 「聽懂了嗎」互動的預設台詞（每一站也可以自己改）
    ask:   { say: "啊哩唔tia唔波？", gloss: "啊你有聽懂嗎？", hint: "聽懂點我" },
    react: { say: "吼啦我仔哩唔tia！", gloss: "好啦我知道你有聽", clip: "happy" },
  },

  // ---------- 語音 ----------
  // 每一句可以加 audio: "assets/voice/xxx.mp3"（志永哥真人錄音）。
  // 沒有音檔的句子，暫時用手機內建朗讀（ttsFallback），或只顯示字幕。
  voice: { ttsFallback: true, lang: "zh-TW", rate: 1.0, msPerChar: 230 },

  // ---------- 導覽點 ----------
  // image：辨識用的主照片（正對、平行拍、沒有人擋）
  // widthCm：照片範圍的實際寬度；bottomCm：照片底邊離地多高 → 用來算「地面」在哪
  // stand：導覽人站的位置。
  //   x：站在目標寬度的哪裡（-0.5 左邊緣、0 正中、0.5 右邊緣）。
  //      遊客通常會把目標塞滿螢幕，所以站在目標「前面、偏一側」才看得到他
  //   frontCm：離牆面往前站多少公分
  points: [
    {
      id: "door",
      hall: "一進",
      name: "三川門・門神",
      stamp: "門神",
      image: "assets/targets/door-gods.webp",
      widthCm: 260, bottomCm: 70,                          // 【待實測】
      stand: { x: 0.3, frontCm: 80 },
      script: [
        { clip: "wave",  say: "歡迎來到泰興宮！我是志永哥，我們就從大門開始。" },
        { clip: "point", say: "門上這兩位是「門神」，專門幫廟守門的將軍。" },
        { say: "一位是秦叔寶，一位是尉遲恭，兩位都是唐朝的大將。" },
        { type: "ask" },
        { type: "choice", clip: "think",
          say: "考考你：黑臉、眼睛瞪得大大的，是哪一位？",
          options: ["秦叔寶", "尉遲恭"], answer: 1,
          wrong: "嘿，秦叔寶是白臉、留長鬍子的那位，再想想！",
          right: "答對了！黑臉的就是尉遲恭。" },
        { clip: "default",
          say: "傳說唐太宗晚上被惡鬼吵得睡不好，就請這兩位將軍站在宮門口守夜。後來民間就把他們畫在門上保平安。" },
        { type: "ask" },
        { clip: "wave", say: "好，門神看完了，我們進去裡面看看！" },
      ],
    },
    {
      id: "beam",
      hall: "一進",
      name: "橫樑上的動物",
      stamp: "樑上",
      image: "",                                            // 待拍攝
      script: [],
    },
    {
      id: "king",
      hall: "一進",
      name: "正神・三山國王",
      stamp: "國王",
      image: "",                                            // 待和廟方確認辨識目標（不對著神像）
      script: [],
    },
    {
      id: "board",
      hall: "一進",
      name: "集資建廟的木牌",
      stamp: "開庄",
      image: "assets/targets/guowang-board.webp",
      widthCm: 110, bottomCm: 90,                           // 【待實測】
      stand: { x: -0.28, frontCm: 50 },                   // 站在紅牌前面，不擋住黑色木牌
      script: [
        { clip: "point", say: "你看這塊黑色的木牌，最上面寫著「國王宮」，就是泰興宮最早的名字。" },
        { say: "旁邊寫著「咸豐辛亥元年」，就是 1851 年，大家開始集資建廟的那一年。" },
        { clip: "think",
          say: "木牌上刻了三位先賢：張寧壽、楊及億、張登龍。他們捐出田產，用田租來支持廟裡的祭祀。" },
        { type: "ask" },
        { type: "choice", clip: "think",
          say: "考考你：「國王宮」是泰興宮的什麼？",
          options: ["最早的名字", "後殿的名字", "神明的生日"], answer: 0,
          wrong: "再看一次木牌最上面那三個字！",
          right: "沒錯！國王宮就是最早的廟名。" },
        { clip: "happy", say: "一座廟，是整個庄頭的人一起出錢出力蓋起來的。" },
      ],
    },
    {
      id: "mural",
      hall: "二進",
      name: "壁畫與歷史雕塑",
      stamp: "壁畫",
      image: "",                                            // 待拍攝
      script: [],
    },
    {
      id: "dragon",
      hall: "三進",
      name: "龍神樹",
      stamp: "龍神",
      image: "assets/targets/longshen.webp",
      widthCm: 600, bottomCm: 0,                            // 【待實測】
      stand: { x: -0.3, frontCm: 150 },
      script: [
        { clip: "wave", say: "走到泰興宮的最裡面，就是這棵大榕樹。" },
        { say: "樹下這座小亭子，供奉的是大茅埔的「龍神」。" },
        { type: "choice", clip: "think",
          say: "客家人說的「龍」，指的是什麼？",
          options: ["山", "河", "天上的雲"], answer: 0,
          wrong: "提示：轉身看看廟的後面是什麼？",
          right: "答對！客家人把山叫作「龍」，龍神其實就是山神。" },
        { type: "ask" },
        { clip: "point", say: "經過大樹的時候，記得不要攀爬、不要折樹枝喔！" },
      ],
    },
  ],

  // 佔位素材的來源（上線前要換成自己拍的、並列出授權）
  credits: [
    "門神照片：Isocyclo，Wikimedia Commons〈202104 WMTW x HPCF workshop 190〉，CC BY-SA 4.0",
    "國王宮木牌、龍神照片、志永哥照片：TempleGo 團隊 2026 年 11 月拍攝",
    "導覽內容改寫自 TempleGo（github.com/Pang-Yiyi/TempleGo）",
  ],
};
