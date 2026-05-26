const STATE = { 
    WELCOME: 'welcome', MENU: 'menu', LEVEL_SELECT: 'level_select', 
    INTRO: 'intro', PLAYING: 'playing', GAMEOVER: 'gameover', 
    VICTORY_SEQUENCE: 'victory_sequence', HANGAR: 'hangar'
};
let gameState = STATE.MENU;
const MAX_STAGE = 15;
const CAMPAIGN_MODES = ['sim', 'easy', 'hard', 'insane'];
const MODE_LABELS = {
    sim: 'SIMULATION',
    easy: 'ROOKIE',
    hard: 'EXPERT',
    insane: 'INSANE'
};
const MODE_GRID_IDS = {
    sim: 'sim-grid',
    easy: 'easy-grid',
    hard: 'hard-grid',
    insane: 'insane-grid'
};
let playerTargetLock = null;
let targetCycleIndex = 0;
let width, height;
let arenaScale = 1;
let currentLevelIndex = 1;
let activeDifficultyMode = 'easy';
let currentHangarMode = 'easy';
let introTimer = 30;
let introInterval = null;
let cookiesAccepted = false;
let levelSelectReadyAt = 0;
let levelSelectArmTimer = null;

// --- AUDIO SYSTEM ---
let audioCtx = null;
let musicInterval = null;
let nextNoteTime = 0;
let currentNote = 0;
let currentMusicLevel = 0;
let musicAudio = null;
let musicUnlocked = false;
const MUSIC_TRACKS = [
    null,
    'assets/music/stage01-omega-curse.mp3',
    'assets/music/stage02-slim-chance.mp3',
    'assets/music/stage03-broken-glass.mp3',
    'assets/music/stage04-snake-den.mp3',
    'assets/music/stage05-ship-swarm.mp3',
    'assets/music/stage06-matrix-glitch.mp3',
    'assets/music/stage01-omega-curse.mp3',
    'assets/music/stage02-slim-chance.mp3',
    'assets/music/stage03-broken-glass.mp3',
    'assets/music/stage04-snake-den.mp3',
    'assets/music/stage05-ship-swarm.mp3',
    'assets/music/stage06-matrix-glitch.mp3'
];
const MUSIC_DEFAULT_VOLUME = 0.35;
const LEVEL_TRACKS = [
    { root: 36, tempo: 0.20, wave: 'sawtooth', bass: [0,0,7,0,0,10,7,5], lead: [12,null,15,17,12,null,19,17], color: 'menu' },
    { root: 36, tempo: 0.18, wave: 'square', bass: [0,0,7,0,3,0,10,7], lead: [12,15,17,null,15,12,10,null], color: 'omega' },
    { root: 38, tempo: 0.17, wave: 'sawtooth', bass: [0,5,0,7,0,10,7,5], lead: [17,null,15,14,17,19,null,22], color: 'terminator' },
    { root: 39, tempo: 0.16, wave: 'square', bass: [0,0,6,0,11,0,6,4], lead: [12,18,null,16,23,18,16,null], color: 'phantom' },
    { root: 35, tempo: 0.18, wave: 'triangle', bass: [0,7,5,7,0,10,7,5], lead: [19,17,null,15,14,15,17,null], color: 'serpent' },
    { root: 34, tempo: 0.19, wave: 'sawtooth', bass: [0,0,3,0,8,7,5,3], lead: [15,null,17,20,19,null,17,15], color: 'hive' },
    { root: 41, tempo: 0.15, wave: 'square', bass: [0,6,1,7,0,11,6,1], lead: [12,13,18,null,19,18,13,null], color: 'syntax' },
    { root: 32, tempo: 0.20, wave: 'sawtooth', bass: [0,0,12,10,7,0,5,7], lead: [24,null,22,19,null,17,19,22], color: 'null' },
    { root: 37, tempo: 0.155, wave: 'square', bass: [0,7,0,10,12,10,7,3], lead: [19,22,null,24,22,19,17,null], color: 'oblivion' },
    { root: 40, tempo: 0.17, wave: 'sawtooth', bass: [0,4,7,11,0,7,11,14], lead: [16,null,19,23,28,23,19,null], color: 'architect' },
    { root: 31, tempo: 0.145, wave: 'square', bass: [0,0,7,10,0,12,10,7], lead: [24,22,19,null,27,24,22,null], color: 'void' },
    { root: 42, tempo: 0.16, wave: 'sawtooth', bass: [0,5,9,12,0,9,5,2], lead: [21,null,24,26,28,26,24,null], color: 'rift' },
    { root: 43, tempo: 0.15, wave: 'square', bass: [0,0,8,0,3,10,8,3], lead: [20,23,null,27,30,27,23,null], color: 'portal' }
];

function midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

function setLevelMusic(level) {
    currentMusicLevel = Math.max(0, Math.min(MUSIC_TRACKS.length - 1, level));
    currentNote = 0;
    nextNoteTime = audioCtx ? audioCtx.currentTime + 0.05 : 0;
    startMusicTrack();
}

function startMusicTrack() {
    if (!musicUnlocked) return;
    const src = MUSIC_TRACKS[currentMusicLevel];
    if (!src) {
        if (musicAudio) musicAudio.pause();
        return;
    }
    if (!musicAudio) {
        musicAudio = new Audio();
        musicAudio.loop = true;
        musicAudio.volume = MUSIC_DEFAULT_VOLUME;
        musicAudio.addEventListener('ended', () => {
            if (gameState === STATE.PLAYING || gameState === STATE.INTRO || gameState === STATE.VICTORY_SEQUENCE) {
                musicAudio.currentTime = 0;
                musicAudio.play().catch(() => {});
            }
        });
    }
    const nextSrc = new URL(src, window.location.href).href;
    if (musicAudio.src !== nextSrc) {
        musicAudio.pause();
        musicAudio.src = src;
        musicAudio.currentTime = 0;
    }
    musicAudio.volume = MUSIC_DEFAULT_VOLUME;
    musicAudio.play().catch(() => {});
}

function fadeOutMusic(duration = 1300) {
    if (!musicAudio || musicAudio.paused) return;
    const startVolume = musicAudio.volume;
    const startedAt = performance.now();
    function fadeFrame(now) {
        const t = Math.min(1, (now - startedAt) / duration);
        musicAudio.volume = startVolume * (1 - t);
        if (t < 1 && gameState === STATE.GAMEOVER) {
            requestAnimationFrame(fadeFrame);
        } else {
            musicAudio.pause();
            musicAudio.currentTime = 0;
            musicAudio.volume = MUSIC_DEFAULT_VOLUME;
        }
    }
    requestAnimationFrame(fadeFrame);
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    musicUnlocked = true;
    startMusicTrack();
}

window.addEventListener('click', initAudio, { once: true });
window.addEventListener('keydown', initAudio, { once: true });
window.addEventListener('touchstart', initAudio, { once: true });

function scheduleMusic() {
    if (!audioCtx || audioCtx.state === 'suspended') return;
    const track = LEVEL_TRACKS[currentMusicLevel] || LEVEL_TRACKS[0];
    while (nextNoteTime < audioCtx.currentTime + 0.1) {
        if (nextNoteTime === 0) nextNoteTime = audioCtx.currentTime + 0.1;

        const step = currentNote % track.bass.length;
        const bassFreq = midiToFreq(track.root + track.bass[step]);
        const leadOffset = track.lead[step % track.lead.length];

        const bassOsc = audioCtx.createOscillator();
        const bassFilter = audioCtx.createBiquadFilter();
        const bassGain = audioCtx.createGain();
        bassOsc.type = track.wave;
        bassOsc.frequency.value = bassFreq / 2;
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(180, nextNoteTime);
        bassFilter.frequency.exponentialRampToValueAtTime(1000 + currentMusicLevel * 55, nextNoteTime + 0.045);
        bassFilter.frequency.exponentialRampToValueAtTime(160, nextNoteTime + track.tempo * 0.78);
        bassGain.gain.setValueAtTime(0.0, nextNoteTime);
        bassGain.gain.linearRampToValueAtTime(0.026, nextNoteTime + 0.018);
        bassGain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + track.tempo * 0.88);
        bassOsc.connect(bassFilter); bassFilter.connect(bassGain); bassGain.connect(audioCtx.destination);
        bassOsc.start(nextNoteTime); bassOsc.stop(nextNoteTime + track.tempo * 0.92);

        if (leadOffset !== null && (currentNote + currentMusicLevel) % 2 === 0) {
            const leadOsc = audioCtx.createOscillator();
            const leadGain = audioCtx.createGain();
            leadOsc.type = currentMusicLevel % 3 === 0 ? 'triangle' : 'square';
            leadOsc.frequency.value = midiToFreq(track.root + leadOffset);
            leadGain.gain.setValueAtTime(0.0, nextNoteTime + track.tempo * 0.35);
            leadGain.gain.linearRampToValueAtTime(0.014, nextNoteTime + track.tempo * 0.4);
            leadGain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + track.tempo * 0.9);
            leadOsc.connect(leadGain); leadGain.connect(audioCtx.destination);
            leadOsc.start(nextNoteTime + track.tempo * 0.34); leadOsc.stop(nextNoteTime + track.tempo * 0.92);
        }

        if (currentNote % 4 === 0) {
            const kickOsc = audioCtx.createOscillator();
            const kickGain = audioCtx.createGain();
            kickOsc.type = 'sine';
            kickOsc.frequency.setValueAtTime(75, nextNoteTime);
            kickOsc.frequency.exponentialRampToValueAtTime(35, nextNoteTime + 0.08);
            kickGain.gain.setValueAtTime(0.04, nextNoteTime);
            kickGain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + 0.09);
            kickOsc.connect(kickGain); kickGain.connect(audioCtx.destination);
            kickOsc.start(nextNoteTime); kickOsc.stop(nextNoteTime + 0.1);
        }

        nextNoteTime += track.tempo;
        currentNote++;
    }
}

window.addEventListener('mousedown', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('btn')) playSound('click');
});

function playSound(type) {
    if (!audioCtx || audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    try {
        if (type === 'shoot') {
            osc.type = 'triangle'; 
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'explosion') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100 + Math.random()*50, now);
            osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'playerDeath') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(10, now + 1.5);
            gainNode.gain.setValueAtTime(0.25, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

            const osc2 = audioCtx.createOscillator();
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(150, now);
            osc2.frequency.exponentialRampToValueAtTime(5, now + 1.5);
            osc2.connect(gainNode);

            osc.start(now); osc2.start(now);
            osc.stop(now + 1.5); osc2.stop(now + 1.5);
        }
    } catch(e) { console.warn('Audio play failed', e); }
}

const STAGE_MESSAGES = {
    'easy_1': "Pilot, we have lost contact with Outpost Omega. Sensors indicate the System Core has gone rogue. <br><br>Neutralize the threat before it spreads to the network.",
    'easy_2': "Warning! Massive energy signature detected. The rouge system core has overidden one of our terminator class dreadnoughts.<br><br>This won't be like the simulations. Stay sharp.",
    'easy_3': "Entering deep sector. Signal interference high. \n\nThe core is sending [ERROR CODE:1204] [SIGNAL FALIURE].",
    'easy_4': "CAUTION: Biological signature detected in the mainframe. <br><br>It's the Cyber Serpent. Aim for the head, its scales are almost impervious to standard fire.",
    'easy_5': "CORE BREACH IMMINENT. <br><br>You've reached the Hive Mother. She doesn't fight alone. Don't let them overwhelm you, Pilot.",
    'easy_6': "FATAL ERROR. THE SYNTAX ERROR HAS BEEN ENCOUNTERED. <br><br>Survive the glitch matrix, Commander.",
    'easy_7': "UNKNOWN ENTITY DETECTED. <br><br>A massive gravitational anomaly has breached our sector. The Null Entity will consume everything.",
    'easy_8': "THE FINAL FRONTIER. <br><br>You've reached the heart of the machine. The Oblivion Engine awaits. Destroy it and end this.",
    'easy_9': "WARNING: REALITY BREACH. <br><br>The Architect is reconstructing the grid. Its geometric patterns are lethal. Navigate the maze and shatter its core.",
    'easy_10': "PROTOTYPE VOID DETECTED. <br><br>This is not the real Neon Void. That signal is buried at Stage 100. <br><br>This prototype is only a shadow, and it is still powerful enough to double the battlefield.",
    'easy_11': "A new gate has opened beyond the prototype. <br><br>The Rift Sentinel is guarding the path deeper into the Void. Its lock-on beams are unstable, but still deadly.",
    'easy_12': "PORTAL PROTOTYPE ONLINE. <br><br>It can bend shots through gateways and move through them. Warning: your ship can also be pulled through any active portal.",
    'easy_13': "ASTRAL TRIO DETECTED. <br><br>Two outer stars are protecting a split core. Destroy the red and blue stars first, then break the center before it grows unstable.",
    'easy_14': "MIMIC SIGNATURE DETECTED. <br><br>It changes shape every 15 seconds and copies bosses from the first five sectors. Do not trust what you see.",
    'easy_15': "CURSE 0 ONLINE. <br><br>A blue zero is forming in the void. Its Termination 0 shots are slow, but one hit ends everything.",
    'hard_1': "Veteran difficulty authorized. <br><br>The enemy AI has adapted to standard tactics. Expect aggressive maneuvers.",
    'hard_2': "This is it. The Elite Terminator unit has been deployed. <br><br>Survival probability is near zero. Good luck, Commander.",
    'hard_3': "Elite Deep Sector. \n\nNo support available. You are on your own, Commander.",
    'hard_4': "THE VIPER'S NEST. <br><br>The source of the corruption has been found. The Crimson Serpent awaits. <br>Kill it.",
    'hard_5': "HIVE MOTHER [ELITE]. <br><br>The swarm has evolved beyond our projections. Wipe them out.",
    'hard_6': "CRITICAL SYSTEM FAILURE. <br><br>The Syntax Error cannot be reasoned with. Erase the anomaly.",
    'hard_7': "THE END OF ALL THINGS. <br><br>The Null Entity is here. Do not let it escape into the real world. This is a suicide mission.",
    'hard_8': "ABSOLUTE OBLIVION. <br><br>The Engine that birthed the corruption. This is your final battle. Leave nothing behind.",
    'hard_9': "THE MAZE OF MADNESS. <br><br>The Architect has sealed the sector. It is actively designing your demise. Erase the blueprint.",
    'hard_10': "THE NEON VOID PROTOTYPE. <br><br>Command says the real Neon Void waits at Stage 100. This one is just a test weapon. <br><br>The moment it appears, space will expand. Do not blink.",
    'hard_11': "THE RIFT SENTINEL. <br><br>The prototype was only the door. This thing is the lock. Break it before the Void learns your flight pattern.",
    'hard_12': "THE PORTAL PROTOTYPE. <br><br>Space is no longer trustworthy. Lasers enter one gate and leave another. So can you. So can it.",
    'hard_13': "THE ASTRAL TRIO. <br><br>Three stars, one shielded heart. Kill the orbiting red and blue stars before the center wakes up.",
    'hard_14': "THE MIMIC. <br><br>It remembers the first five nightmares and wears them like masks. Every 15 seconds, the fight changes.",
    'hard_15': "CURSE 0. <br><br>A null-blue zero with one command: terminate. Its bullets are slow. That is the only mercy."
};

function setCookie(name, value, days) { localStorage.setItem(name, value); }
function getCookie(name) { return localStorage.getItem(name); }
function deleteCookie(name) { localStorage.removeItem(name); }

let gameData;

function createModeData() {
    return { stars: 0, healthLvl: 0, cannonLvl: 0, engineLvl: 0, magnetLvl: 0, maxStage: 1, unlockedShips: [0], currentShip: 0 };
}

function normalizeModeData(mode) {
    if (!gameData[mode]) gameData[mode] = createModeData();
    const stats = gameData[mode];
    if (stats.stars === undefined) stats.stars = 0;
    if (stats.healthLvl === undefined) stats.healthLvl = 0;
    if (stats.cannonLvl === undefined) stats.cannonLvl = 0;
    if (stats.engineLvl === undefined) stats.engineLvl = 0;
    if (stats.magnetLvl === undefined) stats.magnetLvl = 0;
    if (stats.maxStage === undefined) stats.maxStage = 1;
    if (stats.unlockedShips === undefined) stats.unlockedShips = [0];
    if (stats.currentShip === undefined) stats.currentShip = 0;
    stats.unlockedShips = [...new Set(stats.unlockedShips.map(Number))].filter(id => id >= 0 && id < SHIPS.length);
    if (!stats.unlockedShips.includes(0)) stats.unlockedShips.unshift(0);
    if (!stats.unlockedShips.includes(stats.currentShip)) stats.currentShip = 0;
    return stats;
}

function getModeData(mode = activeDifficultyMode) {
    return normalizeModeData(CAMPAIGN_MODES.includes(mode) ? mode : 'easy');
}

function resetAllProgressData() {
    gameData = {};
    CAMPAIGN_MODES.forEach(mode => { gameData[mode] = createModeData(); });
}

function initData() {
    const cookieData = getCookie('neonVoidData_v3');
    if (cookieData) {
        try {
            gameData = JSON.parse(cookieData);
        } catch (e) {
            console.error("Corrupt game data, resetting.");
            gameData = null;
        }
    }

    if (!gameData) {
        resetAllProgressData();
    }
    CAMPAIGN_MODES.forEach(normalizeModeData);
}

function saveData() {
    if (!cookiesAccepted) return;
    setCookie('neonVoidData_v3', JSON.stringify(gameData), 365);
}

const HEALTH_UPGRADES = { costs: [250, 450, 800, 1600, 3200], bonuses: [4, 8, 12, 16, 32] };
const CANNON_UPGRADES = { costs: [350, 700, 1300, 2600, 5200], bonuses: [1, 1, 2, 2, 3] };
const ENGINE_UPGRADES = { costs: [300, 600, 1100, 2200, 4200], bonuses: [0.25, 0.5, 0.75, 1.0, 1.35] };
const MAGNET_UPGRADES = { costs: [250, 500, 950, 1800, 3400], bonuses: [8, 16, 25, 35, 50] };
const ECONOMY_MULTIPLIERS = { sim: 1.0, easy: 1.3, hard: 2.4, insane: 4.5 };

function totalUpgradeBonus(config, level) {
    let total = 0;
    for (let i = 0; i < level; i++) total += config.bonuses[i] || 0;
    return total;
}

function isHardMode(mode = activeDifficultyMode) {
    return mode === 'hard' || mode === 'insane';
}

function getDifficultySettings(mode) {
    if (mode === 'sim') return DIFFICULTY.SIM;
    if (mode === 'insane') return DIFFICULTY.INSANE;
    if (mode === 'hard') return DIFFICULTY.NORMAL;
    return DIFFICULTY.EASY;
}

function getHangarCost(baseCost, mode = currentHangarMode) {
    return Math.ceil(baseCost * (ECONOMY_MULTIPLIERS[mode] || 1.3));
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const flashOverlay = document.getElementById('flash-overlay');
const menuScreen = document.getElementById('menu-screen');
const levelSelectScreen = document.getElementById('level-select-screen');
const simulationSelectScreen = document.getElementById('simulation-level-select-screen');
const expertSelectScreen = document.getElementById('expert-level-select-screen');
const insaneSelectScreen = document.getElementById('insane-level-select-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hangarScreen = document.getElementById('hangar-screen');
const introScreen = document.getElementById('intro-screen');
const welcomeScreen = document.getElementById('welcome-screen');
const msgModal = document.getElementById('msg-modal');

function resizeGame() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    width = viewportWidth * arenaScale; height = viewportHeight * arenaScale;
    canvas.width = width; canvas.height = height;
    canvas.style.width = viewportWidth + 'px';
    canvas.style.height = viewportHeight + 'px';
}
resizeGame(); window.addEventListener('resize', resizeGame);

function setArenaScale(scale) {
    if (arenaScale === scale) return;
    const oldWidth = width || window.innerWidth;
    const oldHeight = height || window.innerHeight;
    arenaScale = scale;
    resizeGame();
    const scaleX = width / oldWidth;
    const scaleY = height / oldHeight;
    const scaleEntity = (entity) => {
        if (!entity) return;
        if (typeof entity.x === 'number') entity.x *= scaleX;
        if (typeof entity.y === 'number') entity.y *= scaleY;
        if (typeof entity.origX === 'number') entity.origX *= scaleX;
        if (typeof entity.origY === 'number') entity.origY *= scaleY;
        if (typeof entity.targetX === 'number') entity.targetX *= scaleX;
        if (typeof entity.targetY === 'number') entity.targetY *= scaleY;
    };
    scaleEntity(player); scaleEntity(boss);
    enemies.forEach(scaleEntity); bullets.forEach(scaleEntity); drops.forEach(scaleEntity); particles.forEach(scaleEntity);
    mouse.targetX *= scaleX; mouse.targetY *= scaleY;
    mouse.x *= scaleX; mouse.y *= scaleY;
}

const bossHud = document.getElementById('boss-hud');
const bossHealthBar = document.getElementById('boss-health-bar');
const bossShieldContainer = document.getElementById('boss-shield-container');
const bossShieldBar = document.getElementById('boss-shield-bar');
const bossName = document.getElementById('boss-name');
const playerHud = document.getElementById('player-hud');
const playerHpEl = document.getElementById('player-hp');
const scoreEl = document.getElementById('score');
const starsDisplayEl = document.getElementById('stars-display');
const stageDisplayEl = document.getElementById('stage-display');
const gameOverTitle = document.getElementById('game-over-title');
const phaseDebug = document.getElementById('phase-debug');
const waveText = document.getElementById('wave-announcement');

const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, s: false, a: false, d: false, ' ': false };
const mouse = { x: width / 2, y: height - 150, down: false, targetX: width / 2, targetY: height - 150 };
let isTouch = false;

let scene, camera, renderer;
let menuCore, stars, bossPhase2Mesh, bossShieldMesh, glitchBossMesh;
let isPhase2Active = false;
let supernovaMesh, supernovaParticles;
let supernovaVelocities = [];
let isSupernovaExploding = false;
let dropMeshes = []; 

const SHIPS = [
    { id: 0, name: "STRIKER", color: "#00ffff", cost: 0, hpMult: 1.0, spd: 8, dmgTakenMult: 1.0, desc: "BALANCED" },
    { id: 1, name: "PHANTOM", color: "#ff00ff", cost: 3500, hpMult: 0.7, spd: 10.5, dmgTakenMult: 1.2, desc: "FAST / TRI-BEAM / VERY FRAGILE" },
    { id: 2, name: "JUGGERNAUT", color: "#ff8800", cost: 8500, hpMult: 1.25, spd: 4.7, dmgTakenMult: 0.95, desc: "TANK / WEAK SPREAD / SLOW" },
    { id: 3, name: "VANGUARD", color: "#00ff88", cost: 7000, hpMult: 1.05, spd: 6.5, dmgTakenMult: 0.85, desc: "ARMOR / FOCUS SHOT" },
    { id: 4, name: "COMET", color: "#46b8ff", cost: 7800, hpMult: 0.6, spd: 12.0, dmgTakenMult: 1.35, desc: "HASTE / WEAK NEEDLES" },
    { id: 5, name: "ECLIPSE", color: "#aa66ff", cost: 12000, hpMult: 0.82, spd: 8.0, dmgTakenMult: 1.15, desc: "FOCUS BEAM / LOW COVERAGE" }
];
let previewShipIndex = 0;

function drawShipAsset(ctx, type, isHologram) {
    ctx.save();
    if (type === 0) {
        if(isHologram) ctx.shadowColor = '#00ffff'; else ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = isHologram ? 20 : 10;
        
        // Main Hull
        ctx.fillStyle = '#112233';
        ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(12, 10); ctx.lineTo(0, 15); ctx.lineTo(-12, 10); ctx.fill();
        
        // Outer Wings
        ctx.fillStyle = '#0088aa';
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(25, 15); ctx.lineTo(25, 25); ctx.lineTo(8, 15); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-25, 15); ctx.lineTo(-25, 25); ctx.lineTo(-8, 15); ctx.fill();
        
        // Wing accents
        ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(12, 10); ctx.lineTo(25, 20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-12, 10); ctx.lineTo(-25, 20); ctx.stroke();
        
        // Engine Glow
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(6, 15, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(-6, 15, 3, 0, Math.PI*2); ctx.fill();
        
        // Cockpit
        ctx.fillStyle = '#00ffff';
        ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(4, -5); ctx.lineTo(0, 0); ctx.lineTo(-4, -5); ctx.fill();
    } else if (type === 1) {
        if(isHologram) ctx.shadowColor = '#ff00ff'; else ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = isHologram ? 20 : 15;
        
        // Central Diamond
        ctx.fillStyle = '#220022';
        ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(10, 0); ctx.lineTo(0, 20); ctx.lineTo(-10, 0); ctx.fill();
        
        // Side Floating Blades
        ctx.fillStyle = '#aa00aa';
        ctx.beginPath(); ctx.moveTo(15, -15); ctx.lineTo(25, 10); ctx.lineTo(12, 5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-15, -15); ctx.lineTo(-25, 10); ctx.lineTo(-12, 5); ctx.fill();
        
        // Energy tethers (lines)
        ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(8, -5); ctx.lineTo(18, -2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(-18, -2); ctx.stroke();
        
        // Core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
        
        // Front spike
        ctx.fillStyle = '#ffccff';
        ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(3, -20); ctx.lineTo(-3, -20); ctx.fill();
    } else if (type === 2) {
        if(isHologram) ctx.shadowColor = '#ff8800'; else ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = isHologram ? 20 : 10;
        
        // Main Block
        ctx.fillStyle = '#331100';
        ctx.fillRect(-15, -10, 30, 25);
        
        // Front Shield
        ctx.fillStyle = '#aa4400';
        ctx.beginPath(); ctx.moveTo(-20, -10); ctx.lineTo(20, -10); ctx.lineTo(15, -20); ctx.lineTo(-15, -20); ctx.fill();
        
        // Massive Cannons
        ctx.fillStyle = '#555555';
        ctx.fillRect(-22, -15, 6, 25); ctx.fillRect(16, -15, 6, 25);
        
        // Cannon glowing tips
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(-21, -20, 4, 5); ctx.fillRect(17, -20, 4, 5);
        
        // Thrusters
        ctx.fillStyle = '#ff8800';
        ctx.beginPath(); ctx.arc(-8, 15, 4, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(8, 15, 4, 0, Math.PI*2); ctx.fill();
        
        // Vents / Details
        ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-10, 5); ctx.lineTo(10, 5); ctx.stroke();
        
        // Cockpit
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, -5, 3, 0, Math.PI*2); ctx.fill();
    } else if (type === 3) {
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = isHologram ? 22 : 12;

        ctx.fillStyle = '#06281c';
        ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(14, -2); ctx.lineTo(10, 20); ctx.lineTo(0, 28); ctx.lineTo(-10, 20); ctx.lineTo(-14, -2); ctx.fill();

        ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 2, 24, Math.PI * 0.08, Math.PI * 0.92); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 2, 24, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();

        ctx.fillStyle = '#0c6b49';
        ctx.beginPath(); ctx.moveTo(-14, 4); ctx.lineTo(-30, 16); ctx.lineTo(-14, 20); ctx.fill();
        ctx.beginPath(); ctx.moveTo(14, 4); ctx.lineTo(30, 16); ctx.lineTo(14, 20); ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, -8, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(-3, 12, 6, 14);
    } else if (type === 4) {
        ctx.shadowColor = '#46b8ff';
        ctx.shadowBlur = isHologram ? 22 : 14;

        ctx.fillStyle = '#06172b';
        ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(8, -4); ctx.lineTo(0, 24); ctx.lineTo(-8, -4); ctx.fill();

        ctx.fillStyle = '#124f8c';
        ctx.beginPath(); ctx.moveTo(8, -2); ctx.lineTo(32, 10); ctx.lineTo(8, 12); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-32, 10); ctx.lineTo(-8, 12); ctx.fill();

        ctx.strokeStyle = '#46b8ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-24, 10); ctx.lineTo(0, -18); ctx.lineTo(24, 10); ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, -12, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#46b8ff';
        ctx.beginPath(); ctx.arc(-5, 18, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(5, 18, 3, 0, Math.PI*2); ctx.fill();
    } else if (type === 5) {
        ctx.shadowColor = '#aa66ff';
        ctx.shadowBlur = isHologram ? 24 : 16;

        ctx.fillStyle = '#18072f';
        ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(18, -4); ctx.lineTo(8, 24); ctx.lineTo(0, 16); ctx.lineTo(-8, 24); ctx.lineTo(-18, -4); ctx.fill();

        ctx.strokeStyle = '#aa66ff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, 26); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -2, 18, 0, Math.PI * 2); ctx.stroke();

        ctx.fillStyle = '#5d21aa';
        ctx.beginPath(); ctx.moveTo(-18, -4); ctx.lineTo(-34, 10); ctx.lineTo(-8, 8); ctx.fill();
        ctx.beginPath(); ctx.moveTo(18, -4); ctx.lineTo(34, 10); ctx.lineTo(8, 8); ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, -2, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#aa66ff';
        ctx.beginPath(); ctx.arc(0, 20, 4, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
}

function initThreeMenu() {
    if (typeof THREE === 'undefined') return;

    try {
        const container = document.getElementById('three-container');
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050505, 0.002);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 50;

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.domElement.id = 'menuCanvas';
        container.appendChild(renderer.domElement);

        const geometry = new THREE.IcosahedronGeometry(10, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0.8 });
        menuCore = new THREE.Mesh(geometry, material);
        scene.add(menuCore);

        const starGeo = new THREE.BufferGeometry();
        const starCount = 2000;
        const posArray = new Float32Array(starCount * 3);
        for(let i=0; i<starCount * 3; i++) posArray[i] = (Math.random() - 0.5) * 400;
        starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const starMat = new THREE.PointsMaterial({ size: 0.5, color: 0xffffff });
        stars = new THREE.Points(starGeo, starMat);
        scene.add(stars);

        const bossGeo = new THREE.TorusKnotGeometry(12, 3, 100, 16);
        const bossMat = new THREE.MeshBasicMaterial({ color: 0xff3300, wireframe: true });
        bossPhase2Mesh = new THREE.Mesh(bossGeo, bossMat);
        bossPhase2Mesh.visible = false;
        bossPhase2Mesh.position.z = -20;
        scene.add(bossPhase2Mesh);
        
        const ringGeo = new THREE.RingGeometry(20, 22, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        bossPhase2Mesh.add(ring);

        const shieldGeo = new THREE.SphereGeometry(16, 32, 32);
        const shieldMat = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, wireframe: false, transparent: true, opacity: 0.4,       
            side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
        });
        bossShieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        bossShieldMesh.visible = false;
        bossPhase2Mesh.add(bossShieldMesh); 

        const glitchGeo = new THREE.OctahedronGeometry(15, 0);
        const glitchMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true, transparent: true, opacity: 0.8 });
        glitchBossMesh = new THREE.Mesh(glitchGeo, glitchMat);
        glitchBossMesh.visible = false;
        glitchBossMesh.position.z = -20;
        scene.add(glitchBossMesh);

        const snGeo = new THREE.SphereGeometry(1, 32, 32);
        const snMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0, wireframe: true });
        supernovaMesh = new THREE.Mesh(snGeo, snMat);
        supernovaMesh.visible = false;
        scene.add(supernovaMesh);

        const pGeo = new THREE.BufferGeometry();
        const pCount = 500;
        const pPos = new Float32Array(pCount * 3);
        supernovaVelocities = [];
        for(let i=0; i<pCount; i++) {
            pPos[i*3] = 0; pPos[i*3+1] = 0; pPos[i*3+2] = 0;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = 2 + Math.random() * 4;
            supernovaVelocities.push(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.sin(phi) * Math.sin(theta) * speed,
                Math.cos(phi) * speed
            );
        }
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        const pMat = new THREE.PointsMaterial({ color: 0xff5500, size: 0.8, transparent: true });
        supernovaParticles = new THREE.Points(pGeo, pMat);
        supernovaParticles.visible = false;
        scene.add(supernovaParticles);

        animateThree();
    } catch (e) { console.warn("Error initializing 3D:", e); }
}

