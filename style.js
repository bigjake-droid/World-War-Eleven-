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
let phase = 'DEPLOY'; // DEPLOY, ATTACK, TECH, AI_TURN
let reserves = 3;
let dPoints = 0;
let selectedNode = null;

const COLOR_PLAYER = '#00d4ff'; 
const COLOR_ENEMY = '#d32f2f';  

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    initMap(); 
}

// 1. Build Network & Defense Tech logic
function initMap() {
    const cx = width / 2;
    const cy = height / 2;
    const offset = Math.min(width, height) * 0.25;

    // Node structure: added defense property (0=None, 1=Turret, 2=Aegis, 3=Iron Dome)
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
    drawMap();
}

function calculateReserves() {
    let owned = nodes.filter(n => n.owner === 0).length;
    reserves = Math.max(3, Math.floor(owned / 3));
    dPoints += 5; // Gain 5 D-Points every turn
    updateUI();
}

// 2. Advanced Combat Engine
function resolveCombat(attacker, defender) {
    // Iron Dome (Tier 3) Pre-emptive kill
    if (defender.defense === 3) {
        attacker.troops--;
        if(attacker.troops <= 1) return; // Attack breaks
    }

    let aDiceCount = Math.min(3, attacker.troops - 1);
    let dDiceCount = Math.min(2, defender.troops);

    let aRolls = [], dRolls = [];
    for(let i=0; i<aDiceCount; i++) aRolls.push(Math.floor(Math.random() * 6) + 1);
    for(let i=0; i<dDiceCount; i++) dRolls.push(Math.floor(Math.random() * 6) + 1);

    aRolls.sort((a,b) => b-a);
    dRolls.sort((a,b) => b-a);

    // Apply Defense Tech Modifiers
    if (defender.defense >= 1) dRolls[0] += 1; // Turret: +1 to highest die
    if (defender.defense >= 2 && dRolls.length > 1) dRolls[1] += 1; // Aegis: +1 to second die

    let comparisons = Math.min(aRolls.length, dRolls.length);
    for(let i=0; i<comparisons; i++) {
        if(aRolls[i] > dRolls[i]) defender.troops--;
        else attacker.troops--; 
    }

    if(defender.troops <= 0) {
        defender.owner = attacker.owner;
        defender.troops = attacker.troops - 1; 
        attacker.troops = 1;
        defender.defense = 0; // Defense systems are destroyed upon capture
        selectedNode = null; 
    }
}

// 3. Controls & UI
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(e.touches[0]); });
canvas.addEventListener('mousedown', handleInput);

function handleInput(e) {
    if (phase === 'AI_TURN') return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let clickedNode = null;
    nodes.forEach(n => { if (Math.hypot(n.x - x, n.y - y) < 30) clickedNode = n; });

    if (!clickedNode) {
        selectedNode = null;
        drawMap();
        return;
    }

    if (phase === 'DEPLOY') {
        if (clickedNode.owner === 0 && reserves > 0) {
            clickedNode.troops++;
            reserves--;
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
                resolveCombat(selectedNode, clickedNode);
                if(selectedNode && selectedNode.troops === 1) selectedNode = null; 
            }
        }
    }
    else if (phase === 'TECH') {
        if (clickedNode.owner === 0) {
            if (clickedNode.defense === 0 && dPoints >= 5) { clickedNode.defense = 1; dPoints -= 5; } // Turret
            else if (clickedNode.defense === 1 && dPoints >= 15) { clickedNode.defense = 2; dPoints -= 15; } // Aegis
            else if (clickedNode.defense === 2 && dPoints >= 20) { clickedNode.defense = 3; dPoints -= 20; } // Iron Dome
            updateUI();
        }
    }
    
    checkWinCondition();
    drawMap();
}

actionBtn.addEventListener('click', () => {
    if (phase === 'ATTACK' || phase === 'TECH') {
        selectedNode = null;
        phase = 'AI_TURN';
        updateUI();
        drawMap();
        setTimeout(executeAITurn, 1000);
    }
});

techBtn.addEventListener('click', () => {
    if (phase === 'ATTACK') { phase = 'TECH'; }
    else if (phase === 'TECH') { phase = 'ATTACK'; selectedNode = null;}
    updateUI();
    drawMap();
});

