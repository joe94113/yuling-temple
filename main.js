import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getDatabase,
    ref,
    push,
    onValue,
    update,
    remove,
    limitToLast,
    query,
    runTransaction,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDH42n_ZBKWDqoniS2sQXlcVGLcQ0yVmBE",
    authDomain: "yuling-temple.firebaseapp.com",
    projectId: "yuling-temple",
    databaseURL: "https://yuling-temple-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "yuling-temple.firebasestorage.app",
    messagingSenderId: "463197515285",
    appId: "1:463197515285:web:8cbf45a9e3e583d846e81c",
    measurementId: "G-C8F473WY7F",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 🔐 管理員驗證 ---
let isAdmin = false;
window.adminAction = async (cb) => {
    if (isAdmin) {
        cb();
        return;
    }
    const { value: pw } = await Swal.fire({
        title: "🔑 聖殿密鑰驗證",
        html: '此處為聖殿禁區<br><small style="color: #888;">管理員請輸入 密碼 解除封印</small>',
        input: "password",
        confirmButtonText: "解除封印",
        inputAttributes: { autocapitalize: "off", autocorrect: "off" },
    });

    if (pw === "0224") {
        isAdmin = true;
        Swal.fire({ icon: "success", title: "封印解除", showConfirmButton: false, timer: 1000 });
        cb();
    } else if (pw) Swal.fire("驗證失敗", "凡人不可僭越", "error");
};

window.showAdminPanel = () => {
    document.getElementById("admin-panel").style.display = "block";
    document.getElementById("unlock-admin-btn").style.display = "none";
    document.getElementById("admin-panel").scrollIntoView({ behavior: "smooth" });
};

// --- 🌬️ 上香 ---
window.burnIncense = () => {
    const audio = document.getElementById("wood-sound").cloneNode();
    audio.volume = 0.6;
    audio.play();
    runTransaction(ref(db, "stats/incenseCount"), (c) => (c || 0) + 1);

    const emitter = document.getElementById("fx-emitter");
    for (let i = 0; i < 4; i++) {
        const p = document.createElement("div");
        p.className = "smoke-particle";
        p.style.width = `${Math.random() * 40 + 30}px`;
        p.style.height = p.style.width;
        p.style.left = `${Math.random() * 80 + 10}%`;
        p.style.animationDuration = `${Math.random() * 2 + 2}s`;
        emitter.appendChild(p);
        setTimeout(() => p.remove(), 4000);
    }

    const txt = document.createElement("div");
    txt.className = "merit-text text-sm";
    txt.innerText = Math.random() > 0.8 ? "煩惱 -1" : "功德 +1";
    txt.style.transform = `translateX(${Math.random() * 40 - 20}px)`;
    emitter.appendChild(txt);
    setTimeout(() => txt.remove(), 1000);

    confetti({ particleCount: 15, origin: { y: 0.8 }, spread: 40, colors: ["#ffd700"] });
};

// --- ✨ 神光系統 ---
onValue(ref(db, "stats/incenseCount"), (s) => {
    const c = s.val() || 0;
    document.getElementById("incense-count").innerText = c;
    const frame = document.getElementById("photo-frame");
    frame.classList.remove("aura-1", "aura-2", "aura-3");
    if (c >= 5000) frame.classList.add("aura-3");
    else if (c >= 1000) frame.classList.add("aura-2");
    else frame.classList.add("aura-1");
});

// --- 🏆 稱號與排行榜 ---
const getTitle = (count) => {
    if (count > 50) return { t: "聖宮守護神", c: "rank-god" };
    if (count > 20) return { t: "首席大檀越", c: "rank-chief" };
    if (count > 5) return { t: "虔誠居士", c: "rank-devout" };
    return { t: "凡人信徒", c: "rank-norm" };
};

