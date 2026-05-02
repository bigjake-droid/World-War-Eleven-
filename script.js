const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiPhase = document.getElementById('phase-display');
const uiReserves = document.getElementById('reinforcement-display');
const uiDPoints = document.getElementById('dpoint-display');
const actionBtn = document.getElementById('action-btn');
const techBtn = document.getElementById('tech-btn');
const techPanel = document.getElementById('tech-panel');

const bgMap = new Image();
bgMap.src = 'Risk_game_board.svg.jpg';

let width, height;
let nodes = [];
let phase = 'DEPLOY'; 
let reserves = 3;
let dPoints = 0;
let selectedNode = null;
let activeStrikes = []; 
let visualTaps = []; 

const COLOR_PLAYER = '#00d4ff'; 
const COLOR_ENEMY = '#d32f2f';  

function resize() {
    width = window.innerWidth; 
    height = window.innerHeight;
    canvas.width = width; 
    canvas.height = height;
    initMap(); 
}

function initMap() {
    nodes = [
        { id: 0, x: width * 0.20, y: height * 0.35, owner: 0, troops: 5, defense: 0, links: [1, 2, 3] }, // NA
        { id: 1, x: width * 0.30, y: height * 0.70, owner: 1, troops: 2, defense: 0, links: [0, 3] },    // SA
        { id: 2, x: width * 0.50, y: height * 0.30, owner: 1, troops: 3, defense: 0, links: [0, 3, 4] }, // EU
        { id: 3, x: width * 0.55, y: height * 0.65, owner: 1, troops: 2, defense: 0, links: [1, 2, 4] }, // AF
        { id: 4, x: width * 0.75, y: height * 0.35, owner: 1, troops: 4, defense: 0, links: [2, 3, 5] }, // AS
        { id: 5, x: width * 0.85, y: height * 0.80, owner: 1, troops: 2, defense: 0, links: [4] }        // AU
    ];
    calculateReserves();
}

// ----------------------------------------------------------------
// UPGRADED REINFORCEMENT ENGINE (REAL RISK MATH)
// ----------------------------------------------------------------
function calculateReserves() {
    let ownedNodes = nodes.filter(n => n.owner === 0);
    let baseReserves = Math.max(3, Math.floor(ownedNodes.length / 3));

    let bonusReserves = 0;
    ownedNodes.forEach(n => {
        if (n.id === 0) bonusReserves += 5; // North America
        if (n.id === 1) bonusReserves += 2; // South America
        if (n.id === 2) bonusReserves += 5; // Europe
        if (n.id === 3) bonusReserves += 3; // Africa
        if (n.id === 4) bonusReserves += 7; // Asia
        if (n.id === 5) bonusReserves += 2; // Australia
    });

    reserves = baseReserves + bonusReserves;
    dPoints += 5; 
    updateUI();
}

function launchStrike(attacker, defender) {
    if (phase === 'ANIMATING') return;
    let previousPhase = phase;
    phase = 'ANIMATING'; 

    let dx = defender.x - attacker.x; let dy = defender.y - attacker.y;
    let distance = Math.hypot(dx, dy);
    
    activeStrikes.push({
        attacker: attacker, defender: defender,
        startX: attacker.x, startY: attacker.y, endX: defender.x, endY: defender.y,
        currentX: attacker.x, currentY: attacker.y, troopsSent: attacker.troops, 
        progress: 0, speed: 4 / distance, 
        color: attacker.owner === 0 ? COLOR_PLAYER : COLOR_ENEMY,
        returnPhase: previousPhase
    });
}

function resolveCombat(attacker, defender) {
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

    if (defender.defense >= 1) dRolls[0] += 1; 
    if (defender.defense >= 2 && dRolls.length > 1) dRolls[1] += 1; 

    let comparisons = Math.min(aRolls.length, dRolls.length);
    for(let i=0; i<comparisons; i++) {
        if(aRolls[i] > dRolls[i]) defender.troops--; else attacker.troops--; 
    }

    if(defender.troops <= 0) {
        defender.owner = attacker.owner;
        defender.troops = attacker.troops - 1; 
        attacker.troops = 1; defender.defense = 0; 
        selectedNode = null; 
    }
}

// Touch Controls
window.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    if (phase === 'AI_TURN' || phase === 'ANIMATING') return;

    const x = e.clientX; const y = e.clientY;
    visualTaps.push({ x: x, y: y, radius: 5, alpha: 1.0 });

    let clickedNode = null;
    nodes.forEach(n => { if (Math.hypot(n.x - x, n.y - y) < 45) clickedNode = n; });

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
});

actionBtn.addEventListener('click', () => {
    if (phase === 'ATTACK' || phase === 'TECH') {
        selectedNode = null; phase = 'AI_TURN'; updateUI();
        setTimeout(executeAITurn, 800);
    }
});

techBtn.addEventListener('click', () => {
    if (phase === 'ATTACK') { phase = 'TECH'; }
    else if (phase === 'TECH') { phase = 'ATTACK'; selectedNode = null;}
    updateUI();
});

