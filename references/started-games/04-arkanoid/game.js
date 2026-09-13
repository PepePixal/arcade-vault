const BRICK_WIDTH = 74;
const BRICK_HEIGHT = 28;
const BRICK_GAP = 4;
const BRICK_OFFSET_TOP = 60;

function getBrickOffsetLeft( cols ) {
  return ( 800 - ( cols * BRICK_WIDTH + ( cols - 1 ) * BRICK_GAP ) ) / 2;
}

const BRICK_COLORS = [ 'red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green' ];

const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 14;
const PADDLE_SPEED = 8;

const BALL_RADIUS = 8;

const SOUND_BALL_BOUNCE = 'assets/sounds/ball-bounce.mp3';
const SOUND_BRICK_BREAK = 'assets/sounds/break-sound.mp3';

const LEVEL_TRANSITION_MS = 1500;

const BRICK_DESCEND_INTERVAL_MS = 5000;

const canvas = document.getElementById( 'gameCanvas' );
const ctx = canvas.getContext( '2d' );
const levelSelect = document.getElementById( 'levelSelect' );

let levelSelectVisible = false;

function syncLevelSelect() {
  if ( state.paused && !levelSelectVisible ) {
    levelSelect.value = '';
    levelSelect.style.display = 'block';
    levelSelectVisible = true;
  } else if ( !state.paused && levelSelectVisible ) {
    levelSelect.style.display = 'none';
    levelSelectVisible = false;
  }
}

function playSound( src ) {
  new Audio( src ).play();
}

function createBricks( levelIndex ) {
  const pattern = LEVELS[ levelIndex - 1 ].pattern;
  const cols = pattern[ 0 ].length;
  const offsetLeft = getBrickOffsetLeft( cols );

  const bricks = [];
  for ( let row = 0; row < pattern.length; row++ ) {
    for ( let col = 0; col < cols; col++ ) {
      if ( pattern[ row ][ col ] !== '1' ) continue;

      bricks.push( {
        x: offsetLeft + col * ( BRICK_WIDTH + BRICK_GAP ),
        y: BRICK_OFFSET_TOP + row * ( BRICK_HEIGHT + BRICK_GAP ),
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        color: BRICK_COLORS[ row % BRICK_COLORS.length ],
        active: true
      } );
    }
  }
  return bricks;
}

function startLevel( levelIndex ) {
  const config = LEVELS[ levelIndex - 1 ];

  state.level = levelIndex;
  state.levelCompleteAt = null;
  state.lastDescendAt = levelIndex === LEVELS.length ? performance.now() : null;
  state.lives = 3;
  state.explosions = [];
  state.bricks = createBricks( levelIndex );

  state.paddle.width = config.paddleWidth;
  state.paddle.x = ( state.width - config.paddleWidth ) / 2;

  state.ball.x = state.width / 2;
  state.ball.y = state.height - 60;
  state.ball.vx = config.ballSpeed;
  state.ball.vy = -config.ballSpeed;

  state.launched = false;
}

function createInitialState() {
  state = {
    canvas,
    width: canvas.width,
    height: canvas.height,
    score: 0,
    gameOver: false,
    won: false,
    paused: false,
    launched: false,

    paddle: {
      x: 0,
      y: canvas.height - 40,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
      speed: PADDLE_SPEED
    },

    ball: {
      x: 0,
      y: 0,
      radius: BALL_RADIUS,
      vx: 0,
      vy: 0
    },

    bricks: [],
    explosions: [],

    input: {
      mouseX: null,
      mouseMoved: false,
      keyLeft: false,
      keyRight: false
    }
  };

  startLevel( 1 );

  return state;
}

let state;
state = createInitialState();

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect( 0, 0, state.width, state.height );

  drawSprite( ctx, 'paddle', state.paddle.x, state.paddle.y, state.paddle.width, state.paddle.height );
  drawSprite( ctx, 'ball', state.ball.x - state.ball.radius, state.ball.y - state.ball.radius, state.ball.radius * 2, state.ball.radius * 2 );

  for ( const brick of state.bricks ) {
    if ( !brick.active ) continue;
    drawSprite( ctx, `block_${ brick.color }`, brick.x, brick.y, brick.width, brick.height );
  }

  const now = performance.now();
  for ( const explosion of state.explosions ) {
    const elapsed = now - explosion.startTime;
    const frameIndex = Math.min( 3, Math.floor( elapsed / ( EXPLOSION_DURATION / 4 ) ) );
    const frame = EXPLOSION_FRAMES[ explosion.color ][ frameIndex ];
    drawFrame( ctx, frame, explosion.x, explosion.y, explosion.width, explosion.height );
  }

  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText( `Nivel: ${ state.level }    Score: ${ state.score }`, 10, 30 );

  renderLives();

  if ( state.gameOver ) {
    renderOverlay( 'Fin del juego' );
  } else if ( state.won ) {
    renderOverlay( '¡Ganaste! Completaste los 5 niveles' );
  } else if ( state.levelCompleteAt ) {
    renderOverlay( `Nivel ${ state.level } completado`, false );
  } else if ( state.paused ) {
    renderOverlay( 'Pausado', false );
  }

  syncLevelSelect();
}