// 4. Vector Graphics & Render
function drawTacticalIcon(x, y, troops, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.fillStyle = 'transparent';

    if (troops >= 15) {
        // F-35 (Swept Chevron)
        ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 12, y + 10); 
        ctx.lineTo(x, y + 4); ctx.lineTo(x - 12, y + 10); ctx.closePath(); ctx.stroke();
    } else if (troops >= 10) {
        // Stryker (Armor Box)
        ctx.beginPath(); ctx.rect(x - 10, y - 8, 20, 16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 14); ctx.stroke(); // Gun
    } else if (troops >= 5) {
        // Blackhawk (Rotor Oval)
        ctx.beginPath(); ctx.ellipse(x, y, 12, 6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 14, y - 4); ctx.lineTo(x + 14, y + 4); ctx.stroke(); // Blades
    } else {
        // Marines (Dots based on count)
        ctx.fillStyle = color;
        for(let i=0; i<troops; i++) {
            let dx = x + Math.cos((i/troops) * Math.PI*2) * 8;
            let dy = y + Math.sin((i/troops) * Math.PI*2) * 8;
            ctx.beginPath(); ctx.arc(dx, dy, 2, 0, Math.PI*2); ctx.fill();
        }
    }
    
    // Always draw the number underneath
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`[${troops}]`, x, y + 25);
}

function drawMap() {
    ctx.fillStyle = '#030507';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    nodes.forEach(n => {
        n.links.forEach(targetId => {
            let target = nodes.find(t => t.id === targetId);
            ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(target.x, target.y);
            ctx.strokeStyle = 'rgba(74, 107, 140, 0.3)'; ctx.stroke();
        });
    });

    nodes.forEach(n => {
        let color = n.owner === 0 ? COLOR_PLAYER : COLOR_ENEMY;
        
        // Defense Rings
        if (n.defense >= 1) { ctx.beginPath(); ctx.arc(n.x, n.y, 35, 0, Math.PI*2); ctx.strokeStyle = 'rgba(212,175,55,0.4)'; ctx.stroke(); }
        if (n.defense >= 2) { ctx.beginPath(); ctx.arc(n.x, n.y, 40, 0, Math.PI*2); ctx.strokeStyle = 'rgba(212,175,55,0.8)'; ctx.stroke(); }
        if (n.defense === 3) { ctx.beginPath(); ctx.arc(n.x, n.y, 45, 0, Math.PI*2); ctx.strokeStyle = '#00d4ff'; ctx.stroke(); }

        // Selection Highlight
        if (n === selectedNode) {
            ctx.beginPath(); ctx.arc(n.x, n.y, 25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(212, 175, 55, 0.3)'; ctx.fill();
            ctx.strokeStyle = '#d4af37'; ctx.stroke();
        }

        drawTacticalIcon(n.x, n.y, n.troops, color);
    });
}

function updateUI() {
    uiPhase.textContent = `PHASE: ${phase}`;
    uiReserves.textContent = phase === 'DEPLOY' ? `RESERVES: ${reserves}` : '';
    uiDPoints.textContent = `D-POINTS: ${dPoints}`;
    
    techPanel.classList.add('hidden');
    
    if(phase === 'DEPLOY') {
        actionBtn.style.display = 'none'; techBtn.style.display = 'none';
        uiPhase.style.color = '#d4af37';
    } else if (phase === 'ATTACK') {
        actionBtn.style.display = 'block'; techBtn.style.display = 'block';
        uiPhase.style.color = '#d32f2f'; techBtn.textContent = "> TECH TREE";
    } else if (phase === 'TECH') {
        techPanel.classList.remove('hidden');
        uiPhase.style.color = '#00d4ff'; techBtn.textContent = "< BACK TO ATTACK";
    }
}

// 5. AI Turn
function executeAITurn() {
    let aiNodes = nodes.filter(n => n.owner === 1);
    if(aiNodes.length === 0) return;

    let aiReserves = Math.max(3, Math.floor(aiNodes.length / 3));
    for(let i=0; i<aiReserves; i++) {
        let target = aiNodes[Math.floor(Math.random() * aiNodes.length)];
        target.troops++;
    }

    aiNodes.forEach(attacker => {
        if (attacker.troops > 4) {
            attacker.links.forEach(targetId => {
                let defender = nodes.find(n => n.id === targetId);
                if (defender.owner === 0 && attacker.troops > defender.troops) {
                    resolveCombat(attacker, defender);
                }
            });
        }
    });

    checkWinCondition();
    
    if(phase === 'AI_TURN') {
        phase = 'DEPLOY';
        calculateReserves();
        drawMap();
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
    phase = 'DEPLOY'; dPoints = 0;
    initMap();
});

window.addEventListener('resize', resize);
resize();