function triggerSupernova() {
    if(!supernovaMesh || !supernovaParticles) return;
    isSupernovaExploding = true;
    let posToCopy = {x:0, y:20, z:-20};
    if(boss && boss.isGlitch && glitchBossMesh) {
        posToCopy.x = (boss.x / width) * 120 - 60; posToCopy.y = (boss.y / height) * -60 + 30; 
    } else if(bossPhase2Mesh && isPhase2Active) {
        posToCopy = bossPhase2Mesh.position;
    } 
    supernovaMesh.position.copy(posToCopy);
    supernovaParticles.position.copy(posToCopy);
    if(bossPhase2Mesh) bossPhase2Mesh.visible = false;
    if(glitchBossMesh) glitchBossMesh.visible = false;
    supernovaMesh.scale.set(1,1,1); supernovaMesh.material.opacity = 1; supernovaMesh.visible = true;
    const positions = supernovaParticles.geometry.attributes.position.array;
    positions.fill(0);
    supernovaParticles.geometry.attributes.position.needsUpdate = true;
    supernovaParticles.material.opacity = 1; supernovaParticles.visible = true;
}

function animateThree() {
    requestAnimationFrame(animateThree);
    if ((gameState === STATE.MENU || gameState === STATE.LEVEL_SELECT || gameState === STATE.HANGAR || gameState === STATE.INTRO || gameState === STATE.WELCOME) && menuCore) {
        menuCore.rotation.x += 0.005; menuCore.rotation.y += 0.01; menuCore.visible = true;
        if(glitchBossMesh) glitchBossMesh.visible = false;
    } else if (menuCore) { menuCore.visible = false; }

    if (boss && boss.active && boss.isGlitch && glitchBossMesh && !isSupernovaExploding) {
        glitchBossMesh.visible = true;
        glitchBossMesh.rotation.y += 0.05; glitchBossMesh.rotation.z += 0.02;
        const jitter = (Math.random() - 0.5) * 0.5;
        glitchBossMesh.scale.set(1 + jitter, 1 + jitter, 1 + jitter);
        let targetX = (boss.x / width) * 120 - 60; let targetY = -(boss.y / height) * 60 + 30;
        glitchBossMesh.position.x = targetX; glitchBossMesh.position.y = targetY;
        const hue = (Date.now() % 2000) / 2000;
        glitchBossMesh.material.color.setHSL(hue, 1, 0.5);
    } else if (glitchBossMesh) { glitchBossMesh.visible = false; }

    if (isPhase2Active && bossPhase2Mesh && !isSupernovaExploding && (!boss || !boss.isGlitch)) {
        bossPhase2Mesh.visible = true;
        bossPhase2Mesh.rotation.x += 0.02; bossPhase2Mesh.rotation.y += 0.03;
        let targetX = 0;
        if (boss) {
            targetX = (boss.x / width) * 120 - 60;
            if (bossShieldMesh) {
                bossShieldMesh.visible = (boss.shieldHp > 0);
                bossShieldMesh.rotation.y -= 0.02;
                const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.05;
                bossShieldMesh.scale.set(pulse, pulse, pulse);
            }
        }
        const baseScale = 4 + Math.sin(Date.now() * 0.01) * 0.5; 
        bossPhase2Mesh.scale.set(baseScale, baseScale, baseScale);
        bossPhase2Mesh.position.x += (targetX - bossPhase2Mesh.position.x) * 0.2;
        bossPhase2Mesh.position.y += (0 - bossPhase2Mesh.position.y) * 0.2;
        if(bossPhase2Mesh.material) bossPhase2Mesh.material.color.setHex(0xff3300);
        bossPhase2Mesh.rotation.z = 0;
    } else if (bossPhase2Mesh && !isSupernovaExploding) { bossPhase2Mesh.visible = false; }

    if (isSupernovaExploding) {
        const scale = supernovaMesh.scale.x + 3;
        supernovaMesh.scale.set(scale, scale, scale);
        supernovaMesh.rotation.y += 0.1; supernovaMesh.material.opacity -= 0.015;
        const positions = supernovaParticles.geometry.attributes.position.array;
        for(let i=0; i<supernovaVelocities.length/3; i++) {
            positions[i*3] += supernovaVelocities[i*3];
            positions[i*3+1] += supernovaVelocities[i*3+1];
            positions[i*3+2] += supernovaVelocities[i*3+2];
        }
        supernovaParticles.geometry.attributes.position.needsUpdate = true;
        supernovaParticles.material.opacity -= 0.01;
        if (supernovaMesh.material.opacity <= 0) {
            isSupernovaExploding = false; supernovaMesh.visible = false; supernovaParticles.visible = false;
        }
    }
    if (stars) { stars.rotation.y += 0.0005; stars.rotation.x += 0.0002; }
    if (renderer && scene && camera) renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    if(camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

window.addEventListener('keydown', e => {
    if (gameState === STATE.PLAYING) {
        const k = e.key.toLowerCase();
        if (keys.hasOwnProperty(e.key)) keys[e.key] = true; 
        if (keys.hasOwnProperty(k)) keys[k] = true;
        if (k === 't') { cyclePlayerTarget(); e.preventDefault(); }
        if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].indexOf(e.code) > -1) e.preventDefault();
    }
});
window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
    if (keys.hasOwnProperty(k)) keys[k] = false;
});

function updateInput(e) {
    if (gameState === STATE.PLAYING) e.preventDefault();
    let cx, cy;
    if (e.touches && e.touches.length > 0) { isTouch = true; cx = e.touches[0].clientX; cy = e.touches[0].clientY; mouse.down = true; } 
    else { isTouch = false; cx = e.clientX; cy = e.clientY; mouse.down = e.buttons === 1; }
    mouse.targetX = cx * arenaScale; mouse.targetY = (isTouch ? cy - 80 : cy) * arenaScale;
}
window.addEventListener('mousemove', updateInput); window.addEventListener('mousedown', updateInput);
window.addEventListener('mouseup', () => mouse.down = false); window.addEventListener('touchstart', updateInput, {passive: false});
window.addEventListener('touchmove', updateInput, {passive: false}); window.addEventListener('touchend', () => mouse.down = false);

const ATTACK_SEQUENCE = ['laser', 'swarm', 'missiles', 'laser', 'laser', 'redLines', 'missiles', 'rings', 'laser', 'laser', 'swarm'];
const TERMINATOR_SEQUENCE = ['terminator_fireballs', 'terminator_rapid', 'terminator_laser'];
const GLITCH_SEQUENCE = ['glitch_teleport_rapid', 'glitch_grid', 'glitch_clones', 'glitch_grid', 'glitch_teleport_fire'];
const SNAKE_SEQUENCE = ['snake_sine_fire', 'snake_orb_deploy', 'snake_sine_fire', 'snake_rush'];
const HIVE_SEQUENCE = ['hive_summon']; 
const SYNTAX_SEQUENCE = ['syntax_loom', 'syntax_triangle', 'syntax_falling', 'syntax_digits'];
const NULL_SEQUENCE = ['null_lasers', 'null_gravity', 'null_bombs', 'null_gravity'];
const OBLIVION_SEQUENCE = ['oblivion_pulse', 'oblivion_beam', 'oblivion_chase', 'oblivion_beam'];
const ARCHITECT_SEQUENCE = ['arch_walls', 'arch_lasers', 'arch_hammers', 'arch_spikes', 'arch_lasers'];
const NEON_VOID_SEQUENCE = ['void_starfall', 'void_crossfire', 'void_implosion', 'void_mirror', 'void_worldbreak'];
const RIFT_SEQUENCE = ['rift_lance', 'rift_orbit', 'rift_crush', 'rift_sawline', 'rift_lance'];
const PORTAL_SEQUENCE = ['portal_laser', 'portal_barrage', 'portal_shift', 'portal_laser', 'portal_barrage'];
const ASTRAL_SEQUENCE = ['astral_orbit_fire', 'astral_outer_cross', 'astral_orbit_fire', 'astral_outer_cross'];
const ASTRAL_CORE_SEQUENCE = ['astral_lasers', 'astral_starfall', 'astral_rapid_fire', 'astral_lasers'];
const CURSE_SEQUENCE = ['curse_termination', 'curse_ring', 'curse_termination', 'curse_drift'];

const DIFFICULTY = {
    SIM: { name: "SIMULATION", playerDamage: 16, swarmHp: 6, heavyHp: 25, laserHp: 18, bossHp: 1600, heavyAgile: false, enemyCountMult: 0.3, fireRateMult: 2.4, incomingDamageMult: 0.55, waveDelay: 150 },
    EASY: { name: "ROOKIE", playerDamage: 10, swarmHp: 10, heavyHp: 40, laserHp: 30, bossHp: 2500, heavyAgile: false, enemyCountMult: 0.5, fireRateMult: 1.5, incomingDamageMult: 1.0, waveDelay: 120 },
    NORMAL: { name: "VETERAN", playerDamage: 5, swarmHp: 20, heavyHp: 80, laserHp: 60, bossHp: 5000, heavyAgile: true, enemyCountMult: 1.0, fireRateMult: 1.0, incomingDamageMult: 1.0, waveDelay: 60 },
    INSANE: { name: "INSANE", playerDamage: 4, swarmHp: 28, heavyHp: 120, laserHp: 90, bossHp: 7000, heavyAgile: true, enemyCountMult: 1.35, fireRateMult: 0.6, incomingDamageMult: 2.0, waveDelay: 35 }
};
let currentSettings = DIFFICULTY.NORMAL;

class Particle {
    constructor(x, y, color, speed, size, life) {
        this.x = x; this.y = y; this.color = color;
        this.angle = Math.random() * Math.PI * 2; this.speed = Math.random() * speed;
        this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
        this.life = life; this.maxLife = life; this.size = size; this.decay = Math.random() * 0.05 + 0.92;
    }
    update() {
        this.x += this.vx; this.y += this.vy; this.vx *= this.decay; this.vy *= this.decay;
        this.life--; this.size *= 0.95;
    }
    draw() {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, Math.max(0.1, this.size), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class Drop {
    constructor(x, y, type) { this.x = x; this.y = y; this.type = type; this.active = true; this.rot = 0; }
    update() {
        this.y += 1.0; this.rot += 0.05;
        if (this.y > height + 20) this.active = false;
        if (player && player.active) {
            const stats = getModeData(activeDifficultyMode);
            const magnetRange = 40 + totalUpgradeBonus(MAGNET_UPGRADES, stats.magnetLvl || 0);
            const dist = Math.hypot(this.x - player.x, this.y - player.y);
            if (dist < magnetRange && dist > 0) {
                const pull = 0.05 + Math.min(0.18, (magnetRange - dist) / magnetRange * 0.18);
                this.x += (player.x - this.x) * pull;
                this.y += (player.y - this.y) * pull;
            }
            if (dist < 40) this.collect();
        }
    }
    collect() {
        this.active = false;
        if (this.type === 'star') {
            getModeData(activeDifficultyMode).stars++;
            saveData(); updateUI();
            for(let i=0; i<5; i++) particles.push(new Particle(this.x, this.y, '#46b8ff', 3, 2, 20));
        } else if (this.type === 'health') {
            if (player.hp < player.maxHp) {
                const healAmount = player.maxHp * 0.1;
                player.hp = Math.min(player.maxHp, player.hp + healAmount);
                playerHpEl.innerText = Math.floor(player.hp);
                for(let i=0; i<10; i++) particles.push(new Particle(this.x, this.y, '#00ffff', 4, 3, 30));
            }
        }
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
        if (this.type === 'star') {
            ctx.fillStyle = '#46b8ff'; ctx.shadowBlur = 15; ctx.shadowColor = '#46b8ff'; ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * 10, -Math.sin((18 + i * 72) * Math.PI / 180) * 10);
                ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * 4, -Math.sin((54 + i * 72) * Math.PI / 180) * 4);
            }
            ctx.closePath(); ctx.fill();
        } else {
            ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(0, 50, 50, 0.8)';
            ctx.shadowBlur = 10; ctx.shadowColor = '#00ffff';
            ctx.fillRect(-8, -8, 16, 16); ctx.strokeRect(-8, -8, 16, 16);
            ctx.fillStyle = '#00ffff'; ctx.fillRect(-2, -5, 4, 10); ctx.fillRect(-5, -2, 10, 4);
        }
        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, vx, vy, type, damage) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.type = type; this.active = true;
        this.portalCooldown = 0;
        if (type === 'player') {
            this.color = '#00ffff'; this.size = 3; this.damage = damage || currentSettings.playerDamage; 
        } else if (type === 'phantom_laser') {
            this.color = '#ff00ff'; this.size = 2; this.damage = damage;
        } else if (type === 'juggernaut_shot') {
            this.color = '#ffaa00'; this.size = 6; this.damage = damage;
        } else if (type === 'player_missile') {
            this.color = '#aa66ff'; this.size = 6; this.damage = damage || currentSettings.playerDamage;
            this.angle = Math.atan2(vy, vx); this.speed = Math.max(6, Math.hypot(vx, vy)); this.guidanceTimer = 150;
        } else if (type === 'boss_orb') {
            this.color = '#ffaa00'; this.size = 6; this.damage = 10;
        } else if (type === 'fireball') {
            this.color = '#ff4400'; this.size = 12; this.damage = 15;
        } else if (type === 'saw') {
            this.color = '#cccccc'; this.size = 15; this.damage = 15;
        } else if (type === 'boss_laser_bit') {
            this.color = '#ff0055'; this.size = 4; this.damage = 15;
        } else if (type === 'missile') {
            this.color = '#ff0000'; this.size = 5; this.damage = 20;
            this.angle = Math.atan2(vy, vx); this.speed = 4; this.guidanceTimer = 90; 
        } else if (type === 'glitch_missile') {
            this.color = '#00ff00'; this.size = 5; this.damage = 15;
            this.angle = Math.atan2(vy, vx); this.speed = 3.5; this.guidanceTimer = 120;
        } else if (type === 'purple_fireball') {
            this.color = '#aa00ff'; this.size = 8; this.damage = 15;
        } else if (type === 'glitch_laser') {
            this.color = '#ff00ff'; this.size = 2000; this.damage = 25; this.isVertical = vx === 0;
            this.warmup = 60; this.life = 80;
        } else if (type === 'venom') {
            this.color = '#00ff00'; this.size = 8; this.damage = 12;
        } else if (type === 'spine_laser') {
            this.color = '#00ff00'; this.size = 10; this.damage = 15;
        } else if (type === 'snake_orb_turret') {
            this.color = '#00ff88'; this.size = 15; this.damage = 10;
            this.life = 140; this.fireTimer = 0; this.initialVx = vx; 
        } else if (type === 'mine') {
            this.color = '#ff0000'; this.size = 10; this.damage = 25; this.life = 600;
        } else if (type === 'green_digit') {
            this.color = '#00ff00'; this.size = 8; this.damage = 15;
            this.digit = Math.random() > 0.5 ? '1' : '0';
        } else if (type === 'arch_wall_h' || type === 'arch_wall_v') {
            this.color = '#ffd700'; this.damage = 15; this.life = 350; this.warmup = 60;
        } else if (type === 'arch_hammer') {
            this.color = '#ffd700'; this.damage = 25;
        } else if (type === 'termination_zero') {
            this.color = '#33aaff'; this.size = 22; this.damage = 99999; this.life = 900;
        }
    }
    update() {
        if (this.type === 'termination_zero') {
            this.life--; if (this.life <= 0) this.active = false;
            if (player.active && Math.hypot(this.x - player.x, this.y - player.y) < 26) {
                player.hit(this.damage); this.active = false;
            }
            particles.push(new Particle(this.x, this.y, '#33aaff', 1.5, 3, 12));
            this.x += this.vx; this.y += this.vy;
            return;
        }
        if (this.type === 'glitch_laser') {
            this.warmup--; this.life--; if(this.life <= 0) this.active = false; return;
        }
        if (this.type === 'arch_wall_h' || this.type === 'arch_wall_v') {
            this.life--; 
            if (this.life <= 0) this.active = false;
            if (this.warmup > 0) this.warmup--;
            else {
                this.x += this.vx; this.y += this.vy;
                this.vx *= 0.95; this.vy *= 0.95; 
                if (player.active) {
                    let w = this.type === 'arch_wall_h' ? 400 : 30;
                    let h = this.type === 'arch_wall_h' ? 30 : 400;
                    if (Math.abs(player.x - this.x) < w/2 + 5 && Math.abs(player.y - this.y) < h/2 + 5) {
                        player.hit(this.damage);
                    }
                }
            }
            return;
        }
        if (this.type === 'arch_hammer') {
            this.y += this.vy; this.vy += 0.5;
            if (player.active && Math.abs(player.x - this.x) < 50 && Math.abs(player.y - (this.y + 30)) < 30) {
                player.hit(this.damage); this.active = false;
                for(let i=0; i<15; i++) particles.push(new Particle(this.x, this.y + 30, '#ffd700', 5, 4, 30));
            }
            if (this.y > height + 100) this.active = false;
            if (Math.random() > 0.5) particles.push(new Particle(this.x + (Math.random()-0.5)*100, this.y + 30, '#ffd700', 2, 4, 20));
            return;
        }
        if (this.type === 'mine') {
            this.y += 0.5;
            if (this.y > height + 50) this.active = false;
            if (player.active && Math.hypot(this.x - player.x, this.y - player.y) < 25) { 
                player.hit(this.damage); this.active = false;
                for(let i=0; i<30; i++) particles.push(new Particle(this.x, this.y, '#ff4400', 6, 5, 40));
                for(let i=0; i<20; i++) particles.push(new Particle(this.x, this.y, '#00ff00', 8, 3, 50));
                for(let i=0; i<15; i++) particles.push(new Particle(this.x, this.y, '#bbbbbb', 3, 15 + Math.random()*10, 70));
            }
            return;
        }
        if (this.type === 'snake_orb_turret') {
            this.fireTimer++;
            if (this.fireTimer < 40) { this.x += this.vx; this.y += this.vy; }
            else if (this.fireTimer < 90) {
                if (this.fireTimer === 60) { 
                     for(let i=0; i<12; i++) {
                         let angle = (Math.PI*2/12)*i; 
                         bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*5, Math.sin(angle)*5, 'venom'));
                     }
                     for(let i=0; i<10; i++) particles.push(new Particle(this.x, this.y, '#ffffff', 3, 2, 20));
                }
            }
            else if (this.fireTimer < 130) { this.x -= this.vx; this.y -= this.vy; }
            else { this.active = false; }
            if (player.active && Math.hypot(this.x - player.x, this.y - player.y) < 30) player.hit(10);
            return; 
        }

        if (this.type === 'player_missile' && this.guidanceTimer > 0) {
            if (!isValidTarget(this.targetRef)) this.targetRef = getNearestTarget(this.x, this.y);
            if (this.targetRef) {
                let dx = this.targetRef.x - this.x; let dy = this.targetRef.y - this.y;
                let targetAngle = Math.atan2(dy, dx);
                let diff = targetAngle - this.angle;
                while (diff < -Math.PI) diff += Math.PI * 2; while (diff > Math.PI) diff -= Math.PI * 2;
                this.angle += diff * 0.08; this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
            }
            this.guidanceTimer--;
            particles.push(new Particle(this.x, this.y, '#aa66ff', 1, 3, 18));
        }
        if ((this.type === 'missile' || this.type === 'glitch_missile') && player.active && this.guidanceTimer > 0) {
            let dx = player.x - this.x; let dy = player.y - this.y;
            let targetAngle = Math.atan2(dy, dx);
            let diff = targetAngle - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2; while (diff > Math.PI) diff -= Math.PI * 2;
            this.angle += diff * 0.05; this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
            this.guidanceTimer--;
            if (Math.random() > 0.5) {
                particles.push(new Particle(this.x, this.y, this.type === 'glitch_missile' ? '#00ff00' : '#555', 1, 3, 20));
            }
        }
        if (this.type === 'fireball' && Math.random() > 0.5) particles.push(new Particle(this.x, this.y, '#ffaa00', 1, 4, 10));
        if (this.type === 'purple_fireball' && Math.random() > 0.5) particles.push(new Particle(this.x, this.y, '#aa00ff', 1, 4, 10));
        if ((this.type === 'venom' || this.type === 'green_digit') && Math.random() > 0.5) particles.push(new Particle(this.x, this.y, '#00ff00', 1, 3, 8));
        
        this.x += this.vx; this.y += this.vy;
        handleProjectilePortalTravel(this);
        if (this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100) this.active = false;
    }
    draw() {
        if (this.type === 'glitch_laser') {
              ctx.save();
              if(this.warmup > 0) {
                  ctx.strokeStyle = `rgba(255, 0, 255, ${0.5 + Math.sin(frames*0.5)*0.5})`;
                  ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
              } else {
                  ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 10 + Math.random()*5; 
                  ctx.shadowBlur = 20; ctx.shadowColor = '#ff00ff'; ctx.setLineDash([]);
              }
              ctx.beginPath();
              if(this.isVertical) { ctx.moveTo(this.x, 0); ctx.lineTo(this.x, height); } 
              else { ctx.moveTo(0, this.y); ctx.lineTo(width, this.y); }
              ctx.stroke(); ctx.restore();
              return;
        }

        if (this.type === 'phantom_laser') {
            ctx.save(); ctx.translate(this.x, this.y);
            ctx.fillStyle = this.color; ctx.shadowBlur = 10; ctx.shadowColor = this.color;
            ctx.fillRect(-2, -8, 4, 16);
            ctx.restore();
            return;
        } else if (this.type === 'arch_wall_h' || this.type === 'arch_wall_v') {
            ctx.save(); ctx.translate(this.x, this.y);
            let w = this.type === 'arch_wall_h' ? 400 : 30;
            let h = this.type === 'arch_wall_h' ? 30 : 400;
            ctx.shadowBlur = 15; ctx.shadowColor = '#ffd700';
            ctx.fillStyle = this.warmup > 0 ? `rgba(255, 215, 0, ${0.5 + Math.sin(frames*0.2)*0.3})` : '#ffd700';
            ctx.fillRect(-w/2, -h/2, w, h);
            if (this.warmup <= 0) {
                 ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(-w/2, -h/2, w, h);
            }
            ctx.restore();
            return;
        } else if (this.type === 'arch_hammer') {
            ctx.save(); ctx.translate(this.x, this.y);
            ctx.shadowBlur = 20; ctx.shadowColor = '#ffd700';
            ctx.fillStyle = '#aa8800'; ctx.fillRect(-10, -100, 20, 100); 
            ctx.fillStyle = '#ffd700'; ctx.fillRect(-50, 0, 100, 60); 
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(-50, 0, 100, 60);
            ctx.restore();
            return;
        } else if (this.type === 'juggernaut_shot' || this.type === 'player_missile') {
            ctx.save(); ctx.translate(this.x, this.y);
            if (this.type === 'player_missile') ctx.rotate(this.angle || Math.atan2(this.vy, this.vx));
            ctx.fillStyle = this.color; ctx.shadowBlur = 15; ctx.shadowColor = this.color;
            if (this.type === 'player_missile') {
                ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, 5); ctx.lineTo(-4, 0); ctx.lineTo(-7, -5); ctx.fill();
            } else {
                ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
            return;
        } else if (this.type === 'termination_zero') {
            ctx.save(); ctx.translate(this.x, this.y);
            ctx.shadowBlur = 25; ctx.shadowColor = '#33aaff';
            ctx.strokeStyle = '#33aaff'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = 'rgba(51,170,255,0.15)';
            ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            return;
        }

        ctx.shadowBlur = 10; ctx.shadowColor = this.color; ctx.fillStyle = this.color;
        if (this.type === 'missile') {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
            ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, 5); ctx.lineTo(-5, -5); ctx.fill(); ctx.restore();
        } else if (this.type === 'glitch_missile') {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
            if(frames % 4 < 2) { ctx.translate((Math.random()-0.5)*4, (Math.random()-0.5)*4); }
            ctx.fillStyle = '#00ff00'; ctx.shadowBlur = 10; ctx.shadowColor = '#00ff00';
            ctx.font = "bold 12px monospace"; ctx.fillText(">>", -6, 4);
            ctx.restore();
        } else if (this.type === 'saw') {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(frames * 0.5); 
            ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#888"; for(let i=0; i<8; i++) { ctx.rotate(Math.PI/4); ctx.fillRect(12, -4, 8, 8); }
            ctx.fillStyle = "#ff0000"; ctx.beginPath(); ctx.arc(0,0, 5, 0, Math.PI*2); ctx.fill(); ctx.restore();
        } else if (this.type === 'spine_laser') {
            ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = '#00ff00'; ctx.fillStyle = '#ccffcc';
            ctx.fillRect(this.x - 15, this.y - 3, 30, 6); ctx.restore();
        } else if (this.type === 'snake_orb_turret') {
            ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = '#00ff88'; ctx.fillStyle = '#00ff88';
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + Math.sin(frames*0.2)*5, 0, Math.PI*2); ctx.stroke();
            ctx.restore();
        } else if (this.type === 'mine') {
            ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = '#ff0000'; ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(frames*0.1)*0.5})`;
            ctx.beginPath(); ctx.arc(this.x, this.y, 6, 0, Math.PI*2); ctx.fill(); ctx.restore();
        } else if (this.type === 'green_digit') {
            ctx.font = "bold 16px monospace";
            ctx.fillText(this.digit, this.x - 4, this.y + 4);
        } else {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;
    }
}

class MineLayer {
    constructor(x, y) {
        this.x = x; this.y = y; this.active = true; this.hp = 60; 
        this.dropTimer = 60; this.vx = (Math.random() - 0.5) * 1.5;
    }
    update() {
        if (!this.active) return;
        this.y += 0.3; this.x += this.vx;
        if (this.x < 50 || this.x > width - 50) this.vx *= -1;
        this.dropTimer--;
        if (this.dropTimer <= 0) {
            bullets.push(new Bullet(this.x, this.y, 0, 0, 'mine'));
            this.dropTimer = 180;
        }
        if (this.y > height + 50) this.active = false;
    }
    draw() {
        if (!this.active) return;
        ctx.save(); ctx.translate(this.x, this.y); ctx.shadowBlur = 10; ctx.shadowColor = '#ff00ff';
        ctx.fillStyle = '#aa00aa'; ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(10, -10); ctx.lineTo(0, -5); ctx.lineTo(-10, -10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#00ffff'; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(4, -2); ctx.lineTo(-4, -2); ctx.closePath(); ctx.fill();
        ctx.restore();
    }
    hit(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            playSound('explosion');
            this.active = false; score += 400; scoreEl.innerText = score;
            for(let i=0; i<10; i++) particles.push(new Particle(this.x, this.y, '#00ff00', 4, 4, 30));
            drops.push(new Drop(this.x, this.y, 'star'));
        }
    }
}

class SpinnerEnemy {
    constructor(x, y) {
        this.x = x; this.y = y; this.active = true;
        this.hp = 50; this.angle = 0; 
        this.fireTimer = (Math.random() * 40 + 40) * currentSettings.fireRateMult;
        this.points = 400;
    }
    update() {
        if (!this.active) return;
        this.y += 1.0;
        this.angle += 0.05;
        this.fireTimer--;
        if (this.fireTimer <= 0) {
            for(let i=0; i<8; i++) {
                let a = (Math.PI / 4) * i + this.angle;
                bullets.push(new Bullet(this.x, this.y, Math.cos(a)*4, Math.sin(a)*4, 'purple_fireball'));
            }
            this.fireTimer = 100 * currentSettings.fireRateMult;
        }
        if (this.y > height + 50) this.active = false;
    }
    draw() {
        if(!this.active) return;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.shadowBlur = 15; ctx.shadowColor = '#aa00ff';
        ctx.strokeStyle = '#aa00ff'; ctx.lineWidth = 3; ctx.strokeRect(-15, -15, 30, 30);
        ctx.fillStyle = 'rgba(170, 0, 255, 0.2)'; ctx.fillRect(-15, -15, 30, 30);
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(-4, -22, 8, 7); ctx.fillRect(-4, 15, 8, 7);
        ctx.fillRect(-22, -4, 7, 8); ctx.fillRect(15, -4, 7, 8);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
    hit(damage) {
        this.hp -= damage;
        if(this.hp <= 0) {
            playSound('explosion'); this.active = false; score += this.points; scoreEl.innerText = score;
            for(let i=0; i<15; i++) particles.push(new Particle(this.x, this.y, '#aa00ff', 4, 4, 30));
            drops.push(new Drop(this.x, this.y, 'star'));
        }
    }
}

class LaserEnemy {
    constructor(x, y) {
        this.x = x; this.y = y; this.active = true;
        this.hp = currentSettings.laserHp + currentLevelIndex * 5;
        this.points = 350;
        this.vy = 0.8;
        this.fireTimer = 90 * currentSettings.fireRateMult;
        this.charge = 0;
        this.beamActive = false;
        this.beamLife = 0;
    }
    update() {
        if (!this.active) return;
        this.y += this.vy;
        this.x += Math.sin(frames * 0.025 + this.y * 0.01) * 1.2;
        this.fireTimer--;

        if (this.fireTimer <= 45 && this.fireTimer > 0) {
            this.charge = 1 - (this.fireTimer / 45);
        }
        if (this.fireTimer === 0) {
            this.beamActive = true;
            this.beamLife = 32;
            this.charge = 0;
            playSound('shoot');
        }
        if (this.beamActive) {
            this.beamLife--;
            if (player.active && Math.abs(player.x - this.x) < 24 && player.y > this.y) player.hit(2);
            if (this.beamLife <= 0) {
                this.beamActive = false;
                this.fireTimer = 150 * currentSettings.fireRateMult;
            }
        }
        if (this.y > height + 80) this.active = false;
    }
    draw() {
        if (!this.active) return;
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.shadowBlur = 18; ctx.shadowColor = '#ff0066';
        ctx.strokeStyle = '#ff0066'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(18, -10); ctx.lineTo(0, -22); ctx.lineTo(-18, -10); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = 'rgba(255, 0, 102, 0.25)'; ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, 5 + this.charge * 8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        if (this.charge > 0) {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 0, 102, ${0.25 + this.charge * 0.45})`;
            ctx.lineWidth = 2 + this.charge * 3;
            ctx.setLineDash([10, 10]);
            ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x, height); ctx.stroke();
            ctx.restore();
        }
        if (this.beamActive) {
            ctx.save();
            ctx.shadowBlur = 25; ctx.shadowColor = '#ff0066';
            ctx.fillStyle = 'rgba(255, 0, 102, 0.75)';
            ctx.fillRect(this.x - 18, this.y, 36, height - this.y);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(this.x - 5, this.y, 10, height - this.y);
            ctx.restore();
        }
    }
    hit(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            playSound('explosion');
            this.active = false; score += this.points; scoreEl.innerText = score;
            for(let i=0; i<14; i++) particles.push(new Particle(this.x, this.y, '#ff0066', 4, 4, 30));
            drops.push(new Drop(this.x, this.y, Math.random() > 0.5 ? 'star' : 'health'));
        }
    }
}

