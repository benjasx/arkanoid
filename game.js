// Arkanoid MVP — single-file game (spec 01-mvp-arkanoid)

const CANVAS_W = 800;
const CANVAS_H = 600;
const BG_COLOR = "#0a0a12";

const PADDLE = { w: 96, h: 16, y: 560, speed: 480 }; // speed en px/s (solo teclado)

const canvas = document.getElementById( "game" );
const ctx = canvas.getContext( "2d" );

const state = {
  paddle: { x: ( CANVAS_W - PADDLE.w ) / 2, y: PADDLE.y, w: PADDLE.w, h: PADDLE.h },
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

function update( dt ) {
  updatePaddle( dt );
}

function render() {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect( 0, 0, CANVAS_W, CANVAS_H );

  const p = state.paddle;
  drawSprite( ctx, "paddle", p.x, p.y, p.w, p.h );
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

window.addEventListener( "keydown", ( e ) => {
  if ( e.code === "ArrowLeft" ) state.input.left = true;
  if ( e.code === "ArrowRight" ) state.input.right = true;
} );

window.addEventListener( "keyup", ( e ) => {
  if ( e.code === "ArrowLeft" ) state.input.left = false;
  if ( e.code === "ArrowRight" ) state.input.right = false;
} );

loadSpritesheet( () => {
  lastTime = performance.now();
  requestAnimationFrame( frame );
} );
