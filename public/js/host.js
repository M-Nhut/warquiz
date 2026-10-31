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
    baseHp: 1000
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

  battleQuestionText.textContent = data.question;
  for (let i = 0; i < 4; i++) {
    bOptTexts[i].textContent = data.options[i] || '';
    bOptCards[i].classList.remove('opt-correct', 'opt-wrong');
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
  setTimeout(() => {
    showVictory(data);
  }, 4000);
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
}

function showVictory(data) {
  hostLobby.classList.add('hidden');
  hostBattle.classList.add('hidden');
  hostVictory.classList.remove('hidden');

  if (battleScene && battleScene.isReady) {
    battleScene.applyFullOverviewCamera(true);
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
  const initialWidth = container && container.clientWidth ? container.clientWidth : window.innerWidth;
  const initialHeight = container && container.clientHeight ? container.clientHeight : 500;

  const config = {
    type: Phaser.AUTO,
    parent: 'phaser-container',
    width: initialWidth,
    height: initialHeight,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      parent: 'phaser-container',
      width: '100%',
      height: '100%'
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: TacticalArenaScene
  };

  phaserGame = new Phaser.Game(config);
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
    return Math.max(2.4, Math.min(4.5, 2.7 * Math.max(0.9, factor)));
  }

  applyCombatCamera(animate = true) {
    // Focus in close-up on central castle corridor and front battle line
    const targetX = this.mapX(470);
    const targetY = this.mapY(380);
    const combatZoom = 1.48;

    if (animate) {
      this.cameras.main.pan(targetX, targetY, 700, 'Power2');
      this.cameras.main.zoomTo(combatZoom, 700, 'Power2');
    } else {
      this.cameras.main.centerOn(targetX, targetY);
      this.cameras.main.setZoom(combatZoom);
    }
  }

  applyFullOverviewCamera(animate = true) {
    const w = this.scale.width;
    const h = this.scale.height;
    if (animate) {
      this.cameras.main.pan(w / 2, h / 2, 800, 'Power2');
      this.cameras.main.zoomTo(1.0, 800, 'Power2');
    } else {
      this.cameras.main.centerOn(w / 2, h / 2);
      this.cameras.main.setZoom(1.0);
    }
  }

  preload() {
    battleScene = this;

    // Kingdom Arena Map Background (User Fantasy Map)
    this.load.image('map_kingdom', '/assets/map/kingdom_arena_map.png');

    // Sliced 32x32 Tiles & Obstacles (Cyber Map)
    this.load.image('map_courtyard', '/assets/map/courtyard_clean.png');
    this.load.image('map_courtyard_var', '/assets/map/courtyard_variation.png');
    this.load.image('map_terrain_dark', '/assets/map/terrain_dark.png');
    this.load.image('map_terrain_rubble', '/assets/map/terrain_rubble.png');
    this.load.image('map_wall_h', '/assets/map/wall_straight_h.png');
    this.load.image('map_wall_gate', '/assets/map/wall_gate.png');
    this.load.image('map_road_v', '/assets/map/road_vertical_complete.png');
    this.load.image('map_road_h', '/assets/map/road_horizontal_complete.png');
    this.load.image('map_road_turn_tr', '/assets/map/road_turn_top_right_complete.png');
    this.load.image('map_road_turn_ld', '/assets/map/road_turn_left_down_complete.png');
    this.load.image('map_streetlight', '/assets/map/streetlight.png');
    this.load.image('map_glow', '/assets/map/streetlight_glow.png');
    this.load.image('map_car_red', '/assets/map/car_red.png');
    this.load.image('map_car_blue', '/assets/map/car_blue.png');
    this.load.image('map_boulders', '/assets/map/boulders.png');
    this.load.image('map_barrier', '/assets/map/barrier.png');

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

    // Objective & UI Assets (Reference Video)
    this.load.spritesheet('objective_flag', '/robotwar/UI/objective-flag.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('objective_pulse', '/robotwar/UI/objective-pulse.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('target_cursor', '/robotwar/UI/target-cursor.png', { frameWidth: 8, frameHeight: 8 });
    this.load.spritesheet('range_grid', '/robotwar/UI/range-grid.png', { frameWidth: 16, frameHeight: 16 });
  }

  create() {
    this.createAnimations();
    this.buildTacticalMap();

    // Listen for resize to keep arena edge-to-edge
    this.scale.on('resize', (gameSize) => {
      this.handleResize(gameSize.width, gameSize.height);
    });

    this.isReady = true;
    this.syncUnits(currentRoster);
  }

  handleResize(width, height) {
    const MAP_W = 1024;
    const MAP_H = 682;
    const mapAspect = MAP_W / MAP_H;
    const screenAspect = width / height;

    let bgW, bgH;
    if (screenAspect > mapAspect) {
      bgW = width;
      bgH = width / mapAspect;
    } else {
      bgH = height;
      bgW = height * mapAspect;
    }

    this.mapDisplayW = bgW;
    this.mapDisplayH = bgH;
    this.mapOriginX = (width - bgW) / 2;
    this.mapOriginY = (height - bgH) / 2;

    if (this.mapBg) {
      this.mapBg.setPosition(width / 2, height / 2);
      this.mapBg.setDisplaySize(bgW, bgH);
    }

    const objX = this.mapX(470);
    const objY = this.mapY(405);
    const beaconScale = Math.max(1.2, 1.5 * (bgH / 682));

    if (this.objectivePulse) {
      this.objectivePulse.setPosition(objX, objY);
      this.objectivePulse.setScale(beaconScale);
    }
    if (this.objectiveFlag) {
      this.objectiveFlag.setPosition(objX, this.mapY(360));
      this.objectiveFlag.setScale(beaconScale * 0.9);
    }
    if (this.objectiveText) {
      this.objectiveText.setPosition(objX, this.mapY(305));
      this.objectiveText.setFontSize(`${Math.round(Math.max(12, 14 * (bgW / 1024)))}px`);
    }

    // Reposition all active unit sprites
    const uScale = this.getUnitScale();
    Object.values(this.unitSprites).forEach(u => {
      if (u.refX !== undefined && u.refY !== undefined) {
        const nx = this.mapX(u.refX);
        const ny = this.mapY(u.refY);
        u.sprite.setPosition(nx, ny);
        u.sprite.setScale(uScale);
        u.label.setPosition(nx, ny - (25 * (uScale / 2.3)));
      }
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

    ['Spider', 'Scarab', 'Centipede', 'Wasp'].forEach(key => {
      this.anims.create({
        key: `${key}-idle`,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: 4 }),
        frameRate: 6,
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

    // Hornet
    this.anims.create({
      key: 'Hornet-idle',
      frames: this.anims.generateFrameNumbers('Hornet', { start: 0, end: 7 }),
      frameRate: 10,
      repeat: -1
    });
    this.anims.create({
      key: 'Hornet-fire',
      frames: this.anims.generateFrameNumbers('Hornet', { start: 8, end: 15 }),
      frameRate: 14,
      repeat: 0
    });

    // Combat Effects Animations (From Video)
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

    // Objective Capture Point Animations (Flag & Concentric Pulse)
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

    // Exact 1024:682 native aspect ratio calculation (No stretching, no distortion)
    const MAP_W = 1024;
    const MAP_H = 682;
    const mapAspect = MAP_W / MAP_H;
    const screenAspect = w / h;

    let bgW, bgH;
    if (screenAspect > mapAspect) {
      bgW = w;
      bgH = w / mapAspect;
    } else {
      bgH = h;
      bgW = h * mapAspect;
    }

    this.mapDisplayW = bgW;
    this.mapDisplayH = bgH;
    this.mapOriginX = (w - bgW) / 2;
    this.mapOriginY = (h - bgH) / 2;

    // 1. Kingdom Arena Fullscreen Background
    this.mapBg = this.add.image(w / 2, h / 2, 'map_kingdom');
    this.mapBg.setDisplaySize(bgW, bgH);

    // 2. Central Castle Objective Beacon (Entrance at ref 470, 405)
    const objX = this.mapX(470);
    const objY = this.mapY(405);
    const beaconScale = Math.max(1.2, 1.5 * (bgH / 682));

    this.objectivePulse = this.add.sprite(objX, objY, 'objective_pulse');
    this.objectivePulse.setScale(beaconScale);
    this.objectivePulse.play('anim-pulse');
    this.objectivePulse.setTint(0xffd600); // Yellow neutral pulse

    this.objectiveFlag = this.add.sprite(objX, this.mapY(360), 'objective_flag');
    this.objectiveFlag.setScale(beaconScale * 0.9);
    this.objectiveFlag.play('anim-flag');

    this.objectiveText = this.add.text(objX, this.mapY(305), 'LÂU ĐÀI TRUNG TÂM [TRANH CHẤP]', {
      fontFamily: 'Plus Jakarta Sans',
      fontSize: `${Math.round(Math.max(12, 14 * (bgW / 1024)))}px`,
      fontStyle: 'bold',
      color: '#18181B',
      backgroundColor: '#FEF3C7',
      padding: { x: 10, y: 4 }
    }).setOrigin(0.5);

    // Zoom in close-up on start of battle
    this.applyCombatCamera(false);
  }

  syncUnits(roster) {
    const activePlayerIds = new Set();
    const unitScale = this.getUnitScale();

    // Human Team (Up to 10 players on Kingdom Map)
    const humanPlayers = (roster.human || []).slice(0, 10);
    const humanRefPositions = [
      // Tuyến 1: 5 units along Western Main Road towards Castle
      { x: 100, y: 390 }, { x: 160, y: 390 }, { x: 220, y: 390 }, { x: 280, y: 390 }, { x: 340, y: 400 },
      // Tuyến 2: 5 units along Southwest Bastion Road
      { x: 75, y: 535 }, { x: 135, y: 535 }, { x: 195, y: 535 }, { x: 255, y: 480 }, { x: 315, y: 440 }
    ];

    humanPlayers.forEach((p, idx) => {
      activePlayerIds.add(p.id);
      const ref = humanRefPositions[idx];
      const posX = this.mapX(ref.x);
      const posY = this.mapY(ref.y);
      const labelOffset = 25 * (unitScale / 2.3);

      if (this.unitSprites[p.id]) {
        this.unitSprites[p.id].sprite.setPosition(posX, posY);
        this.unitSprites[p.id].sprite.setScale(unitScale);
        this.unitSprites[p.id].label.setPosition(posX, posY - labelOffset);
        this.unitSprites[p.id].refX = ref.x;
        this.unitSprites[p.id].refY = ref.y;
      } else {
        const sprite = this.add.sprite(posX, posY, p.unitClass);
        sprite.setScale(unitScale);
        sprite.play(`${p.unitClass}-idle`, true);

        const label = this.add.text(posX, posY - labelOffset, p.name, {
          fontFamily: 'Chakra Petch',
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#38bdf8',
          backgroundColor: '#082f49',
          padding: { x: 5, y: 2 }
        }).setOrigin(0.5);

        this.unitSprites[p.id] = { sprite, label, team: 'human', unitClass: p.unitClass, refX: ref.x, refY: ref.y };
      }
    });

    // Robot Team (Up to 10 players on Kingdom Map)
    const robotPlayers = (roster.robot || []).slice(0, 10);
    const robotRefPositions = [
      // Tuyến 1: 5 units along Northeast Road towards Castle
      { x: 880, y: 200 }, { x: 800, y: 210 }, { x: 730, y: 240 }, { x: 660, y: 310 }, { x: 590, y: 360 },
      // Tuyến 2: 5 units along Southeast Road Loop
      { x: 920, y: 430 }, { x: 840, y: 430 }, { x: 760, y: 420 }, { x: 690, y: 440 }, { x: 570, y: 460 }
    ];

    robotPlayers.forEach((p, idx) => {
      activePlayerIds.add(p.id);
      const ref = robotRefPositions[idx];
      const posX = this.mapX(ref.x);
      const posY = this.mapY(ref.y);
      const labelOffset = 25 * (unitScale / 2.3);

      if (this.unitSprites[p.id]) {
        this.unitSprites[p.id].sprite.setPosition(posX, posY);
        this.unitSprites[p.id].sprite.setScale(unitScale);
        this.unitSprites[p.id].label.setPosition(posX, posY - labelOffset);
        this.unitSprites[p.id].refX = ref.x;
        this.unitSprites[p.id].refY = ref.y;
      } else {
        const sprite = this.add.sprite(posX, posY, p.unitClass);
        sprite.setScale(unitScale);
        sprite.setFlipX(true);
        sprite.play(`${p.unitClass}-idle`, true);

        const label = this.add.text(posX, posY - labelOffset, p.name, {
          fontFamily: 'Chakra Petch',
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#fb7185',
          backgroundColor: '#4c0519',
          padding: { x: 5, y: 2 }
        }).setOrigin(0.5);

        this.unitSprites[p.id] = { sprite, label, team: 'robot', unitClass: p.unitClass, refX: ref.x, refY: ref.y };
      }
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
    this.applyCombatCamera(true);
    Object.values(this.unitSprites).forEach(u => {
      u.sprite.play(`${u.unitClass}-idle`, true);
    });
  }

  // Play Full Combat & Objective Capture Sequence
  playCombatSequence(actions, objectiveState, objectiveEvent) {
    const uScale = this.getUnitScale();

    actions.forEach((act, idx) => {
      if (!act.isCorrect) return;

      this.time.delayedCall(idx * 150, () => {
        const attackerUnit = this.unitSprites[act.playerId];
        const isHuman = act.team === 'human';

        let startX = isHuman ? this.mapX(200) : this.mapX(750);
        let startY = isHuman ? this.mapY(430) : this.mapY(330);

        if (attackerUnit) {
          startX = attackerUnit.sprite.x;
          startY = attackerUnit.sprite.y;

          attackerUnit.sprite.play(`${attackerUnit.unitClass}-fire`, true);
          attackerUnit.sprite.once('animationcomplete', () => {
            attackerUnit.sprite.play(`${attackerUnit.unitClass}-idle`, true);
          });
        }

        let targetX, targetY;
        if (isHuman) {
          // Shoot towards Robot eastern line / outpost
          targetX = (startY < this.mapY(420) ? this.mapX(680) : this.mapX(730)) + (Math.random() * 60 - 30);
          targetY = (startY < this.mapY(420) ? this.mapY(280) : this.mapY(420)) + (Math.random() * 40 - 20);
        } else {
          // Shoot towards Human western line / bastion
          targetX = (startY < this.mapY(350) ? this.mapX(240) : this.mapX(180)) + (Math.random() * 60 - 30);
          targetY = (startY < this.mapY(350) ? this.mapY(390) : this.mapY(490)) + (Math.random() * 40 - 20);
        }

        // 1. TACTICAL ARROW / VECTOR TRAJECTORY (From Video)
        const arrowLine = this.add.graphics();
        arrowLine.lineStyle(2, isHuman ? 0x0284c7 : 0xe11d48, 0.7);
        arrowLine.lineBetween(startX, startY, targetX, targetY);
        this.time.delayedCall(300, () => arrowLine.destroy());

        // 2. RED DANGER / THREAT GRID (From Video)
        const threatGrid = this.add.rectangle(targetX, targetY, 36, 36, 0xff0033, 0.35);
        threatGrid.setStrokeStyle(1.5, 0xff0033, 0.8);
        this.time.delayedCall(400, () => threatGrid.destroy());

        // 3. TARGET LOCKING CURSOR BRACKETS [ ] (From Video)
        const targetCursor = this.add.sprite(targetX, targetY, 'target_cursor');
        targetCursor.setScale(uScale);
        targetCursor.setTint(isHuman ? 0x0284c7 : 0xe11d48);
        this.tweens.add({
          targets: targetCursor,
          scale: uScale * 1.3,
          alpha: 0,
          duration: 350,
          onComplete: () => targetCursor.destroy()
        });

        // 4. MUZZLE FLASH & AUDIO
        const muzzleOffset = isHuman ? (10 * uScale) : (-10 * uScale);
        const muzzle = this.add.sprite(startX + muzzleOffset, startY, isHuman ? 'muzzle' : 'laser');
        muzzle.setScale(uScale);
        muzzle.play(isHuman ? 'anim-muzzle' : 'anim-laser', true);
        muzzle.once('animationcomplete', () => muzzle.destroy());

        const isRPG = act.streak >= 3;
        if (window.soundFX) {
          if (isRPG) {
            window.soundFX.playRpgLaunch();
          } else {
            window.soundFX.playShot(!isHuman);
          }
        }

        // 5. PROJECTILE
        const projectileKey = isRPG ? 'rpg' : 'bullets';
        const proj = this.add.sprite(startX, startY, projectileKey);
        proj.setScale(uScale);
        if (!isHuman) proj.setFlipX(true);

        const duration = isRPG ? 450 : 280;

        this.tweens.add({
          targets: proj,
          x: targetX,
          y: targetY,
          duration: duration,
          ease: 'Power1',
          onComplete: () => {
            proj.destroy();

            // Audio on Hit Impact
            if (window.soundFX) {
              window.soundFX.playHit();
              window.soundFX.playExplosion(isRPG);
            }

            // Real-time Battle Feed Notification
            addBattleTicker(
              `${isHuman ? '🛡️' : '🤖'} ${act.playerName || (isHuman ? 'Chiến Binh' : 'Robot')} nã đạn trúng! (-${act.damage} HP)`,
              isHuman ? 'human' : 'robot'
            );

            // 6. MULTI-LAYER IMPACT VFX (Sparks, Spatters, Fragments, Smoke)
            const sparks = this.add.sprite(targetX, targetY, 'sparks');
            sparks.setScale(uScale * 0.9).play('anim-sparks').once('animationcomplete', () => sparks.destroy());

            const spatters = this.add.sprite(targetX + 4, targetY, 'spatters');
            spatters.setScale(uScale * 0.9).play('anim-spatters').once('animationcomplete', () => spatters.destroy());

            const frags = this.add.sprite(targetX, targetY, 'fragments');
            frags.setScale(uScale * 0.6).play('anim-fragments').once('animationcomplete', () => frags.destroy());

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
      });
    });

    // 7. HANDLE OBJECTIVE CAPTURE EVENT (CHIẾM CỨ ĐIỂM LÂU ĐÀI)
    if (objectiveEvent && objectiveEvent.type === 'captured') {
      this.time.delayedCall(actions.length * 150 + 500, () => {
        const isHumanWinner = objectiveEvent.winner === 'human';
        const beaconX = this.mapX(470);
        const beaconY = this.mapY(360);

        // Sound on Castle Capture
        if (window.soundFX) {
          window.soundFX.playCapture();
          window.soundFX.playExplosion(true);
        }

        addBattleTicker(`🏰 ${objectiveEvent.title}! Pháo quỹ đạo khai hỏa!`, 'castle');

        // Update Flag & Pulse Color
        this.objectivePulse.setTint(isHumanWinner ? 0x0284c7 : 0xe11d48);
        this.objectiveFlag.setTint(isHumanWinner ? 0x0284c7 : 0xe11d48);

        this.objectiveText.setText(isHumanWinner ? 'LÂU ĐÀI: PHE NGƯỜI KIỂM SOÁT' : 'LÂU ĐÀI: ROBOT KIỂM SOÁT');
        this.objectiveText.setColor(isHumanWinner ? '#38bdf8' : '#fb7185');

        // Big Celebratory Explosion at Castle
        const beaconExp = this.add.sprite(beaconX, beaconY, 'big_exp');
        beaconExp.setScale(uScale * 1.8).play('anim-big-exp').once('animationcomplete', () => beaconExp.destroy());
        this.cameras.main.shake(200, 0.012);

        // Orbital Artillery Strike from Castle to Enemy Base!
        const enemyBaseX = isHumanWinner ? this.mapX(900) : this.mapX(95);
        const enemyBaseY = isHumanWinner ? this.mapY(175) : this.mapY(590);

        const beam = this.add.graphics();
        beam.lineStyle(6, isHumanWinner ? 0x0284c7 : 0xe11d48, 0.95);
        beam.lineBetween(beaconX, beaconY, enemyBaseX, enemyBaseY);
        this.time.delayedCall(500, () => beam.destroy());

        const baseImpact = this.add.sprite(enemyBaseX, enemyBaseY, 'big_exp');
        baseImpact.setScale(uScale * 2.0).play('anim-big-exp').once('animationcomplete', () => baseImpact.destroy());

        // Banner Announcement Overlay
        const bannerText = this.add.text(this.scale.width / 2, 50, objectiveEvent.title, {
          fontFamily: 'Chakra Petch',
          fontSize: '18px',
          fontStyle: 'bold',
          color: isHumanWinner ? '#38bdf8' : '#fb7185',
          backgroundColor: '#0c1222',
          padding: { x: 16, y: 8 }
        }).setOrigin(0.5);

        this.tweens.add({
          targets: bannerText,
          scale: 1.15,
          yoyo: true,
          duration: 400,
          repeat: 2,
          onComplete: () => {
            this.tweens.add({ targets: bannerText, alpha: 0, duration: 500, onComplete: () => bannerText.destroy() });
          }
        });
      });
    }
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
