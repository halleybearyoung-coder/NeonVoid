const STATE = {
    WELCOME: 'welcome',
    MENU: 'menu',
    LEVEL_SELECT: 'level_select',
    INTRO: 'intro',
    PLAYING: 'playing',
    GAMEOVER: 'gameover',
    VICTORY_SEQUENCE: 'victory_sequence',
    HANGAR: 'hangar',
    BRIEFING: 'briefing'
};
let gameState = STATE.MENU;
let width, height;
let currentLevelIndex = 1;
let activeDifficultyMode = 'easy'; // 'easy' or 'hard'
let currentHangarMode = 'easy'; // Tracks which hangar is open
let introTimer = 30;
let introInterval = null;
let cookiesAccepted = false; // Flag to track user consent
// --- STAGE MESSAGES ---
const STAGE_MESSAGES = {
    'easy_1': "Pilot, we have lost contact with Outpost Omega. Sensors indicate the System Core has gone rogue. <br><br>Neutralize the threat before it spreads to the network.",
    'easy_2': "Warning! Massive energy signature detected. The rouge system core has overidden one of our terminator class dreadnoughts.<br><br>This won't be like the simulations. Stay sharp.",
    'easy_3': "Entering deep sector. Signal interference high. \n\nThe core is sending [ERROR CODE:1204] [SIGNAL FALIURE].",
    'easy_4': "CAUTION: Biological signature detected in the mainframe. <br><br>It's the Cyber Serpent. Aim for the head, its scales are almost impervious to standard fire.",
    'easy_5': "BINARY STAR SYSTEM DETECTED. <br><br>Two hostile signatures orbiting in sync. Focus fire to eliminate them, but beware... the survivor will seek vengeance.",
    'easy_6': "CRITICAL ERROR. REALITY INTEGRITY: 0%. <br><br>The source code itself is collapsing. <br>It's The Syntax Error. <br><br>Do not trust your senses. Do not trust your controls.",
    'hard_1': "Veteran difficulty authorized. <br><br>The enemy AI has adapted to standard tactics. Expect aggressive maneuvers.",
    'hard_2': "This is it. The Elite Terminator unit has been deployed. <br><br>Survival probability is near zero. Good luck, Commander.",
    'hard_3': "Elite Deep Sector. \n\nNo support available. You are on your own, Commander.",
    'hard_4': "THE VIPER'S NEST. <br><br>The source of the corruption has been found. The Crimson Serpent awaits. <br>Kill it.",
    'hard_5': "THE TWIN PARADOX. <br><br>Two hyper-advanced AI cores have synchronized. <br>Their combined processing power is rewriting the laws of physics. Break the cycle."
};
// --- STORAGE HELPER FUNCTIONS (Switched to LocalStorage for reliability) ---
// Note: Real cookies often fail in iframe/preview sandboxes. 
// We use LocalStorage here to ensure your save works, but keep the "Cookie" UI theme.

function setCookie(name, value, days) {
    // Using LocalStorage to mimic cookie behavior for reliability
    localStorage.setItem(name, value);
}
function getCookie(name) {
    return localStorage.getItem(name);
}
function deleteCookie(name) {
    localStorage.removeItem(name);
}
// --- DATA PERSISTENCE ---
let gameData;

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
        // Default initial state
        gameData = {
            easy: { stars: 0, healthLvl: 0, cannonLvl: 0, maxStage: 1, laserUnlocked: false },
            hard: { stars: 0, healthLvl: 0, cannonLvl: 0, maxStage: 1, laserUnlocked: false }
        };
    }
    // Ensure new properties exist for old saves
    if (gameData.easy.cannonLvl === undefined) gameData.easy.cannonLvl = 0;
    if (gameData.hard.cannonLvl === undefined) gameData.hard.cannonLvl = 0;
    if (gameData.easy.laserUnlocked === undefined) gameData.easy.laserUnlocked = false;
    if (gameData.hard.laserUnlocked === undefined) gameData.hard.laserUnlocked = false;
}
function saveData() {
    if (!cookiesAccepted) return; // DON'T SAVE IF COOKIES DENIED
    setCookie('neonVoidData_v3', JSON.stringify(gameData), 365);
}
// --- UPGRADE CONFIGURATION ---
const HEALTH_UPGRADES = {
    costs: [110, 150, 200, 600, 1100],
    bonuses: [5, 10, 15, 20, 50]
};
const CANNON_UPGRADES = {
    costs: [150, 200, 500, 1000, 10000],
    bonuses: [1, 2, 3, 4, 5]
};
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const flashOverlay = document.getElementById('flash-overlay');
const menuScreen = document.getElementById('menu-screen');
const levelSelectScreen = document.getElementById('level-select-screen');
const expertSelectScreen = document.getElementById('expert-level-select-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hangarScreen = document.getElementById('hangar-screen');
const introScreen = document.getElementById('intro-screen');
const welcomeScreen = document.getElementById('welcome-screen');
const msgModal = document.getElementById('msg-modal');

function resizeGame() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}
resizeGame();
window.addEventListener('resize', resizeGame);
// UI
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
// Input
const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    w: false, s: false, a: false, d: false
};
const mouse = { x: width / 2, y: height - 150, down: false, targetX: width / 2, targetY: height - 150 };
let isTouch = false;
/**
 * THREE.JS BACKGROUND & EFFECTS
 */
