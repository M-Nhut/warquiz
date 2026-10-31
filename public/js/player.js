const socket = io();

// State
let myPlayer = null;
let currentRoomId = null;
let isAnswerLocked = false;
let currentQuestionIndex = -1;
let totalQuestions = 0;
let timeLimit = 15;

// DOM Elements
const stageJoin = document.getElementById('stage-join');
const stageTeamReveal = document.getElementById('stage-team-reveal');
const stageQuestion = document.getElementById('stage-question');
const stageRoundResult = document.getElementById('stage-round-result');
const stageGameOver = document.getElementById('stage-game-over');

const playerHeader = document.getElementById('player-header');
const headerAvatar = document.getElementById('header-avatar');
const headerPlayerName = document.getElementById('header-player-name');
const headerTeamBadge = document.getElementById('header-team-badge');
const headerStreak = document.getElementById('header-streak');
const streakVal = document.getElementById('streak-val');
const headerScore = document.getElementById('header-score');

const inputPin = document.getElementById('input-pin');
const inputName = document.getElementById('input-name');
const btnJoin = document.getElementById('btn-join');
const joinError = document.getElementById('join-error');

// Team Selection on Join Form
const btnSelectHuman = document.getElementById('btn-select-human');
const btnSelectRobot = document.getElementById('btn-select-robot');
const btnSelectRandom = document.getElementById('btn-select-random');
let chosenTeam = 'human'; // Default chosen team
let questionStartTime = 0;
let lastAnswerTime = 0;

// Sound Toggle Sync
const btnSoundPlayer = document.getElementById('btn-sound-player');
const soundIconPlayer = document.getElementById('sound-icon-player');

function updatePlayerSoundIcon() {
  const isM = window.soundFX ? window.soundFX.isMuted() : false;
  if (soundIconPlayer) soundIconPlayer.textContent = isM ? '🔇' : '🔊';
}

if (btnSoundPlayer) {
  btnSoundPlayer.onclick = () => {
    if (window.soundFX) window.soundFX.toggleMute();
    updatePlayerSoundIcon();
  };
}
updatePlayerSoundIcon();

function updateTeamSelectionUI(team) {
  if (window.soundFX) window.soundFX.playClick();
  chosenTeam = team;
  if (btnSelectHuman) btnSelectHuman.classList.remove('selected-human');
  if (btnSelectRobot) btnSelectRobot.classList.remove('selected-robot');
  if (btnSelectRandom) btnSelectRandom.classList.remove('selected-random');

  if (team === 'human' && btnSelectHuman) btnSelectHuman.classList.add('selected-human');
  else if (team === 'robot' && btnSelectRobot) btnSelectRobot.classList.add('selected-robot');
  else if (team === 'random' && btnSelectRandom) btnSelectRandom.classList.add('selected-random');
}

if (btnSelectHuman) btnSelectHuman.onclick = () => updateTeamSelectionUI('human');
if (btnSelectRobot) btnSelectRobot.onclick = () => updateTeamSelectionUI('robot');
if (btnSelectRandom) btnSelectRandom.onclick = () => updateTeamSelectionUI('random');

const revealCard = document.getElementById('reveal-card');
const revealBadgeTitle = document.getElementById('reveal-badge-title');
const revealTeamName = document.getElementById('reveal-team-name');
const revealUnitClass = document.getElementById('reveal-unit-class');
const revealSpriteCanvas = document.getElementById('reveal-sprite-canvas');
const btnSwitchTeam = document.getElementById('btn-switch-team');
const btnSwitchTeamText = document.getElementById('btn-switch-team-text');
const switchTeamError = document.getElementById('switch-team-error');
const feedbackSpeedBadge = document.getElementById('feedback-speed-badge');

