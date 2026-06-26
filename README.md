# Chicken Rush 🐔

Juego web 3D estilo *Crossy Road*: un pollo cruza carreteras, ríos, tormentas,
desiertos, hordas zombi, el circo y la lava... hasta enfrentarse al **jefe final**.
Hecho con HTML, CSS y JavaScript puro + [Three.js](https://threejs.org/) (vía CDN).

**By Julen & Ander :)**

## Cómo jugarlo en local

Es un sitio estático: vale cualquier servidor de ficheros. Incluye uno listo:

```bash
python3 serve.py 8123
```

Y abre **http://localhost:8123/** en el navegador.

(Alternativas: `python3 -m http.server 8123`, `npx serve`, etc.)

## Controles

- **Flechas** o **WASD** para moverte.
- En móvil: **deslizar** (swipe) o los botones en pantalla.

## Características

- 7 niveles con temáticas distintas + pelea de jefe final.
- Tienda con skins, accesorios, estelas, temas y "píos", mascotas, logros,
  misiones semanales, estadísticas y álbum de coleccionables.
- Todo el progreso se guarda en `localStorage`.

## Estructura

| Archivo | Descripción |
|---|---|
| `index.html` | Página y estructura de la interfaz. |
| `game.js` | Toda la lógica del juego (Three.js, niveles, tienda, etc.). |
| `style.css` | Estilos de la interfaz. |
| `serve.py` | Servidor de desarrollo local robusto (opcional). |

## Despliegue

Al ser un sitio estático, se puede publicar tal cual en cualquier hosting
estático (GitHub Pages, Netlify, Vercel, o un servidor propio): basta con servir
`index.html`, `game.js` y `style.css`.