// --- 2. 功德榜 & 供奉 & 供奉明細 ---
onValue(ref(db, "offerings"), (snap) => {
    const list = document.getElementById("leaderboard-list");
    const marquee = document.getElementById("marquee-content");
    const detailList = document.getElementById("offering-detail-list");

    if (snap.exists()) {
        const data = Object.values(snap.val());

        // 1. 排行榜邏輯 (統計次數 + 記錄最後供奉時間)
        const stats = {};

        data.forEach((o) => {
            if (!stats[o.name]) {
                stats[o.name] = { count: 0, lastTime: 0 };
            }
            stats[o.name].count += 1;
            // 更新該信徒的最後供奉時間
            const t = o.time || 0; // 舊資料無時間則視為 0
            if (t > stats[o.name].lastTime) {
                stats[o.name].lastTime = t;
            }
        });

        // 排序：先比次數(多->少)，次數相同比時間(新->舊)
        const sorted = Object.entries(stats)
            .sort((a, b) => {
                const countDiff = b[1].count - a[1].count; // 第一排序：次數
                if (countDiff !== 0) return countDiff;
                return b[1].lastTime - a[1].lastTime; // 第二排序：時間 (數字大=新)
            })
            .slice(0, 5);

        list.innerHTML = sorted
            .map((s, i) => {
                // s[0] 是名字, s[1] 是 { count, lastTime }
                const rank = getTitle(s[1].count);
                return `
            <div class="flex justify-between items-center bg-white/5 p-3 rounded-xl border-l-4 border-yellow-500 text-sm">
                <div class="flex items-center">
                    <span class="mr-2 text-yellow-500 font-bold">#${i + 1}</span>
                    <span class="title-badge ${rank.c}">${rank.t}</span>
                    <span class="font-bold">${s[0]}</span>
                </div>
                <span class="text-yellow-500 font-black">${s[1].count} 次</span>
            </div>`;
            })
            .join("");

        // 2. 跑馬燈 (顯示最近 5 筆)
        const recentData = [...data].reverse();
        let txt = "🏮 郁靈聖宮開聖門 🏮 ";
        recentData.slice(0, 5).forEach((o) => (txt += `【 ${o.name} 供奉了 ${o.gift} 】 🏮 `));
        marquee.innerText = txt;

        // 3. 供奉明細列表 (顯示最近 50 筆)
        detailList.innerHTML = "";
        recentData.slice(0, 50).forEach((o) => {
            let timeDisplay = "早期";
            if (o.time) {
                const d = new Date(o.time);
                const month = d.getMonth() + 1;
                const date = d.getDate();
                const hour = d.getHours().toString().padStart(2, "0");
                const min = d.getMinutes().toString().padStart(2, "0");
                timeDisplay = `${month}/${date} ${hour}:${min}`;
            }

            detailList.innerHTML += `
                <tr class="hover:bg-white/5 transition border-b border-zinc-800/50">
                    <td class="py-3 pl-2 text-zinc-500 text-xs font-mono">${timeDisplay}</td>
                    <td class="py-3 font-bold text-zinc-300">${o.name}</td>
                    <td class="py-3 text-yellow-500">${o.gift}</td>
                </tr>
            `;
        });
    }
});

