# SPEC 04 — Niveles infinitos con dificultad progresiva

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-08-30
> **Objetivo:** Sustituir la pantalla de Victoria de SPEC 01 por una progresión infinita de stages en la que, al limpiar cada rejilla, la siguiente tiene más filas de bloques, más bloques que aguantan varios golpes y la bola algo más rápida.

---

## Por qué este spec

SPEC 01 termina la partida con una pantalla de "Victoria" al limpiar los 50 bloques y dejó
"múltiples niveles o generación procedural" como spec futuro. Este spec cambia esa condición
de fin: limpiar la rejilla ya no gana la partida, sino que avanza al siguiente stage con una
rejilla más difícil generada por fórmula. La única forma de terminar sigue siendo quedarse sin
vidas (Game Over). Reutiliza las capas de rotura de SPEC 02 tal cual y solo distingue el golpe
no letal a un bloque blindado del golpe que lo rompe.

---

## Alcance

**Dentro:**

- `state.stage` (empieza en 1) y HUD `Nivel: N` junto al de vidas y score.
- `buildBricks( stage )`: el número de filas crece con el stage hasta `MAX_ROWS`; los colores de
  fila se reciclan con módulo sobre `GRID.rowColors` cuando hay más de 5 filas.
- Bloques de varios golpes: desde `ARMOR_START_STAGE`, cada bloque recibe con probabilidad
  creciente un `maxHp` aleatorio entre 2 y `ARMOR_MAX_HP`; el resto tiene `maxHp = 1`.
- Feedback visual de daño: un bloque vivo con `hp < maxHp` se dibuja con su sprite base y encima
  un frame de `EXPLOSION_FRAMES[ color ]` (índice según daño acumulado) a modo de grieta.
- `state.ballSpeed`: la rapidez de la bola pasa a ser `BALL.speed` multiplicado por un factor que
  sube `STAGE_SPEED_STEP` por stage hasta `STAGE_SPEED_CAP`. Se usa en `launchBall()` y
  `collideBallPaddle()` en vez de la constante `BALL.speed`.
- Golpe a bloque blindado en `collideBallBricks()`: la bola siempre rebota; si tras `hp--` queda
  `hp > 0` el bloque sigue vivo con solo sonido de rotura y destello (sin partículas, sin popup,
  sin sumar score); si `hp === 0` se ejecuta el tratamiento completo de rotura de SPEC 02.
- Nueva fase `"stageclear"` que sustituye a `"win"`: al no quedar bloques vivos se congela la
  simulación y se dibuja un overlay breve "Nivel N — pulsa una tecla o haz click para
  continuar", reutilizando el patrón de overlay de Game Over. Al pulsar, `stage++`, se
  reconstruye la rejilla, se recalcula `ballSpeed`, la bola vuelve pegada al paddle y la fase
  vuelve a `"playing"`. Las vidas y el score se conservan.
- `resetGame()` vuelve a `stage = 1` y `ballSpeed` base.
- Referencia cruzada en `specs/01-mvp-arkanoid.md` (la Victoria queda sustituida por el avance de
  stage) y en `specs/02-efectos-rotura-bloques.md` (`collideBallBricks()` ahora distingue golpe
  no letal de rotura final).

**Fuera (para specs futuros):**

- Layouts de nivel hechos a mano o con formas concretas: aquí todo sale de `buildBricks( stage )`
  por fórmula (rejilla rectangular, como SPEC 01).
- Pantalla de selección de dificultad o modos Fácil/Normal/Difícil elegibles.
- Bloques indestructibles, móviles o que se regeneran.
- Bonus de score por limpiar un stage, por rapidez o por combo.
- Vidas extra al avanzar de stage.
- Persistencia del stage máximo alcanzado en localStorage.
- Aumentar el número de columnas o el tamaño del canvas.
- Sonido propio del cambio de stage (el sonido de rebote va en SPEC 03).

---

## Modelo de datos

Reutiliza `state`, `GRID`, `BALL` y el bucle de SPEC 01; el brick gana `hp` y `maxHp`.

