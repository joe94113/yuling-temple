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

// --- 🌬️ 上香 (煙霧 + 木魚聲 + 功德浮字) ---
window.burnIncense = () => {
    const audio = document.getElementById("wood-sound").cloneNode();
    audio.volume = 0.6;
    audio.play();

    runTransaction(ref(db, "stats/incenseCount"), (c) => (c || 0) + 1);

    const emitter = document.getElementById("fx-emitter");

    // 煙霧粒子
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

    // 功德浮字
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

// --- 🏆 功德榜與稱號 ---
const getTitle = (count) => {
    if (count > 50) return { t: "聖宮守護神", c: "rank-god" };
    if (count > 20) return { t: "首席大檀越", c: "rank-chief" };
    if (count > 5) return { t: "虔誠居士", c: "rank-devout" };
    return { t: "凡人信徒", c: "rank-norm" };
};

onValue(ref(db, "offerings"), (snap) => {
    const list = document.getElementById("leaderboard-list");
    const marquee = document.getElementById("marquee-content");
    if (snap.exists()) {
        const data = Object.values(snap.val());
        const counts = {};
        data.forEach((o) => (counts[o.name] = (counts[o.name] || 0) + 1));
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        list.innerHTML = sorted
            .map((s, i) => {
                const rank = getTitle(s[1]);
                return `
                    <div class="flex justify-between items-center bg-white/5 p-3 rounded-xl border-l-4 border-yellow-500 text-sm">
                        <div class="flex items-center">
                            <span class="mr-2 text-yellow-500 font-bold">#${i + 1}</span>
                            <span class="title-badge ${rank.c}">${rank.t}</span>
                            <span class="font-bold">${s[0]}</span>
                        </div>
                        <span class="text-yellow-500 font-black">${s[1]}</span>
                    </div>`;
            })
            .join("");

        let txt = "🏮 郁靈聖宮開聖門 🏮 ";
        data.reverse()
            .slice(0, 5)
            .forEach((o) => (txt += `【 ${o.name} 供奉了 ${o.gift} 】 🏮 `));
        marquee.innerText = txt;
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

// --- 其它功能 ---
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

onValue(ref(db, "stats/mood"), (s) => {
    const mood = s.val() || "法喜充滿";
    document.getElementById("mood-status").innerText = `聖君當前心情：${mood}`;
    document.getElementById("main-shrine").classList.toggle("mood-angry", mood === "雷霆之怒");
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
// --- 🏆 供奉獻禮 ---
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

// --- 🎂 親友祝壽 ---
window.sendBlessing = async () => {
    const { value: f } = await Swal.fire({
        title: "送上祝福",
        html: `
            <div style="display: flex; flex-direction: column; gap: 15px; width: 100%; padding: 0 10px; box-sizing: border-box;">
                <input id="b1" class="swal2-input" style="margin: 0; width: 100%; max-width: 100%; box-sizing: border-box;" placeholder="親友姓名">
                <input id="b2" class="swal2-input" style="margin: 0; width: 100%; max-width: 100%; box-sizing: border-box;" placeholder="想說的話">
            </div>
        `,
        preConfirm: () => {
            const name = document.getElementById("b1").value;
            const msg = document.getElementById("b2").value;
            if (!name || !msg) {
                Swal.showValidationMessage("請完整填寫姓名與祝福語！");
            }
            return [name, msg];
        },
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