// --- 🔮 SSR 神社靈籤 ---
window.drawFortune = async () => {
    Swal.fire({
        title: "🔮 誠心請示聖君...",
        html: '<div class="py-4 text-zinc-400 italic tracking-widest animate-pulse">正在搖動雲端籤筒...<br>請默念心中所求</div>',
        timer: 2500,
        timerProgressBar: true,
        background: "#1a1a1a",
        color: "#ffd700",
        didOpen: () => {
            Swal.showLoading();
        },
    }).then(() => {
        const fortunes = [
            {
                t: "特吉：聖恩 (しんおん)",
                color: "text-pink-500",
                border: "border-pink-500",
                p: "郁靈聖宮千秋在，萬世隆恩護君心。",
                m: "你是聖君最寵溺的信徒，今日無禁無忌。",
                love: "聖君正打算好好疼愛你，請做好準備。",
                gift: "只要是你，聖君都喜歡。",
            },
            {
                t: "大吉 (だいきち)",
                color: "text-yellow-400",
                border: "border-yellow-500",
                p: "天開雲散見金光，萬里清風送郁香。",
                m: "聖君今日法喜充滿，心存正念，無往不利。",
                love: "求生慾滿載，凡事皆能得聖君垂青。",
                gift: "宜進獻大杯半糖去冰珍奶。",
            },
            {
                t: "中吉 (ちゅうきち)",
                color: "text-blue-400",
                border: "border-blue-500",
                p: "水波盪漾映新月，柳暗花明又一村。",
                m: "運勢穩定上升，若能忍氣吞聲，必有福報。",
                love: "適度撒嬌可化解先前所有聖怒。",
                gift: "精緻甜品是今日的開運關鍵。",
            },
            {
                t: "吉 (きち)",
                color: "text-green-400",
                border: "border-green-500",
                p: "耕耘自有收成日，莫向春風嘆早遲。",
                m: "平順之卦，做好微臣本職工作，自得微笑。",
                love: "安分守己，切莫翻閱聖君過去之聖旨。",
                gift: "簡單的關心與暖心飲料即可。",
            },
            {
                t: "小吉 (しょうきち)",
                color: "text-emerald-300",
                border: "border-emerald-500",
                p: "春風輕拂柳絲長，細水長流日漸強。",
                m: "不可操之過急，保持謙卑之心方能平安。",
                love: "今日宜聽話，聖君說東不可往西。",
                gift: "一場誠意十足的肩頸按摩。",
            },
            {
                t: "末吉 (すえきち)",
                color: "text-zinc-400",
                border: "border-zinc-500",
                p: "寒蟬抱影棲枯木，且待春雷震動時。",
                m: "運勢略顯沈悶，目前宜守不宜進，多做家事為妙。",
                love: "沈默是金，多點點頭，少說廢話。",
                gift: "宜準備宵夜待命。",
            },
            {
                t: "凶 (きょう)",
                color: "text-orange-500",
                border: "border-orange-500",
                p: "烏雲蓋頂雷聲急，微臣切莫觸龍顏。",
                m: "警報！聖君目前略有微詞，應進入最高戒備。",
                love: "偵測到微量殺氣，求生慾應切換至極速模式。",
                gift: "火速搜尋「外送」或「網購清單」，以防不測。",
            },
            {
                t: "大凶 (だいきょう)",
                color: "text-red-600 font-black animate-pulse",
                border: "border-red-700 shadow-[0_0_20px_rgba(255,0,0,0.5)]",
                p: "狂風暴雨暗天機，四面楚歌無處避。",
                m: "危險等級 MAX！呼吸都是錯的，請立刻下跪。",
                love: "放棄掙扎，誠心認錯是唯一的出路。",
                gift: "獻上信用卡與清空購物車，方能化險為夷。",
            },
        ];

        const roll = Math.floor(Math.random() * 100) + 1;
        let f;
        if (roll <= 5) f = fortunes[0];
        else if (roll <= 20) f = fortunes[1];
        else if (roll <= 40) f = fortunes[2];
        else if (roll <= 60) f = fortunes[3];
        else if (roll <= 75) f = fortunes[4];
        else if (roll <= 85) f = fortunes[5];
        else if (roll <= 95) f = fortunes[6];
        else f = fortunes[7];

        if (f.t.includes("大吉"))
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ["#ffd700", "#ffffff"],
            });
        else if (f.t.includes("特吉")) {
            confetti({
                particleCount: 200,
                spread: 100,
                origin: { y: 0.5 },
                colors: ["#ff69b4", "#ffd700", "#ff0000"],
            });
            document.getElementById("bell-sound").play();
        }

        Swal.fire({
            title: `<span class="temple-font text-4xl ${f.color}">${f.t}</span>`,
            html: `
                        <div class="p-6 text-left border-4 ${f.border} rounded-xl bg-zinc-900/90 shadow-2xl relative overflow-hidden">
                            <div class="absolute -right-4 -top-4 opacity-10 temple-font text-8xl">${f.t.substring(0, 2)}</div>
                            <p class="text-xl font-bold text-zinc-100 mb-3 text-center tracking-widest">【 籤 詩 】</p>
                            <p class="text-lg text-zinc-300 text-center mb-6 font-serif leading-relaxed">「${f.p}」</p>
                            <hr class="border-zinc-700 mb-4">
                            <div class="space-y-3">
                                <p class="text-sm leading-relaxed"><span class="${f.color} font-black">▶ 聖意：</span> <span class="text-zinc-300">${f.m}</span></p>
                                <p class="text-sm leading-relaxed"><span class="${f.color} font-black">▶ 求生：</span> <span class="text-zinc-300">${f.love}</span></p>
                                <p class="text-sm leading-relaxed"><span class="${f.color} font-black">▶ 供奉：</span> <span class="text-zinc-300">${f.gift}</span></p>
                            </div>
                        </div>
                    `,
            confirmButtonText: "謝主隆恩",
            background: "#111",
            customClass: { confirmButton: "bg-zinc-800 border border-zinc-600 hover:bg-zinc-700" },
        });
    });
};