```js
// Constantes nuevas
const START_ROWS = 5; // filas en el stage 1 (igual que SPEC 01)
const MAX_ROWS = 9; // tope de filas; por encima solo escala el blindaje
const STAGE_SPEED_STEP = 0.08; // +8% de rapidez de bola por stage
const STAGE_SPEED_CAP = 1.6; // multiplicador máximo sobre BALL.speed

const ARMOR_START_STAGE = 2; // primer stage con bloques de varios golpes
const ARMOR_MAX_HP = 3; // golpes máximos de un bloque blindado
// Probabilidad de que un bloque sea blindado en un stage dado:
//   armorChance( stage ) = Math.min( 0.15 * ( stage - 1 ), 0.6 )

// Estado nuevo / cambiado en state
state.stage = 1;
state.ballSpeed = BALL.speed; // rapidez efectiva actual de la bola
state.phase = "playing"; // 'playing' | 'stageclear' | 'gameover'   (ya no existe 'win')

// brick (buildBricks): se añaden hp y maxHp
// { x, y, w, h, color, hp, maxHp, alive: true, breaking: false, breakStart: 0 }
```

Reglas de `buildBricks( stage )`:

- `rows = Math.min( START_ROWS + ( stage - 1 ), MAX_ROWS )`, `cols` sigue siendo `GRID.cols`.
- Color de fila: `GRID.rowColors[ row % GRID.rowColors.length ]`.
- Para cada bloque: si `stage >= ARMOR_START_STAGE` y `Math.random() < armorChance( stage )`,
  `maxHp = 2 + Math.floor( Math.random() * ( ARMOR_MAX_HP - 1 ) )` (entero en `[ 2, ARMOR_MAX_HP ]`);
  en otro caso `maxHp = 1`. `hp = maxHp`.

Regla de `ballSpeed`:

- `state.ballSpeed = BALL.speed * Math.min( 1 + STAGE_SPEED_STEP * ( stage - 1 ), STAGE_SPEED_CAP )`.

Convenciones: mismo estilo que `assets/spritesheet.js` (2 espacios, espacios dentro de `( )` y
`[ ]`, `const`/`let`).

---

## Plan de implementación

1. **Stage y fase.** Añadir `state.stage = 1`. Sustituir la fase `"win"` por `"stageclear"` en
   todo `game.js` (comprobación de fin de rejilla en `update()` y overlay en `render()`).
   Cambiar `buildBricks()` a `buildBricks( stage )` con `rows` escalado y capado a `MAX_ROWS` y
   colores de fila por módulo. Dibujar `Nivel: N` en el HUD (misma tipografía que `Vidas:` /
   `Score:`). En `update()`, cuando no quedan bloques vivos y la fase es `"playing"`, pasar a
   `"stageclear"`. En el overlay de `render()` para `"stageclear"`, mostrar
   `"Nivel " + ( state.stage + 1 )` y "pulsa una tecla o haz click para continuar". En los
   handlers de `keydown` y `click`, si la fase es `"stageclear"`: `state.stage++`,
   `state.bricks = buildBricks( state.stage )`, recalcular `state.ballSpeed`,
   `state.ballStuck = true`, `stickBallToPaddle()`, fase `"playing"`; las vidas y el score no se
   tocan. Verificar: al limpiar el nivel 1 aparece el overlay de "Nivel 2" en vez de "Victoria";
   al continuar se carga una rejilla con una fila más y se conservan vidas y score; con 0 vidas
   sigue apareciendo Game Over.

2. **Rapidez de bola progresiva.** Añadir `state.ballSpeed` y sus constantes
   (`STAGE_SPEED_STEP`, `STAGE_SPEED_CAP`). Inicializarlo a `BALL.speed`. Reemplazar los usos de
   `BALL.speed` como magnitud en `launchBall()` y `collideBallPaddle()` por `state.ballSpeed`.
   Recalcular `state.ballSpeed` con la fórmula al avanzar de stage (paso 1) y en `resetGame()`.
   Verificar: cada stage la bola sale y rebota perceptiblemente más rápida; a partir del stage
   que alcanza `STAGE_SPEED_CAP` la rapidez deja de subir.

