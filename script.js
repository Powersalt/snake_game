// Snake Game Implementation
// -------------------------------------------------
// Canvas and UI elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

// -------------------------------------------------
// Game constants
const GRID_SIZE = 20;
const TILE_COUNT = canvas.width / GRID_SIZE; // assuming square canvas
const BASE_SPEED = 200; // ms per frame
const FOOD_TIMEOUT = 10000; // 10 seconds per food

// -------------------------------------------------
// Asset generation (procedural graphics)
let dungeonPattern, coinImage, snakeHeadImage, snakeBodyImage;
function generateAssets() {
    // Background pattern
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 40; bgCanvas.height = 40;
    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.fillStyle = '#1a1a1a';
    bgCtx.fillRect(0, 0, 40, 40);
    bgCtx.strokeStyle = '#333';
    bgCtx.lineWidth = 2;
    bgCtx.strokeRect(0, 0, 40, 40);
    bgCtx.fillStyle = '#222';
    bgCtx.fillRect(2, 2, 36, 36);
    bgCtx.strokeStyle = '#111';
    bgCtx.beginPath();
    bgCtx.moveTo(10, 10); bgCtx.lineTo(15, 15);
    bgCtx.moveTo(30, 30); bgCtx.lineTo(25, 35);
    bgCtx.stroke();
    dungeonPattern = ctx.createPattern(bgCanvas, 'repeat');

    // Coin image
    const coinCanvas = document.createElement('canvas');
    coinCanvas.width = GRID_SIZE; coinCanvas.height = GRID_SIZE;
    const cCtx = coinCanvas.getContext('2d');
    const r = GRID_SIZE / 2 - 2;
    const cx = GRID_SIZE / 2;
    const cy = GRID_SIZE / 2;
    const grd = cCtx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, r);
    grd.addColorStop(0, '#fff');
    grd.addColorStop(0.3, '#ffd700');
    grd.addColorStop(1, '#b8860b');
    cCtx.fillStyle = grd;
    cCtx.beginPath();
    cCtx.arc(cx, cy, r, 0, Math.PI * 2);
    cCtx.fill();
    cCtx.strokeStyle = '#daa520';
    cCtx.lineWidth = 1;
    cCtx.stroke();
    cCtx.fillStyle = '#b8860b';
    cCtx.font = 'bold 12px sans-serif';
    cCtx.textAlign = 'center';
    cCtx.textBaseline = 'middle';
    cCtx.fillText('$', cx, cy + 1);
    coinImage = coinCanvas;

    // Snake body image
    const bodyCanvas = document.createElement('canvas');
    bodyCanvas.width = GRID_SIZE; bodyCanvas.height = GRID_SIZE;
    const bCtx = bodyCanvas.getContext('2d');
    bCtx.fillStyle = '#2e8b57';
    bCtx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);
    bCtx.fillStyle = '#3cb371';
    bCtx.beginPath();
    bCtx.arc(GRID_SIZE / 2, GRID_SIZE / 2, 4, 0, Math.PI * 2);
    bCtx.fill();
    bCtx.strokeStyle = '#1e5c39';
    bCtx.strokeRect(0, 0, GRID_SIZE, GRID_SIZE);
    snakeBodyImage = bodyCanvas;

    // Snake head image (simple generic head)
    const headCanvas = document.createElement('canvas');
    headCanvas.width = GRID_SIZE; headCanvas.height = GRID_SIZE;
    const hCtx = headCanvas.getContext('2d');
    hCtx.fillStyle = '#2e8b57';
    hCtx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);
    hCtx.fillStyle = 'yellow';
    hCtx.beginPath();
    hCtx.arc(5, 5, 2, 0, Math.PI * 2);
    hCtx.arc(5, 15, 2, 0, Math.PI * 2);
    hCtx.fill();
    hCtx.fillStyle = 'black';
    hCtx.beginPath();
    hCtx.arc(5, 5, 0.5, 0, Math.PI * 2);
    hCtx.arc(5, 15, 0.5, 0, Math.PI * 2);
    hCtx.fill();
    snakeHeadImage = headCanvas;
}

