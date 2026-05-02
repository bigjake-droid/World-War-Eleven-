const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiPhase = document.getElementById('phase-display');
const uiReserves = document.getElementById('reinforcement-display');
const uiDPoints = document.getElementById('dpoint-display');
const actionBtn = document.getElementById('action-btn');
const techBtn = document.getElementById('tech-btn');
const techPanel = document.getElementById('tech-panel');

let width, height;
let nodes = [];
let phase = 'DEPLOY'; // State Machine: DEPLOY, ATTACK, ANIMATING, TECH, AI_TURN
let reserves = 3;
let dPoints = 0;
let selectedNode = null;
let activeStrikes = []; 
let radarAngle = 0; 

const COLOR_PLAYER = '#00d4ff'; 
const COLOR_ENEMY = '#d32f2f';  

// --- 1. INITIALIZATION & RESIZE ---
function resize() {
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = width; canvas.height = height;
    initMap(); 
}

function initMap() {
    const cx = width / 2; const cy = height / 2;
    const offset = Math.min(width, height) * 0.28;

    nodes = [
        { id: 0, x: cx - offset, y: cy - offset, owner: 0, troops: 5, defense: 0, links: [1, 3] }, 
        { id: 1, x: cx, y: cy - offset * 1.2, owner: 1, troops: 3, defense: 0, links: [0, 2, 4] }, 
        { id: 2, x: cx + offset, y: cy - offset, owner: 1, troops: 2, defense: 0, links: [1, 5] }, 
        { id: 3, x: cx - offset * 1.2, y: cy, owner: 0, troops: 2, defense: 0, links: [0, 4, 6] }, 
        { id: 4, x: cx, y: cy, owner: 1, troops: 4, defense: 0, links: [1, 3, 5, 7] }, 
        { id: 5, x: cx + offset * 1.2, y: cy, owner: 1, troops: 3, defense: 0, links: [2, 4, 8] }, 
        { id: 6, x: cx - offset, y: cy + offset, owner: 1, troops: 2, defense: 0, links: [3, 7] }, 
        { id: 7, x: cx, y: cy + offset * 1.2, owner: 1, troops: 2, defense: 0, links: [4, 6, 8] }, 
        { id: 8, x: cx + offset, y: cy + offset, owner: 1, troops: 2, defense: 0, links: [5, 7] }  
    ];
    calculateReserves();
}

function calculateReserves() {
    let owned = nodes.filter(n => n.owner === 0).length;
    reserves = Math.max(3, Math.floor(owned / 3));
    dPoints += 5; 
    updateUI();
}

// --- 2. COMBAT & ANIMATION ENGINE ---
function launchStrike(attacker, defender) {
    if (phase === 'ANIMATING') return;
    
    let previousPhase = phase;
    phase = 'ANIMATING'; // Lock controls during animation

    let dx = defender.x - attacker.x;
    let dy = defender.y - attacker.y;
    let distance = Math.hypot(dx, dy);
    
    activeStrikes.push({
        attacker: attacker,
        defender: defender,
        startX: attacker.x, startY: attacker.y,
        endX: defender.x, endY: defender.y,
        currentX: attacker.x, currentY: attacker.y,
        troopsSent: attacker.troops, 
        progress: 0,
        speed: 4 / distance, 
        color: attacker.owner === 0 ? COLOR_PLAYER : COLOR_ENEMY,
        returnPhase: previousPhase
    });
}

function resolveCombat(attacker, defender) {
    // Tier 3: Iron Dome check
    if (defender.defense === 3) {
        attacker.troops--;
        if(attacker.troops <= 1) return; 
    }

    let aDiceCount = Math.min(3, attacker.troops - 1);
    let dDiceCount = Math.min(2, defender.troops);

    let aRolls = [], dRolls = [];
    for(let i=0; i<aDiceCount; i++) aRolls.push(Math.floor(Math.random() * 6) + 1);
    for(let i=0; i<dDiceCount; i++) dRolls.push(Math.floor(Math.random() * 6) + 1);

    aRolls.sort((a,b) => b-a); dRolls.sort((a,b) => b-a);

    // Apply Defense Modifiers
    if (defender.defense >= 1) dRolls[0] += 1; // Turret
    if (defender.defense >= 2 && dRolls.length > 1) dRolls[1] += 1; // Aegis

    let comparisons = Math.min(aRolls.length, dRolls.length);
    for(let i=0; i<comparisons; i++) {
        if(aRolls[i] > dRolls[i]) defender.troops--;
        else attacker.troops--; 
    }

    // Territory Capture
    if(defender.troops <= 0) {
        defender.owner = attacker.owner;
        defender.troops = attacker.troops - 1; 
        attacker.troops = 1;
        defender.defense = 0; // Wipes out defense tech
        selectedNode = null; 
    }
}

