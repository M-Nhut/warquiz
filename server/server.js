const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const cors = require('cors');

const quizManager = require('./quizManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

let PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static directories
app.use('/robotwar', express.static(path.join(__dirname, '../robotwar')));
app.use(express.static(path.join(__dirname, '../public')));

// HTML Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/host.html'));
});
app.get('/join', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/player.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// Helper: Get Primary Local IPv4 Address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// REST APIs for Quizzes
app.get('/api/quizzes', (req, res) => {
  res.json(quizManager.getAllQuizzes());
});

app.get('/api/quizzes/:id', (req, res) => {
  const quiz = quizManager.getQuizById(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  res.json(quiz);
});

app.post('/api/quizzes', (req, res) => {
  const created = quizManager.createQuiz(req.body);
  res.json(created);
});

app.put('/api/quizzes/:id', (req, res) => {
  const updated = quizManager.updateQuiz(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Quiz not found' });
  res.json(updated);
});

app.delete('/api/quizzes/:id', (req, res) => {
  const deleted = quizManager.deleteQuiz(req.params.id);
  res.json({ success: deleted });
});

app.post('/api/quizzes/import', (req, res) => {
  const success = quizManager.importQuizzes(req.body);
  res.json({ success });
});

app.get('/api/server-info', (req, res) => {
  const ip = getLocalIpAddress();
  res.json({
    ip,
    port: PORT,
    joinUrl: `http://${ip}:${PORT}/join`
  });
});

// --- IN-MEMORY ROOM MANAGEMENT ---
const rooms = {};

const HUMAN_CLASSES = [
  'Assault-Class',
  'Sniper-Class',
  'MachineGunner-Class',
  'Grenadier-Class',
  'AntiTank-Class',
  'RadioOperator-Class',
  'SquadLeader'
];

const ROBOT_CLASSES = [
  'Spider',
  'Scarab',
  'Hornet',
  'Wasp',
  'Centipede'
];

function generateRoomId() {
  let id;
  do {
    id = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms[id]);
  return id;
}

// Socket.IO Handling
io.on('connection', (socket) => {
  console.log(`[Socket Connected] ${socket.id}`);

  // HOST: Create Room
  socket.on('host_create_room', async (data, callback) => {
    try {
      const roomId = generateRoomId();
      const quizId = data.quizId || 'quiz-robotwar';
      const quiz = quizManager.getQuizById(quizId) || quizManager.getAllQuizzes()[0];
      const fullQuiz = quizManager.getQuizById(quiz.id);

      const timePerQuestion = Number(data.timePerQuestion) || fullQuiz.timePerQuestion || 15;
      const baseHp = Number(data.baseHp) || 1000;
      const winCondition = data.winCondition || 'both'; // 'both' | 'base_hp' | 'questions_end'

      const localIp = getLocalIpAddress();
      let baseUrl = data.baseUrl;
      if (!baseUrl) {
        const forwardedProto = socket.handshake.headers['x-forwarded-proto'] || 'http';
        const hostHeader = socket.handshake.headers.host;
        if (hostHeader && !hostHeader.includes('localhost') && !hostHeader.includes('127.0.0.1')) {
          baseUrl = `${forwardedProto}://${hostHeader}`;
        } else {
          baseUrl = `http://${localIp}:${PORT}`;
        }
      }
      const joinUrl = `${baseUrl}/join?room=${roomId}`;
      const qrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
        width: 320,
        margin: 2,
        color: { dark: '#18181B', light: '#FFFFFF' }
      });

      rooms[roomId] = {
        id: roomId,
        hostSocketId: socket.id,
        quiz: fullQuiz,
        timePerQuestion,
        baseHp,
        winCondition,
        status: 'lobby', // lobby | question | round_result | game_over
        currentQuestionIndex: -1,
        questionTimer: null,
        roundEndTime: 0,
        teams: {
          human: {
            id: 'human',
            name: 'Phe Người (Human Vanguard)',
            color: '#00d2ff',
            hp: baseHp,
            maxHp: baseHp,
            score: 0,
            players: []
          },
          robot: {
            id: 'robot',
            name: 'Phe Robot (Robot Legion)',
            color: '#ff2d55',
            hp: baseHp,
            maxHp: baseHp,
            score: 0,
            players: []
          }
        },
        objective: {
          name: 'Cứ Điểm Trung Tâm',
          owner: 'neutral',
          progress: 0 // -100 (Human) to +100 (Robot)
        },
        players: {},
        roundAnswers: {}
      };

      socket.join(roomId);

      if (callback) {
        callback({
          success: true,
          roomId,
          joinUrl,
          qrCodeDataUrl,
          quizTitle: fullQuiz.title,
          totalQuestions: fullQuiz.questions.length,
          timePerQuestion,
          baseHp
        });
      }
    } catch (err) {
      console.error('Error creating room:', err);
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // PLAYER: Join Room (Allows Player to Choose Team, Max 10 per Team, Max 20 Total)
  socket.on('player_join', ({ roomId, playerName, preferredTeam }, callback) => {
    const room = rooms[roomId];
    if (!room) {
      return callback && callback({ success: false, error: 'Phòng không tồn tại!' });
    }

    if (room.status === 'game_over') {
      return callback && callback({ success: false, error: 'Trận đấu đã kết thúc!' });
    }

    const currentTotal = Object.keys(room.players).length;
    if (currentTotal >= 20) {
      return callback && callback({
        success: false,
        error: 'Phòng đã đủ giới hạn 20/20 người chơi! Vui lòng chờ lượt sau.'
      });
    }

    const humanCount = room.teams.human.players.length;
    const robotCount = room.teams.robot.players.length;
    let assignedTeam;

    if (preferredTeam === 'human') {
      if (humanCount >= 10) {
        return callback && callback({
          success: false,
          error: 'Phe Người đã đủ 10/10 chiến binh! Vui lòng chọn Phe Robot.'
        });
      }
      assignedTeam = 'human';
    } else if (preferredTeam === 'robot') {
      if (robotCount >= 10) {
        return callback && callback({
          success: false,
          error: 'Phe Robot đã đủ 10/10 chiến binh! Vui lòng chọn Phe Người.'
        });
      }
      assignedTeam = 'robot';
    } else {
      // Auto-balance if 'random' or unspecified
      if (humanCount >= 10) {
        assignedTeam = 'robot';
      } else if (robotCount >= 10) {
        assignedTeam = 'human';
      } else if (humanCount < robotCount) {
        assignedTeam = 'human';
      } else if (robotCount < humanCount) {
        assignedTeam = 'robot';
      } else {
        assignedTeam = Math.random() < 0.5 ? 'human' : 'robot';
      }
    }

    // Assign unit class
    let unitClass;
    if (assignedTeam === 'human') {
      unitClass = HUMAN_CLASSES[Math.floor(Math.random() * HUMAN_CLASSES.length)];
    } else {
      unitClass = ROBOT_CLASSES[Math.floor(Math.random() * ROBOT_CLASSES.length)];
    }

    const cleanName = (playerName || 'Chiến Binh').trim().substring(0, 15);
    const player = {
      id: socket.id,
      name: cleanName,
      team: assignedTeam,
      unitClass,
      score: 0,
      streak: 0,
      correctCount: 0,
      totalAnswered: 0,
      lastAnswer: null
    };

    room.players[socket.id] = player;
    room.teams[assignedTeam].players.push(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;

    console.log(`[Player Joined] ${cleanName} -> Team: ${assignedTeam} (${unitClass})`);

    // Callback to Player
    if (callback) {
      callback({
        success: true,
        player,
        teamInfo: room.teams[assignedTeam],
        roomStatus: room.status,
        currentQuestionIndex: room.currentQuestionIndex,
        totalQuestions: room.quiz.questions.length
      });
    }

    // Broadcast updated team rosters to Host and all players
    io.to(roomId).emit('roster_updated', {
      total: Object.keys(room.players).length,
      maxPlayers: 20,
      maxTeamPlayers: 10,
      teams: {
        human: {
          name: room.teams.human.name,
          hp: room.teams.human.hp,
          maxHp: room.teams.human.maxHp,
          count: room.teams.human.players.length,
          players: room.teams.human.players.map(id => room.players[id])
        },
        robot: {
          name: room.teams.robot.name,
          hp: room.teams.robot.hp,
          maxHp: room.teams.robot.maxHp,
          count: room.teams.robot.players.length,
          players: room.teams.robot.players.map(id => room.players[id])
        }
      }
    });

    // If player joined during an active question, send question state
    if (room.status === 'question' && room.currentQuestionIndex >= 0) {
      const q = room.quiz.questions[room.currentQuestionIndex];
      const remainingSec = Math.max(0, Math.ceil((room.roundEndTime - Date.now()) / 1000));
      socket.emit('new_question', {
        questionIndex: room.currentQuestionIndex,
        totalQuestions: room.quiz.questions.length,
        question: q.question,
        options: q.options,
        timeLimit: room.timePerQuestion,
        remainingSec
      });
    }
  });

  // PLAYER: Change Team (In Lobby before match begins)
  socket.on('player_change_team', ({ newTeam }, callback) => {
    const roomId = socket.roomId;
    const room = rooms[roomId];
    if (!room) {
      return callback && callback({ success: false, error: 'Phòng không tồn tại!' });
    }
    if (room.status !== 'lobby') {
      return callback && callback({ success: false, error: 'Chỉ có thể đổi phe trong lúc chờ trận đấu!' });
    }
    const player = room.players[socket.id];
    if (!player) {
      return callback && callback({ success: false, error: 'Không tìm thấy người chơi!' });
    }
    if (newTeam !== 'human' && newTeam !== 'robot') {
      return callback && callback({ success: false, error: 'Phe không hợp lệ!' });
    }
    if (player.team === newTeam) {
      return callback && callback({ success: true, player, teamInfo: room.teams[player.team] });
    }

    const targetTeamList = room.teams[newTeam].players;
    if (targetTeamList.length >= 10) {
      const teamLabel = newTeam === 'human' ? 'Phe Người' : 'Phe Robot';
      return callback && callback({ success: false, error: `${teamLabel} đã đủ 10/10 người chơi!` });
    }

    // Remove from old team
    const oldTeamList = room.teams[player.team].players;
    const idx = oldTeamList.indexOf(socket.id);
    if (idx !== -1) oldTeamList.splice(idx, 1);

    // Add to new team
    player.team = newTeam;
    targetTeamList.push(socket.id);

    // Reassign unit class according to new team
    if (newTeam === 'human') {
      player.unitClass = HUMAN_CLASSES[Math.floor(Math.random() * HUMAN_CLASSES.length)];
    } else {
      player.unitClass = ROBOT_CLASSES[Math.floor(Math.random() * ROBOT_CLASSES.length)];
    }

    console.log(`[Player Switched Team] ${player.name} -> Team: ${newTeam} (${player.unitClass})`);

    // Broadcast updated rosters
    io.to(roomId).emit('roster_updated', {
      total: Object.keys(room.players).length,
      maxPlayers: 20,
      maxTeamPlayers: 10,
      teams: {
        human: {
          name: room.teams.human.name,
          hp: room.teams.human.hp,
          maxHp: room.teams.human.maxHp,
          count: room.teams.human.players.length,
          players: room.teams.human.players.map(id => room.players[id])
        },
        robot: {
          name: room.teams.robot.name,
          hp: room.teams.robot.hp,
          maxHp: room.teams.robot.maxHp,
          count: room.teams.robot.players.length,
          players: room.teams.robot.players.map(id => room.players[id])
        }
      }
    });

    if (callback) {
      callback({
        success: true,
        player,
        teamInfo: room.teams[newTeam]
      });
    }
  });

  // HOST: Start Game
  socket.on('host_start_game', (data = {}, callback) => {
    let roomId = data.roomId;
    if (!roomId) {
      const foundRoom = Object.values(rooms).find(r => r.hostSocketId === socket.id);
      if (foundRoom) roomId = foundRoom.id;
    }
    const room = rooms[roomId];
    if (!room) return;
    if (room.status !== 'lobby') return;

    room.status = 'question';
    room.currentQuestionIndex = 0;

    io.to(roomId).emit('game_started', {
      totalQuestions: room.quiz.questions.length,
      timePerQuestion: room.timePerQuestion
    });

    sendQuestion(roomId, 0);
    if (callback) callback({ success: true });
  });

  // Send a Question to Room
  function sendQuestion(roomId, qIndex) {
    const room = rooms[roomId];
    if (!room) return;

    if (qIndex >= room.quiz.questions.length) {
      return triggerGameOver(roomId, 'Hết bộ câu hỏi!');
    }

    room.status = 'question';
    room.currentQuestionIndex = qIndex;
    room.roundAnswers = {};
    const question = room.quiz.questions[qIndex];
    room.roundStartTime = Date.now();
    room.roundEndTime = Date.now() + (room.timePerQuestion * 1000);

    // Broadcast question to everyone in room
    io.to(roomId).emit('new_question', {
      questionIndex: qIndex,
      totalQuestions: room.quiz.questions.length,
      question: question.question,
      options: question.options,
      timeLimit: room.timePerQuestion,
      remainingSec: room.timePerQuestion
    });

    // Set server countdown
    if (room.questionTimer) clearInterval(room.questionTimer);
    let secondsLeft = room.timePerQuestion;

    room.questionTimer = setInterval(() => {
      secondsLeft--;
      io.to(roomId).emit('timer_tick', { remainingSec: secondsLeft });

      if (secondsLeft <= 0) {
        clearInterval(room.questionTimer);
        room.questionTimer = null;
        resolveRound(roomId);
      }
    }, 1000);
  }

  // PLAYER: Submit Answer
  socket.on('player_submit_answer', ({ roomId, answerIndex }, callback) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'question') {
      return callback && callback({ success: false, error: 'Không trong thời gian trả lời!' });
    }

    const player = room.players[socket.id];
    if (!player) return callback && callback({ success: false, error: 'Người chơi không hợp lệ' });

    if (room.roundAnswers[socket.id] !== undefined) {
      return callback && callback({ success: false, error: 'Bạn đã trả lời rồi!' });
    }

    const responseTimeMs = Date.now() - room.roundStartTime;
    const currentQ = room.quiz.questions[room.currentQuestionIndex];
    const isCorrect = (Number(answerIndex) === currentQ.correctIndex);

    player.totalAnswered++;
    if (isCorrect) {
      player.streak++;
      player.correctCount++;
      // Score calculation: speed bonus
      const speedFactor = Math.max(0.2, (room.timePerQuestion * 1000 - responseTimeMs) / (room.timePerQuestion * 1000));
      const points = Math.round(100 + (speedFactor * 100) + (player.streak * 20));
      player.score += points;
      room.teams[player.team].score += points;
    } else {
      player.streak = 0;
    }

    room.roundAnswers[socket.id] = {
      playerId: socket.id,
      answerIndex,
      isCorrect,
      responseTimeMs
    };

    if (callback) {
      callback({
        success: true,
        isCorrect,
        streak: player.streak,
        score: player.score
      });
    }

    // Pulse notification to host to display answering activity
    io.to(room.hostSocketId).emit('player_answered_pulse', {
      playerId: socket.id,
      playerName: player.name,
      team: player.team,
      isCorrect
    });

    // Check if all players have answered
    const activePlayerIds = Object.keys(room.players);
    const answeredCount = Object.keys(room.roundAnswers).length;
    if (answeredCount >= activePlayerIds.length && activePlayerIds.length > 0) {
      // Early resolve after a tiny delay
      if (room.questionTimer) {
        clearInterval(room.questionTimer);
        room.questionTimer = null;
      }
      setTimeout(() => resolveRound(roomId), 600);
    }
  });

  // Resolve Round Combat & Damage
  function resolveRound(roomId) {
    const room = rooms[roomId];
    if (!room || room.status !== 'question') return;

    room.status = 'round_result';
    const currentQ = room.quiz.questions[room.currentQuestionIndex];

    const combatActions = [];
    let humanDamage = 0;
    let robotDamage = 0;
    let humanCorrectCount = 0;
    let robotCorrectCount = 0;

    const humanTotal = room.teams.human.players.length || 1;
    const robotTotal = room.teams.robot.players.length || 1;

    // Sĩ số balancing: handicap multiplier
    const humanHandicap = robotTotal > humanTotal ? (robotTotal / humanTotal) : 1;
    const robotHandicap = humanTotal > robotTotal ? (humanTotal / robotTotal) : 1;

    Object.keys(room.players).forEach(pId => {
      const player = room.players[pId];
      const ans = room.roundAnswers[pId];
      const isCorrect = ans ? ans.isCorrect : false;

      let damage = 0;
      let isCritical = false;

      if (isCorrect) {
        if (player.team === 'human') humanCorrectCount++;
        else robotCorrectCount++;

        const baseDmg = 40 * (currentQ.difficulty || 1);
        const streakBonus = player.streak >= 3 ? 1.5 : (player.streak >= 2 ? 1.25 : 1);
        if (player.streak >= 3) isCritical = true;

        const teamMultiplier = player.team === 'human' ? humanHandicap : robotHandicap;
        damage = Math.round(baseDmg * streakBonus * teamMultiplier);

        if (player.team === 'human') humanDamage += damage;
        else robotDamage += damage;
      }

      combatActions.push({
        playerId: player.id,
        playerName: player.name,
        team: player.team,
        unitClass: player.unitClass,
        isCorrect,
        damage,
        isCritical,
        streak: player.streak
      });
    });

    // Apply Base Damage
    room.teams.robot.hp = Math.max(0, room.teams.robot.hp - humanDamage);
    room.teams.human.hp = Math.max(0, room.teams.human.hp - robotDamage);

    // Objective Capture Calculation
    if (!room.objective) {
      room.objective = { name: 'Cứ Điểm Trung Tâm', owner: 'neutral', progress: 0 };
    }
    let objectiveEvent = null;
    const netCapture = (humanCorrectCount - robotCorrectCount) * 25;
    room.objective.progress = Math.max(-100, Math.min(100, room.objective.progress - netCapture));

    let objectiveBonusDamage = 0;
    if (room.objective.progress <= -100 && room.objective.owner !== 'human') {
      room.objective.owner = 'human';
      objectiveBonusDamage = 120;
      room.teams.robot.hp = Math.max(0, room.teams.robot.hp - objectiveBonusDamage);
      objectiveEvent = {
        type: 'captured',
        winner: 'human',
        title: 'PHE NGƯỜI ĐÃ CHIẾM ĐƯỢC CỨ ĐIỂM TRUNG TÂM!',
        bonusDamage: objectiveBonusDamage
      };
    } else if (room.objective.progress >= 100 && room.objective.owner !== 'robot') {
      room.objective.owner = 'robot';
      objectiveBonusDamage = 120;
      room.teams.human.hp = Math.max(0, room.teams.human.hp - objectiveBonusDamage);
      objectiveEvent = {
        type: 'captured',
        winner: 'robot',
        title: 'BINH ĐOÀN ROBOT ĐÃ CHIẾM ĐƯỢC CỨ ĐIỂM TRUNG TÂM!',
        bonusDamage: objectiveBonusDamage
      };
    }

    // Leaderboard sorted by score
    const leaderboard = Object.values(room.players)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        team: p.team,
        unitClass: p.unitClass,
        score: p.score,
        streak: p.streak
      }));

    io.to(roomId).emit('round_result', {
      questionIndex: room.currentQuestionIndex,
      correctIndex: currentQ.correctIndex,
      correctText: currentQ.options[currentQ.correctIndex],
      actions: combatActions,
      stats: {
        humanCorrectCount,
        robotCorrectCount,
        humanDamage,
        robotDamage
      },
      teams: {
        human: { hp: room.teams.human.hp, maxHp: room.teams.human.maxHp, score: room.teams.human.score },
        robot: { hp: room.teams.robot.hp, maxHp: room.teams.robot.maxHp, score: room.teams.robot.score }
      },
      objective: room.objective,
      objectiveEvent,
      leaderboard
    });

    // Check Win/Loss conditions
    let gameOverReason = null;
    if (room.teams.human.hp <= 0 && room.teams.robot.hp <= 0) {
      gameOverReason = 'Cả hai căn cứ cùng phát nổ! Hòa trận!';
    } else if (room.teams.robot.hp <= 0) {
      gameOverReason = 'Căn cứ Robot bị phá hủy hoàn toàn!';
    } else if (room.teams.human.hp <= 0) {
      gameOverReason = 'Căn cứ Loài Người bị san phẳng!';
    } else if (room.currentQuestionIndex + 1 >= room.quiz.questions.length) {
      gameOverReason = 'Đã hoàn thành toàn bộ câu hỏi!';
    }

    if (gameOverReason) {
      setTimeout(() => triggerGameOver(roomId, gameOverReason), 5000);
    } else {
      // Advance to next question after 5 seconds of combat animation
      setTimeout(() => {
        if (room.status === 'round_result') {
          sendQuestion(roomId, room.currentQuestionIndex + 1);
        }
      }, 5000);
    }
  }

  // Trigger Game Over
  function triggerGameOver(roomId, reason) {
    const room = rooms[roomId];
    if (!room) return;

    room.status = 'game_over';
    if (room.questionTimer) clearInterval(room.questionTimer);

    let winnerTeam = 'draw';
    if (room.teams.human.hp > room.teams.robot.hp) {
      winnerTeam = 'human';
    } else if (room.teams.robot.hp > room.teams.human.hp) {
      winnerTeam = 'robot';
    } else {
      if (room.teams.human.score > room.teams.robot.score) winnerTeam = 'human';
      else if (room.teams.robot.score > room.teams.human.score) winnerTeam = 'robot';
    }

    const mvpList = Object.values(room.players)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((p, idx) => ({
        rank: idx + 1,
        name: p.name,
        team: p.team,
        unitClass: p.unitClass,
        score: p.score,
        correctCount: p.correctCount,
        totalAnswered: p.totalAnswered
      }));

    io.to(roomId).emit('game_over', {
      winnerTeam,
      reason,
      mvpList,
      teams: {
        human: { name: room.teams.human.name, hp: room.teams.human.hp, maxHp: room.teams.human.maxHp, score: room.teams.human.score },
        robot: { name: room.teams.robot.name, hp: room.teams.robot.hp, maxHp: room.teams.robot.maxHp, score: room.teams.robot.score }
      }
    });
  }

  // HOST: Restart Room
  socket.on('host_restart_game', ({ roomId }, callback) => {
    const room = rooms[roomId];
    if (!room) return;

    room.status = 'lobby';
    room.currentQuestionIndex = -1;
    room.teams.human.hp = room.baseHp;
    room.teams.human.score = 0;
    room.teams.robot.hp = room.baseHp;
    room.teams.robot.score = 0;

    Object.values(room.players).forEach(p => {
      p.score = 0;
      p.streak = 0;
      p.correctCount = 0;
      p.totalAnswered = 0;
      p.lastAnswer = null;
    });

    io.to(roomId).emit('game_restarted', {
      roomId,
      teams: {
        human: { hp: room.teams.human.hp, maxHp: room.teams.human.maxHp, score: 0 },
        robot: { hp: room.teams.robot.hp, maxHp: room.teams.robot.maxHp, score: 0 }
      }
    });

    if (callback) callback({ success: true });
  });

  // Disconnect Handling
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ${socket.id}`);
    const roomId = socket.roomId;
    if (roomId && rooms[roomId]) {
      const room = rooms[roomId];
      const player = room.players[socket.id];
      if (player) {
        const team = player.team;
        room.teams[team].players = room.teams[team].players.filter(id => id !== socket.id);
        delete room.players[socket.id];

        // Notify room
        io.to(roomId).emit('roster_updated', {
          total: Object.keys(room.players).length,
          maxPlayers: 20,
          maxTeamPlayers: 10,
          teams: {
            human: {
              name: room.teams.human.name,
              hp: room.teams.human.hp,
              maxHp: room.teams.human.maxHp,
              count: room.teams.human.players.length,
              players: room.teams.human.players.map(id => room.players[id])
            },
            robot: {
              name: room.teams.robot.name,
              hp: room.teams.robot.hp,
              maxHp: room.teams.robot.maxHp,
              count: room.teams.robot.players.length,
              players: room.teams.robot.players.map(id => room.players[id])
            }
          }
        });
      }

      // If host disconnected
      if (room.hostSocketId === socket.id) {
        io.to(roomId).emit('host_disconnected');
      }
    }
  });
});

// Start Server with auto-retry if port is occupied
function startServer(portToTry) {
  server.listen(portToTry, '0.0.0.0', () => {
    PORT = portToTry;
    const ip = getLocalIpAddress();
    console.log(`=================================================`);
    console.log(`  ROBOTWAR: QUIZ ARENA SERVER RUNNING!`);
    console.log(`  - Local:    http://localhost:${PORT}`);
    console.log(`  - Network:  http://${ip}:${PORT}`);
    console.log(`  - Host:     http://${ip}:${PORT}/host`);
    console.log(`  - Join:     http://${ip}:${PORT}/join`);
    console.log(`  - Admin:    http://${ip}:${PORT}/admin`);
    console.log(`=================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Port ${portToTry} in use, trying ${portToTry + 1}...]`);
      startServer(portToTry + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