class RammerEnemy {
    constructor(x, y) {
        this.x = x; this.y = y; this.active = true;
        this.hp = 9999; this.vy = 10 + Math.random()*4; 
        this.points = 150;
        this.rot = 0;
        this.unbreakable = true;
        this.collisionDamage = 28;
        this.collisionRadius = 26;
    }
    update() {
        this.y += this.vy;
        this.rot += 0.2;
        if(this.y > height + 50) this.active = false;
        if(player.active && Math.hypot(this.x - player.x, this.y - player.y) < 25) {
            player.hit(25);
        }
    }
    draw() {
        if(!this.active) return;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
        ctx.fillStyle = '#ff0000'; ctx.shadowBlur = 15; ctx.shadowColor = '#ff0000';
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
        ctx.beginPath();
        for(let i=0; i<8; i++) {
            ctx.moveTo(15, -5); ctx.lineTo(25, 0); ctx.lineTo(15, 5);
            ctx.rotate(Math.PI/4);
        }
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
    hit(damage) {
        for(let i=0; i<4; i++) particles.push(new Particle(this.x, this.y, '#ff0000', 2, 2, 12));
    }
}

function handlePlayerEnemyCollision(enemy) {
    if (!player || !player.active || !enemy || !enemy.active) return;
    if (enemy.isPhased) return;

    const radius = enemy.collisionRadius || 28;
    if (Math.hypot(player.x - enemy.x, player.y - enemy.y) > radius) return;

    player.hit(enemy.collisionDamage || 14);
    for(let i=0; i<6; i++) particles.push(new Particle(player.x, player.y, '#46b8ff', 3, 2, 18));

    if (!enemy.unbreakable && typeof enemy.hp === 'number') {
        const crushLimit = Math.max(35, player.damage * 1.4);
        if (enemy.hp <= crushLimit && typeof enemy.hit === 'function') {
            enemy.hit(9999);
        }
    }
}

// New Entity for Stage 8+
class PhaserEnemy {
    constructor(x, y) {
        this.x = x; this.y = y; this.active = true;
        this.hp = 60; this.vy = 2; this.phaseTimer = 0;
        this.isPhased = false; 
        this.points = 250;
    }
    update() {
        if (!this.active) return;
        this.y += this.vy;
        this.phaseTimer++;
        this.isPhased = (this.phaseTimer % 180) > 120;
        
        if (!this.isPhased && this.phaseTimer % 180 === 60) {
            let angle = Math.atan2(player.y - this.y, player.x - this.x);
            bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*8, Math.sin(angle)*8, 'boss_orb'));
        }
        if (this.y > height + 50) this.active = false;
    }
    draw() {
        if (!this.active) return;
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.globalAlpha = this.isPhased ? 0.2 : 1.0;
        ctx.fillStyle = '#00ffff'; ctx.shadowBlur = this.isPhased ? 0 : 15; ctx.shadowColor = '#00ffff';
        ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(15, 0); ctx.lineTo(0, -15); ctx.lineTo(-15, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }
    hit(damage) {
        if (this.isPhased) return;
        this.hp -= damage;
        if (this.hp <= 0) {
            playSound('explosion'); this.active = false; score += this.points; scoreEl.innerText = score;
            for(let i=0; i<10; i++) particles.push(new Particle(this.x, this.y, '#00ffff', 4, 4, 30));
            drops.push(new Drop(this.x, this.y, 'star'));
        }
    }
}

