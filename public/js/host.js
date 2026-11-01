const socket = io();

// UI Elements
const hostLobby = document.getElementById('host-lobby');
const hostBattle = document.getElementById('host-battle');
const hostVictory = document.getElementById('host-victory');

const lobbyQuizSelect = document.getElementById('lobby-quiz-select');
const lobbyTimeSelect = document.getElementById('lobby-time-select');
const btnStartBattle = document.getElementById('btn-start-battle');
const lobbyQrImg = document.getElementById('lobby-qr-img');
const lobbyRoomPin = document.getElementById('lobby-room-pin');
const lobbyJoinUrl = document.getElementById('lobby-join-url');
const lobbyTotalCount = document.getElementById('lobby-total-count');
const humanCountBadge = document.getElementById('human-count-badge');
const robotCountBadge = document.getElementById('robot-count-badge');
const rosterHuman = document.getElementById('roster-human');
const rosterRobot = document.getElementById('roster-robot');

const hudHumanHpText = document.getElementById('hud-human-hp-text');
const hudHumanHpBar = document.getElementById('hud-human-hp-bar');
const hudHumanHpGhost = document.getElementById('hud-human-hp-ghost');
const hudRobotHpText = document.getElementById('hud-robot-hp-text');
const hudRobotHpBar = document.getElementById('hud-robot-hp-bar');
const hudRobotHpGhost = document.getElementById('hud-robot-hp-ghost');
const hudRoundCounter = document.getElementById('hud-round-counter');
const hudTimer = document.getElementById('hud-timer');

const hudObjectiveStatus = document.getElementById('hud-objective-status');
const hudObjBarHuman = document.getElementById('hud-obj-bar-human');
const hudObjBarRobot = document.getElementById('hud-obj-bar-robot');
const battleTicker = document.getElementById('battle-ticker');
const toastBubble = document.getElementById('toast-bubble');

const btnCopyLink = document.getElementById('btn-copy-link');
const btnSoundLobby = document.getElementById('btn-sound-lobby');
const btnSoundBattle = document.getElementById('btn-sound-battle');
const soundIconLobby = document.getElementById('sound-icon-lobby');
const soundIconBattle = document.getElementById('sound-icon-battle');
const btnEndBattle = document.getElementById('btn-end-battle');

const battleQuestionText = document.getElementById('battle-question-text');
const bOptTexts = [
  document.getElementById('b-opt-text-0'),
  document.getElementById('b-opt-text-1'),
  document.getElementById('b-opt-text-2'),
  document.getElementById('b-opt-text-3')
];
const bOptCards = [
  document.getElementById('b-opt-0'),
  document.getElementById('b-opt-1'),
  document.getElementById('b-opt-2'),
  document.getElementById('b-opt-3')
];

const victoryTeamTitle = document.getElementById('victory-team-title');
const victoryReasonText = document.getElementById('victory-reason-text');
const podiumGrid = document.getElementById('podium-grid');
const btnReplayBattle = document.getElementById('btn-replay-battle');
const btnBackToLobby = document.getElementById('btn-back-to-lobby');

// Game State
let currentRoomId = null;
let maxBaseHp = 1000;
let currentRoster = { human: [], robot: [] };
let phaserGame = null;
let battleScene = null;

// Sound Toggle Sync
function updateSoundIcons() {
  const isM = window.soundFX ? window.soundFX.isMuted() : false;
  const icon = isM ? '🔇' : '🔊';
  if (soundIconLobby) soundIconLobby.textContent = icon;
  if (soundIconBattle) soundIconBattle.textContent = icon;
}

if (btnSoundLobby) {
  btnSoundLobby.onclick = () => {
    if (window.soundFX) window.soundFX.toggleMute();
    updateSoundIcons();
  };
}
if (btnSoundBattle) {
  btnSoundBattle.onclick = () => {
    if (window.soundFX) window.soundFX.toggleMute();
    updateSoundIcons();
  };
}
updateSoundIcons();

// Toast Bubble Helper
function showToast(msg) {
  if (!toastBubble) return;
  toastBubble.textContent = msg;
  toastBubble.classList.add('show');
  setTimeout(() => toastBubble.classList.remove('show'), 2800);
}

// 1-Click Copy Link
if (btnCopyLink) {
  btnCopyLink.onclick = () => {
    if (window.soundFX) window.soundFX.playClick();
    const url = lobbyJoinUrl ? lobbyJoinUrl.textContent : window.location.origin + '/join';
    navigator.clipboard.writeText(url).then(() => {
      showToast('📋 Đã sao chép link tham gia vào bộ nhớ tạm!');
    }).catch(() => {
      showToast('📋 Hãy copy: ' + url);
    });
  };
}

// Battle Feed Ticker (Max 4 items)
function addBattleTicker(text, type = 'human') {
  if (!battleTicker) return;
  const item = document.createElement('div');
  item.className = `ticker-item ticker-${type}`;
  item.textContent = text;
  battleTicker.appendChild(item);

  while (battleTicker.children.length > 4) {
    battleTicker.removeChild(battleTicker.firstChild);
  }

  setTimeout(() => {
    if (item.parentNode) item.parentNode.removeChild(item);
  }, 4200);
}

// ================= INITIALIZATION =================
async function initHost() {
  await loadQuizzes();
  createNewRoom();
}