const qCounter = document.getElementById('q-counter');
const qTimer = document.getElementById('q-timer');
const qTimerBar = document.getElementById('q-timer-bar');
const qText = document.getElementById('q-text');
const optTexts = [
  document.getElementById('opt-text-0'),
  document.getElementById('opt-text-1'),
  document.getElementById('opt-text-2'),
  document.getElementById('opt-text-3')
];
const answersGrid = document.getElementById('answers-grid');
const ansStatus = document.getElementById('ans-status');

const roundFeedbackCard = document.getElementById('round-feedback-card');
const feedbackIcon = document.getElementById('feedback-icon');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackSub = document.getElementById('feedback-sub');
const feedbackCorrectText = document.getElementById('feedback-correct-text');

const gameOverTeamResult = document.getElementById('game-over-team-result');
const gameOverReason = document.getElementById('game-over-reason');
const endPlayerScore = document.getElementById('end-player-score');
const endPlayerAccuracy = document.getElementById('end-player-accuracy');

// Pre-fill PIN from URL params if available
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
if (roomParam) {
  inputPin.value = roomParam;
}

// Switch Stage Helper
function switchStage(stageEl) {
  [stageJoin, stageTeamReveal, stageQuestion, stageRoundResult, stageGameOver].forEach(s => {
    s.classList.add('hidden');
  });
  stageEl.classList.remove('hidden');
}

// Join Room Handler
btnJoin.onclick = () => {
  if (window.soundFX) window.soundFX.playClick();
  const pin = inputPin.value.trim();
  const name = inputName.value.trim();

  if (!pin) {
    showError('Vui lòng nhập mã PIN phòng!');
    return;
  }
  if (!name) {
    showError('Vui lòng nhập biệt danh của bạn!');
    return;
  }

  showError('');
  btnJoin.disabled = true;
  btnJoin.textContent = 'ĐANG GIA NHẬP...';

  socket.emit('player_join', { roomId: pin, playerName: name, preferredTeam: chosenTeam }, (res) => {
    btnJoin.disabled = false;
    btnJoin.textContent = 'XUNG TRẬN NGAY';

    if (!res || !res.success) {
      showError(res ? res.error : 'Không thể kết nối vào phòng!');
      return;
    }

    myPlayer = res.player;
    currentRoomId = pin;
    totalQuestions = res.totalQuestions || 10;

    setupHeader();
    showTeamReveal(res.player, res.teamInfo);
  });
};

function showError(msg) {
  if (!msg) {
    joinError.classList.add('hidden');
    joinError.textContent = '';
  } else {
    joinError.classList.remove('hidden');
    joinError.textContent = msg;
  }
}

// Header Setup
function setupHeader() {
  playerHeader.classList.remove('hidden');
  headerPlayerName.textContent = myPlayer.name;
  headerScore.textContent = myPlayer.score || 0;

  if (myPlayer.team === 'human') {
    headerTeamBadge.textContent = 'PHE NGƯỜI';
    headerTeamBadge.className = 'text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded inline-block badge-human';
  } else {
    headerTeamBadge.textContent = 'PHE ROBOT';
    headerTeamBadge.className = 'text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded inline-block badge-robot';
  }

  updateHeaderAvatar();
}

function updateHeaderAvatar() {
  const isHuman = myPlayer.team === 'human';
  const img = new Image();
  img.src = isHuman
    ? `/robotwar/Soldiers/${myPlayer.unitClass}.png`
    : `/robotwar/Robots/${myPlayer.unitClass}.png`;

  img.onload = () => {
    headerAvatar.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    canvas.className = 'sprite-icon';
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, 16, 16, 0, 0, 24, 24);
    headerAvatar.appendChild(canvas);
  };
}