class Portal {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.radius = 38; this.rot = Math.random() * Math.PI * 2;
        this.pulse = Math.random() * Math.PI * 2;
    }
    update() {
        this.rot += 0.035;
        this.pulse += 0.08;
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
        const glow = 0.65 + Math.sin(this.pulse) * 0.25;
        ctx.shadowBlur = 30; ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.ellipse(0, 0, this.radius, this.radius * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${glow})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, this.radius * 0.62, this.radius * 0.34, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(20, 0, 35, 0.55)';
        ctx.beginPath(); ctx.ellipse(0, 0, this.radius * 0.72, this.radius * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        for(let i=0; i<6; i++) {
            const a = i * Math.PI / 3 + this.rot;
            ctx.fillStyle = i % 2 === 0 ? '#ffffff' : this.color;
            ctx.beginPath(); ctx.arc(Math.cos(a) * this.radius, Math.sin(a) * this.radius * 0.62, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

function getTargetableEntities() {
    const targets = enemies.filter(e => e && e.active && !e.isPhased);
    if (boss && boss.active && boss.phase === 'fight') targets.push(boss);
    return targets;
}

function isValidTarget(target) {
    return !!target && target.active !== false && (!target.isPhased) && (target === boss || enemies.includes(target));
}

function getNearestTarget(x, y) {
    const targets = getTargetableEntities();
    let best = null;
    let bestDist = Infinity;
    targets.forEach(target => {
        const d = Math.hypot(target.x - x, target.y - y);
        if (d < bestDist) { best = target; bestDist = d; }
    });
    return best;
}

function getPlayerTarget() {
    if (!isValidTarget(playerTargetLock)) playerTargetLock = getNearestTarget(player ? player.x : width / 2, player ? player.y : height / 2);
    return playerTargetLock || getNearestTarget(player ? player.x : width / 2, player ? player.y : height / 2);
}

function cyclePlayerTarget() {
    const targets = getTargetableEntities();
    if (targets.length === 0) { playerTargetLock = null; return; }
    targetCycleIndex = (targetCycleIndex + 1) % targets.length;
    playerTargetLock = targets[targetCycleIndex];
    waveText.innerText = "TARGET LOCK";
    waveText.style.color = "#aa66ff";
    waveText.style.opacity = 1;
    waveText.style.transform = "scale(0.8)";
    setTimeout(() => { if (waveText.innerText === "TARGET LOCK") waveText.style.opacity = 0; }, 700);
}

function fireAtTarget(x, y, speed, type, damage, target) {
    const chosen = target || getNearestTarget(x, y);
    const angle = chosen ? Math.atan2(chosen.y - y, chosen.x - x) : -Math.PI / 2;
    const bullet = new Bullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, type, damage);
    bullet.targetRef = chosen;
    return bullet;
}

function handleCometRamCollision(ship) {
    enemies.forEach(enemy => {
        if (enemy && enemy.active && Math.hypot(ship.x - enemy.x, ship.y - enemy.y) < 46) {
            if (enemy.unbreakable) enemy.active = false;
            else if (typeof enemy.hit === 'function') enemy.hit(9999);
            for(let i=0; i<12; i++) particles.push(new Particle(enemy.x, enemy.y, '#46b8ff', 5, 4, 24));
        }
    });
    if (boss && boss.active && boss.phase === 'fight' && Math.hypot(ship.x - boss.x, ship.y - boss.y) < 110) {
        boss.hit(ship.damage * 0.45);
    }
}

class Player {
    constructor() {
        this.x = width / 2; this.y = height - 100;
        this.active = true; this.iframes = 0;
        this.portalCooldown = 0;
        this.cometRamTimer = 0;
        this.cometRamCooldown = 0;
        this.cometRamCenter = { x: this.x, y: this.y };
        let baseHp = 100; let bonusHp = 0;
        const stats = getModeData(activeDifficultyMode); 
        const shipInfo = SHIPS[stats.currentShip];
        
        this.speed = shipInfo.spd + totalUpgradeBonus(ENGINE_UPGRADES, stats.engineLvl || 0);
        this.damageTakenMult = shipInfo.dmgTakenMult || 1;
        const hpLevel = stats.healthLvl;
        bonusHp = totalUpgradeBonus(HEALTH_UPGRADES, hpLevel);
        this.maxHp = (baseHp + bonusHp) * shipInfo.hpMult; 
        this.hp = this.maxHp;
        playerHpEl.innerText = Math.floor(this.hp);

        const cannonLevel = stats.cannonLvl;
        const bonusDamage = totalUpgradeBonus(CANNON_UPGRADES, cannonLevel);
        this.damage = currentSettings.playerDamage + bonusDamage;
    }
    update() {
        if (!this.active) return;
        if (gameState === STATE.PLAYING) {
            const stats = getModeData(activeDifficultyMode);
            if (stats.currentShip === 4 && keys[' '] && this.cometRamCooldown <= 0) {
                this.cometRamTimer = 140;
                this.cometRamCooldown = 620;
                this.cometRamCenter = { x: this.x, y: this.y };
                waveText.innerText = "COMET RAM";
                waveText.style.color = "#46b8ff";
                waveText.style.opacity = 1;
                waveText.style.transform = "scale(0.85)";
                setTimeout(() => { if (waveText.innerText === "COMET RAM") waveText.style.opacity = 0; }, 900);
            }
            if (this.cometRamCooldown > 0) this.cometRamCooldown--;
            if (this.cometRamTimer > 0) {
                this.cometRamTimer--;
                this.iframes = Math.max(this.iframes, 8);
                const t = (140 - this.cometRamTimer) * 0.22;
                const radius = 68 + Math.sin(t * 0.7) * 34;
                this.x = this.cometRamCenter.x + Math.cos(t) * radius + Math.cos(t * 2.3) * 44;
                this.y = this.cometRamCenter.y + Math.sin(t * 1.4) * radius;
                this.x = Math.max(20, Math.min(width - 20, this.x));
                this.y = Math.max(20, Math.min(height - 20, this.y));
                handleCometRamCollision(this);
                mouse.targetX = this.x; mouse.targetY = this.y;
                particles.push(new Particle(this.x, this.y, '#46b8ff', 4, 7, 18));
                if (this.cometRamTimer <= 0) keys[' '] = false;
                return;
            }
            let dx = 0, dy = 0;
            if (keys.ArrowUp || keys.w) dy -= this.speed;
            if (keys.ArrowDown || keys.s) dy += this.speed;
            if (keys.ArrowLeft || keys.a) dx -= this.speed;
            if (keys.ArrowRight || keys.d) dx += this.speed;
            if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
            if (dx !== 0 || dy !== 0) {
                this.x += dx; this.y += dy;
                mouse.targetX = this.x; mouse.targetY = this.y;
            } else if (mouse.targetX !== undefined) {
                this.x += (mouse.targetX - this.x) * 0.15;
                this.y += (mouse.targetY - this.y) * 0.15;
            }
            this.x = Math.max(20, Math.min(width - 20, this.x));
            this.y = Math.max(20, Math.min(height - 20, this.y));
            handlePortalTravel(this, 30, 'player');

            if (stats.currentShip === 0) {
                if (frames % 6 === 0) {
                    bullets.push(new Bullet(this.x - 10, this.y - 10, 0, -15, 'player', this.damage));
                    bullets.push(new Bullet(this.x + 10, this.y - 10, 0, -15, 'player', this.damage));
                    playSound('shoot');
                }
            } else if (stats.currentShip === 1) {
                if (frames % 5 === 0) {
                    bullets.push(new Bullet(this.x, this.y - 15, 0, -18, 'phantom_laser', this.damage * 0.58));
                    bullets.push(new Bullet(this.x - 12, this.y - 5, -1, -16, 'phantom_laser', this.damage * 0.38));
                    bullets.push(new Bullet(this.x + 12, this.y - 5, 1, -16, 'phantom_laser', this.damage * 0.38));
                    playSound('shoot');
                }
            } else if (stats.currentShip === 2) {
                if (frames % 18 === 0) {
                    const damageSpread = [0.38, 0.52, 0.72, 0.52, 0.38];
                    for(let i=-2; i<=2; i++) {
                        bullets.push(new Bullet(this.x + i*5, this.y - 10, i*2, -12, 'juggernaut_shot', this.damage * damageSpread[i + 2]));
                    }
                    playSound('shoot');
                }
            } else if (stats.currentShip === 3) {
                if (frames % 3 === 0) {
                    const wiggle = Math.sin(frames * 0.35) * 2.8;
                    bullets.push(new Bullet(this.x, this.y - 18, wiggle, -18, 'player', this.damage * 0.42));
                    playSound('shoot');
                }
            } else if (stats.currentShip === 4) {
                if (frames % 6 === 0) {
                    bullets.push(new Bullet(this.x - 10, this.y - 10, 0, -15, 'player', this.damage * 0.82));
                    bullets.push(new Bullet(this.x + 10, this.y - 10, 0, -15, 'player', this.damage * 0.82));
                    if (frames % 30 === 0) bullets.push(fireAtTarget(this.x, this.y - 16, 8, 'player_missile', this.damage * 1.1, getNearestTarget(this.x, this.y)));
                    playSound('shoot');
                }
            } else if (stats.currentShip === 5) {
                const target = getPlayerTarget();
                if (frames % 8 === 0) {
                    bullets.push(fireAtTarget(this.x, this.y - 18, 18, 'juggernaut_shot', this.damage * 0.95, target));
                    playSound('shoot');
                }
                if (frames % 72 === 0) {
                    bullets.push(fireAtTarget(this.x - 10, this.y - 8, 8, 'player_missile', this.damage * 1.7, target));
                    bullets.push(fireAtTarget(this.x + 10, this.y - 8, 8, 'player_missile', this.damage * 1.7, target));
                    playSound('shoot');
                }
            }
        }
        if (this.iframes > 0) this.iframes--;
        particles.push(new Particle(this.x, this.y + 15, '#00ffff', 2, 4, 10));
    }
    draw() {
        if (!this.active && gameState !== STATE.VICTORY_SEQUENCE) return;
        if (this.iframes > 0 && Math.floor(frames / 4) % 2 === 0) return;
        
        const stats = getModeData(activeDifficultyMode);
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.shadowBlur = 20; ctx.shadowColor = SHIPS[stats.currentShip].color; 
        drawShipAsset(ctx, stats.currentShip, false);
        ctx.restore(); ctx.shadowBlur = 0;
    }
    hit(damage) {
        if (this.iframes > 0 || !this.active) return;
        const stats = getModeData(activeDifficultyMode);
        if (stats.currentShip === 3) {
            for(let i=0; i<8; i++) particles.push(new Particle(this.x, this.y, '#00ff88', 3, 3, 22));
        }
        damage *= this.damageTakenMult * (currentSettings.incomingDamageMult || 1);
        this.hp -= damage; this.iframes = 30;
        playerHpEl.innerText = Math.max(0, Math.floor(this.hp));
        ctx.translate((Math.random()-0.5)*10, (Math.random()-0.5)*10);
        setTimeout(() => ctx.setTransform(1,0,0,1,0,0), 50);
        if (this.hp <= 0) {
            playSound('playerDeath');
            this.active = false;
            for(let i=0; i<30; i++) particles.push(new Particle(this.x, this.y, '#00ffff', 5, 5, 60));
            gameOver(false);
        }
    }
}

class SwarmEnemy {
    constructor(x, y) {
        this.x = x; this.y = y; this.origX = x; this.origY = y;
        this.active = true; 
        this.hp = currentSettings.swarmHp + (currentLevelIndex * 3); 
        this.timeOffset = Math.random() * 100;
        this.fireTimer = (Math.random() * 120 + 60) * currentSettings.fireRateMult; 
        this.points = 100;
        this.angle = Math.PI / 2; 
    }
    update() {
        if (!this.active) return;
        this.x = this.origX + Math.sin((frames + this.timeOffset) * 0.05) * 50;
        this.y += 1.5;
        this.fireTimer--;
        
        let targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
        if (this.fireTimer <= 0) {
            this.angle = targetAngle; 
            bullets.push(new Bullet(this.x, this.y, Math.cos(this.angle)*4, Math.sin(this.angle)*4, 'boss_orb'));
            this.fireTimer = (120 + Math.random() * 60) * currentSettings.fireRateMult;
        } else if (this.fireTimer < 30) {
             let diff = targetAngle - this.angle;
             while (diff < -Math.PI) diff += Math.PI * 2;
             while (diff > Math.PI) diff -= Math.PI * 2;
             this.angle += diff * 0.1;
        } else {
             let diff = (Math.PI/2) - this.angle;
             while (diff < -Math.PI) diff += Math.PI * 2;
             while (diff > Math.PI) diff -= Math.PI * 2;
             this.angle += diff * 0.02;
        }

        if (this.y > height + 20) this.active = false;
    }
    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle - Math.PI/2);
        
        ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.shadowColor = '#ff00ff';
        
        let isBulky = currentLevelIndex >= 3;
        let isHeavy = currentLevelIndex >= 5;
        
        ctx.beginPath();
        if (isHeavy) {
            ctx.moveTo(0, 20); ctx.lineTo(15, -5); ctx.lineTo(15, -15);
            ctx.lineTo(5, -5); ctx.lineTo(0, -10); ctx.lineTo(-5, -5);
            ctx.lineTo(-15, -15); ctx.lineTo(-15, -5);
        } else if (isBulky) {
            ctx.moveTo(0, 18); ctx.lineTo(12, -5); ctx.lineTo(0, -10); ctx.lineTo(-12, -5);
        } else {
            ctx.moveTo(0, 15); ctx.lineTo(10, -10); ctx.lineTo(0, -5); ctx.lineTo(-10, -10);
        }
        ctx.closePath(); ctx.stroke();

        if (isHeavy) {
            ctx.fillStyle = `rgba(170, 0, 255, ${0.5 + Math.sin(frames*0.5)*0.5})`;
            ctx.beginPath(); ctx.arc(-8, -18, 4, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(8, -18, 4, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = `rgba(200, 0, 255, ${0.5 + Math.sin(frames*0.5)*0.5})`;
            ctx.beginPath(); ctx.arc(0, -12, 5, 0, Math.PI*2); ctx.fill();
        } else if (isBulky) {
            ctx.fillStyle = `rgba(170, 0, 255, ${0.5 + Math.sin(frames*0.2)*0.5})`;
            ctx.beginPath(); ctx.arc(-5, -12, 3, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(5, -12, 3, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = `rgba(170, 0, 255, ${0.5 + Math.sin(frames*0.2)*0.5})`;
            ctx.beginPath(); ctx.arc(0, -8, 2, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
    hit(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            playSound('explosion');
            this.active = false; score += this.points; scoreEl.innerText = score;
            for(let i=0; i<5; i++) particles.push(new Particle(this.x, this.y, '#ff00ff', 3, 3, 30));
            drops.push(new Drop(this.x, this.y, 'star'));
        }
    }
}

class HeavyStriker {
    constructor(x, y) {
        this.x = x; this.y = y; this.vx = (Math.random() < 0.5 ? -1 : 1) * 2;
        this.active = true; 
        this.hp = currentSettings.heavyHp;
        this.fireTimer = (Math.random() * 60 + 60) * currentSettings.fireRateMult;
        this.points = 300;
        this.angle = Math.PI / 2; 
    }
    update() {
        if(!this.active) return;
        this.y += 1.0; 
        if (currentSettings.heavyAgile) {
            this.x += this.vx;
            if (this.x < 50 || this.x > width - 50) this.vx *= -1;
        }
        this.fireTimer--;

        let targetAngle = Math.atan2(player.y - this.y, player.x - this.x);

        if(this.fireTimer <= 0) {
            this.angle = targetAngle;
            bullets.push(new Bullet(this.x, this.y, Math.cos(this.angle)*4, Math.sin(this.angle)*4, 'boss_orb'));
            bullets.push(new Bullet(this.x, this.y, Math.cos(this.angle-0.3)*4, Math.sin(this.angle-0.3)*4, 'boss_orb'));
            bullets.push(new Bullet(this.x, this.y, Math.cos(this.angle+0.3)*4, Math.sin(this.angle+0.3)*4, 'boss_orb'));
            this.fireTimer = 100 * currentSettings.fireRateMult; 
        } else if (this.fireTimer < 40) {
             let diff = targetAngle - this.angle;
             while (diff < -Math.PI) diff += Math.PI * 2;
             while (diff > Math.PI) diff -= Math.PI * 2;
             this.angle += diff * 0.05;
        }
        if(this.y > height + 50) this.active = false;
    }
    draw() {
        if(!this.active) return;
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle - Math.PI/2);
        ctx.shadowBlur = 15; ctx.shadowColor = '#ff4400';
        
        ctx.strokeStyle = '#882200'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.stroke();
        
        ctx.fillStyle = '#220000'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.arc(0, 0, 8 + Math.sin(frames*0.1)*2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = '#555';
        ctx.fillRect(-12, 18, 6, 8); ctx.fillRect(6, 18, 6, 8); ctx.fillRect(-3, 20, 6, 10);
        
        ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 14, Math.PI*0.8, Math.PI*2.2); ctx.stroke(); 
        ctx.restore();
    }
    hit(damage) {
        this.hp -= damage;
        if(this.hp <= 0) {
            playSound('explosion');
            this.active = false; score += this.points; scoreEl.innerText = score;
            for(let i=0; i<10; i++) particles.push(new Particle(this.x, this.y, '#00aaaa', 4, 5, 40));
            drops.push(new Drop(this.x, this.y, 'health'));
        }
    }
}

class Boss {
    constructor() {
        this.x = width / 2; this.y = -100; this.targetY = 150;
        this.maxHp = currentSettings.bossHp;
        this.hp = this.maxHp;
        this.active = false; 
        this.flashTimer = 0;
        this.sequenceIndex = 0; this.phase = 'entry';
        this.currentAttack = 'idle'; this.attackTimer = 0;
        this.laserCharge = 0; this.laserActive = false; this.redLines = [];
        this.isPhaseTwo = false; 
        this.spawnRate = 90 * currentSettings.fireRateMult;
        this.damageMultiplier = 1; 
        this.laserAngle = Math.PI / 2;
        this.isDesperationMode = false;
        this.isTerminator = false; 
        this.isGlitch = false; 
        this.isSnake = false; 
        this.isHiveMother = false; 
        this.isSyntaxError = false; 
        this.isNullEntity = false; 
        this.isOblivion = false; 
        this.isArchitect = false;
        this.isNeonVoid = false;
        this.isRiftSentinel = false;
        this.isPortalPrototype = false;
        this.isAstralTrio = false;
        this.isMimic = false;
        this.isCurseZero = false;
        this.mimicTimer = 0;
        this.mimicForm = 'omega';
        this.curseShotTimer = 0;
        this.curseParticles = [];
        this.snakePath = []; 
        this.clones = []; 
        this.targetX = width / 2; 
        this.shredderMode = false; 
        this.sawRingTimer = 0; 
        this.hiveSummonCounter = 0;
        this.miniHives = [];
        this.shieldHp = 0;
        this.maxShieldHp = 2000;
        this.syntaxVy = 0; 
        this.rot = 0;
        this.spikeWarnings = false;
        this.spikesActive = false;
        this.voidParticles = [];
        this.voidLines = [];
        this.voidGlitchTimer = 0;
        this.laserNearMissOffset = null;
        this.portalCooldown = 0;
        this.portalLaser = null;
        this.astralStars = [];
        this.astralCoreAwake = false;
        this.astralLaserAngles = [];
    }

    clearBossIdentityFlags() {
        this.isPhaseTwo = false; this.isTerminator = false; this.isGlitch = false; this.isSnake = false; this.isHiveMother = false;
        this.isSyntaxError = false; this.isNullEntity = false; this.isOblivion = false; this.isArchitect = false; this.isNeonVoid = false;
        this.isRiftSentinel = false; this.isPortalPrototype = false; this.isAstralTrio = false; this.isCurseZero = false;
    }

    initAsStage2() {
        this.isPhaseTwo = false; this.isTerminator = true; this.isGlitch = false; this.isSnake = false; this.isHiveMother = false; this.isSyntaxError = false; this.isNullEntity = false; this.isOblivion = false; this.isArchitect = false; this.isNeonVoid = false;
        this.damageMultiplier = 1.5; this.maxHp = (isHardMode()) ? 9000 : 4500; this.hp = this.maxHp;
        bossName.innerText = isHardMode() ? "TERMINATOR [ELITE]" : "TERMINATOR"; bossName.style.color = "#ff0000";
    }
    initAsStage3() {
        this.isPhaseTwo = false; this.isTerminator = false; this.isGlitch = true; this.isSnake = false; this.isHiveMother = false; this.isSyntaxError = false; this.isNullEntity = false; this.isOblivion = false; this.isArchitect = false; this.isNeonVoid = false;
        this.damageMultiplier = 2.0; this.maxHp = 4000; this.hp = this.maxHp;
        bossName.innerText = "PHANTOM PROTOCOL"; bossName.style.color = "#ff00ff";
    }
    initAsStage4() {
        this.isPhaseTwo = false; this.isTerminator = false; this.isGlitch = false; this.isSnake = true; this.isHiveMother = false; this.isSyntaxError = false; this.isNullEntity = false; this.isOblivion = false; this.isArchitect = false; this.isNeonVoid = false;
        if (isHardMode()) { this.damageMultiplier = 2.0; this.maxHp = 6000; bossName.innerText = "THE CRIMSON SERPENT"; bossName.style.color = "#ff0000"; } 
        else { this.damageMultiplier = 1.2; this.maxHp = 2500; bossName.innerText = "THE CYBER SERPENT"; bossName.style.color = "#00ff00"; }
        this.hp = this.maxHp; this.snakePath = []; for(let i=0; i<300; i++) this.snakePath.push({x: width/2, y: -100});
    }
    initAsStage5() {
        this.isPhaseTwo = false; this.isTerminator = false; this.isGlitch = false; this.isSnake = false; this.isHiveMother = true; this.isSyntaxError = false; this.isNullEntity = false; this.isOblivion = false; this.isArchitect = false; this.isNeonVoid = false;
        this.damageMultiplier = 1.0; this.maxHp = 6000; this.hp = this.maxHp;
        bossName.innerText = "THE HIVE MOTHER"; bossName.style.color = "#9900ff";
    }
    initAsStage6() {
        this.isPhaseTwo = false; this.isTerminator = false; this.isGlitch = false; this.isSnake = false; this.isHiveMother = false; this.isSyntaxError = true; this.isNullEntity = false; this.isOblivion = false; this.isArchitect = false; this.isNeonVoid = false;
        this.damageMultiplier = 2.0; this.maxHp = 8000; this.hp = this.maxHp;
        bossName.innerText = "THE SYNTAX ERROR"; bossName.style.color = "#aaff00";
        this.targetY = 150;
    }
    initAsStage7() {
        this.isPhaseTwo = false; this.isTerminator = false; this.isGlitch = false; this.isSnake = false; this.isHiveMother = false; this.isSyntaxError = false; this.isNullEntity = true; this.isOblivion = false; this.isArchitect = false; this.isNeonVoid = false;
        this.damageMultiplier = 3.0; this.maxHp = 10000; this.hp = this.maxHp;
        bossName.innerText = "THE NULL ENTITY"; bossName.style.color = "#6600ff";
        this.targetY = 150;
    }
    initAsStage8() {
        this.isPhaseTwo = false; this.isTerminator = false; this.isGlitch = false; this.isSnake = false; this.isHiveMother = false; this.isSyntaxError = false; this.isNullEntity = false; this.isOblivion = true; this.isArchitect = false; this.isNeonVoid = false;
        this.damageMultiplier = 3.5; this.maxHp = 15000; this.hp = this.maxHp;
        bossName.innerText = "THE OBLIVION ENGINE"; bossName.style.color = "#ff0055";
        this.targetY = 180; this.rot = 0;
    }
    initAsStage9() {
        this.isPhaseTwo = false; this.isTerminator = false; this.isGlitch = false; this.isSnake = false; this.isHiveMother = false; this.isSyntaxError = false; this.isNullEntity = false; this.isOblivion = false; this.isArchitect = true; this.isNeonVoid = false;
        this.damageMultiplier = 4.0; this.maxHp = 20000; this.hp = this.maxHp;
        bossName.innerText = "THE ARCHITECT"; bossName.style.color = "#ffd700";
        this.targetY = 200; this.rot = 0;
        this.spikeWarnings = false; this.spikesActive = false;
    }
    initAsStage10() {
        this.isPhaseTwo = false; this.isTerminator = false; this.isGlitch = false; this.isSnake = false; this.isHiveMother = false; this.isSyntaxError = false; this.isNullEntity = false; this.isOblivion = false; this.isArchitect = false; this.isNeonVoid = true;
        setArenaScale(2);
        this.damageMultiplier = isHardMode() ? 6.0 : 4.5;
        this.maxHp = isHardMode() ? 36000 : 26000; this.hp = this.maxHp;
        this.x = width / 2; this.y = -180; this.targetY = height * 0.22; this.rot = 0;
        this.shieldHp = 4000; this.maxShieldHp = 4000;
        this.voidParticles = [];
        this.voidLines = [];
        this.voidGlitchTimer = 0;
        for(let i=0; i<90; i++) {
            this.voidParticles.push({
                angle: Math.random() * Math.PI * 2,
                radius: 185 + Math.random() * 320,
                speed: 0.004 + Math.random() * 0.018,
                size: 2 + Math.random() * 7,
                drift: Math.random() * Math.PI * 2,
                color: Math.random() > 0.35 ? '#b000ff' : '#3a003f'
            });
        }
        for(let i=0; i<18; i++) {
            this.voidLines.push({
                angle: Math.random() * Math.PI * 2,
                radius: 190 + Math.random() * 230,
                length: 70 + Math.random() * 150,
                speed: 0.006 + Math.random() * 0.015,
                alpha: 0.25 + Math.random() * 0.5
            });
        }
        bossShieldContainer.style.display = "block"; bossShieldBar.style.width = "100%";
        bossName.innerText = "THE NEON VOID PROTOTYPE"; bossName.style.color = "#00ffff";
        waveText.innerText = "ARENA EXPANDED x2"; waveText.style.color = "#00ffff"; waveText.style.opacity = 1; waveText.style.transform = "scale(1)";
        setTimeout(() => { waveText.style.opacity = 0; }, 1800);
        flashOverlay.style.transition = 'none'; flashOverlay.style.opacity = 1; void flashOverlay.offsetWidth;
        flashOverlay.style.transition = 'opacity 2.5s ease-out'; flashOverlay.style.opacity = 0;
    }
    initAsStage11() {
        this.isPhaseTwo = false; this.isTerminator = false; this.isGlitch = false; this.isSnake = false; this.isHiveMother = false; this.isSyntaxError = false; this.isNullEntity = false; this.isOblivion = false; this.isArchitect = false; this.isNeonVoid = false; this.isRiftSentinel = true;
        this.damageMultiplier = isHardMode() ? 5.2 : 3.8;
        this.maxHp = isHardMode() ? 34000 : 24000; this.hp = this.maxHp;
        this.x = width / 2; this.y = -160; this.targetY = 170; this.rot = 0;
        this.shieldHp = isHardMode() ? 3000 : 2200;
        this.maxShieldHp = this.shieldHp;
        bossShieldContainer.style.display = "block"; bossShieldBar.style.width = "100%";
        bossName.innerText = "THE RIFT SENTINEL"; bossName.style.color = "#55ddff";
    }
    initAsStage12() {
        this.isPhaseTwo = false; this.isTerminator = false; this.isGlitch = false; this.isSnake = false; this.isHiveMother = false; this.isSyntaxError = false; this.isNullEntity = false; this.isOblivion = false; this.isArchitect = false; this.isNeonVoid = false; this.isRiftSentinel = false; this.isPortalPrototype = true;
        this.damageMultiplier = isHardMode() ? 5.8 : 4.2;
        this.maxHp = isHardMode() ? 39000 : 28000; this.hp = this.maxHp;
        this.x = width / 2; this.y = -170; this.targetY = 175; this.rot = 0;
        this.shieldHp = isHardMode() ? 3600 : 2600;
        this.maxShieldHp = this.shieldHp;
        this.portalLaser = null; this.portalCooldown = 0;
        createPortalField(5);
        bossShieldContainer.style.display = "block"; bossShieldBar.style.width = "100%";
        bossName.innerText = "THE PORTAL PROTOTYPE"; bossName.style.color = "#ff66ff";
        waveText.innerText = "PORTALS ACTIVE"; waveText.style.color = "#ff66ff"; waveText.style.opacity = 1; waveText.style.transform = "scale(1)";
        setTimeout(() => { waveText.style.opacity = 0; }, 1500);
    }
    initAsStage13() {
        this.isPhaseTwo = false; this.isTerminator = false; this.isGlitch = false; this.isSnake = false; this.isHiveMother = false; this.isSyntaxError = false; this.isNullEntity = false; this.isOblivion = false; this.isArchitect = false; this.isNeonVoid = false; this.isRiftSentinel = false; this.isPortalPrototype = false; this.isAstralTrio = true;
        this.damageMultiplier = isHardMode() ? 6.2 : 4.6;
        this.maxHp = isHardMode() ? 36000 : 26000; this.hp = this.maxHp;
        this.x = width / 2; this.y = -170; this.targetY = 185; this.rot = 0;
        this.astralCoreAwake = false;
        this.astralLaserAngles = [];
        const outerHp = isHardMode() ? 9000 : 6500;
        this.astralStars = [
            { name: 'red', color: '#ff3333', hp: outerHp, maxHp: outerHp, angle: 0, radius: 180, active: true },
            { name: 'blue', color: '#33aaff', hp: outerHp, maxHp: outerHp, angle: Math.PI, radius: 180, active: true }
        ];
        this.shieldHp = 1; this.maxShieldHp = 1;
        bossShieldContainer.style.display = "block"; bossShieldBar.style.width = "100%";
        bossName.innerText = "THE ASTRAL TRIO"; bossName.style.color = "#cc99ff";
    }

    initAsStage14() {
        this.clearBossIdentityFlags();
        this.isMimic = true;
        this.damageMultiplier = isHardMode() ? 5.4 : 4.0;
        this.maxHp = isHardMode() ? 42000 : 30000; this.hp = this.maxHp;
        this.x = width / 2; this.y = -170; this.targetY = 170; this.rot = 0;
        this.mimicTimer = 0; this.mimicForm = 'omega';
        this.chooseMimicForm();
        bossName.innerText = "THE MIMIC"; bossName.style.color = "#ffffff";
    }

    initAsStage15() {
        this.clearBossIdentityFlags();
        this.isCurseZero = true;
        this.damageMultiplier = isHardMode() ? 7.0 : 5.0;
        this.maxHp = isHardMode() ? 46000 : 33000; this.hp = this.maxHp;
        this.x = width / 2; this.y = -170; this.targetY = 175; this.rot = 0;
        this.curseParticles = [];
        this.curseShotTimer = 0;
        for(let i=0; i<70; i++) this.curseParticles.push({ angle: Math.random()*Math.PI*2, radius: 70 + Math.random()*100, speed: 0.008 + Math.random()*0.025, size: 2 + Math.random()*5 });
        bossName.innerText = "CURSE 0"; bossName.style.color = "#33aaff";
    }

    chooseMimicForm() {
        const forms = ['omega', 'terminator', 'glitch', 'snake', 'hive'];
        this.mimicForm = forms[Math.floor(Math.random() * forms.length)];
        this.isTerminator = this.mimicForm === 'terminator';
        this.isGlitch = this.mimicForm === 'glitch';
        this.isSnake = this.mimicForm === 'snake';
        this.isHiveMother = this.mimicForm === 'hive';
        this.isPhaseTwo = false;
        this.shredderMode = false;
        this.hiveSummonCounter = 0;
        this.miniHives = [];
        if (this.isSnake) { this.snakePath = []; for(let i=0; i<300; i++) this.snakePath.push({x: this.x, y: this.y}); }
        this.sequenceIndex = 0;
        this.startNextAttack();
        waveText.innerText = "MIMIC: " + this.mimicForm.toUpperCase();
        waveText.style.color = "#ffffff"; waveText.style.opacity = 1; waveText.style.transform = "scale(0.85)";
        setTimeout(() => { if (waveText.innerText.startsWith("MIMIC:")) waveText.style.opacity = 0; }, 900);
    }

    fireTerminationZero() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*2.4, Math.sin(angle)*2.4, 'termination_zero'));
        waveText.innerText = "TERMINATION 0";
        waveText.style.color = "#33aaff"; waveText.style.opacity = 1; waveText.style.transform = "scale(0.85)";
        setTimeout(() => { if (waveText.innerText === "TERMINATION 0") waveText.style.opacity = 0; }, 800);
    }

    activate() { this.active = true; bossHud.style.opacity = 1; }

    getImperfectLaserAngle(missDistance) {
        if (this.laserNearMissOffset === null) {
            const side = ((this.sequenceIndex + currentWave + currentLevelIndex + (isHardMode() ? 1 : 0)) % 2 === 0) ? 1 : -1;
            this.laserNearMissOffset = side * (missDistance + Math.random() * 45);
        }
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const aimX = player.x + (-dy / len) * this.laserNearMissOffset;
        const aimY = player.y + (dx / len) * this.laserNearMissOffset;
        return Math.atan2(aimY - this.y, aimX - this.x);
    }

    update() {
        if (!this.active) return;
        if (this.flashTimer > 0) this.flashTimer--;

        if (this.phase === 'entry') {
            this.y += (this.targetY - this.y) * 0.05;
            if (this.isSnake) { this.snakePath.unshift({x: this.x, y: this.y}); if (this.snakePath.length > 300) this.snakePath.pop(); }
            if (Math.abs(this.y - this.targetY) < 1) { this.phase = 'fight'; this.startNextAttack(); }
            return;
        }

        if (this.isMimic) {
            this.mimicTimer++;
            if (this.mimicTimer >= 900) {
                this.mimicTimer = 0;
                this.chooseMimicForm();
            }
        }

        if (this.isCurseZero) {
            this.rot += 0.018;
            this.x = width/2 + Math.sin(frames * 0.012) * 140;
            this.y = this.targetY + Math.cos(frames * 0.018) * 34;
            this.curseShotTimer++;
            if (this.curseShotTimer >= 300) {
                this.curseShotTimer = 0;
                this.fireTerminationZero();
            }
            this.curseParticles.forEach(p => {
                p.angle += p.speed;
                if (Math.random() > 0.72) particles.push(new Particle(this.x + Math.cos(p.angle)*p.radius, this.y + Math.sin(p.angle)*p.radius, '#33aaff', 1, p.size, 16));
            });
        }
        else if (this.isOblivion) {
            this.rot += 0.01;
            if (this.currentAttack === 'oblivion_beam') {
                if (this.attackTimer < 60) this.laserActive = false;
                else if (this.attackTimer < 200) {
                    this.laserActive = true;
                    // Sweep logic via rotation (Slowed Down)
                    this.rot += 0.015;
                    let hit = false;
                    for (let i = 0; i < 4; i++) {
                        let beamAngle = this.rot + (Math.PI/2) * i;
                        let dx = player.x - this.x; let dy = player.y - this.y;
                        let rx = dx * Math.cos(-beamAngle) - dy * Math.sin(-beamAngle);
                        if (Math.abs(rx) < 40 && dy * Math.sin(beamAngle) + dx * Math.cos(beamAngle) > 0) hit = true;
                    }
                    if (hit) player.hit(3 * this.damageMultiplier);
                } else {
                    this.laserActive = false;
                    if (this.attackTimer > 250) this.startNextAttack();
                }
            } else if (this.currentAttack === 'oblivion_pulse') {
                if (this.attackTimer % 50 === 0 && this.attackTimer < 200) {
                    let count = 20;
                    for (let i = 0; i < count; i++) {
                        let angle = (Math.PI*2/count)*i + this.rot;
                        bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*7, Math.sin(angle)*7, 'boss_orb'));
                    }
                }
                if (this.attackTimer > 250) this.startNextAttack();
            } else if (this.currentAttack === 'oblivion_chase') {
                this.x += (player.x - this.x) * 0.02;
                if (this.attackTimer % 60 === 0) {
                    enemies.push(new RammerEnemy(player.x, -50));
                }
                if (this.attackTimer > 300) this.startNextAttack();
            }
        }
        else if (this.isNullEntity) {
            this.x = width/2 + Math.sin(frames * 0.01) * 150;
            this.y = this.targetY + Math.cos(frames * 0.015) * 50;
            
            if (this.currentAttack === 'null_gravity') {
                if (player.active) {
                    let pullX = (this.x - player.x) * 0.015;
                    let pullY = (this.y - player.y) * 0.015;
                    player.x += pullX;
                    player.y += pullY;
                    // Sync mouse target so it doesn't fight the pull
                    mouse.targetX += pullX;
                    mouse.targetY += pullY;
                }
                if (this.attackTimer % 45 === 0) {
                    for (let i = 0; i < 12; i++) {
                        let angle = (Math.PI * 2 / 12) * i + frames * 0.1;
                        bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*5, Math.sin(angle)*5, 'boss_orb'));
                    }
                }
                if (this.attackTimer > 300) this.startNextAttack();
            }
            else if (this.currentAttack === 'null_lasers') {
                if (this.attackTimer % 90 === 0) {
                    let angle = Math.atan2(player.y - this.y, player.x - this.x);
                    bullets.push(new Bullet(this.x, this.y, Math.cos(angle), Math.sin(angle), 'glitch_missile'));
                    bullets.push(new Bullet(this.x, this.y, Math.cos(angle+0.5), Math.sin(angle+0.5), 'glitch_missile'));
                    bullets.push(new Bullet(this.x, this.y, Math.cos(angle-0.5), Math.sin(angle-0.5), 'glitch_missile'));
                }
                if (this.attackTimer > 250) this.startNextAttack();
            }
            else if (this.currentAttack === 'null_bombs') {
                if (this.attackTimer % 60 === 0) {
                    bullets.push(new Bullet(this.x + (Math.random()-0.5)*200, this.y + 100, 0, 0, 'mine'));
                }
                if (this.attackTimer > 240) this.startNextAttack();
            }
        }
        else if (this.isSyntaxError) {
            if (this.phase === 'fight' && frames % 110 === 0 && this.currentAttack !== 'syntax_falling') {
                bullets.push(new Bullet(this.x + (Math.random()-0.5)*60, this.y, (Math.random()-0.5)*4, 1, 'glitch_missile'));
            }

            if (this.currentAttack === 'syntax_loom') {
                this.x += (Math.random()-0.5)*10; this.x = Math.max(50, Math.min(width-50, this.x));
                this.y += (Math.random()-0.5)*10; this.y = Math.max(50, Math.min(height/2, this.y));
            } else if (this.currentAttack === 'syntax_triangle') {
                this.x += Math.sin(frames * 0.03) * 6; this.y += (150 - this.y) * 0.05; 
                if (this.laserActive) {
                    if (Math.abs(player.x - this.x) < 25 && player.y > this.y) player.hit(2 * this.damageMultiplier);
                    if (frames % 4 === 0) { ctx.translate(Math.random()*4-2, 0); setTimeout(()=>ctx.setTransform(1,0,0,1,0,0), 20); }
                }
            } else if (this.currentAttack === 'syntax_falling') {
                if (this.attackTimer === 1) this.syntaxVy = 12; 
                this.y += this.syntaxVy;
                if (player.active && Math.hypot(this.x - player.x, this.y - player.y) < 60) player.hit(25 * this.damageMultiplier);
                if (this.y > height + 100) { this.y = -100; this.startNextAttack(); }
            } else if (this.currentAttack === 'syntax_digits') {
                this.x += (width/2 - this.x) * 0.1; this.y += (100 - this.y) * 0.1;
            }
        }
        else if (this.isArchitect) {
            this.rot += 0.01;
            this.x += (width/2 - this.x) * 0.05;
            this.y += (this.targetY - this.y) * 0.05;
            
            if (this.currentAttack === 'arch_spikes') {
                if (this.attackTimer === 30) {
                    this.spikeWarnings = true;
                }
                if (this.attackTimer === 90) {
                    this.spikeWarnings = false; this.spikesActive = true; playSound('explosion');
                }
                if (this.spikesActive) {
                    if (player.x < 100 || player.x > width - 100 || player.y > height - 100) {
                        player.hit(3 * this.damageMultiplier);
                    }
                }
                if (this.attackTimer === 180) this.spikesActive = false;
                if (this.attackTimer > 220) this.startNextAttack();
            }
        }
        else if (this.isNeonVoid) {
            this.rot += 0.024;
            this.voidGlitchTimer++;
            const glitchSurge = this.voidGlitchTimer % 130 > 112 ? 1 : 0;
            this.x = width/2 + Math.sin(frames * 0.012) * (width * 0.24) + (Math.random() - 0.5) * glitchSurge * 42;
            this.y = this.targetY + Math.cos(frames * 0.017) * (height * 0.065) + (Math.random() - 0.5) * glitchSurge * 28;
            this.voidParticles.forEach(p => {
                p.angle += p.speed;
                p.drift += 0.03;
                p.radius += Math.sin(p.drift) * 0.9;
                if (p.radius < 160) p.radius = 410;
                if (p.radius > 540) p.radius = 200;
            });
            this.voidLines.forEach(l => {
                l.angle -= l.speed;
                l.radius += Math.sin(frames * 0.03 + l.angle) * 0.35;
            });

            if (this.currentAttack === 'void_implosion') {
                if (player.active) {
                    const pullX = (this.x - player.x) * 0.03;
                    const pullY = (this.y - player.y) * 0.03;
                    player.x += pullX; player.y += pullY;
                    mouse.targetX += pullX; mouse.targetY += pullY;
                }
                if (this.attackTimer % 24 === 0 && this.attackTimer < 260) {
                    for(let i=0; i<24; i++) {
                        const angle = (Math.PI * 2 / 24) * i + this.rot;
                        bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*9, Math.sin(angle)*9, 'purple_fireball'));
                    }
                }
                if (this.attackTimer > 330) this.startNextAttack();
            }
            if (this.currentAttack === 'void_worldbreak') {
                if (this.attackTimer % 16 === 0 && this.attackTimer < 250) {
                    bullets.push(new Bullet(Math.random() * width, -80, 0, 16 + Math.random() * 6, 'arch_hammer'));
                }
                if (this.attackTimer % 45 === 0 && this.attackTimer < 280) {
                    enemies.push(new RammerEnemy(player.x, -80));
                }
                if (this.attackTimer > 350) this.startNextAttack();
            }
        }
        else if (this.isRiftSentinel) {
            this.rot += 0.018;
            this.x = width/2 + Math.sin(frames * 0.014) * (width * 0.18);
            this.y = this.targetY + Math.cos(frames * 0.018) * 38;
            if (this.currentAttack === 'rift_orbit') {
                if (this.attackTimer % 42 === 0 && this.attackTimer < 260) {
                    const count = 18;
                    for(let i=0; i<count; i++) {
                        const angle = (Math.PI * 2 / count) * i + this.rot;
                        bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*6.5, Math.sin(angle)*6.5, 'boss_orb'));
                    }
                }
                if (this.attackTimer > 300) this.startNextAttack();
            }
        }
        else if (this.isPortalPrototype) {
            this.rot += 0.026;
            this.x = width/2 + Math.sin(frames * 0.011) * (width * 0.19);
            this.y = this.targetY + Math.cos(frames * 0.016) * 44;
            handlePortalTravel(this, 70, 'boss');
            if (portals.length < 4 && frames % 120 === 0) createPortalField(5);
        }
        else if (this.isAstralTrio) {
            this.rot += this.astralCoreAwake ? 0.032 : 0.018;
            this.x = width/2 + Math.sin(frames * 0.012) * (this.astralCoreAwake ? width * 0.12 : width * 0.06);
            this.y = this.targetY + Math.cos(frames * 0.017) * (this.astralCoreAwake ? 34 : 18);
            this.astralStars.forEach((star, index) => {
                if (!star.active) return;
                const dir = index === 0 ? 1 : -1;
                star.angle += dir * 0.026;
                star.x = this.x + Math.cos(star.angle) * star.radius;
                star.y = this.y + Math.sin(star.angle) * star.radius * 0.62;
            });
            if (!this.astralCoreAwake && this.astralStars.every(star => !star.active)) {
                this.astralCoreAwake = true;
                this.shieldHp = 0; this.maxShieldHp = 0;
                bossShieldContainer.style.display = "none";
                this.sequenceIndex = 0;
                this.startNextAttack();
                waveText.innerText = "CENTER STAR AWAKENED";
                waveText.style.color = "#cc99ff"; waveText.style.opacity = 1; waveText.style.transform = "scale(1)";
                setTimeout(() => { waveText.style.opacity = 0; }, 1600);
                for(let i=0; i<80; i++) particles.push(new Particle(this.x, this.y, i % 2 ? '#ff3333' : '#33aaff', 9, 6, 60));
            }
        }
        else if (this.isHiveMother) {
            this.y = this.targetY + Math.sin(frames * 0.02) * 20; this.x = width/2 + Math.cos(frames * 0.01) * 10;
            if (this.miniHives) {
                this.miniHives.forEach(h => {
                    if (!h.active) return;
                    h.y += Math.sin(frames * 0.05 + h.x) * 0.5; h.timer++;
                    if (h.timer % 240 === 0) {
                        for(let i=0; i<5; i++) {
                             const angle = (Math.PI*2/5)*i;
                             enemies.push(new SwarmEnemy(h.x + Math.cos(angle)*40, h.y + Math.sin(angle)*40));
                        }
                    }
                });
                this.miniHives = this.miniHives.filter(h => h.active);
            }
        }
        else if (this.isSnake) {
            const time = frames * 0.03; const ampX = (width / 2) - 100;
            let targetX = (width / 2) + Math.sin(time) * ampX;
            let targetY = player.y + Math.sin(time * 1.5) * 100; 
            if (this.currentAttack === 'snake_rush') { targetY = player.y + Math.sin(frames * 0.05) * 150; targetX = (width / 2) + Math.sin(frames * 0.04) * ampX; }
            this.x += (targetX - this.x) * 0.03; this.y += (targetY - this.y) * 0.04; 
            this.snakePath.unshift({x: this.x, y: this.y}); if (this.snakePath.length > 300) this.snakePath.pop();
        }
        else if (this.isTerminator) {
            if (!this.shredderMode && this.hp <= 1500) { this.shredderMode = true; this.triggerShredderMode(); }
            if (this.hp <= 750) {
                this.sawRingTimer++;
                if (this.sawRingTimer >= 120) {
                    this.sawRingTimer = 0;
                    for(let i=0; i<12; i++) bullets.push(new Bullet(this.x, this.y, Math.cos((Math.PI*2/12) * i)*6, Math.sin((Math.PI*2/12) * i)*6, 'saw'));
                    waveText.innerText = "SAW RING DETECTED"; waveText.style.opacity = 1; waveText.style.transform = "scale(0.8)";
                    setTimeout(() => { waveText.style.opacity = 0; }, 1000);
                }
            }
            if (this.shredderMode && frames % 60 === 0) { bullets.push(new Bullet(this.x - 100, this.y, -5, 5, 'saw')); bullets.push(new Bullet(this.x + 100, this.y, 5, 5, 'saw')); }
            if (this.currentAttack !== 'terminator_laser') this.x = width/2 + Math.sin(frames * 0.03) * 150;
        } 
        else if (this.isGlitch) {
            if (this.phase === 'fight' && Math.random() < 0.005) { 
                for(let i=0; i<15; i++) particles.push(new Particle(this.x, this.y, '#00ffff', 4, 3, 20));
                this.x = 50 + Math.random() * (width - 100); this.y = 50 + Math.random() * (height / 2);
            }
        }
        else {
              if (!this.isPhaseTwo && this.hp < this.maxHp / 2) this.triggerPhaseTwo();
              if (!this.isDesperationMode && this.hp <= 1000 && this.isPhaseTwo) {
                this.isDesperationMode = true; for(let i=0; i<20; i++) particles.push(new Particle(this.x, this.y, '#ffffff', 5, 3, 20));
              }
              if (!(this.isDesperationMode && this.laserActive)) this.x = width/2 + Math.sin(frames * 0.02) * 100;
        }
        
        this.attackTimer++;
        if (!this.isTerminator && !this.isGlitch && !this.isSnake && !this.isHiveMother && !this.isSyntaxError && !this.isNullEntity && !this.isOblivion && !this.isArchitect && !this.isNeonVoid && !this.isRiftSentinel && !this.isPortalPrototype && !this.isAstralTrio && !this.isCurseZero && frames % Math.floor(this.spawnRate) === 0 && this.currentAttack !== 'laser' && this.phase === 'fight') {
              enemies.push(new SwarmEnemy(this.x - 40, this.y)); enemies.push(new SwarmEnemy(this.x + 40, this.y));
        }
        this.handleAttack();
    }

    triggerShredderMode() {
        waveText.innerText = "OPERATION SHREDDER"; waveText.style.color = "#ff0000"; waveText.style.opacity = 1; waveText.style.transform = "scale(1)";
        setTimeout(() => { waveText.style.opacity = 0; }, 2000);
        for(let i=0; i<50; i++) particles.push(new Particle(this.x, this.y, '#ff0000', 8, 5, 60));
    }
    triggerPhaseTwo() {
        this.isPhaseTwo = true; this.damageMultiplier = 2; this.spawnRate = 45 * currentSettings.fireRateMult;        
        for(let i=0; i<100; i++) particles.push(new Particle(this.x, this.y, '#ff3300', 10, 8, 80));
        bossName.innerText = "System Core: OMEGA UNLEASHED"; bossName.style.color = "#ffaa00"; isPhase2Active = true;
        this.shieldHp = 2000; bossShieldContainer.style.display = "block"; bossShieldBar.style.width = "100%";
        createShockwave(this.x, this.y);
        flashOverlay.style.transition = 'none'; flashOverlay.style.opacity = 1; void flashOverlay.offsetWidth;
        flashOverlay.style.transition = 'opacity 2s ease-out'; flashOverlay.style.opacity = 0;
    }

    startNextAttack() {
        let seq = ATTACK_SEQUENCE;
        if(this.isTerminator) seq = TERMINATOR_SEQUENCE;
        if(this.isGlitch) seq = GLITCH_SEQUENCE;
        if(this.isSnake) seq = SNAKE_SEQUENCE;
        if(this.isHiveMother) seq = HIVE_SEQUENCE;
        if(this.isSyntaxError) seq = SYNTAX_SEQUENCE;
        if(this.isNullEntity) seq = NULL_SEQUENCE;
        if(this.isOblivion) seq = OBLIVION_SEQUENCE;
        if(this.isArchitect) seq = ARCHITECT_SEQUENCE;
        if(this.isNeonVoid) seq = NEON_VOID_SEQUENCE;
        if(this.isRiftSentinel) seq = RIFT_SEQUENCE;
        if(this.isPortalPrototype) seq = PORTAL_SEQUENCE;
        if(this.isAstralTrio) seq = this.astralCoreAwake ? ASTRAL_CORE_SEQUENCE : ASTRAL_SEQUENCE;
        if(this.isCurseZero) seq = CURSE_SEQUENCE;
        
        if (this.sequenceIndex >= seq.length) this.sequenceIndex = 0;
        this.currentAttack = seq[this.sequenceIndex];
        this.attackTimer = 0; this.sequenceIndex++;
        
        let phaseName = this.currentAttack.toUpperCase();
        if(phaseName.startsWith("TERMINATOR_")) phaseName = phaseName.replace("TERMINATOR_", "");
        if(phaseName.startsWith("GLITCH_")) phaseName = phaseName.replace("GLITCH_", "");
        if(phaseName.startsWith("SNAKE_")) phaseName = phaseName.replace("SNAKE_", "");
        if(phaseName.startsWith("HIVE_")) phaseName = phaseName.replace("HIVE_", "");
        if(phaseName.startsWith("SYNTAX_")) phaseName = phaseName.replace("SYNTAX_", "");
        if(phaseName.startsWith("NULL_")) phaseName = phaseName.replace("NULL_", "");
        if(phaseName.startsWith("OBLIVION_")) phaseName = phaseName.replace("OBLIVION_", "");
        if(phaseName.startsWith("ARCH_")) phaseName = phaseName.replace("ARCH_", "");
        if(phaseName.startsWith("VOID_")) phaseName = phaseName.replace("VOID_", "");
        if(phaseName.startsWith("RIFT_")) phaseName = phaseName.replace("RIFT_", "");
        if(phaseName.startsWith("PORTAL_")) phaseName = phaseName.replace("PORTAL_", "");
        if(phaseName.startsWith("ASTRAL_")) phaseName = phaseName.replace("ASTRAL_", "");
        if(phaseName.startsWith("CURSE_")) phaseName = phaseName.replace("CURSE_", "");
        
        phaseDebug.innerText = `PHASE: ${phaseName}`;
        this.laserCharge = 0; this.laserActive = false; this.redLines = []; this.laserAngle = Math.PI / 2;
        this.lockTarget = false; this.clones = []; this.laserNearMissOffset = null; this.portalLaser = null; this.astralLaserAngles = [];
        this.spikeWarnings = false; this.spikesActive = false;
    }

    handleAttack() {
        switch(this.currentAttack) {
            case 'astral_orbit_fire':
                if (this.attackTimer % 42 === 0 && this.attackTimer < 260) {
                    this.astralStars.forEach(star => {
                        if (!star.active) return;
                        const angle = Math.atan2(player.y - star.y, player.x - star.x);
                        const type = star.name === 'red' ? 'fireball' : 'purple_fireball';
                        bullets.push(new Bullet(star.x, star.y, Math.cos(angle)*7, Math.sin(angle)*7, type));
                        bullets.push(new Bullet(star.x, star.y, Math.cos(angle+0.28)*6.2, Math.sin(angle+0.28)*6.2, type));
                        bullets.push(new Bullet(star.x, star.y, Math.cos(angle-0.28)*6.2, Math.sin(angle-0.28)*6.2, type));
                    });
                }
                if (this.attackTimer > 300) this.startNextAttack();
                break;
            case 'astral_outer_cross':
                if (this.attackTimer % 60 === 0 && this.attackTimer < 240) {
                    this.astralStars.forEach(star => {
                        if (!star.active) return;
                        for(let i=0; i<8; i++) {
                            const angle = (Math.PI * 2 / 8) * i + this.rot;
                            bullets.push(new Bullet(star.x, star.y, Math.cos(angle)*5.5, Math.sin(angle)*5.5, star.name === 'red' ? 'fireball' : 'purple_fireball'));
                        }
                    });
                }
                if (this.attackTimer > 280) this.startNextAttack();
                break;
            case 'astral_lasers':
                if (this.attackTimer === 1) {
                    this.astralLaserAngles = [Math.atan2(player.y - this.y, player.x - this.x), Math.atan2(player.y - this.y, player.x - this.x) + 0.45, Math.atan2(player.y - this.y, player.x - this.x) - 0.45];
                }
                if (this.attackTimer > 45 && this.attackTimer < 165) {
                    this.laserActive = true;
                    this.astralLaserAngles.forEach(angle => {
                        const dx = player.x - this.x; const dy = player.y - this.y;
                        const rx = dx * Math.cos(-angle) - dy * Math.sin(-angle);
                        const forward = dx * Math.cos(angle) + dy * Math.sin(angle);
                        if (Math.abs(rx) < 32 && forward > 0) player.hit(2.5 * this.damageMultiplier);
                    });
                } else this.laserActive = false;
                if (this.attackTimer > 210) this.startNextAttack();
                break;
            case 'astral_starfall':
                if (this.attackTimer % 10 === 0 && this.attackTimer < 230) {
                    bullets.push(new Bullet(Math.random() * width, -60, (Math.random()-0.5)*4, 11 + Math.random()*5, 'green_digit'));
                }
                if (this.attackTimer % 38 === 0 && this.attackTimer < 240) {
                    bullets.push(new Bullet(this.x + (Math.random()-0.5)*260, this.y, (Math.random()-0.5)*5, 8, 'fireball'));
                    bullets.push(new Bullet(this.x + (Math.random()-0.5)*260, this.y, (Math.random()-0.5)*5, 8, 'purple_fireball'));
                }
                if (this.attackTimer > 280) this.startNextAttack();
                break;
            case 'astral_rapid_fire':
                if (this.attackTimer % 8 === 0 && this.attackTimer < 210) {
                    const angle = Math.atan2(player.y - this.y, player.x - this.x) + (Math.random()-0.5)*0.55;
                    bullets.push(new Bullet(this.x - 28, this.y, Math.cos(angle)*8, Math.sin(angle)*8, 'fireball'));
                    bullets.push(new Bullet(this.x + 28, this.y, Math.cos(angle)*8, Math.sin(angle)*8, 'purple_fireball'));
                }
                if (this.attackTimer > 250) this.startNextAttack();
                break;
            case 'curse_termination':
                if (this.attackTimer % 300 === 1) {
                    this.fireTerminationZero();
                }
                if (this.attackTimer > 340) this.startNextAttack();
                break;
            case 'curse_ring':
                if (this.attackTimer % 35 === 0 && this.attackTimer < 240) {
                    for(let i=0; i<16; i++) {
                        const angle = (Math.PI*2/16)*i + this.rot;
                        bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*5.5, Math.sin(angle)*5.5, 'boss_orb'));
                    }
                }
                if (this.attackTimer % 150 === 1) {
                    const angle = Math.atan2(player.y - this.y, player.x - this.x);
                    bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*2.2, Math.sin(angle)*2.2, 'termination_zero'));
                }
                if (this.attackTimer > 280) this.startNextAttack();
                break;
            case 'curse_drift':
                if (this.attackTimer % 20 === 0 && this.attackTimer < 220) {
                    const x = Math.random() * width;
                    bullets.push(new Bullet(x, -30, (Math.random()-0.5)*2, 5, 'purple_fireball'));
                }
                if (this.attackTimer % 150 === 0) {
                    const angle = Math.atan2(player.y - this.y, player.x - this.x);
                    bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*2.5, Math.sin(angle)*2.5, 'termination_zero'));
                }
                if (this.attackTimer > 260) this.startNextAttack();
                break;
            case 'portal_laser':
                if (portals.length < 2) createPortalField(5);
                if (this.attackTimer === 1) {
                    const entryIndex = Math.floor(Math.random() * portals.length);
                    let exitIndex = Math.floor(Math.random() * portals.length);
                    if (exitIndex === entryIndex) exitIndex = (exitIndex + 1) % portals.length;
                    const exit = portals[exitIndex];
                    this.portalLaser = {
                        entryIndex,
                        exitIndex,
                        angle: Math.atan2(player.y - exit.y + (Math.random()-0.5)*140, player.x - exit.x + (Math.random()-0.5)*140)
                    };
                }
                if (this.attackTimer < 70) {
                    this.laserActive = false;
                    this.laserCharge = this.attackTimer / 70;
                } else if (this.attackTimer < 145) {
                    this.laserActive = true;
                    if (this.portalLaser && portals[this.portalLaser.exitIndex]) {
                        const exit = portals[this.portalLaser.exitIndex];
                        const dx = player.x - exit.x; const dy = player.y - exit.y;
                        const rx = dx * Math.cos(-this.portalLaser.angle) - dy * Math.sin(-this.portalLaser.angle);
                        const forward = dx * Math.cos(this.portalLaser.angle) + dy * Math.sin(this.portalLaser.angle);
                        if (Math.abs(rx) < 44 && forward > 0) player.hit(2.6 * this.damageMultiplier);
                    }
                } else {
                    this.laserActive = false;
                    if (this.attackTimer > 205) this.startNextAttack();
                }
                break;
            case 'portal_barrage':
                if (portals.length < 2) createPortalField(5);
                if (this.attackTimer === 45) {
                    for(let i=0; i<10; i++) {
                        const p = portals[i % portals.length];
                        const angle = Math.atan2(player.y - p.y, player.x - p.x) + (i - 4.5) * 0.13;
                        bullets.push(new Bullet(p.x, p.y, Math.cos(angle)*7.5, Math.sin(angle)*7.5, 'purple_fireball'));
                    }
                }
                if (this.attackTimer === 100) {
                    for(let i=0; i<10; i++) {
                        const angle = (Math.PI * 2 / 10) * i + this.rot;
                        bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*6.5, Math.sin(angle)*6.5, 'boss_orb'));
                    }
                }
                if (this.attackTimer > 170) this.startNextAttack();
                break;
            case 'portal_shift':
                if (portals.length < 2) createPortalField(5);
                if (this.attackTimer % 70 === 20 && this.attackTimer < 250) {
                    this.portalCooldown = 0;
                    const nearest = portals[Math.floor(Math.random() * portals.length)];
                    this.x = nearest.x; this.y = nearest.y;
                    handlePortalTravel(this, 120, 'boss');
                    for(let i=0; i<10; i++) {
                        const angle = (Math.PI * 2 / 10) * i;
                        bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*6, Math.sin(angle)*6, 'boss_orb'));
                    }
                }
                if (this.attackTimer > 300) this.startNextAttack();
                break;
            case 'rift_lance':
                if (this.attackTimer < 70) {
                    if (this.attackTimer === 1) this.laserNearMissOffset = null;
                    this.laserActive = false;
                    this.laserCharge = this.attackTimer / 70;
                    this.laserAngle = this.getImperfectLaserAngle(90);
                } else if (this.attackTimer < 135) {
                    this.laserActive = true;
                    let dx = player.x - this.x; let dy = player.y - this.y;
                    let rAngle = -this.laserAngle + Math.PI/2;
                    let rx = dx * Math.cos(rAngle) - dy * Math.sin(rAngle);
                    let ry = dx * Math.sin(rAngle) + dy * Math.cos(rAngle);
                    if (Math.abs(rx) < 28 && ry > 0) player.hit(2.2 * this.damageMultiplier);
                } else {
                    this.laserActive = false;
                    if (this.attackTimer > 185) this.startNextAttack();
                }
                break;
            case 'rift_orbit':
                break;
            case 'rift_crush':
                if (this.attackTimer === 35) {
                    const px = player.x + (Math.random() - 0.5) * 120;
                    const py = player.y + (Math.random() - 0.5) * 80;
                    bullets.push(new Bullet(px, py - 240, 0, 6, 'arch_wall_h'));
                    bullets.push(new Bullet(px, py + 240, 0, -6, 'arch_wall_h'));
                    bullets.push(new Bullet(px - 240, py, 6, 0, 'arch_wall_v'));
                    bullets.push(new Bullet(px + 240, py, -6, 0, 'arch_wall_v'));
                }
                if (this.attackTimer % 55 === 0 && this.attackTimer < 230) {
                    bullets.push(new Bullet(this.x + (Math.random()-0.5)*220, this.y + 60, 0, 7, 'green_digit'));
                }
                if (this.attackTimer > 310) this.startNextAttack();
                break;
            case 'rift_sawline':
                if (this.attackTimer % 28 === 0 && this.attackTimer < 220) {
                    const y = 120 + Math.random() * (height - 240);
                    bullets.push(new Bullet(-70, y, 12, 0, 'saw'));
                    bullets.push(new Bullet(width + 70, y + 48, -12, 0, 'saw'));
                }
                if (this.attackTimer % 70 === 0 && this.attackTimer < 240) {
                    enemies.push(new PhaserEnemy(Math.random() * width, -80));
                }
                if (this.attackTimer > 280) this.startNextAttack();
                break;
            case 'void_starfall':
                if (this.attackTimer % 8 === 0 && this.attackTimer < 220) {
                    bullets.push(new Bullet(Math.random() * width, -40, (Math.random()-0.5)*3, 12 + Math.random()*5, 'green_digit'));
                    if (this.attackTimer % 24 === 0) bullets.push(new Bullet(Math.random() * width, -60, 0, 8, 'fireball'));
                }
                if (this.attackTimer > 260) this.startNextAttack();
                break;
            case 'void_crossfire':
                if (this.attackTimer % 35 === 0 && this.attackTimer < 220) {
                    const y = 140 + Math.random() * (height - 260);
                    bullets.push(new Bullet(-80, y, 14, 0, 'spine_laser'));
                    bullets.push(new Bullet(width + 80, y + 70, -14, 0, 'spine_laser'));
                }
                if (this.attackTimer % 70 === 0 && this.attackTimer < 240) {
                    bullets.push(new Bullet(this.x, this.y, Math.cos(this.rot)*2, Math.sin(this.rot)*2, 'glitch_missile'));
                }
                if (this.attackTimer > 280) this.startNextAttack();
                break;
            case 'void_implosion':
            case 'void_worldbreak':
                break;
            case 'void_mirror':
                if (this.attackTimer % 45 === 0 && this.attackTimer < 240) {
                    const mirroredX = width - player.x;
                    enemies.push(new PhaserEnemy(mirroredX, -80));
                    bullets.push(new Bullet(mirroredX, this.y, 0, 9, 'purple_fireball'));
                }
                if (this.attackTimer % 90 === 0 && this.attackTimer < 260) {
                    enemies.push(new SpinnerEnemy(width * 0.25, -150));
                    enemies.push(new SpinnerEnemy(width * 0.75, -150));
                }
                if (this.attackTimer > 300) this.startNextAttack();
                break;
            case 'arch_walls':
                if (this.attackTimer === 30) {
                    let px = player.x, py = player.y;
                    bullets.push(new Bullet(px, py - 200, 0, 5, 'arch_wall_h'));
                    bullets.push(new Bullet(px, py + 200, 0, -5, 'arch_wall_h'));
                    bullets.push(new Bullet(px - 200, py, 5, 0, 'arch_wall_v'));
                    bullets.push(new Bullet(px + 200, py, -5, 0, 'arch_wall_v'));
                }
                if (this.attackTimer > 350) this.startNextAttack();
                break;
            case 'arch_lasers':
                if (this.attackTimer < 180) {
                    let cycle = this.attackTimer % 90;
                    if (cycle < 40) {
                        if (cycle <= 1) this.laserNearMissOffset = null;
                        this.laserActive = false;
                        this.laserCharge = cycle / 40;
                        this.laserAngle = this.getImperfectLaserAngle(75); 
                    } else if (cycle < 70) {
                        this.laserActive = true;
                        let dx = player.x - this.x; let dy = player.y - this.y;
                        let rAngle = -this.laserAngle + Math.PI/2;
                        let rx = dx * Math.cos(rAngle) - dy * Math.sin(rAngle);
                        let ry = dx * Math.sin(rAngle) + dy * Math.cos(rAngle);
                        if (Math.abs(rx) < 25 && ry > 0) player.hit(2 * this.damageMultiplier);
                        if (frames % 4 === 0) { ctx.translate(Math.random()*4-2, 0); setTimeout(()=>ctx.setTransform(1,0,0,1,0,0), 20); }
                    } else {
                        this.laserActive = false;
                    }
                } else {
                    this.laserActive = false;
                    if (this.attackTimer > 200) this.startNextAttack();
                }
                break;
            case 'arch_hammers':
                if (this.attackTimer % 60 === 0 && this.attackTimer < 200) {
                    bullets.push(new Bullet(player.x, -100, 0, 15, 'arch_hammer'));
                }
                if (this.attackTimer > 250) this.startNextAttack();
                break;
            case 'arch_spikes':
                // Handled mostly in update()
                break;
            case 'oblivion_pulse':
            case 'oblivion_beam':
            case 'oblivion_chase':
                // Handled heavily in update()
                break;
            case 'syntax_loom':
                if(this.attackTimer > 200) this.startNextAttack();
                break;
            case 'syntax_triangle':
                if (this.attackTimer < 60) this.laserActive = false;
                else if (this.attackTimer < 250) this.laserActive = true;
                else { this.laserActive = false; if(this.attackTimer > 300) this.startNextAttack(); }
                break;
            case 'syntax_falling':
                break;
            case 'syntax_digits':
                if (this.attackTimer === 1) { this.x = width / 2; this.y = 100; }
                if (this.attackTimer === 60) {
                    for(let i=0; i<15; i++) {
                        let bx = this.x + (Math.random()-0.5)*150; let by = this.y + (Math.random()-0.5)*150;
                        bullets.push(new Bullet(bx, by, 0, 5 + Math.random()*3, 'green_digit'));
                    }
                }
                if (this.attackTimer > 150) this.startNextAttack();
                break;
            case 'hive_summon':
                if (this.attackTimer % 300 === 0) {
                     if (this.hiveSummonCounter < 2) {
                         for(let i=0; i<15; i++) {
                             const angle = (Math.PI * 2 / 15) * i;
                             const ex = this.x + Math.cos(angle) * 100; const ey = this.y + Math.sin(angle) * 100;
                             enemies.push(new SwarmEnemy(ex, ey));
                             for(let j=0; j<5; j++) particles.push(new Particle(ex, ey, '#9900ff', 2, 2, 15));
                         }
                         this.hiveSummonCounter++;
                     } else {
                         let spawnedCount = 0;
                         const spawnOffsets = [ {dx: -200, dy: 50}, {dx: 200, dy: 50}, {dx: -280, dy: 120}, {dx: 280, dy: 120} ];
                         for (let offset of spawnOffsets) {
                             if (spawnedCount >= 2) break; 
                             let targetX = this.x + offset.dx; let targetY = this.y + offset.dy;
                             let isOccupied = false;
                             if (this.miniHives) isOccupied = this.miniHives.some(h => h.active && Math.hypot(h.x - targetX, h.y - targetY) < 100);
                             if (!isOccupied) {
                                 this.miniHives.push({ x: targetX, y: targetY, hp: 500, maxHp: 500, active: true, timer: 0 });
                                 spawnedCount++;
                             }
                         }
                         if (spawnedCount > 0) for(let j=0; j<20; j++) particles.push(new Particle(this.x, this.y, '#ffffff', 4, 4, 30));
                         this.hiveSummonCounter = 0;
                     }
                }
                if (this.attackTimer > 1000) this.startNextAttack();
                break;
            case 'snake_sine_fire':
                if (this.attackTimer % 45 === 0 && this.attackTimer < 200) { 
                    let angle = Math.atan2(player.y - this.y, player.x - this.x);
                    bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*6, Math.sin(angle)*6, 'venom'));
                    bullets.push(new Bullet(this.x, this.y, Math.cos(angle - 0.3)*6, Math.sin(angle - 0.3)*6, 'venom'));
                    bullets.push(new Bullet(this.x, this.y, Math.cos(angle + 0.3)*6, Math.sin(angle + 0.3)*6, 'venom'));
                }
                if (this.attackTimer > 250) this.startNextAttack();
                break;
            case 'snake_orb_deploy':
                if (this.attackTimer === 20) {
                    if (this.snakePath.length > 60) {
                        let p1 = this.snakePath[30]; let p2 = this.snakePath[60];
                        bullets.push(new Bullet(p1.x, p1.y, -4, 0.5, 'snake_orb_turret'));
                        bullets.push(new Bullet(p2.x, p2.y, 4, 0.5, 'snake_orb_turret'));
                    }
                }
                if (this.attackTimer > 100) this.startNextAttack();
                break;
            case 'snake_segment_laser':
                if (this.attackTimer % 50 === 0 && this.attackTimer < 240) { 
                    [10, 20, 30].forEach(idx => {
                        let pathIdx = idx * 2; 
                        if (pathIdx < this.snakePath.length) {
                            bullets.push(new Bullet(this.snakePath[pathIdx].x, this.snakePath[pathIdx].y, -6, 0, 'spine_laser'));
                            bullets.push(new Bullet(this.snakePath[pathIdx].x, this.snakePath[pathIdx].y, 6, 0, 'spine_laser'));
                        }
                    });
                }
                if (this.attackTimer > 260) this.startNextAttack();
                break;
            case 'snake_rush':
                if (this.attackTimer % 20 === 0) bullets.push(new Bullet(this.x, this.y, 0, 8, 'venom'));
                if (this.attackTimer > 200) this.startNextAttack();
                break;
            case 'glitch_teleport_rapid':
                if (this.attackTimer % 40 === 0 && this.attackTimer < 200) {
                    for(let i=0; i<10; i++) particles.push(new Particle(this.x, this.y, '#ff00ff', 4, 3, 20));
                    this.x = 50 + Math.random() * (width - 100); this.y = 50 + Math.random() * (height/2);
                    let angle = Math.atan2(player.y - this.y, player.x - this.x);
                    bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*8, Math.sin(angle)*8, 'boss_orb'));
                }
                if (this.attackTimer > 240) this.startNextAttack();
                break;
            case 'glitch_grid':
                if (this.attackTimer === 30) {
                    for(let i=0; i<5; i++) bullets.push(new Bullet(100 + i * (width/5), 0, 0, 0, 'glitch_laser'));
                    for(let i=0; i<3; i++) bullets.push(new Bullet(0, 100 + i * 150, 1, 0, 'glitch_laser'));
                }
                if (this.attackTimer > 150) this.startNextAttack();
                break;
            case 'glitch_clones':
                if (this.attackTimer === 10) {
                    this.clones = []; 
                    for(let i=0; i<2; i++) this.clones.push({x: 50 + Math.random() * (width - 100), y: 50 + Math.random() * (height / 2 + 100)});
                }
                if (this.attackTimer > 40 && this.attackTimer % 30 === 0 && this.attackTimer < 200) {
                    let angle = Math.atan2(player.y - this.y, player.x - this.x);
                    for(let i=-2; i<=2; i++) bullets.push(new Bullet(this.x, this.y, Math.cos(angle + i*0.2)*5, Math.sin(angle + i*0.2)*5, 'boss_orb'));
                    this.clones.forEach(c => {
                        let cAngle = Math.atan2(player.y - c.y, player.x - c.x);
                        bullets.push(new Bullet(c.x, c.y, Math.cos(cAngle)*5, Math.sin(cAngle)*5, 'boss_orb'));
                    });
                }
                if (this.attackTimer > 250) this.startNextAttack();
                break;
            case 'glitch_teleport_fire':
                 if(this.attackTimer === 1) { this.x = width/2; this.y = 100; }
                 if(this.attackTimer % 20 === 0 && this.attackTimer < 200) {
                     for(let i=0; i<12; i++) bullets.push(new Bullet(this.x, this.y, Math.cos((Math.PI*2/12)*i + this.attackTimer*0.1)*6, Math.sin((Math.PI*2/12)*i + this.attackTimer*0.1)*6, 'boss_orb'));
                 }
                 if(this.attackTimer > 250) this.startNextAttack();
                 break;
            case 'terminator_fireballs':
                if (this.attackTimer % 40 === 0 && this.attackTimer < 200) {
                    let angle = Math.atan2(player.y - this.y, player.x - this.x);
                    bullets.push(new Bullet(this.x - 60, this.y, Math.cos(angle)*6, Math.sin(angle)*6, 'fireball'));
                    bullets.push(new Bullet(this.x + 60, this.y, Math.cos(angle)*6, Math.sin(angle)*6, 'fireball'));
                }
                if (this.attackTimer > 250) this.startNextAttack();
                break;
            case 'terminator_rapid':
                 if (this.attackTimer % 10 === 0 && this.attackTimer < 150) bullets.push(new Bullet(this.x, this.y + 40, (Math.random()-0.5)*2, 8, 'fireball'));
                 if (this.attackTimer > 200) this.startNextAttack();
                 break;
            case 'terminator_laser':
                if (this.attackTimer < 60) {
                    if (this.attackTimer === 1) this.laserNearMissOffset = null;
                    this.laserCharge = this.attackTimer / 60;
                    this.laserAngle = this.getImperfectLaserAngle(80); 
                } else if (this.attackTimer === 60) this.lockTarget = true; 
                else if (this.attackTimer < 160) {
                    this.laserActive = true;
                    let dx = player.x - this.x; let dy = player.y - this.y;
                    let rAngle = -this.laserAngle + Math.PI/2;
                    let rx = dx * Math.cos(rAngle) - dy * Math.sin(rAngle);
                    let ry = dx * Math.sin(rAngle) + dy * Math.cos(rAngle);
                    if (Math.abs(rx) < 30 && ry > 0) player.hit(2);
                } else {
                    this.laserActive = false; this.lockTarget = false;
                    if (this.attackTimer > 200) this.startNextAttack();
                }
                break;
            case 'laser':
                if (this.attackTimer < 60) {
                    this.laserCharge = this.attackTimer / 60;
                    if (this.isDesperationMode) {
                        if (this.attackTimer === 1) this.laserNearMissOffset = null;
                        let target = this.getImperfectLaserAngle(65);
                        let diff = target - this.laserAngle;
                        while (diff < -Math.PI) diff += Math.PI * 2; while (diff > Math.PI) diff -= Math.PI * 2;
                        this.laserAngle += diff * 0.1;
                    } else this.laserAngle = Math.PI / 2;
                } else if (this.attackTimer < 160) {
                    this.laserActive = true; let hit = false;
                    if (this.isDesperationMode) {
                        let dx = player.x - this.x; let dy = player.y - this.y;
                        let angle = -(this.laserAngle - Math.PI/2);
                        let rx = dx * Math.cos(angle) - dy * Math.sin(angle);
                        if (Math.abs(rx) < 30 && dy > 0) hit = true; 
                    } else {
                        if (Math.abs(player.x - this.x) < 30) hit = true;
                    }
                    if (hit) player.hit(2 * this.damageMultiplier);
                    if (frames % 4 === 0) { ctx.translate(Math.random()*4-2, 0); setTimeout(()=>ctx.setTransform(1,0,0,1,0,0), 20); }
                } else { this.laserActive = false; if (this.attackTimer > 200) this.startNextAttack(); }
                break;
            case 'swarm':
                 if (this.attackTimer === 1) {
                    for(let i=0; i<Math.floor((this.isPhaseTwo ? 15 : 10) * currentSettings.enemyCountMult); i++) enemies.push(new SwarmEnemy(Math.random() * width, -50 - (i*50)));
                }
                if (this.attackTimer > 400) this.startNextAttack();
                break;
            case 'redLines':
                if (this.attackTimer === 1) {
                    for(let i=0; i<Math.ceil(5 * currentSettings.enemyCountMult); i++) this.redLines.push({x: Math.random() * width, width: 2, damage: false});
                }
                if (this.attackTimer > 100 && this.attackTimer < 160) {
                    this.redLines.forEach(l => { l.width = 40; l.damage = true; if (l.damage && Math.abs(player.x - l.x) < 20) player.hit(1 * this.damageMultiplier); });
                }
                if (this.attackTimer > 200) this.startNextAttack();
                break;
            case 'rings':
                if (this.attackTimer % 40 === 0 && this.attackTimer < 300) {
                    let count = Math.floor((this.isPhaseTwo ? 24 : 16) * currentSettings.enemyCountMult);
                    for (let i = 0; i < count; i++) bullets.push(new Bullet(this.x, this.y, Math.cos((Math.PI * 2 / count) * i + (this.attackTimer * 0.01))*5, Math.sin((Math.PI * 2 / count) * i + (this.attackTimer * 0.01))*5, 'boss_orb'));
                }
                if (this.attackTimer > 350) this.startNextAttack();
                break;
            case 'missiles':
                if (this.attackTimer % 30 === 0 && this.attackTimer < 200) {
                    const cannonSpread = this.isPhaseTwo ? 135 : 95;
                    const cannonY = this.isPhaseTwo ? 38 : 28;
                    bullets.push(new Bullet(this.x - cannonSpread, this.y - cannonY, -4, -3, 'missile'));
                    bullets.push(new Bullet(this.x - cannonSpread, this.y + cannonY, -4, 2, 'missile'));
                    bullets.push(new Bullet(this.x + cannonSpread, this.y - cannonY, 4, -3, 'missile'));
                    bullets.push(new Bullet(this.x + cannonSpread, this.y + cannonY, 4, 2, 'missile'));
                    if(this.isPhaseTwo) {
                        bullets.push(new Bullet(this.x - 20, this.y - 70, -1, -5, 'missile'));
                        bullets.push(new Bullet(this.x + 20, this.y - 70, 1, -5, 'missile'));
                    }
                }
                if (this.attackTimer > 300) this.startNextAttack();
                break;
            case 'fireballs': 
                if (this.attackTimer % 30 === 0 && this.attackTimer < 200) {
                    bullets.push(new Bullet(this.x - 40, this.y, (player.x - (this.x-40))*0.02, (player.y-this.y)*0.02, 'fireball'));
                    bullets.push(new Bullet(this.x + 40, this.y, (player.x - (this.x+40))*0.02, (player.y-this.y)*0.02, 'fireball'));
                }
                if (this.attackTimer > 250) this.startNextAttack();
                break;
        }
    }

    drawRedLineAttack() {
        if (this.currentAttack !== 'redLines') return;
        this.redLines.forEach(l => {
            ctx.save();
            if (!l.damage) {
                ctx.strokeStyle = `rgba(255, 0, 0, ${Math.abs(Math.sin(frames * 0.2))})`;
                ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
                ctx.beginPath(); ctx.moveTo(l.x, 0); ctx.lineTo(l.x, height); ctx.stroke();
            } else {
                ctx.shadowBlur = 20; ctx.shadowColor = '#ff0000';
                ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'; ctx.fillRect(l.x - 20, 0, 40, height);
                ctx.fillStyle = '#fff'; ctx.fillRect(l.x - 2, 0, 4, height);
            }
            ctx.restore();
        });
    }

    drawSystemCoreOmega() {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.currentAttack === 'laser') {
            ctx.rotate(this.laserAngle - Math.PI / 2);
            if (this.attackTimer < 60) {
                ctx.strokeStyle = `rgba(255, 0, 0, ${Math.random()})`; ctx.lineWidth = 1;
                for(let i=0; i<5; i++) { ctx.beginPath(); ctx.moveTo((Math.random()-0.5)*220, 210); ctx.lineTo(0, 50); ctx.stroke(); }
                ctx.fillStyle = `rgba(255, 200, 200, ${this.laserCharge})`; ctx.beginPath(); ctx.arc(0, 58, this.laserCharge * 24, 0, Math.PI*2); ctx.fill();
            } else if (this.laserActive) {
                ctx.save(); ctx.shadowBlur = 45; ctx.shadowColor = "red";
                const beamWidth = 66 + Math.sin(frames * 0.5) * 7;
                ctx.fillStyle = this.isPhaseTwo ? "rgba(255, 50, 0, 0.9)" : "rgba(255, 0, 0, 0.72)";
                ctx.fillRect(-beamWidth/2, 0, beamWidth, height * 1.5);
                ctx.fillStyle = "white"; ctx.fillRect(-beamWidth/4, 0, beamWidth/2, height * 1.5); ctx.restore();
                if (Math.random() > 0.5) particles.push(new Particle(this.x, this.y + 50, '#ff5500', 5, 8, 30));
            }
            ctx.rotate(-(this.laserAngle - Math.PI / 2));
        }

        if (this.shieldHp > 0) {
            ctx.save(); ctx.beginPath(); ctx.arc(0, 0, this.isPhaseTwo ? 150 : 108, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.45 + Math.sin(frames*0.2)*0.25})`; ctx.lineWidth = 3; ctx.shadowBlur = 15; ctx.shadowColor = "#00ffff"; ctx.stroke();
            ctx.fillStyle = "rgba(0, 255, 255, 0.08)"; ctx.fill(); ctx.restore();
        }

        const ringRadius = this.isPhaseTwo ? 118 : 82;
        const coreRadius = this.isPhaseTwo ? 88 + Math.sin(frames * 0.08) * 8 : 42 + Math.sin(frames * 0.12) * 4;
        const damageAlpha = this.hp < this.maxHp ? 0.35 : 0;

        if (!this.isPhaseTwo) {
            ctx.save();
            ctx.shadowBlur = 18; ctx.shadowColor = '#ff0000';
            ctx.strokeStyle = '#555'; ctx.lineWidth = 12;
            ctx.beginPath(); ctx.arc(0, 0, ringRadius, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = '#ff2222'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, ringRadius - 10, frames * 0.02, frames * 0.02 + Math.PI * 1.7); ctx.stroke();
            ctx.strokeStyle = '#888'; ctx.lineWidth = 6;
            for(let i=0; i<4; i++) {
                const a = i * Math.PI / 2 + frames * 0.003;
                ctx.beginPath(); ctx.moveTo(Math.cos(a) * 48, Math.sin(a) * 48); ctx.lineTo(Math.cos(a) * ringRadius, Math.sin(a) * ringRadius); ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(255, 110, 60, 0.65)'; ctx.lineWidth = 2;
            for(let i=0; i<8; i++) {
                const a = i * Math.PI / 4 - frames * 0.018;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * 34, Math.sin(a) * 34);
                ctx.lineTo(Math.cos(a) * 68, Math.sin(a) * 68);
                ctx.stroke();
            }
            ctx.restore();

            const cannonKick = this.currentAttack === 'missiles' && this.attackTimer % 30 < 8 ? 12 : 0;
            const sway = Math.sin(frames * 0.06) * 0.25;
            [
                {x:-ringRadius - 42 - cannonKick, y:-42, r:-0.22-sway},
                {x:-ringRadius - 42 - cannonKick, y:42, r:0.22+sway},
                {x:ringRadius + 42 + cannonKick, y:-42, r:Math.PI+0.22+sway},
                {x:ringRadius + 42 + cannonKick, y:42, r:Math.PI-0.22-sway}
            ].forEach(c => {
                ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r);
                ctx.shadowBlur = 14; ctx.shadowColor = '#ff0000';
                ctx.fillStyle = '#303030'; ctx.fillRect(-18, -10, 64, 20);
                ctx.fillStyle = '#770000'; ctx.fillRect(16, -7, 32, 14);
                ctx.fillStyle = '#111'; ctx.fillRect(-14, -5, 26, 10);
                ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.strokeRect(-18, -10, 64, 20);
                ctx.fillStyle = '#ff2222'; ctx.beginPath(); ctx.arc(50, 0, 7 + Math.sin(frames*0.2)*2, 0, Math.PI*2); ctx.fill();
                if (this.currentAttack === 'missiles' && this.attackTimer % 30 < 8) {
                    ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.moveTo(48, -11); ctx.lineTo(78, 0); ctx.lineTo(48, 11); ctx.fill();
                }
                ctx.restore();
            });
        } else {
            ctx.save();
            ctx.rotate(frames * 0.032);
            ctx.strokeStyle = 'rgba(255, 70, 0, 0.9)';
            ctx.shadowBlur = 30; ctx.shadowColor = '#ff3300';
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.ellipse(0, 0, 178, 48, Math.sin(frames * 0.02) * 0.45, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();

            ctx.save();
            ctx.strokeStyle = 'rgba(150, 150, 150, 0.75)';
            ctx.lineWidth = 8; ctx.shadowBlur = 10; ctx.shadowColor = '#ff3300';
            for(let i=0; i<8; i++) {
                const a = i * Math.PI / 4 + frames * 0.016;
                const fall = ((frames * 2 + i * 35) % 170);
                const x = Math.cos(a) * (120 + fall * 0.35);
                const y = Math.sin(a) * (92 + fall * 0.45) + fall * 0.34;
                ctx.save(); ctx.translate(x, y); ctx.rotate(a + frames * 0.03);
                ctx.beginPath(); ctx.arc(0, 0, 27, 0.2, 1.2); ctx.stroke();
                ctx.restore();
            }
            ctx.restore();
        }

        const gradient = ctx.createRadialGradient(0, 0, 4, 0, 0, coreRadius);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.25, '#ffddaa');
        gradient.addColorStop(0.55, '#ff2200');
        gradient.addColorStop(1, '#660000');
        ctx.shadowBlur = this.isPhaseTwo ? 55 : 30;
        ctx.shadowColor = '#ff2200';
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.arc(0, 0, coreRadius, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = '#ff8888'; ctx.lineWidth = 2;
        for(let i=0; i<5; i++) {
            ctx.beginPath(); ctx.arc(0, 0, coreRadius * (0.35 + i * 0.13), frames * 0.03 + i, frames * 0.03 + i + Math.PI * 1.2); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'; ctx.lineWidth = 1.5;
        for(let i=0; i<6; i++) {
            const a = frames * 0.025 + i * Math.PI / 3;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * coreRadius * 0.25, Math.sin(a) * coreRadius * 0.25);
            ctx.lineTo(Math.cos(a) * coreRadius * 0.9, Math.sin(a) * coreRadius * 0.9);
            ctx.stroke();
        }

        if (damageAlpha > 0 || this.isPhaseTwo) {
            ctx.save();
            const smokeCount = this.isPhaseTwo ? 18 : 8;
            for(let i=0; i<smokeCount; i++) {
                const a = i * 1.7 + frames * 0.018;
                const r = this.isPhaseTwo ? 110 + (i % 4) * 18 : 76 + (i % 3) * 12;
                const sx = Math.cos(a) * r + Math.sin(frames * 0.03 + i) * 10;
                const sy = Math.sin(a) * r - ((frames * 1.4 + i * 20) % 95);
                ctx.globalAlpha = this.isPhaseTwo ? 0.18 : damageAlpha;
                ctx.fillStyle = i % 3 === 0 ? '#552222' : '#333';
                ctx.beginPath(); ctx.arc(sx, sy, 15 + (i % 5) * 5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore(); ctx.globalAlpha = 1;
        }

        if (this.flashTimer > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(0, 0, this.isPhaseTwo ? 135 : 75, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        ctx.restore();
        this.drawRedLineAttack();
    }

    draw() {
        if (!this.active) return;

        if (this.isCurseZero) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.shadowBlur = 36; ctx.shadowColor = '#33aaff';
            this.curseParticles.forEach((p, index) => {
                const px = Math.cos(p.angle) * p.radius;
                const py = Math.sin(p.angle * 1.15) * p.radius * 0.7;
                ctx.globalAlpha = 0.25 + Math.sin(frames * 0.08 + index) * 0.2;
                ctx.fillStyle = '#33aaff';
                ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill();
            });
            ctx.globalAlpha = 1;
            ctx.rotate(this.rot);
            ctx.lineWidth = 20;
            ctx.strokeStyle = '#33aaff';
            ctx.beginPath(); ctx.arc(0, 0, 72 + Math.sin(frames*0.08)*5, 0, Math.PI*2); ctx.stroke();
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = 'rgba(51,170,255,0.16)';
            ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            return;
        }

        if (this.isAstralTrio) {
            ctx.save();
            ctx.translate(this.x, this.y);

            if (this.laserActive && this.astralLaserAngles.length) {
                this.astralLaserAngles.forEach((angle, index) => {
                    ctx.save(); ctx.rotate(angle);
                    ctx.shadowBlur = 36; ctx.shadowColor = index === 1 ? '#ff3333' : (index === 2 ? '#33aaff' : '#cc99ff');
                    ctx.fillStyle = index === 1 ? 'rgba(255, 50, 50, 0.75)' : (index === 2 ? 'rgba(60, 160, 255, 0.75)' : 'rgba(220, 160, 255, 0.75)');
                    ctx.fillRect(0, -24, width * 1.5, 48);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, -7, width * 1.5, 14);
                    ctx.restore();
                });
            }

            if (!this.astralCoreAwake) {
                ctx.save();
                ctx.strokeStyle = 'rgba(220, 180, 255, 0.5)';
                ctx.lineWidth = 3; ctx.setLineDash([10, 12]);
                ctx.beginPath(); ctx.ellipse(0, 0, 210, 130, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.restore();
            }

            const coreScale = this.astralCoreAwake ? 1.45 + Math.sin(frames * 0.08) * 0.08 : 1;
            ctx.save();
            ctx.scale(coreScale, coreScale);
            ctx.shadowBlur = this.astralCoreAwake ? 60 : 35;
            ctx.shadowColor = '#cc99ff';
            ctx.beginPath();
            ctx.arc(0, 0, 62, -Math.PI/2, Math.PI/2);
            ctx.lineTo(0, 62);
            ctx.arc(0, 0, 62, Math.PI/2, Math.PI*1.5);
            ctx.closePath();
            ctx.fillStyle = '#ff3333'; ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, 62, Math.PI/2, Math.PI*1.5);
            ctx.lineTo(0, -62);
            ctx.arc(0, 0, 62, -Math.PI/2, Math.PI/2);
            ctx.closePath();
            ctx.fillStyle = '#33aaff'; ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI*2); ctx.fill();
            ctx.restore();

            if (!this.astralCoreAwake) {
                ctx.save();
                ctx.strokeStyle = `rgba(220, 180, 255, ${0.45 + Math.sin(frames*0.1)*0.25})`;
                ctx.lineWidth = 5; ctx.shadowBlur = 24; ctx.shadowColor = '#cc99ff';
                ctx.beginPath(); ctx.arc(0, 0, 94, 0, Math.PI*2); ctx.stroke();
                ctx.restore();
            }

            this.astralStars.forEach(star => {
                if (!star.active) return;
                ctx.save(); ctx.translate(star.x - this.x, star.y - this.y); ctx.rotate(frames * 0.05 * (star.name === 'red' ? 1 : -1));
                ctx.shadowBlur = 36; ctx.shadowColor = star.color; ctx.fillStyle = star.color;
                ctx.beginPath();
                for(let i=0; i<10; i++) {
                    const a = i * Math.PI / 5;
                    const r = i % 2 === 0 ? 48 : 22;
                    ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
                }
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#330000'; ctx.fillRect(-34, -62, 68, 5);
                ctx.fillStyle = star.color; ctx.fillRect(-34, -62, 68 * Math.max(0, star.hp / star.maxHp), 5);
                ctx.restore();
            });

            ctx.restore();
            return;
        }

        if (this.isPortalPrototype) {
            ctx.save();
            ctx.translate(this.x, this.y);

            if (this.portalLaser && portals[this.portalLaser.entryIndex] && portals[this.portalLaser.exitIndex]) {
                const entry = portals[this.portalLaser.entryIndex];
                const exit = portals[this.portalLaser.exitIndex];
                ctx.save();
                ctx.shadowBlur = 34; ctx.shadowColor = '#ff66ff';
                if (!this.laserActive) {
                    ctx.globalAlpha = 0.25 + this.laserCharge * 0.45;
                    ctx.strokeStyle = '#ff66ff'; ctx.lineWidth = 3 + this.laserCharge * 4; ctx.setLineDash([18, 12]);
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(entry.x - this.x, entry.y - this.y); ctx.stroke();
                    ctx.translate(exit.x - this.x, exit.y - this.y); ctx.rotate(this.portalLaser.angle);
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(width * 1.4, 0); ctx.stroke();
                } else {
                    ctx.globalAlpha = 0.95;
                    ctx.strokeStyle = '#ff66ff'; ctx.lineWidth = 26 + Math.sin(frames * 0.5) * 4;
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(entry.x - this.x, entry.y - this.y); ctx.stroke();
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8;
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(entry.x - this.x, entry.y - this.y); ctx.stroke();
                    ctx.translate(exit.x - this.x, exit.y - this.y); ctx.rotate(this.portalLaser.angle);
                    ctx.strokeStyle = '#ff66ff'; ctx.lineWidth = 58 + Math.sin(frames * 0.4) * 8;
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(width * 1.5, 0); ctx.stroke();
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 16;
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(width * 1.5, 0); ctx.stroke();
                }
                ctx.restore(); ctx.globalAlpha = 1;
            }

            ctx.rotate(this.rot);
            ctx.shadowBlur = 34; ctx.shadowColor = '#ff66ff';
            ctx.strokeStyle = '#ff66ff'; ctx.lineWidth = 5;
            ctx.beginPath();
            for(let i=0; i<10; i++) {
                const a = (Math.PI * 2 / 10) * i;
                const r = i % 2 === 0 ? 108 : 74;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath(); ctx.stroke();
            ctx.fillStyle = '#180020';
            ctx.fill();

            ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 3;
            for(let i=0; i<4; i++) {
                ctx.save(); ctx.rotate(i * Math.PI / 4 + frames * 0.025);
                ctx.beginPath(); ctx.ellipse(0, 0, 126, 38, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.restore();
            }

            ctx.fillStyle = '#ff66ff';
            for(let i=0; i<6; i++) {
                const a = i * Math.PI / 3 - this.rot * 2;
                ctx.beginPath(); ctx.arc(Math.cos(a)*82, Math.sin(a)*82, 8, 0, Math.PI*2); ctx.fill();
            }

            ctx.shadowBlur = 50; ctx.shadowColor = '#ffffff';
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, 28 + Math.sin(frames * 0.12) * 5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#2a0038'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            return;
        }

        if (this.isRiftSentinel) {
            ctx.save();
            ctx.translate(this.x, this.y);

            if (this.currentAttack === 'rift_lance') {
                ctx.save();
                ctx.rotate(this.laserAngle - Math.PI / 2);
                if (!this.laserActive) {
                    ctx.strokeStyle = `rgba(85, 221, 255, ${0.18 + this.laserCharge * 0.45})`;
                    ctx.lineWidth = 2 + this.laserCharge * 5;
                    ctx.setLineDash([18, 12]);
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, height * 1.5); ctx.stroke();
                    ctx.fillStyle = `rgba(85, 221, 255, ${this.laserCharge})`;
                    ctx.beginPath(); ctx.arc(0, 46, 14 + this.laserCharge * 18, 0, Math.PI*2); ctx.fill();
                } else {
                    ctx.shadowBlur = 42; ctx.shadowColor = '#55ddff';
                    const beamWidth = 56 + Math.sin(frames * 0.5) * 6;
                    ctx.fillStyle = 'rgba(85, 221, 255, 0.82)';
                    ctx.fillRect(-beamWidth/2, 0, beamWidth, height * 1.5);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(-beamWidth/8, 0, beamWidth/4, height * 1.5);
                }
                ctx.restore();
            }

            ctx.rotate(this.rot);
            ctx.shadowBlur = 32; ctx.shadowColor = '#55ddff';
            ctx.strokeStyle = '#55ddff'; ctx.lineWidth = 5;
            for(let i=0; i<3; i++) {
                ctx.save();
                ctx.rotate(i * Math.PI / 3);
                ctx.beginPath(); ctx.ellipse(0, 0, 132 - i * 22, 42 + i * 12, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.restore();
            }

            ctx.fillStyle = '#061820';
            ctx.beginPath();
            for(let i=0; i<8; i++) {
                const a = i * Math.PI / 4;
                const r = i % 2 === 0 ? 96 : 64;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();

            ctx.fillStyle = '#55ddff';
            for(let i=0; i<4; i++) {
                const a = i * Math.PI / 2 - this.rot * 1.7;
                ctx.beginPath(); ctx.arc(Math.cos(a) * 88, Math.sin(a) * 88, 9, 0, Math.PI*2); ctx.fill();
            }

            ctx.shadowBlur = 46 + Math.sin(frames * 0.14) * 14;
            ctx.shadowColor = '#ffffff';
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(0, 0, 28 + Math.sin(frames * 0.1) * 4, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#005577';
            ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            return;
        }

        if (this.isNeonVoid) {
            ctx.save();
            const glitching = this.voidGlitchTimer % 130 > 112;
            const jitterX = glitching ? (Math.random() - 0.5) * 28 : 0;
            const jitterY = glitching ? (Math.random() - 0.5) * 20 : 0;
            ctx.translate(this.x + jitterX, this.y + jitterY);

            this.voidParticles.forEach((p, index) => {
                const wobble = Math.sin(frames * 0.04 + p.drift) * 24;
                const px = Math.cos(p.angle) * (p.radius + wobble);
                const py = Math.sin(p.angle * 1.12) * (p.radius * 0.58 + wobble);
                ctx.globalAlpha = 0.35 + Math.sin(frames * 0.08 + index) * 0.25;
                ctx.shadowBlur = 18; ctx.shadowColor = p.color;
                ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill();
            });
            ctx.globalAlpha = 1;

            this.voidLines.forEach(l => {
                const x1 = Math.cos(l.angle) * l.radius;
                const y1 = Math.sin(l.angle * 1.07) * l.radius * 0.62;
                const x2 = Math.cos(l.angle + 0.17) * (l.radius + l.length);
                const y2 = Math.sin((l.angle + 0.17) * 1.07) * (l.radius + l.length) * 0.62;
                ctx.globalAlpha = l.alpha;
                ctx.strokeStyle = '#b000ff';
                ctx.shadowBlur = 24; ctx.shadowColor = '#b000ff';
                ctx.lineWidth = 3 + Math.sin(frames * 0.12 + l.angle) * 1.5;
                ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            });
            ctx.globalAlpha = 1;

            ctx.save();
            ctx.rotate(this.rot);
            const pulse = 1 + Math.sin(frames * 0.08) * 0.09;
            const spriteSize = 380 * pulse;
            ctx.shadowBlur = 80; ctx.shadowColor = '#b000ff';
            const gradient = ctx.createRadialGradient(0, 0, 30, 0, 0, spriteSize / 2);
            gradient.addColorStop(0, '#050007');
            gradient.addColorStop(0.45, '#180020');
            gradient.addColorStop(0.7, '#7a00ff');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath(); ctx.arc(0, 0, spriteSize / 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#050005';
            ctx.beginPath(); ctx.arc(0, 0, spriteSize * 0.22, 0, Math.PI * 2); ctx.fill();
            if (glitching) {
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = '#b000ff';
                ctx.fillRect(-spriteSize * 0.42, -spriteSize * 0.12, spriteSize * 0.84, 7);
                ctx.fillRect(-spriteSize * 0.35, spriteSize * 0.08, spriteSize * 0.7, 5);
                ctx.globalAlpha = 1;
            }
            ctx.restore();

            ctx.shadowBlur = 34; ctx.shadowColor = '#8f00ff';
            for(let i=0; i<5; i++) {
                ctx.save();
                ctx.rotate(this.rot * (i % 2 === 0 ? 1 : -1) + i * Math.PI / 5);
                ctx.strokeStyle = i % 2 === 0 ? 'rgba(176, 0, 255, 0.72)' : 'rgba(70, 0, 90, 0.65)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.ellipse(0, 0, 210 + i*34, 58 + i*18, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            if (glitching) {
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = '#b000ff';
                for(let i=0; i<9; i++) {
                    const y = (Math.random() - 0.5) * 330;
                    const x = (Math.random() - 0.5) * 170;
                    ctx.fillRect(x - 210, y, 420, 4 + Math.random() * 7);
                }
                ctx.globalAlpha = 1;
            }

            if (this.currentAttack === 'void_implosion') {
                ctx.strokeStyle = 'rgba(176, 0, 255, 0.42)';
                ctx.lineWidth = 3;
                for(let r=120; r<640; r+=52) {
                    const radius = r - ((frames * 7) % 52);
                    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
                }
            }

            ctx.restore();
            return;
        }
        
        if (this.isOblivion) {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
            ctx.shadowBlur = 40; ctx.shadowColor = '#ff0055';
            
            // Giant Outer Gear
            ctx.fillStyle = '#110022';
            ctx.strokeStyle = '#ff0055'; ctx.lineWidth = 5;
            ctx.beginPath();
            for(let i=0; i<16; i++) {
                let a = (Math.PI*2/16)*i;
                let r = (i%2===0) ? 120 : 100;
                ctx.lineTo(r*Math.cos(a), r*Math.sin(a));
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'; ctx.lineWidth = 3;
            for(let i=0; i<8; i++) {
                const a = (Math.PI * 2 / 8) * i + frames * 0.01;
                ctx.beginPath(); ctx.moveTo(42*Math.cos(a), 42*Math.sin(a)); ctx.lineTo(112*Math.cos(a), 112*Math.sin(a)); ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(255, 0, 85, 0.55)'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(0, 0, 92, -frames * 0.03, -frames * 0.03 + Math.PI * 1.35); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, 136, frames * 0.02, frames * 0.02 + Math.PI * 1.55); ctx.stroke();
            
            // Inner Core
            ctx.fillStyle = '#330011';
            ctx.beginPath(); ctx.arc(0,0,60,0,Math.PI*2); ctx.fill(); ctx.stroke();
            
            // Core eye
            ctx.fillStyle = '#ff0055'; ctx.shadowBlur = 50 + Math.sin(frames*0.1)*30;
            ctx.beginPath(); ctx.arc(0,0,30,0,Math.PI*2); ctx.fill();
            
            // 4 Main Turrets
            ctx.fillStyle = '#ffffff';
            for(let i=0; i<4; i++) {
                let a = (Math.PI/2)*i;
                ctx.beginPath(); ctx.arc(80*Math.cos(a), 80*Math.sin(a), 15, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#ff77aa'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(80*Math.cos(a), 80*Math.sin(a), 25, frames * 0.04, frames * 0.04 + Math.PI * 1.2); ctx.stroke();
            }
            ctx.fillStyle = '#ff99bb';
            for(let i=0; i<4; i++) {
                let a = (Math.PI/2)*i + frames * 0.025;
                ctx.beginPath(); ctx.arc(118*Math.cos(a), 118*Math.sin(a), 6, 0, Math.PI*2); ctx.fill();
            }

            // Beam Visuals
            if (this.currentAttack === 'oblivion_beam' && this.laserActive) {
                ctx.shadowBlur = 50; ctx.shadowColor = '#ff0055';
                for(let i=0; i<4; i++) {
                    let a = (Math.PI/2)*i;
                    ctx.fillStyle = 'rgba(255, 0, 85, 0.8)';
                    ctx.beginPath();
                    ctx.moveTo(80*Math.cos(a) - 20*Math.sin(a), 80*Math.sin(a) + 20*Math.cos(a));
                    ctx.lineTo(80*Math.cos(a) + 20*Math.sin(a), 80*Math.sin(a) - 20*Math.cos(a));
                    ctx.lineTo(2000*Math.cos(a) + 20*Math.sin(a), 2000*Math.sin(a) - 20*Math.cos(a));
                    ctx.lineTo(2000*Math.cos(a) - 20*Math.sin(a), 2000*Math.sin(a) + 20*Math.cos(a));
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.moveTo(80*Math.cos(a) - 5*Math.sin(a), 80*Math.sin(a) + 5*Math.cos(a));
                    ctx.lineTo(80*Math.cos(a) + 5*Math.sin(a), 80*Math.sin(a) - 5*Math.cos(a));
                    ctx.lineTo(2000*Math.cos(a) + 5*Math.sin(a), 2000*Math.sin(a) - 5*Math.cos(a));
                    ctx.lineTo(2000*Math.cos(a) - 5*Math.sin(a), 2000*Math.sin(a) + 5*Math.cos(a));
                    ctx.fill();
                }
            }

            ctx.restore(); return;
        }

        if (this.isNullEntity) {
            ctx.save(); ctx.translate(this.x, this.y);
            ctx.shadowBlur = 50; ctx.shadowColor = '#4400ff';
            
            ctx.rotate(frames * 0.02);
            ctx.strokeStyle = `rgba(68, 0, 255, ${0.5 + Math.sin(frames*0.1)*0.5})`;
            ctx.lineWidth = 15;
            ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI*2); ctx.stroke();

            ctx.save();
            ctx.rotate(-frames * 0.035);
            ctx.strokeStyle = 'rgba(160, 80, 255, 0.45)'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.ellipse(0, 0, 135, 38, 0, 0, Math.PI*2); ctx.stroke();
            ctx.rotate(Math.PI / 3);
            ctx.beginPath(); ctx.ellipse(0, 0, 118, 28, 0, 0, Math.PI*2); ctx.stroke();
            ctx.restore();
            
            ctx.fillStyle = '#110033';
            ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI*2); ctx.fill();
            
            for(let i=0; i<4; i++) {
                ctx.rotate(Math.PI/2);
                ctx.fillStyle = '#8800ff';
                ctx.beginPath(); ctx.moveTo(20, 20); ctx.lineTo(60, 0); ctx.lineTo(20, -20); ctx.closePath(); ctx.fill();
            }
            
            ctx.shadowBlur = 20; ctx.shadowColor = '#000';
            ctx.fillStyle = '#000000';
            ctx.beginPath(); ctx.arc(0, 0, 30 + Math.sin(frames*0.2)*5, 0, Math.PI*2); ctx.fill();

            ctx.fillStyle = '#aa55ff';
            for(let i=0; i<6; i++) {
                const a = i * Math.PI / 3 - frames * 0.025;
                const r = 95 + Math.sin(frames * 0.05 + i) * 12;
                ctx.beginPath(); ctx.arc(Math.cos(a)*r, Math.sin(a)*r, 4, 0, Math.PI*2); ctx.fill();
            }
            ctx.strokeStyle = 'rgba(210, 170, 255, 0.32)';
            ctx.lineWidth = 2;
            for(let i=0; i<10; i++) {
                const a = i * Math.PI / 5 + frames * 0.013;
                const r1 = 72 + (i % 2) * 20;
                const r2 = 145 + Math.sin(frames * 0.04 + i) * 10;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
                ctx.lineTo(Math.cos(a + 0.18) * r2, Math.sin(a + 0.18) * r2);
                ctx.stroke();
            }
            
            if (this.currentAttack === 'null_gravity') {
                ctx.strokeStyle = 'rgba(100, 0, 255, 0.3)';
                ctx.lineWidth = 2;
                for(let r=30; r<300; r+=20) {
                    let radius = r - (frames*2 % 20);
                    if(radius > 30) { ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI*2); ctx.stroke(); }
                }
            }
            
            ctx.restore(); return;
        }

        if (this.isSyntaxError) {
            ctx.save();
            ctx.translate(this.x, this.y);
            if (this.currentAttack === 'syntax_loom' || this.currentAttack === 'syntax_digits') {
                if (frames % 3 === 0) ctx.translate((Math.random()-0.5)*15, (Math.random()-0.5)*15);
            }

            ctx.shadowBlur = 24; ctx.shadowColor = '#aaff00';
            ctx.strokeStyle = '#aaff00'; ctx.lineWidth = 3;
            ctx.save();
            ctx.rotate(frames * 0.025);
            ctx.beginPath();
            ctx.moveTo(0, -64); ctx.lineTo(54, -20); ctx.lineTo(34, 54); ctx.lineTo(-34, 54); ctx.lineTo(-54, -20); ctx.closePath();
            ctx.stroke();
            ctx.restore();

            if (this.currentAttack === 'syntax_triangle') {
                ctx.fillStyle = '#00ff00';
                ctx.beginPath(); ctx.moveTo(0, -58); ctx.lineTo(54, 44); ctx.lineTo(-54, 44); ctx.closePath(); ctx.fill();
            } else if (this.currentAttack === 'syntax_falling') {
                ctx.fillStyle = '#112200';
                ctx.beginPath(); ctx.moveTo(0, 62); ctx.lineTo(48, -18); ctx.lineTo(0, -72); ctx.lineTo(-48, -18); ctx.closePath(); ctx.fill();
            } else {
                ctx.fillStyle = (frames % 5 === 0) ? '#aaff00' : '#00ff00';
                ctx.beginPath(); ctx.moveTo(-30, -42); ctx.lineTo(30, -42); ctx.lineTo(50, 38); ctx.lineTo(-50, 38); ctx.closePath(); ctx.fill();
            }

            ctx.fillStyle = '#001100';
            ctx.fillRect(-38, -28, 76, 56);
            ctx.fillStyle = '#aaff00';
            ctx.font = 'bold 15px monospace';
            for(let c=0; c<5; c++) ctx.fillText(Math.random()>0.5?'1':'0', -30 + c*15, -8 + ((frames + c*13) % 42));
            ctx.strokeStyle = `rgba(255,255,255,0.55)`; ctx.lineWidth = 2;
            ctx.strokeRect(-42, -32 + (frames % 64), 84, 3);
            ctx.strokeStyle = 'rgba(170, 255, 0, 0.45)';
            ctx.beginPath(); ctx.moveTo(-70, -52); ctx.lineTo(-92, -52); ctx.lineTo(-92, 52); ctx.lineTo(-70, 52); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(70, -52); ctx.lineTo(92, -52); ctx.lineTo(92, 52); ctx.lineTo(70, 52); ctx.stroke();
            ctx.restore();
            return;
        }

    if (this.isArchitect) {
        ctx.save();
        
        // Draw Spikes Layer First
        if (this.currentAttack === 'arch_spikes') {
            if (this.spikeWarnings) {
                ctx.fillStyle = `rgba(255, 215, 0, ${Math.abs(Math.sin(frames*0.2)) * 0.5})`;
                ctx.fillRect(0, 0, 100, height);
                ctx.fillRect(width - 100, 0, 100, height);
                ctx.fillRect(0, height - 100, width, 100);
            } else if (this.spikesActive) {
                ctx.fillStyle = '#ffd700'; ctx.shadowBlur = 20; ctx.shadowColor = '#ffaa00';
                ctx.beginPath(); ctx.moveTo(0,0);
                for(let i=0; i<=height; i+=40) { ctx.lineTo(100, i+20); ctx.lineTo(0, i+40); }
                ctx.fill();
                ctx.beginPath(); ctx.moveTo(width,0);
                for(let i=0; i<=height; i+=40) { ctx.lineTo(width-100, i+20); ctx.lineTo(width, i+40); }
                ctx.fill();
                ctx.beginPath(); ctx.moveTo(0, height);
                for(let i=0; i<=width; i+=40) { ctx.lineTo(i+20, height-100); ctx.lineTo(i+40, height); }
                ctx.fill();
            }
        }
        
        // Draw Golden Laser Sub-Layer
        if (this.currentAttack === 'arch_lasers') {
            ctx.save(); ctx.translate(this.x, this.y);
            ctx.rotate(this.laserAngle - Math.PI / 2);
            if (!this.laserActive && this.attackTimer % 90 < 40) {
                ctx.fillStyle = `rgba(255, 215, 0, ${this.laserCharge})`;
                ctx.beginPath(); ctx.arc(0, 0, this.laserCharge * 30, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = "rgba(255, 215, 0, 0.3)"; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 1500); ctx.stroke();
            } else if (this.laserActive) {
                ctx.shadowBlur = 40; ctx.shadowColor = "#ffd700";
                const beamW = 50 + Math.sin(frames * 0.5) * 5;
                ctx.fillStyle = "rgba(255, 215, 0, 0.9)"; ctx.fillRect(-beamW/2, 0, beamW, height * 1.5);
                ctx.fillStyle = "white"; ctx.fillRect(-beamW/4, 0, beamW/2, height * 1.5);
            }
            ctx.restore();
        }

                // Draw Core Architect Mesh
                ctx.translate(this.x, this.y); ctx.rotate(this.rot);
                ctx.shadowBlur = 40; ctx.shadowColor = '#ffd700';
        ctx.fillStyle = '#ccaa00'; ctx.strokeStyle = '#ffeeaa'; ctx.lineWidth = 4;
        ctx.beginPath();
        for(let i=0; i<9; i++) {
            let a = (Math.PI * 2 / 9) * i;
            ctx.lineTo(80 * Math.cos(a), 80 * Math.sin(a));
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(0, 0, 20 + Math.sin(frames*0.1)*5, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)'; ctx.lineWidth = 2;
        for(let i=0; i<9; i++) {
            let a = (Math.PI * 2 / 9) * i + frames * 0.02;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(92 * Math.cos(a), 92 * Math.sin(a)); ctx.stroke();
            ctx.fillStyle = i % 2 === 0 ? '#fff4aa' : '#ffd700';
            ctx.beginPath(); ctx.arc(104 * Math.cos(a), 104 * Math.sin(a), 5, 0, Math.PI*2); ctx.fill();
        }
        
        ctx.restore();
        return;
    }

    if (this.isHiveMother) {
        ctx.save();
            if (this.miniHives) {
                this.miniHives.forEach(h => {
                    if (!h.active) return;
                    ctx.save(); ctx.translate(h.x, h.y);
                    ctx.fillStyle = "#9370db"; ctx.shadowBlur = 0; 
                    ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(35 * Math.cos(i * Math.PI / 3), 35 * Math.sin(i * Math.PI / 3)); ctx.fill();
                    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
                    ctx.fillStyle = "red"; ctx.fillRect(-25, -45, 50, 4);
                    ctx.fillStyle = "#00ff00"; ctx.fillRect(-25, -45, 50 * (h.hp / h.maxHp), 4);
                    ctx.restore();
                });
                    }
                    ctx.translate(this.x, this.y);
                    
                    if (this.miniHives.length > 0) {
                ctx.save(); ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(120 * Math.cos(i * Math.PI / 3), 120 * Math.sin(i * Math.PI / 3)); ctx.closePath();
                ctx.strokeStyle = `rgba(200, 200, 200, ${0.5 + Math.sin(frames*0.1)*0.3})`; ctx.lineWidth = 5; ctx.shadowBlur = 15; ctx.shadowColor = "#ffffff"; ctx.stroke();
                ctx.fillStyle = `rgba(200, 200, 200, 0.1)`; ctx.fill(); ctx.restore();
            }
            
            const pulse = 1 + Math.sin(frames * 0.05) * 0.05; ctx.scale(pulse, pulse);
            
            ctx.strokeStyle = '#8a2be2'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, 110, frames*0.02, frames*0.02 + Math.PI*1.8); ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 120, 255, 0.55)'; ctx.lineWidth = 3;
            for(let ring=0; ring<2; ring++) {
                ctx.beginPath();
                ctx.arc(0, 0, 76 + ring * 42, -frames * (0.025 + ring * 0.01), -frames * (0.025 + ring * 0.01) + Math.PI * 1.35);
                ctx.stroke();
            }
            
            ctx.fillStyle = "#2d004d"; ctx.shadowBlur = 20; ctx.shadowColor = "#9400d3";
            ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(100 * Math.cos(i * Math.PI / 3), 100 * Math.sin(i * Math.PI / 3)); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "#9400d3"; ctx.lineWidth = 4; ctx.stroke();
            
            ctx.fillStyle = "#6a0dad"; ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(60 * Math.cos(i * Math.PI / 3 + 0.5), 60 * Math.sin(i * Math.PI / 3 + 0.5)); ctx.closePath(); ctx.fill();
            
            ctx.fillStyle = "#ffffff"; ctx.shadowBlur = 40 + Math.sin(frames*0.2)*20; ctx.shadowColor = "#ff00ff";
            ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI*2); ctx.fill();
            
            for(let i=0; i<6; i++) {
                let a = i * Math.PI / 3;
                ctx.fillStyle = "#ff00ff"; ctx.beginPath(); ctx.arc(100*Math.cos(a), 100*Math.sin(a), 8, 0, Math.PI*2); ctx.fill();
            }
            ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2;
            for(let i=0; i<6; i++) {
                let a = i * Math.PI / 3 + Math.PI / 6;
                ctx.beginPath();
                ctx.moveTo(34*Math.cos(a), 34*Math.sin(a));
                ctx.lineTo(132*Math.cos(a), 132*Math.sin(a));
                ctx.stroke();
            }

            ctx.restore(); return;
        }

        if (this.isSnake) {
            const segmentCount = 35; const spacing = 3; 
            const mainColor = (isHardMode()) ? '#ff0000' : '#00ff00';
            const altColor = (isHardMode()) ? '#880000' : '#008800';
            const detailColor = (isHardMode()) ? '#ff4444' : '#00aa00';
            
            for (let i = segmentCount; i > 0; i--) {
                let pathIndex = i * spacing;
                if (pathIndex < this.snakePath.length) {
                    let pos = this.snakePath[pathIndex];
                    if (this.currentAttack === 'snake_rush' && player.active && Math.hypot(pos.x - player.x, pos.y - player.y) < 30) player.hit(2);
                    
                    ctx.save(); ctx.translate(pos.x, pos.y); 
                    let size = 30 * (1 - i/(segmentCount + 10)) + 8;
                    
                    ctx.shadowBlur = (i%5===0)?10:0; ctx.shadowColor = mainColor;
                    ctx.fillStyle = (i % 4 === 0) ? altColor : detailColor; 
                    ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(0, 0, size*0.5, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = mainColor; ctx.beginPath(); ctx.arc(0, 0, size*0.3, 0, Math.PI*2); ctx.fill();
                    
                    ctx.fillStyle = detailColor;
                    ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(size+10, 5); ctx.lineTo(size, 10); ctx.fill();
                    ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(-size-10, 5); ctx.lineTo(-size, 10); ctx.fill();
                    ctx.restore();
                }
            }
            
                    ctx.save(); ctx.translate(this.x, this.y); ctx.shadowBlur = 20; ctx.shadowColor = mainColor;
            
            ctx.fillStyle = mainColor;
            ctx.beginPath();
            ctx.moveTo(0, 40); ctx.lineTo(20, 20); ctx.lineTo(35, -10); ctx.lineTo(20, -35); ctx.lineTo(0, -25);
            ctx.lineTo(-20, -35); ctx.lineTo(-35, -10); ctx.lineTo(-20, 20); ctx.closePath(); ctx.fill();

            ctx.strokeStyle = altColor; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(0, -25); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-20, 20); ctx.lineTo(20, 20); ctx.stroke();

            ctx.fillStyle = (isHardMode()) ? '#ffff00' : '#ffffff';
            ctx.shadowBlur = 15; ctx.shadowColor = ctx.fillStyle;
            ctx.beginPath(); ctx.ellipse(-12, 10, 4, 10, -Math.PI/6, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(12, 10, 4, 10, Math.PI/6, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 8; ctx.shadowColor = '#ffffff';
            ctx.beginPath(); ctx.moveTo(-10, 32); ctx.lineTo(-4, 50); ctx.lineTo(0, 30); ctx.fill();
            ctx.beginPath(); ctx.moveTo(10, 32); ctx.lineTo(4, 50); ctx.lineTo(0, 30); ctx.fill();
            ctx.strokeStyle = mainColor; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, -18, 44, 0.25, Math.PI - 0.25); ctx.stroke();
            for(let i=-2; i<=2; i++) {
                ctx.fillStyle = detailColor;
                ctx.beginPath(); ctx.moveTo(i*10, -36); ctx.lineTo(i*10 + 5, -54); ctx.lineTo(i*10 + 10, -36); ctx.fill();
            }

            ctx.restore(); return;
        }

                if (this.isGlitch) {
                    ctx.save(); ctx.translate(this.x, this.y);
                    if(frames % 4 === 0) ctx.translate((Math.random()-0.5)*10, 0); 
            
            for(let j=0; j<3; j++) {
                ctx.save();
                ctx.translate((Math.random()-0.5)*15, (Math.random()-0.5)*15);
                ctx.strokeStyle = j===0 ? 'red' : (j===1 ? 'lime' : 'blue');
                ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(70, 0); ctx.lineTo(0, 70); ctx.lineTo(-70, 0); ctx.closePath(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(70, 0); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, 70); ctx.stroke();
                ctx.restore();
            }
            
            ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 4; ctx.shadowBlur = 20; ctx.shadowColor = '#ff00ff';
            ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(60, 0); ctx.lineTo(0, 60); ctx.lineTo(-60, 0); ctx.closePath(); ctx.stroke();
            ctx.fillStyle = `rgba(255, 0, 255, ${0.2 + Math.sin(frames*0.1)*0.2})`; ctx.fill(); 
            ctx.save();
            ctx.rotate(-frames * 0.04);
            ctx.strokeStyle = 'rgba(0,255,255,0.8)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.rect(-38, -38, 76, 76); ctx.stroke();
            ctx.restore();
            ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
            for(let i=0; i<6; i++) {
                const y = -48 + i * 18 + Math.sin(frames * 0.12 + i) * 4;
                ctx.beginPath(); ctx.moveTo(-74 + (i % 2) * 12, y); ctx.lineTo(74 - (i % 2) * 10, y); ctx.stroke();
            }

            ctx.fillStyle = '#00ffff';
            for(let i=0; i<5; i++) {
                let bx = Math.sin(frames*0.05 + i) * 80; let by = Math.cos(frames*0.05 + i*2) * 80;
                ctx.fillRect(bx, by, 8, 8);
            }

            ctx.restore();
            
            this.clones.forEach(c => {
                ctx.save(); ctx.translate(c.x, c.y); ctx.globalAlpha = 0.8 + Math.sin(frames*0.5)*0.1; 
                ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(50, 0); ctx.lineTo(0, 50); ctx.lineTo(-50, 0); ctx.closePath(); ctx.stroke(); ctx.restore();
            });
            return;
        }

        if (this.isTerminator) {
            ctx.save(); ctx.translate(this.x, this.y);

            if (this.currentAttack === 'terminator_laser') {
                ctx.save();
                ctx.rotate(this.laserAngle - Math.PI/2);
                if (this.attackTimer < 60) {
                    ctx.shadowBlur = 35; ctx.shadowColor = '#ff0000';
                    ctx.fillStyle = `rgba(255, 0, 0, ${this.laserCharge})`;
                    ctx.beginPath(); ctx.arc(0, 44, this.laserCharge * 34, 0, Math.PI*2); ctx.fill();
                    ctx.strokeStyle = `rgba(255, 0, 0, ${0.2 + this.laserCharge * 0.35})`;
                    ctx.lineWidth = 3 + this.laserCharge * 4;
                    ctx.setLineDash([16, 10]);
                    ctx.beginPath(); ctx.moveTo(0, 44); ctx.lineTo(0, height * 1.5); ctx.stroke();
                } else if (this.laserActive) {
                    ctx.shadowBlur = 55; ctx.shadowColor = '#ff0000';
                    const beamWidth = 70 + Math.sin(frames * 0.45) * 8;
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.88)'; ctx.fillRect(-beamWidth/2, 44, beamWidth, height * 1.5);
                    ctx.fillStyle = '#ffffff'; ctx.fillRect(-beamWidth/6, 44, beamWidth/3, height * 1.5);
                }
                ctx.restore();
            }

            if (this.shieldHp > 0) {
                ctx.save();
                ctx.beginPath(); ctx.ellipse(0, 8, 112, 126, 0, 0, Math.PI*2);
                ctx.strokeStyle = `rgba(0, 255, 255, ${0.42 + Math.sin(frames*0.12)*0.18})`;
                ctx.lineWidth = 5; ctx.shadowBlur = 22; ctx.shadowColor = '#00ffff'; ctx.stroke();
                ctx.fillStyle = 'rgba(0, 255, 255, 0.08)'; ctx.fill();
                ctx.restore();
            }

            ctx.scale(0.72, 1.08);
            ctx.shadowBlur = 18; ctx.shadowColor = '#ff0000';

            // Back armor wings
            ctx.fillStyle = '#1a0707';
            ctx.beginPath();
            ctx.moveTo(-28, -52); ctx.lineTo(-122, -24); ctx.lineTo(-104, 42); ctx.lineTo(-42, 70); ctx.lineTo(-16, 30); ctx.closePath();
            ctx.moveTo(28, -52); ctx.lineTo(122, -24); ctx.lineTo(104, 42); ctx.lineTo(42, 70); ctx.lineTo(16, 30); ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#770000'; ctx.lineWidth = 4; ctx.stroke();

            // Side missile pods and rail guns
            [-1, 1].forEach(side => {
                ctx.save(); ctx.scale(side, 1);
                ctx.fillStyle = '#3a3a3a'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
                ctx.fillRect(82, -44, 26, 74); ctx.strokeRect(82, -44, 26, 74);
                for(let i=0; i<3; i++) {
                    ctx.fillStyle = '#120000';
                    ctx.beginPath(); ctx.arc(95, -28 + i*24, 8, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#ff2200';
                    ctx.beginPath(); ctx.arc(95, -28 + i*24, 4 + Math.sin(frames*0.15 + i)*1.5, 0, Math.PI*2); ctx.fill();
                }
                ctx.fillStyle = '#555';
                ctx.fillRect(54, -72, 16, 92);
                ctx.fillRect(66, -82, 12, 36);
                ctx.fillRect(66, 10, 12, 46);
                ctx.fillStyle = '#ff3300';
                ctx.fillRect(68, -86, 8, 10);
                ctx.fillRect(68, 56, 8, 10);
                ctx.restore();
            });

            // Main dreadnought hull
            ctx.fillStyle = '#2b0000';
            ctx.beginPath();
            ctx.moveTo(0, 92);
            ctx.lineTo(42, 42);
            ctx.lineTo(50, -22);
            ctx.lineTo(28, -78);
            ctx.lineTo(10, -56);
            ctx.lineTo(0, -72);
            ctx.lineTo(-10, -56);
            ctx.lineTo(-28, -78);
            ctx.lineTo(-50, -22);
            ctx.lineTo(-42, 42);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#ff2200'; ctx.lineWidth = 3; ctx.stroke();

            ctx.fillStyle = '#660000';
            ctx.beginPath();
            ctx.moveTo(0, 66);
            ctx.lineTo(25, 20);
            ctx.lineTo(18, -28);
            ctx.lineTo(0, -44);
            ctx.lineTo(-18, -28);
            ctx.lineTo(-25, 20);
            ctx.closePath(); ctx.fill();

            // Armor plates
            ctx.strokeStyle = '#aa1111'; ctx.lineWidth = 2;
            for(let i=-1; i<=1; i+=2) {
                ctx.beginPath(); ctx.moveTo(i*12, -50); ctx.lineTo(i*34, -8); ctx.lineTo(i*28, 36); ctx.stroke();
                ctx.fillStyle = '#4a0000'; ctx.fillRect(i*18 - (i < 0 ? 14 : 0), -16, 14, 38);
            }

            // Reactor eye
            ctx.shadowBlur = 32 + Math.sin(frames * 0.18) * 10; ctx.shadowColor = '#ff3300';
            ctx.fillStyle = '#ff2200'; ctx.beginPath(); ctx.arc(0, 8, 18, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 8, 6, 0, Math.PI*2); ctx.fill();

            // Engines and sensor lights
            ctx.shadowBlur = 16; ctx.shadowColor = '#00ffff';
            ctx.fillStyle = `rgba(0, 255, 255, ${0.45 + Math.sin(frames*0.5)*0.35})`;
            [-22, 22].forEach(x => { ctx.beginPath(); ctx.arc(x, -80, 6, 0, Math.PI*2); ctx.fill(); });
            ctx.shadowColor = '#ff5500';
            ctx.fillStyle = `rgba(255, 80, 0, ${0.45 + Math.sin(frames*0.35)*0.3})`;
            [-24, 0, 24].forEach(x => { ctx.beginPath(); ctx.arc(x, 74, 7, 0, Math.PI*2); ctx.fill(); });

            if (this.shredderMode) {
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.55)';
                ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
                ctx.beginPath(); ctx.arc(0, 8, 128 + Math.sin(frames * 0.18) * 8, 0, Math.PI*2); ctx.stroke();
                ctx.restore();
            }

            ctx.restore(); return;
        }

                this.drawSystemCoreOmega();
    }

    hit(damage) {
        if (this.phase !== 'fight') return;

        if (this.isAstralTrio && !this.astralCoreAwake) {
            for(let i=0; i<8; i++) particles.push(new Particle(this.x + (Math.random()-0.5)*120, this.y + (Math.random()-0.5)*120, '#cc99ff', 3, 3, 20));
            return;
        }
        
        if (this.isHiveMother && this.miniHives.length > 0) {
            for(let i=0; i<5; i++) particles.push(new Particle(this.x + (Math.random()-0.5)*100, this.y + (Math.random()-0.5)*100, '#cccccc', 3, 3, 20));
            return; 
        }

        if (this.shieldHp > 0) {
            this.shieldHp -= damage;
            bossShieldBar.style.width = `${(this.shieldHp / this.maxShieldHp) * 100}%`;
            if (this.shieldHp <= 0) {
                playSound('explosion');
                bossShieldBar.style.width = "0%";
                bossShieldContainer.style.display = "none"; 
                for(let i=0; i<30; i++) particles.push(new Particle(this.x, this.y, '#00ffff', 5, 5, 40));
            }
            return; 
        }

        this.hp -= damage;
        this.flashTimer = 4;
        bossHealthBar.style.width = `${(this.hp / this.maxHp) * 100}%`;
        if (this.hp <= 0 && this.active) {
            playSound('explosion');
            this.active = false; bossHealthBar.style.width = '0%';
            isPhase2Active = false; this.isTerminator = false;
            for(let i=0; i<100; i++) {
                particles.push(new Particle(this.x, this.y, '#ffaa00', 10, 8, 100));
                particles.push(new Particle(this.x, this.y, '#ffffff', 15, 5, 120));
            }
            flashOverlay.style.transition = 'none'; flashOverlay.style.opacity = 1; void flashOverlay.offsetWidth;
            flashOverlay.style.transition = 'opacity 2s ease-out'; flashOverlay.style.opacity = 0;
            
            let dropCount = 50;
            for(let k=0; k<dropCount; k++) drops.push(new Drop(this.x + (Math.random()-0.5)*500, this.y, 'star'));

            triggerSupernova(); startVictorySequence();
        }
    }
}

function createShockwave(x, y) {
     for(let i=0; i<360; i+=10) particles.push(new Particle(x, y, '#ffffff', 10, 3, 20));
}

let currentWave = 0; let waveClearCheckReady = false; 

function startWave(wave) {
    currentWave = wave; waveClearCheckReady = false; 
    let maxWaves = (currentLevelIndex === 2 || currentLevelIndex === 3) ? 15 : 10;
    if (currentLevelIndex >= 4) maxWaves = 15;

    waveText.innerText = currentWave === maxWaves ? "BOSS WARNING" : `WAVE ${currentWave}`;
    waveText.style.color = "#fff"; waveText.style.opacity = 1; waveText.style.transform = "scale(1.2)";
    
    setTimeout(() => { waveText.style.opacity = 0; waveText.style.transform = "scale(0.5)"; spawnWaveEnemies(wave); }, 2000);
}

function spawnWaveEnemies(wave) {
    let maxDelay = 0; const countMult = currentSettings.enemyCountMult; const isHard = (isHardMode());

    // ===============================================
    // STAGE 15 - CURSE 0
    // ===============================================
    if (currentLevelIndex === 15) {
        if (wave === 1) {
            for(let i=0; i<12; i++) setTimeout(() => enemies.push(new PhaserEnemy(Math.random()*width, -60)), i*220);
            for(let i=0; i<4; i++) setTimeout(() => enemies.push(new LaserEnemy(Math.random()*width, -90)), i*650);
            maxDelay = 3800;
        } else if (wave >= 2 && wave <= 14) {
            let count = 38 + wave * 3; let delay = 50;
            for(let i=0; i<count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*delay);
            if (wave % 2 === 0) { enemies.push(new SpinnerEnemy(width*0.25, -150)); enemies.push(new SpinnerEnemy(width*0.75, -150)); }
            if (wave % 3 === 0) { enemies.push(new PhaserEnemy(width*0.2, -80)); enemies.push(new PhaserEnemy(width*0.8, -80)); }
            if (wave % 4 === 0) { enemies.push(new MineLayer(width*0.3, -80)); enemies.push(new MineLayer(width*0.7, -80)); }
            if (wave > 9) { setTimeout(() => enemies.push(new RammerEnemy(player.x, -70)), 1300); setTimeout(() => enemies.push(new RammerEnemy(player.x, -70)), 2600); }
            maxDelay = count * delay;
        } else if (wave === 15) {
            boss.activate(); boss.initAsStage15();
        }
    }
    // ===============================================
    // STAGE 14 - THE MIMIC
    // ===============================================
    else if (currentLevelIndex === 14) {
        if (wave === 1) {
            for(let i=0; i<10; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*180);
            for(let i=0; i<3; i++) setTimeout(() => enemies.push(new HeavyStriker(Math.random()*width, -100)), i*650);
            maxDelay = 3200;
        } else if (wave >= 2 && wave <= 14) {
            let count = 36 + wave * 2; let delay = 55;
            for(let i=0; i<count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*delay);
            if (wave % 2 === 0) { enemies.push(new HeavyStriker(width*0.25, -120)); enemies.push(new HeavyStriker(width*0.75, -120)); }
            if (wave % 3 === 0) { enemies.push(new SpinnerEnemy(width*0.3, -150)); enemies.push(new SpinnerEnemy(width*0.7, -150)); }
            if (wave % 4 === 0) { enemies.push(new LaserEnemy(width*0.5, -90)); }
            if (wave > 8) { setTimeout(() => enemies.push(new RammerEnemy(player.x, -70)), 1400); }
            maxDelay = count * delay;
        } else if (wave === 15) {
            boss.activate(); boss.initAsStage14();
        }
    }
    // ===============================================
    // STAGE 13 - THE ASTRAL TRIO
    // ===============================================
    else if (currentLevelIndex === 13) {
        if (wave === 1) {
            for(let i=0; i<10; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*180);
            for(let i=0; i<4; i++) setTimeout(() => enemies.push(new SpinnerEnemy(Math.random()*width, -130)), i*650);
            maxDelay = 3600;
        } else if (wave >= 2 && wave <= 14) {
            let count = 34 + wave * 3; let delay = 55;
            for(let i=0; i<count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*delay);

            if (wave % 2 === 0) { enemies.push(new PhaserEnemy(width*0.25, -80)); enemies.push(new PhaserEnemy(width*0.75, -80)); }
            if (wave % 3 === 0) { enemies.push(new SpinnerEnemy(width*0.25, -150)); enemies.push(new SpinnerEnemy(width*0.75, -150)); }
            if (wave % 4 === 0) { enemies.push(new LaserEnemy(width*0.33, -90)); enemies.push(new LaserEnemy(width*0.66, -90)); }
            if (wave > 8) { setTimeout(() => enemies.push(new RammerEnemy(player.x, -70)), 1300); setTimeout(() => enemies.push(new MineLayer(Math.random()*width, -80)), 2400); }
            if (wave > 11) { setTimeout(() => enemies.push(new RammerEnemy(player.x, -70)), 3300); }
            maxDelay = count * delay;
        } else if (wave === 15) {
            boss.activate(); boss.initAsStage13();
        }
    }
    // ===============================================
    // STAGE 12 - THE PORTAL PROTOTYPE
    // ===============================================
    else if (currentLevelIndex === 12) {
        if (wave === 1) {
            for(let i=0; i<8; i++) setTimeout(() => enemies.push(new PhaserEnemy(Math.random()*width, -60)), i*300);
            for(let i=0; i<5; i++) setTimeout(() => enemies.push(new MineLayer(Math.random()*width, -80)), i*700);
            maxDelay = 3800;
        } else if (wave >= 2 && wave <= 14) {
            let count = 32 + wave * 3; let delay = 58;
            for(let i=0; i<count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*delay);

            if (wave % 2 === 0) { enemies.push(new PhaserEnemy(width*0.2, -80)); enemies.push(new PhaserEnemy(width*0.8, -80)); }
            if (wave % 3 === 0) { enemies.push(new SpinnerEnemy(width*0.28, -150)); enemies.push(new SpinnerEnemy(width*0.72, -150)); }
            if (wave % 4 === 0) { enemies.push(new LaserEnemy(width*0.5, -90)); }
            if (wave > 7) { setTimeout(() => enemies.push(new RammerEnemy(player.x, -70)), 1200); setTimeout(() => enemies.push(new PhaserEnemy(Math.random()*width, -80)), 2400); }
            if (wave > 11) { setTimeout(() => enemies.push(new RammerEnemy(player.x, -70)), 3300); setTimeout(() => enemies.push(new MineLayer(Math.random()*width, -80)), 3800); }
            maxDelay = count * delay;
        } else if (wave === 15) {
            boss.activate(); boss.initAsStage12();
        }
    }
    // ===============================================
    // STAGE 11 - THE RIFT SENTINEL
    // ===============================================
    else if (currentLevelIndex === 11) {
        if (wave === 1) {
            for(let i=0; i<8; i++) setTimeout(() => enemies.push(new PhaserEnemy(Math.random()*width, -60)), i*320);
            for(let i=0; i<4; i++) setTimeout(() => enemies.push(new SpinnerEnemy(Math.random()*width, -140)), i*650);
            maxDelay = 3600;
        } else if (wave >= 2 && wave <= 14) {
            let count = 30 + wave * 3; let delay = 60;
            for(let i=0; i<count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*delay);

            if (wave % 2 === 0) { enemies.push(new LaserEnemy(width*0.25, -80)); enemies.push(new LaserEnemy(width*0.75, -80)); }
            if (wave % 3 === 0) { enemies.push(new SpinnerEnemy(width*0.3, -150)); enemies.push(new SpinnerEnemy(width*0.7, -150)); }
            if (wave % 4 === 0) { enemies.push(new MineLayer(width*0.2, -60)); enemies.push(new MineLayer(width*0.8, -60)); }
            if (wave > 7) { setTimeout(() => enemies.push(new PhaserEnemy(Math.random()*width, -80)), 1200); setTimeout(() => enemies.push(new RammerEnemy(player.x, -80)), 2300); }
            if (wave > 11) { setTimeout(() => enemies.push(new RammerEnemy(player.x, -80)), 3400); }
            maxDelay = count * delay;
        } else if (wave === 15) {
            boss.activate(); boss.initAsStage11();
        }
    }
    // ===============================================
    // STAGE 10 - THE NEON VOID PROTOTYPE
    // ===============================================
    else if (currentLevelIndex === 10) {
        if (wave === 1) {
            for(let i=0; i<6; i++) setTimeout(() => enemies.push(new PhaserEnemy(Math.random()*width, -50)), i*350);
            for(let i=0; i<6; i++) setTimeout(() => enemies.push(new HeavyStriker(Math.random()*width, -80)), i*450);
            maxDelay = 3200;
        } else if (wave >= 2 && wave <= 14) {
            let count = 28 + wave * 3; let delay = 65;
            for(let i=0; i<count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*delay);

            if (wave % 2 === 0) { enemies.push(new SpinnerEnemy(width*0.25, -150)); enemies.push(new SpinnerEnemy(width*0.75, -150)); }
            if (wave % 3 === 0) { enemies.push(new MineLayer(width*0.2, -50)); enemies.push(new MineLayer(width*0.5, -140)); enemies.push(new MineLayer(width*0.8, -50)); }
            if (wave % 4 === 0) { enemies.push(new LaserEnemy(width*0.25, -80)); enemies.push(new LaserEnemy(width*0.75, -80)); }
            if (wave > 6) { setTimeout(() => enemies.push(new PhaserEnemy(Math.random()*width, -80)), 1000); setTimeout(() => enemies.push(new PhaserEnemy(Math.random()*width, -80)), 2200); }
            if (wave > 10) { setTimeout(() => enemies.push(new RammerEnemy(player.x, -60)), 1200); setTimeout(() => enemies.push(new RammerEnemy(player.x, -60)), 2400); setTimeout(() => enemies.push(new RammerEnemy(player.x, -60)), 3600); }
            maxDelay = count * delay;
        } else if (wave === 15) {
            boss.activate(); boss.initAsStage10();
        }
    }
    // ===============================================
    // STAGE 9 - THE ARCHITECT
    // ===============================================
    else if (currentLevelIndex === 9) {
        if (wave === 1) {
            for(let i=0; i<8; i++) setTimeout(() => enemies.push(new HeavyStriker(Math.random()*width, -50)), i*400);
            maxDelay = 3200;
        } else if (wave >= 2 && wave <= 14) {
            let count = 20 + wave*2; let delay = 80;
            for(let i=0; i<count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*delay);
            
            if (wave % 2 === 0) { enemies.push(new MineLayer(width*0.25, -50)); enemies.push(new MineLayer(width*0.75, -50)); }
            if (wave % 3 === 0) { enemies.push(new LaserEnemy(width*0.5, -50)); }
            if (wave > 5) { setTimeout(() => enemies.push(new PhaserEnemy(Math.random()*width, -50)), 1000); }
            if (wave > 10) { setTimeout(() => enemies.push(new RammerEnemy(player.x, -50)), 1500); setTimeout(() => enemies.push(new RammerEnemy(player.x, -50)), 3000); }
            maxDelay = count * delay;
        } else if (wave === 15) {
            boss.activate(); boss.initAsStage9();
        }
    }
    // ===============================================
    // STAGE 8 - THE OBLIVION ENGINE
    // ===============================================
    else if (currentLevelIndex === 8) {
        if (wave === 1) {
            for(let i=0; i<5; i++) setTimeout(() => enemies.push(new PhaserEnemy(Math.random()*width, -50)), i*500);
            maxDelay = 3000;
        } else if (wave >= 2 && wave <= 14) {
            let count = 25 + wave; let delay = 80;
            for(let i=0; i<count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*delay);
            
            if (wave % 2 === 0) { enemies.push(new PhaserEnemy(width*0.2, -50)); enemies.push(new PhaserEnemy(width*0.8, -50)); }
            if (wave % 3 === 0) { enemies.push(new MineLayer(width*0.3, -50)); enemies.push(new MineLayer(width*0.7, -50)); }
            if (wave % 4 === 0) { enemies.push(new SpinnerEnemy(width*0.5, -150)); }
            if (wave > 5) { setTimeout(() => enemies.push(new RammerEnemy(player.x, -50)), 1500); }
            if (wave > 10) { setTimeout(() => enemies.push(new RammerEnemy(player.x, -50)), 2000); setTimeout(() => enemies.push(new RammerEnemy(player.x, -50)), 3000); }
            maxDelay = count * delay;
        } else if (wave === 15) {
            boss.activate(); boss.initAsStage8();
        }
    }
    // ===============================================
    // STAGE 7 - THE NULL ENTITY
    // ===============================================
    else if (currentLevelIndex === 7) {
        if (wave === 1) {
            for(let i=0; i<10; i++) setTimeout(() => enemies.push(new HeavyStriker(Math.random()*width, -50)), i*300);
            maxDelay = 3000;
        } else if (wave >= 2 && wave <= 14) {
            let count = 20 + wave; let delay = 100;
            for(let i=0; i<count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*delay);
            
            if (wave % 2 === 0) { enemies.push(new MineLayer(width*0.2, -50)); enemies.push(new MineLayer(width*0.8, -50)); }
            if (wave % 3 === 0) { enemies.push(new LaserEnemy(width*0.3, -50)); enemies.push(new LaserEnemy(width*0.7, -50)); }
            if (wave === 5 || wave === 10 || wave === 13) { enemies.push(new SpinnerEnemy(width*0.5, -150)); }
            
            if (wave > 5) { setTimeout(() => enemies.push(new RammerEnemy(player.x, -50)), 1500); }
            if (wave > 10) { setTimeout(() => enemies.push(new RammerEnemy(player.x, -50)), 2500); }
            maxDelay = count * delay;
        } else if (wave === 15) {
            boss.activate(); boss.initAsStage7();
        }
    }
    // ===============================================
    // STAGE 6 - THE SYNTAX ERROR 
    // ===============================================
    else if (currentLevelIndex === 6) {
        if (wave === 1) {
            let count = 10;
            for(let i=0; i<count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*200);
            maxDelay = 2000;
        } else if (wave >= 2 && wave <= 14) {
            let count = 15 + wave * 2; let delay = 100;
            for(let i=0; i<count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*delay);
            
            if (wave % 2 === 0) {
                setTimeout(() => enemies.push(new RammerEnemy(player.x, -50)), 1000);
                setTimeout(() => enemies.push(new RammerEnemy(player.x, -50)), 2500);
            }
            if (wave % 3 === 0) {
                enemies.push(new SpinnerEnemy(width*0.3, -150)); enemies.push(new SpinnerEnemy(width*0.7, -150));
            }
            if (wave >= 8 && wave % 2 !== 0) {
                enemies.push(new HeavyStriker(width/2, -150));
            }
            maxDelay = count * delay;
        } else if (wave === 15) {
            boss.activate();
            boss.initAsStage6();
        }
    }
    // ===============================================
    // STAGE 5 (BEGINNER & EXPERT) - THE HIVE
    // ===============================================
    else if (currentLevelIndex === 5) {
        if (wave === 1) {
            let count = 12; for(let i=0; i<count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*200);
        } else if (wave === 5) {
            enemies.push(new MineLayer(width * 0.2, -50)); enemies.push(new MineLayer(width * 0.5, -150)); enemies.push(new MineLayer(width * 0.8, -50));
            for(let i=0; i<8; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*300);
            maxDelay = 1000;
        } else if (wave >= 2 && wave <= 14) { 
            let count = 15 + wave; let delay = 150;
            if (wave === 8 || wave === 10 || wave === 12) enemies.push(new SpinnerEnemy(width*0.5, -150));
            if (wave >= 9) { count = 30; delay = 100; }
            for(let i=0; i<count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), i*delay);
            
            if (wave === 7) enemies.push(new MineLayer(width/2, -100));
            if (wave === 9) { enemies.push(new MineLayer(width*0.3, -100)); enemies.push(new MineLayer(width*0.7, -100)); }
            if (wave === 11) { enemies.push(new MineLayer(width*0.2, -100)); enemies.push(new MineLayer(width*0.8, -100)); }
            if (wave === 13) { enemies.push(new MineLayer(width*0.25, -100)); enemies.push(new MineLayer(width*0.5, -200)); enemies.push(new MineLayer(width*0.75, -100)); }
        } else if (wave === 15) { boss.activate(); boss.initAsStage5(); }
    }
    // ===============================================
    // STAGE 4 - THE SNAKE PIT
    // ===============================================
    else if (currentLevelIndex === 4) {
        if (wave === 1) {
            for(let i=0; i<8; i++) { let d = i*300; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), d); }
        } else if (wave >= 2 && wave <= 5) {
            for(let i=0; i<12+wave; i++) { let d = i*200; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), d); }
            if (wave === 4) enemies.push(new SpinnerEnemy(width*0.5, -100));
        } else if (wave >= 6 && wave <= 10) {
            enemies.push(new LaserEnemy(width*0.2, -100)); enemies.push(new LaserEnemy(width*0.8, -100));
            if (wave === 8 || wave === 10) enemies.push(new SpinnerEnemy(width*0.5, -150));
            for(let i=0; i<15; i++) { let d = i*200; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), d); }
        } else if (wave >= 11 && wave <= 14) {
            enemies.push(new HeavyStriker(width*0.5, -200));
            if (wave === 12) { enemies.push(new SpinnerEnemy(width*0.3, -150)); enemies.push(new SpinnerEnemy(width*0.7, -150)); }
            for(let i=0; i<20; i++) { let d = i*150; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), d); }
        } else if (wave === 15) { boss.activate(); boss.initAsStage4(); }
    }
    // ===============================================
    // STAGE 2 & 3
    // ===============================================
    else if (currentLevelIndex === 2 || currentLevelIndex === 3) {
        if (wave === 1) {
            if(isHard) { enemies.push(new HeavyStriker(width*0.25, -100)); enemies.push(new HeavyStriker(width*0.5, -200)); enemies.push(new HeavyStriker(width*0.75, -100)); maxDelay = 500; } 
            else {
                for(let i=0; i<Math.ceil((12 + wave * 2) * countMult); i++) {
                    let d = i * (400 - wave * 20); if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), d);
                }
            }
        } else if (wave >= 2 && wave <= 5) {
             for(let i=0; i<Math.ceil(20 * countMult); i++) {
                 let d = i * 200; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), d);
             }
             setTimeout(() => enemies.push(new HeavyStriker(Math.random()*width, -200)), 1000);
        } else if (wave >= 6 && wave <= 10) {
             enemies.push(new LaserEnemy(width*0.2, -100)); enemies.push(new LaserEnemy(width*0.8, -100));
             for(let i=0; i<Math.ceil(15 * countMult); i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i*300);
             maxDelay = 2000;
        } else if (wave >= 11 && wave <= 14) {
             enemies.push(new HeavyStriker(width*0.3, -100)); enemies.push(new HeavyStriker(width*0.7, -100)); enemies.push(new LaserEnemy(width*0.5, -200));
             for(let i=0; i<Math.ceil(25 * countMult); i++) { let d = i*150; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random()*width, -50)), d); }
        } else if (wave === 15) {
             boss.activate(); if (currentLevelIndex === 2) boss.initAsStage2(); else boss.initAsStage3();
        }
    } 
    // ===============================================
    // STAGE 1 DEFAULT LOGIC
    // ===============================================
    else {
        if (wave === 1) { for(let i=0; i<Math.ceil(10 * countMult); i++) { let d = i*400; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), d); } } 
        else if (wave === 2) { for(let i=0; i<Math.ceil(16 * countMult); i++) { let d = i*300; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), d); } } 
        else if (wave === 3) { for(let i=0; i<Math.ceil(24 * countMult); i++) { let d = i*200; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), d); } } 
        else if (wave === 4) {
            setTimeout(() => enemies.push(new HeavyStriker(width/2, -100)), 0);
            for(let i=0; i<Math.ceil(15 * countMult); i++) { let d = 1000 + i*300; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), d); }
        } else if (wave === 5) {
            enemies.push(new HeavyStriker(width/4, -100)); enemies.push(new HeavyStriker(width*2/4, -150)); enemies.push(new HeavyStriker(width*3/4, -100));
            let count = Math.ceil(20 * countMult);
            for(let i=0; i<count; i++) { let d = 2000 + i*250; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), d); }
            maxDelay = 2000 + count*250;
        } else if (wave === 6) {
            enemies.push(new HeavyStriker(width*0.2, -100)); enemies.push(new HeavyStriker(width*0.8, -100));
            for(let i=0; i<Math.ceil(20 * countMult); i++) { let d = i*200; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), d); }
        } else if (wave === 7) {
            enemies.push(new HeavyStriker(width*0.1, -100)); enemies.push(new HeavyStriker(width*0.9, -100));
            setTimeout(() => enemies.push(new HeavyStriker(width/2, -100)), 500); setTimeout(() => enemies.push(new HeavyStriker(width/4, -100)), 1000);
            setTimeout(() => enemies.push(new HeavyStriker(width*3/4, -100)), 1500); maxDelay = 1500;
        } else if (wave === 8) {
            enemies.push(new HeavyStriker(width/2, -100)); enemies.push(new HeavyStriker(200, -200)); enemies.push(new HeavyStriker(width-200, -200));
            let count = Math.ceil(30 * countMult);
            for(let i=0; i<count; i++) { let d = 1000 + i*200; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), d); }
            maxDelay = 1000 + count*200;
        } else if (wave === 9) {
            enemies.push(new HeavyStriker(width*0.2, -100)); enemies.push(new HeavyStriker(width*0.8, -100));
            enemies.push(new HeavyStriker(width/3, -200)); enemies.push(new HeavyStriker(width*2/3, -200));
            let count = Math.ceil(40 * countMult);
            for(let i=0; i<count; i++) { let d = 500 + i*150; if(d>maxDelay) maxDelay=d; setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), d); }
            maxDelay = 500 + count*150;
        } else if (wave === 10) boss.activate();
    }
    setTimeout(() => { waveClearCheckReady = true; }, maxDelay + 500);
}

let player, boss;
let particles = [], bullets = [], enemies = [], drops = [], portals = [];
let score = 0, frames = 0; let victoryTimer = 0;

function createPortalField(count) {
    portals = [];
    const palette = ['#ff66ff', '#55ddff', '#ffaa00', '#aa66ff', '#00ffaa'];
    for(let i=0; i<count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.PI / 5;
        const rx = Math.min(width * 0.34, 360);
        const ry = Math.min(height * 0.28, 250);
        const x = width / 2 + Math.cos(angle) * rx;
        const y = height / 2 + Math.sin(angle) * ry;
        portals.push(new Portal(Math.max(80, Math.min(width - 80, x)), Math.max(100, Math.min(height - 100, y)), palette[i % palette.length]));
    }
}

function handlePortalTravel(entity, radius, kind) {
    if (!entity || portals.length < 2) return;
    if (entity.portalCooldown === undefined) entity.portalCooldown = 0;
    if (entity.portalCooldown > 0) { entity.portalCooldown--; return; }

    for(let i=0; i<portals.length; i++) {
        const p = portals[i];
        if (Math.hypot(entity.x - p.x, entity.y - p.y) < radius + p.radius * 0.55) {
            let targetIndex = Math.floor(Math.random() * portals.length);
            if (targetIndex === i) targetIndex = (targetIndex + 1) % portals.length;
            const target = portals[targetIndex];
            const exitAngle = Math.random() * Math.PI * 2;
            entity.x = target.x + Math.cos(exitAngle) * (target.radius + radius + 14);
            entity.y = target.y + Math.sin(exitAngle) * (target.radius + radius + 14);
            entity.x = Math.max(30, Math.min(width - 30, entity.x));
            entity.y = Math.max(30, Math.min(height - 30, entity.y));
            entity.portalCooldown = kind === 'boss' ? 100 : 70;
            if (kind === 'player') { mouse.targetX = entity.x; mouse.targetY = entity.y; }
            for(let k=0; k<18; k++) particles.push(new Particle(target.x, target.y, target.color, 5, 4, 28));
            return;
        }
    }
}

function handleProjectilePortalTravel(projectile) {
    if (!projectile || portals.length < 2 || !projectile.active) return;
    if (projectile.type === 'glitch_laser' || projectile.type === 'arch_wall_h' || projectile.type === 'arch_wall_v' || projectile.type === 'arch_hammer') return;
    if (projectile.portalCooldown > 0) { projectile.portalCooldown--; return; }

    for(let i=0; i<portals.length; i++) {
        const p = portals[i];
        if (Math.hypot(projectile.x - p.x, projectile.y - p.y) < p.radius * 0.62) {
            let targetIndex = Math.floor(Math.random() * portals.length);
            if (targetIndex === i) targetIndex = (targetIndex + 1) % portals.length;
            const target = portals[targetIndex];
            const speed = Math.max(1, Math.hypot(projectile.vx || 0, projectile.vy || 0));
            const exitAngle = Math.atan2(projectile.vy || 0, projectile.vx || 1) + (Math.random() - 0.5) * 0.8;
            projectile.x = target.x + Math.cos(exitAngle) * (target.radius + 12);
            projectile.y = target.y + Math.sin(exitAngle) * (target.radius + 12);
            projectile.vx = Math.cos(exitAngle) * speed;
            projectile.vy = Math.sin(exitAngle) * speed;
            projectile.portalCooldown = 55;
            for(let k=0; k<8; k++) particles.push(new Particle(target.x, target.y, target.color, 3, 3, 18));
            return;
        }
    }
}

function getModeScreen(mode) {
    if (mode === 'sim') return simulationSelectScreen;
    if (mode === 'hard') return expertSelectScreen;
    if (mode === 'insane') return insaneSelectScreen;
    return levelSelectScreen;
}

function hideCampaignScreens() {
    [levelSelectScreen, simulationSelectScreen, expertSelectScreen, insaneSelectScreen].forEach(screen => {
        screen.style.opacity = '0';
        screen.style.pointerEvents = 'none';
    });
}

function showCampaignSelect(mode) {
    activeDifficultyMode = mode;
    currentHangarMode = mode;
    gameState = STATE.LEVEL_SELECT; menuScreen.style.opacity = '0'; menuScreen.style.pointerEvents = 'none';
    hangarScreen.style.opacity = '0'; hangarScreen.style.pointerEvents = 'none';
    hideCampaignScreens();
    const screen = getModeScreen(mode);
    screen.style.opacity = '1'; armLevelSelectScreen(screen, mode); updateLevelGrid(mode);
}

function showSimulationSelect() { showCampaignSelect('sim'); }
function showExpertSelect() { showCampaignSelect('hard'); }
function showRookieSelect() {
    showCampaignSelect('easy');
}
function showInsaneSelect() { showCampaignSelect('insane'); }

function armLevelSelectScreen(screen, mode) {
    if (levelSelectArmTimer) clearTimeout(levelSelectArmTimer);
    levelSelectReadyAt = Date.now() + 350;
    screen.style.pointerEvents = 'none';
    levelSelectArmTimer = setTimeout(() => {
        if (gameState === STATE.LEVEL_SELECT && currentHangarMode === mode) {
            screen.style.pointerEvents = 'auto';
        }
    }, 350);
}

function canLaunchSelectedLevel(mode) {
    return gameState === STATE.LEVEL_SELECT && currentHangarMode === mode && Date.now() >= levelSelectReadyAt;
}

function updateLevelGrid(mode) {
    const stats = getModeData(mode);
    const gridId = MODE_GRID_IDS[mode] || MODE_GRID_IDS.easy;
    const gridEl = document.getElementById(gridId);
    
    gridEl.innerHTML = ''; 
    let maxLevels = MAX_STAGE;

    for(let i = 1; i <= maxLevels; i++) { 
        const btn = document.createElement('button'); btn.className = 'level-btn';
        if (i <= stats.maxStage) {
            btn.classList.add('active'); btn.innerText = i < 10 ? `0${i}` : i; 
            btn.onclick = (event) => {
                event.stopPropagation();
                if (!canLaunchSelectedLevel(mode)) return;
                launchMission(mode, i);
            };
        } else {
            btn.classList.add('locked'); btn.innerHTML = `${i < 10 ? '0'+i : i} <span style="font-size:12px">🔒</span>`;
            btn.onclick = (event) => {
                event.stopPropagation();
                if (!canLaunchSelectedLevel(mode)) return;
                showLockedMessage();
            };
        }
        gridEl.appendChild(btn);
    }
}

function showLockedMessage() { msgModal.style.display = 'block'; }
function closeMsgModal() { msgModal.style.display = 'none'; }

function getVisibleCampaignMode(fallbackMode) {
    const visibleMode = CAMPAIGN_MODES.find(mode => {
        const screen = getModeScreen(mode);
        return screen.style.opacity === '1' && screen.style.pointerEvents !== 'none';
    });
    return visibleMode || (CAMPAIGN_MODES.includes(fallbackMode) ? fallbackMode : 'easy');
}

function openHangar(mode) {
    const resolvedMode = getVisibleCampaignMode(mode);
    gameState = STATE.HANGAR; currentHangarMode = resolvedMode; activeDifficultyMode = resolvedMode;
    const stats = getModeData(resolvedMode);
    document.getElementById('hangar-stars').innerText = stats.stars;
    document.getElementById('hangar-title').innerText = MODE_LABELS[resolvedMode] + " HANGAR";
    previewShipIndex = stats.currentShip || 0;
    updateHangarUI();
    hideCampaignScreens();
    hangarScreen.style.opacity = '1'; hangarScreen.style.pointerEvents = 'auto';
}

function closeHangar() {
    gameState = STATE.LEVEL_SELECT; hangarScreen.style.opacity = '0'; hangarScreen.style.pointerEvents = 'none';
    hideCampaignScreens();
    const screen = getModeScreen(currentHangarMode);
    screen.style.opacity = '1'; screen.style.pointerEvents = 'auto'; updateLevelGrid(currentHangarMode);
}

function prevShip() {
    previewShipIndex = (previewShipIndex - 1 + SHIPS.length) % SHIPS.length;
    updateHangarUI();
}

function nextShip() {
    previewShipIndex = (previewShipIndex + 1) % SHIPS.length;
    updateHangarUI();
}

function buyOrEquipShip() {
    const stats = getModeData(currentHangarMode);
    const ship = SHIPS[previewShipIndex];
    const shipCost = getHangarCost(ship.cost, currentHangarMode);
    
    if (stats.unlockedShips.includes(previewShipIndex)) {
        stats.currentShip = previewShipIndex;
        saveData();
        updateHangarUI();
    } else {
        if (stats.stars >= shipCost) {
            stats.stars -= shipCost;
            stats.unlockedShips.push(previewShipIndex);
            stats.currentShip = previewShipIndex;
            saveData();
            updateHangarUI();
        } else {
            alert("Not enough stars!");
        }
    }
}

function updateHangarUI() {
    const stats = getModeData(currentHangarMode);
    document.getElementById('hangar-stars').innerText = stats.stars;
    
    const ship = SHIPS[previewShipIndex];
    document.getElementById('ship-name').innerText = ship.name;
    document.getElementById('ship-name').style.color = ship.color;
    document.getElementById('ship-desc').innerText = ship.desc;
    
    const equipBtn = document.getElementById('btn-equip-ship');
    if (stats.unlockedShips.includes(previewShipIndex)) {
        if (stats.currentShip === previewShipIndex) {
            equipBtn.innerText = "EQUIPPED";
            equipBtn.style.opacity = 0.5;
            equipBtn.style.borderColor = "#555";
            equipBtn.style.color = "#555";
        } else {
            equipBtn.innerText = "EQUIP";
            equipBtn.style.opacity = 1;
            equipBtn.style.borderColor = ship.color;
            equipBtn.style.color = ship.color;
        }
    } else {
        equipBtn.innerText = `UNLOCK (${getHangarCost(ship.cost, currentHangarMode)} ✦)`;
        equipBtn.style.opacity = 1;
        equipBtn.style.borderColor = ship.color;
        equipBtn.style.color = ship.color;
    }

    const hCanvas = document.getElementById('hangarShipCanvas'); const hCtx = hCanvas.getContext('2d');
    hCtx.clearRect(0,0,200,200); hCtx.save(); hCtx.translate(100, 100); hCtx.scale(2, 2); 
    drawShipAsset(hCtx, previewShipIndex, true);
    hCtx.restore();

    const hpLvl = stats.healthLvl; const hpBtn = document.getElementById('btn-upg-hp'); const hpBonusEl = document.getElementById('hp-bonus');
    let totalBonusHp = 0; for(let i=0; i<hpLvl; i++) totalBonusHp += HEALTH_UPGRADES.bonuses[i];
    
    const hpSegments = document.querySelectorAll('#hp-bar-container .level-segment');
    hpSegments.forEach((seg, index) => { if (index < hpLvl) seg.classList.add('active'); else seg.classList.remove('active'); });

    hpBonusEl.innerText = "+" + totalBonusHp + " HP";
    if (hpLvl >= 5) { hpBtn.innerText = "MAXED"; hpBtn.style.opacity = 0.5; hpBtn.style.cursor = "default"; hpBtn.onclick = null; } 
    else { const cost = getHangarCost(HEALTH_UPGRADES.costs[hpLvl], currentHangarMode); hpBtn.innerText = `UPGRADE (${cost} ✦)`; hpBtn.style.opacity = 1; hpBtn.style.cursor = "pointer"; hpBtn.onclick = upgradeHealth; }

    const cannonLvl = stats.cannonLvl; const cannonBtn = document.getElementById('btn-upg-cannon'); const cannonBonusEl = document.getElementById('cannon-bonus');
    let totalBonusDmg = 0; for(let i=0; i<cannonLvl; i++) totalBonusDmg += CANNON_UPGRADES.bonuses[i];

    const cannonSegments = document.querySelectorAll('#cannon-bar-container .level-segment');
    cannonSegments.forEach((seg, index) => { if (index < cannonLvl) seg.classList.add('active'); else seg.classList.remove('active'); });

    cannonBonusEl.innerText = "+" + totalBonusDmg + " DMG";
    if (cannonLvl >= 5) { cannonBtn.innerText = "MAXED"; cannonBtn.style.opacity = 0.5; cannonBtn.style.cursor = "default"; cannonBtn.onclick = null; } 
    else { const cost = getHangarCost(CANNON_UPGRADES.costs[cannonLvl], currentHangarMode); cannonBtn.innerText = `UPGRADE (${cost} ✦)`; cannonBtn.style.opacity = 1; cannonBtn.style.cursor = "pointer"; cannonBtn.onclick = upgradeCannon; }

    const engineLvl = stats.engineLvl || 0; const engineBtn = document.getElementById('btn-upg-engine'); const engineBonusEl = document.getElementById('engine-bonus');
    const totalBonusSpd = totalUpgradeBonus(ENGINE_UPGRADES, engineLvl);
    const engineSegments = document.querySelectorAll('#engine-bar-container .level-segment');
    engineSegments.forEach((seg, index) => { if (index < engineLvl) seg.classList.add('active'); else seg.classList.remove('active'); });
    engineBonusEl.innerText = "+" + totalBonusSpd.toFixed(1) + " SPD";
    if (engineLvl >= 5) { engineBtn.innerText = "MAXED"; engineBtn.style.opacity = 0.5; engineBtn.style.cursor = "default"; engineBtn.onclick = null; }
    else { const cost = getHangarCost(ENGINE_UPGRADES.costs[engineLvl], currentHangarMode); engineBtn.innerText = `UPGRADE (${cost} ✦)`; engineBtn.style.opacity = 1; engineBtn.style.cursor = "pointer"; engineBtn.onclick = upgradeEngine; }

    const magnetLvl = stats.magnetLvl || 0; const magnetBtn = document.getElementById('btn-upg-magnet'); const magnetBonusEl = document.getElementById('magnet-bonus');
    const totalBonusRange = totalUpgradeBonus(MAGNET_UPGRADES, magnetLvl);
    const magnetSegments = document.querySelectorAll('#magnet-bar-container .level-segment');
    magnetSegments.forEach((seg, index) => { if (index < magnetLvl) seg.classList.add('active'); else seg.classList.remove('active'); });
    magnetBonusEl.innerText = "+" + totalBonusRange + " RANGE";
    if (magnetLvl >= 5) { magnetBtn.innerText = "MAXED"; magnetBtn.style.opacity = 0.5; magnetBtn.style.cursor = "default"; magnetBtn.onclick = null; }
    else { const cost = getHangarCost(MAGNET_UPGRADES.costs[magnetLvl], currentHangarMode); magnetBtn.innerText = `UPGRADE (${cost} ✦)`; magnetBtn.style.opacity = 1; magnetBtn.style.cursor = "pointer"; magnetBtn.onclick = upgradeMagnet; }
}

function upgradeHealth() {
    const stats = getModeData(currentHangarMode);
    const currentLvl = stats.healthLvl; if (currentLvl >= 5) return;
    const cost = getHangarCost(HEALTH_UPGRADES.costs[currentLvl], currentHangarMode);
    if (stats.stars >= cost) { stats.stars -= cost; stats.healthLvl++; saveData(); updateHangarUI(); } 
    else alert("Not enough stars!"); 
}

function upgradeCannon() {
    const stats = getModeData(currentHangarMode);
    const currentLvl = stats.cannonLvl; if (currentLvl >= 5) return;
    const cost = getHangarCost(CANNON_UPGRADES.costs[currentLvl], currentHangarMode);
    if (stats.stars >= cost) { stats.stars -= cost; stats.cannonLvl++; saveData(); updateHangarUI(); } 
    else alert("Not enough stars!"); 
}

function upgradeEngine() {
    const stats = getModeData(currentHangarMode);
    const currentLvl = stats.engineLvl || 0; if (currentLvl >= 5) return;
    const cost = getHangarCost(ENGINE_UPGRADES.costs[currentLvl], currentHangarMode);
    if (stats.stars >= cost) { stats.stars -= cost; stats.engineLvl++; saveData(); updateHangarUI(); }
    else alert("Not enough stars!");
}

function upgradeMagnet() {
    const stats = getModeData(currentHangarMode);
    const currentLvl = stats.magnetLvl || 0; if (currentLvl >= 5) return;
    const cost = getHangarCost(MAGNET_UPGRADES.costs[currentLvl], currentHangarMode);
    if (stats.stars >= cost) { stats.stars -= cost; stats.magnetLvl++; saveData(); updateHangarUI(); }
    else alert("Not enough stars!");
}

function updateUI() {
    starsDisplayEl.innerText = getModeData(activeDifficultyMode).stars;
}

function launchMission(mode, levelIndex) {
    currentSettings = getDifficultySettings(mode); activeDifficultyMode = mode; currentLevelIndex = levelIndex;
    document.body.classList.toggle('simulation-mode', mode === 'sim');
    setLevelMusic(levelIndex);
    menuScreen.style.opacity = '0'; menuScreen.style.pointerEvents = 'none';
    hideCampaignScreens();
    gameOverScreen.style.opacity = '0'; gameOverScreen.style.pointerEvents = 'none';
    hangarScreen.style.opacity = '0'; hangarScreen.style.pointerEvents = 'none';
    startIntro(mode, levelIndex);
}

function startIntro(mode, levelIndex) {
    gameState = STATE.INTRO; introScreen.style.opacity = '1'; introScreen.style.pointerEvents = 'auto';
    const key = `${mode}_${levelIndex}`;
    const fallbackMode = mode === 'sim' ? 'easy' : (mode === 'insane' ? 'hard' : mode);
    const msg = STAGE_MESSAGES[key] || STAGE_MESSAGES[`${fallbackMode}_${levelIndex}`] || "Transmission unclear. Proceed with caution.";
    document.getElementById('radio-content').innerHTML = msg;
    introTimer = 30; document.getElementById('intro-countdown').innerText = introTimer;
    if(introInterval) clearInterval(introInterval);
    introInterval = setInterval(() => { introTimer--; document.getElementById('intro-countdown').innerText = introTimer; if(introTimer <= 0) skipIntro(); }, 1000);
}

function skipIntro() {
    if(introInterval) clearInterval(introInterval);
    introScreen.style.opacity = '0'; introScreen.style.pointerEvents = 'none'; startActualGameplay();
}

function startActualGameplay() {
    document.activeElement.blur();
    setArenaScale(1);
    player = new Player(); boss = new Boss();
    bullets = []; particles = []; enemies = []; drops = []; portals = []; score = 0; frames = 0;
    scoreEl.innerText = '0'; playerHpEl.innerText = '100'; stageDisplayEl.innerText = currentLevelIndex;
    bossHealthBar.style.width = '100%'; bossShieldBar.style.width = '0%';
    bossShieldContainer.style.display = "none";
    bossName.innerText = "System Core: Omega"; bossName.style.color = "#ff4d4d";
    updateUI(); 

    gameState = STATE.PLAYING; isPhase2Active = false;
    playerHud.style.opacity = '1'; canvas.style.opacity = '1'; bossHud.style.opacity = 0; 
    mouse.targetX = width/2; mouse.targetY = height - 100;
    currentWave = 0; startWave(1);
}

function startVictorySequence() {
    gameState = STATE.VICTORY_SEQUENCE; victoryTimer = 0; enemies = []; bullets = []; portals = []; bossHud.style.opacity = 0;
    waveText.innerText = "MISSION COMPLETE"; waveText.style.opacity = 1; waveText.style.transform = "scale(1)";
    waveText.style.color = "#00ff00"; waveText.style.textShadow = "0 0 20px #00ff00";
}

function resetToMenu() {
    setArenaScale(1);
    setLevelMusic(0);
    document.body.classList.remove('simulation-mode');
    gameState = STATE.MENU; menuScreen.style.opacity = '1'; menuScreen.style.pointerEvents = 'auto';
    hideCampaignScreens();
    hangarScreen.style.opacity = '0'; hangarScreen.style.pointerEvents = 'none';
    gameOverScreen.style.opacity = '0'; gameOverScreen.style.pointerEvents = 'none';
    playerHud.style.opacity = '0'; canvas.style.opacity = '0'; bossHud.style.opacity = 0; waveText.style.opacity = 0; 
    enemies = []; bullets = []; particles = []; drops = []; portals = [];
    isSupernovaExploding = false;
    if(supernovaMesh) supernovaMesh.visible = false; if(supernovaParticles) supernovaParticles.visible = false;
    dropMeshes.forEach(d => { if(d.mesh) { scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); } }); dropMeshes = [];
}

function gameOver(win) {
    gameState = STATE.GAMEOVER; gameOverScreen.style.opacity = '1'; gameOverScreen.style.pointerEvents = 'auto';
    gameOverTitle.innerText = win ? "STAGE CLEARED" : "MISSION FAILED";
    gameOverTitle.style.color = win ? "#00ff00" : "#ff0000"; waveText.style.opacity = 0;
    if (!win) fadeOutMusic();

    if (win) {
        const stats = getModeData(activeDifficultyMode);
        let cap = MAX_STAGE; 
        if (currentLevelIndex === stats.maxStage && stats.maxStage < cap) { stats.maxStage++; saveData(); }
    }
}

let lastFrameTime = 0;
const TARGET_FPS = 60;
const FRAME_MIN_TIME = (1000 / TARGET_FPS) - (1000 / TARGET_FPS) * 0.1; // Allow slight jitter

function animateGame(currentTime) {
    requestAnimationFrame(animateGame);
    
    if (!lastFrameTime) lastFrameTime = currentTime;
    const elapsed = currentTime - lastFrameTime;
    
    // FPS Lock logic
    if (elapsed < FRAME_MIN_TIME) return;
    lastFrameTime = currentTime - (elapsed % (1000 / TARGET_FPS)); 

    ctx.fillStyle = 'rgba(5, 5, 5, 0.4)'; ctx.fillRect(0, 0, width, height);
    if (frames % 2 === 0) { ctx.fillStyle = `rgba(255, 255, 255, ${Math.random()})`; ctx.fillRect(Math.random() * width, 0, 2, 2); }
    if (gameState === STATE.MENU) return;

    frames++;
    if (gameState === STATE.PLAYING || gameState === STATE.GAMEOVER || gameState === STATE.VICTORY_SEQUENCE) {
        let maxWaves = (currentLevelIndex >= 2) ? 15 : 10;

        if (gameState === STATE.PLAYING && currentWave < maxWaves && enemies.length === 0 && waveClearCheckReady) {
            if (frames % 60 === 0) startWave(currentWave + 1);
        }

        if (portals.length > 0) {
            portals.forEach(p => { p.update(); p.draw(); });
        }

        if (boss && boss.active) { boss.update(); boss.draw(); }
        
        if (player) {
            if (gameState === STATE.PLAYING) {
                player.update(); player.draw();
                // Safe Update/Draw Loops to prevent reading properties of undefined
                for (let i = enemies.length - 1; i >= 0; i--) { 
                    let e = enemies[i]; 
                    if (e) {
                        e.update(); e.draw(); 
                        handlePlayerEnemyCollision(e);
                        if (!e.active) enemies.splice(i, 1); 
                    } else { enemies.splice(i, 1); }
                }
                for (let i = drops.length - 1; i >= 0; i--) { 
                    let d = drops[i]; 
                    if(d) {
                        d.update(); d.draw(); 
                        if (!d.active) drops.splice(i, 1); 
                    } else { drops.splice(i, 1); }
                }
                for (let i = bullets.length - 1; i >= 0; i--) {
                    let b = bullets[i]; 
                    if (!b) { bullets.splice(i, 1); continue; }
                    
                    b.update(); b.draw();
                    if (!b.active) { bullets.splice(i, 1); continue; }
                    
                        if (b.type === 'player' || b.type === 'phantom_laser' || b.type === 'juggernaut_shot' || b.type === 'player_missile') {
                        let hit = false;
                        if (boss.active) {
                            if (boss.isSnake) {
                                let distHead = Math.hypot(b.x - boss.x, b.y - boss.y);
                                if (distHead < 40) { boss.hit(b.damage); b.active = false; hit = true; particles.push(new Particle(b.x, b.y, '#ffaa00', 2, 2, 10)); } 
                                else {
                                    const segmentCount = 35; const spacing = 3; 
                                    for (let j = 1; j <= segmentCount; j+=2) {
                                        let pathIndex = j * spacing;
                                        if (pathIndex < boss.snakePath.length) {
                                            let pos = boss.snakePath[pathIndex]; let size = 30 * (1 - j/(segmentCount + 10)) + 8;
                                            if (Math.hypot(b.x - pos.x, b.y - pos.y) < size + 5) { boss.hit(b.damage * 0.5); b.active = false; hit = true; particles.push(new Particle(b.x, b.y, '#88ff88', 1, 2, 5)); break; }
                                        }
                                    }
                                }
                            } else if (boss.isHiveMother) {
                                let hitMini = false;
                                if (boss.miniHives) {
                                    for(let m of boss.miniHives) {
                                        if (!m.active) continue;
                                        if (Math.hypot(b.x - m.x, b.y - m.y) < 35) {
                                            m.hp -= b.damage;
                                            if(m.hp <= 0) { m.active = false; playSound('explosion'); for(let k=0; k<15; k++) particles.push(new Particle(m.x, m.y, '#9370db', 3, 3, 20)); } 
                                            else particles.push(new Particle(b.x, b.y, '#d8bfd8', 1, 2, 5));
                                            b.active = false; hitMini = true; hit = true; break;
                                        }
                                    }
                                }
                                if (!hitMini) {
                                    let dx = b.x - boss.x; let dy = b.y - boss.y;
                                    if (Math.sqrt(dx*dx + dy*dy) < 90) { boss.hit(b.damage); b.active = false; hit = true; particles.push(new Particle(b.x, b.y, '#9900ff', 2, 2, 10)); }
                                }
                            } else if (boss.isSyntaxError) {
                                let dist = Math.hypot(b.x - boss.x, b.y - boss.y);
                                if (dist < 50) { boss.hit(b.damage); b.active = false; hit = true; particles.push(new Particle(b.x, b.y, '#aaff00', 2, 2, 10)); }
                            } else if (boss.isNullEntity) {
                                let dist = Math.hypot(b.x - boss.x, b.y - boss.y);
                                if (dist < 60) { boss.hit(b.damage); b.active = false; hit = true; particles.push(new Particle(b.x, b.y, '#4400ff', 2, 2, 10)); }
                            } else if (boss.isOblivion) {
                                let dist = Math.hypot(b.x - boss.x, b.y - boss.y);
                                if (dist < 120) { boss.hit(b.damage); b.active = false; hit = true; particles.push(new Particle(b.x, b.y, '#ff0055', 2, 2, 10)); }
                            } else if (boss.isArchitect) {
                                let dist = Math.hypot(b.x - boss.x, b.y - boss.y);
                                if (dist < 80) { boss.hit(b.damage); b.active = false; hit = true; particles.push(new Particle(b.x, b.y, '#ffd700', 2, 2, 10)); }
                            } else if (boss.isNeonVoid) {
                                let dist = Math.hypot(b.x - boss.x, b.y - boss.y);
                                if (dist < 195) { boss.hit(b.damage); b.active = false; hit = true; particles.push(new Particle(b.x, b.y, '#b000ff', 3, 4, 16)); }
                            } else if (boss.isRiftSentinel) {
                                let dist = Math.hypot(b.x - boss.x, b.y - boss.y);
                                if (dist < 105) { boss.hit(b.damage); b.active = false; hit = true; particles.push(new Particle(b.x, b.y, '#55ddff', 3, 4, 16)); }
                            } else if (boss.isPortalPrototype) {
                                let dist = Math.hypot(b.x - boss.x, b.y - boss.y);
                                if (dist < 110) { boss.hit(b.damage); b.active = false; hit = true; particles.push(new Particle(b.x, b.y, '#ff66ff', 3, 4, 16)); }
                            } else if (boss.isAstralTrio) {
                                let hitStar = false;
                                if (!boss.astralCoreAwake) {
                                    for (let star of boss.astralStars) {
                                        if (!star.active) continue;
                                        if (Math.hypot(b.x - star.x, b.y - star.y) < 54) {
                                            star.hp -= b.damage;
                                            b.active = false; hit = true; hitStar = true;
                                            particles.push(new Particle(b.x, b.y, star.color, 3, 4, 16));
                                            if (star.hp <= 0) {
                                                star.active = false; playSound('explosion');
                                                for(let k=0; k<35; k++) particles.push(new Particle(star.x, star.y, star.color, 7, 5, 45));
                                            }
                                            break;
                                        }
                                    }
                                }
                                if (!hitStar && boss.astralCoreAwake) {
                                    let dist = Math.hypot(b.x - boss.x, b.y - boss.y);
                                    if (dist < 90) { boss.hit(b.damage); b.active = false; hit = true; particles.push(new Particle(b.x, b.y, '#cc99ff', 3, 4, 16)); }
                                }
                            } else if (boss.isCurseZero) {
                                let dist = Math.hypot(b.x - boss.x, b.y - boss.y);
                                if (dist < 92) { boss.hit(b.damage); b.active = false; hit = true; particles.push(new Particle(b.x, b.y, '#33aaff', 3, 4, 16)); }
                            } else {
                                let dx = b.x - boss.x; let dy = b.y - boss.y;
                                if (Math.sqrt(dx*dx + dy*dy) < 60) { boss.hit(b.damage); b.active = false; hit = true; particles.push(new Particle(b.x, b.y, '#ffaa00', 2, 2, 10)); }
                            }
                        }
                        if (!hit) {
                            enemies.forEach(e => {
                                if (e && e.active && Math.abs(b.x - e.x) < 20 && Math.abs(b.y - e.y) < 20) { e.hit(b.damage); b.active = false; }
                            });
                        }
                    } else {
                        let dx = b.x - player.x; let dy = b.y - player.y;
                        if (Math.sqrt(dx*dx + dy*dy) < 15) { player.hit(b.damage); b.active = false; particles.push(new Particle(b.x, b.y, '#00ffff', 2, 2, 10)); }
                    }
                }
            } else if (gameState === STATE.VICTORY_SEQUENCE) {
                player.draw(); 
                for (let i = drops.length - 1; i >= 0; i--) {
                    let d = drops[i]; 
                    if(d) {
                        d.x += (player.x - d.x)*0.1; d.y += (player.y - d.y)*0.1; 
                        if(Math.hypot(d.x - player.x, d.y - player.y) < 30) d.collect(); 
                        if (d.active) d.draw(); if (!d.active) drops.splice(i, 1);
                    } else { drops.splice(i,1); }
                }
                victoryTimer++;
                if (victoryTimer <= 100) {
                    player.x += (Math.random() - 0.5) * 2;
                    if(frames % 5 === 0) particles.push(new Particle(player.x, player.y + 20, '#00ffff', 1, 3, 5));
                }
                if (victoryTimer > 100) {
                    player.y -= 12;
                    particles.push(new Particle(player.x, player.y + 20, '#00ffff', 2, 6, 15));
                    particles.push(new Particle(player.x - 5, player.y + 20, '#00ffff', 1, 3, 10));
                    particles.push(new Particle(player.x + 5, player.y + 20, '#00ffff', 1, 3, 10));
                    if (player.y < -50) gameOver(true);
                }
            }
        }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; 
        if(p) { p.update(); p.draw(); if (p.life <= 0) particles.splice(i, 1); }
        else { particles.splice(i,1); }
    }
}

function toggleDevPanel() { const panel = document.getElementById('dev-panel'); panel.style.display = panel.style.display === 'block' ? 'none' : 'block'; }
function devSetStars() {
    const val = parseInt(document.getElementById('dev-stars').value);
    const targetMode = gameState === STATE.HANGAR ? currentHangarMode : activeDifficultyMode;
    if (!isNaN(val)) { getModeData(targetMode).stars = val; saveData(); updateUI(); if (gameState === STATE.HANGAR) updateHangarUI(); }
}
function devSkipWave() {
    const val = parseInt(document.getElementById('dev-wave').value);
    if (!isNaN(val) && val > 0 && gameState === STATE.PLAYING) { enemies = []; bullets = []; if(boss.active) boss.active = false; startWave(val); }
}
function devKillAll() {
    if (gameState === STATE.PLAYING) { enemies.forEach(e => { if (e.unbreakable) e.active = false; else e.hit(10000); }); if (boss && boss.active) { boss.hit(10000); boss.hit(10000); } }
}
function devResetStarsOnly() { CAMPAIGN_MODES.forEach(mode => { getModeData(mode).stars = 0; }); saveData(); updateUI(); if (gameState === STATE.HANGAR) updateHangarUI(); alert("Stars Reset!"); }
function devResetUpgradesOnly() {
    CAMPAIGN_MODES.forEach(mode => {
        const stats = getModeData(mode);
        stats.healthLvl = 0; stats.cannonLvl = 0; stats.engineLvl = 0; stats.magnetLvl = 0;
    });
    saveData(); updateUI(); if (gameState === STATE.HANGAR) updateHangarUI(); alert("Upgrades Reset!");
}
function devResetLevelsOnly() {
    CAMPAIGN_MODES.forEach(mode => { getModeData(mode).maxStage = 1; }); saveData();
    if (gameState === STATE.LEVEL_SELECT) updateLevelGrid(currentHangarMode);
    alert("Levels Reset to 1!");
}
function devUnlockStages() {
    CAMPAIGN_MODES.forEach(mode => { getModeData(mode).maxStage = MAX_STAGE; }); saveData();
    if (gameState === STATE.LEVEL_SELECT) updateLevelGrid(currentHangarMode);
    alert("All Stages Unlocked!");
}
function devGlobalWipe() { if(confirm("WARNING: Wipe ALL progress?")) { localStorage.removeItem('neonVoidData_v3'); localStorage.removeItem('neonVoid_visited'); location.reload(); } }
function devResetCookies() {
    localStorage.removeItem('neonVoid_visited');
    localStorage.removeItem('neonVoidData_v3');
    resetAllProgressData();
    saveData();
    updateUI();
    if (gameState === STATE.HANGAR) updateHangarUI();
    alert("Cookies, stars, ships, and upgrades reset. Refresh to see Welcome.");
}

function checkFirstVisit() {
    const visited = getCookie('neonVoid_visited');
    if (visited) { cookiesAccepted = true; initData(); resetToMenu(); } else startWelcomeSequence();
}

function startWelcomeSequence() {
    gameState = STATE.WELCOME; menuScreen.style.opacity = '0'; menuScreen.style.pointerEvents = 'none';
    const screen = document.getElementById('welcome-screen'); screen.style.opacity = '1'; screen.style.pointerEvents = 'auto';
    document.getElementById('welcome-header').innerText = "SYSTEM BOOT";
    document.getElementById('welcome-content').innerHTML = "Greetings, Pilot.<br><br>Welcome to the Neon Void. Your mission is to survive the sectors and neutralize the Rogue AI.<br><br>Are you ready to interface?";
    document.getElementById('welcome-footer').innerHTML = `<button class="btn" style="border-color: #00ff00; color: #00ff00;" onclick="showCookieStep()">INITIATE LINK</button>`;
}

function showCookieStep() {
    document.getElementById('welcome-header').innerText = "PROTOCOL CHECK";
    document.getElementById('welcome-content').innerHTML = "Systems initializing... <br><br>WARNING: Persistent Data Storage required.<br><br>But first... you gotta try these cookies. 🍪<br>They have tiny micro sensors that will scan you so we can save your progress.";
    document.getElementById('welcome-footer').innerHTML = `
        <div style="display:flex; gap:20px; width:100%; justify-content:space-between;">
            <button class="btn btn-hard" style="font-size:16px; padding:10px 20px;" onclick="handleCookies(false)">DENY (NO SAVE)</button>
            <button class="btn" style="border-color:#00ff00; color:#00ff00; font-size:16px; padding:10px 20px;" onclick="handleCookies(true)">ACCEPT COOKIES</button>
        </div>
    `;
}

function handleCookies(accepted) {
    const screen = document.getElementById('welcome-screen'); screen.style.opacity = '0'; screen.style.pointerEvents = 'none';
    if (accepted) { cookiesAccepted = true; setCookie('neonVoid_visited', 'true', 365); initData(); saveData(); } else { cookiesAccepted = false; initData(); }
    resetToMenu();
}

document.getElementById('start-hard-btn').addEventListener('click', showExpertSelect);
document.getElementById('start-easy-btn').addEventListener('click', showRookieSelect);
document.getElementById('start-insane-btn').addEventListener('click', showInsaneSelect);
document.getElementById('start-sim-btn').addEventListener('click', showSimulationSelect);
if (typeof THREE !== 'undefined') initThreeMenu();

checkFirstVisit(); requestAnimationFrame(animateGame);
