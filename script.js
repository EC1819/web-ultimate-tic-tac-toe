// Spots are numbered 1-81: grid 1 holds spots 1-9, grid 2 holds spots 10-18, and so on.

// Tracks the spots on the board that are taken by the Player/Human
const playerPositions = [];
// Tracks the spots in which the AI/CPU has taken on the board
const aiPositions = [];
// Grids that have already been won
const claimedGrids = [];

const gridPattern = [
    [1, 2, 3], [4, 5, 6], [7, 8, 9],
    [1, 4, 7], [2, 5, 8], [3, 6, 9],
    [1, 5, 9], [3, 5, 7]
];

// Winning lines for each of the 9 grids, shifted to that grid's spot numbers
const allGrids = [];
for (let gridNumber = 1; gridNumber <= 9; gridNumber++) {
    const offset = (gridNumber - 1) * 9;
    allGrids.push(gridPattern.map(line => line.map(spot => spot + offset)));
}

// Index 0 is unused so the array can be indexed by spot number (1-81)
const gameBoard = new Array(82).fill(' ');

const statusElement = document.getElementById("status");
const subBoards = document.querySelectorAll(".sub-board");

let lastMove = null;
let gameOver = false;
let playerTurn = true;

// Converts a spot number (1-81) into its cell element on the page
function getCellElement(position) {
    const gridIndex = Math.floor((position - 1) / 9);
    const withinGrid = (position - 1) % 9;
    return subBoards[gridIndex].children[withinGrid];
}

function drawCell(position) {
    getCellElement(position).textContent = gameBoard[position].trim();
}

function placement(position, user) {
    let symbol;
    if (user === "Player") {
        symbol = "X";
        playerPositions.push(position);
    } else {
        symbol = "O";
        aiPositions.push(position);
    }
    gameBoard[position] = symbol;
    drawCell(position);
}

// Fills a whole grid with the winner's symbol once they take it
function resettingGrid(gridNumber) {
    if (claimedGrids.includes(gridNumber)) {
        return;
    }
    const winner = whoTookGrid(gridNumber);
    if (winner === "") {
        return;
    }

    claimedGrids.push(gridNumber);

    const symbol = winner === "Player" ? "X" : "O";
    for (const spot of spotsInGrid(gridNumber)) {
        gameBoard[spot] = symbol;
        drawCell(spot);
    }
}

function checkingAllGrids() {
    for (let i = 1; i <= 9; i++) {
        resettingGrid(i);
    }
}

// Takes a gridNumber and looks up the winning lines and checks each one
function whoTookGrid(gridNumber) {
    for (const line of getGridLines(gridNumber)) {
        if (line.every(spot => playerPositions.includes(spot))) {
            return "Player";
        }
        if (line.every(spot => aiPositions.includes(spot))) {
            return "AI";
        }
    }
    return "";
}

function getGridLines(gridNumber) {
    return allGrids[gridNumber - 1];
}

function winCondition() {
    for (const metaLine of gridPattern) {
        if (allWonBy(metaLine, "Player")) {
            return "Congrats you won";
        } else if (allWonBy(metaLine, "AI")) {
            return "The A.I wins";
        }
    }
    if (isBoardFull()) {
        return "Draw";
    }
    return "";
}

function isBoardFull() {
    for (let spot = 1; spot <= 81; spot++) {
        if (gameBoard[spot] === " ") {
            return false;
        }
    }
    return true;
}

// Checking if the Player or AI has won all the grids in a line to win the game
function allWonBy(gridNumbers, player) {
    return gridNumbers.every(gridNumber =>
        claimedGrids.includes(gridNumber) && whoTookGrid(gridNumber) === player
    );
}

function isGridFull(gridNumber) {
    if (gridNumber < 1 || gridNumber > 9) {
        return false;
    }
    return spotsInGrid(gridNumber).every(spot => gameBoard[spot] !== " ");
}

// Tells the user which grid they are forced to play in
function forcedGrid(position) {
    return ((position - 1) % 9) + 1;
}

function spotsInGrid(gridNumber) {
    const base = (gridNumber - 1) * 9;
    const spots = [];
    for (let i = 1; i <= 9; i++) {
        spots.push(base + i);
    }
    return spots;
}

function allowedSpots(previousMove) {
    const targetGrid = forcedGrid(previousMove);
    let candidates;

    if (isGridFull(targetGrid)) {
        candidates = [];
        for (let i = 1; i <= 81; i++) {
            candidates.push(i);
        }
    } else {
        candidates = spotsInGrid(targetGrid);
    }

    return candidates.filter(spot => isSpotEmpty(spot));
}

function isSpotEmpty(position) {
    return gameBoard[position] === " ";
}

// Highlights the spots the player is allowed to pick from
function highlightSpots(spots) {
    document.querySelectorAll(".cell.allowed").forEach(cell => cell.classList.remove("allowed"));
    for (const spot of spots) {
        getCellElement(spot).classList.add("allowed");
    }
}

function endGame(message) {
    gameOver = true;
    highlightSpots([]);
    statusElement.textContent = message;
}

function aiTurn() {
    const choices = allowedSpots(lastMove);
    if (choices.length === 0) {
        endGame("Draw");
        return;
    }

    const aiPosition = choices[Math.floor(Math.random() * choices.length)];
    placement(aiPosition, "AI");
    checkingAllGrids();
    lastMove = aiPosition;

    const result = winCondition();
    if (result !== "") {
        endGame(result);
        return;
    }

    // Player movement
    const targetGrid = forcedGrid(aiPosition);
    const playerChoices = allowedSpots(aiPosition);
    if (playerChoices.length === 0) {
        endGame("Draw");
        return;
    }
    if (isGridFull(targetGrid)) {
        statusElement.textContent = "You may place anywhere on the board";
    } else {
        statusElement.textContent = "You must place an X in grid " + targetGrid;
    }
    highlightSpots(playerChoices);
    playerTurn = true;
}

function handlePlayerClick(position) {
    if (gameOver || !playerTurn) {
        return;
    }

    // The very first move can go anywhere, after that the AI's last move decides
    if (lastMove !== null) {
        const playerChoices = allowedSpots(lastMove);
        if (!playerChoices.includes(position)) {
            if (!isSpotEmpty(position)) {
                statusElement.textContent = "Spot is already taken. Please choose another position";
            } else {
                statusElement.textContent = "The spot chosen is not in the correct grid (grid " +
                    forcedGrid(lastMove) + ")";
            }
            return;
        }
    }

    playerTurn = false;
    placement(position, "Player");
    checkingAllGrids();
    lastMove = position;
    highlightSpots([]);

    const result = winCondition();
    if (result !== "") {
        endGame(result);
        return;
    }

    statusElement.textContent = "The AI is now thinking";
    setTimeout(aiTurn, 500);
}

// Hooks every cell on the page up to its spot number
subBoards.forEach((subBoard, gridIndex) => {
    Array.from(subBoard.children).forEach((cell, cellIndex) => {
        const position = gridIndex * 9 + cellIndex + 1;
        cell.addEventListener("click", () => handlePlayerClick(position));
    });
});

statusElement.textContent = "The Player can start by placing an X anywhere (spots 1-81)";