function renderLives() {
  const dotRadius = 8;
  const dotGap = 12;
  const startX = state.width - 20 - dotRadius * 2;
  const y = 16;

  for ( let i = 0; i < state.lives; i++ ) {
    const x = startX - i * ( dotRadius * 2 + dotGap );
    drawSprite( ctx, 'ball', x, y, dotRadius * 2, dotRadius * 2 );
  }
}

const RESTART_BUTTON = { width: 160, height: 44 };

function getRestartButtonRect() {
  return {
    x: state.width / 2 - RESTART_BUTTON.width / 2,
    y: state.height / 2 + 40,
    width: RESTART_BUTTON.width,
    height: RESTART_BUTTON.height
  };
}

function renderOverlay( message, showRestartButton = true ) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect( 0, 0, state.width, state.height );

  ctx.fillStyle = '#fff';
  ctx.font = '40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText( message, state.width / 2, state.height / 2 - 20 );

  if ( showRestartButton ) {
    const btn = getRestartButtonRect();
    ctx.fillStyle = '#2a7';
    ctx.fillRect( btn.x, btn.y, btn.width, btn.height );
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText( 'Reiniciar', state.width / 2, btn.y + btn.height / 2 + 7 );
  }

  ctx.textAlign = 'left';
}

function restartGame() {
  state = createInitialState();
}

function updatePaddle() {
  if ( state.input.mouseMoved ) {
    state.paddle.x = state.input.mouseX - state.paddle.width / 2;
    state.input.mouseMoved = false;
  }
  if ( state.input.keyLeft ) {
    state.paddle.x -= state.paddle.speed;
  }
  if ( state.input.keyRight ) {
    state.paddle.x += state.paddle.speed;
  }

  if ( state.paddle.x < 0 ) {
    state.paddle.x = 0;
  }
  if ( state.paddle.x > state.width - state.paddle.width ) {
    state.paddle.x = state.width - state.paddle.width;
  }

  if ( !state.launched ) {
    state.ball.x = state.paddle.x + state.paddle.width / 2;
    state.ball.y = state.paddle.y - state.ball.radius;
  }
}

function resetBallAndPaddle() {
  state.paddle.x = ( state.width - state.paddle.width ) / 2;
  state.ball.x = state.width / 2;
  state.ball.y = state.height - 60;
  state.ball.vx = 4;
  state.ball.vy = -4;
  state.launched = false;
}

function checkPaddleCollision() {
  const ball = state.ball;
  const paddle = state.paddle;

  if ( ball.vy <= 0 ) return;

  const closestX = Math.max( paddle.x, Math.min( ball.x, paddle.x + paddle.width ) );
  const closestY = Math.max( paddle.y, Math.min( ball.y, paddle.y + paddle.height ) );
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;

  if ( dx * dx + dy * dy > ball.radius * ball.radius ) return;

  ball.y = paddle.y - ball.radius;

  const speed = Math.hypot( ball.vx, ball.vy );
  const hitPos = ( ball.x - ( paddle.x + paddle.width / 2 ) ) / ( paddle.width / 2 );
  ball.vx = hitPos * speed;
  ball.vy = -Math.abs( ball.vy );

  playSound( SOUND_BALL_BOUNCE );
}

function checkBrickCollisions() {
  const ball = state.ball;

  for ( const brick of state.bricks ) {
    if ( !brick.active ) continue;

    const closestX = Math.max( brick.x, Math.min( ball.x, brick.x + brick.width ) );
    const closestY = Math.max( brick.y, Math.min( ball.y, brick.y + brick.height ) );
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;

    if ( dx * dx + dy * dy > ball.radius * ball.radius ) continue;

    brick.active = false;
    state.score += 10;

    state.explosions.push( {
      x: brick.x,
      y: brick.y,
      width: brick.width,
      height: brick.height,
      color: brick.color,
      startTime: performance.now()
    } );

    playSound( SOUND_BRICK_BREAK );

    const overlapX = ball.radius - Math.abs( dx );
    const overlapY = ball.radius - Math.abs( dy );
    if ( overlapX < overlapY ) {
      ball.vx = -ball.vx;
    } else {
      ball.vy = -ball.vy;
    }

    break;
  }
}

