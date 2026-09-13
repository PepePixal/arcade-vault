# Triple Shot Power-Up — Implementation Memory

## What
Implemented Triple Shot power-up in the Asteroids game on branch `01-disparo-triple`.

## Feature Details
- 15% random chance to spawn when any asteroid is destroyed
- Only one power-up spawns per entire game session
- Collect by collision with ship → 3 bullets fire in ±15° fan pattern (PI/12 radians)
- Effect lasts 10 seconds with a draining cyan timer bar in HUD
- Ship shows 3 cyan dots as visual indicator when effect is active
- Power-up appears as pulsing cyan ring (#0ff) with 3 tick marks, TTL 12s

## New State Variables
`powerup`, `powerupSpawned`, `tripleShotActive`, `tripleShotTimer`

## Files Modified
- `game.js` only

## Status
- Implemented, not yet committed
- Needs browser testing before committing

## Next Steps (for tomorrow)
1. Open `index.html` in browser
2. Destroy asteroids until power-up spawns (cyan ring)
3. Collect it and verify: 3-bullet fan, cyan dots on ship, timer bar
4. After 10s verify it deactivates back to single shot
5. Commit when verified working
