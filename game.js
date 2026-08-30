// Arkanoid MVP — single-file game (spec 01-mvp-arkanoid)

const CANVAS_W = 800;
const CANVAS_H = 600;
const BG_COLOR = "#0a0a12";

const PADDLE = { w: 96, h: 16, y: 560, speed: 480 }; // speed en px/s (solo teclado)
const BALL = { size: 14, speed: 360 }; // speed en px/s, valor base
const STAGE_SPEED_STEP = 0.08; // +8% de rapidez de bola por stage
const STAGE_SPEED_CAP = 1.6; // multiplicador maximo sobre BALL.speed
const MAX_LAUNCH_ANGLE = 50 * Math.PI / 180; // desde la vertical
const MAX_BOUNCE_ANGLE = 60 * Math.PI / 180; // rebote en el paddle, desde la vertical

const START_ROWS = 5; // filas en el stage 1 (igual que SPEC 01)
const MAX_ROWS = 9; // tope de filas; por encima solo escala el blindaje

const GRID = {
  cols: 10,
  rows: 5,
  marginX: 40, // margen lateral dentro del canvas
  top: 60, // offset superior
  gapX: 8,
  gapY: 4,
  rowColors: [ "red", "hotpink", "magenta", "cyan", "yellow" ], // color por fila (indice 0 = fila superior)
};
const BRICK_H = 24; // alto de bloque (el spec no lo fija; el sprite es 32x16)
const START_LIVES = 3;

const BREAK_SFX_SRC = "assets/sounds/break-sound.mp3";
const BREAK_SFX_POOL_SIZE = 8;

const BOUNCE_SFX_SRC = "assets/sounds/ball-bounce.mp3";
const BOUNCE_SFX_POOL_SIZE = 4;

const PARTICLES_PER_BRICK = 10; // fragmentos por bloque roto
const PARTICLE_MAX = 200; // tope global de particulas vivas
const PARTICLE_LIFE = 500; // ms de vida
const PARTICLE_GRAVITY = 900; // px/s^2 hacia abajo
const PARTICLE_SIZE_MIN = 3; // px
const PARTICLE_SIZE_MAX = 5; // px
const PARTICLE_VX_MAX = 180; // px/s, rango [-max, +max]
const PARTICLE_VY_MIN = -260; // px/s (hacia arriba)
const PARTICLE_VY_MAX = -40; // px/s

const FLASH_DURATION = 100; // ms
const POPUP_LIFE = 600; // ms
const POPUP_RISE = 28; // px que sube en toda su vida

const canvas = document.getElementById( "game" );
const ctx = canvas.getContext( "2d" );

function buildBricks( stage ) {
  const bw = ( CANVAS_W - 2 * GRID.marginX - ( GRID.cols - 1 ) * GRID.gapX ) / GRID.cols;
  const rows = Math.min( START_ROWS + ( stage - 1 ), MAX_ROWS );
  const bricks = [];
  for ( let row = 0; row < rows; row++ ) {
    const color = GRID.rowColors[ row % GRID.rowColors.length ];
    const y = GRID.top + row * ( BRICK_H + GRID.gapY );
    for ( let col = 0; col < GRID.cols; col++ ) {
      const x = GRID.marginX + col * ( bw + GRID.gapX );
      bricks.push( { x, y, w: bw, h: BRICK_H, color, alive: true, breaking: false, breakStart: 0 } );
    }
  }
  return bricks;
}

const state = {
  phase: "playing", // 'playing' | 'gameover' | 'stageclear'
  stage: 1,
  ballSpeed: BALL.speed, // rapidez efectiva actual de la bola
  lives: START_LIVES,
  score: 0,
  ballStuck: true,
  paddle: { x: ( CANVAS_W - PADDLE.w ) / 2, y: PADDLE.y, w: PADDLE.w, h: PADDLE.h },
  ball: { x: 0, y: 0, vx: 0, vy: 0, r: BALL.size / 2 },
  bricks: buildBricks( 1 ),
  input: { left: false, right: false, mouseX: null },
  particles: [], // { x, y, vx, vy, size, color, born }
  flashes: [], // { x, y, w, h, born }
  popups: [], // { x, y, text, born }
};

// Pool de audio de rotura (fuera de state, no se resetea)
const breakSfxPool = [];
let breakSfxIndex = 0;
for ( let i = 0; i < BREAK_SFX_POOL_SIZE; i++ ) {
  breakSfxPool.push( new Audio( BREAK_SFX_SRC ) );
}