// -------------------------------------------------
// Game state variables
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let food = { x: 15, y: 15 };
let ruby = null; // ruby object when present
let obstacles = [];
let snake = [];
let dx = 1, dy = 0; // current direction
let nextDx = 1, nextDy = 0; // buffered direction
let currentSpeed = BASE_SPEED;
let speedMultiplier = 1;
let isGameRunning = false;
let isGameStarted = false;
let isPaused = true;
let isGameOver = false;
let isInvincible = false;
let invincibleEndTime = 0;
let foodSpawnTime = 0;
let pauseStartTime = 0;
let showRules = false;
let rulesScrollOffset = 0;
let lastDirection = { dx: 1, dy: 0 };
let lastRubySpawnScore = 0;
let isMuted = false;
let audioCtx = null;
let bgmSource = null;
let beepSound, turnSound, dieSound, eatSound;

// -------------------------------------------------
// Audio handling (Web Audio API)
function initAudio() {
    if (audioCtx) {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(e => console.error("Audio resume failed", e));
        }
        return;
    }
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.error("Web Audio API not supported", e);
        isMuted = true;
        return;
    }
    // beep for timer warning
    beepSound = () => {
        if (isMuted || !audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.1;
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    };
    // turn sound
    turnSound = () => {
        if (isMuted || !audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 440;
        gain.gain.value = 0.05;
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    };
    // die sound
    dieSound = () => {
        if (isMuted || !audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.5);
        gain.gain.value = 0.2;
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    };
    // eat sound (coins or ruby)
    eatSound = () => {
        if (isMuted || !audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 660;
        gain.gain.value = 0.08;
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    };
}

function startBGM() {
    if (isMuted || !audioCtx) return;
    stopBGM();
    bgmSource = audioCtx.createBufferSource();
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 4, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    const notes = [262, 294, 330, 262]; // C D E C
    const beat = audioCtx.sampleRate;
    for (let i = 0; i < notes.length; i++) {
        for (let j = 0; j < beat * 0.4; j++) {
            const idx = i * beat + j;
            if (idx < data.length) {
                data[idx] = Math.sin(2 * Math.PI * notes[i] * j / audioCtx.sampleRate) * 0.03;
            }
        }
    }
    bgmSource.buffer = buffer;
    bgmSource.loop = true;
    bgmSource.connect(audioCtx.destination);
    bgmSource.start();
}

function stopBGM() {
    if (bgmSource) {
        try { bgmSource.stop(); } catch (_) { }
        bgmSource = null;
    }
}

function toggleMute() {
    isMuted = !isMuted;
    if (isMuted) {
        stopBGM();
    } else if (isGameRunning && !isGameOver) {
        startBGM();
    }
}

// -------------------------------------------------
// Helper functions
function placeFood() {
    food = {
        x: Math.floor(Math.random() * TILE_COUNT),
        y: Math.floor(Math.random() * TILE_COUNT)
    };
    foodSpawnTime = Date.now();
    // avoid spawning on snake
    for (let seg of snake) {
        if (seg.x === food.x && seg.y === food.y) {
            placeFood();
            return;
        }
    }
    // avoid spawning on ruby or obstacles
    if (ruby && ruby.x === food.x && ruby.y === food.y) {
        placeFood();
        return;
    }
    for (let obs of obstacles) {
        if (obs.x === food.x && obs.y === food.y) {
            placeFood();
            return;
        }
    }
}

function spawnRuby() {
    // spawn ruby only if not already present
    if (ruby) return;
    ruby = {
        x: Math.floor(Math.random() * TILE_COUNT),
        y: Math.floor(Math.random() * TILE_COUNT),
        spawnTime: Date.now()
    };
    // ensure not on snake, food, or obstacles
    for (let seg of snake) {
        if (seg.x === ruby.x && seg.y === ruby.y) { ruby = null; return; }
    }
    if (ruby && ruby.x === food.x && ruby.y === food.y) { ruby = null; return; }
    for (let obs of obstacles) {
        if (obs.x === ruby.x && obs.y === ruby.y) { ruby = null; return; }
    }
}

function generateObstacles() {
    obstacles = [];
    const chains = speedMultiplier; // number of obstacle chains grows with speed
    for (let c = 0; c < chains; c++) {
        const chain = [];
        const chainLength = 6;
        // pick a start position away from snake head
        let startPos;
        let attempts = 0;
        while (attempts < 50) {
            startPos = {
                x: Math.floor(Math.random() * TILE_COUNT),
                y: Math.floor(Math.random() * TILE_COUNT)
            };
            const dist = Math.abs(startPos.x - snake[0].x) + Math.abs(startPos.y - snake[0].y);
            if (dist < 5) { attempts++; continue; }
            // avoid colliding with snake or food
            let ok = true;
            for (let seg of snake) {
                if (seg.x === startPos.x && seg.y === startPos.y) { ok = false; break; }
            }
            if (ok && !(startPos.x === food.x && startPos.y === food.y)) break;
            attempts++;
        }
        if (attempts >= 50) continue;
        chain.push(startPos);
        const dirs = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
        ];
        let curDir = dirs[Math.floor(Math.random() * 4)];
        for (let i = 1; i < chainLength; i++) {
            const last = chain[chain.length - 1];
            // occasional turn
            if (Math.random() < 0.3) {
                const perp = dirs.filter(d => d.dx !== -curDir.dx || d.dy !== -curDir.dy);
                curDir = perp[Math.floor(Math.random() * perp.length)];
            }
            const next = {
                x: (last.x + curDir.dx + TILE_COUNT) % TILE_COUNT,
                y: (last.y + curDir.dy + TILE_COUNT) % TILE_COUNT
            };
            // avoid duplicates in chain
            if (chain.some(b => b.x === next.x && b.y === next.y)) break;
            chain.push(next);
        }
        obstacles = obstacles.concat(chain);
    }
}

function resetGame() {
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    dx = 1; dy = 0; nextDx = 1; nextDy = 0;
    lastDirection = { dx: 1, dy: 0 };
    placeFood();
    ruby = null;
    obstacles = [];
    isInvincible = false;
    invincibleEndTime = 0;
}

function startGame() {
    if (isGameRunning) return;
    generateAssets();
    initAudio();
    isGameStarted = true;
    isGameRunning = true;
    isPaused = false;
    isGameOver = false;
    score = 0;
    currentSpeed = BASE_SPEED;
    speedMultiplier = 1;
    scoreElement.textContent = score;
    resetGame();
    startBGM();
    lastUpdateTime = performance.now();
    if (gameLoop) cancelAnimationFrame(gameLoop);
    gameLoop = requestAnimationFrame(gameLoopFunction);
    draw();
}

let gameLoop = null;
let lastUpdateTime = 0;

function gameLoopFunction(timestamp) {
    if (!isGameRunning || isGameOver) {
        if (isGameRunning && !isGameOver) gameLoop = requestAnimationFrame(gameLoopFunction);
        return;
    }
    const elapsed = timestamp - lastUpdateTime;
    if (elapsed >= currentSpeed) {
        lastUpdateTime = timestamp;
        update();
    }
    gameLoop = requestAnimationFrame(gameLoopFunction);
}

function update() {
    if (isPaused || isGameOver) { draw(); return; }
    // timeout check
    if (Date.now() - foodSpawnTime > FOOD_TIMEOUT) { gameOver(); return; }
    // apply buffered direction
    dx = nextDx; dy = nextDy;
    // turn sound if direction changed
    if (dx !== lastDirection.dx || dy !== lastDirection.dy) {
        turnSound();
        lastDirection = { dx, dy };
    }
    // compute new head (wrap around edges)
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    if (head.x < 0) head.x = TILE_COUNT - 1;
    if (head.x >= TILE_COUNT) head.x = 0;
    if (head.y < 0) head.y = TILE_COUNT - 1;
    if (head.y >= TILE_COUNT) head.y = 0;
    // collision detection (unless invincible)
    if (!isInvincible) {
        // self collision
        for (let seg of snake) {
            if (head.x === seg.x && head.y === seg.y) { dieSound(); gameOver(); return; }
        }
        // obstacle collision
        for (let obs of obstacles) {
            if (head.x === obs.x && head.y === obs.y) { dieSound(); gameOver(); return; }
        }
    }
    // move snake
    snake.unshift(head);
    // food consumption
    if (head.x === food.x && head.y === food.y) {
        score += 1;
        scoreElement.textContent = score;
        eatSound();
        // speed increase every 9 points
        if (score > 0 && score % 9 === 0) {
            currentSpeed = Math.max(30, currentSpeed / 2);
            speedMultiplier *= 2;
        }
        // obstacle generation every 6 points
        if (score > 0 && score % 6 === 0) {
            generateObstacles();
        } else if (score > 0 && score % 6 !== 0 && obstacles.length) {
            obstacles = [];
        }
        // ruby spawn chance after certain score
        if (score - lastRubySpawnScore >= 10 && !ruby && Math.random() < 0.3) {
            spawnRuby();
            lastRubySpawnScore = score;
        }
        placeFood();
    } else {
        snake.pop(); // normal move, remove tail
    }
    // ruby collection
    if (ruby && head.x === ruby.x && head.y === ruby.y) {
        score += 10;
        scoreElement.textContent = score;
        eatSound();
        ruby = null;
        // grant invincibility for 6 seconds
        isInvincible = true;
        invincibleEndTime = Date.now() + 6000;
        // obstacle handling same as food
        if (score > 0 && score % 6 === 0) generateObstacles();
        else if (score > 0 && score % 6 !== 0 && obstacles.length) obstacles = [];
    }
    // invincibility timeout
    if (isInvincible && Date.now() >= invincibleEndTime) {
        isInvincible = false;
    }
    // ruby expiration after 6 seconds
    if (ruby && Date.now() - ruby.spawnTime > 6000) ruby = null;
    draw();
}

function draw() {
    // clear background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // start screen / rules
    if (!isGameStarted) {
        if (showRules) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('How to Play', canvas.width / 2, 50);
            ctx.font = '14px "Segoe UI", sans-serif';
            ctx.textAlign = 'left';
            const rules = [
                '🎮 Controls: Arrow Keys / Buttons',
                '⏸️ Pause: SPACE',
                '',
                '🎯 Coins: 1 point each',
                '💎 Ruby: 10 points + 6s invincibility',
                '⏱️ Time Limit: Collect food in 10 seconds',
                '',
                '⚠️ Obstacles: Appear at score multiples of 6',
                '⚡ Speed: Doubles every 9 points',
                '',
                '🔇 Press M to toggle sound'
            ];
            let y = 90;
            rules.forEach(line => { ctx.fillText(line, 20, y); y += 22; });
            ctx.fillStyle = '#4ecca3';
            ctx.font = '14px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Press R to return', canvas.width / 2, canvas.height - 20);
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 35px "Segoe UI", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Snake Game', canvas.width / 2, canvas.height / 2 - 40);
            ctx.fillStyle = '#4ecca3';
            ctx.font = '18px "Segoe UI", sans-serif';
            ctx.fillText(`Highest Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 10);
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px "Segoe UI", sans-serif';
            ctx.fillText('Press SPACE to Start', canvas.width / 2, canvas.height / 2 + 50);
            ctx.fillText('Press R for Rules', canvas.width / 2, canvas.height / 2 + 70);
        }
        return;
    }

    // background pattern
    if (dungeonPattern) {
        ctx.fillStyle = dungeonPattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // draw food
    if (coinImage) ctx.drawImage(coinImage, food.x * GRID_SIZE, food.y * GRID_SIZE);
    else { ctx.fillStyle = 'gold'; ctx.fillRect(food.x * GRID_SIZE, food.y * GRID_SIZE, GRID_SIZE, GRID_SIZE); }
    // draw ruby if present
    if (ruby) {
        const age = Date.now() - ruby.spawnTime;
        const blink = age > 3000 && Math.floor(Date.now() / 300) % 2 === 0;
        if (!blink) {
            const rx = ruby.x * GRID_SIZE, ry = ruby.y * GRID_SIZE;
            const cx = rx + GRID_SIZE / 2, cy = ry + GRID_SIZE / 2;
            const size = GRID_SIZE / 2 - 2;
            ctx.fillStyle = '#e03131';
            ctx.beginPath(); ctx.moveTo(cx, cy - size); ctx.lineTo(cx + size, cy); ctx.lineTo(cx, cy + size); ctx.lineTo(cx - size, cy); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath(); ctx.moveTo(cx, cy - size); ctx.lineTo(cx + size / 2, cy - size / 2); ctx.lineTo(cx, cy); ctx.lineTo(cx - size / 2, cy - size / 2); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#a61e4d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy - size); ctx.lineTo(cx + size, cy); ctx.lineTo(cx, cy + size); ctx.lineTo(cx - size, cy); ctx.closePath(); ctx.stroke();
        }
    }
    // draw obstacles
    obstacles.forEach(o => {
        ctx.fillStyle = '#555';
        ctx.fillRect(o.x * GRID_SIZE, o.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
        ctx.strokeRect(o.x * GRID_SIZE, o.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
    });
    // draw snake
    snake.forEach((seg, idx) => {
        const x = seg.x * GRID_SIZE, y = seg.y * GRID_SIZE;
        const flashing = isInvincible && Math.floor(Date.now() / 200) % 2 === 0;
        if (idx === 0) {
            if (snakeHeadImage && !flashing) {
                ctx.save();
                ctx.translate(x + GRID_SIZE / 2, y + GRID_SIZE / 2);
                let angle = 0;
                if (dx === 1) angle = 0; else if (dx === -1) angle = Math.PI; else if (dy === 1) angle = Math.PI / 2; else if (dy === -1) angle = -Math.PI / 2;
                ctx.rotate(angle);
                ctx.drawImage(snakeHeadImage, -GRID_SIZE / 2, -GRID_SIZE / 2);
                ctx.restore();
            } else {
                ctx.fillStyle = flashing ? '#ffff00' : '#6effc8';
                ctx.fillRect(x, y, GRID_SIZE, GRID_SIZE);
            }
        } else {
            if (snakeBodyImage && !flashing) ctx.drawImage(snakeBodyImage, x, y);
            else { ctx.fillStyle = flashing ? '#ffff00' : '#4ecca3'; ctx.fillRect(x, y, GRID_SIZE, GRID_SIZE); }
        }
    });

    // overlay for game over / pause
    if (isGameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#e94560'; ctx.font = 'bold 35px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('YOU LOSE', canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = '#ffffff'; ctx.font = '18px "Segoe UI", sans-serif';
        ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillStyle = '#4ecca3';
        ctx.fillText(`Highest Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 50);
        ctx.fillStyle = '#ffffff'; ctx.font = '14px "Segoe UI", sans-serif';
        ctx.fillText('Press SPACE to Restart', canvas.width / 2, canvas.height / 2 + 80);
    } else if (isPaused) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff'; ctx.font = '28px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 10);
        ctx.font = '14px "Segoe UI", sans-serif';
        ctx.fillText('Press SPACE to Resume', canvas.width / 2, canvas.height / 2 + 20);
    }

    // timer and invincibility UI
    if (isGameRunning && !isGameOver) {
        let now = Date.now();
        if (isPaused && pauseStartTime > 0) now = pauseStartTime;
        const timeLeft = Math.max(0, Math.ceil((FOOD_TIMEOUT - (now - foodSpawnTime)) / 1000));
        if (!isPaused && timeLeft <= 3) {
            if (Math.floor(Date.now() / 200) % 2 === 0) {
                ctx.fillStyle = 'rgba(255,0,0,0.3)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            // beep once per second
            if (Math.floor(Date.now() / 1000) !== Math.floor((Date.now() - 100) / 1000)) beepSound();
        }
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px "Segoe UI", sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(`Time: ${timeLeft}s`, canvas.width - 10, 25);
        if (isInvincible) {
            const invLeft = Math.max(0, Math.ceil((invincibleEndTime - Date.now()) / 1000));
            ctx.fillStyle = '#ffff00';
            ctx.fillText(`🛡️ ${invLeft}s`, canvas.width - 10, 45);
        }
    }
    // mute icon
    ctx.fillStyle = isMuted ? '#888' : '#fff';
    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(isMuted ? '🔇' : '🔊', 10, 25);
}