// Team Reveal Stage
function showTeamReveal(player, teamInfo) {
  switchStage(stageTeamReveal);

  if (revealBadgeTitle) {
    revealBadgeTitle.textContent = 'BẠN ĐÃ CHỌN THÀNH CÔNG';
  }

  const isHuman = player.team === 'human';
  if (isHuman) {
    revealCard.classList.add('border-cyan-500', 'glow-human');
    revealCard.classList.remove('border-rose-500', 'glow-robot');
    revealTeamName.textContent = 'PHE NGƯỜI (HUMAN VANGUARD)';
    revealTeamName.className = 'text-2xl font-black uppercase mb-1 text-human';
    revealUnitClass.textContent = `Vị trí: ${player.unitClass}`;
  } else {
    revealCard.classList.add('border-rose-500', 'glow-robot');
    revealCard.classList.remove('border-cyan-500', 'glow-human');
    revealTeamName.textContent = 'PHE ROBOT (ROBOT LEGION)';
    revealTeamName.className = 'text-2xl font-black uppercase mb-1 text-robot';
    revealUnitClass.textContent = `Chủng loại: ${player.unitClass}`;
  }

  // Update Switch Team Button in Lobby
  if (btnSwitchTeam && btnSwitchTeamText) {
    if (isHuman) {
      btnSwitchTeamText.textContent = 'Đổi sang Phe Robot 🤖';
      btnSwitchTeam.className = 'py-2 px-4 rounded-lg bg-slate-900 border border-rose-500/80 hover:bg-rose-950/40 text-xs font-bold text-rose-300 hover:text-white transition flex items-center justify-center gap-2 mx-auto shadow-md';
    } else {
      btnSwitchTeamText.textContent = 'Đổi sang Phe Người 🛡️';
      btnSwitchTeam.className = 'py-2 px-4 rounded-lg bg-slate-900 border border-cyan-500/80 hover:bg-cyan-950/40 text-xs font-bold text-cyan-300 hover:text-white transition flex items-center justify-center gap-2 mx-auto shadow-md';
    }

    btnSwitchTeam.onclick = () => {
      if (window.soundFX) window.soundFX.playClick();
      const targetTeam = myPlayer.team === 'human' ? 'robot' : 'human';
      btnSwitchTeam.disabled = true;
      if (switchTeamError) switchTeamError.classList.add('hidden');

      socket.emit('player_change_team', { newTeam: targetTeam }, (res) => {
        btnSwitchTeam.disabled = false;
        if (!res || !res.success) {
          if (switchTeamError) {
            switchTeamError.textContent = res ? res.error : 'Không thể đổi phe!';
            switchTeamError.classList.remove('hidden');
          }
          return;
        }

        myPlayer = res.player;
        setupHeader();
        showTeamReveal(res.player, res.teamInfo);
      });
    };
  }

  // Draw 64x64 scaled pixel sprite on reveal canvas
  const img = new Image();
  img.src = isHuman
    ? `/robotwar/Soldiers/${player.unitClass}.png`
    : `/robotwar/Robots/${player.unitClass}.png`;

  img.onload = () => {
    const ctx = revealSpriteCanvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, 16, 16, 0, 0, 64, 64);
  };
}

// Socket: Game Started
socket.on('game_started', (data) => {
  totalQuestions = data.totalQuestions || 10;
  timeLimit = data.timePerQuestion || 15;
});

// Socket: New Question
socket.on('new_question', (data) => {
  currentQuestionIndex = data.questionIndex;
  timeLimit = data.timeLimit || 15;
  isAnswerLocked = false;
  questionStartTime = Date.now();
  lastAnswerTime = 0;

  switchStage(stageQuestion);

  qCounter.textContent = `Câu hỏi ${data.questionIndex + 1} / ${data.totalQuestions}`;
  qTimer.textContent = `${data.remainingSec}s`;
  qText.textContent = data.question;

  // Reset answer options styling
  for (let i = 0; i < 4; i++) {
    optTexts[i].textContent = data.options[i] || `Đáp án ${i + 1}`;
  }

  const buttons = answersGrid.querySelectorAll('.quiz-option');
  buttons.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('opt-selected', 'opt-correct', 'opt-wrong');
  });

  ansStatus.classList.add('hidden');
  qTimerBar.style.width = '100%';
  qTimer.classList.remove('timer-warning');
});

