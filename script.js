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

const modeButtons = document.querySelectorAll(".mode-btn");
const newGameButton = document.getElementById("new-game");

let lastMove = null;
let gameOver = false;
let playerTurn = true;

// "ai" = Player vs the computer, "friend" = two people sharing the screen.
// In friend mode the second person takes the "AI" slot (O), so all the board
// logic below works the same for both modes.
let gameMode = "ai";
// Who places the next mark: "Player" (X) or "AI" (O). Only changes in friend mode.
let currentMover = "Player";
let aiTimeout = null;

// Converts a spot number (1-81) into its cell element on the page
function getCellElement(position) {
    const gridIndex = Math.floor((position - 1) / 9);
    const withinGrid = (position - 1) % 9;
    return subBoards[gridIndex].children[withinGrid];
}

function drawCell(position) {
    const cell = getCellElement(position);
    const symbol = gameBoard[position].trim();
    cell.textContent = symbol;
    cell.classList.remove("x", "o");
    if (symbol === "X") {
        cell.classList.add("x");
    } else if (symbol === "O") {
        cell.classList.add("o");
    }
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

    const subBoard = subBoards[gridNumber - 1];
    subBoard.dataset.winner = symbol;
    subBoard.classList.add("won", symbol === "X" ? "won-x" : "won-o");
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
            return gameMode === "ai" ? "Congrats you won" : "Player 1 (X) wins!";
        } else if (allWonBy(metaLine, "AI")) {
            return gameMode === "ai" ? "The A.I wins" : "Player 2 (O) wins!";
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

// ---------------------------------------------------------------------------
// AI: minimax with alpha-beta pruning
//
// Searching the whole game is impossible (81 spots), so the search is
// depth-limited and uses iterative deepening: it searches 1 move ahead, then 2,
// then 3... until the time budget runs out, and plays the best move from the
// last depth it fully finished. Positions at the depth limit are scored by
// evaluate() instead of by who won.
// ---------------------------------------------------------------------------

const AI_TIME_LIMIT_MS = 1000;  // Raise for a harder AI, lower for a faster one
const AI_MAX_DEPTH = 12;
const WIN_SCORE = 100000;

const EMPTY = 0;
const HUMAN = 1;
const COMPUTER = 2;

// The search uses its own light-weight board so it can place and undo moves
// quickly without touching the page. Index 0 is unused (spots/grids are 1-based).
const searchCells = new Uint8Array(82);   // EMPTY, HUMAN or COMPUTER for each spot
const searchOwner = new Uint8Array(10);   // Who has claimed each grid
const searchFilled = new Uint8Array(10);  // How many spots are used in each grid

// Same winning lines as gridPattern but with 0-8 offsets inside a grid
const localLines = gridPattern.map(line => line.map(spot => spot - 1));

// Trying the center, then corners, then edges first helps alpha-beta prune more
const MOVE_ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7];

// How much owning each grid is worth (center > corners > edges)
const GRID_VALUE = [0, 50, 40, 50, 40, 60, 40, 50, 40, 50];

function gridOf(spot) {
    return Math.floor((spot - 1) / 9) + 1;
}

// Copies the real game into the search board
function syncSearchState() {
    searchCells.fill(EMPTY);
    searchOwner.fill(EMPTY);
    searchFilled.fill(0);

    for (const spot of playerPositions) {
        searchCells[spot] = HUMAN;
        searchFilled[gridOf(spot)]++;
    }
    for (const spot of aiPositions) {
        searchCells[spot] = COMPUTER;
        searchFilled[gridOf(spot)]++;
    }
    for (const gridNumber of claimedGrids) {
        searchOwner[gridNumber] = whoTookGrid(gridNumber) === "Player" ? HUMAN : COMPUTER;
    }
}

// Places a move, returns true if it won its grid (needed to undo it)
function makeMove(spot, who) {
    const gridNumber = gridOf(spot);
    searchCells[spot] = who;
    searchFilled[gridNumber]++;

    if (searchOwner[gridNumber] === EMPTY) {
        const base = (gridNumber - 1) * 9 + 1;
        for (const [a, b, c] of localLines) {
            if (searchCells[base + a] === who && searchCells[base + b] === who && searchCells[base + c] === who) {
                searchOwner[gridNumber] = who;
                return true;
            }
        }
    }
    return false;
}

function undoMove(spot, wonGrid) {
    const gridNumber = gridOf(spot);
    searchCells[spot] = EMPTY;
    searchFilled[gridNumber]--;
    if (wonGrid) {
        searchOwner[gridNumber] = EMPTY;
    }
}

// A grid is finished if someone claimed it or all 9 spots are used
function isSearchGridFull(gridNumber) {
    return searchOwner[gridNumber] !== EMPTY || searchFilled[gridNumber] === 9;
}

function searchWinner() {
    for (const [a, b, c] of gridPattern) {
        const owner = searchOwner[a];
        if (owner !== EMPTY && owner === searchOwner[b] && owner === searchOwner[c]) {
            return owner;
        }
    }
    return EMPTY;
}