function drawTacticalIcon(x, y, troops, color, isMoving = false) {
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.save(); ctx.translate(x, y);

    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill(); ctx.stroke();

    if (troops >= 15) { 
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(12, 10); ctx.lineTo(0, 4); ctx.lineTo(-12, 10); ctx.closePath(); ctx.stroke();
    } else if (troops >= 10) { 
        ctx.beginPath(); ctx.rect(-10, -8, 20, 16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -14); ctx.stroke(); 
    } else if (troops >= 5) { 
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(14, 4); ctx.stroke(); 
    } else { 
        ctx.fillStyle = color;
        for(let i=0; i<troops; i++) {
            ctx.beginPath(); ctx.arc(Math.cos((i/troops) * Math.PI*2) * 8, Math.sin((i/troops) * Math.PI*2) * 8, 3, 0, Math.PI*2); ctx.fill();
        }
    }
    
    if (!isMoving) {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Courier New'; ctx.textAlign = 'center';
        ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
        ctx.fillText(`[${troops}]`, 0, 35);
    }
    ctx.restore();
}

function render() {
    ctx.clearRect(0, 0, width, height);

    if (bgMap.complete) {
        ctx.globalAlpha = 0.6;
        ctx.drawImage(bgMap, 0, 0, width, height);
        ctx.globalAlpha = 1.0;
    }

    nodes.forEach(n => {
        n.links.forEach(targetId => {
            let target = nodes.find(t => t.id === targetId);
            ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.stroke();
            ctx.setLineDash([]); 
        });
    });

    nodes.forEach(n => {
        let color = n.owner === 0 ? COLOR_PLAYER : COLOR_ENEMY;

        if (n.defense >= 1) { ctx.beginPath(); ctx.arc(n.x, n.y, 25, 0, Math.PI*2); ctx.strokeStyle = 'rgba(212,175,55,0.8)'; ctx.lineWidth = 2; ctx.stroke(); }
        if (n.defense >= 2) { ctx.beginPath(); ctx.arc(n.x, n.y, 30, 0, Math.PI*2); ctx.strokeStyle = 'rgba(212,175,55,1)'; ctx.lineWidth = 3; ctx.stroke(); }
        if (n.defense === 3) { ctx.beginPath(); ctx.arc(n.x, n.y, 35, 0, Math.PI*2); ctx.strokeStyle = COLOR_PLAYER; ctx.lineWidth = 4; ctx.stroke(); }

        if (n === selectedNode) {
            ctx.beginPath(); ctx.arc(n.x, n.y, 28, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 212, 255, 0.3)'; ctx.fill();
        }
        drawTacticalIcon(n.x, n.y, n.troops, color, false);
    });

    for (let i = activeStrikes.length - 1; i >= 0; i--) {
        let strike = activeStrikes[i];
        strike.progress += strike.speed;
        
        if (strike.progress >= 1) {
            resolveCombat(strike.attacker, strike.defender);
            phase = strike.returnPhase;
            activeStrikes.splice(i, 1);
            checkWinCondition(); updateUI();
        } else {
            strike.currentX = strike.startX + (strike.endX - strike.startX) * strike.progress;
            strike.currentY = strike.startY + (strike.endY - strike.startY) * strike.progress;
            drawTacticalIcon(strike.currentX, strike.currentY, strike.troopsSent, strike.color, true);
        }
    }

    for (let i = visualTaps.length - 1; i >= 0; i--) {
        let t = visualTaps[i];
        ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${t.alpha})`; ctx.lineWidth = 3; ctx.stroke();
        t.radius += 2; t.alpha -= 0.05;
        if (t.alpha <= 0) visualTaps.splice(i, 1);
    }

    requestAnimationFrame(render);
}

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

// ----------------------------------------------------------------
// UPGRADED AI (Uses Continent Bonuses too)
// ----------------------------------------------------------------
function executeAITurn() {
    let aiNodes = nodes.filter(n => n.owner === 1);
    if(aiNodes.length === 0) return;

    // AI gets the exact same Risk math
    let aiBase = Math.max(3, Math.floor(aiNodes.length / 3));
    let aiBonus = 0;
    aiNodes.forEach(n => {
        if (n.id === 0) aiBonus += 5;
        if (n.id === 1) aiBonus += 2;
        if (n.id === 2) aiBonus += 5;
        if (n.id === 3) aiBonus += 3;
        if (n.id === 4) aiBonus += 7;
        if (n.id === 5) aiBonus += 2;
    });
    
    let aiReserves = aiBase + aiBonus;

    for(let i=0; i<aiReserves; i++) {
        let target = aiNodes[Math.floor(Math.random() * aiNodes.length)];
        target.troops++;
    }

    let hasAttacked = false;
    aiNodes.forEach(attacker => {
        if (attacker.troops > 4 && !hasAttacked) { 
            attacker.links.forEach(targetId => {
                let defender = nodes.find(n => n.id === targetId);
                if (defender.owner === 0 && attacker.troops > defender.troops && !hasAttacked) {
                    launchStrike(attacker, defender);
                    hasAttacked = true;
                }
            });
        }
    });

    if (!hasAttacked) {
        phase = 'DEPLOY'; calculateReserves();
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
    phase = 'DEPLOY'; dPoints = 0; activeStrikes = []; initMap();
});

window.addEventListener('resize', resize);
resize();
render();