function playBreakSfx() {
  const sfx = breakSfxPool[ breakSfxIndex ];
  sfx.currentTime = 0;
  sfx.play().catch( () => {} );
  breakSfxIndex = ( breakSfxIndex + 1 ) % BREAK_SFX_POOL_SIZE;
}

// Pool de audio de rebote (fuera de state, no se resetea)
const bounceSfxPool = [];
let bounceSfxIndex = 0;
for ( let i = 0; i < BOUNCE_SFX_POOL_SIZE; i++ ) {
  bounceSfxPool.push( new Audio( BOUNCE_SFX_SRC ) );
}

function playBounceSfx() {
  const sfx = bounceSfxPool[ bounceSfxIndex ];
  sfx.currentTime = 0;
  sfx.play().catch( () => {} );
  bounceSfxIndex = ( bounceSfxIndex + 1 ) % BOUNCE_SFX_POOL_SIZE;
}

function clamp( v, min, max ) {
  return v < min ? min : ( v > max ? max : v );
}

function updatePaddle( dt ) {
  const p = state.paddle;
  const maxX = CANVAS_W - p.w;

  if ( state.input.mouseX !== null ) {
    p.x = state.input.mouseX - p.w / 2;
  }

  let dir = 0;
  if ( state.input.left ) dir -= 1;
  if ( state.input.right ) dir += 1;
  if ( dir !== 0 ) {
    p.x += dir * PADDLE.speed * dt;
    state.input.mouseX = null; // keyboard takes over until the mouse moves again
  }

  p.x = clamp( p.x, 0, maxX );
}

function stickBallToPaddle() {
  const p = state.paddle;
  state.ball.x = p.x + p.w / 2;
  state.ball.y = p.y - state.ball.r;
  state.ball.vx = 0;
  state.ball.vy = 0;
}

function stageBallSpeed() {
  return BALL.speed * Math.min( 1 + STAGE_SPEED_STEP * ( state.stage - 1 ), STAGE_SPEED_CAP );
}

function launchBall() {
  if ( !state.ballStuck ) return;
  state.ballStuck = false;
  const angle = ( Math.random() * 2 - 1 ) * MAX_LAUNCH_ANGLE;
  state.ball.vx = state.ballSpeed * Math.sin( angle );
  state.ball.vy = -state.ballSpeed * Math.cos( angle );
}

function updateBall( dt ) {
  const b = state.ball;

  if ( state.ballStuck ) {
    stickBallToPaddle();
    return;
  }

  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if ( b.x - b.r < 0 ) {
    b.x = b.r;
    b.vx = -b.vx;
    playBounceSfx();
  } else if ( b.x + b.r > CANVAS_W ) {
    b.x = CANVAS_W - b.r;
    b.vx = -b.vx;
    playBounceSfx();
  }

  if ( b.y - b.r < 0 ) {
    b.y = b.r;
    b.vy = -b.vy;
    playBounceSfx();
  }

  if ( b.y - b.r > CANVAS_H ) {
    state.lives--;
    state.ballStuck = true;
    stickBallToPaddle();
  }
}

function collideBallPaddle() {
  const b = state.ball;
  const p = state.paddle;
  if ( b.vy <= 0 ) return;
  if ( b.x + b.r <= p.x || b.x - b.r >= p.x + p.w ) return;
  if ( b.y + b.r < p.y || b.y - b.r > p.y + p.h ) return;

  const offset = clamp( ( b.x - ( p.x + p.w / 2 ) ) / ( p.w / 2 ), -1, 1 );
  const angle = offset * MAX_BOUNCE_ANGLE;
  b.vx = state.ballSpeed * Math.sin( angle );
  b.vy = -state.ballSpeed * Math.cos( angle );
  b.y = p.y - b.r;
  playBounceSfx();
}