// Same rule as allowedSpots(): play in the grid matching the last spot,
// or anywhere if that grid is already finished
function searchMoves(previousMove) {
    const moves = [];
    const target = previousMove === null ? 0 : forcedGrid(previousMove);

    for (const gridOrder of MOVE_ORDER) {
        const gridNumber = gridOrder + 1;
        if (target !== 0 && !isSearchGridFull(target) && gridNumber !== target) {
            continue;
        }
        if (isSearchGridFull(gridNumber)) {
            continue;
        }
        const base = (gridNumber - 1) * 9 + 1;
        for (const spotOrder of MOVE_ORDER) {
            if (searchCells[base + spotOrder] === EMPTY) {
                moves.push(base + spotOrder);
            }
        }
    }
    return moves;
}

// Guesses how good a position is for the AI when the search can't go any deeper.
// Positive is good for the AI, negative is good for the Player.
function evaluate() {
    let score = 0;

    for (let gridNumber = 1; gridNumber <= 9; gridNumber++) {
        const owner = searchOwner[gridNumber];
        if (owner === COMPUTER) {
            score += GRID_VALUE[gridNumber];
        } else if (owner === HUMAN) {
            score -= GRID_VALUE[gridNumber];
        } else if (searchFilled[gridNumber] < 9) {
            // Unclaimed grid: reward lines the AI could still finish and punish the Player's
            const base = (gridNumber - 1) * 9 + 1;
            for (const [a, b, c] of localLines) {
                let ai = 0, human = 0;
                for (const offset of [a, b, c]) {
                    const mark = searchCells[base + offset];
                    if (mark === COMPUTER) ai++;
                    else if (mark === HUMAN) human++;
                }
                if (human === 0 && ai > 0) score += ai === 2 ? 6 : 1;
                if (ai === 0 && human > 0) score -= human === 2 ? 6 : 1;
            }
        }
    }

    // Lines of grids across the big board
    for (const line of gridPattern) {
        let ai = 0, human = 0, open = 0;
        for (const gridNumber of line) {
            if (searchOwner[gridNumber] === COMPUTER) ai++;
            else if (searchOwner[gridNumber] === HUMAN) human++;
            else if (searchFilled[gridNumber] < 9) open++;
        }
        if (human === 0 && ai + open === 3) score += ai === 2 ? 80 : ai === 1 ? 10 : 0;
        if (ai === 0 && human + open === 3) score -= human === 2 ? 80 : human === 1 ? 10 : 0;
    }

    return score;
}

let searchDeadline = 0;
let searchTimedOut = false;
let searchNodes = 0;

// Same idea as the standard minimax: the AI maximizes the score, the Player minimizes it.
// alpha = best score the AI is already guaranteed, beta = best score the Player is
// already guaranteed. Once alpha >= beta this branch can't change the result, so we stop.
function minimax(aiTurn, depth, depthLimit, previousMove, alpha, beta) {
    // Checking the clock every so often so the AI never freezes the page
    if ((++searchNodes & 1023) === 0 && performance.now() > searchDeadline) {
        searchTimedOut = true;
    }
    if (searchTimedOut) {
        return 0;
    }

    // Someone won the game: faster wins score higher, slower losses score higher
    const winner = searchWinner();
    if (winner === COMPUTER) {
        return WIN_SCORE - depth;
    }
    if (winner === HUMAN) {
        return -WIN_SCORE + depth;
    }

    const moves = searchMoves(previousMove);
    if (moves.length === 0) {
        return 0; // Draw
    }
    if (depth >= depthLimit) {
        return evaluate();
    }

    let bestScore = aiTurn ? -Infinity : Infinity;

    for (const spot of moves) {
        const wonGrid = makeMove(spot, aiTurn ? COMPUTER : HUMAN);
        const score = minimax(!aiTurn, depth + 1, depthLimit, spot, alpha, beta);
        undoMove(spot, wonGrid);

        if (aiTurn) {
            bestScore = Math.max(bestScore, score);
            alpha = Math.max(alpha, bestScore);
        } else {
            bestScore = Math.min(bestScore, score);
            beta = Math.min(beta, bestScore);
        }

        if (alpha >= beta) {
            break; // Pruned: the other side would never let the game get here
        }
    }
    return bestScore;
}

