// Arkanoid MVP — single-file game (spec 01-mvp-arkanoid)

const CANVAS_W = 800;
const CANVAS_H = 600;
const BG_COLOR = "#0a0a12";

const PADDLE = { w: 96, h: 16, y: 560, speed: 480 }; // speed en px/s (solo teclado)
const BALL = { size: 14, speed: 360 }; // speed en px/s, constante
const MAX_LAUNCH_ANGLE = 50 * Math.PI / 180; // desde la vertical

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

const canvas = document.getElementById( "game" );
const ctx = canvas.getContext( "2d" );

function buildBricks() {
  const bw = ( CANVAS_W - 2 * GRID.marginX - ( GRID.cols - 1 ) * GRID.gapX ) / GRID.cols;
  const bricks = [];
  for ( let row = 0; row < GRID.rows; row++ ) {
    const color = GRID.rowColors[ row ];
    const y = GRID.top + row * ( BRICK_H + GRID.gapY );
    for ( let col = 0; col < GRID.cols; col++ ) {
      const x = GRID.marginX + col * ( bw + GRID.gapX );
      bricks.push( { x, y, w: bw, h: BRICK_H, color, alive: true, breaking: false, breakStart: 0 } );
    }
  }
  return bricks;
}

const state = {
  ballStuck: true,
  paddle: { x: ( CANVAS_W - PADDLE.w ) / 2, y: PADDLE.y, w: PADDLE.w, h: PADDLE.h },
  ball: { x: 0, y: 0, vx: 0, vy: 0, r: BALL.size / 2 },
  bricks: buildBricks(),
  input: { left: false, right: false, mouseX: null },
};

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

function launchBall() {
  if ( !state.ballStuck ) return;
  state.ballStuck = false;
  const angle = ( Math.random() * 2 - 1 ) * MAX_LAUNCH_ANGLE;
  state.ball.vx = BALL.speed * Math.sin( angle );
  state.ball.vy = -BALL.speed * Math.cos( angle );
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
  } else if ( b.x + b.r > CANVAS_W ) {
    b.x = CANVAS_W - b.r;
    b.vx = -b.vx;
  }

  if ( b.y - b.r < 0 ) {
    b.y = b.r;
    b.vy = -b.vy;
  }
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
    return; // resolver como maximo un bloque por frame
  }
}

function update( dt ) {
  updatePaddle( dt );
  updateBall( dt );
  if ( !state.ballStuck ) collideBallBricks();
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

  const p = state.paddle;
  drawSprite( ctx, "paddle", p.x, p.y, p.w, p.h );

  const b = state.ball;
  drawSprite( ctx, "ball", b.x - b.r, b.y - b.r, BALL.size, BALL.size );
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
  launchBall();
} );

window.addEventListener( "keydown", ( e ) => {
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