function collideBallBricks() {
  const b = state.ball;
  const left = b.x - b.r;
  const right = b.x + b.r;
  const top = b.y - b.r;
  const bottom = b.y + b.r;

  for ( let i = 0; i < state.bricks.length; i++ ) {
    const br = state.bricks[ i ];
    if ( !br.alive ) continue;
    if ( right <= br.x || left >= br.x + br.w || bottom <= br.y || top >= br.y + br.h ) continue;

    const overlapX = Math.min( right - br.x, br.x + br.w - left );
    const overlapY = Math.min( bottom - br.y, br.y + br.h - top );

    if ( overlapX < overlapY ) {
      b.x += ( b.x < br.x + br.w / 2 ) ? -overlapX : overlapX;
      b.vx = -b.vx;
    } else {
      b.y += ( b.y < br.y + br.h / 2 ) ? -overlapY : overlapY;
      b.vy = -b.vy;
    }

    br.alive = false;
    br.breaking = true;
    br.breakStart = now;
    playBreakSfx();
    spawnParticles( br );
    spawnFlash( br );
    spawnPopup( br );
    state.score += 10;
    return; // resolver como maximo un bloque por frame
  }
}

function spawnParticles( br ) {
  if ( state.particles.length >= PARTICLE_MAX ) return;
  const cx = br.x + br.w / 2;
  const cy = br.y + br.h / 2;
  for ( let i = 0; i < PARTICLES_PER_BRICK; i++ ) {
    state.particles.push( {
      x: cx,
      y: cy,
      vx: ( Math.random() * 2 - 1 ) * PARTICLE_VX_MAX,
      vy: PARTICLE_VY_MIN + Math.random() * ( PARTICLE_VY_MAX - PARTICLE_VY_MIN ),
      size: PARTICLE_SIZE_MIN + Math.random() * ( PARTICLE_SIZE_MAX - PARTICLE_SIZE_MIN ),
      color: br.color,
      born: now,
    } );
  }
}

