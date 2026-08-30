// Arkanoid MVP — single-file game (spec 01-mvp-arkanoid)

const CANVAS_W = 800;
const CANVAS_H = 600;
const BG_COLOR = "#0a0a12";

const canvas = document.getElementById( "game" );
const ctx = canvas.getContext( "2d" );

let lastTime = 0;

function update( dt ) {
  // gameplay comes in later steps
}

function render() {
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect( 0, 0, CANVAS_W, CANVAS_H );
}

function frame( now ) {
  const dt = Math.min( ( now - lastTime ) / 1000, 0.05 );
  lastTime = now;
  update( dt );
  render();
  requestAnimationFrame( frame );
}

loadSpritesheet( () => {
  lastTime = performance.now();
  requestAnimationFrame( frame );
} );