// --- 其它基礎功能 ---
const updateTheme = () => {
    const hr = new Date().getHours();
    const body = document.getElementById("main-body");
    if (!body.classList.contains("theme-birthday"))
        body.className = `flex flex-col items-center ${hr < 6 || hr >= 18 ? "theme-night" : "theme-day"}`;
    document.getElementById("current-time-display").innerText =
        `CLOCK // ${new Date().toLocaleTimeString()}`;
};
setInterval(updateTheme, 1000);
updateTheme();

// --- 聖君心情監聽 ---
onValue(ref(db, "stats/mood"), (s) => {
    const mood = s.val() || "法喜充滿";
    document.getElementById("mood-status").innerText = `聖君當前心情：${mood}`;

    const body = document.body;

    // 重置所有特殊狀態
    body.classList.remove("rage-mode", "annoyed-mode");

    if (mood === "雷霆之怒") {
        // 狀態一：暴怒 (紅光 + 劇烈震動)
        body.classList.add("rage-mode");
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } else if (mood === "略有微詞") {
        // 狀態二：微詞 (灰暗 + 訊號故障)
        body.classList.add("annoyed-mode");
    } else {
        // 狀態三：正常 (法喜充滿)
        // 保持原狀，無需加 class
    }
});

window.changeMood = async () => {
    const { value: m } = await Swal.fire({
        title: "設定聖君心情",
        input: "select",
        inputOptions: { 法喜充滿: "法喜充滿", 略有微詞: "略有微詞", 雷霆之怒: "雷霆之怒" },
    });
    if (m) update(ref(db, "stats"), { mood: m });
};
window.toggleBirthdayMode = () => {
    if (document.getElementById("main-body").classList.toggle("theme-birthday"))
        confetti({ particleCount: 200, spread: 80, origin: { y: 0.7 } });
};

window.addOffering = async () => {
    const { value: f } = await Swal.fire({
        title: "供奉禮物",
        html: `
                    <div style="display: flex; flex-direction: column; gap: 15px; width: 100%; padding: 0 10px; box-sizing: border-box;">
                        <input id="i1" class="swal2-input" style="margin: 0; width: 100%; max-width: 100%; box-sizing: border-box;" placeholder="大名">
                        <input id="i2" class="swal2-input" style="margin: 0; width: 100%; max-width: 100%; box-sizing: border-box;" placeholder="禮物">
                    </div>
                `,
        preConfirm: () => [
            document.getElementById("i1").value,
            document.getElementById("i2").value,
        ],
    });
    if (f && f[0]) push(ref(db, "offerings"), { name: f[0], gift: f[1], time: Date.now() });
};