// --- 3. INPUT CONTROLS ---
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(e.touches[0]); });
canvas.addEventListener('mousedown', handleInput);

function handleInput(e) {
    if (phase === 'AI_TURN' || phase === 'ANIMATING') return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left; const y = e.clientY - rect.top;

    let clickedNode = null;
    nodes.forEach(n => { if (Math.hypot(n.x - x, n.y - y) < 35) clickedNode = n; });

    if (!clickedNode) { selectedNode = null; return; }

    if (phase === 'DEPLOY') {
        if (clickedNode.owner === 0 && reserves > 0) {
            clickedNode.troops++; reserves--;
            if (reserves === 0) phase = 'ATTACK';
            updateUI();
        }
    } 
    else if (phase === 'ATTACK') {
        if (clickedNode.owner === 0 && clickedNode.troops > 1) {
            selectedNode = clickedNode; 
        } 
        else if (selectedNode && clickedNode.owner !== 0) {
            if (selectedNode.links.includes(clickedNode.id)) {
                launchStrike(selectedNode, clickedNode);
                if(selectedNode && selectedNode.troops === 1) selectedNode = null; 
            }
        }
    }
    else if (phase === 'TECH') {
        if (clickedNode.owner === 0) {
            if (clickedNode.defense === 0 && dPoints >= 5) { clickedNode.defense = 1; dPoints -= 5; } 
            else if (clickedNode.defense === 1 && dPoints >= 15) { clickedNode.defense = 2; dPoints -= 15; } 
            else if (clickedNode.defense === 2 && dPoints >= 20) { clickedNode.defense = 3; dPoints -= 20; } 
            updateUI();
        }
    }
    checkWinCondition();
}

actionBtn.addEventListener('click', () => {
    if (phase === 'ATTACK' || phase === 'TECH') {
        selectedNode = null; phase = 'AI_TURN';
        updateUI();
        setTimeout(executeAITurn, 800);
    }
});

techBtn.addEventListener('click', () => {
    if (phase === 'ATTACK') { phase = 'TECH'; }
    else if (phase === 'TECH') { phase = 'ATTACK'; selectedNode = null;}
    updateUI();
});

// --- 4. RENDER GRAPHICS ---
function drawHexagon(x, y, size, color, isFilled) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    if (isFilled) { ctx.fillStyle = color; ctx.fill(); } 
    else { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); }
}

function drawTacticalIcon(x, y, troops, color, isMoving = false) {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.fillStyle = 'transparent';
    ctx.save(); ctx.translate(x, y);

    if (troops >= 15) { // F-35
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(12, 10); ctx.lineTo(0, 4); ctx.lineTo(-12, 10); ctx.closePath(); ctx.stroke();
    } else if (troops >= 10) { // Stryker
        ctx.beginPath(); ctx.rect(-10, -8, 20, 16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -14); ctx.stroke(); 
    } else if (troops >= 5) { // Blackhawk
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(14, 4); ctx.stroke(); 
    } else { // Marines
        ctx.fillStyle = color;
        for(let i=0; i<troops; i++) {
            let dx = Math.cos((i/troops) * Math.PI*2) * 8;
            let dy = Math.sin((i/troops) * Math.PI*2) * 8;
            ctx.beginPath(); ctx.arc(dx, dy, 2, 0, Math.PI*2); ctx.fill();
        }
    }
    
    if (!isMoving) {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Courier New'; ctx.textAlign = 'center';
        ctx.fillText(`[${troops}]`, 0, 28);
    }
    ctx.restore();
}