let scene, camera, renderer;
let menuCore, stars, bossPhase2Mesh, bossShieldMesh;
let isPhase2Active = false;
let supernovaMesh, supernovaParticles;
let supernovaVelocities = [];
let isSupernovaExploding = false;
// 3D GLITCH ASSETS (Stage 3)
let glitchBossMesh;
// 2D DROPS
let dropMeshes = [];
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
        // 1. Menu Core
        const geometry = new THREE.IcosahedronGeometry(10, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0.8 });
        menuCore = new THREE.Mesh(geometry, material);
        scene.add(menuCore);
        // 2. Stars
        const starGeo = new THREE.BufferGeometry();
        const starCount = 2000;
        const posArray = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount * 3; i++) posArray[i] = (Math.random() - 0.5) * 400;
        starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const starMat = new THREE.PointsMaterial({ size: 0.5, color: 0xffffff });
        stars = new THREE.Points(starGeo, starMat);
        scene.add(stars);
        // 3. PHASE 2 BOSS MESH (System Core)
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
        // 4. BOSS SHIELD (UPDATED to Sphere surface, transparent)
        // Radius reduced to 16 to prevent clipping when boss scales up
        const shieldGeo = new THREE.SphereGeometry(16, 32, 32);
        const shieldMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: false,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending // Glowy effect
        });
        bossShieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        bossShieldMesh.visible = false;
        bossPhase2Mesh.add(bossShieldMesh);
        // 5. GLITCH BOSS MESH (Octahedron)
        const glitchGeo = new THREE.OctahedronGeometry(15, 0);
        const glitchMat = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        glitchBossMesh = new THREE.Mesh(glitchGeo, glitchMat);
        glitchBossMesh.visible = false;
        glitchBossMesh.position.z = -20;
        scene.add(glitchBossMesh);
        // 6. SUPERNOVA ASSETS
        const snGeo = new THREE.SphereGeometry(1, 32, 32);
        const snMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0, wireframe: true });
        supernovaMesh = new THREE.Mesh(snGeo, snMat);
        supernovaMesh.visible = false;
        scene.add(supernovaMesh);
        const pGeo = new THREE.BufferGeometry();
        const pCount = 500; // REDUCED FROM 2000
        const pPos = new Float32Array(pCount * 3);
        supernovaVelocities = [];
        for (let i = 0; i < pCount; i++) {
            pPos[i * 3] = 0; pPos[i * 3 + 1] = 0; pPos[i * 3 + 2] = 0;
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
    if (!supernovaMesh || !supernovaParticles) return;
    isSupernovaExploding = true;

    let posToCopy = { x: 0, y: 20, z: -20 };
    if (boss && boss.isGlitch && glitchBossMesh) {
        posToCopy.x = (boss.x / width) * 120 - 60;
        posToCopy.y = (boss.y / height) * -60 + 30; // Approx
    }
    else if (bossPhase2Mesh && isPhase2Active) {
        posToCopy = bossPhase2Mesh.position;
    }
    supernovaMesh.position.copy(posToCopy);
    supernovaParticles.position.copy(posToCopy);
    if (bossPhase2Mesh) bossPhase2Mesh.visible = false;
    if (glitchBossMesh) glitchBossMesh.visible = false;

    supernovaMesh.scale.set(1, 1, 1);
    supernovaMesh.material.opacity = 1;
    supernovaMesh.visible = true;
    const positions = supernovaParticles.geometry.attributes.position.array;
    positions.fill(0);
    supernovaParticles.geometry.attributes.position.needsUpdate = true;
    supernovaParticles.material.opacity = 1;
    supernovaParticles.visible = true;
}
function animateThree() {
    requestAnimationFrame(animateThree);

    // SHOW CORE IN MENU OR LEVEL SELECT OR HANGAR OR INTRO
    if ((gameState === STATE.MENU || gameState === STATE.LEVEL_SELECT || gameState === STATE.HANGAR || gameState === STATE.INTRO || gameState === STATE.WELCOME) && menuCore) {
        menuCore.rotation.x += 0.005; menuCore.rotation.y += 0.01; menuCore.visible = true;
        if (glitchBossMesh) glitchBossMesh.visible = false;
    } else if (menuCore) { menuCore.visible = false; }
    // GLITCH BOSS UPDATE
    if (boss && boss.active && boss.isGlitch && glitchBossMesh && !isSupernovaExploding) {
        glitchBossMesh.visible = true;
        glitchBossMesh.rotation.y += 0.05;
        glitchBossMesh.rotation.z += 0.02;

        // Jitter effect
        const jitter = (Math.random() - 0.5) * 0.5;
        glitchBossMesh.scale.set(1 + jitter, 1 + jitter, 1 + jitter);

        // Position Sync (Approximate mapping from 2D canvas to 3D world)
        let targetX = (boss.x / width) * 120 - 60;
        let targetY = -(boss.y / height) * 60 + 30;

        // Instant teleport for glitch feel
        glitchBossMesh.position.x = targetX;
        glitchBossMesh.position.y = targetY;

        // Color Pulse
        const hue = (Date.now() % 2000) / 2000;
        glitchBossMesh.material.color.setHSL(hue, 1, 0.5);
    } else if (glitchBossMesh) {
        glitchBossMesh.visible = false;
    }
    // BOSS UPDATES (Original Boss)
    if (isPhase2Active && bossPhase2Mesh && !isSupernovaExploding && (!boss || !boss.isGlitch)) {
        bossPhase2Mesh.visible = true;
        bossPhase2Mesh.rotation.x += 0.02; bossPhase2Mesh.rotation.y += 0.03;

        let targetX = 0;
        if (boss) {
            targetX = (boss.x / width) * 120 - 60;

            if (bossShieldMesh) {
                bossShieldMesh.visible = (boss.shieldHp > 0);
                // Rotate Shield
                bossShieldMesh.rotation.y -= 0.02;
                // Pulse Shield Scale
                const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.05;
                bossShieldMesh.scale.set(pulse, pulse, pulse);
            }
        }
        const baseScale = 4 + Math.sin(Date.now() * 0.01) * 0.5;
        bossPhase2Mesh.scale.set(baseScale, baseScale, baseScale);
        bossPhase2Mesh.position.x += (targetX - bossPhase2Mesh.position.x) * 0.2;
        bossPhase2Mesh.position.y += (0 - bossPhase2Mesh.position.y) * 0.2;
        if (bossPhase2Mesh.material) bossPhase2Mesh.material.color.setHex(0xff3300);
        bossPhase2Mesh.rotation.z = 0;
    } else if (bossPhase2Mesh && !isSupernovaExploding) { bossPhase2Mesh.visible = false; }
    if (isSupernovaExploding) {
        const scale = supernovaMesh.scale.x + 3;
        supernovaMesh.scale.set(scale, scale, scale);
        supernovaMesh.rotation.y += 0.1;
        supernovaMesh.material.opacity -= 0.015;
        const positions = supernovaParticles.geometry.attributes.position.array;
        for (let i = 0; i < supernovaVelocities.length / 3; i++) {
            positions[i * 3] += supernovaVelocities[i * 3];
            positions[i * 3 + 1] += supernovaVelocities[i * 3 + 1];
            positions[i * 3 + 2] += supernovaVelocities[i * 3 + 2];
        }
        supernovaParticles.geometry.attributes.position.needsUpdate = true;
        supernovaParticles.material.opacity -= 0.01;
        if (supernovaMesh.material.opacity <= 0) {
            isSupernovaExploding = false;
            supernovaMesh.visible = false;
            supernovaParticles.visible = false;
        }
    }
    if (stars) { stars.rotation.y += 0.0005; stars.rotation.x += 0.0002; }
    if (renderer && scene && camera) renderer.render(scene, camera);
}
window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});
// --- UPDATED INPUT HANDLING ---
window.addEventListener('keydown', e => {
    if (gameState === STATE.PLAYING) {
        const k = e.key.toLowerCase();
        if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
        if (keys.hasOwnProperty(k)) keys[k] = true;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(e.code) > -1) {
            e.preventDefault();
        }
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
    if (e.touches && e.touches.length > 0) {
        isTouch = true; cx = e.touches[0].clientX; cy = e.touches[0].clientY; mouse.down = true;
    } else {
        isTouch = false; cx = e.clientX; cy = e.clientY; mouse.down = e.buttons === 1;
    }
    mouse.targetX = cx; mouse.targetY = isTouch ? cy - 80 : cy;
}
window.addEventListener('mousemove', updateInput);
window.addEventListener('mousedown', updateInput);
window.addEventListener('mouseup', () => mouse.down = false);
window.addEventListener('touchstart', updateInput, { passive: false });
window.addEventListener('touchmove', updateInput, { passive: false });
window.addEventListener('touchend', () => mouse.down = false);
/**
 * GAME LOGIC
 */
const ATTACK_SEQUENCE = ['laser', 'swarm', 'missiles', 'laser', 'laser', 'redLines', 'missiles', 'rings', 'laser', 'laser', 'swarm'];
const TERMINATOR_SEQUENCE = ['terminator_fireballs', 'terminator_rapid', 'terminator_laser'];
const GLITCH_SEQUENCE = ['glitch_teleport_rapid', 'glitch_grid', 'glitch_clones', 'glitch_grid', 'glitch_teleport_fire'];
const SNAKE_SEQUENCE = ['snake_sine_fire', 'snake_orb_deploy', 'snake_sine_fire', 'snake_rush'];
const BINARY_SEQUENCE = ['binary_assault'];
const SYNTAX_SEQUENCE = ['syntax_ram', 'syntax_shift', 'syntax_lag', 'syntax_shift', 'syntax_laser', 'syntax_ram'];
// --- DIFFICULTY SETTINGS ---
const DIFFICULTY = {
    NORMAL: {
        name: "VETERAN",
        playerDamage: 10,
        swarmHp: 20,
        heavyHp: 80,
        laserHp: 60,
        bossHp: 5000,
        heavyAgile: true,
        enemyCountMult: 1.0,
        fireRateMult: 1.0,
        waveDelay: 60
    },
    EASY: {
        name: "ROOKIE",
        playerDamage: 20,
        swarmHp: 10,
        heavyHp: 50,
        laserHp: 40,
        bossHp: 2500,
        heavyAgile: false,
        enemyCountMult: 0.5,
        fireRateMult: 1.5,
        waveDelay: 120
    }
};
let currentSettings = DIFFICULTY.NORMAL;
class Particle {
    constructor(x, y, color, speed, size, life) {
        this.x = x; this.y = y; this.color = color;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = Math.random() * speed;
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
        this.life = life; this.maxLife = life; this.size = size;
        this.decay = Math.random() * 0.05 + 0.92;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.vx *= this.decay; this.vy *= this.decay;
        this.life--; this.size *= 0.95;
    }
    draw() {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0.1, this.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}
class Drop {
    constructor(x, y, type) {
        this.x = x; this.y = y;
        this.type = type; // 'star' or 'health'
        this.active = true;
        this.rot = 0;
    }
    update() {
        this.y += 1.0;
        this.rot += 0.05;
        if (this.y > height + 20) this.active = false;
        if (player && player.active) {
            // MAGNET LOGIC: Gently pull stars towards player
            if (this.type === 'star') {
                let dx = player.x - this.x;
                let dy = player.y - this.y;
                let dist = Math.hypot(dx, dy);

                // "Really slow" pull speed
                const pullSpeed = 0.8;

                if (dist > 0) {
                    this.x += (dx / dist) * pullSpeed;
                    this.y += (dy / dist) * pullSpeed;
                }
            }
            let dist = Math.hypot(this.x - player.x, this.y - player.y);
            if (dist < 40) this.collect();
        }
    }
    collect() {
        this.active = false;

        if (this.type === 'star') {
            if (activeDifficultyMode === 'easy') gameData.easy.stars++;
            else gameData.hard.stars++;
            saveData();
            updateUI();
            for (let i = 0; i < 5; i++) particles.push(new Particle(this.x, this.y, '#ffd700', 3, 2, 20));
        } else if (this.type === 'health') {
            if (player.hp < player.maxHp) {
                const healAmount = player.maxHp * 0.1;
                player.hp = Math.min(player.maxHp, player.hp + healAmount);
                playerHpEl.innerText = Math.floor(player.hp);
                for (let i = 0; i < 10; i++) particles.push(new Particle(this.x, this.y, '#00ffff', 4, 3, 30));
            }
        }
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);

        if (this.type === 'star') {
            ctx.fillStyle = '#ffd700'; ctx.shadowBlur = 15; ctx.shadowColor = '#ffd700';
            ctx.beginPath();
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
        if (type === 'player') {
            this.color = '#00ffff'; this.size = 4; // Slightly bigger
            this.damage = damage || currentSettings.playerDamage;
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
            this.angle = Math.atan2(vy, vx); this.speed = 4;
            this.guidanceTimer = 90;
        } else if (type === 'glitch_laser') {
            this.color = '#ff00ff'; this.size = 2000; this.damage = 25; // Size is length
            this.isVertical = vx === 0;
            this.warmup = 60; // 1 second warning
            this.life = 80;
        } else if (type === 'venom') {
            this.color = '#00ff00'; this.size = 8; this.damage = 12;
        } else if (type === 'spine_laser') {
            this.color = '#00ff00'; this.size = 10; this.damage = 15;
        } else if (type === 'snake_orb_turret') {
            this.color = '#00ff88'; this.size = 15; this.damage = 10;
            this.life = 140; // Reduced life for boomerang effect
            this.fireTimer = 0;
            this.initialVx = vx; // Store original direction
        } else if (type === 'mine') {
            this.color = '#ff0000';
            this.size = 10;
            this.damage = 25;
            this.life = 600; // 10 seconds duration
        } else if (type === 'iceball') {
            this.color = '#0088ff'; this.size = 12; this.damage = 15;
        } else if (type === 'spinner_shot') {
            this.color = '#aa00ff'; this.size = 6; this.damage = 10;
        } else if (type === 'digit_ball') {
            this.color = '#00ff00'; this.size = 10; this.damage = 15;
            this.digit = Math.random() > 0.5 ? '1' : '0';
        }
    }
    update() {
        if (this.type === 'glitch_laser') {
            this.warmup--;
            this.life--;
            if (this.life <= 0) this.active = false;
            return; // Stationary
        }
        if (this.type === 'mine') {
            this.y += 0.5; // Mines fall slowly
            if (this.y > height + 50) this.active = false;
            if (player.active && Math.hypot(this.x - player.x, this.y - player.y) < 25) {
                player.hit(this.damage);
                this.active = false;
                for (let i = 0; i < 30; i++) particles.push(new Particle(this.x, this.y, '#ff4400', 6, 5, 40));
                for (let i = 0; i < 20; i++) particles.push(new Particle(this.x, this.y, '#00ff00', 8, 3, 50));
                for (let i = 0; i < 15; i++) particles.push(new Particle(this.x, this.y, '#bbbbbb', 3, 15 + Math.random() * 10, 70));
            }
            return; // Stationary
        }
        if (this.type === 'snake_orb_turret') {
            this.fireTimer++;
            if (this.fireTimer < 40) { this.x += this.vx; this.y += this.vy; }
            else if (this.fireTimer < 90) {
                if (this.fireTimer === 60) {
                    for (let i = 0; i < 12; i++) {
                        let angle = (Math.PI * 2 / 12) * i;
                        bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 5, Math.sin(angle) * 5, 'venom'));
                    }
                    for (let i = 0; i < 10; i++) particles.push(new Particle(this.x, this.y, '#ffffff', 3, 2, 20));
                }
            }
            else if (this.fireTimer < 130) { this.x -= this.vx; this.y -= this.vy; }
            else { this.active = false; }

            if (player.active && Math.hypot(this.x - player.x, this.y - player.y) < 30) { player.hit(10); }
            return;
        }
        if (this.type === 'missile' && player.active && this.guidanceTimer > 0) {
            let dx = player.x - this.x; let dy = player.y - this.y;
            let targetAngle = Math.atan2(dy, dx);
            let diff = targetAngle - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.angle += diff * 0.05;
            this.vx = Math.cos(this.angle) * this.speed;
            this.vy = Math.sin(this.angle) * this.speed;
            this.guidanceTimer--;
            if (Math.random() > 0.5) particles.push(new Particle(this.x, this.y, '#555', 1, 3, 20));
        }
        if (this.type === 'fireball') {
            particles.push(new Particle(this.x, this.y, '#ffaa00', 1, 4, 10));
        }
        if (this.type === 'iceball') {
            particles.push(new Particle(this.x, this.y, '#0088ff', 1, 3, 10));
        }
        if (this.type === 'spinner_shot') {
            particles.push(new Particle(this.x, this.y, '#aa00ff', 1, 3, 8));
        }
        if (this.type === 'venom') {
            particles.push(new Particle(this.x, this.y, '#00ff00', 1, 3, 8));
        }
        this.x += this.vx; this.y += this.vy;
        if (this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100) this.active = false;
    }
    draw() {
        if (this.type === 'player') {
            ctx.save();
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size + 4);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.4, '#00ffff');
            grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            return;
        }
        if (this.type === 'glitch_laser') {
            ctx.save();
            if (this.warmup > 0) {
                ctx.strokeStyle = `rgba(255, 0, 255, ${0.5 + Math.sin(frames * 0.5) * 0.5})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
            } else {
                ctx.strokeStyle = '#ff00ff';
                ctx.lineWidth = 10 + Math.random() * 5;
                ctx.shadowBlur = 20; ctx.shadowColor = '#ff00ff';
                ctx.setLineDash([]);
            }
            ctx.beginPath();
            if (this.isVertical) { ctx.moveTo(this.x, 0); ctx.lineTo(this.x, height); }
            else { ctx.moveTo(0, this.y); ctx.lineTo(width, this.y); }
            ctx.stroke();
            ctx.restore();
            return;
        }
        if (this.type === 'digit_ball') {
            ctx.save();
            ctx.fillStyle = '#00ff00';
            ctx.font = '20px monospace';
            ctx.fillText(this.digit, this.x, this.y);
            ctx.restore();
            return;
        }
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        if (this.type === 'missile') {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
            ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, 5); ctx.lineTo(-5, -5); ctx.fill();
            ctx.restore();
        } else if (this.type === 'fireball' || this.type === 'boss_orb' || this.type === 'iceball' || this.type === 'venom') {
            ctx.save();
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(0.5, this.color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (this.type === 'saw') {
            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(frames * 0.5);
            ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#888"; for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(12, -4, 8, 8); }
            ctx.fillStyle = "#ff0000"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (this.type === 'snake_orb_turret') {
            ctx.save();
            ctx.shadowBlur = 15; ctx.shadowColor = '#00ff88';
            ctx.fillStyle = '#00ff88';
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size + Math.sin(frames * 0.2) * 5, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        } else if (this.type === 'mine') {
            ctx.save();
            ctx.shadowBlur = 10; ctx.shadowColor = '#ff0000';
            // Green shell
            ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, Math.PI * 2); ctx.stroke();
            // Red pulsing core
            ctx.fillStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(frames * 0.1) * 0.5})`;
            ctx.beginPath(); ctx.arc(this.x, this.y, 6, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else if (this.type === 'spinner_shot') {
            ctx.save();
            ctx.shadowBlur = 10; ctx.shadowColor = '#aa00ff';
            ctx.fillStyle = '#aa00ff';
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;
    }
}

class Spinner {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.active = true;
        this.hp = 80;
        this.angle = 0;
        this.fireTimer = 0;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = 0.5;
    }
    update() {
        if (!this.active) return;
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 50 || this.x > width - 50) this.vx *= -1;

        this.angle += 0.05;
        this.fireTimer++;

        // Fire every 60 frames (1 sec)
        if (this.fireTimer >= 60) {
            this.fireTimer = 0;
            // 4 directions relative to rotation
            for (let i = 0; i < 4; i++) {
                let theta = this.angle + (Math.PI / 2 * i);
                bullets.push(new Bullet(this.x, this.y, Math.cos(theta) * 4, Math.sin(theta) * 4, 'spinner_shot'));
            }
        }

        if (this.y > height + 50) this.active = false;
    }
    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = '#4b0082'; // Indigo/Purple
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15; ctx.shadowColor = '#ff00ff';

        // Square Body
        ctx.fillRect(-20, -20, 40, 40);
        ctx.strokeRect(-20, -20, 40, 40);

        // Core
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-5, -5, 10, 10);

        // Gun ports
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(-5, -25, 10, 5); // Top
        ctx.fillRect(-5, 20, 10, 5);  // Bottom
        ctx.fillRect(-25, -5, 5, 10); // Left
        ctx.fillRect(20, -5, 5, 10);  // Right

        ctx.restore();
    }
    hit(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.active = false;
            score += 300; scoreEl.innerText = score;
            for (let i = 0; i < 15; i++) particles.push(new Particle(this.x, this.y, '#ff00ff', 4, 4, 30));
            drops.push(new Drop(this.x, this.y, 'star'));
        }
    }
}
class MineLayer {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.active = true;
        this.hp = 60;
        this.dropTimer = 60;
        this.vx = (Math.random() - 0.5) * 1.5;
    }
    update() {
        if (!this.active) return;
        this.y += 0.3;
        this.x += this.vx;
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
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#006600';
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10; ctx.shadowColor = '#00ff00';
        ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(-5, -12, 10, 24);
        ctx.fillRect(-12, -5, 24, 10);
        ctx.restore();
    }
    hit(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.active = false; score += 400; scoreEl.innerText = score;
            for (let i = 0; i < 10; i++) particles.push(new Particle(this.x, this.y, '#00ff00', 4, 4, 30));
            drops.push(new Drop(this.x, this.y, 'star'));
        }
    }
}
class Player {
    constructor() {
        this.x = width / 2; this.y = height - 100;
        this.active = true; this.iframes = 0; this.speed = 8;
        let baseHp = 100;
        let bonusHp = 0;
        const stats = gameData[activeDifficultyMode];

        const hpLevel = stats.healthLvl;
        for (let i = 0; i < hpLevel; i++) { bonusHp += HEALTH_UPGRADES.bonuses[i]; }
        this.maxHp = baseHp + bonusHp;
        this.hp = this.maxHp;
        playerHpEl.innerText = Math.floor(this.hp);
        let bonusDamage = 0;
        const cannonLevel = stats.cannonLvl;
        for (let i = 0; i < cannonLevel; i++) { bonusDamage += CANNON_UPGRADES.bonuses[i]; }
        this.damage = currentSettings.playerDamage + bonusDamage;

        // Status Effects
        this.frozenTimer = 0;
        this.burnTimer = 0;
        this.controlsReversedTimer = 0;
        this.lagSlowTimer = 0;

        // Ability
        this.hasLaser = stats.laserUnlocked;
        this.abilityCooldown = 0;
        this.laserActiveTimer = 0;

        // UI update
        const btn = document.getElementById('ability-btn');
        if (this.hasLaser) {
            btn.style.display = 'flex';
            btn.innerText = "BEAM\nREADY";
            btn.classList.remove('cooldown');
        } else {
            btn.style.display = 'none';
        }
    }
    update() {
        if (!this.active) return;

        // Control Reversal Logic
        if (this.controlsReversedTimer > 0) {
            this.controlsReversedTimer--;
            if (this.controlsReversedTimer % 10 === 0) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
                ctx.fillRect(0, 0, width, height);
            }
            if (this.controlsReversedTimer === 0) {
                waveText.style.opacity = 0; // Hide warning
            }
        }

        // Lag Spike Logic (Slow Motion)
        let currentSpeed = this.speed;
        if (this.lagSlowTimer > 0) {
            this.lagSlowTimer--;
            currentSpeed = 2; // Super slow
        }

        // Ability Cooldown
        if (this.abilityCooldown > 0) {
            this.abilityCooldown--;
            if (this.abilityCooldown % 60 === 0) {
                const btn = document.getElementById('ability-btn');
                btn.innerText = Math.ceil(this.abilityCooldown / 60);
            }
            if (this.abilityCooldown <= 0) {
                const btn = document.getElementById('ability-btn');
                btn.classList.remove('cooldown');
                btn.innerHTML = "BEAM<br>READY";
            }
        }

        // Active Laser
        if (this.laserActiveTimer > 0) {
            this.laserActiveTimer--;
            // FX
            particles.push(new Particle(this.x + (Math.random() - 0.5) * 20, this.y, '#00ffff', 2, 4, 10));
        }
        // Handle Freeze Status
        if (this.frozenTimer > 0) {
            this.frozenTimer--;
        }

        // Handle Burn Status
        if (this.burnTimer > 0) {
            this.burnTimer--;
            if (frames % 10 === 0) {
                particles.push(new Particle(this.x + (Math.random() - 0.5) * 30, this.y + (Math.random() - 0.5) * 30, '#ff4400', 1, 3, 20));
            }
        }
        if (gameState === STATE.PLAYING) {
            // Only move if not frozen
            if (this.frozenTimer <= 0) {
                let dx = 0, dy = 0;

                // KEYBOARD INPUT
                if (keys.ArrowUp || keys.w) dy -= currentSpeed;
                if (keys.ArrowDown || keys.s) dy += currentSpeed;
                if (keys.ArrowLeft || keys.a) dx -= currentSpeed;
                if (keys.ArrowRight || keys.d) dx += currentSpeed;

                // Apply Control Reversal
                if (this.controlsReversedTimer > 0) {
                    dx = -dx;
                    dy = -dy;
                }

                if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

                if (dx !== 0 || dy !== 0) {
                    this.x += dx; this.y += dy;
                    // Sync mouse target so it doesn't snap back when you release keys
                    mouse.targetX = this.x; mouse.targetY = this.y;
                } else if (mouse.targetX !== undefined) {
                    // MOUSE FOLLOW LOGIC
                    // Calculate vector to mouse
                    let vmx = mouse.targetX - this.x;
                    let vmy = mouse.targetY - this.y;

                    // Apply Reversal to Vector (Push AWAY from mouse)
                    if (this.controlsReversedTimer > 0) {
                        vmx = -vmx;
                        vmy = -vmy;
                    }

                    // Apply speed/drag
                    this.x += vmx * 0.15;
                    this.y += vmy * 0.15;
                }
                this.x = Math.max(20, Math.min(width - 20, this.x));
                this.y = Math.max(20, Math.min(height - 20, this.y));
            }
            // SHOOTING (SINGLE SHOT)
            let fireRate = (this.lagSlowTimer > 0) ? 12 : 6; // Slower fire in lag
            if (frames % fireRate === 0) {
                bullets.push(new Bullet(this.x, this.y - 20, 0, -15, 'player', this.damage));
            }
        }
        if (this.iframes > 0) this.iframes--;

