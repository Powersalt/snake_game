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
let dungeonPattern, coinImage, snakeHeadImage, snakeHeadOpenImage, snakeBodyImage;
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

    // Snake head open mouth image (Pac-Man style)
    const headOpenCanvas = document.createElement('canvas');
    headOpenCanvas.width = GRID_SIZE; headOpenCanvas.height = GRID_SIZE;
    const hoCtx = headOpenCanvas.getContext('2d');

    {
        const cx = GRID_SIZE / 2;
        const cy = GRID_SIZE / 2;
        const r = GRID_SIZE / 2;

        // Draw head with open mouth (facing right)
        hoCtx.fillStyle = '#2e8b57';
        hoCtx.beginPath();
        // Arc from 45 deg to 315 deg
        hoCtx.arc(cx, cy, r, 0.25 * Math.PI, 1.75 * Math.PI);
        hoCtx.lineTo(cx, cy);
        hoCtx.closePath();
        hoCtx.fill();

        // Eyes (positioned for side view)
        hoCtx.fillStyle = 'yellow';
        hoCtx.beginPath();
        hoCtx.arc(cx, cy - r / 2, 2, 0, Math.PI * 2);
        hoCtx.fill();
        hoCtx.fillStyle = 'black';
        hoCtx.beginPath();
        hoCtx.arc(cx, cy - r / 2, 0.5, 0, Math.PI * 2);
        hoCtx.fill();
    }

    snakeHeadOpenImage = headOpenCanvas;
}

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
let noiseBuffer = null;
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
    // Create noise buffer for crunch sound
    const bufferSize = audioCtx.sampleRate * 0.5;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    noiseBuffer = buffer;

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
    // eat sound (crunch)
    eatSound = () => {
        if (isMuted || !audioCtx || !noiseBuffer) return;
        const src = audioCtx.createBufferSource();
        src.buffer = noiseBuffer;
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        src.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

        src.start();
        src.stop(audioCtx.currentTime + 0.1);
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
            ctx.fillText('Tap Screen to Start', canvas.width / 2, canvas.height / 2 + 50);
            // ctx.fillText('Press R for Rules', canvas.width / 2, canvas.height / 2 + 70); // Removed in favor of button
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

                // Check if about to eat
                let isEating = false;
                const nextHead = { x: snake[0].x + dx, y: snake[0].y + dy };
                if (nextHead.x < 0) nextHead.x = TILE_COUNT - 1;
                if (nextHead.x >= TILE_COUNT) nextHead.x = 0;
                if (nextHead.y < 0) nextHead.y = TILE_COUNT - 1;
                if (nextHead.y >= TILE_COUNT) nextHead.y = 0;

                if ((nextHead.x === food.x && nextHead.y === food.y) ||
                    (ruby && nextHead.x === ruby.x && nextHead.y === ruby.y)) {
                    isEating = true;
                }

                if (isEating && snakeHeadOpenImage) {
                    ctx.drawImage(snakeHeadOpenImage, -GRID_SIZE / 2, -GRID_SIZE / 2);
                } else {
                    ctx.drawImage(snakeHeadImage, -GRID_SIZE / 2, -GRID_SIZE / 2);
                }
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
        ctx.fillText('Tap Screen to Restart', canvas.width / 2, canvas.height / 2 + 80);
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
    updateUIButtons();
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

// Add touch/click support for starting the game
function handleTap(e) {
    // Prevent default to avoid double firing on some devices if both touch and click are handled,
    // but we need to be careful not to block UI interaction if we had buttons.
    // Since the game is canvas-based and we want "tap anywhere", this is fine for now.
    // We'll check if the tap is on the controls to avoid conflict, but for "Start Game" screen, controls aren't active.

    if (!isGameStarted || isGameOver) {
        e.preventDefault(); // Prevent scrolling or zooming on double tap
        startGame();
    }
}

canvas.addEventListener('touchstart', handleTap, { passive: false });
canvas.addEventListener('mousedown', handleTap);

// UI Button Logic
const pauseBtn = document.getElementById('pauseBtn');
const rulesBtn = document.getElementById('rulesBtn');
const soundBtn = document.getElementById('soundBtn');

soundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMute();
    soundBtn.textContent = isMuted ? '🔇' : '🔊';
    // Ensure focus doesn't stay on button to avoid spacebar triggering it
    soundBtn.blur();
});

pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent game start/other clicks
    if (isGameRunning && !isGameOver) {
        if (!isPaused) {
            pauseStartTime = Date.now();
            pauseBtn.textContent = '▶️'; // Resume icon
        } else {
            const dur = Date.now() - pauseStartTime;
            foodSpawnTime += dur;
            pauseBtn.textContent = '⏸️'; // Pause icon
        }
        isPaused = !isPaused;
        if (isPaused) {
            stopBGM();
            draw();
        } else {
            startBGM();
        }
    }
    pauseBtn.blur();
});

rulesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!isGameStarted) {
        showRules = !showRules;
        rulesScrollOffset = 0;
        // rulesBtn.textContent = showRules ? 'Back' : 'Rules'; // Icon doesn't change for now, or maybe toggle ?/X
        rulesBtn.textContent = showRules ? '❌' : '❓';
        draw();
    }
    rulesBtn.blur();
});

// Directional Buttons Logic
const upBtn = document.getElementById('upBtn');
const downBtn = document.getElementById('downBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

function handleDirectionBtn(e, dx, dy) {
    e.stopPropagation();
    e.preventDefault(); // Prevent default touch behavior
    if (isGameRunning && !isPaused && !isGameOver) {
        setDirection(dx, dy);
    }
}

// Add both click and touchstart to ensure responsiveness
// Using helper to avoid code duplication
if (upBtn) {
    upBtn.addEventListener('touchstart', (e) => handleDirectionBtn(e, 0, -1), { passive: false });
    upBtn.addEventListener('mousedown', (e) => handleDirectionBtn(e, 0, -1));
}
if (downBtn) {
    downBtn.addEventListener('touchstart', (e) => handleDirectionBtn(e, 0, 1), { passive: false });
    downBtn.addEventListener('mousedown', (e) => handleDirectionBtn(e, 0, 1));
}
if (leftBtn) {
    leftBtn.addEventListener('touchstart', (e) => handleDirectionBtn(e, -1, 0), { passive: false });
    leftBtn.addEventListener('mousedown', (e) => handleDirectionBtn(e, -1, 0));
}
if (rightBtn) {
    rightBtn.addEventListener('touchstart', (e) => handleDirectionBtn(e, 1, 0), { passive: false });
    rightBtn.addEventListener('mousedown', (e) => handleDirectionBtn(e, 1, 0));
}

// Update button visibility in game loop/state changes
function updateUIButtons() {
    soundBtn.textContent = isMuted ? '🔇' : '🔊';

    if (isGameStarted && !isGameOver) {
        rulesBtn.classList.add('hidden');
        pauseBtn.classList.remove('hidden');
        pauseBtn.textContent = isPaused ? '▶️' : '⏸️';
    } else if (isGameOver) {
        rulesBtn.classList.add('hidden');
        pauseBtn.classList.add('hidden');
    } else {
        // Start screen
        rulesBtn.classList.remove('hidden');
        pauseBtn.classList.add('hidden');
        rulesBtn.textContent = showRules ? '❌' : '❓';
    }
}