// Socket: Timer Tick
socket.on('timer_tick', (data) => {
  qTimer.textContent = `${data.remainingSec}s`;
  const pct = Math.max(0, (data.remainingSec / timeLimit) * 100);
  qTimerBar.style.width = `${pct}%`;

  if (data.remainingSec <= 5) {
    qTimer.classList.add('timer-warning');
    qTimerBar.classList.add('bg-rose-500');
    qTimerBar.classList.remove('bg-cyan-400');
    if (window.soundFX) window.soundFX.playUrgentTick();
  } else {
    qTimer.classList.remove('timer-warning');
    qTimerBar.classList.remove('bg-rose-500');
    qTimerBar.classList.add('bg-cyan-400');
  }
});

// Submit Answer
window.submitAnswer = (idx) => {
  if (isAnswerLocked) return;
  isAnswerLocked = true;
  lastAnswerTime = Date.now();

  if (window.soundFX) window.soundFX.playClick();

  // Trigger Haptic Vibration on Mobile
  if (navigator.vibrate) {
    navigator.vibrate(40);
  }

  // Highlight selected button
  const buttons = answersGrid.querySelectorAll('.quiz-option');
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === idx) {
      btn.classList.add('opt-selected');
    } else {
      btn.classList.add('opt-wrong');
    }
  });

  ansStatus.classList.remove('hidden');

  socket.emit('player_submit_answer', {
    roomId: currentRoomId,
    answerIndex: idx
  }, (res) => {
    if (res && res.success) {
      myPlayer.score = res.score;
      myPlayer.streak = res.streak;
      headerScore.textContent = res.score;

      if (res.streak >= 2) {
        headerStreak.classList.remove('hidden');
        streakVal.textContent = res.streak;
      } else {
        headerStreak.classList.add('hidden');
      }
    }
  });
};