// Picks the AI's move from the spots it is allowed to play
function chooseAiMove(choices) {
    syncSearchState();

    // Shuffled so equally good moves don't always play out the same game
    let moves = choices.slice().sort(() => Math.random() - 0.5);
    let bestMove = moves[0];

    searchDeadline = performance.now() + AI_TIME_LIMIT_MS;
    searchTimedOut = false;
    searchNodes = 0;

    for (let depthLimit = 1; depthLimit <= AI_MAX_DEPTH; depthLimit++) {
        let iterationBest = null;
        let iterationScore = -Infinity;
        let alpha = -Infinity;

        for (const spot of moves) {
            const wonGrid = makeMove(spot, COMPUTER);
            const score = minimax(false, 1, depthLimit, spot, alpha, Infinity);
            undoMove(spot, wonGrid);

            if (searchTimedOut) {
                break;
            }
            if (score > iterationScore) {
                iterationScore = score;
                iterationBest = spot;
            }
            alpha = Math.max(alpha, iterationScore);
        }

        // Ran out of time mid-depth, so keep the last fully searched answer
        if (searchTimedOut) {
            break;
        }

        bestMove = iterationBest;
        // Searching the best move first at the next depth makes pruning much stronger
        moves = [bestMove, ...moves.filter(spot => spot !== bestMove)];

        // Found a forced win (or every move loses), searching deeper won't change anything
        if (Math.abs(iterationScore) > WIN_SCORE - 1000) {
            break;
        }
    }
    return bestMove;
}

// Marks the spot the AI just played so the player can see where it went
function markAiMove(position) {
    clearAiMove();
    getCellElement(position).classList.add("ai-last-move");
}

function clearAiMove() {
    document.querySelectorAll(".cell.ai-last-move").forEach(cell => cell.classList.remove("ai-last-move"));
}

// Shows whose turn it is next and where they may play, given the move just made
function beginTurn(previousMove) {
    const choices = allowedSpots(previousMove);
    if (choices.length === 0) {
        endGame("Draw");
        return;
    }

    const symbol = currentMover === "Player" ? "X" : "O";
    let who = "You";
    if (gameMode === "friend") {
        who = currentMover === "Player" ? "Player 1 (X)" : "Player 2 (O)";
    }

    const targetGrid = forcedGrid(previousMove);
    if (isGridFull(targetGrid)) {
        statusElement.textContent = who + " may place anywhere on the board";
    } else {
        statusElement.textContent = who + " must place an " + symbol + " in grid " + targetGrid;
    }
    highlightSpots(choices);
}

function aiTurn() {
    aiTimeout = null;
    const choices = allowedSpots(lastMove);
    if (choices.length === 0) {
        endGame("Draw");
        return;
    }

    const aiPosition = chooseAiMove(choices);
    placement(aiPosition, "AI");
    markAiMove(aiPosition);
    checkingAllGrids();
    lastMove = aiPosition;

    const result = winCondition();
    if (result !== "") {
        endGame(result);
        return;
    }

    // Player movement
    beginTurn(aiPosition);
    playerTurn = true;
}

function handlePlayerClick(position) {
    if (gameOver || !playerTurn) {
        return;
    }

    // The very first move can go anywhere, after that the previous move decides
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

    placement(position, currentMover);
    checkingAllGrids();
    lastMove = position;
    highlightSpots([]);
    clearAiMove();

    const result = winCondition();
    if (result !== "") {
        endGame(result);
        return;
    }

    if (gameMode === "friend") {
        currentMover = currentMover === "Player" ? "AI" : "Player";
        beginTurn(position);
        return;
    }

    playerTurn = false;
    statusElement.textContent = "The AI is now thinking";
    // Short delay so "The AI is now thinking" is drawn before the search starts
    aiTimeout = setTimeout(aiTurn, 100);
}

function startMessage() {
    if (gameMode === "friend") {
        return "Player 1 (X) starts: place an X anywhere (spots 1-81)";
    }
    return "The Player can start by placing an X anywhere (spots 1-81)";
}

// Wipes the board and starts a fresh game in the given mode
function resetGame(mode) {
    if (aiTimeout !== null) {
        clearTimeout(aiTimeout);
        aiTimeout = null;
    }

    gameMode = mode;
    playerPositions.length = 0;
    aiPositions.length = 0;
    claimedGrids.length = 0;
    gameBoard.fill(" ");
    lastMove = null;
    gameOver = false;
    playerTurn = true;
    currentMover = "Player";

    subBoards.forEach(subBoard => {
        subBoard.classList.remove("won", "won-x", "won-o");
        delete subBoard.dataset.winner;
        Array.from(subBoard.children).forEach(cell => {
            cell.textContent = "";
            cell.classList.remove("x", "o", "allowed", "ai-last-move");
        });
    });

    modeButtons.forEach(button => {
        const selected = button.dataset.mode === mode;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
    statusElement.textContent = startMessage();
}

modeButtons.forEach(button => {
    button.addEventListener("click", () => {
        // Picking the mode you're already in leaves the current game alone
        if (button.dataset.mode !== gameMode) {
            resetGame(button.dataset.mode);
        }
    });
});
newGameButton.addEventListener("click", () => resetGame(gameMode));

// Hooks every cell on the page up to its spot number
subBoards.forEach((subBoard, gridIndex) => {
    Array.from(subBoard.children).forEach((cell, cellIndex) => {
        const position = gridIndex * 9 + cellIndex + 1;
        cell.addEventListener("click", () => handlePlayerClick(position));
    });
});

statusElement.textContent = startMessage();