async function loadQuizzes() {
  try {
    const res = await fetch('/api/quizzes');
    const quizzes = await res.json();
    lobbyQuizSelect.innerHTML = '';
    quizzes.forEach(q => {
      const opt = document.createElement('option');
      opt.value = q.id;
      opt.className = 'bg-slate-900';
      opt.textContent = `${q.title} (${q.questionCount || 0} câu)`;
      lobbyQuizSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Lỗi tải danh sách quiz:', err);
  }
}

lobbyQuizSelect.onchange = () => createNewRoom();
lobbyTimeSelect.onchange = () => createNewRoom();

function createNewRoom() {
  const quizId = lobbyQuizSelect.value;
  const timePerQuestion = Number(lobbyTimeSelect.value) || 15;

  socket.emit('host_create_room', {
    quizId,
    timePerQuestion,
    baseHp: 1000,
    baseUrl: window.location.origin
  }, (res) => {
    if (res && res.success) {
      currentRoomId = res.roomId;
      maxBaseHp = res.baseHp;
      lobbyRoomPin.textContent = res.roomId;
      lobbyQrImg.src = res.qrCodeDataUrl;
      lobbyJoinUrl.textContent = res.joinUrl;
      console.log(`[Host Room Created] ID: ${res.roomId}`);
    }
  });
}

btnStartBattle.onclick = () => {
  if (window.soundFX) window.soundFX.playClick();
  if (!currentRoomId) return;
  socket.emit('host_start_game', { roomId: currentRoomId });
};

btnReplayBattle.onclick = () => {
  if (window.soundFX) window.soundFX.playClick();
  if (!currentRoomId) return;
  socket.emit('host_restart_game', { roomId: currentRoomId }, () => {
    socket.emit('host_start_game', { roomId: currentRoomId });
  });
};

btnBackToLobby.onclick = () => {
  if (window.soundFX) window.soundFX.playClick();
  if (!currentRoomId) return;
  socket.emit('host_restart_game', { roomId: currentRoomId }, () => {
    showLobby();
  });
};

if (btnEndBattle) {
  btnEndBattle.onclick = () => {
    if (!currentRoomId) return;
    if (window.soundFX) window.soundFX.playClick();
    const confirmed = confirm('🛑 BẠN CÓ CHẮC CHẮN MUỐN KẾT THÚC TRẬN ĐẤU SỚM?\n\nTrận chiến sẽ dừng ngay lập tức. Kết quả thắng/thua và danh sách MVP sẽ được tổng kết dựa trên lượng máu căn cứ và điểm số hiện tại của 2 phe.');
    if (!confirmed) return;

    socket.emit('host_end_game', {
      roomId: currentRoomId,
      reason: 'Trận chiến kết thúc sớm theo quyết định của Quản trò (Host)!'
    });
  };
}

// ================= SOCKET EVENT LISTENERS =================
socket.on('roster_updated', (data) => {
  currentRoster.human = data.teams.human.players || [];
  currentRoster.robot = data.teams.robot.players || [];

  const total = currentRoster.human.length + currentRoster.robot.length;
  if (lobbyTotalCount) {
    lobbyTotalCount.textContent = `${total} / 20 Người Đã Vào`;
    if (total >= 20) {
      lobbyTotalCount.classList.add('bg-rose-950', 'text-rose-400', 'border-rose-700');
      lobbyTotalCount.textContent = `20 / 20 Người [ĐÃ ĐẦY]`;
    } else {
      lobbyTotalCount.classList.remove('bg-rose-950', 'text-rose-400', 'border-rose-700');
    }
  }

  humanCountBadge.textContent = `${currentRoster.human.length} / 10 CHIẾN BINH`;
  robotCountBadge.textContent = `${currentRoster.robot.length} / 10 CHIẾN BINH`;

  renderRoster();

  if (battleScene && battleScene.isReady) {
    battleScene.syncUnits(currentRoster);
  }
});

function renderRoster() {
  if (currentRoster.human.length === 0) {
    rosterHuman.innerHTML = '<div class="text-[#52525B] text-xs italic text-center py-10 font-semibold">Đang chờ chiến binh quét mã...</div>';
  } else {
    rosterHuman.innerHTML = currentRoster.human.map(p => `
      <div class="flex items-center gap-3 p-2.5 rounded-xl bg-white border-2 border-[#18181B] shadow-[2px_3px_0px_#18181B]">
        <div class="w-9 h-9 rounded-lg bg-[#E0F2FE] border-2 border-[#18181B] flex items-center justify-center overflow-hidden">
          <img src="/robotwar/Soldiers/${p.unitClass}.png" class="sprite-icon w-8 h-8 object-cover object-top scale-150">
        </div>
        <div class="flex-1 truncate">
          <div class="font-bold text-sm text-[#18181B] truncate">${escapeHtml(p.name)}</div>
          <div class="text-[10px] text-[#52525B] font-semibold">${p.unitClass}</div>
        </div>
        <span class="w-2.5 h-2.5 rounded-full bg-[#0284C7] border border-[#18181B]"></span>
      </div>
    `).join('');
  }

  if (currentRoster.robot.length === 0) {
    rosterRobot.innerHTML = '<div class="text-[#52525B] text-xs italic text-center py-10 font-semibold">Đang chờ robot quét mã...</div>';
  } else {
    rosterRobot.innerHTML = currentRoster.robot.map(p => `
      <div class="flex items-center gap-3 p-2.5 rounded-xl bg-white border-2 border-[#18181B] shadow-[2px_3px_0px_#18181B]">
        <div class="w-9 h-9 rounded-lg bg-[#FFE4E6] border-2 border-[#18181B] flex items-center justify-center overflow-hidden">
          <img src="/robotwar/Robots/${p.unitClass}.png" class="sprite-icon w-8 h-8 object-cover object-top scale-150">
        </div>
        <div class="flex-1 truncate">
          <div class="font-bold text-sm text-[#18181B] truncate">${escapeHtml(p.name)}</div>
          <div class="text-[10px] text-[#52525B] font-semibold">${p.unitClass}</div>
        </div>
        <span class="w-2.5 h-2.5 rounded-full bg-[#E11D48] border border-[#18181B]"></span>
      </div>
    `).join('');
  }
}

socket.on('game_started', () => {
  showBattle();
  initPhaserGame();
});

socket.on('new_question', (data) => {
  hudRoundCounter.textContent = `CÂU HỎI ${data.questionIndex + 1} / ${data.totalQuestions}`;
  hudTimer.textContent = data.remainingSec;
  hudTimer.classList.remove('timer-warning');

  if (window.renderLatex) {
    window.renderLatex(battleQuestionText, data.question);
    for (let i = 0; i < 4; i++) {
      window.renderLatex(bOptTexts[i], data.options[i] || '');
      bOptCards[i].classList.remove('opt-correct', 'opt-wrong');
    }
  } else {
    battleQuestionText.textContent = data.question;
    for (let i = 0; i < 4; i++) {
      bOptTexts[i].textContent = data.options[i] || '';
      bOptCards[i].classList.remove('opt-correct', 'opt-wrong');
    }
  }

  if (battleScene && battleScene.isReady) {
    battleScene.onNewQuestion();
  }
});

socket.on('timer_tick', (data) => {
  hudTimer.textContent = data.remainingSec;
  if (data.remainingSec <= 5) {
    hudTimer.classList.add('timer-warning');
    if (window.soundFX) window.soundFX.playUrgentTick();
  } else {
    hudTimer.classList.remove('timer-warning');
    if (window.soundFX && data.remainingSec % 2 === 0) window.soundFX.playTick();
  }
});

socket.on('round_result', (data) => {
  for (let i = 0; i < 4; i++) {
    if (i === data.correctIndex) {
      bOptCards[i].classList.add('opt-correct');
    } else {
      bOptCards[i].classList.add('opt-wrong');
    }
  }

  updateHpBars(data.teams.human.hp, data.teams.robot.hp);

  // Update Objective HUD
  if (data.objective) {
    updateObjectiveHud(data.objective);
  }

  if (battleScene && battleScene.isReady) {
    battleScene.playCombatSequence(data.actions, data.objective, data.objectiveEvent);
  }
});

function updateHpBars(humanHp, robotHp) {
  hudHumanHpText.textContent = `${humanHp}/${maxBaseHp}`;
  const humanPct = Math.max(0, (humanHp / maxBaseHp) * 100);
  hudHumanHpBar.style.width = `${humanPct}%`;
  if (hudHumanHpGhost) {
    setTimeout(() => {
      hudHumanHpGhost.style.width = `${humanPct}%`;
    }, 380);
  }

  hudRobotHpText.textContent = `${robotHp}/${maxBaseHp}`;
  const robotPct = Math.max(0, (robotHp / maxBaseHp) * 100);
  hudRobotHpBar.style.width = `${robotPct}%`;
  if (hudRobotHpGhost) {
    setTimeout(() => {
      hudRobotHpGhost.style.width = `${robotPct}%`;
    }, 380);
  }
}

function updateObjectiveHud(obj) {
  // progress: -100 (100% human) to +100 (100% robot)
  const norm = (obj.progress + 100) / 200; // 0 (human) to 1 (robot)
  const humanPct = Math.round((1 - norm) * 100);
  const robotPct = Math.round(norm * 100);

  hudObjBarHuman.style.width = `${humanPct}%`;
  hudObjBarRobot.style.width = `${robotPct}%`;

  if (obj.owner === 'human') {
    hudObjectiveStatus.textContent = '🏰 LÂU ĐÀI: PHE NGƯỜI KIỂM SOÁT';
    hudObjectiveStatus.className = 'text-cyan-400 uppercase tracking-tight font-black';
  } else if (obj.owner === 'robot') {
    hudObjectiveStatus.textContent = '🏰 LÂU ĐÀI: ROBOT KIỂM SOÁT';
    hudObjectiveStatus.className = 'text-rose-500 uppercase tracking-tight font-black';
  } else {
    hudObjectiveStatus.textContent = '🏰 LÂU ĐÀI: TRANH CHẤP';
    hudObjectiveStatus.className = 'text-amber-400 uppercase tracking-tight font-bold';
  }
}

socket.on('game_over', (data) => {
  const delay = data && data.isEarlyEnd ? 400 : 3500;
  setTimeout(() => {
    showVictory(data);
  }, delay);
});

function showLobby() {
  hostLobby.classList.remove('hidden');
  hostBattle.classList.add('hidden');
  hostVictory.classList.add('hidden');
}

function showBattle() {
  hostLobby.classList.add('hidden');
  hostBattle.classList.remove('hidden');
  hostVictory.classList.add('hidden');
  updateHpBars(maxBaseHp, maxBaseHp);

  setTimeout(() => {
    if (phaserGame && phaserGame.scale) {
      phaserGame.scale.refresh();
    }
  }, 100);
}

function showVictory(data) {
  hostLobby.classList.add('hidden');
  hostBattle.classList.add('hidden');
  hostVictory.classList.remove('hidden');

  if (battleScene && battleScene.isReady) {
    battleScene.applyFullOverviewCamera(true);
    if (battleScene.celebrateVictory) {
      battleScene.celebrateVictory(data.winnerTeam);
    }
  }

  if (window.soundFX) window.soundFX.playVictory();
  if (window.launchConfetti) window.launchConfetti(5000);

  if (data.winnerTeam === 'human') {
    victoryTeamTitle.textContent = 'PHE NGƯỜI TOÀN THẮNG!';
    victoryTeamTitle.className = 'text-4xl md:text-5xl font-black uppercase text-cyan-400 drop-shadow-lg mb-2';
  } else if (data.winnerTeam === 'robot') {
    victoryTeamTitle.textContent = 'BINH ĐOÀN ROBOT THỐNG TRỊ!';
    victoryTeamTitle.className = 'text-4xl md:text-5xl font-black uppercase text-rose-500 drop-shadow-lg mb-2';
  } else {
    victoryTeamTitle.textContent = 'HÒA TRẬN!';
    victoryTeamTitle.className = 'text-4xl md:text-5xl font-black uppercase text-amber-400 drop-shadow-lg mb-2';
  }

  victoryReasonText.textContent = data.reason || 'Trận chiến đã kết thúc.';

  const mvps = data.mvpList || [];
  const rankCards = [
    { label: '🥇 MVP #1', border: 'border-[#F59E0B]', bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', shadow: 'shadow-[4px_5px_0px_#18181B]' },
    { label: '🥈 TOP #2', border: 'border-[#18181B]', bg: 'bg-[#F4EFE6]', text: 'text-[#18181B]', shadow: 'shadow-[3px_4px_0px_#18181B]' },
    { label: '🥉 TOP #3', border: 'border-[#18181B]', bg: 'bg-[#FAF8F5]', text: 'text-[#52525B]', shadow: 'shadow-[3px_4px_0px_#18181B]' }
  ];

  const orderedIndices = [1, 0, 2];
  podiumGrid.innerHTML = orderedIndices.map(idx => {
    const p = mvps[idx];
    const styling = rankCards[idx];
    if (!p) return '<div class="taste-card p-4 flex flex-col items-center justify-center h-44 text-[#52525B] text-xs italic">Trống</div>';
    const isHuman = p.team === 'human';
    const heightClass = idx === 0 ? 'h-60 -mt-4 border-[3px]' : 'h-52 border-[2.5px]';

    return `
      <div class="taste-card p-4 flex flex-col items-center justify-center ${heightClass} ${styling.bg} ${styling.shadow}">
        <span class="text-xs font-black uppercase tracking-wider mb-2 ${styling.text}">${styling.label}</span>
        <div class="w-12 h-12 rounded-xl bg-white border-2 border-[#18181B] flex items-center justify-center overflow-hidden mb-2 shadow-[2px_2px_0px_#18181B]">
          <img src="/robotwar/${isHuman ? 'Soldiers' : 'Robots'}/${p.unitClass}.png" class="sprite-icon w-12 h-12 object-cover object-top scale-150">
        </div>
        <div class="font-black text-sm text-[#18181B] truncate max-w-full">${escapeHtml(p.name)}</div>
        <div class="text-[10px] text-[#52525B] font-semibold">${p.unitClass}</div>
        <div class="mt-2 text-sm font-mono font-black ${isHuman ? 'text-[#0284C7]' : 'text-[#E11D48]'}">${p.score} AP</div>
        <div class="text-[10px] text-[#52525B] font-medium">${p.correctCount}/${p.totalAnswered} câu đúng</div>
      </div>
    `;
  }).join('');
}

// ================= PHASER 3 CLOSE-UP TACTICAL ARENA ENGINE =================
function initPhaserGame() {
  if (phaserGame) return;

  const container = document.getElementById('phaser-container');
  const initialWidth = container && container.clientWidth ? Math.floor(container.clientWidth) : window.innerWidth;
  const initialHeight = container && container.clientHeight ? Math.floor(container.clientHeight) : 500;

  const config = {
    type: Phaser.AUTO,
    parent: 'phaser-container',
    width: initialWidth,
    height: initialHeight,
    backgroundColor: '#101827',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      parent: 'phaser-container',
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: TacticalArenaScene
  };

  phaserGame = new Phaser.Game(config);
}

// High-precision Catmull-Rom spline curves matching the Kingdom map dirt roads
const LANE_1_POINTS = [
  { x: 0, y: 430 },
  { x: 50, y: 400 },
  { x: 120, y: 390 },
  { x: 190, y: 390 },
  { x: 220, y: 440 },
  { x: 280, y: 520 },
  { x: 380, y: 535 },
  { x: 465, y: 485 }, // Castle entrance gate (t = 0.5)
  { x: 540, y: 440 },
  { x: 610, y: 390 },
  { x: 700, y: 340 },
  { x: 730, y: 280 },
  { x: 810, y: 260 },
  { x: 920, y: 260 },
  { x: 1024, y: 260 }
];

const LANE_2_POINTS = [
  { x: 40, y: 680 },
  { x: 110, y: 650 },
  { x: 160, y: 600 },
  { x: 185, y: 540 },
  { x: 240, y: 530 },
  { x: 350, y: 540 },
  { x: 465, y: 510 }, // Courtyard South (t = 0.5)
  { x: 560, y: 530 },
  { x: 640, y: 550 },
  { x: 730, y: 540 },
  { x: 830, y: 540 },
  { x: 920, y: 560 },
  { x: 1024, y: 580 }
];

function getSplinePos(pts, t) {
  t = Math.max(0.0, Math.min(1.0, t));
  const n = pts.length - 1;
  const i = Math.min(Math.floor(t * n), n - 1);
  const localT = (t * n) - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[Math.min(n, i + 1)];
  const p3 = pts[Math.min(n, i + 2)];
  const t2 = localT * localT;
  const t3 = t2 * localT;
  const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * localT + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * localT + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  return { x, y };
}

class TacticalArenaScene extends Phaser.Scene {
  constructor() {
    super('TacticalArenaScene');
    this.isReady = false;
    this.unitSprites = {};
    this.objectivePulse = null;
    this.objectiveFlag = null;
    this.objectiveText = null;
    this.mapBg = null;
    this.mapDisplayW = 1024;
    this.mapDisplayH = 682;
    this.mapOriginX = 0;
    this.mapOriginY = 0;
  }

  // Exact native aspect ratio coordinate mapper (Preserves 1024:682 without any distortion)
  mapX(refX) {
    return this.mapOriginX + (refX / 1024) * this.mapDisplayW;
  }

  mapY(refY) {
    return this.mapOriginY + (refY / 682) * this.mapDisplayH;
  }

  getUnitScale() {
    const factor = this.mapDisplayW / 1024;
    return Math.max(1.6, Math.min(2.7, 1.95 * Math.max(0.75, factor)));
  }

  applyCombatCamera(animate = false) {
    const w = this.scale.width;
    const h = this.scale.height;
    const targetX = w / 2;
    const targetY = h / 2;
    const overviewZoom = 1.0;

    if (animate) {
      this.cameras.main.pan(targetX, targetY, 400, 'Power2');
      this.cameras.main.zoomTo(overviewZoom, 400, 'Power2');
    } else {
      this.cameras.main.centerOn(targetX, targetY);
      this.cameras.main.setZoom(overviewZoom);
    }
  }

  applyFullOverviewCamera(animate = false) {
    const w = this.scale.width;
    const h = this.scale.height;
    if (animate) {
      this.cameras.main.pan(w / 2, h / 2, 400, 'Power2');
      this.cameras.main.zoomTo(1.0, 400, 'Power2');
    } else {
      this.cameras.main.centerOn(w / 2, h / 2);
      this.cameras.main.setZoom(1.0);
    }
  }

  preload() {
    battleScene = this;

    // Kingdom Arena Map Background (User Fantasy Map)
    this.load.image('map_kingdom', '/assets/map/kingdom_arena_map.png');

    // Soldiers (16x16 frames)
    const soldiers = [
      'Assault-Class', 'Sniper-Class', 'MachineGunner-Class',
      'Grenadier-Class', 'AntiTank-Class', 'RadioOperator-Class', 'SquadLeader'
    ];
    soldiers.forEach(s => {
      this.load.spritesheet(s, `/robotwar/Soldiers/${s}.png`, { frameWidth: 16, frameHeight: 16 });
    });

    // Robots
    this.load.spritesheet('Spider', '/robotwar/Robots/Spider.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('Scarab', '/robotwar/Robots/Scarab.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('Centipede', '/robotwar/Robots/Centipede.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('Wasp', '/robotwar/Robots/Wasp.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('Hornet', '/robotwar/Robots/Hornet.png', { frameWidth: 24, frameHeight: 24 });

    // Projectiles
    this.load.spritesheet('bullets', '/robotwar/Projectiles/bullets+plasma.png', { frameWidth: 8, frameHeight: 8 });
    this.load.spritesheet('rpg', '/robotwar/Projectiles/RPG-round.png', { frameWidth: 16, frameHeight: 16 });

    // Effects
    this.load.spritesheet('muzzle', '/robotwar/Effects/muzzle-flashes.png', { frameWidth: 8, frameHeight: 8 });
    this.load.spritesheet('laser', '/robotwar/Effects/laser-flash.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('small_exp', '/robotwar/Effects/small-explosion.png', { frameWidth: 24, frameHeight: 24 });
    this.load.spritesheet('big_exp', '/robotwar/Effects/big-explosion.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('sparks', '/robotwar/Effects/hit-sparks.png', { frameWidth: 8, frameHeight: 8 });
    this.load.spritesheet('spatters', '/robotwar/Effects/hit-spatters.png', { frameWidth: 8, frameHeight: 8 });
    this.load.spritesheet('smoke', '/robotwar/Effects/smoke.png', { frameWidth: 8, frameHeight: 8 });
    this.load.spritesheet('fragments', '/robotwar/Effects/big-fragments.png', { frameWidth: 32, frameHeight: 32 });

    // Objective & UI Assets
    this.load.spritesheet('objective_flag', '/robotwar/UI/objective-flag.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('objective_pulse', '/robotwar/UI/objective-pulse.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('target_cursor', '/robotwar/UI/target-cursor.png', { frameWidth: 8, frameHeight: 8 });
  }

  create() {
    this.createAnimations();
    this.buildTacticalMap();

    this.cameras.main.setBackgroundColor('#101827');

    let resizeTimer = null;
    this.scale.on('resize', (gameSize) => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.handleResize(Math.floor(gameSize.width), Math.floor(gameSize.height));
      }, 50);
    });

    this.isReady = true;
    this.syncUnits(currentRoster);
  }

  handleResize(width, height) {
    width = Math.floor(width);
    height = Math.floor(height);
    if (width <= 0 || height <= 0) return;

    const MAP_W = 1024;
    const MAP_H = 682;
    const mapAspect = MAP_W / MAP_H;
    const screenAspect = width / height;

    let bgW, bgH;
    if (screenAspect > mapAspect) {
      bgH = height;
      bgW = Math.round(height * mapAspect);
    } else {
      bgW = width;
      bgH = Math.round(width / mapAspect);
    }

    this.mapDisplayW = bgW;
    this.mapDisplayH = bgH;
    this.mapOriginX = Math.round((width - bgW) / 2);
    this.mapOriginY = Math.round((height - bgH) / 2);

    if (this.mapBg) {
      this.mapBg.setPosition(Math.round(width / 2), Math.round(height / 2));
      this.mapBg.setDisplaySize(bgW, bgH);
    }

    const objX = this.mapX(465);
    const objY = this.mapY(495);
    const beaconScale = Math.max(0.9, 1.2 * (bgH / 682));

    if (this.objectivePulse) {
      this.objectivePulse.setPosition(objX, objY);
      this.objectivePulse.setScale(beaconScale);
    }
    if (this.objectiveFlag) {
      this.objectiveFlag.setPosition(objX, this.mapY(440));
      this.objectiveFlag.setScale(beaconScale * 0.85);
    }
    if (this.objectiveText) {
      this.objectiveText.setPosition(objX, this.mapY(385));
      this.objectiveText.setFontSize(`${Math.round(Math.max(10, 12 * (bgW / 1024)))}px`);
    }

    // Reposition all active unit sprites
    Object.values(this.unitSprites).forEach(u => {
      this.updateUnitScreenPos(u);
    });

    this.applyCombatCamera(false);
  }

  createAnimations() {
    const soldiers = [
      'Assault-Class', 'Sniper-Class', 'MachineGunner-Class',
      'Grenadier-Class', 'AntiTank-Class', 'RadioOperator-Class', 'SquadLeader'
    ];
    soldiers.forEach(key => {
      this.anims.create({
        key: `${key}-idle`,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: 4 }),
        frameRate: 6,
        repeat: -1
      });
      // Walk / Marching animation
      this.anims.create({
        key: `${key}-walk`,
        frames: this.anims.generateFrameNumbers(key, { start: 5, end: 9 }),
        frameRate: 10,
        repeat: -1
      });
      this.anims.create({
        key: `${key}-fire`,
        frames: this.anims.generateFrameNumbers(key, { start: 15, end: 19 }),
        frameRate: 12,
        repeat: 0
      });
      this.anims.create({
        key: `${key}-hit`,
        frames: this.anims.generateFrameNumbers(key, { start: 20, end: 24 }),
        frameRate: 10,
        repeat: 0
      });
    });

    ['Spider', 'Scarab'].forEach(key => {
      this.anims.create({
        key: `${key}-idle`,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: 4 }),
        frameRate: 6,
        repeat: -1
      });
      this.anims.create({
        key: `${key}-walk`,
        frames: this.anims.generateFrameNumbers(key, { start: 5, end: 9 }),
        frameRate: 10,
        repeat: -1
      });
      this.anims.create({
        key: `${key}-fire`,
        frames: this.anims.generateFrameNumbers(key, { start: 10, end: 14 }),
        frameRate: 12,
        repeat: 0
      });
      this.anims.create({
        key: `${key}-hit`,
        frames: this.anims.generateFrameNumbers(key, { start: 15, end: 19 }),
        frameRate: 10,
        repeat: 0
      });
    });

    // Centipede
    this.anims.create({
      key: 'Centipede-idle',
      frames: this.anims.generateFrameNumbers('Centipede', { start: 0, end: 7 }),
      frameRate: 6,
      repeat: -1
    });
    this.anims.create({
      key: 'Centipede-walk',
      frames: this.anims.generateFrameNumbers('Centipede', { start: 8, end: 15 }),
      frameRate: 10,
      repeat: -1
    });
    this.anims.create({
      key: 'Centipede-fire',
      frames: this.anims.generateFrameNumbers('Centipede', { start: 16, end: 23 }),
      frameRate: 12,
      repeat: 0
    });
    this.anims.create({
      key: 'Centipede-hit',
      frames: this.anims.generateFrameNumbers('Centipede', { start: 24, end: 31 }),
      frameRate: 10,
      repeat: 0
    });

    // Wasp
    this.anims.create({
      key: 'Wasp-idle',
      frames: this.anims.generateFrameNumbers('Wasp', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });
    this.anims.create({
      key: 'Wasp-walk',
      frames: this.anims.generateFrameNumbers('Wasp', { start: 0, end: 3 }),
      frameRate: 9,
      repeat: -1
    });
    this.anims.create({
      key: 'Wasp-fire',
      frames: this.anims.generateFrameNumbers('Wasp', { start: 4, end: 7 }),
      frameRate: 12,
      repeat: 0
    });
    this.anims.create({
      key: 'Wasp-hit',
      frames: this.anims.generateFrameNumbers('Wasp', { start: 4, end: 7 }),
      frameRate: 10,
      repeat: 0
    });

    // Hornet
    this.anims.create({
      key: 'Hornet-idle',
      frames: this.anims.generateFrameNumbers('Hornet', { start: 0, end: 7 }),
      frameRate: 10,
      repeat: -1
    });
    this.anims.create({
      key: 'Hornet-walk',
      frames: this.anims.generateFrameNumbers('Hornet', { start: 0, end: 7 }),
      frameRate: 12,
      repeat: -1
    });
    this.anims.create({
      key: 'Hornet-fire',
      frames: this.anims.generateFrameNumbers('Hornet', { start: 8, end: 15 }),
      frameRate: 14,
      repeat: 0
    });
    this.anims.create({
      key: 'Hornet-hit',
      frames: this.anims.generateFrameNumbers('Hornet', { start: 8, end: 15 }),
      frameRate: 12,
      repeat: 0
    });

    // Combat Effects Animations
    this.anims.create({
      key: 'anim-muzzle',
      frames: this.anims.generateFrameNumbers('muzzle', { start: 0, end: 3 }),
      frameRate: 20,
      repeat: 0
    });
    this.anims.create({
      key: 'anim-laser',
      frames: this.anims.generateFrameNumbers('laser', { start: 0, end: 2 }),
      frameRate: 16,
      repeat: 0
    });
    this.anims.create({
      key: 'anim-sparks',
      frames: this.anims.generateFrameNumbers('sparks', { start: 0, end: 5 }),
      frameRate: 18,
      repeat: 0
    });
    this.anims.create({
      key: 'anim-spatters',
      frames: this.anims.generateFrameNumbers('spatters', { start: 0, end: 5 }),
      frameRate: 16,
      repeat: 0
    });
    this.anims.create({
      key: 'anim-smoke',
      frames: this.anims.generateFrameNumbers('smoke', { start: 0, end: 7 }),
      frameRate: 14,
      repeat: 0
    });
    this.anims.create({
      key: 'anim-fragments',
      frames: this.anims.generateFrameNumbers('fragments', { start: 0, end: 5 }),
      frameRate: 16,
      repeat: 0
    });
    this.anims.create({
      key: 'anim-big-exp',
      frames: this.anims.generateFrameNumbers('big_exp', { start: 0, end: 10 }),
      frameRate: 16,
      repeat: 0
    });
    this.anims.create({
      key: 'anim-small-exp',
      frames: this.anims.generateFrameNumbers('small_exp', { start: 0, end: 8 }),
      frameRate: 16,
      repeat: 0
    });

    // Objective Capture Point Animations
    this.anims.create({
      key: 'anim-flag',
      frames: this.anims.generateFrameNumbers('objective_flag', { start: 0, end: 5 }),
      frameRate: 7,
      repeat: -1
    });
    this.anims.create({
      key: 'anim-pulse',
      frames: this.anims.generateFrameNumbers('objective_pulse', { start: 0, end: 7 }),
      frameRate: 8,
      repeat: -1
    });
  }

  buildTacticalMap() {
    const w = this.scale.width;
    const h = this.scale.height;

    const MAP_W = 1024;
    const MAP_H = 682;
    const mapAspect = MAP_W / MAP_H;
    const screenAspect = w / h;

    let bgW, bgH;
    if (screenAspect > mapAspect) {
      bgH = h;
      bgW = Math.round(h * mapAspect);
    } else {
      bgW = w;
      bgH = Math.round(w / mapAspect);
    }

    this.mapDisplayW = bgW;
    this.mapDisplayH = bgH;
    this.mapOriginX = Math.round((w - bgW) / 2);
    this.mapOriginY = Math.round((h - bgH) / 2);

    // 1. Kingdom Arena Panoramic Background
    this.mapBg = this.add.image(Math.round(w / 2), Math.round(h / 2), 'map_kingdom');
    this.mapBg.setDisplaySize(bgW, bgH);
    this.mapBg.setDepth(-10);

    // 2. Central Castle Objective Beacon (Courtyard at ref 465, 495)
    const objX = this.mapX(465);
    const objY = this.mapY(495);
    const beaconScale = Math.max(0.9, 1.2 * (bgH / 682));

    this.objectivePulse = this.add.sprite(objX, objY, 'objective_pulse');
    this.objectivePulse.setScale(beaconScale);
    this.objectivePulse.play('anim-pulse');
    this.objectivePulse.setTint(0xffd600); // Yellow neutral pulse
    this.objectivePulse.setDepth(1);

    this.objectiveFlag = this.add.sprite(objX, this.mapY(440), 'objective_flag');
    this.objectiveFlag.setScale(beaconScale * 0.85);
    this.objectiveFlag.play('anim-flag');
    this.objectiveFlag.setDepth(2);

    this.objectiveText = this.add.text(objX, this.mapY(385), 'LÂU ĐÀI TRUNG TÂM', {
      fontFamily: 'Plus Jakarta Sans',
      fontSize: `${Math.round(Math.max(10, 12 * (bgW / 1024)))}px`,
      fontStyle: 'bold',
      color: '#18181B',
      backgroundColor: '#FEF3C7',
      padding: { x: 8, y: 3 }
    }).setOrigin(0.5);
    this.objectiveText.setDepth(3);

    // Full overview camera
    this.applyCombatCamera(false);
  }

  updateUnitScreenPos(u, offsetBob = 0) {
    if (!u || !u.sprite || !u.label) return;
    const pts = u.lane === 0 ? LANE_1_POINTS : LANE_2_POINTS;
    const refPt = getSplinePos(pts, u.t);
    const posX = this.mapX(refPt.x);
    const posY = this.mapY(refPt.y) + offsetBob;
    const uScale = this.getUnitScale();

    u.sprite.setPosition(posX, posY);
    u.sprite.setScale(uScale);
    const labelOffset = 22 * (uScale / 1.8);
    u.label.setPosition(posX, posY - labelOffset);
  }

  update(time, delta) {
    if (!this.isReady) return;
    Object.values(this.unitSprites).forEach(u => {
      if (!u.isMoving) {
        // Subtle breathing motion while waiting
        const bob = Math.sin((time + u.seed) * 0.0035) * 1.5;
        this.updateUnitScreenPos(u, bob);
      }
    });
  }

  syncUnits(roster) {
    const activePlayerIds = new Set();
    const unitScale = this.getUnitScale();

    // Human Team (Up to 10 players)
    const humanPlayers = (roster.human || []).slice(0, 10);
    humanPlayers.forEach((p, idx) => {
      activePlayerIds.add(p.id);
      const lane = idx % 2; // 0 = upper road, 1 = lower road
      const laneSlot = Math.floor(idx / 2); // 0, 1, 2, 3, 4
      const defaultT = 0.08 + laneSlot * 0.045; // Staggered near West base

      let u = this.unitSprites[p.id];
      if (!u) {
        const pts = lane === 0 ? LANE_1_POINTS : LANE_2_POINTS;
        const refPt = getSplinePos(pts, defaultT);
        const posX = this.mapX(refPt.x);
        const posY = this.mapY(refPt.y);

        const sprite = this.add.sprite(posX, posY, p.unitClass);
        sprite.setScale(unitScale);
        sprite.play(`${p.unitClass}-idle`, true);
        sprite.setFlipX(false);
        sprite.setDepth(5);

        const labelOffset = 22 * (unitScale / 1.8);
        const label = this.add.text(posX, posY - labelOffset, p.name, {
          fontFamily: 'Plus Jakarta Sans',
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#0369A1',
          backgroundColor: '#E0F2FE',
          padding: { x: 5, y: 1.5 }
        }).setOrigin(0.5);
        label.setDepth(6);

        u = {
          id: p.id,
          name: p.name,
          sprite,
          label,
          team: 'human',
          unitClass: p.unitClass,
          lane,
          t: defaultT,
          targetT: defaultT,
          isMoving: false,
          seed: Math.random() * 1000
        };
        this.unitSprites[p.id] = u;
      } else {
        u.name = p.name;
        u.label.setText(p.name);
      }
      this.updateUnitScreenPos(u);
    });

    // Robot Team (Up to 10 players)
    const robotPlayers = (roster.robot || []).slice(0, 10);
    robotPlayers.forEach((p, idx) => {
      activePlayerIds.add(p.id);
      const lane = idx % 2;
      const laneSlot = Math.floor(idx / 2);
      const defaultT = 0.92 - laneSlot * 0.045; // Staggered near East base

      let u = this.unitSprites[p.id];
      if (!u) {
        const pts = lane === 0 ? LANE_1_POINTS : LANE_2_POINTS;
        const refPt = getSplinePos(pts, defaultT);
        const posX = this.mapX(refPt.x);
        const posY = this.mapY(refPt.y);

        const sprite = this.add.sprite(posX, posY, p.unitClass);
        sprite.setScale(unitScale);
        sprite.play(`${p.unitClass}-idle`, true);
        sprite.setFlipX(true);
        sprite.setDepth(5);

        const labelOffset = 22 * (unitScale / 1.8);
        const label = this.add.text(posX, posY - labelOffset, p.name, {
          fontFamily: 'Plus Jakarta Sans',
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#BE123C',
          backgroundColor: '#FFE4E6',
          padding: { x: 5, y: 1.5 }
        }).setOrigin(0.5);
        label.setDepth(6);

        u = {
          id: p.id,
          name: p.name,
          sprite,
          label,
          team: 'robot',
          unitClass: p.unitClass,
          lane,
          t: defaultT,
          targetT: defaultT,
          isMoving: false,
          seed: Math.random() * 1000
        };
        this.unitSprites[p.id] = u;
      } else {
        u.name = p.name;
        u.label.setText(p.name);
      }
      this.updateUnitScreenPos(u);
    });

    Object.keys(this.unitSprites).forEach(id => {
      if (!activePlayerIds.has(id)) {
        this.unitSprites[id].sprite.destroy();
        this.unitSprites[id].label.destroy();
        delete this.unitSprites[id];
      }
    });
  }

  onNewQuestion() {
    this.applyCombatCamera(false);
    Object.values(this.unitSprites).forEach(u => {
      u.isMoving = false;
      u.sprite.play(`${u.unitClass}-idle`, true);
      u.sprite.setFlipX(u.team === 'robot');
    });
  }

  // Play Full Combat & Tug of War Movement Sequence
  playCombatSequence(actions, objectiveState, objectiveEvent) {
    const uScale = this.getUnitScale();

    // 1. TUG OF WAR ADVANCE & RETREAT MARCH
    actions.forEach((act, idx) => {
      const u = this.unitSprites[act.playerId];
      if (!u) return;

      const isHuman = act.team === 'human';

      if (act.isCorrect) {
        // Calculate advance step
        let deltaT = 0.075;
        if (act.streak >= 2) deltaT += 0.025; // Streak charge bonus
        if (act.isCritical) deltaT += 0.02;

        const startT = u.t;
        const targetT = isHuman ? Math.min(0.92, startT + deltaT) : Math.max(0.08, startT - deltaT);

        u.isMoving = true;
        u.sprite.play(`${u.unitClass}-walk`, true);
        u.sprite.setFlipX(!isHuman); // Human faces right, Robot faces left

        // Speed / Charge aura if high streak
        if (act.streak >= 2) {
          const aura = this.add.sprite(u.sprite.x, u.sprite.y, 'laser');
          aura.setScale(uScale * 1.3).play('anim-laser');
          this.tweens.add({
            targets: aura,
            alpha: 0,
            duration: 600,
            onComplete: () => aura.destroy()
          });
        }

        // March Tween along lane spline
        this.tweens.add({
          targets: u,
          t: targetT,
          duration: 1300,
          ease: 'Power1',
          onUpdate: () => {
            this.updateUnitScreenPos(u);
          },
          onComplete: () => {
            u.isMoving = false;
            u.t = targetT;
            this.updateUnitScreenPos(u);

            // Execute combat weapon attack once march completes
            this.executeUnitAttack(u, act);
          }
        });

      } else {
        // Incorrect answer: Unit is hit & staggers backward
        u.sprite.play(`${u.unitClass}-hit`, true);
        const sparks = this.add.sprite(u.sprite.x, u.sprite.y, 'sparks');
        sparks.setScale(uScale).play('anim-sparks').once('animationcomplete', () => sparks.destroy());

        const knockbackT = isHuman ? Math.max(0.04, u.t - 0.035) : Math.min(0.96, u.t + 0.035);
        this.tweens.add({
          targets: u,
          t: knockbackT,
          duration: 450,
          ease: 'Quad.easeOut',
          onUpdate: () => {
            this.updateUnitScreenPos(u);
          },
          onComplete: () => {
            u.t = knockbackT;
            this.updateUnitScreenPos(u);
            u.sprite.play(`${u.unitClass}-idle`, true);
            u.sprite.setFlipX(isHuman ? false : true);
          }
        });
      }
    });

    // 2. CHECK BASE SIEGE BREACHES (Lính áp sát căn cứ địch)
    this.time.delayedCall(1600, () => {
      this.checkBaseBreaches();
    });

    // 3. HANDLE OBJECTIVE CAPTURE EVENT (CHIẾM CỨ ĐIỂM LÂU ĐÀI)
    if (objectiveEvent && objectiveEvent.type === 'captured') {
      this.time.delayedCall(actions.length * 100 + 1700, () => {
        const isHumanWinner = objectiveEvent.winner === 'human';
        const beaconX = this.mapX(465);
        const beaconY = this.mapY(440);

        if (window.soundFX) {
          window.soundFX.playCapture();
          window.soundFX.playExplosion(true);
        }

        addBattleTicker(`🏰 ${objectiveEvent.title}! Pháo quỹ đạo khai hỏa!`, 'castle');

        this.objectivePulse.setTint(isHumanWinner ? 0x0284c7 : 0xe11d48);
        this.objectiveFlag.setTint(isHumanWinner ? 0x0284c7 : 0xe11d48);

        this.objectiveText.setText(isHumanWinner ? 'LÂU ĐÀI: PHE NGƯỜI KIỂM SOÁT' : 'LÂU ĐÀI: ROBOT KIỂM SOÁT');
        this.objectiveText.setColor(isHumanWinner ? '#38bdf8' : '#fb7185');

        const beaconExp = this.add.sprite(beaconX, beaconY, 'big_exp');
        beaconExp.setScale(uScale * 1.8).play('anim-big-exp').once('animationcomplete', () => beaconExp.destroy());
        this.cameras.main.shake(200, 0.012);

        // Orbital Artillery Strike from Castle to Enemy Base!
        const enemyBaseX = isHumanWinner ? this.mapX(940) : this.mapX(60);
        const enemyBaseY = isHumanWinner ? this.mapY(260) : this.mapY(530);

        const beam = this.add.graphics();
        beam.lineStyle(6, isHumanWinner ? 0x0284c7 : 0xe11d48, 0.95);
        beam.lineBetween(beaconX, beaconY, enemyBaseX, enemyBaseY);
        this.time.delayedCall(500, () => beam.destroy());

        const baseImpact = this.add.sprite(enemyBaseX, enemyBaseY, 'big_exp');
        baseImpact.setScale(uScale * 2.0).play('anim-big-exp').once('animationcomplete', () => baseImpact.destroy());
      });
    }
  }

  executeUnitAttack(u, act) {
    const uScale = this.getUnitScale();
    const isHuman = u.team === 'human';

    u.sprite.play(`${u.unitClass}-fire`, true);
    u.sprite.once('animationcomplete', () => {
      u.sprite.play(`${u.unitClass}-idle`, true);
      u.sprite.setFlipX(isHuman ? false : true);
    });

    const startX = u.sprite.x;
    const startY = u.sprite.y;

    // Find nearest opposing soldier on the same lane
    let targetX, targetY;
    let targetUnit = null;
    let minDist = 99999;

    Object.values(this.unitSprites).forEach(other => {
      if (other.team !== u.team && other.lane === u.lane) {
        const d = Phaser.Math.Distance.Between(startX, startY, other.sprite.x, other.sprite.y);
        if (d < minDist) {
          minDist = d;
          targetUnit = other;
        }
      }
    });

    if (targetUnit && minDist < 450) {
      targetX = targetUnit.sprite.x + (Math.random() * 20 - 10);
      targetY = targetUnit.sprite.y + (Math.random() * 20 - 10);
    } else {
      // Aim toward Castle or forward along lane
      const forwardT = isHuman ? Math.min(1.0, u.t + 0.22) : Math.max(0.0, u.t - 0.22);
      const pts = u.lane === 0 ? LANE_1_POINTS : LANE_2_POINTS;
      const forwardRef = getSplinePos(pts, forwardT);
      targetX = this.mapX(forwardRef.x);
      targetY = this.mapY(forwardRef.y);
    }

    // Muzzle flash
    const muzzleOffset = isHuman ? (10 * uScale) : (-10 * uScale);
    const muzzle = this.add.sprite(startX + muzzleOffset, startY, isHuman ? 'muzzle' : 'laser');
    muzzle.setScale(uScale).play(isHuman ? 'anim-muzzle' : 'anim-laser', true);
    muzzle.once('animationcomplete', () => muzzle.destroy());

    const isRPG = act.streak >= 3;
    if (window.soundFX) {
      if (isRPG) window.soundFX.playRpgLaunch();
      else window.soundFX.playShot(!isHuman);
    }

    // Trajectory beam
    const arrowLine = this.add.graphics();
    arrowLine.lineStyle(2, isHuman ? 0x0284c7 : 0xe11d48, 0.7);
    arrowLine.lineBetween(startX, startY, targetX, targetY);
    this.time.delayedCall(250, () => arrowLine.destroy());

    // Projectile
    const projectileKey = isRPG ? 'rpg' : 'bullets';
    const proj = this.add.sprite(startX, startY, projectileKey);
    proj.setScale(uScale);
    if (!isHuman) proj.setFlipX(true);

    const duration = isRPG ? 380 : 250;

    this.tweens.add({
      targets: proj,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Power1',
      onComplete: () => {
        proj.destroy();

        if (window.soundFX) {
          window.soundFX.playHit();
          window.soundFX.playExplosion(isRPG);
        }

        if (targetUnit && targetUnit.sprite) {
          targetUnit.sprite.play(`${targetUnit.unitClass}-hit`, true);
          targetUnit.sprite.once('animationcomplete', () => {
            targetUnit.sprite.play(`${targetUnit.unitClass}-idle`, true);
            targetUnit.sprite.setFlipX(targetUnit.team === 'robot');
          });
        }

        addBattleTicker(
          `${isHuman ? '🛡️' : '🤖'} ${act.playerName || (isHuman ? 'Chiến Binh' : 'Robot')} tiến công nổ súng! (-${act.damage} HP)`,
          isHuman ? 'human' : 'robot'
        );

        // Multi-layer impact VFX
        const sparks = this.add.sprite(targetX, targetY, 'sparks');
        sparks.setScale(uScale * 0.9).play('anim-sparks').once('animationcomplete', () => sparks.destroy());

        const spatters = this.add.sprite(targetX + 4, targetY, 'spatters');
        spatters.setScale(uScale * 0.9).play('anim-spatters').once('animationcomplete', () => spatters.destroy());

        const smoke = this.add.sprite(targetX, targetY - 8, 'smoke');
        smoke.setScale(uScale * 0.9).play('anim-smoke').once('animationcomplete', () => smoke.destroy());

        if (isRPG) {
          const bigExp = this.add.sprite(targetX, targetY, 'big_exp');
          bigExp.setScale(uScale * 1.3).play('anim-big-exp').once('animationcomplete', () => bigExp.destroy());
          this.cameras.main.shake(120, 0.007);
        } else {
          const smallExp = this.add.sprite(targetX, targetY, 'small_exp');
          smallExp.setScale(uScale * 1.1).play('anim-small-exp').once('animationcomplete', () => smallExp.destroy());
        }

        // Floating Damage Number
        const dmgText = this.add.text(targetX, targetY - 18, `-${act.damage}`, {
          fontFamily: 'Chakra Petch',
          fontSize: isRPG ? '20px' : '15px',
          fontStyle: 'bold',
          color: isHuman ? '#38bdf8' : '#fb7185'
        }).setOrigin(0.5);

        this.tweens.add({
          targets: dmgText,
          y: targetY - 45,
          alpha: 0,
          duration: 700,
          onComplete: () => dmgText.destroy()
        });
      }
    });
  }

  checkBaseBreaches() {
    const uScale = this.getUnitScale();
    Object.values(this.unitSprites).forEach(u => {
      if (u.team === 'human' && u.t >= 0.82) {
        // Human sieging robot base
        const enemyBaseX = this.mapX(940);
        const enemyBaseY = this.mapY(260);
        const exp = this.add.sprite(enemyBaseX, enemyBaseY, 'big_exp');
        exp.setScale(uScale * 1.6).play('anim-big-exp').once('animationcomplete', () => exp.destroy());
        this.cameras.main.shake(160, 0.01);
        addBattleTicker(`🔥 CHIẾN BINH ${u.name} ĐÃ ÁP SÁT VÀ NÃ PHÁO VÀO CĂN CỨ ROBOT!`, 'human');
      } else if (u.team === 'robot' && u.t <= 0.18) {
        // Robot sieging human base
        const enemyBaseX = this.mapX(60);
        const enemyBaseY = this.mapY(530);
        const exp = this.add.sprite(enemyBaseX, enemyBaseY, 'big_exp');
        exp.setScale(uScale * 1.6).play('anim-big-exp').once('animationcomplete', () => exp.destroy());
        this.cameras.main.shake(160, 0.01);
        addBattleTicker(`⚠️ ROBOT ${u.name} ĐÃ ĐỘT KÍCH VÀ BẮN PHÁ CĂN CỨ LOÀI NGƯỜI!`, 'robot');
      }
    });
  }

  celebrateVictory(winnerTeam) {
    const uScale = this.getUnitScale();
    Object.values(this.unitSprites).forEach(u => {
      u.isMoving = false;
      if (u.team === winnerTeam) {
        this.tweens.add({
          targets: u.sprite,
          y: u.sprite.y - (18 * (uScale / 1.8)),
          yoyo: true,
          repeat: 4,
          duration: 300,
          ease: 'Quad.easeInOut'
        });
        const sparks = this.add.sprite(u.sprite.x, u.sprite.y - 20, 'sparks');
        sparks.setScale(uScale * 1.2).play('anim-sparks').once('animationcomplete', () => sparks.destroy());
      } else if (winnerTeam !== 'draw') {
        u.sprite.play(`${u.unitClass}-hit`, true);
      }
    });
  }
}

// Fullscreen Toggle Handler
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log('Fullscreen error:', err.message);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

const btnFullscreenLobby = document.getElementById('btn-fullscreen-lobby');
const btnFullscreenBattle = document.getElementById('btn-fullscreen-battle');
if (btnFullscreenLobby) btnFullscreenLobby.onclick = toggleFullscreen;
if (btnFullscreenBattle) btnFullscreenBattle.onclick = toggleFullscreen;

// Keyboard shortcut 'F' for fullscreen
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
      toggleFullscreen();
    }
  }
});

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.onload = initHost;