3. **Bloques de varios golpes.** En `buildBricks( stage )` asignar `hp` / `maxHp` según
   `armorChance( stage )` y `ARMOR_MAX_HP`. En `collideBallBricks()`, tras calcular el rebote de
   la bola (que se aplica siempre), hacer `br.hp--`. Si `br.hp > 0`: el bloque sigue `alive`,
   llamar solo a `playBreakSfx()` y `spawnFlash( br )`, marcar `br.breaking = false` y **no**
   crear partículas ni popup ni sumar `state.score`; `return`. Si `br.hp === 0`: ejecutar el
   camino de rotura actual de SPEC 02 (`alive = false`, `breaking = true`, `breakStart = now`,
   `playBreakSfx()`, `spawnParticles`, `spawnFlash`, `spawnPopup`, `state.score += 10`);
   `return`. Verificar: desde el stage 2 hay bloques que requieren 2 o 3 impactos; los golpes
   intermedios hacen rebotar la bola y suenan/destellan sin sumar puntos; el golpe final rompe
   el bloque con el efecto completo de SPEC 02.

4. **Feedback visual de daño.** En `render()`, para cada brick con `br.alive` y `br.hp < br.maxHp`:
   dibujar primero `drawSprite( ctx, "block_" + br.color, ... )` y encima
   `drawFrame( ctx, EXPLOSION_FRAMES[ br.color ][ idx ], br.x, br.y, br.w, br.h )` con
   `idx = clamp( br.maxHp - br.hp - 1, 0, EXPLOSION_FRAMES[ br.color ].length - 1 )`. Los bloques
   con `hp === maxHp` se dibujan como hasta ahora. Verificar: un bloque golpeado pero no roto se
   ve agrietado y la grieta avanza con cada golpe hasta que el último lo rompe.

5. **Reset.** En `resetGame()`: `state.stage = 1`, `state.ballSpeed = BALL.speed`,
   `state.bricks = buildBricks( 1 )`, y mantener la limpieza de `particles` / `popups` /
   `flashes` de SPEC 02. Verificar: tras Game Over, reiniciar empieza en "Nivel 1" con 5 filas,
   rapidez base y sin bloques blindados.

6. **Actualizar SPEC 01 y SPEC 02.** En `specs/01-mvp-arkanoid.md`, anotar junto al bullet de la
   pantalla de Victoria y al paso 8 del plan que la condición de "win" queda sustituida por el
   avance de stage de SPEC 04. En `specs/02-efectos-rotura-bloques.md`, anotar junto al disparo
   de las cuatro capas en `collideBallBricks()` que SPEC 04 añade el caso de golpe no letal
   (solo sonido + destello, sin partículas/popup/score). Verificar: ningún spec describe dos
   comportamientos contradictorios sin enlazarlos.

---

## Criterios de aceptación

- [ ] Al limpiar todos los bloques de un stage aparece un overlay "Nivel N — pulsa una tecla o haz click para continuar" y no la pantalla de "Victoria".
- [ ] Pulsar una tecla o hacer click en ese overlay carga el siguiente stage y devuelve la bola pegada al paddle.
- [ ] El stage 2 tiene 6 filas de bloques, el stage 3 tiene 7, y así hasta un máximo de `MAX_ROWS` filas.
- [ ] Las vidas y el score se conservan al pasar de stage; no se regalan vidas.
- [ ] El HUD muestra `Nivel: N` además de `Vidas:` y `Score:`.
- [ ] Desde el stage 2 aparecen bloques que requieren 2 o 3 impactos para romperse, repartidos de forma aleatoria.
- [ ] Un impacto que no rompe un bloque blindado hace rebotar la bola, reproduce el sonido de rotura y un destello, y no suma puntos ni crea partículas ni popup.
- [ ] El impacto que sí rompe el bloque ejecuta el efecto completo de SPEC 02 (animación de 4 frames, partículas, destello, popup "+10", +10 al score).
- [ ] Un bloque blindado dañado pero vivo se dibuja con una grieta (frame de `EXPLOSION_FRAMES`) que se agrava con cada golpe.
- [ ] La rapidez de la bola aumenta en cada stage y deja de crecer al alcanzar `STAGE_SPEED_CAP`.
- [ ] La partida solo termina por quedarse sin vidas (Game Over); no existe un estado final de victoria.
- [ ] Tras Game Over, reiniciar vuelve al stage 1 con 5 filas, rapidez base y sin bloques blindados.
- [ ] No se añaden dependencias: sin npm, sin paso de build, sin `<script src>` a CDNs.
- [ ] `specs/01-mvp-arkanoid.md` y `specs/02-efectos-rotura-bloques.md` referencian a este spec en los puntos que quedan modificados.