        // Engine trails
        if (frames % 2 === 0) {
            particles.push(new Particle(this.x - 8, this.y + 25, '#00ffff', 2, 3, 10));
            particles.push(new Particle(this.x + 8, this.y + 25, '#00ffff', 2, 3, 10));
        }
    }
    draw() {
        if (!this.active && gameState !== STATE.VICTORY_SEQUENCE) return;
        if (this.iframes > 0 && Math.floor(frames / 4) % 2 === 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // --- DETAILED SHIP GRAPHICS ---
        const bodyGrad = ctx.createLinearGradient(0, -20, 0, 20);
        bodyGrad.addColorStop(0, '#ffffff');
        bodyGrad.addColorStop(0.5, '#00aaaa');
        bodyGrad.addColorStop(1, '#005555');

        ctx.fillStyle = bodyGrad;
        ctx.shadowBlur = 15; ctx.shadowColor = '#00ffff';

        // Fuselage
        ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(8, -5); ctx.lineTo(8, 15); ctx.lineTo(0, 25); ctx.lineTo(-8, 15); ctx.lineTo(-8, -5); ctx.closePath(); ctx.fill();
        // Wings
        ctx.fillStyle = '#008888';
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(25, 15); ctx.lineTo(25, 25); ctx.lineTo(8, 15); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-25, 15); ctx.lineTo(-25, 25); ctx.lineTo(-8, 15); ctx.closePath(); ctx.fill();
        // Cockpit
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(3, 0); ctx.lineTo(0, 5); ctx.lineTo(-3, 0); ctx.fill();
        // Ice Overlay
        if (this.frozenTimer > 0) {
            ctx.fillStyle = 'rgba(0, 200, 255, 0.6)';
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(30, 0); ctx.lineTo(0, 35); ctx.lineTo(-30, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();

        // Draw BEAM
        if (this.laserActiveTimer > 0) {
            ctx.save();
            const width = 40 + Math.sin(frames * 0.8) * 10;

            // Core
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 30; ctx.shadowColor = '#00ffff';
            ctx.fillRect(this.x - width / 4, 0, width / 2, this.y);

            // Outer
            ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
            ctx.fillRect(this.x - width / 2, 0, width, this.y);

            ctx.restore();
        }
    }
    hit(damage) {
        if (this.iframes > 0 || !this.active) return;
        this.hp -= damage; this.iframes = 30;
        playerHpEl.innerText = Math.max(0, Math.floor(this.hp));
        ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
        setTimeout(() => ctx.setTransform(1, 0, 0, 1, 0, 0), 50);
        if (this.hp <= 0) {
            this.active = false;
            for (let i = 0; i < 30; i++) particles.push(new Particle(this.x, this.y, '#00ffff', 5, 5, 60));
            gameOver(false);
        }
    }
    freeze() {
        if (this.iframes <= 0 && this.active) {
            this.frozenTimer = 120; // 2 seconds
            for (let i = 0; i < 15; i++) particles.push(new Particle(this.x, this.y, '#aaddff', 3, 3, 30));
        }
    }
    burn() {
        if (this.active) {
            this.burnTimer = 300; // 5 seconds burn visual
            for (let i = 0; i < 10; i++) particles.push(new Particle(this.x, this.y, '#ffaa00', 4, 4, 30));
        }
    }
    reverseControls() {
        this.controlsReversedTimer = 120; // 2 Seconds
        waveText.innerText = "CONTROLS REVERSED";
        waveText.style.color = "#ff0000";
        waveText.style.opacity = 1;
        waveText.style.transform = "scale(1)";
        waveText.style.textShadow = "0 0 10px red";

        // Random Teleport
        this.x = Math.random() * (width - 40) + 20;
        this.y = Math.random() * (height - 40) + 20;

        for (let i = 0; i < 20; i++) particles.push(new Particle(this.x, this.y, '#00ff00', 5, 5, 30));
    }
}
class SwarmEnemy {
    constructor(x, y) {
        this.x = x; this.y = y; this.origX = x; this.origY = y;
        this.active = true;
        this.hp = currentSettings.swarmHp;
        this.timeOffset = Math.random() * 100;
        this.fireTimer = (Math.random() * 120 + 60) * currentSettings.fireRateMult;
        this.points = 100;
    }
    update() {
        if (!this.active) return;
        this.x = this.origX + Math.sin((frames + this.timeOffset) * 0.05) * 50;
        this.y += 1.5;
        this.fireTimer--;
        if (this.fireTimer <= 0) {
            let angle = Math.atan2(player.y - this.y, player.x - this.x);
            bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 4, Math.sin(angle) * 4, 'boss_orb'));
            this.fireTimer = (120 + Math.random() * 60) * currentSettings.fireRateMult;
        }
        if (this.y > height + 20) this.active = false;
    }
    draw() {
        if (!this.active) return;
        ctx.fillStyle = '#aa00aa'; ctx.shadowBlur = 5; ctx.shadowColor = '#ff00ff';
        ctx.beginPath(); ctx.moveTo(this.x, this.y - 10); ctx.lineTo(this.x + 10, this.y);
        ctx.lineTo(this.x, this.y + 10); ctx.lineTo(this.x - 10, this.y); ctx.fill();
        ctx.shadowBlur = 0;
    }
    hit(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.active = false; score += this.points; scoreEl.innerText = score;
            for (let i = 0; i < 5; i++) particles.push(new Particle(this.x, this.y, '#ff00ff', 3, 3, 30));
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
    }
    update() {
        if (!this.active) return;
        this.y += 1.0;
        if (currentSettings.heavyAgile) {
            this.x += this.vx;
            if (this.x < 50 || this.x > width - 50) this.vx *= -1;
        }
        this.fireTimer--;
        if (this.fireTimer <= 0) {
            let angle = Math.atan2(player.y - this.y, player.x - this.x);
            bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 4, Math.sin(angle) * 4, 'boss_orb'));
            bullets.push(new Bullet(this.x, this.y, Math.cos(angle - 0.3) * 4, Math.sin(angle - 0.3) * 4, 'boss_orb'));
            bullets.push(new Bullet(this.x, this.y, Math.cos(angle + 0.3) * 4, Math.sin(angle + 0.3) * 4, 'boss_orb'));
            this.fireTimer = 100 * currentSettings.fireRateMult;
        }
        if (this.y > height + 50) this.active = false;
    }
    draw() {
        if (!this.active) return;
        ctx.fillStyle = '#ff4400';
        ctx.shadowBlur = 10; ctx.shadowColor = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + 20);
        ctx.lineTo(this.x + 20, this.y - 10);
        ctx.lineTo(this.x - 20, this.y - 10);
        ctx.fill();
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(this.x - 5, this.y - 5, 10, 10);
        ctx.shadowBlur = 0;
    }
    hit(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.active = false; score += this.points; scoreEl.innerText = score;
            for (let i = 0; i < 10; i++) particles.push(new Particle(this.x, this.y, '#ff4400', 4, 5, 40));
            for (let k = 0; k < 3; k++) drops.push(new Drop(this.x + (k * 10 - 10), this.y, 'star'));
        }
    }
}
class LaserEnemy {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.active = true;
        this.hp = currentSettings.laserHp;
        this.state = 'enter';
        this.timer = 0;
        this.points = 500;
    }
    update() {
        if (!this.active) return;
        this.timer++;
        if (this.state === 'enter') {
            this.y += 3;
            if (this.y > 100 + Math.random() * 100) this.state = 'charge';
        } else if (this.state === 'charge') {
            let trackSpeed = currentSettings.heavyAgile ? 1.0 : 0.5;
            if (player.x > this.x) this.x += trackSpeed;
            else this.x -= trackSpeed;
            if (this.timer > 100) {
                this.state = 'fire';
                this.timer = 0;
            }
        } else if (this.state === 'fire') {
            if (this.timer > 30) {
                if (Math.abs(player.x - this.x) < 20) player.hit(2);
                if (this.timer > 80) {
                    this.state = 'leave';
                }
            }
        } else if (this.state === 'leave') {
            this.y += 5;
            if (this.y > height + 50) this.active = false;
        }
    }
    draw() {
        if (!this.active) return;
        if (this.state === 'fire' && this.timer > 30) {
            ctx.save();
            ctx.shadowBlur = 20; ctx.shadowColor = 'cyan';
            ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
            ctx.fillRect(this.x - 10, this.y, 20, height);
            ctx.fillStyle = 'white';
            ctx.fillRect(this.x - 4, this.y, 8, height);
            ctx.restore();
        } else if (this.state === 'charge') {
            ctx.strokeStyle = `rgba(0, 255, 255, ${Math.random()})`;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x, height);
            ctx.stroke();
        }
        ctx.fillStyle = '#00aaaa';
        ctx.shadowBlur = 10; ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + 15);
        ctx.lineTo(this.x + 15, this.y - 15);
        ctx.lineTo(this.x - 15, this.y - 15);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    hit(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.active = false; score += this.points; scoreEl.innerText = score;
            for (let i = 0; i < 10; i++) particles.push(new Particle(this.x, this.y, '#00aaaa', 4, 5, 40));
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
        this.isTerminator = false; // New Property for Terminator
        this.isGlitch = false; // Stage 3 Boss
        this.isSnake = false; // Stage 4 Boss
        this.isBinaryStars = false; // Stage 5 Boss (Replaces Hive Mother)
        this.isSyntaxError = false; // Stage 6 Boss
        this.snakePath = []; // For snake movement history
        this.clones = []; // For glitch boss
        this.targetX = width / 2;
        this.shredderMode = false; // Phase 2 Terminator
        this.sawRingTimer = 0; // Phase 3 Terminator

        // Stage 5 Props (Binary Stars)
        this.twinRed = null;
        this.twinBlue = null;
        this.binaryAngle = 0;
        // Stage 6 Props (Syntax Error)
        this.currentShape = 'mess'; // 'mess', 'dragon', 'ball', 'ship'
        this.lagSpikeActive = false;
        // Shield Props
        this.shieldHp = 0;
        this.maxShieldHp = 500;
    }
    // Called when starting Stage 2 specifically
    initAsStage2() {
        this.isPhaseTwo = false;
        this.isTerminator = true;
        this.isGlitch = false;
        this.isSnake = false;
        this.isBinaryStars = false;
        this.isSyntaxError = false;
        this.damageMultiplier = 1.5;
        this.maxHp = (activeDifficultyMode === 'hard') ? 6000 : 3000;
        this.hp = this.maxHp;
        this.shredderMode = false;
        bossName.innerText = activeDifficultyMode === 'hard' ? "TERMINATOR [ELITE]" : "TERMINATOR";
        bossName.style.color = "#ff0000";
        isPhase2Active = false;
    }
    // Called when starting Stage 3 specifically
    initAsStage3() {
        this.isPhaseTwo = false;
        this.isTerminator = false;
        this.isGlitch = true;
        this.isSnake = false;
        this.isBinaryStars = false;
        this.isSyntaxError = false;
        this.damageMultiplier = 2.0;
        this.maxHp = (activeDifficultyMode === 'hard') ? 4000 : 4000;
        this.hp = this.maxHp;
        bossName.innerText = "PHANTOM PROTOCOL";
        bossName.style.color = "#ff00ff";
        isPhase2Active = false;
        this.clones = [];
    }
    // Called when starting Stage 4 (Beginner OR Expert)
    initAsStage4() {
        this.isPhaseTwo = false;
        this.isTerminator = false;
        this.isGlitch = false;
        this.isBinaryStars = false;
        this.isSyntaxError = false;
        this.isSnake = true;

        if (activeDifficultyMode === 'hard') {
            // Expert Snake
            this.damageMultiplier = 2.0;
            this.maxHp = 6000;
            bossName.innerText = "THE CRIMSON SERPENT";
            bossName.style.color = "#ff0000"; // Red for expert
        } else {
            // Beginner Snake
            this.damageMultiplier = 1.2;
            this.maxHp = 2500;
            bossName.innerText = "THE CYBER SERPENT";
            bossName.style.color = "#00ff00"; // Green for beginner
        }

        this.hp = this.maxHp;
        isPhase2Active = false;
        this.snakePath = [];
        // Pre-fill snake path so body doesn't glitch on spawn
        for (let i = 0; i < 300; i++) {
            this.snakePath.push({ x: width / 2, y: -100 });
        }
    }
    // Called when starting Stage 5 (Beginner)
    initAsStage5() {
        this.isPhaseTwo = false;
        this.isTerminator = false;
        this.isGlitch = false;
        this.isSnake = false;
        this.isBinaryStars = true;
        this.isSyntaxError = false;
        this.damageMultiplier = 1.0;

        // Each twin has 2500 HP (5000 for Hard)
        const hp = (activeDifficultyMode === 'hard') ? 5000 : 2500;
        this.twinRed = { active: true, hp: hp, maxHp: hp, x: 0, y: 0 };
        this.twinBlue = { active: true, hp: hp, maxHp: hp, x: 0, y: 0 };

        this.maxHp = hp * 2; // Combined
        this.hp = this.maxHp;

        bossName.innerText = "THE BINARY STARS";
        bossName.style.color = "#ff88ff";
        isPhase2Active = false;
        this.targetY = 150;
        this.binaryAngle = 0;
    }
    // Called when starting Stage 6 (Beginner)
    initAsStage6() {
        this.isPhaseTwo = false;
        this.isTerminator = false;
        this.isGlitch = false;
        this.isSnake = false;
        this.isBinaryStars = false;
        this.isSyntaxError = true;
        this.damageMultiplier = 1.5;
        this.maxHp = 6000;
        this.hp = this.maxHp;
        bossName.innerText = "THE SYNTAX ERROR";
        bossName.style.fontFamily = "Courier New, monospace";
        bossName.style.color = "#00ff00";
        bossName.style.textShadow = "0 0 5px #00ff00";
        isPhase2Active = false;
        this.currentShape = 'mess';
    }
    activate() {
        this.active = true;
        bossHud.style.opacity = 1;
    }
    update() {
        if (!this.active) return;
        if (this.flashTimer > 0) this.flashTimer--;
        if (this.phase === 'entry') {
            this.y += (this.targetY - this.y) * 0.05;
            // If snake, also update path during entry
            if (this.isSnake) {
                this.snakePath.unshift({ x: this.x, y: this.y });
                if (this.snakePath.length > 300) this.snakePath.pop();
            }
            if (Math.abs(this.y - this.targetY) < 1) {
                this.phase = 'fight';
                this.startNextAttack();
            }
            return;
        }
        // --- SYNTAX ERROR LOGIC ---
        if (this.isSyntaxError) {
            // True Form Trigger
            if (!this.isPhaseTwo && this.hp < this.maxHp / 2) {
                this.isPhaseTwo = true;
                bossName.innerText = "FATAL EXCEPTION";
                bossName.style.color = "#ff0000";
                waveText.innerText = "TRUE FORM REVEALED";
                waveText.style.color = "#ff0000";
                waveText.style.opacity = 1;
                waveText.style.transform = "scale(1)";
                setTimeout(() => { waveText.style.opacity = 0; }, 2000);
                for (let i = 0; i < 50; i++) particles.push(new Particle(this.x, this.y, '#00ff00', 8, 5, 60));
            }

            // True Form Passive Attack (Digit Balls)
            if (this.isPhaseTwo && frames % 60 === 0) {
                let angle = Math.atan2(player.y - this.y, player.x - this.x);
                bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 6, Math.sin(angle) * 6, 'digit_ball'));
                bullets.push(new Bullet(this.x, this.y, Math.cos(angle - 0.5) * 6, Math.sin(angle - 0.5) * 6, 'digit_ball'));
                bullets.push(new Bullet(this.x, this.y, Math.cos(angle + 0.5) * 6, Math.sin(angle + 0.5) * 6, 'digit_ball'));
            }

            // Lag Spike Movement (Boss moves fast, Player is slow)
            if (this.lagSpikeActive) {
                // Teleporting chaotically
                if (frames % 10 === 0) {
                    this.x = Math.max(50, Math.min(width - 50, this.x + (Math.random() - 0.5) * 300));
                    this.y = Math.max(50, Math.min(300, this.y + (Math.random() - 0.5) * 100));
                }
            } else if (this.currentAttack === 'syntax_ram') {
                // Ram movement
                this.y += 15;
                if (this.y > height + 100) {
                    this.y = -100;
                    this.x = player.x; // Re-target
                }
            } else {
                // Standard hover
                this.x = width / 2 + Math.sin(frames * 0.05) * 200;
                this.y = 150 + Math.cos(frames * 0.03) * 50;
            }
        }
        // --- BINARY STARS LOGIC ---
        else if (this.isBinaryStars) {
            // Center hover
            this.y = this.targetY + Math.sin(frames * 0.02) * 20;
            this.x = width / 2 + Math.cos(frames * 0.01) * 50;
            // Orbit logic
            this.binaryAngle += 0.03;
            const radius = 100;

            if (this.twinRed.active) {
                this.twinRed.x = this.x + Math.cos(this.binaryAngle) * radius;
                this.twinRed.y = this.y + Math.sin(this.binaryAngle) * radius;
            }
            if (this.twinBlue.active) {
                this.twinBlue.x = this.x + Math.cos(this.binaryAngle + Math.PI) * radius;
                this.twinBlue.y = this.y + Math.sin(this.binaryAngle + Math.PI) * radius;
            }

            // Update main HP bar
            let currentTotal = 0;
            if (this.twinRed.active) currentTotal += this.twinRed.hp;
            if (this.twinBlue.active) currentTotal += this.twinBlue.hp;
            this.hp = currentTotal;
            bossHealthBar.style.width = `${(this.hp / this.maxHp) * 100}%`;

            if (this.hp <= 0) {
                this.active = false;
                startVictorySequence();
            }
        }
        // --- SNAKE BOSS LOGIC ---
        else if (this.isSnake) {
            // Sine Wave Movement (Slower)
            const time = frames * 0.03; // Reduced from 0.05
            const ampX = (width / 2) - 100;

            // Move X in sine wave
            let targetX = (width / 2) + Math.sin(time) * ampX;

            // Move Y to track player, but keep some sine movement to look "snake-like"
            // Lerp towards player Y
            let targetY = player.y;

            // Add "hover" feel so it doesn't just sit exactly on player Y
            targetY += Math.sin(time * 1.5) * 100;
            // Rush overrides (Slower rush undulation)
            if (this.currentAttack === 'snake_rush') {
                targetY = player.y + Math.sin(frames * 0.05) * 150;
                targetX = (width / 2) + Math.sin(frames * 0.04) * ampX;
            }
            // Reduced lerp speeds for smoother, heavier movement
            this.x += (targetX - this.x) * 0.03;
            this.y += (targetY - this.y) * 0.04;
            // Record history for body segments
            this.snakePath.unshift({ x: this.x, y: this.y });
            if (this.snakePath.length > 300) this.snakePath.pop();
        }
        // --- TERMINATOR SPECIFIC PHASE LOGIC ---
        else if (this.isTerminator) {
            if (!this.shredderMode && this.hp <= 1500) {
                this.shredderMode = true;
                this.triggerShredderMode();
            }
            if (this.hp <= 750) {
                this.sawRingTimer++;
                if (this.sawRingTimer >= 120) {
                    this.sawRingTimer = 0;
                    for (let i = 0; i < 12; i++) {
                        let angle = (Math.PI * 2 / 12) * i;
                        bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 6, Math.sin(angle) * 6, 'saw'));
                    }
                    waveText.innerText = "SAW RING DETECTED";
                    waveText.style.opacity = 1;
                    waveText.style.transform = "scale(0.8)";
                    setTimeout(() => { waveText.style.opacity = 0; }, 1000);
                }
            }
            if (this.shredderMode && frames % 60 === 0) {
                bullets.push(new Bullet(this.x - 100, this.y, -5, 5, 'saw'));
                bullets.push(new Bullet(this.x + 100, this.y, 5, 5, 'saw'));
            }
            // Terminator Movement
            if (this.currentAttack !== 'terminator_laser') {
                this.x = width / 2 + Math.sin(frames * 0.03) * 150;
            }
        }
        // --- GLITCH BOSS PHASE LOGIC ---
        else if (this.isGlitch) {
            // Random teleport regardless of current attack (approx every ~3.3 sec)
            if (this.phase === 'fight' && Math.random() < 0.005) {
                // Teleport FX
                for (let i = 0; i < 15; i++) particles.push(new Particle(this.x, this.y, '#00ffff', 4, 3, 20));
                // New Position
                this.x = 50 + Math.random() * (width - 100);
                this.y = 50 + Math.random() * (height / 2);
            }
        }
        // --- STANDARD BOSS LOGIC ---
        else {
            if (!this.isPhaseTwo && this.hp < this.maxHp / 2) {
                this.triggerPhaseTwo();
            }
            if (!this.isDesperationMode && this.hp <= 1000 && this.isPhaseTwo) {
                this.isDesperationMode = true;
                for (let i = 0; i < 20; i++) particles.push(new Particle(this.x, this.y, '#ffffff', 5, 3, 20));
            }
            // Standard Movement
            if (!(this.isDesperationMode && this.laserActive)) {
                this.x = width / 2 + Math.sin(frames * 0.02) * 100;
            }
        }

        this.attackTimer++;

        // Passive Spawn (Disabled for special bosses)
        if (!this.isTerminator && !this.isGlitch && !this.isSnake && !this.isBinaryStars && !this.isSyntaxError && frames % Math.floor(this.spawnRate) === 0 && this.currentAttack !== 'laser' && this.phase === 'fight') {
            enemies.push(new SwarmEnemy(this.x - 40, this.y));
            enemies.push(new SwarmEnemy(this.x + 40, this.y));
        }
        this.handleAttack();
    }
    triggerShredderMode() {
        waveText.innerText = "OPERATION SHREDDER";
        waveText.style.color = "#ff0000";
        waveText.style.opacity = 1;
        waveText.style.transform = "scale(1)";
        setTimeout(() => { waveText.style.opacity = 0; }, 2000);
        for (let i = 0; i < 50; i++) particles.push(new Particle(this.x, this.y, '#ff0000', 8, 5, 60));
    }
    triggerPhaseTwo() {
        this.isPhaseTwo = true;
        this.damageMultiplier = 2;
        this.spawnRate = 45 * currentSettings.fireRateMult;
        for (let i = 0; i < 100; i++) particles.push(new Particle(this.x, this.y, '#ff3300', 10, 8, 80));

        bossName.innerText = "System Core: OMEGA UNLEASHED";
        bossName.style.color = "#ffaa00";
        isPhase2Active = true;
        // TRIGGER SHIELD
        this.shieldHp = 1000;
        bossShieldContainer.style.display = "block";
        bossShieldBar.style.width = "100%";
        createShockwave(this.x, this.y);

        flashOverlay.style.transition = 'none';
        flashOverlay.style.opacity = 1;
        void flashOverlay.offsetWidth;
        flashOverlay.style.transition = 'opacity 2s ease-out';
        flashOverlay.style.opacity = 0;
    }
    startNextAttack() {
        let seq = ATTACK_SEQUENCE;
        if (this.isTerminator) seq = TERMINATOR_SEQUENCE;
        if (this.isGlitch) seq = GLITCH_SEQUENCE;
        if (this.isSnake) seq = SNAKE_SEQUENCE;
        if (this.isBinaryStars) seq = BINARY_SEQUENCE;
        if (this.isSyntaxError) seq = SYNTAX_SEQUENCE;

        if (this.sequenceIndex >= seq.length) this.sequenceIndex = 0;
        this.currentAttack = seq[this.sequenceIndex];
        this.attackTimer = 0;
        this.sequenceIndex++;

        let phaseName = this.currentAttack.toUpperCase();
        phaseName = phaseName.replace(/^(TERMINATOR|GLITCH|SNAKE|BINARY|SYNTAX)_/, "");

        phaseDebug.innerText = `PHASE: ${phaseName}`;

        this.laserCharge = 0; this.laserActive = false; this.redLines = [];
        this.laserAngle = Math.PI / 2;
        this.lockTarget = false;
        this.clones = []; // Reset clones
        this.lagSpikeActive = false; // Reset Lag Spike
    }
    handleAttack() {
        switch (this.currentAttack) {
            // --- SYNTAX ERROR ATTACKS ---
            case 'syntax_ram':
                this.currentShape = 'ball';
                // Movement handled in update()
                if (this.attackTimer > 150) this.startNextAttack();
                break;
            case 'syntax_shift':
                if (this.attackTimer === 1) {
                    const shapes = ['mess', 'dragon', 'ball', 'ship'];
                    this.currentShape = shapes[Math.floor(Math.random() * shapes.length)];
                    for (let i = 0; i < 20; i++) particles.push(new Particle(this.x, this.y, '#00ff00', 5, 5, 30));
                }
                if (this.attackTimer > 50) this.startNextAttack();
                break;
            case 'syntax_lag':
                this.currentShape = 'mess';
                this.lagSpikeActive = true;
                player.lagSlowTimer = 2; // Keep refreshing it
                if (this.attackTimer > 200) {
                    this.lagSpikeActive = false;
                    this.startNextAttack();
                }
                break;
            case 'syntax_laser':
                this.currentShape = 'ship';
                if (this.attackTimer < 60) {
                    // Charge
                    this.laserCharge = this.attackTimer / 60;
                } else if (this.attackTimer < 140) {
                    // Fire
                    this.laserActive = true;
                    if (Math.abs(player.x - this.x) < 40) player.hit(2);
                } else {
                    this.laserActive = false;
                    this.startNextAttack();
                }
                break;

            // --- BINARY STARS ATTACK ---
            case 'binary_assault':
                // If one dies, the other rages (double fire rate)
                let redRate = this.twinBlue.active ? 60 : 30; // 60 normally, 30 if blue dead
                let blueRate = this.twinRed.active ? 80 : 40; // 80 normally, 40 if red dead
                // Red Fires (Fireballs - Spread of 3)
                if (this.twinRed.active && this.attackTimer % redRate === 0) {
                    let angle = Math.atan2(player.y - this.twinRed.y, player.x - this.twinRed.x);
                    for (let i = -1; i <= 1; i++) {
                        let spread = angle + (i * 0.2);
                        bullets.push(new Bullet(this.twinRed.x, this.twinRed.y, Math.cos(spread) * 7, Math.sin(spread) * 7, 'fireball'));
                    }
                }

                // Blue Fires (Iceballs - Spread of 3)
                if (this.twinBlue.active && this.attackTimer % blueRate === 0) {
                    let angle = Math.atan2(player.y - this.twinBlue.y, player.x - this.twinBlue.x);
                    for (let i = -1; i <= 1; i++) {
                        let spread = angle + (i * 0.2);
                        bullets.push(new Bullet(this.twinBlue.x, this.twinBlue.y, Math.cos(spread) * 4, Math.sin(spread) * 4, 'iceball'));
                    }
                }

                // Loop indefinite
                if (this.attackTimer > 1000) this.startNextAttack();
                break;
            // --- SNAKE BOSS ATTACKS ---
            case 'snake_sine_fire':
                // Head shoots green venom spread (Slower fire rate)
                if (this.attackTimer % 45 === 0 && this.attackTimer < 200) { // Was 25
                    let angle = Math.atan2(player.y - this.y, player.x - this.x);
                    bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 6, Math.sin(angle) * 6, 'venom'));
                    bullets.push(new Bullet(this.x, this.y, Math.cos(angle - 0.3) * 6, Math.sin(angle - 0.3) * 6, 'venom'));
                    bullets.push(new Bullet(this.x, this.y, Math.cos(angle + 0.3) * 6, Math.sin(angle + 0.3) * 6, 'venom'));
                }
                if (this.attackTimer > 250) this.startNextAttack();
                break;
            case 'snake_orb_deploy':
                if (this.attackTimer === 20) {
                    // Deploy 2 orbs from BODY segments (approx segment 15 and 30)
                    // pathIndex = index * spacing (2) -> 30 and 60
                    if (this.snakePath.length > 60) {
                        let p1 = this.snakePath[30];
                        let p2 = this.snakePath[60];

                        // Spawn moving OUTWARDS from the snake
                        // Left Orb
                        bullets.push(new Bullet(p1.x, p1.y, -4, 0.5, 'snake_orb_turret'));
                        // Right Orb
                        bullets.push(new Bullet(p2.x, p2.y, 4, 0.5, 'snake_orb_turret'));
                    }
                }
                if (this.attackTimer > 100) this.startNextAttack();
                break;
            case 'snake_segment_laser':
                // Middle segments shoot sideways (Slower fire rate)
                if (this.attackTimer % 50 === 0 && this.attackTimer < 240) { // Was 30
                    // Fire from segments 10, 20, 30 approx
                    let indices = [10, 20, 30];
                    // Since we changed spacing to 2, index 10 = 20 frames back, etc.
                    indices.forEach(idx => {
                        let pathIdx = idx * 2;
                        if (pathIdx < this.snakePath.length) {
                            let pos = this.snakePath[pathIdx];
                            // Fire Left
                            bullets.push(new Bullet(pos.x, pos.y, -6, 0, 'spine_laser'));
                            // Fire Right
                            bullets.push(new Bullet(pos.x, pos.y, 6, 0, 'spine_laser'));
                        }
                    });
                }
                if (this.attackTimer > 260) this.startNextAttack();
                break;
            case 'snake_rush':
                // Movement speed is increased in update(), just do minor firing here
                if (this.attackTimer % 20 === 0) { // Was 10
                    bullets.push(new Bullet(this.x, this.y, 0, 8, 'venom'));
                }
                if (this.attackTimer > 200) this.startNextAttack();
                break;
            // --- GLITCH ATTACKS ---
            case 'glitch_teleport_rapid':
                // Teleport every 40 frames and shoot
                if (this.attackTimer % 40 === 0 && this.attackTimer < 200) {
                    // FX at old pos
                    for (let i = 0; i < 10; i++) particles.push(new Particle(this.x, this.y, '#ff00ff', 4, 3, 20));
                    // Teleport
                    this.x = 50 + Math.random() * (width - 100);
                    this.y = 50 + Math.random() * (height / 2);
                    // Fire at player
                    let angle = Math.atan2(player.y - this.y, player.x - this.x);
                    bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 8, Math.sin(angle) * 8, 'boss_orb'));
                }
                if (this.attackTimer > 240) this.startNextAttack();
                break;

            case 'glitch_grid':
                // Spawn grid
                if (this.attackTimer === 30) {
                    // Vertical Lines
                    for (let i = 0; i < 5; i++) {
                        bullets.push(new Bullet(100 + i * (width / 5), 0, 0, 0, 'glitch_laser'));
                    }
                    // Horizontal Lines
                    for (let i = 0; i < 3; i++) {
                        bullets.push(new Bullet(0, 100 + i * 150, 1, 0, 'glitch_laser')); // vx=1 is flag for horizontal
                    }
                }
                if (this.attackTimer > 150) this.startNextAttack();
                break;
            case 'glitch_clones':
                if (this.attackTimer === 10) {
                    // Spawn 2 random clones
                    this.clones = [];
                    const count = 2;
                    for (let i = 0; i < count; i++) {
                        const cx = 50 + Math.random() * (width - 100);
                        const cy = 50 + Math.random() * (height / 2 + 100);
                        this.clones.push({ x: cx, y: cy });
                    }
                }
                // Clones fire too
                if (this.attackTimer > 40 && this.attackTimer % 30 === 0 && this.attackTimer < 200) {
                    // Real boss shoots 5 bullets
                    let angle = Math.atan2(player.y - this.y, player.x - this.x);
                    for (let i = -2; i <= 2; i++) {
                        let spread = angle + (i * 0.2);
                        bullets.push(new Bullet(this.x, this.y, Math.cos(spread) * 5, Math.sin(spread) * 5, 'boss_orb'));
                    }

                    // Clones shoot normally
                    this.clones.forEach(c => {
                        let cAngle = Math.atan2(player.y - c.y, player.x - c.x);
                        bullets.push(new Bullet(c.x, c.y, Math.cos(cAngle) * 5, Math.sin(cAngle) * 5, 'boss_orb'));
                    });
                }
                if (this.attackTimer > 250) this.startNextAttack();
                break;

            case 'glitch_teleport_fire':
                // Teleport to center, spray rings
                if (this.attackTimer === 1) {
                    this.x = width / 2; this.y = 100;
                }
                if (this.attackTimer % 20 === 0 && this.attackTimer < 200) {
                    let count = 12;
                    for (let i = 0; i < count; i++) {
                        let angle = (Math.PI * 2 / count) * i + this.attackTimer * 0.1;
                        bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 6, Math.sin(angle) * 6, 'boss_orb'));
                    }
                }
                if (this.attackTimer > 250) this.startNextAttack();
                break;

            // --- TERMINATOR ATTACKS ---
            case 'terminator_fireballs':
                if (this.attackTimer % 40 === 0 && this.attackTimer < 200) {
                    let angle = Math.atan2(player.y - this.y, player.x - this.x);
                    bullets.push(new Bullet(this.x - 60, this.y, Math.cos(angle) * 6, Math.sin(angle) * 6, 'fireball'));
                    bullets.push(new Bullet(this.x + 60, this.y, Math.cos(angle) * 6, Math.sin(angle) * 6, 'fireball'));
                }
                if (this.attackTimer > 250) this.startNextAttack();
                break;
            case 'terminator_rapid':
                if (this.attackTimer % 10 === 0 && this.attackTimer < 150) {
                    bullets.push(new Bullet(this.x, this.y + 40, (Math.random() - 0.5) * 2, 8, 'fireball'));
                }
                if (this.attackTimer > 200) this.startNextAttack();
                break;
            case 'terminator_laser':
                if (this.attackTimer < 60) {
                    this.laserCharge = this.attackTimer / 60;
                    let target = Math.atan2(player.y - this.y, player.x - this.x);
                    this.laserAngle = target;
                } else if (this.attackTimer === 60) {
                    this.lockTarget = true;
                } else if (this.attackTimer < 160) {
                    this.laserActive = true;
                    let angle = this.laserAngle;
                    let dx = player.x - this.x; let dy = player.y - this.y;
                    let rAngle = -angle + Math.PI / 2;
                    let rx = dx * Math.cos(rAngle) - dy * Math.sin(rAngle);
                    let ry = dx * Math.sin(rAngle) + dy * Math.cos(rAngle);
                    if (Math.abs(rx) < 30 && ry > 0) player.hit(2);
                } else {
                    this.laserActive = false;
                    this.lockTarget = false;
                    if (this.attackTimer > 200) this.startNextAttack();
                }
                break;
            // --- STANDARD BOSS ATTACKS ---
            case 'laser':
                if (this.attackTimer < 60) {
                    this.laserCharge = this.attackTimer / 60;
                    if (this.isDesperationMode) {
                        let target = Math.atan2(player.y - this.y, player.x - this.x);
                        let diff = target - this.laserAngle;
                        while (diff < -Math.PI) diff += Math.PI * 2;
                        while (diff > Math.PI) diff -= Math.PI * 2;
                        this.laserAngle += diff * 0.1;
                    } else {
                        this.laserAngle = Math.PI / 2;
                    }
                } else if (this.attackTimer < 160) {
                    this.laserActive = true;
                    let hit = false;
                    if (this.isDesperationMode) {
                        let dx = player.x - this.x; let dy = player.y - this.y;
                        let angle = -(this.laserAngle - Math.PI / 2);
                        let rx = dx * Math.cos(angle) - dy * Math.sin(angle);
                        if (Math.abs(rx) < 30 && dy > 0) hit = true;
                    } else {
                        if (Math.abs(player.x - this.x) < 30) hit = true;
                    }
                    if (hit) player.hit(2 * this.damageMultiplier);
                    if (frames % 4 === 0) {
                        ctx.translate(Math.random() * 4 - 2, 0);
                        setTimeout(() => ctx.setTransform(1, 0, 0, 1, 0, 0), 20);
                    }
                } else {
                    this.laserActive = false;
                    if (this.attackTimer > 200) this.startNextAttack();
                }
                break;
            case 'swarm':
                if (this.attackTimer === 1) {
                    let count = this.isPhaseTwo ? 15 : 10;
                    count = Math.floor(count * currentSettings.enemyCountMult);
                    for (let i = 0; i < count; i++) enemies.push(new SwarmEnemy(Math.random() * width, -50 - (i * 50)));
                }
                if (this.attackTimer > 400) this.startNextAttack();
                break;
            case 'redLines':
                if (this.attackTimer === 1) {
                    let count = Math.ceil(5 * currentSettings.enemyCountMult);
                    for (let i = 0; i < count; i++) this.redLines.push({ x: Math.random() * width, width: 2, damage: false });
                }
                if (this.attackTimer > 100 && this.attackTimer < 160) {
                    this.redLines.forEach(l => {
                        l.width = 40; l.damage = true;
                        if (l.damage && Math.abs(player.x - l.x) < 20) player.hit(1 * this.damageMultiplier);
                    });
                }
                if (this.attackTimer > 200) this.startNextAttack();
                break;
            case 'rings':
                if (this.attackTimer % 40 === 0 && this.attackTimer < 300) {
                    let count = this.isPhaseTwo ? 24 : 16;
                    count = Math.floor(count * currentSettings.enemyCountMult);
                    for (let i = 0; i < count; i++) {
                        let angle = (Math.PI * 2 / count) * i + (this.attackTimer * 0.01);
                        bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * 5, Math.sin(angle) * 5, 'boss_orb'));
                    }
                }
                if (this.attackTimer > 350) this.startNextAttack();
                break;
            case 'missiles':
                if (this.attackTimer % 30 === 0 && this.attackTimer < 200) {
                    bullets.push(new Bullet(this.x - 50, this.y, -3, -3, 'missile'));
                    bullets.push(new Bullet(this.x + 50, this.y, 3, -3, 'missile'));
                    if (this.isPhaseTwo) bullets.push(new Bullet(this.x, this.y - 20, 0, -4, 'missile'));
                }
                if (this.attackTimer > 300) this.startNextAttack();
                break;
            case 'fireballs': // Default boss fireball
                if (this.attackTimer % 30 === 0 && this.attackTimer < 200) {
                    bullets.push(new Bullet(this.x - 40, this.y, (player.x - (this.x - 40)) * 0.02, (player.y - this.y) * 0.02, 'fireball'));
                    bullets.push(new Bullet(this.x + 40, this.y, (player.x - (this.x + 40)) * 0.02, (player.y - this.y) * 0.02, 'fireball'));
                }
                if (this.attackTimer > 250) this.startNextAttack();
                break;
        }
    }
    draw() {
        if (!this.active) return;

        // --- SYNTAX ERROR DRAWING ---
        if (this.isSyntaxError) {
            ctx.save();
            ctx.translate(this.x, this.y);

            // Flash Colors
            const colors = ['#00ff00', '#ffffff', '#ff00ff', '#000000'];
            ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
            ctx.font = '24px monospace';

            // LAG SPIKE VISUAL
            if (this.lagSpikeActive) {
                ctx.fillStyle = "#ffffff";
                ctx.fillText("BUFFERING...", -50, -60);
            }

            // Draw based on Shape
            if (this.currentShape === 'mess') {
                // Random characters cloud
                for (let i = 0; i < 10; i++) {
                    let char = String.fromCharCode(33 + Math.random() * 90);
                    ctx.fillText(char, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
                }
            } else if (this.currentShape === 'ball') {
                // Clump
                for (let i = 0; i < 30; i++) {
                    let char = String.fromCharCode(48 + Math.floor(Math.random() * 10)); // Numbers
                    let angle = Math.random() * Math.PI * 2;
                    let r = Math.random() * 40;
                    ctx.fillText(char, Math.cos(angle) * r, Math.sin(angle) * r);
                }
                // Spikes
                ctx.strokeStyle = '#00ff00';
                for (let i = 0; i < 8; i++) {
                    ctx.beginPath(); ctx.moveTo(0, 0);
                    let a = (Math.PI * 2 / 8) * i + frames * 0.1;
                    ctx.lineTo(Math.cos(a) * 60, Math.sin(a) * 60);
                    ctx.stroke();
                }
            } else if (this.currentShape === 'dragon') {
                // Trail
                for (let i = 0; i < 10; i++) {
                    let char = "ERROR";
                    ctx.fillText(char, Math.sin(frames * 0.1 + i) * 30, i * 20);
                }
            } else if (this.currentShape === 'ship') {
                // ASCII Ship
                ctx.fillStyle = '#00ff00';
                ctx.fillText("  /\\  ", -20, -20);
                ctx.fillText(" /  \\ ", -20, 0);
                ctx.fillText("/____\\", -20, 20);

                // Laser
                if (this.laserActive) {
                    ctx.fillStyle = '#00ff00';
                    ctx.fillRect(-10, 30, 20, 1000);
                }
            }

            ctx.restore();
            return;
        }
        // --- BINARY STARS DRAWING ---
        if (this.isBinaryStars) {
            const rageMode = (!this.twinRed.active || !this.twinBlue.active);

            // Draw RED Twin (The Sun)
            if (this.twinRed.active) {
                ctx.save();
                ctx.translate(this.twinRed.x, this.twinRed.y);

                // Rage effect
                if (!this.twinBlue.active) {
                    ctx.shadowBlur = 50; ctx.shadowColor = '#ff0000';
                    ctx.scale(1.2, 1.2); // Grow slightly in rage
                } else {
                    ctx.shadowBlur = 20; ctx.shadowColor = '#ff4400';
                }

                // Rotating Corona (Jagged)
                ctx.save();
                ctx.rotate(frames * (rageMode ? 0.1 : 0.05));
                ctx.fillStyle = `rgba(255, 50, 0, 0.6)`;
                ctx.beginPath();
                for (let i = 0; i < 12; i++) {
                    let a = (Math.PI * 2 / 12) * i;
                    let r = 40 + (i % 2 === 0 ? 10 : 0);
                    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                }
                ctx.closePath();
                ctx.fill();
                ctx.restore();
                // Inner Core
                const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 30);
                grad.addColorStop(0, '#ffff00');
                grad.addColorStop(0.5, '#ff8800');
                grad.addColorStop(1, '#880000');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();

                ctx.restore();
            }
            // Draw BLUE Twin (The Moon/Crystal)
            if (this.twinBlue.active) {
                ctx.save();
                ctx.translate(this.twinBlue.x, this.twinBlue.y);

                // Rage effect
                if (!this.twinRed.active) {
                    ctx.shadowBlur = 50; ctx.shadowColor = '#00ffff';
                    ctx.scale(1.2, 1.2);
                } else {
                    ctx.shadowBlur = 20; ctx.shadowColor = '#0088ff';
                }
                // Rotating Crystal Rings
                ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
                ctx.lineWidth = 3;

                // Ring 1
                ctx.save();
                ctx.rotate(-frames * (rageMode ? 0.1 : 0.03));
                ctx.strokeRect(-45, -45, 90, 90);
                ctx.restore();
                // Ring 2
                ctx.save();
                ctx.rotate(frames * (rageMode ? 0.08 : 0.02) + Math.PI / 4);
                ctx.strokeRect(-35, -35, 70, 70);
                ctx.restore();
                // Core
                const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 25);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.5, '#00ffff');
                grad.addColorStop(1, '#000088');
                ctx.fillStyle = grad;

                // Diamond shape
                ctx.beginPath();
                ctx.moveTo(0, -30); ctx.lineTo(30, 0); ctx.lineTo(0, 30); ctx.lineTo(-30, 0);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            }
            return;
        }
        // --- SNAKE BOSS DRAWING ---
        if (this.isSnake) {
            // Increased segment count and reduced spacing for "connected" look
            const segmentCount = 50;
            const spacing = 2; // Frames apart - very close

            // Color based on difficulty
            const mainColor = (activeDifficultyMode === 'hard') ? '#ff0000' : '#00ff00';
            const altColor = (activeDifficultyMode === 'hard') ? '#880000' : '#008800';
            const detailColor = (activeDifficultyMode === 'hard') ? '#ff4444' : '#00aa00';
            for (let i = segmentCount; i > 0; i--) {
                let pathIndex = i * spacing;
                if (pathIndex < this.snakePath.length) {
                    let pos = this.snakePath[pathIndex];

                    // Check for tail whip collision (simple proximity)
                    if (this.currentAttack === 'snake_rush' && player.active) {
                        let d = Math.hypot(pos.x - player.x, pos.y - player.y);
                        if (d < 30) player.hit(2);
                    }
                    ctx.save();
                    ctx.translate(pos.x, pos.y);
                    ctx.fillStyle = (i % 4 === 0) ? altColor : detailColor;
                    ctx.shadowBlur = 10; ctx.shadowColor = mainColor;

                    // Taper size from head to tail
                    let size = 30 * (1 - i / (segmentCount + 10)) + 8;
                    // Segment Shape
                    ctx.beginPath();
                    ctx.arc(0, 0, size, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                }
            }
            // Draw Head
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.shadowBlur = 20; ctx.shadowColor = mainColor;

            // Head Shape (Bigger 1.5x)
            ctx.fillStyle = mainColor;
            ctx.beginPath();
            ctx.moveTo(0, 30); // Nose
            ctx.lineTo(30, -15);
            ctx.lineTo(15, -30);
            ctx.lineTo(-15, -30);
            ctx.lineTo(-30, -15);
            ctx.closePath();
            ctx.fill();
            // Eyes (Bigger)
            ctx.fillStyle = (activeDifficultyMode === 'hard') ? '#ffff00' : '#ff0000';
            ctx.beginPath(); ctx.arc(-15, 0, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(15, 0, 6, 0, Math.PI * 2); ctx.fill();
            if (this.flashTimer > 0) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = "white";
                ctx.fill();
            }
            ctx.restore();
            return;
        }
        // --- GLITCH DRAWING ---
        if (this.isGlitch) {
            ctx.save();

            // Draw Main Boss (Visual is handled by 3D mostly, but 2D hit area needed)
            // Draw a flickering diamond shape
            ctx.translate(this.x, this.y);
            if (frames % 4 === 0) ctx.translate((Math.random() - 0.5) * 10, 0); // Glitch jitter

            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15; ctx.shadowColor = '#ff00ff';
            ctx.beginPath();
            ctx.moveTo(0, -60); ctx.lineTo(60, 0); ctx.lineTo(0, 60); ctx.lineTo(-60, 0); ctx.closePath();
            ctx.stroke();

            // Inner Fill
            ctx.fillStyle = `rgba(255, 0, 255, ${0.2 + Math.sin(frames * 0.1) * 0.2})`;
            ctx.fill();
            ctx.restore();
            // Draw Clones
            this.clones.forEach(c => {
                ctx.save();
                ctx.translate(c.x, c.y);
                // Make them less transparent (higher alpha)
                ctx.globalAlpha = 0.8 + Math.sin(frames * 0.5) * 0.1; // Range 0.7 - 0.9
                ctx.strokeStyle = '#00ffff'; // Cyan clones
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, -50); ctx.lineTo(50, 0); ctx.lineTo(0, 50); ctx.lineTo(-50, 0); ctx.closePath();
                ctx.stroke();
                ctx.restore();
            });

            return;
        }
        // --- TERMINATOR DRAWING (GIANT RED SHIP) ---
        if (this.isTerminator) {
            ctx.save(); ctx.translate(this.x, this.y);

            // TERMINATOR LASER
            if (this.currentAttack === 'terminator_laser') {
                ctx.rotate(this.laserAngle - Math.PI / 2);

                if (this.attackTimer < 60) {
                    ctx.fillStyle = `rgba(255, 0, 0, ${this.laserCharge})`;
                    ctx.beginPath(); ctx.arc(0, 0, this.laserCharge * 20, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = "rgba(255, 0, 0, 0.3)"; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 1000); ctx.stroke();
                }
                else if (this.laserActive) {
                    ctx.save();
                    ctx.shadowBlur = 40; ctx.shadowColor = "red";
                    ctx.fillStyle = "rgba(255, 0, 0, 0.9)";
                    ctx.fillRect(-30, 0, 60, height * 1.5);
                    ctx.fillStyle = "white";
                    ctx.fillRect(-10, 0, 20, height * 1.5);
                    ctx.restore();
                }
                ctx.rotate(-(this.laserAngle - Math.PI / 2));
            }

            // 2D SHIELD FOR TERMINATOR
            if (this.shieldHp > 0) {
                ctx.save();
                if (this.currentAttack === 'terminator_laser') ctx.rotate(this.laserAngle - Math.PI / 2);
                else ctx.rotate(Math.PI);
                ctx.beginPath();
                ctx.arc(0, 10, 80, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 + Math.sin(frames * 0.1) * 0.2})`;
                ctx.lineWidth = 5;
                ctx.shadowBlur = 20; ctx.shadowColor = "cyan";
                ctx.stroke();
                ctx.fillStyle = "rgba(0, 255, 255, 0.1)";
                ctx.fill();
                ctx.restore();
            }
            ctx.scale(4, 4);
            ctx.shadowBlur = 20; ctx.shadowColor = '#ff0000'; ctx.fillStyle = '#ffcccc';
            ctx.rotate(Math.PI);
            ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(15, 15); ctx.lineTo(0, 10); ctx.lineTo(-15, 15); ctx.fill();
            ctx.fillStyle = '#880000';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20, 10); ctx.lineTo(20, 25); ctx.lineTo(5, 15); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-20, 10); ctx.lineTo(-20, 25); ctx.lineTo(-5, 15); ctx.fill();
            ctx.fillStyle = "#ffaa00";
            ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
            if (this.flashTimer > 0) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = "white";
                ctx.fill();
            }
            ctx.restore();
            return;
        }
        // --- STANDARD BOSS DRAWING ---
        ctx.save(); ctx.translate(this.x, this.y);
        // 2D SHIELD BACKUP FOR SYSTEM CORE
        if (this.shieldHp > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, 90, 0, Math.PI * 2); // 90px radius
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.6 + Math.sin(frames * 0.2) * 0.3})`;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15; ctx.shadowColor = "#00ffff";
            ctx.stroke();
            ctx.fillStyle = "rgba(0, 255, 255, 0.15)";
            ctx.fill();
            ctx.restore();
        }
        if (this.currentAttack === 'laser') {
            ctx.rotate(this.laserAngle - Math.PI / 2);
            if (this.attackTimer < 60) {
                ctx.strokeStyle = `rgba(255, 0, 0, ${Math.random()})`; ctx.lineWidth = 1;
                for (let i = 0; i < 5; i++) {
                    ctx.beginPath(); ctx.moveTo((Math.random() - 0.5) * 200, 200); ctx.lineTo(0, 40); ctx.stroke();
                }
                ctx.fillStyle = `rgba(255, 200, 200, ${this.laserCharge})`;
                ctx.beginPath(); ctx.arc(0, 50, this.laserCharge * 20, 0, Math.PI * 2); ctx.fill();
            } else if (this.laserActive) {
                ctx.save(); ctx.shadowBlur = 40; ctx.shadowColor = "red";
                const beamWidth = 60 + Math.sin(frames * 0.5) * 5;
                ctx.fillStyle = this.isPhaseTwo ? "rgba(255, 50, 0, 0.9)" : "rgba(255, 0, 0, 0.7)";
                ctx.fillRect(-beamWidth / 2, 0, beamWidth, height * 1.5);
                ctx.fillStyle = "white"; ctx.fillRect(-beamWidth / 4, 0, beamWidth / 2, height * 1.5);
                ctx.restore();

                if (Math.random() > 0.5) particles.push(new Particle(this.x, this.y + 50, '#ff5500', 5, 8, 30));
            }
        }
        if (this.isPhaseTwo) ctx.globalAlpha = 0.5;
        if (this.flashTimer > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffffff'; }
        else { ctx.shadowBlur = 30; ctx.shadowColor = '#ff3300'; ctx.fillStyle = '#880000'; }

        ctx.rotate(-(this.laserAngle - Math.PI / 2));
        ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
        if (this.flashTimer > 0) ctx.globalCompositeOperation = 'source-over';

        ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(0, 0, 60, frames * 0.1, frames * 0.1 + 4); ctx.stroke();
        ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 70, -frames * 0.1, -frames * 0.1 + 4); ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1.0;
        if (this.currentAttack === 'redLines') {
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
    }
    hit(damage) {
        if (this.phase !== 'fight') return;

        // BINARY STARS HIT LOGIC
        if (this.isBinaryStars) {
            // Check against Red
            if (this.twinRed.active) {
                // Approximate hitbox
                if (Math.hypot(this.twinRed.x - player.x, this.twinRed.y - player.y) < 200) { // Using a big range to catch bullet positions?
                    // Wait, need to check bullet pos in main logic, here we just receive damage
                    // But hit() is called by Bullet, passing damage. Bullet needs to know WHICH one it hit.
                    // Actually, the bullet collision logic calls boss.hit().
                    // We should update collision logic in animateGame instead to handle multiple hitboxes properly
                    // For now, let's just assume if this is called, we check proximity to find who got hit
                }
            }
            return;
            // This method is awkward for multi-part bosses without passing coordinates.
            // I will update the collision logic in the bullet loop instead.
        }
        // SHIELD MECHANIC
        if (this.shieldHp > 0) {
            this.shieldHp -= damage;
            bossShieldBar.style.width = `${(this.shieldHp / this.maxShieldHp) * 100}%`;
            if (this.shieldHp <= 0) {
                bossShieldBar.style.width = "0%";
                bossShieldContainer.style.display = "none"; // Hide bar container when shield is gone
                for (let i = 0; i < 30; i++) particles.push(new Particle(this.x, this.y, '#00ffff', 5, 5, 40));
            }
            return;
        }
        this.hp -= damage;
        this.flashTimer = 4;
        bossHealthBar.style.width = `${(this.hp / this.maxHp) * 100}%`;
        if (this.hp <= 0 && this.active) {
            this.active = false; bossHealthBar.style.width = '0%';
            isPhase2Active = false;
            this.isTerminator = false;
            for (let i = 0; i < 100; i++) {
                particles.push(new Particle(this.x, this.y, '#ffaa00', 10, 8, 100));
                particles.push(new Particle(this.x, this.y, '#ffffff', 15, 5, 120));
            }

            flashOverlay.style.transition = 'none';
            flashOverlay.style.opacity = 1;
            void flashOverlay.offsetWidth;
            flashOverlay.style.transition = 'opacity 2s ease-out';
            flashOverlay.style.opacity = 0;

            let dropCount = 50;
            for (let k = 0; k < dropCount; k++) {
                drops.push(new Drop(this.x + (Math.random() - 0.5) * 500, this.y, 'star'));
            }
            triggerSupernova();
            startVictorySequence();
        }
    }
}
function createShockwave(x, y) {
    for (let i = 0; i < 360; i += 10) {
        let angle = i * Math.PI / 180;
        particles.push(new Particle(x, y, '#ffffff', 10, 3, 20));
    }
}
let currentWave = 0;
let waveClearCheckReady = false;
let midGameBriefingShown = false; // Flag to prevent loop
function startWave(wave) {
    // Check for Stage 5 Wave 5 Interruption (Mine Layer)
    if (currentLevelIndex === 5 && wave === 5 && !midGameBriefingShown) {
        showMidGameBriefing();
        return;
    }
    // Check for Stage 2 Wave 5 Interruption (Spinner)
    if (currentLevelIndex === 2 && wave === 5 && !midGameBriefingShown) {
        showMidGameBriefing();
        return;
    }
    currentWave = wave;
    waveClearCheckReady = false;

    // Cap logic
    let maxWaves = (currentLevelIndex === 1) ? 10 : 15;
    waveText.innerText = currentWave === maxWaves ? "BOSS WARNING" : `WAVE ${currentWave}`;
    waveText.style.color = "#fff";
    waveText.style.opacity = 1;
    waveText.style.transform = "scale(1.2)";

    setTimeout(() => {
        waveText.style.opacity = 0;
        waveText.style.transform = "scale(0.5)";
        spawnWaveEnemies(wave);
    }, 2000);
}
function showMidGameBriefing() {
    gameState = STATE.BRIEFING;
    const screen = document.getElementById('mid-game-screen');
    screen.style.opacity = '1';
    screen.style.pointerEvents = 'auto';
    midGameBriefingShown = true;

    // Customize Briefing Text based on Level
    const contentDiv = screen.querySelector('.radio-content');
    const descDiv = screen.querySelectorAll('div')[2]; // The description text div
    if (currentLevelIndex === 5) {
        contentDiv.innerHTML = 'NEW THREAT IDENTIFIED: <span style="color: #fff; font-weight: bold;">THE MINE LAYER</span>';
        descDiv.innerHTML = 'Heavily armored transport dropping high-yield proximity mines. <br><span style="color: #ff4444;">AVOID THE RED ZONES. DO NOT TOUCH THE MINES.</span>';
    } else if (currentLevelIndex === 2) {
        contentDiv.innerHTML = 'NEW THREAT IDENTIFIED: <span style="color: #fff; font-weight: bold;">THE SPINNER</span>';
        descDiv.innerHTML = 'Rotational defense unit. Fires a suppression web in all cardinal directions. <br><span style="color: #ff00ff;">TIMING IS KEY. WEAVE THROUGH THE PATTERN.</span>';
    }
    // Start preview animation
    animateBriefingPreview();
}
function closeMidGameBriefing(e) {
    if (e) e.preventDefault();
    const screen = document.getElementById('mid-game-screen');
    screen.style.opacity = '0';
    screen.style.pointerEvents = 'none';
    gameState = STATE.PLAYING;
    // Resume wave start
    startWave(5);
}
let briefingFrame = 0;
function animateBriefingPreview() {
    if (gameState !== STATE.BRIEFING) return;
    requestAnimationFrame(animateBriefingPreview);

    const canvas = document.getElementById('briefingCanvas');
    const bCtx = canvas.getContext('2d');
    bCtx.clearRect(0, 0, 80, 80);
    bCtx.save();
    bCtx.translate(40, 40);

    if (currentLevelIndex === 5) {
        // --- DRAW MINE LAYER ---
        // Oscillate slightly
        bCtx.translate(0, Math.sin(briefingFrame * 0.05) * 3);

        // Draw Ship
        bCtx.fillStyle = '#006600';
        bCtx.strokeStyle = '#00ff00';
        bCtx.lineWidth = 2;
        bCtx.shadowBlur = 10; bCtx.shadowColor = '#00ff00';
        bCtx.beginPath(); bCtx.arc(0, 0, 25, 0, Math.PI * 2); bCtx.fill(); bCtx.stroke();
        bCtx.fillStyle = '#00ff00';
        bCtx.fillRect(-5, -12, 10, 24);
        bCtx.fillRect(-12, -5, 24, 10);
    } else if (currentLevelIndex === 2) {
        // --- DRAW SPINNER ---
        bCtx.rotate(briefingFrame * 0.05);
        bCtx.fillStyle = '#4b0082';
        bCtx.strokeStyle = '#ff00ff';
        bCtx.lineWidth = 3;
        bCtx.shadowBlur = 15; bCtx.shadowColor = '#ff00ff';

        // Square Body
        bCtx.fillRect(-20, -20, 40, 40);
        bCtx.strokeRect(-20, -20, 40, 40);

        // Core
        bCtx.fillStyle = '#ffffff';
        bCtx.fillRect(-5, -5, 10, 10);
        // Preview shots moving out
        if (briefingFrame % 60 < 20) {
            bCtx.fillStyle = '#ff00ff';
            // Fake bullets for preview
            let dist = (briefingFrame % 60) * 2 + 30;
            bCtx.beginPath(); bCtx.arc(0, -dist, 4, 0, Math.PI * 2); bCtx.fill();
            bCtx.beginPath(); bCtx.arc(0, dist, 4, 0, Math.PI * 2); bCtx.fill();
            bCtx.beginPath(); bCtx.arc(-dist, 0, 4, 0, Math.PI * 2); bCtx.fill();
            bCtx.beginPath(); bCtx.arc(dist, 0, 4, 0, Math.PI * 2); bCtx.fill();
        }
    }

    bCtx.restore();
    briefingFrame++;
}
function spawnWaveEnemies(wave) {
    let maxDelay = 0;
    const countMult = currentSettings.enemyCountMult;
    const isHard = (activeDifficultyMode === 'hard');
    // ===============================================
    // EXPERT STAGE 4 (THE VIPER'S NEST)
    // ===============================================
    if (currentLevelIndex === 4 && isHard) {
        if (wave === 1) {
            enemies.push(new HeavyStriker(width * 0.2, -100));
            enemies.push(new HeavyStriker(width * 0.5, -200));
            enemies.push(new HeavyStriker(width * 0.8, -100));
            maxDelay = 1000;
        } else if (wave >= 2 && wave <= 5) {
            let count = 20 + (wave * 2);
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 100);
            if (wave > 3) enemies.push(new LaserEnemy(width * 0.5, -300));
        } else if (wave >= 6 && wave <= 9) {
            let count = 4;
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new HeavyStriker(Math.random() * width, -100)), i * 500);
            for (let i = 0; i < 10; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 300);
        } else if (wave >= 10 && wave <= 14) {
            enemies.push(new LaserEnemy(width * 0.1, -100));
            enemies.push(new LaserEnemy(width * 0.9, -100));
            enemies.push(new HeavyStriker(width * 0.5, -200));
            let count = 30;
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 80);
        } else if (wave === 15) {
            boss.activate();
            boss.initAsStage4();
        }
    }
    // ===============================================
    // EXPERT STAGE 3 (THE GLITCH SECTOR)
    // ===============================================
    else if (currentLevelIndex === 3 && isHard) {
        if (wave === 1) {
            enemies.push(new LaserEnemy(width * 0.2, -100));
            enemies.push(new LaserEnemy(width * 0.8, -100));
            setTimeout(() => enemies.push(new HeavyStriker(width * 0.5, -200)), 800);
            let count = 10;
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 200);
        } else if (wave === 2) {
            enemies.push(new LaserEnemy(width * 0.1, -100));
            enemies.push(new LaserEnemy(width * 0.3, -200));
            enemies.push(new LaserEnemy(width * 0.5, -300));
            enemies.push(new LaserEnemy(width * 0.7, -200));
            enemies.push(new LaserEnemy(width * 0.9, -100));
            maxDelay = 2000;
        } else if (wave === 3) {
            enemies.push(new HeavyStriker(width * 0.2, -100));
            enemies.push(new HeavyStriker(width * 0.8, -100));
            enemies.push(new HeavyStriker(width * 0.4, -250));
            enemies.push(new HeavyStriker(width * 0.6, -250));
        } else if (wave >= 4 && wave <= 8) {
            let density = wave * 3;
            for (let i = 0; i < density; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 100);
            if (wave > 5) { enemies.push(new LaserEnemy(width * 0.1, -100)); enemies.push(new LaserEnemy(width * 0.9, -100)); }
            if (wave > 7) { enemies.push(new HeavyStriker(width * 0.5, -200)); }
        } else if (wave >= 9 && wave <= 14) {
            enemies.push(new HeavyStriker(width * 0.2, -100));
            enemies.push(new HeavyStriker(width * 0.8, -100));
            enemies.push(new LaserEnemy(width * 0.5, -200));
            let fastSwarm = 20 + wave;
            for (let i = 0; i < fastSwarm; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 80);
        } else if (wave === 15) {
            boss.activate();
            boss.initAsStage3();
        }
    }
    // ===============================================
    // EXPERT STAGE 5 (THE TWIN PARADOX)
    // ===============================================
    else if (currentLevelIndex === 5 && isHard) {
        if (wave === 1) {
            enemies.push(new HeavyStriker(width * 0.2, -100));
            enemies.push(new HeavyStriker(width * 0.8, -100));
            let count = 15;
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 150);
        } else if (wave >= 2 && wave <= 4) {
            let count = 20 + (wave * 2);
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 100);
            enemies.push(new LaserEnemy(width * 0.3, -200));
            enemies.push(new LaserEnemy(width * 0.7, -200));
        } else if (wave === 5) {
            // MINE LAYER INTRO (HARD)
            enemies.push(new MineLayer(width * 0.2, -50));
            enemies.push(new MineLayer(width * 0.8, -50));
            enemies.push(new HeavyStriker(width * 0.5, -200));
            maxDelay = 1500;
        } else if (wave >= 6 && wave <= 14) {
            let count = 25;
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 80);

            if (wave % 2 === 0) {
                enemies.push(new HeavyStriker(Math.random() * width, -100));
                enemies.push(new LaserEnemy(Math.random() * width, -200));
            }
            if (wave === 10) {
                enemies.push(new MineLayer(width * 0.5, -100));
                enemies.push(new Spinner(width * 0.2, -200));
                enemies.push(new Spinner(width * 0.8, -200));
            }
        } else if (wave === 15) {
            boss.activate();
            boss.initAsStage5();
        }
    }
    // ===============================================
    // STAGE 6 (BEGINNER) - THE SYNTAX ERROR
    // ===============================================
    else if (currentLevelIndex === 6 && !isHard) {
        if (wave >= 1 && wave <= 14) {
            let count = 10 + wave * 2;
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 200);
            if (wave % 3 === 0) {
                enemies.push(new HeavyStriker(width / 2, -100));
                enemies.push(new LaserEnemy(width / 4, -200));
                enemies.push(new LaserEnemy(width * 0.75, -200));
            }
            if (wave === 10) {
                enemies.push(new MineLayer(width / 2, -100));
                enemies.push(new Spinner(width * 0.2, -200));
                enemies.push(new Spinner(width * 0.8, -200));
            }
        } else if (wave === 15) {
            boss.activate();
            boss.initAsStage6();
        }
    }
    // ===============================================
    // STAGE 5 (BEGINNER) - THE HIVE
    // ===============================================
    else if (currentLevelIndex === 5 && !isHard) {
        if (wave === 1) {
            let count = 12;
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 200);
        } else if (wave === 5) {
            // MINE LAYER WAVE INTRO
            enemies.push(new MineLayer(width * 0.2, -50));
            enemies.push(new MineLayer(width * 0.5, -150));
            enemies.push(new MineLayer(width * 0.8, -50));
            let count = 8;
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 300);
            maxDelay = 1000;
        } else if (wave >= 2 && wave <= 14) {
            // General waves
            let count = 15 + wave;
            let delay = (wave >= 9) ? 100 : 150;
            if (wave >= 9) count = 30;

            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * delay);

            // Recurring Mines
            if (wave === 7) enemies.push(new MineLayer(width / 2, -100));
            if (wave === 9) { enemies.push(new MineLayer(width * 0.3, -100)); enemies.push(new MineLayer(width * 0.7, -100)); }
            if (wave === 11) { enemies.push(new MineLayer(width * 0.2, -100)); enemies.push(new MineLayer(width * 0.8, -100)); }
            if (wave === 13) { enemies.push(new MineLayer(width * 0.25, -100)); enemies.push(new MineLayer(width * 0.5, -200)); enemies.push(new MineLayer(width * 0.75, -100)); }
        } else if (wave === 15) {
            boss.activate();
            boss.initAsStage5();
        }
    }
    // ===============================================
    // STAGE 4 (BEGINNER) - THE SNAKE PIT
    // ===============================================
    else if (currentLevelIndex === 4 && !isHard) {
        if (wave === 1) {
            let count = 8;
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 300);
        } else if (wave >= 2 && wave <= 5) {
            let count = 12 + wave;
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 200);
        } else if (wave >= 6 && wave <= 10) {
            enemies.push(new LaserEnemy(width * 0.2, -100));
            enemies.push(new LaserEnemy(width * 0.8, -100));
            let count = 15;
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 200);
        } else if (wave >= 11 && wave <= 14) {
            enemies.push(new HeavyStriker(width * 0.5, -200));
            let count = 20;
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 150);
        } else if (wave === 15) {
            boss.activate();
            boss.initAsStage4();
        }
    }
    // ===============================================
    // STAGE 2 & 3 GENERIC (Fallback/Original)
    // ===============================================
    else if (currentLevelIndex === 2 || currentLevelIndex === 3) {
        if (wave === 1) {
            if (isHard) {
                enemies.push(new HeavyStriker(width * 0.25, -100));
                enemies.push(new HeavyStriker(width * 0.5, -200));
                enemies.push(new HeavyStriker(width * 0.75, -100));
            } else {
                let count = Math.ceil((12 + wave * 2) * countMult);
                for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * (400 - wave * 20));
            }
        } else if (wave >= 2 && wave <= 5) {
            // Wave 5: SPINNER INTRO
            if (wave === 5) {
                enemies.push(new Spinner(width * 0.2, -50));
                enemies.push(new Spinner(width * 0.5, -100));
                enemies.push(new Spinner(width * 0.8, -50));
            }

            let count = Math.ceil(20 * countMult);
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 200);
            if (wave !== 5) setTimeout(() => enemies.push(new HeavyStriker(Math.random() * width, -200)), 1000);

        } else if (wave >= 6 && wave <= 10) {
            enemies.push(new LaserEnemy(width * 0.2, -100));
            enemies.push(new LaserEnemy(width * 0.8, -100));
            let count = Math.ceil(15 * countMult);
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 300);

            // Recurring Spinners
            if (wave === 7 || wave === 9) {
                enemies.push(new Spinner(width * 0.3, -50));
                enemies.push(new Spinner(width * 0.7, -50));
            }

        } else if (wave >= 11 && wave <= 14) {
            enemies.push(new HeavyStriker(width * 0.3, -100));
            enemies.push(new HeavyStriker(width * 0.7, -100));
            enemies.push(new LaserEnemy(width * 0.5, -200));
            let count = Math.ceil(25 * countMult);
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 150);

            if (wave === 12) enemies.push(new Spinner(width * 0.5, -100));

        } else if (wave === 15) {
            boss.activate();
            if (currentLevelIndex === 2) boss.initAsStage2();
            else boss.initAsStage3();
        }
    }
    // ===============================================
    // STAGE 1 (Fallback)
    // ===============================================
    else {
        if (wave === 1) {
            let count = Math.ceil(10 * countMult);
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 400);
        } else if (wave === 2) {
            let count = Math.ceil(16 * countMult);
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 300);
        } else if (wave === 3) {
            let count = Math.ceil(24 * countMult);
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 200);
        } else if (wave === 4) {
            setTimeout(() => enemies.push(new HeavyStriker(width / 2, -100)), 0);
            let count = Math.ceil(15 * countMult);
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), 1000 + i * 300);
        } else if (wave === 5) {
            enemies.push(new HeavyStriker(width / 4, -100));
            enemies.push(new HeavyStriker(width * 2 / 4, -150));
            enemies.push(new HeavyStriker(width * 3 / 4, -100));
            let count = Math.ceil(20 * countMult);
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), 2000 + i * 250);
            maxDelay = 2000 + count * 250;
        } else if (wave === 6) {
            enemies.push(new LaserEnemy(width * 0.2, -100));
            enemies.push(new LaserEnemy(width * 0.8, -100));
            let count = Math.ceil(20 * countMult);
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), i * 200);
        } else if (wave === 7) {
            enemies.push(new LaserEnemy(width * 0.1, -100));
            enemies.push(new LaserEnemy(width * 0.9, -100));
            setTimeout(() => enemies.push(new HeavyStriker(width / 2, -100)), 500);
            setTimeout(() => enemies.push(new HeavyStriker(width / 4, -100)), 1000);
            setTimeout(() => enemies.push(new HeavyStriker(width * 3 / 4, -100)), 1500);
        } else if (wave === 8) {
            enemies.push(new LaserEnemy(width / 2, -100));
            enemies.push(new LaserEnemy(200, -200));
            enemies.push(new LaserEnemy(width - 200, -200));
            let count = Math.ceil(30 * countMult);
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), 1000 + i * 200);
        } else if (wave === 9) {
            enemies.push(new LaserEnemy(width * 0.2, -100));
            enemies.push(new LaserEnemy(width * 0.8, -100));
            enemies.push(new HeavyStriker(width / 3, -200));
            enemies.push(new HeavyStriker(width * 2 / 3, -200));
            let count = Math.ceil(40 * countMult);
            for (let i = 0; i < count; i++) setTimeout(() => enemies.push(new SwarmEnemy(Math.random() * width, -50)), 500 + i * 150);
        } else if (wave === 10) {
            boss.activate();
        }
    }
    setTimeout(() => {
        waveClearCheckReady = true;
    }, maxDelay + 500);
}
let player, boss;
let particles = [], bullets = [], enemies = [], drops = [];
let score = 0, frames = 0;
let victoryTimer = 0;
// --- RESTORING MISSING UI & GAMEPLAY FUNCTIONS ---
function showExpertSelect() {
    gameState = STATE.LEVEL_SELECT;
    menuScreen.style.opacity = '0';
    menuScreen.style.pointerEvents = 'none';
    expertSelectScreen.style.opacity = '1';
    expertSelectScreen.style.pointerEvents = 'auto';
    updateLevelGrid('hard');
}
function showRookieSelect() {
    gameState = STATE.LEVEL_SELECT;
    menuScreen.style.opacity = '0';
    menuScreen.style.pointerEvents = 'none';
    levelSelectScreen.style.opacity = '1';
    levelSelectScreen.style.pointerEvents = 'auto';
    updateLevelGrid('easy');
}
function updateLevelGrid(mode) {
    const stats = (mode === 'easy') ? gameData.easy : gameData.hard;
    const gridId = (mode === 'easy') ? 'easy-grid' : 'hard-grid';
    const gridEl = document.getElementById(gridId);

    gridEl.innerHTML = '';
    let maxLevels = (mode === 'easy') ? 6 : 5;
    for (let i = 1; i <= maxLevels; i++) {
        const btn = document.createElement('button');
        btn.className = 'level-btn';

        if (i <= stats.maxStage) {
            btn.classList.add('active');
            btn.innerText = i < 10 ? `0${i}` : i;
            btn.onclick = () => launchMission(mode, i);
        } else {
            btn.classList.add('locked');
            btn.innerHTML = `${i < 10 ? '0' + i : i} <span style="font-size:12px">🔒</span>`;
            btn.onclick = showLockedMessage;
        }
        gridEl.appendChild(btn);
    }
}
function showLockedMessage() {
    msgModal.style.display = 'block';
}
function closeMsgModal() {
    msgModal.style.display = 'none';
}
function openHangar(mode) {
    gameState = STATE.HANGAR;
    currentHangarMode = mode;
    const stats = (mode === 'easy') ? gameData.easy : gameData.hard;
    document.getElementById('hangar-stars').innerText = stats.stars;
    document.getElementById('hangar-title').innerText = (mode === 'easy' ? "ROOKIE" : "EXPERT") + " HANGAR";
    updateHangarUI();
    levelSelectScreen.style.opacity = '0'; levelSelectScreen.style.pointerEvents = 'none';
    expertSelectScreen.style.opacity = '0'; expertSelectScreen.style.pointerEvents = 'none';
    hangarScreen.style.opacity = '1'; hangarScreen.style.pointerEvents = 'auto';

    // Hangar Ship Preview
    const hCanvas = document.getElementById('hangarShipCanvas');
    const hCtx = hCanvas.getContext('2d');
    hCtx.clearRect(0, 0, 200, 200);
    hCtx.save(); hCtx.translate(100, 100); hCtx.scale(3, 3); // Scaled up to 3x for detail
    // --- DETAILED SHIP GRAPHICS ---
    const bodyGrad = hCtx.createLinearGradient(0, -20, 0, 20);
    bodyGrad.addColorStop(0, '#ffffff');
    bodyGrad.addColorStop(0.5, '#00aaaa');
    bodyGrad.addColorStop(1, '#005555');

    hCtx.fillStyle = bodyGrad;
    hCtx.shadowBlur = 15; hCtx.shadowColor = '#00ffff';

    // Fuselage
    hCtx.beginPath(); hCtx.moveTo(0, -25); hCtx.lineTo(8, -5); hCtx.lineTo(8, 15); hCtx.lineTo(0, 25); hCtx.lineTo(-8, 15); hCtx.lineTo(-8, -5); hCtx.closePath(); hCtx.fill();
    // Wings
    hCtx.fillStyle = '#008888';
    hCtx.beginPath(); hCtx.moveTo(8, 0); hCtx.lineTo(25, 15); hCtx.lineTo(25, 25); hCtx.lineTo(8, 15); hCtx.closePath(); hCtx.fill();
    hCtx.beginPath(); hCtx.moveTo(-8, 0); hCtx.lineTo(-25, 15); hCtx.lineTo(-25, 25); hCtx.lineTo(-8, 15); hCtx.closePath(); hCtx.fill();
    // Cockpit
    hCtx.fillStyle = '#000';
    hCtx.beginPath(); hCtx.moveTo(0, -10); hCtx.lineTo(3, 0); hCtx.lineTo(0, 5); hCtx.lineTo(-3, 0); hCtx.fill();

    hCtx.restore();
}
function closeHangar() {
    gameState = STATE.LEVEL_SELECT;
    hangarScreen.style.opacity = '0'; hangarScreen.style.pointerEvents = 'none';
    const title = document.getElementById('hangar-title').innerText;
    if (title.includes("EXPERT")) {
        expertSelectScreen.style.opacity = '1'; expertSelectScreen.style.pointerEvents = 'auto';
        updateLevelGrid('hard');
    } else {
        levelSelectScreen.style.opacity = '1'; levelSelectScreen.style.pointerEvents = 'auto';
        updateLevelGrid('easy');
    }
}
function updateHangarUI() {
    const stats = (currentHangarMode === 'easy') ? gameData.easy : gameData.hard;
    document.getElementById('hangar-stars').innerText = stats.stars;

    // --- UPDATE HP CARD ---
    const hpLvl = stats.healthLvl;
    const hpBtn = document.getElementById('btn-upg-hp');
    const hpBonusEl = document.getElementById('hp-bonus');
    let totalBonusHp = 0;
    for (let i = 0; i < hpLvl; i++) totalBonusHp += HEALTH_UPGRADES.bonuses[i];

    const hpSegments = document.querySelectorAll('#hp-bar-container .level-segment');
    hpSegments.forEach((seg, index) => {
        if (index < hpLvl) seg.classList.add('active');
        else seg.classList.remove('active');
    });
    hpBonusEl.innerText = "+" + totalBonusHp + " HP";
    if (hpLvl >= 5) {
        hpBtn.innerText = "MAXED";
        hpBtn.style.opacity = 0.5;
        hpBtn.style.cursor = "default";
        hpBtn.onclick = null;
    } else {
        const cost = HEALTH_UPGRADES.costs[hpLvl];
        hpBtn.innerText = `UPGRADE (${cost} ⭐)`;
        hpBtn.style.opacity = 1;
        hpBtn.style.cursor = "pointer";
        hpBtn.onclick = upgradeHealth;
    }
    // --- UPDATE CANNON CARD ---
    const cannonLvl = stats.cannonLvl;
    const cannonBtn = document.getElementById('btn-upg-cannon');
    const cannonBonusEl = document.getElementById('cannon-bonus');
    let totalBonusDmg = 0;
    for (let i = 0; i < cannonLvl; i++) totalBonusDmg += CANNON_UPGRADES.bonuses[i];
    const cannonSegments = document.querySelectorAll('#cannon-bar-container .level-segment');
    cannonSegments.forEach((seg, index) => {
        if (index < cannonLvl) seg.classList.add('active');
        else seg.classList.remove('active');
    });
    cannonBonusEl.innerText = "+" + totalBonusDmg + " DMG";
    if (cannonLvl >= 5) {
        cannonBtn.innerText = "MAXED";
        cannonBtn.style.opacity = 0.5;
        cannonBtn.style.cursor = "default";
        cannonBtn.onclick = null;
    } else {
        const cost = CANNON_UPGRADES.costs[cannonLvl];
        cannonBtn.innerText = `UPGRADE (${cost} ⭐)`;
        cannonBtn.style.opacity = 1;
        cannonBtn.style.cursor = "pointer";
        cannonBtn.onclick = upgradeCannon;
    }

    // --- UPDATE LASER CARD ---
    const laserStatus = document.getElementById('laser-status');
    const laserBtn = document.getElementById('btn-unlock-laser');
    const cardLaser = document.getElementById('card-laser');

    if (stats.laserUnlocked) {
        laserStatus.innerText = "UNLOCKED";
        laserStatus.style.color = "#00ff00";
        laserBtn.innerText = "EQUIPPED";
        laserBtn.style.opacity = 0.5;
        laserBtn.style.cursor = "default";
        laserBtn.onclick = null;
        cardLaser.style.borderTopColor = "#ff00ff";
        cardLaser.classList.remove('locked');
    } else {
        laserStatus.innerText = "LOCKED";
        laserStatus.style.color = "#ff00ff";
        laserBtn.innerText = "UNLOCK (5000)";
        laserBtn.style.opacity = 1;
        laserBtn.style.cursor = "pointer";
        laserBtn.onclick = unlockLaser;
        cardLaser.classList.remove('locked'); // Remove grey style to show it's interactable
        cardLaser.style.borderTopColor = "#ff00ff";
    }
}
function upgradeHealth() {
    const stats = (currentHangarMode === 'easy') ? gameData.easy : gameData.hard;
    const currentLvl = stats.healthLvl;
    if (currentLvl >= 5) return;
    const cost = HEALTH_UPGRADES.costs[currentLvl];
    if (stats.stars >= cost) {
        stats.stars -= cost;
        stats.healthLvl++;
        saveData();
        updateHangarUI();
    } else {
        alert("Not enough stars!");
    }
}
function upgradeCannon() {
    const stats = (currentHangarMode === 'easy') ? gameData.easy : gameData.hard;
    const currentLvl = stats.cannonLvl;
    if (currentLvl >= 5) return;
    const cost = CANNON_UPGRADES.costs[currentLvl];
    if (stats.stars >= cost) {
        stats.stars -= cost;
        stats.cannonLvl++;
        saveData();
        updateHangarUI();
    } else {
        alert("Not enough stars!");
    }
}