function handleKeyDown(e) {
    if (!isGameStarted) {
        if (e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar' || e.keyCode === 32) {
            e.preventDefault();
            if (!showRules) startGame();
        } else if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            showRules = !showRules;
            rulesScrollOffset = 0;
            draw();
        } else if (showRules && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            if (e.key === 'ArrowUp') rulesScrollOffset = Math.max(0, rulesScrollOffset - 1);
            else rulesScrollOffset += 1;
            draw();
        }
        return;
    }
    if (isGameOver) {
        if (e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar' || e.keyCode === 32) {
            e.preventDefault();
            startGame();
        }
        return;
    }
    switch (e.key) {
        case 'ArrowUp': e.preventDefault(); if (!isPaused) setDirection(0, -1); break;
        case 'ArrowDown': e.preventDefault(); if (!isPaused) setDirection(0, 1); break;
        case 'ArrowLeft': e.preventDefault(); if (!isPaused) setDirection(-1, 0); break;
        case 'ArrowRight': e.preventDefault(); if (!isPaused) setDirection(1, 0); break;
        case ' ':
        case 'Spacebar':
            e.preventDefault();
            if (!isPaused) {
                pauseStartTime = Date.now();
            } else {
                const dur = Date.now() - pauseStartTime;
                foodSpawnTime += dur;
            }
            isPaused = !isPaused;
            if (isPaused) {
                stopBGM();
                draw();
            } else {
                startBGM();
            }
            break;
        case 'm':
        case 'M':
            e.preventDefault();
            toggleMute();
            break;
    }
    // Also check e.code/keyCode for Space if e.key didn't match
    if ((e.code === 'Space' || e.keyCode === 32) && e.key !== ' ' && e.key !== 'Spacebar') {
        e.preventDefault();
        if (!isPaused) {
            pauseStartTime = Date.now();
        } else {
            const dur = Date.now() - pauseStartTime;
            foodSpawnTime += dur;
        }
        isPaused = !isPaused;
        if (isPaused) {
            stopBGM();
            draw();
        } else {
            startBGM();
        }
    }
}

function setDirection(newDx, newDy) {
    if (newDx === -dx && newDy === -dy) return;
    nextDx = newDx;
    nextDy = newDy;
}

function gameOver() {
    isGameRunning = false;
    isGameOver = true;
    stopBGM();
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
    }
    if (gameLoop) cancelAnimationFrame(gameLoop);
    draw();
}

// Initialize
generateAssets();
initAudio();
draw();
window.addEventListener('keydown', handleKeyDown);