// Socket: Round Result
socket.on('round_result', (data) => {
  switchStage(stageRoundResult);

  const myAction = data.actions.find(a => a.playerId === socket.id);
  const isCorrect = myAction ? myAction.isCorrect : false;

  feedbackCorrectText.textContent = `${['A', 'B', 'C', 'D'][data.correctIndex]}: ${data.correctText}`;

  // Update Objective Capture Status on Mobile
  const playerObjStatus = document.getElementById('player-obj-status');
  if (playerObjStatus && data.objective) {
    if (data.objective.owner === 'human') {
      playerObjStatus.textContent = '🏰 LÂU ĐÀI: NGƯỜI GIỮ';
      playerObjStatus.className = 'text-cyan-400 font-bold';
    } else if (data.objective.owner === 'robot') {
      playerObjStatus.textContent = '🏰 LÂU ĐÀI: ROBOT GIỮ';
      playerObjStatus.className = 'text-rose-500 font-bold';
    } else {
      playerObjStatus.textContent = '🏰 LÂU ĐÀI TRANH CHẤP';
      playerObjStatus.className = 'text-amber-400 font-semibold';
    }
  }

  // Objective Capture Event Alert
  if (data.objectiveEvent) {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    if (window.soundFX) window.soundFX.playCapture();
    if (data.objectiveEvent.winner === myPlayer.team) {
      feedbackSub.textContent += ` 🎯 ${data.objectiveEvent.title}`;
    }
  }

  // Calculate elapsed response time
  const elapsedSec = (questionStartTime > 0 && lastAnswerTime > 0) ? ((lastAnswerTime - questionStartTime) / 1000) : 0;

  if (isCorrect) {
    // Vibrate celebratory pattern
    if (navigator.vibrate) navigator.vibrate([60, 50, 100]);
    if (window.soundFX) window.soundFX.playCorrect();

    // Speed bonus badge
    if (feedbackSpeedBadge) {
      feedbackSpeedBadge.classList.remove('hidden');
      if (elapsedSec > 0 && elapsedSec <= 3.5) {
        feedbackSpeedBadge.textContent = `⚡ TIA CHỚP! (${elapsedSec.toFixed(1)}s) +50 AP`;
        feedbackSpeedBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 bg-amber-950/80 text-amber-300 border border-amber-500 shadow-md animate-bounce';
      } else if (elapsedSec > 0 && elapsedSec <= 7.0) {
        feedbackSpeedBadge.textContent = `🎯 XẠ THỦ CỪ KHÔI! (${elapsedSec.toFixed(1)}s)`;
        feedbackSpeedBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 bg-cyan-950/80 text-cyan-300 border border-cyan-500 shadow-md';
      } else {
        feedbackSpeedBadge.textContent = `🛡️ PHÒNG THỦ VỮNG CHẮC!`;
        feedbackSpeedBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 bg-slate-900 text-slate-300 border border-slate-700';
      }
    }

    feedbackIcon.textContent = '💥';
    feedbackTitle.textContent = 'CHÍNH XÁC!';
    feedbackTitle.className = 'text-2xl font-black uppercase mb-1 text-emerald-400';
    feedbackSub.textContent = `+${myAction.damage} Điểm Sát Thương Gây Ra!`;
    roundFeedbackCard.className = 'cyber-panel p-6 border-2 border-emerald-500 glow-human';

    if (myAction.streak >= 2) {
      feedbackSub.textContent += ` (Chuỗi đúng x${myAction.streak} 🔥)`;
    }
  } else {
    // Vibrate error shake
    if (navigator.vibrate) navigator.vibrate(150);
    if (window.soundFX) window.soundFX.playWrong();

    if (feedbackSpeedBadge) {
      feedbackSpeedBadge.classList.add('hidden');
    }

    feedbackIcon.textContent = '⚠️';
    feedbackTitle.textContent = 'CHƯA CHÍNH XÁC!';
    feedbackTitle.className = 'text-2xl font-black uppercase mb-1 text-rose-500';
    feedbackSub.textContent = 'Bắn trượt! Hãy giữ vững vị trí!';
    roundFeedbackCard.className = 'cyber-panel p-6 border-2 border-rose-500 glow-robot';
  }
});

// Socket: Game Over
socket.on('game_over', (data) => {
  switchStage(stageGameOver);

  const isHumanWinner = data.winnerTeam === 'human';
  const isMyTeamWinner = data.winnerTeam === myPlayer.team;

  if (window.soundFX) window.soundFX.playVictory();
  if (isMyTeamWinner && window.launchConfetti) {
    window.launchConfetti(4500);
  }

  if (data.winnerTeam === 'draw') {
    gameOverTeamResult.textContent = 'HÒA TRẬN!';
    gameOverTeamResult.className = 'text-2xl font-black uppercase text-amber-400 mb-1';
  } else if (isMyTeamWinner) {
    gameOverTeamResult.textContent = '🎉 PHE CỦA BẠN ĐÃ TOÀN THẮNG!';
    gameOverTeamResult.className = 'text-2xl font-black uppercase text-emerald-400 mb-1';
  } else {
    gameOverTeamResult.textContent = '💀 PHE CỦA BẠN ĐÃ THẤT THỦ!';
    gameOverTeamResult.className = 'text-2xl font-black uppercase text-rose-500 mb-1';
  }

  gameOverReason.textContent = data.reason || 'Trận chiến đã kết thúc.';
  endPlayerScore.textContent = myPlayer.score || 0;
  endPlayerAccuracy.textContent = `${myPlayer.correctCount || 0} / ${myPlayer.totalAnswered || 0}`;
});

// Socket: Restart
socket.on('game_restarted', () => {
  if (myPlayer) {
    myPlayer.score = 0;
    myPlayer.streak = 0;
    myPlayer.correctCount = 0;
    myPlayer.totalAnswered = 0;
    headerScore.textContent = '0';
    headerStreak.classList.add('hidden');
    showTeamReveal(myPlayer, null);
  }
});