function unlockLaser() {
    const stats = (currentHangarMode === 'easy') ? gameData.easy : gameData.hard;
    if (stats.laserUnlocked) return;
    if (stats.stars >= 5000) {
        stats.stars -= 5000;
        stats.laserUnlocked = true;
        saveData();
        updateHangarUI();
    } else {
        alert("Not enough stars! You need 5000.");
    }
}

function activateLaser(e) {
    if (e) e.preventDefault();
    if (player && player.active && player.hasLaser && player.abilityCooldown <= 0 && gameState === STATE.PLAYING && player.frozenTimer <= 0) {
        player.laserActiveTimer = 150; // Increased to 2.5 seconds (150 frames)
        player.abilityCooldown = 600; // 10 seconds cooldown
        const btn = document.getElementById('ability-btn');
        btn.classList.add('cooldown');
        btn.innerText = "10";

        // Camera Shake
        ctx.translate((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
        setTimeout(() => ctx.setTransform(1, 0, 0, 1, 0, 0), 500);
    }
}
function updateUI() {
    if (activeDifficultyMode === 'easy') starsDisplayEl.innerText = gameData.easy.stars;
    else starsDisplayEl.innerText = gameData.hard.stars;
}
function launchMission(mode, levelIndex) {
    currentSettings = mode === 'hard' ? DIFFICULTY.NORMAL : DIFFICULTY.EASY;
    activeDifficultyMode = mode;
    currentLevelIndex = levelIndex;
    menuScreen.style.opacity = '0'; menuScreen.style.pointerEvents = 'none';
    levelSelectScreen.style.opacity = '0'; levelSelectScreen.style.pointerEvents = 'none';
    expertSelectScreen.style.opacity = '0'; expertSelectScreen.style.pointerEvents = 'none';
    gameOverScreen.style.opacity = '0'; gameOverScreen.style.pointerEvents = 'none';
    hangarScreen.style.opacity = '0'; hangarScreen.style.pointerEvents = 'none';
    startIntro(mode, levelIndex);
}
function startIntro(mode, levelIndex) {
    gameState = STATE.INTRO;
    introScreen.style.opacity = '1'; introScreen.style.pointerEvents = 'auto';
    const key = `${mode}_${levelIndex}`;
    const msg = STAGE_MESSAGES[key] || "Transmission unclear. Proceed with caution.";
    document.getElementById('radio-content').innerHTML = msg;

    // AUDIO BRIEFING
    playBriefingAudio(key, msg);

    introTimer = 30;
    document.getElementById('intro-countdown').innerText = introTimer;
    if (introInterval) clearInterval(introInterval);
    introInterval = setInterval(() => {
        introTimer--;
        document.getElementById('intro-countdown').innerText = introTimer;
        if (introTimer <= 0) skipIntro();
    }, 1000);
}
function skipIntro() {
    stopBriefingAudio();
    if (introInterval) clearInterval(introInterval);
    introScreen.style.opacity = '0'; introScreen.style.pointerEvents = 'none';
    startActualGameplay();
}
function startActualGameplay() {
    document.activeElement.blur();
    player = new Player();
    boss = new Boss();
    bullets = []; particles = []; enemies = []; drops = [];
    score = 0; frames = 0;
    scoreEl.innerText = '0'; playerHpEl.innerText = '100';
    stageDisplayEl.innerText = currentLevelIndex;
    bossHealthBar.style.width = '100%';
    bossShieldBar.style.width = '0%';
    bossName.innerText = "System Core: Omega";
    bossName.style.color = "#ff4d4d";
    updateUI();
    gameState = STATE.PLAYING;
    isPhase2Active = false;
    playerHud.style.opacity = '1'; canvas.style.opacity = '1';
    bossHud.style.opacity = 0;
    mouse.targetX = width / 2; mouse.targetY = height - 100;
    currentWave = 0;
    midGameBriefingShown = false; // Reset briefing flag
    startWave(1);
}
function startVictorySequence() {
    gameState = STATE.VICTORY_SEQUENCE;
    victoryTimer = 0;
    enemies = [];
    bullets = [];
    bossHud.style.opacity = 0;
    waveText.innerText = "MISSION COMPLETE";
    waveText.style.opacity = 1;
    waveText.style.transform = "scale(1)";
    waveText.style.color = "#00ff00";
    waveText.style.textShadow = "0 0 20px #00ff00";
}
function resetToMenu() {
    gameState = STATE.MENU;
    menuScreen.style.opacity = '1'; menuScreen.style.pointerEvents = 'auto';
    levelSelectScreen.style.opacity = '0'; levelSelectScreen.style.pointerEvents = 'none';
    expertSelectScreen.style.opacity = '0'; expertSelectScreen.style.pointerEvents = 'none';
    gameOverScreen.style.opacity = '0'; gameOverScreen.style.pointerEvents = 'none';
    document.getElementById('mid-game-screen').style.opacity = '0';
    document.getElementById('mid-game-screen').style.pointerEvents = 'none';
    playerHud.style.opacity = '0';
    canvas.style.opacity = '0';
    bossHud.style.opacity = 0;
    enemies = []; bullets = []; particles = []; drops = [];
    isSupernovaExploding = false;
    midGameBriefingShown = false;
    if (supernovaMesh) supernovaMesh.visible = false;
    if (supernovaParticles) supernovaParticles.visible = false;
    dropMeshes.forEach(d => { if (d.mesh) { scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); } });
    dropMeshes = [];
}
function gameOver(win) {
    gameState = STATE.GAMEOVER;
    gameOverScreen.style.opacity = '1'; gameOverScreen.style.pointerEvents = 'auto';
    gameOverTitle.innerText = win ? "STAGE CLEARED" : "MISSION FAILED";
    gameOverTitle.style.color = win ? "#00ff00" : "#ff0000";
    waveText.style.opacity = 0;
    // STAGE PROGRESSION LOGIC
    if (win) {
        const stats = (activeDifficultyMode === 'easy') ? gameData.easy : gameData.hard;
        let cap = (activeDifficultyMode === 'easy') ? 6 : 4;
        if (currentLevelIndex === stats.maxStage && stats.maxStage < cap) {
            stats.maxStage++;
            saveData();
        }
    }
}
function animateGame() {
    requestAnimationFrame(animateGame);
    ctx.fillStyle = 'rgba(5, 5, 5, 0.4)'; ctx.fillRect(0, 0, width, height);
    if (frames % 2 === 0) { ctx.fillStyle = `rgba(255, 255, 255, ${Math.random()})`; ctx.fillRect(Math.random() * width, 0, 2, 2); }
    if (gameState === STATE.MENU) return;
    frames++;
    if (gameState === STATE.PLAYING || gameState === STATE.GAMEOVER || gameState === STATE.VICTORY_SEQUENCE) {

        // FIXED MAX WAVES LOGIC: Stage 1 = 10, All others = 15
        let maxWaves = (currentLevelIndex === 1) ? 10 : 15;
        if (gameState === STATE.PLAYING && currentWave < maxWaves && enemies.length === 0 && waveClearCheckReady) {
            if (frames % 60 === 0) {
                startWave(currentWave + 1);
            }
        }
        if (boss && boss.active) {
            boss.update();
            boss.draw();
            // Laser Beam Boss Collision
            if (player && player.laserActiveTimer > 0) {
                if (Math.abs(boss.x - player.x) < 80) {
                    boss.hit(30);
                    particles.push(new Particle(boss.x, boss.y + 50, '#00ffff', 4, 4, 10));
                }
            }
        }

        if (player) {
            if (gameState === STATE.PLAYING) {
                player.update();
                player.draw();

                // Enemies Loop
                for (let i = enemies.length - 1; i >= 0; i--) {
                    let e = enemies[i]; e.update(); e.draw();
                    // Laser Beam Enemy Collision
                    if (player.laserActiveTimer > 0 && Math.abs(e.x - player.x) < 60) {
                        e.hit(100);
                    }
                    if (!e.active) enemies.splice(i, 1);
                }
                // Drops Loop
                for (let i = drops.length - 1; i >= 0; i--) {
                    let d = drops[i]; d.update(); d.draw();
                    if (!d.active) drops.splice(i, 1);
                }
                // Bullets Loop
                for (let i = bullets.length - 1; i >= 0; i--) {
                    let b = bullets[i]; b.update(); b.draw();
                    if (!b.active) { bullets.splice(i, 1); continue; }

                    // Player Bullets
                    if (b.type === 'player') {
                        let hit = false;
                        // Boss Hit
                        if (boss.active) {
                            if (boss.isSnake) {
                                // Snake Hit Logic
                                let distHead = Math.hypot(b.x - boss.x, b.y - boss.y);
                                if (distHead < 40) {
                                    boss.hit(b.damage); b.active = false; hit = true;
                                    particles.push(new Particle(b.x, b.y, '#ffaa00', 2, 2, 10));
                                } else {
                                    // Body Hit
                                    const segmentCount = 50; const spacing = 2;
                                    for (let s = 1; s <= segmentCount; s += 2) {
                                        let pathIndex = s * spacing;
                                        if (pathIndex < boss.snakePath.length) {
                                            let pos = boss.snakePath[pathIndex];
                                            let size = 30 * (1 - s / (segmentCount + 10)) + 8;
                                            if (Math.hypot(b.x - pos.x, b.y - pos.y) < size + 5) {
                                                boss.hit(b.damage * 0.5); b.active = false; hit = true;
                                                particles.push(new Particle(b.x, b.y, '#88ff88', 1, 2, 5));
                                                break;
                                            }
                                        }
                                    }
                                }
                            } else if (boss.isBinaryStars) {
                                // Binary Star Collision
                                if (boss.twinRed && boss.twinRed.active && Math.hypot(b.x - boss.twinRed.x, b.y - boss.twinRed.y) < 40) {
                                    boss.twinRed.hp -= b.damage;
                                    if (boss.twinRed.hp <= 0) {
                                        boss.twinRed.active = false;
                                        for (let k = 0; k < 30; k++) particles.push(new Particle(boss.twinRed.x, boss.twinRed.y, '#ff0000', 5, 5, 40));
                                    } else {
                                        particles.push(new Particle(b.x, b.y, '#ffaaaa', 2, 2, 5));
                                    }
                                    b.active = false; hit = true;
                                } else if (boss.twinBlue && boss.twinBlue.active && Math.hypot(b.x - boss.twinBlue.x, b.y - boss.twinBlue.y) < 40) {
                                    boss.twinBlue.hp -= b.damage;
                                    if (boss.twinBlue.hp <= 0) {
                                        boss.twinBlue.active = false;
                                        for (let k = 0; k < 30; k++) particles.push(new Particle(boss.twinBlue.x, boss.twinBlue.y, '#0000ff', 5, 5, 40));
                                    } else {
                                        particles.push(new Particle(b.x, b.y, '#aaaaff', 2, 2, 5));
                                    }
                                    b.active = false; hit = true;
                                }
                            } else {
                                // Standard Boss Hit
                                let dx = b.x - boss.x; let dy = b.y - boss.y;
                                if (Math.sqrt(dx * dx + dy * dy) < 60) {
                                    boss.hit(b.damage); b.active = false; hit = true;
                                    particles.push(new Particle(b.x, b.y, '#ffaa00', 2, 2, 10));
                                }
                            }
                        } // End Boss Hit
                        // Enemy Hit
                        if (!hit) {
                            enemies.forEach(e => {
                                if (e.active) {
                                    let dist = Math.hypot(b.x - e.x, b.y - e.y);
                                    let threshold = 30;
                                    // Larger hitboxes for special enemies
                                    if (e instanceof Spinner || e instanceof MineLayer) threshold = 40;

                                    if (dist < threshold) {
                                        e.hit(b.damage); b.active = false;
                                    }
                                }
                            });
                        }
                    }
                    // Enemy Bullets Hitting Player
                    else {
                        let dx = b.x - player.x; let dy = b.y - player.y;
                        if (Math.sqrt(dx * dx + dy * dy) < 15) {
                            // Special bullet hit effects
                            if (b.type === 'digit_ball') {
                                player.reverseControls();
                            }

                            player.hit(b.damage); b.active = false;

                            // Status Effects
                            if (b.type === 'iceball') player.freeze();
                            if (b.type === 'fireball') player.burn();

                            particles.push(new Particle(b.x, b.y, '#00ffff', 2, 2, 10));
                        }
                    }
                }
            } else if (gameState === STATE.VICTORY_SEQUENCE) {
                player.draw();
                drops.forEach(d => { d.x += (player.x - d.x) * 0.1; d.y += (player.y - d.y) * 0.1; if (Math.abs(d.x - player.x) < 20) d.collect(); d.draw(); });
                victoryTimer++;
                if (victoryTimer <= 100) {
                    player.x += (Math.random() - 0.5) * 2;
                    if (frames % 5 === 0) particles.push(new Particle(player.x, player.y + 20, '#00ffff', 1, 3, 5));
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
        let p = particles[i]; p.update(); p.draw(); if (p.life <= 0) particles.splice(i, 1);
    }
}
// --- DEV TOOL LOGIC ---
function toggleDevPanel() {
    const panel = document.getElementById('dev-panel');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
}
function devSetStars() {
    const val = parseInt(document.getElementById('dev-stars').value);
    if (!isNaN(val)) {
        if (activeDifficultyMode === 'easy') gameData.easy.stars = val;
        else gameData.hard.stars = val;
        saveData();
        updateUI();
        if (gameState === STATE.HANGAR) updateHangarUI();
    }
}
function devSkipWave() {
    const val = parseInt(document.getElementById('dev-wave').value);
    if (!isNaN(val) && val > 0 && gameState === STATE.PLAYING) {
        enemies = [];
        bullets = [];
        if (boss.active) boss.active = false;
        startWave(val);
    }
}
function devKillAll() {
    if (gameState === STATE.PLAYING) {
        enemies.forEach(e => e.hit(10000));
        if (boss && boss.active) {
            boss.hit(10000);
            boss.hit(10000);
        }
    }
}
function devResetStarsOnly() {
    gameData.easy.stars = 0;
    gameData.hard.stars = 0;
    saveData();
    updateUI();
    if (gameState === STATE.HANGAR) updateHangarUI();
    alert("Stars Reset!");
}
function devResetUpgradesOnly() {
    gameData.easy.healthLvl = 0;
    gameData.easy.cannonLvl = 0;
    gameData.hard.healthLvl = 0;
    gameData.hard.cannonLvl = 0;
    saveData();
    updateUI();
    if (gameState === STATE.HANGAR) updateHangarUI();
    alert("Upgrades Reset!");
}
function devResetLevelsOnly() {
    gameData.easy.maxStage = 1;
    gameData.hard.maxStage = 1;
    saveData();
    if (gameState === STATE.LEVEL_SELECT) {
        const isExpert = document.getElementById('expert-level-select-screen').style.opacity === '1';
        updateLevelGrid(isExpert ? 'hard' : 'easy');
    }
    alert("Levels Reset to 1!");
}
function devUnlockStages() {
    gameData.easy.maxStage = 6;
    gameData.hard.maxStage = 4;
    saveData();
    if (gameState === STATE.LEVEL_SELECT) {
        const isExpert = document.getElementById('expert-level-select-screen').style.opacity === '1';
        updateLevelGrid(isExpert ? 'hard' : 'easy');
    }
    alert("All Stages Unlocked!");
}
function devGlobalWipe() {
    if (confirm("WARNING: This will wipe ALL progress (Stars, Upgrades, Levels) and reset the game to factory state (Welcome Screen). Continue?")) {
        localStorage.removeItem('neonVoidData_v3');
        localStorage.removeItem('neonVoid_visited');
        location.reload();
    }
}

function devResetCookies() {
    localStorage.removeItem('neonVoid_visited');
    alert("Intro Cookie Cleared. Refresh to see Welcome.");
}
// --- NEW WELCOME & COOKIE LOGIC ---
function checkFirstVisit() {
    const visited = getCookie('neonVoid_visited');
    if (visited) {
        cookiesAccepted = true; // Assume true if they have the cookie
        initData(); // Load existing game data
        resetToMenu();
    } else {
        startWelcomeSequence();
    }
}
function startWelcomeSequence() {
    gameState = STATE.WELCOME;
    // Hide other screens
    menuScreen.style.opacity = '0';
    menuScreen.style.pointerEvents = 'none';
    // Show Welcome
    const screen = document.getElementById('welcome-screen');
    screen.style.opacity = '1';
    screen.style.pointerEvents = 'auto';

    // Step 1 Content
    document.getElementById('welcome-header').innerText = "SYSTEM BOOT";
    document.getElementById('welcome-content').innerHTML =
        "Greetings, Pilot.<br><br>Welcome to the Neon Void. Your mission is to survive the sectors and neutralize the Rogue AI.<br><br>Are you ready to interface?";

    const footer = document.getElementById('welcome-footer');
    footer.innerHTML = `<button class="btn" style="border-color: #00ff00; color: #00ff00;" onclick="showCookieStep()">INITIATE LINK</button>`;
}
function showCookieStep() {
    document.getElementById('welcome-header').innerText = "PROTOCOL CHECK";
    document.getElementById('welcome-content').innerHTML =
        "Systems initializing... <br><br>WARNING: Persistent Data Storage required.<br><br>But first... you gotta try these cookies. 🍪<br>They have tiny micro sensors that will scan you so we can save your progress.";

    const footer = document.getElementById('welcome-footer');
    footer.innerHTML = `
        <div style="display:flex; gap:20px; width:100%; justify-content:space-between;">
            <button class="btn btn-hard" style="font-size:16px; padding:10px 20px;" onclick="handleCookies(false)">DENY (NO SAVE)</button>
            <button class="btn" style="border-color:#00ff00; color:#00ff00; font-size:16px; padding:10px 20px;" onclick="handleCookies(true)">ACCEPT COOKIES</button>
        </div>
    `;
}
function handleCookies(accepted) {
    const screen = document.getElementById('welcome-screen');
    screen.style.opacity = '0';
    screen.style.pointerEvents = 'none';

    if (accepted) {
        cookiesAccepted = true;
        setCookie('neonVoid_visited', 'true', 365);
        initData(); // Load or init save data
        saveData(); // Save the fact that we inited
    } else {
        cookiesAccepted = false;
        initData(); // Init fresh data but won't save
    }

    resetToMenu();
}
document.getElementById('start-hard-btn').addEventListener('click', showExpertSelect);
document.getElementById('start-easy-btn').addEventListener('click', showRookieSelect);
if (typeof THREE !== 'undefined') initThreeMenu();

// --- AUDIO BRIEFING SYSTEM ---
let briefingUtterance = null;
let briefingAudio = null; // For MP3 files

function playBriefingAudio(key, text) {
    // 1. Try to play MP3 file
    const audioPath = `audio/${key}.mp3`;

    if (briefingAudio) {
        briefingAudio.pause();
        briefingAudio = null;
    }

    briefingAudio = new Audio(audioPath);
    briefingAudio.volume = 1.0;

    briefingAudio.play().catch(e => {
        // File not found or playback failed -> Fallback to TTS
        console.log("Audio file not found, falling back to TTS:", e);
        playTTS(text);
    });
}

function playTTS(text) {
    if (!window.speechSynthesis) return;

    // Stop any existing speech
    window.speechSynthesis.cancel();

    // Clean text (remove HTML tags)
    const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    briefingUtterance = new SpeechSynthesisUtterance(cleanText);

    // Voice Selection (English Commander Style)
    const voices = window.speechSynthesis.getVoices();
    // Prefer "Google US English" or "en-US" male voice
    const commanderVoice = voices.find(v => v.name.includes('Google US English')) ||
        voices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('male')) ||
        voices.find(v => v.lang === 'en-US') ||
        voices.find(v => v.lang.startsWith('en'));

    if (commanderVoice) briefingUtterance.voice = commanderVoice;

    briefingUtterance.pitch = 0.9; // Slightly deeper
    briefingUtterance.rate = 0.9;  // Deliberate pace
    briefingUtterance.volume = 1.0;

    // Wait for voices if needed (simple retry)
    if (voices.length === 0) {
        setTimeout(() => playTTS(text), 100);
        return;
    }

    window.speechSynthesis.speak(briefingUtterance);
}

function stopBriefingAudio() {
    // Stop MP3
    if (briefingAudio) {
        briefingAudio.pause();
        briefingAudio.currentTime = 0;
    }
    // Stop TTS
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
}

// Ensure voices are loaded
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        // If we are in intro state and audio hasn't played (or we want to retry), we could.
        // But simpler: just ensure voices are ready for next time.
        console.log("Voices loaded");
    };
}

// Start check
checkFirstVisit();
animateGame();