window.sendBlessing = async () => {
    const { value: f } = await Swal.fire({
        title: "送上祝福",
        html: `
                    <div style="display: flex; flex-direction: column; gap: 15px; width: 100%; padding: 0 10px; box-sizing: border-box;">
                        <input id="b1" class="swal2-input" style="margin: 0; width: 100%; max-width: 100%; box-sizing: border-box;" placeholder="親友姓名">
                        <input id="b2" class="swal2-input" style="margin: 0; width: 100%; max-width: 100%; box-sizing: border-box;" placeholder="想說的話">
                    </div>
                `,
        preConfirm: () => [
            document.getElementById("b1").value,
            document.getElementById("b2").value,
        ],
    });
    if (f && f[0]) push(ref(db, "blessings"), { name: f[0], msg: f[1], time: Date.now() });
};

onValue(query(ref(db, "blessings"), limitToLast(6)), (snap) => {
    const wall = document.getElementById("blessing-wall");
    wall.innerHTML = "";
    if (snap.exists())
        Object.values(snap.val())
            .reverse()
            .forEach((b) => {
                wall.innerHTML += `<div class="blessing-lamp p-4 rounded-2xl text-center text-[10px]"><p class="text-yellow-500 font-bold mb-1">${b.name}</p><p class="text-zinc-400 italic">"${b.msg}"</p></div>`;
            });
});
window.makeWish = async () => {
    const { value: w } = await Swal.fire({ title: "誠心許願", input: "text" });
    if (w) push(ref(db, "wishes"), { text: w });
};
onValue(query(ref(db, "wishes"), limitToLast(12)), (snap) => {
    const tree = document.getElementById("wish-tree-area");
    tree.innerHTML = "";
    if (snap.exists())
        Object.values(snap.val()).forEach((w) => {
            const el = document.createElement("div");
            el.className = "wish-tag";
            el.innerText = w.text;
            const randomDeg = Math.floor(Math.random() * 11) - 5;
            el.style.setProperty("--rotation", `${randomDeg}deg`);
            el.onclick = () => Swal.fire({ title: "🎋 願望詳情", text: w.text });
            tree.appendChild(el);
        });
});
onValue(ref(db, "todos"), (snap) => {
    const list = document.getElementById("todo-list");
    list.innerHTML = "";
    if (snap.exists())
        Object.entries(snap.val()).forEach(([id, item]) => {
            list.innerHTML += `<div class="flex items-center bg-white/5 p-5 rounded-2xl border-l-4 ${item.checked ? "border-zinc-700 opacity-40" : "border-red-600"} mb-3"><input type="checkbox" ${item.checked ? "checked" : ""} onchange="window.adminAction(() => window.toggleTodo('${id}', ${item.checked}))" class="w-6 h-6 mr-4"><span class="flex-grow text-sm">${item.text}</span><button onclick="window.adminAction(() => window.deleteTodo('${id}'))" class="text-zinc-700 hover:text-red-500 px-2 text-xl">✕</button></div>`;
        });
});
window.addTodo = async () => {
    const { value: t } = await Swal.fire({ title: "頒布新聖旨", input: "text" });
    if (t) push(ref(db, "todos"), { text: t, checked: false });
};
window.toggleTodo = (id, cur) => update(ref(db, `todos/${id}`), { checked: !cur });
window.deleteTodo = (id) => remove(ref(db, `todos/${id}`));
window.previewPhoto = (e) => {
    const r = new FileReader();
    r.onload = (ev) => (document.getElementById("saint-photo").src = ev.target.result);
    r.readAsDataURL(e.target.files[0]);
};
// --- 🌳 D3.js 賽博碎形樹生成器 ---
const initCyberTree = () => {
    // 1. 確保 D3 已載入
    if (typeof d3 === "undefined") {
        console.error("D3.js 尚未載入，請檢查 head 標籤");
        return;
    }

    const container = document.getElementById("wish-tree-area");
    if (!container) return;

    // 取得容器實際尺寸
    const width = container.clientWidth;
    const height = container.clientHeight || 600; // 如果高度抓不到，給預設值

    // 清除舊的 SVG
    d3.select("#wish-tree-area svg").remove();

    // 2. 建立畫布
    const svg = d3
        .select("#wish-tree-area")
        .append("svg")
        .attr("id", "tree-svg")
        .attr("width", width)
        .attr("height", height)
        .style("position", "absolute")
        .style("bottom", "0")
        .style("left", "0")
        .style("pointer-events", "none"); // 讓點擊穿透

    // 3. 定義金色發光濾鏡 (只定義一次)
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "2").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // 4. 建立一個群組來放樹，並將濾鏡套用在群組上 (效能關鍵！)
    const treeGroup = svg.append("g").style("filter", "url(#glow)");

    // 5. 樹的參數設定 (稍微降低深度以提升效能)
    const maxDepth = 9; // 降為 9 (原本 10)，線條數減半，流暢度大增
    const branchAngle = 22; // 分枝角度
    const startLength = height * 0.22; // 樹幹長度

    // 6. 遞迴畫樹函式
    function drawBranch(x1, y1, angle, depth, length) {
        if (depth === 0) return;

        const x2 = x1 + Math.cos((angle * Math.PI) / 180) * length;
        const y2 = y1 - Math.sin((angle * Math.PI) / 180) * length;

        // 繪製線條
        treeGroup
            .append("line")
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x1) // 動畫初始位置
            .attr("y2", y1) // 動畫初始位置
            .attr("stroke", "#ffd700")
            .attr("stroke-width", depth < 2 ? 1 : depth * 0.6) // 末端細一點
            .attr("stroke-opacity", 0.7)
            .attr("stroke-linecap", "round")
            .transition() // --- 生長動畫 ---
            .duration(600) // 動畫時間縮短一點，感覺更俐落
            .delay((maxDepth - depth) * 150)
            .ease(d3.easeCubicOut)
            .attr("x2", x2)
            .attr("y2", y2);

        // 遞迴呼叫
        const randomAngle = (Math.random() - 0.5) * 20; // 增加隨機性
        const randomShrink = 0.75 + Math.random() * 0.1;

        drawBranch(x2, y2, angle - branchAngle + randomAngle, depth - 1, length * randomShrink);
        drawBranch(x2, y2, angle + branchAngle + randomAngle, depth - 1, length * randomShrink);
    }

    // 7. 開始種樹
    drawBranch(width / 2, height, 90, maxDepth, startLength);
};

// --- 🌲 捲動觸發監聽 (Intersection Observer) ---
let hasTreeGrown = false;

const setupScrollObserver = () => {
    const target = document.getElementById("wish-tree-area");
    if (!target) return;

    const observer = new IntersectionObserver(
        (entries, obs) => {
            entries.forEach((entry) => {
                // 當元素進入畫面，且還沒長過樹
                if (entry.isIntersecting && !hasTreeGrown) {
                    hasTreeGrown = true; // 標記已生長

                    // 稍微延遲一下，讓使用者定睛後再開始長
                    setTimeout(() => {
                        initCyberTree();
                    }, 200);

                    obs.unobserve(entry.target); // 任務完成，停止監聽 (節省效能)
                }
            });
        },
        {
            root: null, // 視窗本身
            threshold: 0.3, // 關鍵設定：當區塊露出 30% 時觸發
        },
    );

    observer.observe(target);
};

// 頁面載入後啟動觀察器
window.addEventListener("load", setupScrollObserver);

// 視窗縮放時重畫
let resizeTimer;
window.addEventListener("resize", () => {
    if (hasTreeGrown) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(initCyberTree, 500);
    }
});
