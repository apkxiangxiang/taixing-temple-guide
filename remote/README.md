# TempleGo：東勢泰興宮手機導覽

由在地導覽員「志永哥」帶路的互動式廟宇導覽網站，介紹台中東勢大茅埔的泰興宮（三山國王廟）與庄頭的故事。手機優先、免安裝、可離線使用。

- **網站**：https://pang-yiyi.github.io/TempleGo/
- **Repo**：https://github.com/Pang-Yiyi/TempleGo

> 這份 README 是給組員看的：網站有哪些功能、檔案放在哪、要改內容該動哪裡。

---

## 目錄
1. [網站功能一覽](#網站功能一覽)
2. [在自己電腦上打開](#在自己電腦上打開)
3. [檔案結構](#檔案結構)
4. [改內容：只要動 `js/data.js`](#改內容只要動-jsdatajs)
5. [大茅埔山水籤：二十支籤一覽](#大茅埔山水籤二十支籤一覽)
6. [加照片的規則](#加照片的規則)
7. [更新網站（部署）](#更新網站部署)
8. [內容原則（一定要遵守）](#內容原則一定要遵守)
9. [待辦與待確認](#待辦與待確認)
10. [資料與照片來源](#資料與照片來源)

---

## 網站功能一覽

### 遊客的路線
開場（志永哥全身照）→ **大茅埔總覽圖**（左右滑動，看四營與泰興宮）→ **泰興宮鳥瞰圖**（6 個導覽點）→ 每站導覽 → 蓋章 → 集滿 6 個章領「集章完成卡」

### 六個導覽點
| 站 | 名稱 | 印章 | 重點 |
|---|---|---|---|
| 1 | 廟埕・大林埔的起點 | 開庄 | 廟埕環景、山門、聚落規劃（護城河、刺竹、水口轉彎）、「大林埔」地名 |
| 2 | 三川門・門神 | 門神 | 秦叔寶與尉遲恭、三川門背面「國泰」「民安」、正殿外觀 |
| 3 | 龍邊階梯・犒將 | 犒將 | 每月初二、十六的犒將儀式、龍邊虎邊、四方將寮與五營令旗；會依今天的農曆提示下次犒將日 |
| 4 | 正殿・三山國王 | 國王 | 正殿環景、「國王宮」木牌、三山國王的由來 |
| 5 | 後殿・弼教堂 | 弼教 | 正殿後方桂花樹環景、中庭環景、鴉片與三恩主的故事 |
| 6 | 宮內深處・龍神 | 龍神 | 化胎上的龍神榕、龍神香位、取水習俗、龍神山水祭、石虎與咬人貓 |

### 每站的互動方式
- **對話**：志永哥一句一句講，打字機效果；點一下顯示整句、再點進下一句
- **找細節**：照片或環景上有發光點，全部點過才能繼續
- **問答**：選擇題，或在照片上點出正確位置
- **抬頭看**：提醒遊客放下手機看實物
- **環景**：手指拖曳或「轉動手機看」（陀螺儀），看半圈環景

### 地圖右上角：大茅埔山水籤
- 20 支在地創作的趣味籤詩（十天干各兩支，結合五行與東勢的水果、動植物、大茅埔故事）。流程：選出生年尾數算本命天干（可跳過）→ 搖籤筒 → 擲筊 → 看籤紙 → 存成籤卡（含 QR Code）

### 其他
- 開場的「照片與資料來源」列出所有照片作者與授權
- 離線可用（PWA）：打開過一次，之後沒網路也能看
- 手機開啟「減少動態效果」時，動畫會自動關閉

---

## 在自己電腦上打開

需要 Python（任何版本 3 都可以）。

```bash
cd TempleGo
python -m http.server 8000
```

用瀏覽器開 `http://localhost:8000`，按 F12 → 切換成手機尺寸檢視。

- 一定要用網址開，**直接雙擊 `index.html` 環景會無法顯示**
- 「轉動手機看」需要 https，本機測不到，請在正式網站用手機測

---

## 檔案結構

```
index.html            畫面骨架（各個畫面的 HTML）
css/style.css         樣式與動畫
js/data.js            ★ 所有內容：對白、熱點、題目、籤詩、照片來源
js/app.js             互動邏輯（對話、問答、環景、蓋章、山水籤、籤卡）
sw.js                 離線快取（改了檔案要把 VERSION 加 1）
docs/qian/            二十支籤的籤卡截圖（README 用，網站不會載入）
manifest.webmanifest  加到主畫面用的設定
assets/
  img/guide-real-*.webp   志永哥的動作照（intro 全身；其他是統一大小的半身）
  img/guide-q-*.svg       Q 版志永哥（備用）
  img/*-scroll.svg        各站的故事長卷插畫（含動畫）
  img/map.svg             泰興宮鳥瞰示意圖
  img/damaopu-overview.svg 大茅埔總覽圖
  img/qr-site.png         網站 QR Code（籤卡用）
  photos/                 實景照片與環景
  icons/                  網站圖示
```

**不在 repo 裡的資料**（只在負責人電腦上）：`素材/`（現場原始照片、影片）、`research/`（查證筆記）、`開發筆記.md`。需要的話請跟負責人要。

---

## 改內容：只要動 `js/data.js`

改對白、題目、籤詩都不用碰 `app.js`。`data.js` 裡的主要區塊：

| 區塊 | 內容 |
|---|---|
| `temple` | 廟名、副標 |
| `guide` | 導覽員名字與各動作的圖片 |
| `photos` | 每張照片的標題、作者、授權、修改方式 |
| `map` / `overview` | 鳥瞰圖、總覽圖的設定與台詞 |
| `stops` | 6 個導覽點（見下方） |
| `guoqian` | 大茅埔山水籤（20 支籤、本命五行生剋） |

### 一個導覽點長什麼樣子
```js
{
  id: "longshen",                 // 代號（集章用，不要改）
  title: "宮內深處・龍神",
  pin: { n: 6, x: 50, y: 16 },    // 地圖上的編號與位置（%）
  ready: true,                    // false 會顯示「製作中」
  intro: "點地圖時跳出的介紹",
  image: "assets/photos/longshen.webp",   // 預設畫面
  pano: "assets/photos/xxx-pano.webp",    // （選填）環景
  panoView: { haov: 187, vaov: 80 },      // （選填）手機半圈環景的角度
  stamp: "龍神",                  // 印章上的字
  hotspots: [ ... ],              // 可以點的發光點
  script: [ ... ],                // 一步一步的對白
}
```

### script 的每一步
最基本的一步：`{ say: "志永哥說的話" }`

可以加的欄位：

| 欄位 | 用途 |
|---|---|
| `pose` | 志永哥的動作：`default`、`wave`、`point`、`think`、`happy`、`fruit` |
| `image` | 換成另一張照片或插畫 |
| `scene: "pano"` | 切到環景；可再加 `pano`、`panoView` 指定另一張環景 |
| `focus` | 照片：捲到寬度的幾 %（例如 `50`）；環景：`{ yaw, pitch }` |
| `type` | 互動類型，見下表 |

| `type` | 效果 | 要搭配的欄位 |
|---|---|---|
| （不填） | 一般對話 | — |
| `explore` | 找出發光點，全部點過才能繼續 | `targets: ["熱點id"]`、`done: "找完後的台詞"` |
| `choice` | 文字選擇題 | `options: [...]`、`answer: 正確選項的索引`、`wrong`、`right` |
| `quiz` | 在照片上點出正確位置 | `choices: ["熱點id"]`、`answer: "熱點id"`、`wrong`、`right` |
| `lookup` | 全螢幕「抬頭看」提示 | — |

### 熱點（hotspots）
```js
{ id: "longshenSign", img: "assets/photos/longshen.webp", x: 47.5, y: 49,
  title: "「龍神」", desc: "點開後的說明" }
```
- `x`、`y` 是照片上的位置（%）；`img` 寫這個熱點屬於哪張照片
- 環景的熱點改用 `yaw`（左右角度）、`pitch`（上下角度）

### 台詞裡的特殊字
- `{name}`：導覽員名字
- `{lunarHint}`：依今天農曆自動產生的犒將日提示


## 大茅埔山水籤：二十支籤一覽

籤的內容都在 `js/data.js` 的 `guoqian.signs`，依籤號順序排列（第一籤在最前面）。下表的「位置」可以直接點到 GitHub 上那一支籤的程式碼；改過檔案後行號可能會變，找不到時在 `data.js` 搜尋籤的標題即可。

![二十支籤總覽](docs/qian/overview.jpg)

| 籤 | 天干五行 | 吉凶 | 主題 | 位置（data.js） | 籤卡 |
|---|---|---|---|---|---|
| 第一籤 | 甲・木 | 上上 | 高接梨・老樹接新花 | [第 160 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L160) | [看圖](docs/qian/qian-01.jpg) |
| 第二籤 | 甲・木 | 大吉 | 龍神榕・化胎護庄頭 | [第 169 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L169) | [看圖](docs/qian/qian-02.jpg) |
| 第三籤 | 乙・木 | 上吉 | 伯公樹・種子傳新苗 | [第 178 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L178) | [看圖](docs/qian/qian-03.jpg) |
| 第四籤 | 乙・木 | 中吉 | 梨花・一朵一朵親手授 | [第 187 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L187) | [看圖](docs/qian/qian-04.jpg) |
| 第五籤 | 丙・火 | 大吉 | 甜柿・秋陽曬得紅 | [第 196 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L196) | [看圖](docs/qian/qian-05.jpg) |
| 第六籤 | 丙・火 | 大吉 | 咬人貓・帶刺的守護 | [第 205 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L205) | [看圖](docs/qian/qian-06.jpg) |
| 第七籤 | 丁・火 | 中吉 | 螢火蟲・溪邊的小燈 | [第 214 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L214) | [看圖](docs/qian/qian-07.jpg) |
| 第八籤 | 丁・火 | 上吉 | 五行紙船・水上星河 | [第 223 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L223) | [看圖](docs/qian/qian-08.jpg) |
| 第九籤 | 戊・土 | 上吉 | 石虎・淺山的守護者 | [第 232 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L232) | [看圖](docs/qian/qian-09.jpg) |
| 第十籤 | 戊・土 | 上上 | 莊背山・背山面溪 | [第 241 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L241) | [看圖](docs/qian/qian-10.jpg) |
| 第十一籤 | 己・土 | 上上 | 椪柑・金黃藏好運 | [第 250 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L250) | [看圖](docs/qian/qian-11.jpg) |
| 第十二籤 | 己・土 | 上吉 | 果園夜訪客・山羌白鼻心 | [第 259 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L259) | [看圖](docs/qian/qian-12.jpg) |
| 第十三籤 | 庚・金 | 中吉 | 五月桃・桃木斬煩惱 | [第 268 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L268) | [看圖](docs/qian/qian-13.jpg) |
| 第十四籤 | 庚・金 | 中吉 | 門神・將軍守廟門 | [第 277 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L277) | [看圖](docs/qian/qian-14.jpg) |
| 第十五籤 | 辛・金 | 大吉 | 巨峰葡萄・串串似珠玉 | [第 286 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L286) | [看圖](docs/qian/qian-15.jpg) |
| 第十六籤 | 辛・金 | 大吉 | 桂花樹・金粒暗飄香 | [第 295 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L295) | [看圖](docs/qian/qian-16.jpg) |
| 第十七籤 | 壬・水 | 中吉 | 大茅埔圳・水繞庄頭 | [第 304 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L304) | [看圖](docs/qian/qian-17.jpg) |
| 第十八籤 | 壬・水 | 上吉 | 平安水・神明帶路取溪水 | [第 313 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L313) | [看圖](docs/qian/qian-18.jpg) |
| 第十九籤 | 癸・水 | 大吉 | 桶柑茂谷・晚來更芬芳 | [第 322 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L322) | [看圖](docs/qian/qian-19.jpg) |
| 第二十籤 | 癸・水 | 中吉 | 軟埤坑山泉・涓滴養庄頭 | [第 331 行](https://github.com/Pang-Yiyi/TempleGo/blob/main/js/data.js#L331) | [看圖](docs/qian/qian-20.jpg) |

**每支籤的欄位**
```js
{
  gan: "甲", wx: "木", luck: "上上", icon: "pear",   // 天干、五行、吉凶、小插圖（插圖在 app.js 的 ICONS）
  title: "高接梨・老樹接新花",
  poem: ["老樹根深立山頭", "寒冬接穗意難休", "一枝新芽開白雪", "換得甜梨夏日收"],  // 七言四句
  say: "志永哥解籤的話",
  advice: { "求事": "...", "學業": "...", "感情": "...", "出外": "..." },
  note: "小知識",
  season: { months: [6, 7, 8, 9], text: "產季說明", now: "當月在 months 裡時顯示的句子" },
}
```
- 籤卡圖片在 `docs/qian/`，是目前內容的截圖；改了籤詩之後圖片不會自動更新，請重新截圖或跟負責人說
- 每個天干固定兩支（奇數籤、偶數籤），新增或刪除時請保持這個規則，本命五行的生剋才會平均

---

## 加照片的規則

1. **壓縮**：轉成 WebP，寬度約 1600px，一張盡量在 500KB 以內（環景約 3000px、700KB 以內）
2. **放到** `assets/photos/`
3. **登記來源**：在 `data.js` 的 `photos` 加一筆，畫面上才會自動顯示拍攝者
   ```js
   "assets/photos/xxx.webp": {
     title: "照片標題", own: true, edit: "IMG_1234 裁切、縮放" },        // 團隊自己拍的
   "assets/photos/yyy.webp": {
     title: "照片標題", author: "作者", license: "CC0", edit: "縮放",    // 網路照片
     page: "https://commons.wikimedia.org/wiki/File:..." },
   ```
   - 沒寫 `license` 的網路照片會顯示 CC BY-SA 4.0
   - 直式照片加 `fit: "width"`，會改成上下滑動
4. **加進離線快取**：把路徑加進 `sw.js` 的 `PRECACHE`，並把 `VERSION` 加 1（例如 `v39` → `v40`）

---

## 更新網站（部署）

網站用 GitHub Pages，推上 `main` 就會自動更新，約 1 分鐘生效。

```bash
git add <改過的檔案>
git commit -m "說明這次改了什麼"
git push
```

- **每次改了任何檔案都要把 `sw.js` 的 `VERSION` 加 1**，遊客手機才會抓到新版（打開網站時會自動更新）
- 推之前先在本機打開測一遍，至少把改到的那一站玩到蓋章
- 檢查是否上線：開 `https://pang-yiyi.github.io/TempleGo/sw.js`，看 `VERSION` 是不是新的

---

## 內容原則（一定要遵守）

- **人像與隱私**
  - 志永哥的照片已取得本人同意使用
  - 其他入鏡者要先取得同意；沒同意的**臉部要模糊**
  - 照片裡的**車牌一律模糊**
- **藥籤不公開**：因法規考量，網站不做藥籤，也不顯示任何藥方或療效
- **山水籤是趣味創作**：籤紙與籤卡都要標示「不是泰興宮的正式籤詩」；不引導購買、不放店家與價格
- **以現場體驗為主**：網站負責介紹與引導，龍神山水祭的拓繪、放紙船等活動只介紹，鼓勵遊客到現場參加
- **照片授權**：只用自己拍的，或 Wikimedia Commons 等開放授權（CC BY、CC BY-SA、CC0）的照片，並登記作者；Google 地圖、新聞照片不能直接用
- **內容要有來源**：新寫的歷史、民俗內容請先查證；不確定的說法先寫保守一點，並列進待確認清單

---

## 待辦與待確認

### 請廟方或志永哥確認
- [ ] 中庭地面羅盤圖案的意義、兩側兩座塔形建築的名稱
- [ ] 龍神兩側石雕是什麼動物、龍神左邊貼紅紙的小屋供奉什麼
- [ ] 南營在大茅埔總覽圖上的實際位置
- [ ] 犒將供品是「酒肉各六碗」還是「各 36 碗」（兩份資料不同）
- [ ] 三恩主神位的左右位置、哪兩對對聯是邱丙坤所寫
- [ ] 「大林埔」地名的說法
- [ ] 桂花樹的開花時間

### 補拍
- [ ] 志永哥笑著拿水果的照片（目前的「拿水果」表情比較嚴肅）
- [ ] 龍神亭近照、化胎
- [ ] 沒有人擋住的門神正面
- [ ] 有機會的話，拍初二、十六的犒將實況

### 功能
- [ ] 用手機實測「轉動手機看」（iPhone 要允許動作與方向）
- [ ] 錄製志永哥的語音
- [ ] 鳥瞰圖改用空拍照或實測平面圖

---

## 資料與照片來源

完整清單在網站開場的「照片與資料來源」。主要參考：
- 邱民雄〈大茅埔泰興宮三山國王〉、徐登志〈犒將〉（教育部臺灣客語辭典）
- 《茅埔成庄》（臺中市文化局）、農業部〈我的幸福小地方〉、維基百科〈慶東泰興宮〉〈大茅埔圳〉
- 東勢區公所農業發展統計、客新聞與中央社關於龍神山水祭、大茅埔調查團的報導
- 照片：團隊 2026 年 11 月實地拍攝；部分來自 Wikimedia Commons（含大茅埔調查團上傳的照片），作者與授權見網站

套件：[Pannellum 2.5.6](https://pannellum.org/)（環景）。