function render() {
    ctx.fillStyle = '#020304'; ctx.fillRect(0, 0, width, height);

    // Radar Sweep
    radarAngle += 0.01;
    ctx.save(); ctx.translate(width/2, height/2); ctx.rotate(radarAngle);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0, Math.max(width,height), 0, 0.2);
    ctx.fillStyle = 'rgba(0, 212, 255, 0.02)'; ctx.fill(); ctx.restore();

    // Draw Links
    nodes.forEach(n => {
        n.links.forEach(targetId => {
            let target = nodes.find(t => t.id === targetId);
            ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = 'rgba(74, 107, 140, 0.2)'; ctx.lineWidth = 2; ctx.stroke();
        });
    });

    // Draw Nodes
    nodes.forEach(n => {
        let color = n.owner === 0 ? COLOR_PLAYER : COLOR_ENEMY;
        
        drawHexagon(n.x, n.y, 35, 'rgba(10,15,20,0.8)', true);
        drawHexagon(n.x, n.y, 35, color, false);

        if (n.defense >= 1) drawHexagon(n.x, n.y, 42, 'rgba(212,175,55,0.5)', false);
        if (n.defense >= 2) drawHexagon(n.x, n.y, 47, 'rgba(212,175,55,0.9)', false);
        if (n.defense === 3) drawHexagon(n.x, n.y, 52, COLOR_PLAYER, false);

        if (n === selectedNode) {
            ctx.shadowBlur = 20; ctx.shadowColor = COLOR_PLAYER;
            drawHexagon(n.x, n.y, 38, COLOR_PLAYER, false);
            ctx.shadowBlur = 0;
        }
        drawTacticalIcon(n.x, n.y, n.troops, color, false);
    });

    // Draw Strike Animations
    for (let i = activeStrikes.length - 1; i >= 0; i--) {
        let strike = activeStrikes[i];
        strike.progress += strike.speed;
        
        if (strike.progress >= 1) {
            resolveCombat(strike.attacker, strike.defender);
            phase = strike.returnPhase;
            activeStrikes.splice(i, 1);
            checkWinCondition();
            updateUI();
        } else {
            strike.currentX = strike.startX + (strike.endX - strike.startX) * strike.progress;
            strike.currentY = strike.startY + (strike.endY - strike.startY) * strike.progress;
            
            ctx.shadowBlur = 10; ctx.shadowColor = strike.color;
            drawTacticalIcon(strike.currentX, strike.currentY, strike.troopsSent, strike.color, true);
            ctx.shadowBlur = 0;
        }
    }
    requestAnimationFrame(render);
}

// --- 5. GAME LOGIC & UI ---
function updateUI() {
    uiPhase.textContent = `PHASE: ${phase}`;
    uiReserves.textContent = phase === 'DEPLOY' ? `RESERVES: ${reserves}` : '';
    uiDPoints.textContent = `D-POINTS: ${dPoints}`;
    
    techPanel.classList.add('hidden');
    
    if(phase === 'DEPLOY') {
        actionBtn.style.display = 'none'; techBtn.style.display = 'none';
        uiPhase.style.color = '#d4af37';
    } else if (phase === 'ATTACK' || phase === 'ANIMATING') {
        actionBtn.style.display = 'block'; techBtn.style.display = 'block';
        uiPhase.style.color = '#d32f2f'; techBtn.textContent = "> TECH TREE";
    } else if (phase === 'TECH') {
        techPanel.classList.remove('hidden');
        uiPhase.style.color = '#00d4ff'; techBtn.textContent = "< BACK TO ATTACK";
    }
}

function executeAITurn() {
    let aiNodes = nodes.filter(n => n.owner === 1);
    if(aiNodes.length === 0) return;

    let aiReserves = Math.max(3, Math.floor(aiNodes.length / 3));
    for(let i=0; i<aiReserves; i++) {
        let target = aiNodes[Math.floor(Math.random() * aiNodes.length)];
        target.troops++;
    }

    let hasAttacked = false;
    aiNodes.forEach(attacker => {
        if (attacker.troops > 4 && !hasAttacked) { 
            attacker.links.forEach(targetId => {
                let defender = nodes.find(n => n.id === targetId);
                if (defender.owner === 0 && attacker.troops > defender.troops) {
                    launchStrike(attacker, defender);
                    hasAttacked = true;
                }
            });
        }
    });

    if (!hasAttacked) {
        phase = 'DEPLOY';
        calculateReserves();
    } else {
        activeStrikes[0].returnPhase = 'DEPLOY';
        setTimeout(calculateReserves, 1000); 
    }
}

function checkWinCondition() {
    let pCount = nodes.filter(n => n.owner === 0).length;
    let eCount = nodes.filter(n => n.owner === 1).length;

    if (eCount === 0 || pCount === 0) {
        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('end-title').textContent = eCount === 0 ? "NETWORK SECURED" : "NETWORK LOST";
        document.getElementById('end-title').style.color = eCount === 0 ? COLOR_PLAYER : COLOR_ENEMY;
        document.getElementById('end-desc').textContent = eCount === 0 ? "All hostile nodes purged." : "Your command structure has fallen.";
    }
}

document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('game-over').classList.add('hidden');
    phase = 'DEPLOY'; dPoints = 0; activeStrikes = [];
    initMap();
});

// Boot Sequence
window.addEventListener('resize', resize);
resize();
render();