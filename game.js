// Arkanoid MVP — single-file game (spec 01-mvp-arkanoid)

const CANVAS_W = 800;
const CANVAS_H = 600;
const BG_COLOR = "#0a0a12";

const PADDLE = { w: 96, h: 16, y: 560, speed: 480 }; // speed en px/s (solo teclado)
const BALL = { size: 14, speed: 360 }; // speed en px/s, constante
const MAX_LAUNCH_ANGLE = 50 * Math.PI / 180; // desde la vertical

const canvas = document.getElementById( "game" );
const ctx = canvas.getContext( "2d" );

const state = {
  ballStuck: true,
  paddle: { x: ( CANVAS_W - PADDLE.w ) / 2, y: PADDLE.y, w: PADDLE.w, h: PADDLE.h },
  ball: { x: 0, y: 0, vx: 0, vy: 0, r: BALL.size / 2 },
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

function update( dt ) {
  updatePaddle( dt );
  updateBall( dt );
}

function render() {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect( 0, 0, CANVAS_W, CANVAS_H );

  const p = state.paddle;
  drawSprite( ctx, "paddle", p.x, p.y, p.w, p.h );

  const b = state.ball;
  drawSprite( ctx, "ball", b.x - b.r, b.y - b.r, BALL.size, BALL.size );
}

let lastTime = 0;

function frame( now ) {
  const dt = Math.min( ( now - lastTime ) / 1000, 0.05 );
  lastTime = now;
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
