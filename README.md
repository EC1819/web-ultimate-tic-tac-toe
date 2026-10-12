# Web-Ultimate-Tic-Tac-Toe
Play Ultiamte Tic Tac Toe in an browser against an amazing computer opponent that uses minimax with alpha-beta pruning. Or against a friend on the same screen

**Features**:

Two modes: Play vs AI or Play vs Friend

Legal Moves are highlighted in yellow, so you always know where you can place your next move

New Game button so that you can always start a new game

**Rules for Ultimate Tic Tac Toe**
- Ulimate Tic Tac Toe is 9 small tic tac toe boards arranged in a 3x3 grid
- Your moves decides where your opponent plays next
- The way to win a small board is by getting 3 in a row inside it
- If you are sent to a board that's is full or already won then you can place your next move on any open spot
- Win 3 small boards in a row to win

**How the AI Works**

PLaying regular tic tac toe it is super easy to calcuate all the possible moves since the board is small

However with Ultimate Tic Tac Toe it's much harder, so the AI uses techniques that work under a time limit

- Minimax: the AI assumes both players play their best and picks moves with the best guaranteed outcome
- Alpha-beta pruning: skips branches of the search that can't change the final decision
- Iterative deepening: searches 1 move ahead, then 2, then 3, until its 1-second budget runs out, and then plats the best move from the deepest search
- Evaluation function: when the search stops before the game ends, it scores the postion based on
  -  Which small boards each player owns
  -  Lines that can still be completed both inside small boards and acorss the big board
 - Move ordering: Tries the center, then corners, then edges, and the previous best move first, which lets pruning skip more of the search
 - Faster wins score higher, so the AI doesn't drag out a game it has already won

**Run it locally**
- Clone the repository
- Open index.html in any browser.
  - Nothing to install and no build step

**Evolution of Project**
- This is the 4th version of the same idea
1. Terminal tic-tac-toe in Java
2. Browser tic-tac-toe in HTML, CSS, and JavaScript
3. Terminal Ultimate Tic Tac Toe in Java
4. This version, which brings the ultimate rules to the browser and replaces the random opponent with a search-based AI

