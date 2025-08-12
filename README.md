# Chess-

# Offline Chess (Responsive, No-Internet)
<br>
This is a clean, modern, fully offline chess game that runs in your browser. 
It works on desktop and mobile with tap/click controls, legal move highlights, castling, en passant, pawn promotions, undo, board flip, and an optional chess clock.



## Features
- Responsive board (mobile and desktop)
- Click/tap to move with legal move highlights
- Full rules: castling, en passant, promotions
- Move list and board flip
- pause/resume
- 100% offline (no external network calls)




## Quick Start
Option A: Open directly (may work in many browsers)
- Double-click `index.html` to open in your default browser.
<br>
Option B: Serve locally (recommended for all browsers)
- Windows PowerShell:
- <br>
```powershell
<br>
   python -m http.server 5173
<br>

- Open: `http://localhost:5173/`
- Internet is not required; this just serves files from your machine. You can verify by switching to airplane mode.

<br>
## How to Play
<br>
- White moves first. Click a white piece to see blue dots (legal targets), then click a target square to move.
<br>
- Promotions: when a pawn reaches the last rank, a dialog appears to choose Queen/Rook/Bishop/Knight.
<b>
- Castling: click the king, then click the castling square (g1/c1 or g8/c8) when allowed.
<br>
- En passant: available immediately after an opponent’s double-pawn push.
<br>
- Undo: take back the last move.
<br>
- Flip: change board orientation.





## License
Use freely in your project. Attribution appreciated.






