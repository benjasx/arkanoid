# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

Un juego tipo Arkanoid/Breakout hecho con **HTML, CSS y JavaScript puros, cero dependencias**
(ver `README.md`). El juego **todavía no está implementado**: por ahora el repo solo contiene
assets de arte/sonido y el tooling del flujo spec-driven. Mantener la restricción de cero
dependencias es un requisito duro: nada de paquetes npm, sin paso de build, sin framework, sin
bundler.

## Ejecutar

No hay sistema de build, ni runner de tests, ni linter. Cuando exista un `index.html`, el juego
se ejecuta abriendo ese archivo en el navegador. Como `assets/spritesheet.js` carga
`assets/spritesheet-breakout.png` por HTTP, hay que servir la carpeta en vez de usar `file://`
(por ejemplo `python -m http.server` desde la raíz del repo) o fallará la carga de la imagen.

## Flujo de trabajo: desarrollo guiado por specs

Este repo usa dos skills vendored (fijadas en `skills-lock.json`, con origen en
`Klerith/fernando-skills`, symlinkeadas dentro de `.claude/skills/` desde `.agents/skills/`):

- `/spec <descripción de la feature>` — aclara requisitos mediante bloques de preguntas y luego
  escribe `specs/NN-slug.md`. **No** escribe código. También crea `specs/.spec-config.yml` en la
  primera ejecución.
- `/spec-impl <NN-slug>` — solo corre si el estado del spec significa "Aprobado"; crea y cambia
  a la rama `spec-NN-slug` (controlado por `AutoCreateBranch` en `specs/.spec-config.yml`, por
  defecto `true`), luego implementa el plan paso a paso, pausando tras cada paso para revisar el
  diff. Nunca hace commit automáticamente.

Los archivos de spec (`specs/`, creado en la primera ejecución de `/spec`) siguen
`.agents/skills/spec/template.md`: blockquote de cabecera (Estado / Depende de / Fecha /
Objetivo en una frase), Alcance (Dentro + Fuera), Modelo de datos, Plan de implementación (cada
paso commiteable y ejecutable por separado), Criterios de aceptación booleanos, Decisiones
tomadas/descartadas, Riesgos opcionales. Ciclo de estados:
`Borrador → En revisión → Aprobado → Implementado → Obsoleto`. Quien pasa un spec a `Aprobado`
es una persona, no el agente.

El repo no es ahora mismo un repositorio git; el paso de rama de `/spec-impl` asume que existe.

## Assets

- `assets/spritesheet.js` — el helper de renderizado. Cárgalo, llama a `loadSpritesheet(cb)` una
  vez y luego usa `drawSprite(ctx, name, x, y, w, h)` y `drawFrame(ctx, frame, x, y, w, h)`.
  Dibuja el PNG de origen en un canvas offscreen antes de usarlo. Nombres de sprites: `paddle`,
  `ball` y `block_<color>` donde color es uno de
  `gray red yellow cyan magenta hotpink green`. `EXPLOSION_FRAMES[color]` contiene animaciones
  de rotura de 4 frames; `EXPLOSION_DURATION` son 150 ms.
- `assets/spritesheet-breakout.png` — spritesheet de origen (coordenadas hardcodeadas en
  `spritesheet.js`).
- `assets/sounds/ball-bounce.mp3`, `assets/sounds/break-sound.mp3` — los dos únicos efectos de
  sonido.

## Convenciones

- Respuestas y preguntas de aclaración al usuario: en español. Código, identificadores,
  comentarios y mensajes de commit: en inglés.
- Estilo de `spritesheet.js`: espacios dentro de paréntesis/corchetes (`drawImage( ssImg, ... )`),
  indentación de 2 espacios, `const`/`let`. Mantenlo en los archivos nuevos del juego.