function updateParticles( dt ) {
  for ( let i = state.particles.length - 1; i >= 0; i-- ) {
    const p = state.particles[ i ];
    if ( now - p.born >= PARTICLE_LIFE ) {
      state.particles.splice( i, 1 );
      continue;
    }
    p.vy += PARTICLE_GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function spawnFlash( br ) {
  state.flashes.push( { x: br.x, y: br.y, w: br.w, h: br.h, born: now } );
}

function spawnPopup( br ) {
  state.popups.push( { x: br.x + br.w / 2, y: br.y + br.h / 2, text: "+10", born: now } );
}

function updatePopups( dt ) {
  for ( let i = state.popups.length - 1; i >= 0; i-- ) {
    if ( now - state.popups[ i ].born >= POPUP_LIFE ) state.popups.splice( i, 1 );
  }
}

function advanceStage() {
  state.stage++;
  state.bricks = buildBricks( state.stage );
  state.ballSpeed = stageBallSpeed();
  state.ballStuck = true;
  state.phase = "playing";
  stickBallToPaddle();
}

function resetGame() {
  state.phase = "playing";
  state.stage = 1;
  state.ballSpeed = BALL.speed;
  state.lives = START_LIVES;
  state.score = 0;
  state.ballStuck = true;
  state.bricks = buildBricks( state.stage );
  state.particles.length = 0;
  state.popups.length = 0;
  state.flashes.length = 0;
  state.paddle.x = ( CANVAS_W - PADDLE.w ) / 2;
  stickBallToPaddle();
}

function update( dt ) {
  if ( state.phase !== "playing" ) return;

  updatePaddle( dt );
  updateBall( dt );
  if ( !state.ballStuck ) {
    collideBallPaddle();
    collideBallBricks();
  }
  updateParticles( dt );
  updatePopups( dt );

  if ( state.lives <= 0 ) {
    state.phase = "gameover";
  } else if ( !state.bricks.some( br => br.alive ) ) {
    state.phase = "stageclear";
  }
}

function render() {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect( 0, 0, CANVAS_W, CANVAS_H );

  for ( let i = 0; i < state.bricks.length; i++ ) {
    const br = state.bricks[ i ];
    if ( br.alive ) {
      drawSprite( ctx, "block_" + br.color, br.x, br.y, br.w, br.h );
    } else if ( br.breaking ) {
      const elapsed = now - br.breakStart;
      if ( elapsed >= EXPLOSION_DURATION ) {
        br.breaking = false;
      } else {
        const frames = EXPLOSION_FRAMES[ br.color ];
        const idx = clamp( Math.floor( elapsed / EXPLOSION_DURATION * frames.length ), 0, frames.length - 1 );
        drawFrame( ctx, frames[ idx ], br.x, br.y, br.w, br.h );
      }
    }
  }

  for ( let i = 0; i < state.particles.length; i++ ) {
    const pt = state.particles[ i ];
    ctx.globalAlpha = clamp( 1 - ( now - pt.born ) / PARTICLE_LIFE, 0, 1 );
    ctx.fillStyle = pt.color;
    ctx.fillRect( pt.x, pt.y, pt.size, pt.size );
  }
  ctx.globalAlpha = 1;

  for ( let i = state.flashes.length - 1; i >= 0; i-- ) {
    const fl = state.flashes[ i ];
    const age = now - fl.born;
    if ( age >= FLASH_DURATION ) {
      state.flashes.splice( i, 1 );
      continue;
    }
    ctx.globalAlpha = 1 - age / FLASH_DURATION;
    ctx.fillStyle = "#fff";
    ctx.fillRect( fl.x, fl.y, fl.w, fl.h );
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#fff";
  ctx.font = "18px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for ( let i = 0; i < state.popups.length; i++ ) {
    const pop = state.popups[ i ];
    const age = now - pop.born;
    ctx.globalAlpha = 1 - age / POPUP_LIFE;
    ctx.fillText( pop.text, pop.x, pop.y - POPUP_RISE * ( age / POPUP_LIFE ) );
  }
  ctx.globalAlpha = 1;

  const p = state.paddle;
  drawSprite( ctx, "paddle", p.x, p.y, p.w, p.h );

  const b = state.ball;
  drawSprite( ctx, "ball", b.x - b.r, b.y - b.r, BALL.size, BALL.size );

  ctx.fillStyle = "#fff";
  ctx.font = "20px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const livesLabel = "Vidas: ";
  ctx.fillText( livesLabel, 12, 12 );

  const lifeIcon = 16;
  const lifeGap = 6;
  const lifeIconX = 12 + ctx.measureText( livesLabel ).width;
  for ( let i = 0; i < state.lives; i++ ) {
    drawSprite( ctx, "ball", lifeIconX + i * ( lifeIcon + lifeGap ), 12, lifeIcon, lifeIcon );
  }

  ctx.textAlign = "center";
  ctx.fillText( "Nivel: " + state.stage, CANVAS_W / 2, 12 );

  ctx.textAlign = "right";
  ctx.fillText( "Score: " + state.score, CANVAS_W - 12, 12 );

  if ( state.phase !== "playing" ) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect( 0, 0, CANVAS_W, CANVAS_H );

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "48px monospace";
    if ( state.phase === "stageclear" ) {
      ctx.fillText( "Nivel " + ( state.stage + 1 ), CANVAS_W / 2, CANVAS_H / 2 - 20 );
      ctx.font = "20px monospace";
      ctx.fillText( "Pulsa una tecla o haz click para continuar", CANVAS_W / 2, CANVAS_H / 2 + 30 );
    } else {
      ctx.fillText( "Game Over", CANVAS_W / 2, CANVAS_H / 2 - 20 );
      ctx.font = "20px monospace";
      ctx.fillText( "Pulsa una tecla o haz click para reiniciar", CANVAS_W / 2, CANVAS_H / 2 + 30 );
    }
  }
}

let lastTime = 0;
let now = 0;

function frame( ts ) {
  now = ts;
  const dt = Math.min( ( ts - lastTime ) / 1000, 0.05 );
  lastTime = ts;
  update( dt );
  render();
  requestAnimationFrame( frame );
}

canvas.addEventListener( "mousemove", ( e ) => {
  const rect = canvas.getBoundingClientRect();
  state.input.mouseX = ( e.clientX - rect.left ) * ( CANVAS_W / rect.width );
} );

canvas.addEventListener( "click", () => {
  if ( state.phase === "stageclear" ) {
    advanceStage();
    return;
  }
  if ( state.phase !== "playing" ) {
    resetGame();
    return;
  }
  launchBall();
} );

window.addEventListener( "keydown", ( e ) => {
  if ( state.phase === "stageclear" ) {
    e.preventDefault();
    advanceStage();
    return;
  }
  if ( state.phase !== "playing" ) {
    e.preventDefault();
    resetGame();
    return;
  }
  if ( e.code === "ArrowLeft" ) state.input.left = true;
  if ( e.code === "ArrowRight" ) state.input.right = true;
  if ( e.code === "Space" ) {
    e.preventDefault();
    launchBall();
  }
} );

window.addEventListener( "keyup", ( e ) => {
  if ( e.code === "ArrowLeft" ) state.input.left = false;
  if ( e.code === "ArrowRight" ) state.input.right = false;
} );

loadSpritesheet( () => {
  lastTime = performance.now();
  requestAnimationFrame( frame );
} );
