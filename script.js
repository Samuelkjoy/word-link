 // Canvas and DOM Elements
 const canvas = document.getElementById('gameCanvas');
 const ctx = canvas.getContext('2d');
 const scoreDisplay = document.getElementById("score");
 const diffDisplay = document.getElementById("diffLevel");
 const multiplierButton = document.getElementById("multiplierButton");
 const reshuffleButton = document.getElementById("reshuffleButton");
 const submitWordButton = document.getElementById("submitWordButton");
 const clearSelectionButton = document.getElementById("clearSelectionButton");
 const introScreen = document.getElementById("introScreen");
 const startButton = document.getElementById("startButton");

 // Global game settings and variables
 const HEX_RADIUS = 30;
 const HEX_HEIGHT = Math.sqrt(3) * HEX_RADIUS;
 let nodes = [];
 let selectedNodes = [];
 let score = 0;
 let multiplierActive = 1; // 1 = normal, 2 = double points for next valid word
 let driftMultiplier = 1.0; // set based on player's selection from intro screen
 let difficultyInterval;

 // Global color settings that change with score
 let bgColor = "#222";
 let letterColor = "#fff";

 // Fallback dictionary words (in case API fails)
 const fallbackWords = ["CAT", "DOG", "MOUSE", "HOUSE", "FIRE", "TREE", "BIRD", "STAR", "MOON", "PLANET"];

 // Update colors based on current score thresholds
 function updateColors() {
   if (score >= 600) {
     bgColor = "#1a1a1a";
     letterColor = "#FFD700"; // Gold
   } else if (score >= 400) {
     bgColor = "#222";
     letterColor = "#00FF00"; // Bright Green
   } else if (score >= 200) {
     bgColor = "#333";
     letterColor = "#FF4500"; // Orange Red
   } else {
     bgColor = "#222";
     letterColor = "#fff";
   }
   // Update canvas background style
   canvas.style.backgroundColor = bgColor;
 }

 // Return a random letter A-Z
 function getRandomLetter() {
   return String.fromCharCode(65 + Math.floor(Math.random() * 26));
 }

 // Node class representing each letter tile
 class Node {
   constructor(x, y, letter) {
     this.x = x;
     this.y = y;
     this.letter = letter;
     this.driftX = (Math.random() - 0.5) * 0.5;
     this.driftY = (Math.random() - 0.5) * 0.5;
     this.selected = false;
   }
   update() {
     // Update position with drift multiplied by current difficulty
     this.x += this.driftX * driftMultiplier;
     this.y += this.driftY * driftMultiplier;
     
     // Bounce off walls
     if (this.x - HEX_RADIUS < 0) { this.x = HEX_RADIUS; this.driftX *= -1; }
     if (this.x + HEX_RADIUS > canvas.width) { this.x = canvas.width - HEX_RADIUS; this.driftX *= -1; }
     if (this.y - HEX_RADIUS < 0) { this.y = HEX_RADIUS; this.driftY *= -1; }
     if (this.y + HEX_RADIUS > canvas.height) { this.y = canvas.height - HEX_RADIUS; this.driftY *= -1; }
   }
   draw() {
     // Draw hexagon with selected state highlight
     ctx.fillStyle = this.selected ? "#FFAA33" : "#333";
     ctx.beginPath();
     for (let i = 0; i < 6; i++) {
       const angle = Math.PI / 180 * (60 * i - 30);
       const vx = this.x + HEX_RADIUS * Math.cos(angle);
       const vy = this.y + HEX_RADIUS * Math.sin(angle);
       if (i === 0) { ctx.moveTo(vx, vy); } else { ctx.lineTo(vx, vy); }
     }
     ctx.closePath();
     ctx.fill();
     ctx.strokeStyle = "#888";
     ctx.stroke();
     // Draw the letter at the center using dynamic letterColor
     ctx.fillStyle = letterColor;
     ctx.font = "20px Arial";
     ctx.textAlign = "center";
     ctx.textBaseline = "middle";
     ctx.fillText(this.letter, this.x, this.y);
   }
 }

 // Resolve collisions between nodes using basic elastic collision for equal masses
 function resolveCollisions() {
   for (let i = 0; i < nodes.length; i++) {
     for (let j = i + 1; j < nodes.length; j++) {
       const nodeA = nodes[i];
       const nodeB = nodes[j];
       const dx = nodeA.x - nodeB.x;
       const dy = nodeA.y - nodeB.y;
       const distance = Math.hypot(dx, dy);
       if (distance < HEX_RADIUS * 2) {
         // Normal vector
         const nx = dx / distance;
         const ny = dy / distance;
         // Relative velocity
         const dvx = nodeA.driftX - nodeB.driftX;
         const dvy = nodeA.driftY - nodeB.driftY;
         // Dot product
         const dot = dvx * nx + dvy * ny;
         if (dot < 0) { // Only resolve if nodes are moving toward each other
           const impulse = (2 * dot) / 2; // masses are 1
           nodeA.driftX -= impulse * nx;
           nodeA.driftY -= impulse * ny;
           nodeB.driftX += impulse * nx;
           nodeB.driftY += impulse * ny;
         }
       }
     }
   }
 }

 // Initialize grid: fill the canvas with nodes arranged in a hexagonal grid pattern
 function initGrid() {
   nodes = [];
   selectedNodes = [];
   const margin = 50;
   const effectiveWidth = canvas.width - margin * 2;
   const effectiveHeight = canvas.height - margin * 2;
   const colSpacing = HEX_RADIUS * 1.8;
   const rowSpacing = HEX_HEIGHT;
   const numCols = Math.floor(effectiveWidth / colSpacing);
   const numRows = Math.floor(effectiveHeight / rowSpacing);
   for (let row = 0; row < numRows; row++) {
     for (let col = 0; col < numCols; col++) {
       const x = margin + col * colSpacing;
       const y = margin + rowSpacing * row + (col % 2) * (rowSpacing / 2);
       nodes.push(new Node(x, y, getRandomLetter()));
     }
   }
 }

 // Main animation loop: update positions, resolve collisions, and draw nodes
 function animate() {
   ctx.clearRect(0, 0, canvas.width, canvas.height);
   nodes.forEach(node => { node.update(); });
   resolveCollisions();
   nodes.forEach(node => { node.draw(); });
   requestAnimationFrame(animate);
 }

 // Utility: get node at (x, y) if within HEX_RADIUS
 function getNodeAt(x, y) {
   return nodes.find(node => Math.hypot(node.x - x, node.y - y) < HEX_RADIUS);
 }

 // Check word using Dictionary API with fallback words
 async function checkWord() {
   if (!selectedNodes.length) return;
   const word = selectedNodes.map(node => node.letter).join("");
   try {
     const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`);
     if (response.ok) {
       processValidWord(word);
     } else {
       if (fallbackWords.includes(word)) {
         processValidWord(word);
       } else {
         processInvalidWord(word);
       }
     }
   } catch (err) {
     if (fallbackWords.includes(word)) {
       processValidWord(word);
     } else {
       processInvalidWord(word);
     }
   }
   clearSelection();
 }

 function processValidWord(word) {
   // Calculate points and update score with multiplier
   const points = word.length * 10 * multiplierActive;
   score += points;
   scoreDisplay.innerText = score;
   // Reset multiplier after use
   multiplierActive = 1;
   multiplierButton.disabled = false;
   // Update colors based on score thresholds
   updateColors();
   // Refresh letters on used nodes
   selectedNodes.forEach(node => node.letter = getRandomLetter());
 }

 function processInvalidWord(word) {
   console.log(`Invalid word: ${word}`);
 }

 // Clear selection helper function
 function clearSelection() {
   selectedNodes.forEach(node => node.selected = false);
   selectedNodes = [];
 }

 // Click event: select a node on click
 canvas.addEventListener("click", (e) => {
   const node = getNodeAt(e.offsetX, e.offsetY);
   if (node && !node.selected) {
     node.selected = true;
     selectedNodes.push(node);
   }
 });

 // Button to submit the current word
 submitWordButton.addEventListener("click", checkWord);

 // Button to clear current letter selection
 clearSelectionButton.addEventListener("click", clearSelection);

 // Power-ups
 multiplierButton.addEventListener("click", () => {
   if (multiplierActive === 1) {
     multiplierActive = 2;
     multiplierButton.disabled = true;
     console.log("Multiplier activated for next word!");
   }
 });
 reshuffleButton.addEventListener("click", () => {
   initGrid();
   console.log("Board reshuffled!");
 });

 // Increase difficulty over time by increasing driftMultiplier
 function increaseDifficulty() {
   driftMultiplier += 0.1;
   diffDisplay.innerText = driftMultiplier.toFixed(1);
   console.log(`Difficulty increased: driftMultiplier is now ${driftMultiplier.toFixed(1)}`);
 }

 // Start the game when the player clicks the Start button on the intro screen
 function startGame() {
   // Set driftMultiplier based on selected speed from the intro form
   const speedChoice = document.querySelector('input[name="speed"]:checked').value;
   driftMultiplier = parseFloat(speedChoice);
   diffDisplay.innerText = driftMultiplier.toFixed(1);
   introScreen.style.display = "none";
   updateColors(); // Initialize colors based on starting score (0)
   initGrid();
   animate();
   difficultyInterval = setInterval(increaseDifficulty, 15000);
 }
 startButton.addEventListener("click", startGame);