function updateBall() {
  state.ball.x += state.ball.vx;
  state.ball.y += state.ball.vy;

  checkPaddleCollision();
  checkBrickCollisions();

  if ( state.ball.x - state.ball.radius < 0 ) {
    state.ball.x = state.ball.radius;
    state.ball.vx = -state.ball.vx;
    playSound( SOUND_BALL_BOUNCE );
  }
  if ( state.ball.x + state.ball.radius > state.width ) {
    state.ball.x = state.width - state.ball.radius;
    state.ball.vx = -state.ball.vx;
    playSound( SOUND_BALL_BOUNCE );
  }
  if ( state.ball.y - state.ball.radius < 0 ) {
    state.ball.y = state.ball.radius;
    state.ball.vy = -state.ball.vy;
    playSound( SOUND_BALL_BOUNCE );
  }

  if ( state.ball.y - state.ball.radius > state.height ) {
    state.lives -= 1;
    if ( state.lives <= 0 ) {
      state.lives = 0;
      state.gameOver = true;
    } else {
      resetBallAndPaddle();
    }
  }
}

function checkWinCondition() {
  const activeCount = state.bricks.filter( ( brick ) => brick.active ).length;
  if ( activeCount !== 0 ) return;

  if ( state.level < LEVELS.length ) {
    if ( state.levelCompleteAt === null ) {
      state.levelCompleteAt = performance.now();
    }
  } else {
    state.won = true;
  }
}

function updateExplosions() {
  const now = performance.now();
  state.explosions = state.explosions.filter( ( explosion ) => now - explosion.startTime < EXPLOSION_DURATION );
}

function descendBricksIfNeeded() {
  if ( state.level !== LEVELS.length || state.lastDescendAt === null ) return;
  if ( performance.now() - state.lastDescendAt < BRICK_DESCEND_INTERVAL_MS ) return;

  const step = BRICK_HEIGHT + BRICK_GAP;
  for ( const brick of state.bricks ) {
    if ( !brick.active ) continue;

    brick.y += step;
    if ( brick.y + brick.height >= state.paddle.y ) {
      state.gameOver = true;
    }
  }

  state.lastDescendAt = performance.now();
}

function update() {
  updatePaddle();
  if ( state.launched ) {
    updateBall();
  }
  checkWinCondition();
  updateExplosions();
  descendBricksIfNeeded();
}

function gameLoop() {
  if ( state.levelCompleteAt !== null && performance.now() - state.levelCompleteAt >= LEVEL_TRANSITION_MS ) {
    startLevel( state.level + 1 );
  }

  if ( !state.gameOver && !state.won && !state.paused && !state.levelCompleteAt ) {
    update();
  }
  render();
  requestAnimationFrame( gameLoop );
}

function handleCanvasClick( e ) {
  if ( state.paused ) {
    state.paused = false;
    return;
  }

  if ( !state.gameOver && !state.won ) {
    if ( !state.launched ) {
      state.launched = true;
    }
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  const btn = getRestartButtonRect();

  if ( clickX >= btn.x && clickX <= btn.x + btn.width && clickY >= btn.y && clickY <= btn.y + btn.height ) {
    restartGame();
  }
}

function setupInput() {
  canvas.addEventListener( 'mousemove', ( e ) => {
    const rect = canvas.getBoundingClientRect();
    state.input.mouseX = e.clientX - rect.left;
    state.input.mouseMoved = true;
  } );

  canvas.addEventListener( 'click', handleCanvasClick );

  levelSelect.addEventListener( 'change', () => {
    if ( levelSelect.value === '' || !state.paused ) return;

    startLevel( Number( levelSelect.value ) );
    state.paused = false;
    levelSelect.value = '';
  } );

  window.addEventListener( 'keydown', ( e ) => {
    if ( e.key === 'p' || e.key === 'P' ) {
      if ( !state.gameOver && !state.won ) {
        state.paused = !state.paused;
      }
      return;
    }

    if ( ( e.key === ' ' || e.key === 'Enter' ) && state.paused ) {
      e.preventDefault();
      state.paused = false;
      return;
    }

    if ( e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft' ) state.input.keyLeft = true;
    if ( e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight' ) state.input.keyRight = true;

    if ( ( e.key === ' ' || e.key === 'Enter' ) && !state.launched && !state.gameOver && !state.won ) {
      e.preventDefault();
      state.launched = true;
    }
  } );

  window.addEventListener( 'keyup', ( e ) => {
    if ( e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft' ) state.input.keyLeft = false;
    if ( e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight' ) state.input.keyRight = false;
  } );
}

setupInput();
loadSpritesheet( gameLoop );