---

## Decisiones

- **Sí:** stages infinitos generados por `buildBricks( stage )`. No hay contenido que mantener y encaja con "que la dificultad escale sin fin".
- **Sí:** escalar por número de filas hasta `MAX_ROWS = 9`. A 28 px por fila la novena termina en ~y=312, deja >240 px hasta el paddle (y=560); más filas comprimirían demasiado el área de juego.
- **Sí:** cuando las filas llegan al tope, la dificultad sigue subiendo por `armorChance` y por `ballSpeed`. Evita que la progresión se estanque.
- **Sí:** bloques de 2–3 golpes asignados al azar con probabilidad creciente (`0.15 * (stage-1)`, tope 0.6). "Algunos bloques" y "aleatorios" según lo pedido; el tope evita rejillas enteras blindadas.
- **Sí:** mostrar el daño con un frame de `EXPLOSION_FRAMES[ color ]` superpuesto. Es un sprite quebrado ya disponible en los assets; no hace falta arte nuevo ni dibujar grietas a mano.
- **Sí:** golpe no letal = solo sonido + destello, sin score ni partículas ni popup. El popup "+10" y los +10 al score deben corresponder a bloques realmente destruidos.
- **Sí:** rapidez de bola `+8%` por stage con tope `1.6x`. Sube la presión sin volver la bola incontrolable ni provocar tunneling severo.
- **Sí:** `state.ballSpeed` en `state` en vez de mutar la constante `BALL.speed`. La constante queda como valor base; el reset es trivial.
- **Sí:** fase `"stageclear"` con overlay breve reutilizando el patrón de Game Over. Da un respiro entre stages sin construir una pantalla nueva.
- **Sí:** sustituir `"win"` en vez de conservarla. Con progresión infinita no hay estado de victoria; mantener ambos sería código muerto y contradictorio con SPEC 01.
- **No:** modos Fácil/Normal/Difícil elegibles. Se descartó en la aclaración: la dificultad solo escala al avanzar de nivel.
- **No:** layouts hechos a mano. Fuera de alcance; la rejilla rectangular por fórmula basta para escalar.
- **No:** vidas extra ni bonus de score por stage. No se pidió; se puede añadir en otro spec.
- **No:** persistir el stage máximo. El highscore / persistencia sigue siendo un spec futuro aparte.
- **Descartado:** aumentar columnas o el canvas para meter más bloques. SPEC 01 fija canvas 800x600 y `GRID.cols = 10`; tocarlo abre cálculos de layout que no aportan a "escalar la dificultad".

---

## Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                          |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Con la bola más rápida en stages altos puede atravesar un bloque o pared (tunneling)      | `STAGE_SPEED_CAP = 1.6` mantiene el paso por frame acotado; si aparece, subdividir el desplazamiento del frame (mismo riesgo ya anotado en SPEC 01). |
| Un bloque blindado en la fila inferior con la bola lenta genera rebotes largos y aburridos | `armorChance` capado a 0.6 y `ballSpeed` creciente reducen la situación; ningún bloque es indestructible.          |
| Quitar la fase `"win"` deja referencias colgando (`state.phase === "win"` en `render()`)   | Paso 1 obliga a sustituir todos los usos; el criterio de aceptación comprueba que no hay estado de victoria.       |
| El frame de `EXPLOSION_FRAMES` como grieta puede tapar demasiado el color del bloque       | Usar el índice más bajo para el primer daño (`idx = maxHp - hp - 1`); si molesta, dibujarlo con `globalAlpha < 1`. |
| Muchas filas + muchos bloques blindados podrían bajar los FPS por el doble `draw` por brick | El doble dibujo solo ocurre en bloques dañados (`hp < maxHp`), que son minoría; `MAX_ROWS` acota el total.         |

---

## Lo que **no** entra en este spec

- Selección de dificultad o modos Fácil/Normal/Difícil.
- Layouts de nivel hechos a mano o con formas.
- Bloques indestructibles, móviles o regenerativos.
- Bonus de score o vidas extra por avanzar de stage.
- Persistencia del stage máximo alcanzado.
- Sonido propio del cambio de stage.
- Más columnas o un canvas más grande.

Cada uno de estos, si se hace, va en su propio spec.
