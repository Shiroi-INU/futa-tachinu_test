(() => {
  'use strict';

  const GAME_SECONDS = 10;
  const CLEAR_POINT = 150;
  const STORAGE_KEY = 'futa_tachinu_state_v1';

  const items = [
    {
      name: '新聞記事',
      icon: '📰',
      copy: '2005年、風太が立った日のニュース記事だ。\n足腰に力がみなぎる気がする。',
      itemLabel: '新聞記事'
    },
    {
      name: '子どもの手紙',
      icon: '💌',
      copy: '昔、動物園に来た子どもがくれた手紙だ。\n文字が読めなくても、当時はうれしかった。',
      itemLabel: '子どもの手紙'
    },
    {
      name: 'みんなの応援',
      icon: '📣',
      copy: '「風太ガンバレ！」――思いは届いた。\n次は立つ、必ず立てる！',
      itemLabel: 'みんなの応援'
    }
  ];

  const configs = [
    {
      attempt: 1,
      perfect: 6,
      good: 3,
      miss: 0,
      cap: 999,
      perfectWindow: 14,
      goodWindow: 46,
      speed: 1.16,
      flavor: 'レッサーパンダの誇りにかけて！'
    },
    {
      attempt: 2,
      perfect: 10,
      good: 5,
      miss: 0,
      cap: 999,
      perfectWindow: 14,
      goodWindow: 46,
      speed: 1.16,
      flavor: '懐かしい思い出が力をくれる。'
    },
    {
      attempt: 3,
      perfect: 12,
      good: 6,
      miss: 0,
      cap: 999,
      perfectWindow: 14,
      goodWindow: 46,
      speed: 1.16,
      flavor: 'ありがとう、あの頃の子どもたち。'
    },
    {
      attempt: 4,
      perfect: 30,
      good: 18,
      miss: 3,
      cap: 999,
      perfectWindow: 14,
      goodWindow: 46,
      speed: 1.16,
      flavor: 'みんなの声が聞こえる。'
    }
  ];

  const els = {
    screens: document.querySelectorAll('.screen'),
    titleScreen: document.getElementById('titleScreen'),
    gameScreen: document.getElementById('gameScreen'),
    failScreen: document.getElementById('failScreen'),
    itemScreen: document.getElementById('itemScreen'),
    clearScreen: document.getElementById('clearScreen'),
    startButton: document.getElementById('startButton'),
    resetButton: document.getElementById('resetButton'),
    tapButton: document.getElementById('tapButton'),
    itemButton: document.getElementById('itemButton'),
    nextButton: document.getElementById('nextButton'),
    backTitleButton: document.getElementById('backTitleButton'),
    clearResetButton: document.getElementById('clearResetButton'),
    attemptLabel: document.getElementById('attemptLabel'),
    itemLabel: document.getElementById('itemLabel'),
    timeText: document.getElementById('timeText'),
    scoreText: document.getElementById('scoreText'),
    progressBar: document.getElementById('progressBar'),
    movingBar: document.getElementById('movingBar'),
    judgeText: document.getElementById('judgeText'),
    flavorText: document.getElementById('flavorText'),
    failText: document.getElementById('failText'),
    itemName: document.getElementById('itemName'),
    itemIcon: document.getElementById('itemIcon'),
    itemCopy: document.getElementById('itemCopy'),
    titleCanvas: document.getElementById('titleCanvas'),
    gameCanvas: document.getElementById('gameCanvas'),
    failCanvas: document.getElementById('failCanvas'),
    clearCanvas: document.getElementById('clearCanvas'),
    clearScoreText: document.getElementById('clearScoreText'),
    shareXButton: document.getElementById('share-x-button')
  };

  let state = loadState();
  let score = 0;
  let startedAt = 0;
  let rafId = 0;
  let barX = 0;
  let lastTapAt = 0;
  let tapCount = 0;
  let currentConfig = configs[0];
  let awardedItem = null;
  let gameRunning = false;
  let tapEnabled = false;
  let readyTimer = 0;
  let moreMode = false;


  const AUDIO_VOLUME = {
    bgm: 0.45,
    cheer: 0.85,
    decision: 0.7,
    jingle: 0.9
  };

  function audioCandidates(...fileNames) {
    return fileNames.flatMap((fileName) => [
      `assets/audio/${fileName}`,
      fileName
    ]);
  }

  function createAudio(candidates, volume = 1) {
    const audio = document.createElement('audio');
    audio.preload = 'auto';
    audio.volume = volume;

    candidates.forEach((src) => {
      const source = document.createElement('source');
      source.src = src;
      if (src.toLowerCase().endsWith('.mp3')) {
        source.type = 'audio/mpeg';
      }
      audio.appendChild(source);
    });

    return audio;
  }

  const bgmList = [1, 2, 3, 4].map((num) => createAudio(
    audioCandidates(`bgm-${num}.mp3`, `BGM_${num}回目.mp3`),
    AUDIO_VOLUME.bgm
  ));

  const cheerSeList = Array.from({ length: 11 }, (_, index) => {
    const num = index + 1;
    return createAudio(
      audioCandidates(`cheer-${num}.mp3`, `SE_応援ボタン${num}.mp3`),
      AUDIO_VOLUME.cheer
    );
  });

  const decisionSe = createAudio(
    audioCandidates('decision.mp3', 'SE_決定ボタン.mp3'),
    AUDIO_VOLUME.decision
  );
  const itemSe = createAudio(
    audioCandidates('item.mp3'),
    AUDIO_VOLUME.decision
  );
  const failJingle = createAudio(
    audioCandidates('fail-jingle.mp3', 'SE_失敗時ジングル.mp3'),
    AUDIO_VOLUME.jingle
  );
  const successJingle = createAudio(
    audioCandidates('success-jingle.mp3', 'SE_成功時ジングル.mp3'),
    AUDIO_VOLUME.jingle
  );

  let cheerSeIndex = 0;
  let primedBgm = null;

  function safePlay(audio) {
    const result = audio.play();
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        // ブラウザの自動再生制限や未配置の音源で失敗しても、ゲーム自体は止めない
      });
    }
  }

  function playAudio(audio) {
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch (error) {
      // 読み込み前でcurrentTimeを戻せない場合は、そのまま再生を試す
    }
    audio.muted = false;
    safePlay(audio);
  }

  function stopAudio(audio) {
    audio.pause();
    audio.muted = false;
    try {
      audio.currentTime = 0;
    } catch (error) {
      // 読み込み前でcurrentTimeを戻せない場合は無視
    }
  }

  function stopAllBgm() {
    bgmList.forEach(stopAudio);
    primedBgm = null;
  }

  function stopJingles() {
    stopAudio(failJingle);
    stopAudio(successJingle);
  }

  function getBgmForAttempt(attemptNumber) {
    const index = Math.min(Math.max(attemptNumber - 1, 0), bgmList.length - 1);
    return bgmList[index];
  }

  function primeBgmForAttempt(attemptNumber) {
    stopAllBgm();
    primedBgm = getBgmForAttempt(attemptNumber);
    primedBgm.muted = true;
    try {
      primedBgm.currentTime = 0;
    } catch (error) {
      // 読み込み前でcurrentTimeを戻せない場合は無視
    }
    safePlay(primedBgm);
  }

  function playBgmForAttempt(attemptNumber) {
    const bgm = getBgmForAttempt(attemptNumber);

    if (primedBgm !== bgm) {
      stopAllBgm();
    }

    bgm.loop = false;
    bgm.muted = false;
    bgm.volume = AUDIO_VOLUME.bgm;
    try {
      bgm.currentTime = 0;
    } catch (error) {
      // 読み込み前でcurrentTimeを戻せない場合は、そのまま再生を試す
    }
    safePlay(bgm);
    primedBgm = null;
  }

  function resetCheerSe() {
    cheerSeIndex = 0;
  }

  function playCheerSe() {
    const index = Math.min(cheerSeIndex, cheerSeList.length - 1);
    playAudio(cheerSeList[index]);

    if (cheerSeIndex < cheerSeList.length - 1) {
      cheerSeIndex += 1;
    }
  }

  function playDecisionSe() {
    playAudio(decisionSe);
  }

  function playFailJingle() {
    stopAllBgm();
    stopJingles();
    playAudio(failJingle);
  }

  function playSuccessJingle() {
    stopAllBgm();
    stopJingles();
    playAudio(successJingle);
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.items)) {
        return { items: saved.items.slice(0, 3), cleared: Boolean(saved.cleared) };
      }
    } catch (error) {
      // localStorageが使えない環境では初期状態で遊ぶ
    }
    return { items: [], cleared: false };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // 保存できなくてもゲームは継続
    }
  }

  function getAttempt() {
    return Math.min(state.items.length + 1, 4);
  }

  function getConfig() {
    return configs[getAttempt() - 1];
  }

  function showScreen(screen) {
    els.screens.forEach((el) => el.classList.remove('is-active'));
    screen.classList.add('is-active');
  }

  function setMoreMode(isActive) {
    moreMode = Boolean(isActive);
    els.gameScreen.classList.toggle('is-more-mode', moreMode);
  }

  function updateTitle() {
    const attempt = getAttempt();
    els.attemptLabel.textContent = `挑戦：${attempt}回目`;
    els.itemLabel.textContent = state.items.length
      ? `持ち物：${state.items.map((idx) => items[idx].itemLabel).join(' / ')}`
      : '持ち物：なし';
    els.startButton.textContent = attempt >= 4 ? '絶対に立ちぬ' : attempt >= 2 ? '次こそ立ちぬ' : 'いざ立ちぬ';
    drawFuta(els.titleCanvas, attempt >= 4 ? 70 : 30, 'title');
  }

  function resetGame() {
    cancelAnimationFrame(rafId);
    clearTimeout(readyTimer);
    stopAllBgm();
    stopJingles();
    state = { items: [], cleared: false };
    saveState();
    score = 0;
    tapCount = 0;
    gameRunning = false;
    tapEnabled = false;
    setMoreMode(false);
    updateTitle();
    showScreen(els.titleScreen);
  }

  function startGame() {
    currentConfig = getConfig();
    score = 0;
    tapCount = 0;
    lastTapAt = 0;
    awardedItem = null;
    gameRunning = false;
    tapEnabled = false;
    clearTimeout(readyTimer);
    stopJingles();
    resetCheerSe();
    setMoreMode(false);
    primeBgmForAttempt(getAttempt());

    els.timeText.textContent = GAME_SECONDS.toFixed(1);
    els.scoreText.textContent = '0';
    els.progressBar.style.width = '0%';
    els.judgeText.textContent = 'Ready…';
    els.flavorText.textContent = 'さあ、立つぜ！';
    els.tapButton.disabled = true;
    els.tapButton.textContent = 'Ready...';

    updateMeterZones(currentConfig);
    showScreen(els.gameScreen);
    drawFuta(els.gameCanvas, 0, 'game');

    readyTimer = window.setTimeout(() => {
      els.judgeText.textContent = 'Go!';
      els.flavorText.textContent = currentConfig.flavor;
      els.tapButton.disabled = false;
      els.tapButton.textContent = 'タップで応援';
      startedAt = performance.now();
      playBgmForAttempt(getAttempt());
      gameRunning = true;
      tapEnabled = true;
      rafId = requestAnimationFrame(tick);
    }, 700);
  }

  function updateMeterZones(config) {
    const good = document.querySelector('.good-zone');
    const perfect = document.querySelector('.perfect-zone');
    good.style.width = `${config.goodWindow * 2}px`;
    perfect.style.width = `${config.perfectWindow * 2}px`;
  }

  function tick(now) {
    if (!gameRunning) return;

    const elapsed = (now - startedAt) / 1000;
    const remaining = Math.max(0, GAME_SECONDS - elapsed);
    const meter = document.querySelector('.meter-track');
    const trackWidth = meter.clientWidth;
    const barWidth = els.movingBar.clientWidth;
    const center = trackWidth / 2 - barWidth / 2;
    const amplitude = Math.max(0, trackWidth / 2 - barWidth - 12);

    barX = center + Math.sin(elapsed * Math.PI * currentConfig.speed) * amplitude;
    els.movingBar.style.transform = `translateX(${barX}px)`;
    els.timeText.textContent = remaining.toFixed(1);

    drawFuta(els.gameCanvas, score, 'game', now);

    if (remaining <= 0) {
      endGame();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function handleTap(event) {
    if (!gameRunning || !tapEnabled) return;
    event.preventDefault();

    const now = performance.now();
    if (now - lastTapAt < 120) return;
    lastTapAt = now;
    tapCount += 1;

    const meter = document.querySelector('.meter-track');
    const trackWidth = meter.clientWidth;
    const barWidth = els.movingBar.clientWidth;
    const barCenter = barX + barWidth / 2;
    const target = trackWidth / 2;
    const diff = Math.abs(barCenter - target);

    let judge = 'MISS';
    let add = currentConfig.miss;

    if (diff <= currentConfig.perfectWindow) {
      judge = 'PERFECT';
      add = currentConfig.perfect;
    } else if (diff <= currentConfig.goodWindow) {
      judge = 'GOOD';
      add = currentConfig.good;
    }

    addScore(add, judge);
  }

  function addScore(add, judge) {
    const attempt = getAttempt();

    score = Math.min(currentConfig.cap, score + add);
    const isFourthAttemptMore = attempt >= 4 && score >= CLEAR_POINT;
    const shownJudge = isFourthAttemptMore ? 'MORE!!' : judge;

    els.scoreText.textContent = String(score);
    els.progressBar.style.width = `${Math.min(100, (score / CLEAR_POINT) * 100)}%`;
    els.judgeText.textContent = `${shownJudge} +${add}`;

    if (isFourthAttemptMore) {
      setMoreMode(true);
      playCheerSe();
      els.flavorText.textContent = '風太が立ったぞォーッ!!';
    } else if (judge === 'PERFECT' || judge === 'GOOD') {
      playCheerSe();
    }

    if (isFourthAttemptMore) {
      // 4回目は150ポイントを超えても、10秒のBGMを最後まで聴けるようゲームを続ける。
    } else if (judge === 'PERFECT') {
      els.flavorText.textContent = '完璧だ！';
    } else if (judge === 'GOOD') {
      els.flavorText.textContent = 'いい感じ。';
    } else {
      els.flavorText.textContent = currentConfig.miss > 0 ? 'ズレた。でも応援は届いた。' : '虚空をタップした。';
    }

    if (score >= CLEAR_POINT && attempt < 4) {
      endGame(true);
    }
  }

  function endGame(forceClear = false) {
    if (!gameRunning) return;
    gameRunning = false;
    tapEnabled = false;
    els.tapButton.disabled = true;
    cancelAnimationFrame(rafId);

    const attempt = getAttempt();

    // 4回目は「普通にタップしていれば必ずクリア」のため、
    // 5タップ以上していたら最後に“みんなの応援”が不足分を押し上げる。
    if (!forceClear && attempt >= 4 && tapCount >= 5 && score < CLEAR_POINT) {
      score = CLEAR_POINT;
      els.scoreText.textContent = String(CLEAR_POINT);
      els.progressBar.style.width = '100%';
      forceClear = true;
    }

    if (forceClear || score >= CLEAR_POINT) {
      state.cleared = true;
      saveState();
      if (els.clearScoreText) {
        els.clearScoreText.textContent = `4ゲーム目スコア：${Math.max(score, CLEAR_POINT)} POINT`;
      }
      drawFuta(els.clearCanvas, Math.max(score, CLEAR_POINT), 'clear', performance.now());
      playSuccessJingle();
      showScreen(els.clearScreen);
      return;
    }

    const nextItemIndex = state.items.length;
    awardedItem = nextItemIndex < items.length ? nextItemIndex : null;
    drawFuta(els.failCanvas, score, 'fail');
    playFailJingle();

    if (awardedItem === null) {
      els.failText.textContent = '応援は十分。あとはタップするだけだ。';
      els.itemButton.classList.add('hidden');
      els.backTitleButton.classList.remove('hidden');
    } else {
      const lines = [
        '初回から立てるほど甘くないか。\nだが、落とした視線の先に何かが落ちている。',
        'まだまだ力が足りないみたいだ。\nだが、引き出しからしわしわの手紙が出てきた。',
        'これでもまだ足りないのか。\n諦めかけたそのとき、\n周りが盛り上がっていることに気づいた。'
      ];
      els.failText.textContent = lines[awardedItem];
      els.itemButton.textContent = awardedItem === 2 ? '周りを見てみる' : '手を伸ばす';
      els.itemButton.disabled = true;
      els.itemButton.classList.remove('hidden');
      els.backTitleButton.classList.add('hidden');
      window.setTimeout(() => {
        if (els.failScreen.classList.contains('is-active')) els.itemButton.disabled = false;
      }, 1500);
    }

    showScreen(els.failScreen);
  }

  function showItem() {
    stopJingles();

    if (awardedItem === null) {
      updateTitle();
      showScreen(els.titleScreen);
      return;
    }

    if (!state.items.includes(awardedItem)) {
      state.items.push(awardedItem);
      saveState();
    }

    const item = items[awardedItem];
    els.itemName.textContent = item.name;
    els.itemIcon.textContent = item.icon;
    els.itemCopy.textContent = item.copy;
    els.nextButton.textContent = awardedItem === 2 ? '最後の挑戦へ' : '次の挑戦へ';
    showScreen(els.itemScreen);
  }

  function backToTitle() {
    stopAllBgm();
    stopJingles();
    setMoreMode(false);
    updateTitle();
    showScreen(els.titleScreen);
  }

  function drawFuta(canvas, point = 0, mode = 'title', time = 0) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const p = Math.max(0, Math.min(1, point / CLEAR_POINT));
    const isMore = point >= CLEAR_POINT && (mode === 'game' || mode === 'clear');

    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    rect(ctx, 0, 0, w, h, isMore ? '#ffd15c' : '#83c9ef');
    if (isMore) {
      drawMoreEffects(ctx, time);
    }
    rect(ctx, 0, 88, w, 32, isMore ? '#86d96e' : '#67b95b');
    rect(ctx, 0, 100, w, 20, isMore ? '#2f9c46' : '#3e8639');

    // うっすら観客
    for (let i = 0; i < 9; i += 1) {
      const x = 9 + i * 17;
      rect(ctx, x, 76 + (i % 2) * 2, 6, 7, '#fff3d7');
      rect(ctx, x + 1, 72 + (i % 3), 4, 4, '#2a1712');
      if (isMore) {
        rect(ctx, x - 2, 70 + (i % 2), 3, 8, '#fff3d7');
        rect(ctx, x + 6, 69 + (i % 3), 3, 8, '#fff3d7');
      }
    }

    if (mode === 'clear') {
      drawSparkles(ctx, time);
    }

    const bodyX = 76;
    const groundY = 90;
    const stand = isMore || mode === 'clear' ? 1 : p;
    const crouch = 1 - stand;
    const bodyY = groundY - 18 - Math.round(29 * stand);
    const bodyH = 24 + Math.round(22 * stand);
    const headY = bodyY - 18 + Math.round(10 * crouch);
    const tailLift = Math.round(14 * stand);

    // しっぽ
    rect(ctx, bodyX - 26, bodyY + 22 - tailLift, 14, 10, '#8e3d22');
    rect(ctx, bodyX - 38, bodyY + 18 - tailLift, 14, 10, '#d86b30');
    rect(ctx, bodyX - 50, bodyY + 14 - tailLift, 14, 10, '#8e3d22');
    rect(ctx, bodyX - 61, bodyY + 11 - tailLift, 13, 9, '#f08a42');

    // 足
    rect(ctx, bodyX - 8, groundY - 5, 14, 7, '#2a1712');
    rect(ctx, bodyX + 12, groundY - 5, 14, 7, '#2a1712');

    // 体
    rect(ctx, bodyX - 13, bodyY, 36, bodyH, '#c95528');
    rect(ctx, bodyX - 9, bodyY + 6, 28, bodyH - 10, '#f08a42');
    rect(ctx, bodyX - 12, bodyY + bodyH - 8, 34, 8, '#2a1712');

    // 腕
    const armUp = mode === 'clear' ? 12 : Math.round(8 * stand);
    rect(ctx, bodyX - 20, bodyY + 10 - armUp, 9, 25, '#2a1712');
    rect(ctx, bodyX + 22, bodyY + 10 - armUp, 9, 25, '#2a1712');
    rect(ctx, bodyX - 21, bodyY + 8 - armUp, 11, 8, '#c95528');
    rect(ctx, bodyX + 21, bodyY + 8 - armUp, 11, 8, '#c95528');

    // 頭
    rect(ctx, bodyX - 18, headY, 46, 29, '#c95528');
    rect(ctx, bodyX - 14, headY + 4, 38, 23, '#f08a42');
    rect(ctx, bodyX - 16, headY - 5, 12, 12, '#2a1712');
    rect(ctx, bodyX + 16, headY - 5, 12, 12, '#2a1712');
    rect(ctx, bodyX - 13, headY - 2, 7, 7, '#f08a42');
    rect(ctx, bodyX + 18, headY - 2, 7, 7, '#f08a42');

    // 顔
    rect(ctx, bodyX - 10, headY + 9, 12, 11, '#fff3d7');
    rect(ctx, bodyX + 10, headY + 9, 12, 11, '#fff3d7');
    rect(ctx, bodyX - 6, headY + 11, 5, 6, '#2a1712');
    rect(ctx, bodyX + 11, headY + 11, 5, 6, '#2a1712');
    rect(ctx, bodyX + 3, headY + 18, 7, 5, '#2a1712');
    rect(ctx, bodyX + 1, headY + 24, 11, 3, '#fff3d7');

    if (mode === 'fail') {
      rect(ctx, bodyX + 26, headY + 24, 3, 8, '#3f7fc4');
      rect(ctx, bodyX + 26, headY + 33, 3, 4, '#3f7fc4');
    }

    if (mode === 'clear') {
      rect(ctx, 43, 26, 10, 10, '#ffd15c');
      rect(ctx, 106, 21, 10, 10, '#ffd15c');
      rect(ctx, 121, 43, 8, 8, '#fff3d7');
      pixelText(ctx, isMore ? 'MORE!' : 'TATTA!', 57, 12, isMore ? '#2a1712' : '#fff3d7');
    } else if (mode === 'game') {
      const words = isMore ? 'MORE!' : point > 80 ? 'MO SUKOSHI' : point > 40 ? 'YOI SHO' : 'FUTA';
      pixelText(ctx, words, 8, 10, isMore ? '#2a1712' : '#fff3d7');
    } else {
      pixelText(ctx, 'FUTA', 11, 10, '#fff3d7');
    }
  }

  function drawSparkles(ctx) {
    const dots = [
      [25, 24, '#ffd15c'], [35, 40, '#fff3d7'], [132, 31, '#ffd15c'],
      [116, 15, '#fff3d7'], [18, 55, '#ffd15c'], [142, 61, '#fff3d7']
    ];
    dots.forEach(([x, y, color]) => {
      rect(ctx, x, y + 3, 3, 3, color);
      rect(ctx, x + 3, y, 3, 9, color);
      rect(ctx, x + 6, y + 3, 3, 3, color);
    });
  }

  function drawMoreEffects(ctx, time = 0) {
    const colors = ['#fff3d7', '#e45a2c', '#2a1712', '#96e879'];
    for (let i = 0; i < 18; i += 1) {
      const x = (i * 23 + Math.floor(time / 80)) % 160;
      const y = 8 + ((i * 17 + Math.floor(time / 120)) % 66);
      rect(ctx, x, y, 4, 4, colors[i % colors.length]);
    }

    rect(ctx, 5, 54, 18, 5, '#e45a2c');
    rect(ctx, 137, 54, 18, 5, '#e45a2c');
    rect(ctx, 9, 47, 10, 4, '#fff3d7');
    rect(ctx, 141, 47, 10, 4, '#fff3d7');
  }

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function pixelText(ctx, text, x, y, color) {
    ctx.fillStyle = color;
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
  }



  function shareResultOnX() {
    const text = `https://shiroi-inu.github.io/futa-tachinu/
10秒ミニゲーム「風太、立ちぬ」をクリア！

あの立ちあがるレッサーパンダ、風太は7/5(日)で23歳！ 人間なら100歳以上だってさ。千葉市動物公園（@ChibaZoo）さん、これからも風太をよろしくね。`;

    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  }

  function preventDoubleTapZoom() {
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });
  }

  els.startButton.addEventListener('click', () => {
    playDecisionSe();
    startGame();
  });
  els.resetButton.addEventListener('click', () => {
    playDecisionSe();
    resetGame();
  });
  els.tapButton.addEventListener('pointerdown', handleTap);
  els.gameCanvas.addEventListener('pointerdown', handleTap);
  document.querySelector('.meter').addEventListener('pointerdown', handleTap);
  els.itemButton.addEventListener('click', () => {
    playAudio(itemSe);
    showItem();
  });
  els.nextButton.addEventListener('click', () => {
    playDecisionSe();
    backToTitle();
  });
  els.backTitleButton.addEventListener('click', () => {
    playDecisionSe();
    backToTitle();
  });
  els.clearResetButton.addEventListener('click', () => {
    playDecisionSe();
    resetGame();
  });

  if (els.shareXButton) {
    els.shareXButton.addEventListener('click', () => {
      playDecisionSe();
      shareResultOnX();
    });
  }

  window.addEventListener('resize', () => {
    if (gameRunning) updateMeterZones(currentConfig);
  });

  preventDoubleTapZoom();
  updateTitle();
  showScreen(els.titleScreen);
})();
