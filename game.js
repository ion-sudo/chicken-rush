// ============================================================================
//  CRUZANDO LA CARRETERA — Crossy Road con pollito y Ferraris del futuro
//  HTML + CSS + JS vanilla, gráficos 3D con Three.js (estética voxel low-poly).
//
//  Estructura del archivo:
//    1. Constantes y configuración del mundo
//    2. Escena, cámara, luces y renderer
//    3. Construcción del pollito (jugador)
//    4. Generación procedural de filas (hierba / carretera / río)
//    5. Coches futuristas (terrestres y voladores)
//    6. Movimiento del jugador (salto por casillas)
//    7. Entrada: teclado, swipe táctil y D-pad
//    8. Colisiones, avance forzado y game over
//    9. Bucle principal y máquina de estados
// ============================================================================

import * as THREE from "three";

// ----------------------------------------------------------------------------
// 1. CONSTANTES Y CONFIGURACIÓN
// ----------------------------------------------------------------------------
const TILE = 1;                 // tamaño de una casilla en unidades del mundo
const COLS = 9;                 // semiancho jugable: columnas de -COLS..COLS
const ROWS_AHEAD = 16;          // filas generadas por delante del jugador
const ROWS_BEHIND = 20;         // filas mantenidas por detrás (se borran ya fuera de pantalla)

// ---- Niveles ----
// Nivel 1: cruzar carreteras con coches.  Nivel 2: cruzar ríos por plataformas.
let level = 1;                  // nivel actual (1 ó 2)
const LEVEL_GOAL = 20;          // filas a avanzar para completar un nivel

// Atajo del CIRCO (nivel 6): un cochecito a la derecha al que te subes para
// pasarte el nivel sin cruzarlo entero. Vive en una fila segura concreta.
const ESCAPE_ROW = 6;           // fila donde aparece el cochecito de escape
const ESCAPE_COL = COLS;        // pegado al borde derecho del campo jugable
let escapeCar = null;           // { mesh, col, row } del cochecito (o null)
let escapeUsed = false;         // evita disparar el atajo dos veces

// Tipos de fila
const ROW_GRASS = "grass";
const ROW_ROAD = "road";
const ROW_RIVER = "river";
const ROW_LAVA = "lava";
// Nivel 3 (Tormenta / Cielo)
const ROW_SKY = "sky";          // suelo de nube seguro (equivalente a hierba)
const ROW_CLOUD = "cloud";      // nubes-plataforma móviles (saltar entre ellas)
const ROW_SKYROAD = "skyroad";  // drones/aviones cruzando
const ROW_LIGHTNING = "lightning"; // rayos que caen en columnas con aviso
// Nivel 4 (Desierto / Ruinas)
const ROW_SAND = "sand";        // arena firme segura (equivalente a hierba)
const ROW_QUICKSAND = "quicksand"; // arenas movedizas: te hundes si te quedas quieto
const ROW_DESERTROAD = "desertroad"; // rocas rodantes / serpientes haciendo de "coches"
// Nivel 5 (Apocalipsis zombie)
const ROW_ZGRASS = "zgrass";    // hierba podrida: zombis que persiguen + plantas carnívoras ocultas
const ROW_ZHELI = "zheli";      // helicópteros zombificados cruzando (letal como una carretera)
const ROW_ZTRAIN = "ztrain";    // trenes zombificados que cruzan de golpe con aviso (letal)
// Nivel 6 (Circo / Parque de atracciones)
const ROW_CIRCUS = "circus";    // pista de feria segura (equivalente a hierba)
const ROW_BUMPER = "bumper";    // coches de choque cruzando (letal como una carretera)
const ROW_CAROUSEL = "carousel"; // carruseles giratorios: plataformas que te llevan
const ROW_CANNON = "cannon";    // cañones que disparan bolas que cruzan (letal)

// Colores base
const COLORS = {
  grassLight: 0x8fd15c,
  grassDark: 0x7cc24e,
  road: 0x3a3550,
  roadLine: 0x5a5478,
  river: 0x2bb6ff,
  riverDeep: 0x1f8fd6,
  log: 0x8a5a3c,
  lava: 0xff5a1e,
  rock: 0x6b6b73,
  rockTop: 0x8a8a93,
  cloud: 0xf2f6ff,
  skyFloor: 0xcdd9ef,
  stormFloor: 0x6c6a86,
  // Nivel 4 (Desierto / Ruinas) — tonos cálidos.
  sandLight: 0xe6c879,
  sandDark: 0xd9b863,
  quicksand: 0xb89243,   // arena movediza (más oscura/húmeda)
  desertRoad: 0xc7a55e,  // pista de arena pisada
  ruin: 0xc8b89a,        // piedra clara de ruinas
  boulder: 0x9c7b4f,     // roca rodante
  // Nivel 6 (Circo / Feria) — pista de serrín cálida y atracciones festivas.
  circusLight: 0xd9a25a, // serrín de pista (tono cálido claro)
  circusDark: 0xc98f47,  // serrín de pista (tono cálido oscuro)
  bumperFloor: 0x2b2350, // pista pulida de coches de choque
  carouselPit: 0x140a22, // foso oscuro del tiovivo (caes si no vas en la plataforma)
  cannonFloor: 0x4a2f2f, // arena de cañones
  // Nivel 5 (Apocalipsis zombie) — tonos enfermizos y oscuros.
  zgrassLight: 0x4a5a32, // hierba marchita clara
  zgrassDark: 0x3d4d2a,  // hierba marchita oscura
  zheliFloor: 0x241f2a,  // asfalto resquebrajado bajo los helicópteros
  ztrainFloor: 0x2a2622, // tierra/vías oxidadas del tren
  zombie: 0x7faa55,      // piel zombi verde enfermizo
  zombieDark: 0x5e8240,  // sombras de la piel zombi
  brain: 0xe88aa0,       // cerebro rosado expuesto
  rot: 0x6b7a4a,         // metal podrido/oxidado verdoso (helis y tren)
  rotDark: 0x4a5436,     // metal podrido en sombra
};

// Paleta neón para coches futuristas
const CAR_PALETTE = [0xff2b4d, 0x00f0ff, 0xff2bd6, 0xffe600, 0x7c4dff, 0x00ff9d];

// ----------------------------------------------------------------------------
// 2. ESCENA, CÁMARA, LUCES Y RENDERER
// ----------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141031);
const FOG_NEAR = 16, FOG_FAR = 30; // niebla base (la tormenta de arena la acerca)
scene.fog = new THREE.Fog(0x141031, FOG_NEAR, FOG_FAR);

// Cámara ortográfica para el look isométrico clásico de Crossy Road.
let camera;
const CAM_OFFSET = new THREE.Vector3(7, 9, 7); // posición relativa al jugador
function buildCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const d = 7; // "zoom": menor = más cerca
  camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 100);
  camera.position.copy(CAM_OFFSET);
  camera.lookAt(0, 0, 0);
}
buildCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById("game-container").appendChild(renderer.domElement);

// Luces: ambiente suave + direccional con sombras simples.
scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const hemi = new THREE.HemisphereLight(0xaecbff, 0x4a3a6a, 0.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(10, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const s = 18;
sun.shadow.camera.left = -s;
sun.shadow.camera.right = s;
sun.shadow.camera.top = s;
sun.shadow.camera.bottom = -s;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 60;
scene.add(sun);
scene.add(sun.target);

// ----------------------------------------------------------------------------
// 3. EL POLLO (jugador)
// ----------------------------------------------------------------------------
// Gallina/pollo adulto en estilo voxel. Devuelve un Group centrado en su base.
function buildChicken() {
  const chicken = new THREE.Group();

  const matBody = new THREE.MeshStandardMaterial({ color: 0xffd21a, roughness: 0.85 });
  const matBeak = new THREE.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.6 });
  const matComb = new THREE.MeshStandardMaterial({ color: 0xe03030, roughness: 0.6 });
  const matEye = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });

  // Cuerpo grande y ovalado (pollo adulto).
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.85), matBody);
  body.position.y = 0.45;
  body.castShadow = true;
  chicken.add(body);

  // Cola de plumas inclinada hacia atrás.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.2), matBody);
  tail.position.set(0, 0.7, -0.5);
  tail.rotation.x = -0.5;
  tail.castShadow = true;
  chicken.add(tail);

  // Cuello.
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.32), matBody);
  neck.position.set(0, 0.85, 0.28);
  chicken.add(neck);

  // Cabeza.
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), matBody);
  head.position.set(0, 1.12, 0.34);
  head.castShadow = true;
  chicken.add(head);

  // Pico.
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.2), matBeak);
  beak.position.set(0, 1.08, 0.6);
  chicken.add(beak);

  // Ojos.
  for (const dx of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.06), matEye);
    eye.position.set(dx, 1.18, 0.54);
    chicken.add(eye);
  }

  // Cresta roja (tres puntas sobre la cabeza).
  for (let i = 0; i < 3; i++) {
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14 + i * 0.02, 0.1), matComb);
    peak.position.set(0, 1.4, 0.42 - i * 0.13);
    chicken.add(peak);
  }

  // Barbilla (wattle) roja bajo el pico.
  const wattle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.08), matComb);
  wattle.position.set(0, 0.95, 0.56);
  chicken.add(wattle);

  // CARA DE PÁNICO (oculta por defecto): ojos saltones, boca de grito y gota
  // de sudor. Se enciende justo antes de cada choque para dramatismo cómico.
  const panic = new THREE.Group();
  const matWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const matPupil = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const matMouth = new THREE.MeshStandardMaterial({ color: 0x5a0d0d, roughness: 0.6 });
  const matSweat = new THREE.MeshStandardMaterial({
    color: 0x9bd6ff, transparent: true, opacity: 0.9, emissive: 0x2299ff, emissiveIntensity: 0.5,
  });
  for (const dx of [-0.14, 0.14]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), matWhite);
    white.position.set(dx, 1.2, 0.55); panic.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), matPupil);
    pupil.position.set(dx, 1.2, 0.66); panic.add(pupil);
  }
  // Boca abierta de grito.
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), matMouth);
  mouth.scale.set(1, 1.3, 0.6); mouth.position.set(0, 1.0, 0.62); panic.add(mouth);
  // Gota de sudor en la sien.
  const sweat = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), matSweat);
  sweat.scale.set(1, 1.5, 1); sweat.position.set(0.28, 1.14, 0.42); panic.add(sweat);
  panic.visible = false;
  chicken.add(panic);
  chicken.userData.panicFace = panic;

  // Patas más largas y marcadas.
  for (const dx of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.09), matBeak);
    leg.position.set(dx, 0.09, 0.05);
    chicken.add(leg);
    // Pies.
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.22), matBeak);
    foot.position.set(dx, 0.03, 0.12);
    chicken.add(foot);
  }

  // --- ALAS (Bloque 10): pivotes en los hombros para poder posarlas en las
  // reacciones graciosas (pose de superhéroe, andar chulito). Comparten matBody
  // para que recoloreen con la skin/el nivel automáticamente. En reposo cuelgan
  // pegadas al cuerpo, así que apenas cambian la silueta normal del pollo. ---
  const wingGeo = new THREE.BoxGeometry(0.12, 0.42, 0.5);
  const wingPivotL = new THREE.Group();
  wingPivotL.position.set(-0.36, 0.62, 0);
  const wingMeshL = new THREE.Mesh(wingGeo, matBody);
  wingMeshL.position.set(-0.02, -0.18, -0.02);
  wingMeshL.castShadow = true;
  wingPivotL.add(wingMeshL);
  wingPivotL.rotation.z = 0.12;
  chicken.add(wingPivotL);
  const wingPivotR = new THREE.Group();
  wingPivotR.position.set(0.36, 0.62, 0);
  const wingMeshR = new THREE.Mesh(wingGeo, matBody);
  wingMeshR.position.set(0.02, -0.18, -0.02);
  wingMeshR.castShadow = true;
  wingPivotR.add(wingMeshR);
  wingPivotR.rotation.z = -0.12;
  chicken.add(wingPivotR);
  chicken.userData.wingL = wingPivotL;
  chicken.userData.wingR = wingPivotR;

  // --- CARA DE ENFADO (Bloque 10): cejas en "V" + ceño, para el easter egg de
  // tocarle mucho en el menú. Oculta por defecto. ---
  const angry = new THREE.Group();
  for (const s of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.045, 0.05), matEye);
    brow.position.set(s * 0.13, 1.27, 0.55);
    brow.rotation.z = s * 0.5; // \  / cejas enfadadas
    angry.add(brow);
  }
  const frown = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.045, 0.05), matComb);
  frown.position.set(0, 1.0, 0.56);
  angry.add(frown);
  angry.visible = false;
  chicken.add(angry);
  chicken.userData.angryFace = angry;

  // Aura translúcida (escudo): esfera por dentro que se enciende con el power-up.
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0x00f0ff, transparent: true, opacity: 0.28, side: THREE.BackSide,
    })
  );
  aura.position.y = 0.6;
  aura.visible = false;
  chicken.add(aura);
  chicken.userData.aura = aura;

  // Guardamos el material del cuerpo para poder cambiar su color por nivel.
  chicken.userData.bodyMaterial = matBody;
  return chicken;
}

// Color del cuerpo del pollo por nivel: amarillo, verde, azul cielo, naranja.
function setChickenColorForLevel(n) {
  const colors = { 1: 0xffd21a, 2: 0x4ed94e, 3: 0x66c2ff, 4: 0xdca54a, 5: 0xa8d86a, 6: 0xff3ea5, 7: 0xff7a1e };
  player.userData.bodyMaterial.color.setHex(colors[n] || 0xffd21a);
}

// Ambiente del cielo según el nivel: tormenta gris-morada (3), desierto cálido (4).
function setSkyForLevel(n) {
  if (n === 3) {
    scene.background.setHex(0x2a2740);
    scene.fog.color.setHex(0x2a2740);
  } else if (n === 4) {
    scene.background.setHex(0x3a2410);  // ocaso cálido del desierto
    scene.fog.color.setHex(0x4a2f15);
  } else if (n === 5) {
    scene.background.setHex(0x0d150f);  // noche apocalíptica verdosa/negra
    scene.fog.color.setHex(0x16241a);
  } else if (n === 6) {
    scene.background.setHex(0x2a1a55);  // noche de feria púrpura (luces de circo)
    scene.fog.color.setHex(0x3a2a6a);
  } else {
    scene.background.setHex(0x141031);
    scene.fog.color.setHex(0x141031);
  }
  // Restaurar niebla base (la tormenta de arena la modifica dinámicamente).
  // El nivel 5 (zombie) usa niebla más cerrada para reforzar el ambiente de terror.
  if (n === 5) {
    scene.fog.near = 9;
    scene.fog.far = 24;
  } else {
    scene.fog.near = FOG_NEAR;
    scene.fog.far = FOG_FAR;
  }
}

const player = buildChicken();
scene.add(player);

// Estado lógico del jugador en la rejilla.
const playerState = {
  col: 0,          // posición X en casillas
  row: 0,          // posición Z en casillas (avanza en negativo Z)
  maxRow: 0,       // fila más lejana alcanzada (para puntuación)
  moving: false,   // animación de salto en curso
  moveStart: 0,
  from: new THREE.Vector3(),
  to: new THREE.Vector3(),
  facing: 0,       // rotación objetivo en Y
  onLog: null,     // tronco al que va enganchado si está en el río
  alive: true,
};

// Convierte coordenadas de rejilla a coordenadas de mundo.
function gridToWorld(col, row) {
  return new THREE.Vector3(col * TILE, 0, -row * TILE);
}

// ----------------------------------------------------------------------------
// 4. GENERACIÓN PROCEDURAL DE FILAS
// ----------------------------------------------------------------------------
// Mantenemos las filas en un Map indexado por número de fila (row).
const rows = new Map();        // row -> { type, group, lanes? }
const activeVehicles = [];     // todos los coches/troncos en movimiento

// ---- Monedas coleccionables ----
const COINS_PER_LEVEL = 5;
const coins = [];              // {mesh, col, row}
let coinsCollected = 0;

// Materiales reutilizables de suelo.
const matGrassL = new THREE.MeshStandardMaterial({ color: COLORS.grassLight, roughness: 1 });
const matGrassD = new THREE.MeshStandardMaterial({ color: COLORS.grassDark, roughness: 1 });
const matRoad = new THREE.MeshStandardMaterial({ color: COLORS.road, roughness: 0.9 });
const matRiver = new THREE.MeshStandardMaterial({ color: COLORS.river, roughness: 0.3, metalness: 0.1 });

const FIELD_WIDTH = (COLS * 2 + 6) * TILE; // un poco más ancho que la zona jugable

// Tipo de fila "segura" (de descanso) según el nivel.
function safeRowType() {
  if (level === 3) return ROW_SKY;
  if (level === 4) return ROW_SAND;
  if (level === 5) return ROW_ZGRASS;
  if (level === 6) return ROW_CIRCUS;
  return ROW_GRASS;
}

// Decide qué tipo de fila generar según el nivel.
// Las primeras filas y la zona de meta son seguras.
function pickRowType(row) {
  if (row < 3) return safeRowType();
  if (row >= LEVEL_GOAL) return safeRowType(); // zona de meta segura
  const r = Math.random();
  if (level === 1) {
    // Nivel 1 (más fácil): menos carreteras, más hierba segura.
    return r < 0.45 ? ROW_ROAD : ROW_GRASS;
  }
  if (level === 2) {
    // Nivel 2: solo ríos con plataformas (y algo de hierba).
    return r < 0.62 ? ROW_RIVER : ROW_GRASS;
  }
  if (level === 3) {
    // Nivel 3 (Tormenta): drones, rayos y nubes-plataforma, con nubes seguras.
    if (r < 0.30) return ROW_SKYROAD;
    if (r < 0.56) return ROW_LIGHTNING;
    if (r < 0.74) return ROW_CLOUD;
    return ROW_SKY;
  }
  if (level === 4) {
    // Nivel 4 (Desierto / Ruinas): rocas rodantes/serpientes y arenas movedizas.
    if (r < 0.40) return ROW_DESERTROAD;
    if (r < 0.62) return ROW_QUICKSAND;
    return ROW_SAND;
  }
  if (level === 5) {
    // Nivel 5 (Apocalipsis zombie): helicópteros y trenes letales,
    // y hierba podrida con zombis perseguidores + plantas carnívoras ocultas.
    if (r < 0.32) return ROW_ZHELI;
    if (r < 0.50) return ROW_ZTRAIN;
    return ROW_ZGRASS;
  }
  if (level === 6) {
    // Nivel 6 (Circo / Parque): coches de choque, carruseles y cañones.
    // Más fácil: menos peligros y más pista segura de feria (ROW_CIRCUS).
    if (r < 0.24) return ROW_BUMPER;
    if (r < 0.44) return ROW_CAROUSEL;
    if (r < 0.56) return ROW_CANNON;
    return ROW_CIRCUS;
  }
  // Nivel 7: lava con rocas móviles. Más lava que hierba (más difícil).
  return r < 0.58 ? ROW_LAVA : ROW_GRASS;
}

function createGrassRow(row) {
  const group = new THREE.Group();
  const mat = row % 2 === 0 ? matGrassL : matGrassD;
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), mat);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);

  const blocked = new Set();

  // Fila de meta: arco luminoso que marca el final del nivel.
  if (row === LEVEL_GOAL) {
    group.add(buildFinishArch());
    group.position.copy(gridToWorld(0, row));
    scene.add(group);
    rows.set(row, { type: ROW_GRASS, group, blocked });
    return;
  }

  // Árboles voxel decorativos (también bloquean casillas como en Crossy Road).
  const treeCount = Math.floor(Math.random() * 3);
  for (let i = 0; i < treeCount; i++) {
    const col = Math.round((Math.random() * 2 - 1) * COLS);
    if (col === 0 && row < 2) continue; // no bloquear el arranque del jugador
    if (blocked.has(col)) continue;
    blocked.add(col);
    group.add(buildTree(col));
  }

  group.position.copy(gridToWorld(0, row));
  scene.add(group);
  const data = { type: ROW_GRASS, group, blocked };
  rows.set(row, data);
  // Nivel 7: monstruos de lava que emergen del suelo y persiguen (como los
  // zombis del nivel 5). Solo en filas de hierba interiores, no en el arranque.
  if (level === 7 && row > 1 && row < LEVEL_GOAL && Math.random() < 0.5) {
    spawnLavaMonstersForRow(row);
  }
  maybeAddPowerup(row, data, blocked);
}

// --- ATAJO DEL CIRCO (nivel 6): fila segura con cochecito de escape ---------
// Fila de hierba 100% segura (sin árboles ni huecos) con un cochecito a la
// derecha. Si el pollo se sube al cochecito, se pasa el nivel directamente.
function createEscapeRow(row) {
  const group = new THREE.Group();
  // Suelo de circo (no de hierba) para que el atajo se mimetice con el nivel.
  const mat = row % 2 === 0 ? matCircusL : matCircusD;
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), mat);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);

  // Cochecito de escape pegado al borde derecho, algo más pequeño y discreto
  // (sin flecha luminosa): hay que descubrirlo, no salta a la vista.
  const car = buildEscapeCar();
  car.position.set(ESCAPE_COL * TILE, 0, 0);
  car.scale.setScalar(0.82);
  group.add(car);

  group.position.copy(gridToWorld(0, row));
  scene.add(group);
  rows.set(row, { type: ROW_CIRCUS, group, blocked: new Set() });
  // Guardar la referencia del cochecito para detectar cuando el pollo se sube.
  escapeCar = { mesh: car, col: ESCAPE_COL, row };
}

// Cochecito de payaso pequeño y simpático (modelo voxel) para el atajo.
function buildEscapeCar() {
  const g = new THREE.Group();
  const matRed   = new THREE.MeshStandardMaterial({ color: 0xff3b5c, roughness: 0.5 });
  const matYel   = new THREE.MeshStandardMaterial({ color: 0xffd21a, roughness: 0.5 });
  const matDark  = new THREE.MeshStandardMaterial({ color: 0x222230, roughness: 0.7 });
  const matWhite = new THREE.MeshStandardMaterial({ color: 0xf5f5ff, roughness: 0.6 });

  // Chasis bajo y carrocería redondeada (pequeña).
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.7), matRed);
  base.position.y = 0.3; base.castShadow = true; g.add(base);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.6), matYel);
  cabin.position.set(-0.08, 0.55, 0); cabin.castShadow = true; g.add(cabin);
  // Franja decorativa de circo.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.72), matWhite);
  stripe.position.y = 0.38; g.add(stripe);
  // Ruedas gordas.
  for (const dx of [-0.3, 0.3]) for (const dz of [-0.34, 0.34]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12), matDark);
    w.rotation.x = Math.PI / 2;
    w.position.set(dx, 0.16, dz); g.add(w);
  }
  // Volante y faro alegre.
  const horn = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), matYel);
  horn.position.set(0.5, 0.42, 0); g.add(horn);
  // Banderín en una antena.
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), matDark);
  pole.position.set(-0.3, 0.85, 0); g.add(pole);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.02), matRed);
  flag.position.set(-0.18, 0.98, 0); g.add(flag);
  return g;
}

// Si el pollo está justo en la casilla del cochecito de escape, pasa el nivel.
function checkEscapeCar() {
  if (escapeUsed || !escapeCar) return;
  if (playerState.moving) return;
  if (playerState.col === escapeCar.col && playerState.row === escapeCar.row) {
    escapeUsed = true;
    sfxFanfare();
    // Chispas de celebración alrededor del pollo subiéndose al coche.
    spawnParticles(player.position.x, 0.8, player.position.z, 0xffd21a, 16, { speed: 3, up: 4, life: 1.4 });
    completeLevel();
  }
}

function buildTree(col) {
  const t = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.5, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 1 })
  );
  trunk.position.y = 0.25;
  trunk.castShadow = true;
  t.add(trunk);
  const h = 0.6 + Math.random() * 0.5;
  const leaves = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, h, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x3f9d4a, roughness: 1 })
  );
  leaves.position.y = 0.5 + h / 2;
  leaves.castShadow = true;
  t.add(leaves);
  t.position.x = col * TILE;
  return t;
}

// Colores variados para los pollos del público de la meta.
const SPECTATOR_COLORS = [
  0xffffff, 0xf6dca6, 0xd98c4a, 0x9b6b3a, 0xffd21a,
  0x3a3a3a, 0xe9e9e9, 0xcf5757, 0x7ec8e3, 0xc7a0e8,
];
// Lista animada de pollos espectadores de la meta (saltan y agitan las alas).
const cheerers = [];

// Construye un pollo espectador (más pequeño que el jugador) con alas-brazos
// montadas sobre pivotes para poder agitarlas mientras animan al jugador.
function buildSpectatorChicken(color) {
  const g = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const matBeak = new THREE.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.6 });
  const matComb = new THREE.MeshStandardMaterial({ color: 0xe03030, roughness: 0.6 });
  const matEye = new THREE.MeshStandardMaterial({ color: 0x222222 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.5), matBody);
  body.position.y = 0.3; body.castShadow = true; g.add(body);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.13), matBody);
  tail.position.set(0, 0.46, -0.3); tail.rotation.x = -0.5; g.add(tail);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), matBody);
  head.position.set(0, 0.66, 0.2); head.castShadow = true; g.add(head);

  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.13), matBeak);
  beak.position.set(0, 0.63, 0.38); g.add(beak);

  for (const dx of [-0.08, 0.08]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.04), matEye);
    e.position.set(dx, 0.7, 0.33); g.add(e);
  }
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1 + i * 0.02, 0.07), matComb);
    p.position.set(0, 0.85, 0.26 - i * 0.09); g.add(p);
  }
  const wattle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.05), matComb);
  wattle.position.set(0, 0.55, 0.36); g.add(wattle);

  // Alas-brazos: pivote en el hombro; cuelgan hacia abajo y se levantan al animar.
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.22, 0.4, 0);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.26), matBody);
    wing.position.set(0, -0.12, 0);
    pivot.add(wing);
    pivot.rotation.z = side * 0.5; // ligeramente abiertas en reposo
    g.add(pivot);
    wings.push(pivot);
  }
  g.userData.wings = wings;

  for (const dx of [-0.1, 0.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), matBeak);
    leg.position.set(dx, 0.06, 0.03); g.add(leg);
  }
  return g;
}

// Arco de meta luminoso: postes + travesaño neón, bandera de cuadros, banderines
// y un público de pollos esperando y animando tras la línea de meta.
function buildFinishArch() {
  const arch = new THREE.Group();
  const matPost = new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xffe600, emissiveIntensity: 0.6 });
  const matBar = new THREE.MeshStandardMaterial({ color: 0xff2bd6, emissive: 0xff2bd6, emissiveIntensity: 1.0 });
  const ARCH_HALF = 4.2; // el arco abarca buena parte del carril

  // Postes con remate luminoso.
  for (const dx of [-ARCH_HALF, ARCH_HALF]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.8, 0.28), matPost);
    post.position.set(dx, 1.4, 0); post.castShadow = true; arch.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), matBar);
    cap.position.set(dx, 2.9, 0); arch.add(cap);
  }
  // Travesaño superior.
  const bar = new THREE.Mesh(new THREE.BoxGeometry(ARCH_HALF * 2 + 0.4, 0.38, 0.32), matBar);
  bar.position.set(0, 2.75, 0); arch.add(bar);

  // Bandera de cuadros (meta) colgando del travesaño.
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222, emissiveIntensity: 0.2 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const colsN = 12, rowsN = 3, sq = (ARCH_HALF * 2) / colsN;
  for (let cx = 0; cx < colsN; cx++) {
    for (let cy = 0; cy < rowsN; cy++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sq, sq, 0.05), ((cx + cy) % 2 === 0) ? white : black);
      m.position.set(-ARCH_HALF + sq * (cx + 0.5), 2.5 - sq * (cy + 0.5), 0.18);
      arch.add(m);
    }
  }
  // Banderines triangulares de colores sobre el travesaño.
  const flagColors = [0xff3b3b, 0xffd21a, 0x35d07f, 0x3aa0ff, 0xff7ad9];
  for (let i = 0; i <= 10; i++) {
    const tx = -ARCH_HALF + (i / 10) * ARCH_HALF * 2;
    const c = flagColors[i % flagColors.length];
    const flag = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.34, 4),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4 })
    );
    flag.position.set(tx, 3.12, 0); flag.rotation.x = Math.PI; arch.add(flag);
  }

  // Público de pollos esperando/animando junto a la línea de meta.
  cheerers.length = 0; // se regenera con cada meta
  const spots = [];
  // Graderíos a ambos lados del arco (fuera de los postes), bien visibles y sin
  // quedar tapados por la pancarta de cuadros.
  for (const side of [-1, 1]) {
    for (let zi = 0; zi < 3; zi++) {
      for (let xi = 0; xi < 3; xi++) {
        const x = side * (ARCH_HALF + 0.8 + xi * 1.1);
        const z = 0.6 - zi * 1.1; // desde delante de la línea hasta detrás
        spots.push([x + (Math.random() - 0.5) * 0.25, z]);
      }
    }
  }
  // Fila trasera tras la pancarta (sus cabezas asoman por encima y los lados).
  for (let x = -3.2; x <= 3.2; x += 1.4) {
    spots.push([x + (Math.random() - 0.5) * 0.3, -1.6]);
  }
  for (const [x, z] of spots) {
    const col = SPECTATOR_COLORS[(Math.random() * SPECTATOR_COLORS.length) | 0];
    const spec = buildSpectatorChicken(col);
    spec.position.set(x, 0, z);
    // Miran hacia el jugador, que se acerca desde +z local (filas inferiores).
    spec.rotation.y = 0;
    spec.scale.setScalar(0.85 + Math.random() * 0.3);
    arch.add(spec);
    cheerers.push({
      mesh: spec,
      phase: Math.random() * Math.PI * 2,
      hopSpeed: 6 + Math.random() * 3,
      baseY: spec.position.y,
    });
  }
  return arch;
}

// Anima al público de la meta: saltitos y aleteo. Cuanto más cerca está el
// jugador (y al completar el nivel), más se emocionan.
function updateCheerers(dt, now) {
  if (!cheerers.length) return;
  const prox = Math.min(1, Math.max(0, (playerState.maxRow - (LEVEL_GOAL - 9)) / 9));
  const celebrating = (gameState === "levelComplete" || gameState === "won");
  const hype = celebrating ? 1 : 0.25 + prox * 0.75;
  for (const c of cheerers) {
    const t = now * c.hopSpeed * (0.6 + hype * 0.7) + c.phase;
    const hop = Math.abs(Math.sin(t));
    c.mesh.position.y = c.baseY + hop * (0.12 + hype * 0.45);
    c.mesh.rotation.z = Math.sin(t * 0.9) * 0.06 * (0.5 + hype);
    const wings = c.mesh.userData.wings;
    if (wings) {
      const wave = 0.5 + hop * (0.4 + hype * 0.9);
      wings[0].rotation.z = -wave;
      wings[1].rotation.z = wave;
    }
  }
}

function createRoadRow(row) {
  const group = new THREE.Group();
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), matRoad);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);

  // Línea discontinua central.
  for (let x = -COLS; x <= COLS; x += 2) {
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.02, 0.08),
      new THREE.MeshStandardMaterial({ color: COLORS.roadLine, emissive: 0x2a2840 })
    );
    dash.position.set(x, 0.01, 0);
    group.add(dash);
  }

  group.position.copy(gridToWorld(0, row));
  scene.add(group);

  // Configuración del tráfico de esta fila.
  const flying = Math.random() < 0.3;           // ~30% de carriles voladores
  const dir = Math.random() < 0.5 ? 1 : -1;     // sentido del tráfico
  const baseSpeed = flying ? 3.6 + Math.random() * 1.8 : 1.6 + Math.random() * 1.4;
  const gap = flying ? 6 + Math.random() * 2 : 4.8 + Math.random() * 2.5;

  const lane = { type: ROW_ROAD, group, flying, dir, speed: baseSpeed, gap, row, cars: [], spawnX: 0 };
  rows.set(row, lane);

  // Pre-poblar el carril con algunos coches espaciados.
  const startX = -FIELD_WIDTH / 2;
  let x = startX + Math.random() * gap;
  while (x < FIELD_WIDTH / 2) {
    spawnCar(lane, x);
    x += gap;
  }
}

function createRiverRow(row) {
  const group = new THREE.Group();
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), matRiver);
  tile.position.set(0, -0.25, 0);
  tile.receiveShadow = true;
  group.add(tile);
  group.position.copy(gridToWorld(0, row));
  scene.add(group);

  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = 1.5 + Math.random() * 1.5;
  const gap = 2.6 + Math.random() * 1.2;
  const lane = { type: ROW_RIVER, group, dir, speed, gap, row, cars: [] };
  rows.set(row, lane);

  // Troncos (plataformas flotantes).
  let x = -FIELD_WIDTH / 2 + Math.random() * gap;
  while (x < FIELD_WIDTH / 2) {
    spawnLog(lane, x);
    x += gap;
  }

  // Vida acuática decorativa: tiburón ocasional + peces (no siguen al jugador).
  // SOLO en el nivel 2 (ríos): los tiburones no deben aparecer en otros niveles.
  if (level === 2 && Math.random() < 0.35) addSharkToLane(lane, -0.22);
  if (level === 2 && Math.random() < 0.7) addFishToLane(lane);
}

const matLava = new THREE.MeshStandardMaterial({
  color: COLORS.lava, emissive: 0xff3a00, emissiveIntensity: 0.9, roughness: 0.6,
});

function createLavaRow(row) {
  const group = new THREE.Group();
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), matLava);
  tile.position.set(0, -0.22, 0);
  tile.receiveShadow = true;
  group.add(tile);

  // Vetas brillantes para dar sensación de lava burbujeante.
  for (let x = -COLS; x <= COLS; x += 1.5) {
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.02, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xffd000, emissive: 0xffb000, emissiveIntensity: 1.2 })
    );
    glow.position.set(x + (Math.random() - 0.5), 0.01, (Math.random() - 0.5) * 0.4);
    group.add(glow);
  }

  group.position.copy(gridToWorld(0, row));
  scene.add(group);

  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = 1.1 + Math.random() * 0.9;   // rocas más rápidas (más difícil)
  const gap = 3.3 + Math.random() * 1.1;     // huecos más grandes entre rocas (saltos más justos)
  const lane = { type: ROW_LAVA, group, dir, speed, gap, row, cars: [] };
  rows.set(row, lane);

  // Rocas (plataformas circulares grandes flotando sobre la lava).
  let x = -FIELD_WIDTH / 2 + Math.random() * gap;
  while (x < FIELD_WIDTH / 2) {
    spawnRock(lane, x);
    x += gap;
  }
}

// ----------------------------------------------------------------------------
//  NIVEL 4 — TORMENTA / CIELO
// ----------------------------------------------------------------------------
const matSkyFloor = new THREE.MeshStandardMaterial({ color: COLORS.skyFloor, roughness: 1 });
const matCloud = new THREE.MeshStandardMaterial({ color: COLORS.cloud, roughness: 1 });
const matStorm = new THREE.MeshStandardMaterial({ color: COLORS.stormFloor, roughness: 1 });

// Pequeñas borlas de nube decorativas (no bloquean).
function addCloudPuffs(group, count, y) {
  for (let i = 0; i < count; i++) {
    const puff = new THREE.Mesh(
      new THREE.BoxGeometry(0.4 + Math.random() * 0.4, 0.25, 0.4),
      matCloud
    );
    puff.position.set((Math.random() * 2 - 1) * COLS, y, (Math.random() - 0.5) * 0.4);
    group.add(puff);
  }
}

// Fila segura de cielo: suelo de nube por el que se camina normal.
function createCloudFloorRow(row) {
  const group = new THREE.Group();
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), matSkyFloor);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);
  addCloudPuffs(group, Math.floor(Math.random() * 3), 0.25);

  const blocked = new Set();
  if (row === LEVEL_GOAL) group.add(buildFinishArch());

  group.position.copy(gridToWorld(0, row));
  scene.add(group);
  const data = { type: ROW_SKY, group, blocked };
  rows.set(row, data);
  maybeAddPowerup(row, data, blocked);
}

// Fila de nubes-plataforma: hueco de cielo con nubes que cruzan (saltar entre ellas).
function createCloudRow(row) {
  const group = new THREE.Group();
  // Sin suelo sólido: solo una lámina muy fina translúcida para dar profundidad.
  const haze = new THREE.Mesh(
    new THREE.BoxGeometry(FIELD_WIDTH, 0.04, TILE),
    new THREE.MeshBasicMaterial({ color: 0x9fb6e0, transparent: true, opacity: 0.12 })
  );
  haze.position.y = -0.3;
  group.add(haze);
  group.position.copy(gridToWorld(0, row));
  scene.add(group);

  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = 1.3 + Math.random() * 1.3;
  const gap = 2.8 + Math.random() * 1.2;
  const lane = { type: ROW_CLOUD, group, dir, speed, gap, row, cars: [] };
  rows.set(row, lane);

  let x = -FIELD_WIDTH / 2 + Math.random() * gap;
  while (x < FIELD_WIDTH / 2) {
    spawnCloudPlatform(lane, x);
    x += gap;
  }
  // (Sin tiburones en el nivel 3: los tiburones son solo del nivel 2, los ríos.)
}

// Fila de drones/aviones: suelo fino de nube + vehículos voladores cruzando.
function createSkyRoadRow(row) {
  const group = new THREE.Group();
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), matStorm);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);
  group.position.copy(gridToWorld(0, row));
  scene.add(group);

  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = 3.2 + Math.random() * 2.2;
  const gap = 5 + Math.random() * 2.5;
  const lane = { type: ROW_SKYROAD, group, dir, speed, gap, row, cars: [] };
  rows.set(row, lane);

  let x = -FIELD_WIDTH / 2 + Math.random() * gap;
  while (x < FIELD_WIDTH / 2) {
    spawnDrone(lane, x);
    x += gap;
  }
}

// Fila de rayos: suelo de nube por el que se camina, pero caen rayos en columnas
// concretas avisando ~1 s antes. Los rayos se gestionan en updateLightning().
function createLightningRow(row) {
  const group = new THREE.Group();
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), matStorm);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);
  group.position.copy(gridToWorld(0, row));
  scene.add(group);

  const lane = {
    type: ROW_LIGHTNING, group, row,
    strikes: [],
    nextStrike: performance.now() / 1000 + 0.8 + Math.random() * 1.5,
  };
  rows.set(row, lane);
}

// ----------------------------------------------------------------------------
//  NIVEL 4 — DESIERTO / RUINAS
// ----------------------------------------------------------------------------
const matSandL = new THREE.MeshStandardMaterial({ color: COLORS.sandLight, roughness: 1 });
const matSandD = new THREE.MeshStandardMaterial({ color: COLORS.sandDark, roughness: 1 });
const matQuick = new THREE.MeshStandardMaterial({ color: COLORS.quicksand, roughness: 1 });
const matDesertRoad = new THREE.MeshStandardMaterial({ color: COLORS.desertRoad, roughness: 1 });

// Columna de ruina rota (bloquea la casilla, como un árbol).
function buildRuin(col) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.ruin, roughness: 1 });
  const segs = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < segs; i++) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.34, 10), mat);
    drum.position.y = 0.17 + i * 0.34;
    drum.rotation.y = Math.random() * 0.4;
    drum.castShadow = true;
    g.add(drum);
  }
  // Base cuadrada de piedra.
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.7), mat);
  base.position.y = 0.02;
  g.add(base);
  g.position.x = col * TILE;
  return g;
}

// Cactus voxel decorativo (bloquea la casilla).
function buildCactus(col) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4e8d3a, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.3), mat);
  trunk.position.y = 0.5; trunk.castShadow = true;
  g.add(trunk);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.22), mat);
  arm.position.set(0.26, 0.7, 0); g.add(arm);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 0.22), mat);
  arm2.position.set(-0.24, 0.55, 0); g.add(arm2);
  g.position.x = col * TILE;
  return g;
}

// Fila de arena firme segura (equivalente a hierba): se camina normal.
function createSandRow(row) {
  const group = new THREE.Group();
  const mat = row % 2 === 0 ? matSandL : matSandD;
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), mat);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);

  const blocked = new Set();

  if (row === LEVEL_GOAL) {
    group.add(buildFinishArch());
    group.position.copy(gridToWorld(0, row));
    scene.add(group);
    rows.set(row, { type: ROW_SAND, group, blocked });
    return;
  }

  // Decoración de ruinas/cactus (bloquean casillas como los árboles).
  const decoCount = Math.floor(Math.random() * 3);
  for (let i = 0; i < decoCount; i++) {
    const col = Math.round((Math.random() * 2 - 1) * COLS);
    if (col === 0 && row < 2) continue;
    if (blocked.has(col)) continue;
    blocked.add(col);
    group.add(Math.random() < 0.5 ? buildRuin(col) : buildCactus(col));
  }

  group.position.copy(gridToWorld(0, row));
  scene.add(group);
  const data = { type: ROW_SAND, group, blocked };
  rows.set(row, data);
  maybeAddPowerup(row, data, blocked);
}

// Fila de arenas movedizas: parece arena pero te hundes si te quedas quieto.
// (La lógica de hundimiento está en updateQuicksand().)
function createQuicksandRow(row) {
  const group = new THREE.Group();
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), matQuick);
  tile.position.set(0, -0.24, 0); // ligeramente hundida
  tile.receiveShadow = true;
  group.add(tile);

  // Remolinos concéntricos para avisar visualmente del peligro.
  for (let x = -COLS; x <= COLS; x += 2) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.3, 14),
      new THREE.MeshBasicMaterial({ color: 0x8c6a2e, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x + (Math.random() - 0.5), -0.02, (Math.random() - 0.5) * 0.5);
    group.add(ring);
  }

  group.position.copy(gridToWorld(0, row));
  scene.add(group);
  rows.set(row, { type: ROW_QUICKSAND, group });
}

// Roca rodante: esfera de piedra que cruza el carril (letal como un coche).
function buildBoulder() {
  const g = new THREE.Group();
  const r = 0.42 + Math.random() * 0.12;
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(r, 0),
    new THREE.MeshStandardMaterial({ color: COLORS.boulder, roughness: 1, flatShading: true })
  );
  rock.castShadow = true;
  g.add(rock);
  g.userData.radius = r;
  return g;
}

// Serpiente voxel: cabeza + segmentos que ondulan (letal como un coche).
function buildSnake() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x9bcf3a, roughness: 0.8, emissive: 0x1a2a00, emissiveIntensity: 0.2 });
  const segs = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), mat);
    s.position.set(-i * 0.3, 0.18, 0);
    s.castShadow = true;
    g.add(s);
    segs.push(s);
  }
  // Cabeza un poco mayor con ojos.
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), mat);
  head.position.set(0.28, 0.2, 0);
  g.add(head);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const dz of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), eyeMat);
    eye.position.set(0.46, 0.28, dz);
    g.add(eye);
  }
  g.userData.segments = segs;
  return g;
}

// Fila de "carretera" del desierto: rocas rodantes o serpientes cruzando.
function createDesertRoadRow(row) {
  const group = new THREE.Group();
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), matDesertRoad);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);
  group.position.copy(gridToWorld(0, row));
  scene.add(group);

  const kind = Math.random() < 0.5 ? "boulder" : "snake";
  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = kind === "boulder" ? 1.8 + Math.random() * 1.4 : 2.2 + Math.random() * 1.6;
  const gap = kind === "boulder" ? 4.2 + Math.random() * 2 : 5 + Math.random() * 2.5;
  const lane = { type: ROW_DESERTROAD, group, dir, speed, gap, row, cars: [], kind };
  rows.set(row, lane);

  let x = -FIELD_WIDTH / 2 + Math.random() * gap;
  while (x < FIELD_WIDTH / 2) {
    if (kind === "boulder") spawnBoulder(lane, x);
    else spawnSnake(lane, x);
    x += gap;
  }
}

function spawnBoulder(lane, x) {
  const mesh = buildBoulder();
  mesh.position.set(x, mesh.userData.radius, 0);
  lane.group.add(mesh);
  const car = { mesh, lane, halfWidth: mesh.userData.radius + 0.1, roll: true, radius: mesh.userData.radius };
  lane.cars.push(car);
  activeVehicles.push(car);
  return car;
}

function spawnSnake(lane, x) {
  const mesh = buildSnake();
  mesh.position.set(x, 0, 0);
  mesh.rotation.y = lane.dir > 0 ? 0 : Math.PI; // mirar en su sentido
  lane.group.add(mesh);
  const car = { mesh, lane, halfWidth: 0.55, snake: true, phase: Math.random() * 6 };
  lane.cars.push(car);
  activeVehicles.push(car);
  return car;
}

// ----------------------------------------------------------------------------
//  NIVEL 6 — CIRCO / FERIA
//  Pista de serrín cálida (filas seguras) con guirnaldas, carpas y globos;
//  carriles de coches de choque, tiovivos giratorios y cañones de feria.
// ----------------------------------------------------------------------------
const matCircusL = new THREE.MeshStandardMaterial({ color: COLORS.circusLight, roughness: 0.95 });
const matCircusD = new THREE.MeshStandardMaterial({ color: COLORS.circusDark, roughness: 0.95 });
const matBumperFloor = new THREE.MeshStandardMaterial({ color: COLORS.bumperFloor, roughness: 0.4, metalness: 0.3 });
const matCarouselPit = new THREE.MeshStandardMaterial({ color: COLORS.carouselPit, roughness: 0.6, metalness: 0.2, emissive: 0x0a0414, emissiveIntensity: 0.2 });
const matCannonFloor = new THREE.MeshStandardMaterial({ color: COLORS.cannonFloor, roughness: 0.9 });

// Guirnalda de banderines (decoración festiva colgada sobre la pista).
function buildBunting() {
  const g = new THREE.Group();
  const span = COLS * 2;
  // Cuerda.
  const cord = new THREE.Mesh(
    new THREE.BoxGeometry(span, 0.03, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x4a3a2a })
  );
  cord.position.y = 2.0;
  // Arquear ligeramente la cuerda hacia abajo en el centro queda costoso;
  // la dejamos recta a buena altura para que enmarque la escena.
  g.add(cord);
  // Banderines triangulares alternando colores.
  for (let x = -COLS + 0.5; x <= COLS - 0.5; x += 0.8) {
    const color = CIRCUS_PALETTE[Math.floor(Math.random() * CIRCUS_PALETTE.length)];
    const flag = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.26, 4),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.6 })
    );
    flag.position.set(x, 1.85, 0);
    flag.rotation.x = Math.PI; // punta hacia abajo
    g.add(flag);
  }
  return g;
}

// Paleta viva y festiva para coches de choque, globos y carruseles.
const CIRCUS_PALETTE = [0xff2b4d, 0x00f0ff, 0xff2bd6, 0xffe600, 0x7c4dff, 0x00ff9d, 0xff7a1e];

// Carpa de circo (big-top) decorativa con techo rayado (bloquea la casilla).
function buildTent(col) {
  const g = new THREE.Group();
  const stripeColor = CIRCUS_PALETTE[Math.floor(Math.random() * CIRCUS_PALETTE.length)];
  // Pared cilíndrica blanca de la carpa.
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.46, 0.5, 14),
    new THREE.MeshStandardMaterial({ color: 0xfff3e6, roughness: 0.85 })
  );
  base.position.y = 0.25; base.castShadow = true; g.add(base);
  // Techo cónico a gajos (rayas blancas y de color).
  const segs = 8;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const c = i % 2 === 0 ? stripeColor : 0xfff3e6;
    const wedge = new THREE.Mesh(
      new THREE.ConeGeometry(0.56, 0.62, 4, 1, true, a0, (Math.PI * 2) / segs),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: c, emissiveIntensity: 0.12, side: THREE.DoubleSide })
    );
    wedge.position.y = 0.8; wedge.castShadow = true; g.add(wedge);
  }
  // Puerta de entrada (arco oscuro).
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.28, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x3a2a44, roughness: 0.8 })
  );
  door.position.set(0, 0.18, 0.46); g.add(door);
  // Mástil + banderín en la punta.
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.12, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xffe600, emissiveIntensity: 0.6 })
  );
  flag.position.set(0.09, 1.18, 0); g.add(flag);
  g.position.x = col * TILE;
  return g;
}

// Globo de feria flotante (decorativo, bloquea la casilla).
function buildBalloon(col) {
  const g = new THREE.Group();
  const color = CIRCUS_PALETTE[Math.floor(Math.random() * CIRCUS_PALETTE.length)];
  const balloon = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.3 })
  );
  balloon.position.y = 1.2; balloon.scale.y = 1.2; balloon.castShadow = true; g.add(balloon);
  const string = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6),
    new THREE.MeshStandardMaterial({ color: 0xdddddd })
  );
  string.position.y = 0.5; g.add(string);
  g.position.x = col * TILE;
  return g;
}

// Fila de pista de feria segura (equivalente a hierba): se camina normal.
function createCircusRow(row) {
  const group = new THREE.Group();
  const mat = row % 2 === 0 ? matCircusL : matCircusD;
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), mat);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);

  const blocked = new Set();

  if (row === LEVEL_GOAL) {
    group.add(buildFinishArch());
    group.position.copy(gridToWorld(0, row));
    scene.add(group);
    rows.set(row, { type: ROW_CIRCUS, group, blocked });
    return;
  }

  // Guirnalda de banderines colgada sobre algunas filas (enmarca la feria).
  if (row >= 2 && Math.random() < 0.4) group.add(buildBunting());

  // Decoración de carpas y globos (bloquean casillas como los árboles).
  const decoCount = Math.floor(Math.random() * 3);
  for (let i = 0; i < decoCount; i++) {
    const col = Math.round((Math.random() * 2 - 1) * COLS);
    if (col === 0 && row < 2) continue;
    if (blocked.has(col)) continue;
    blocked.add(col);
    group.add(Math.random() < 0.5 ? buildTent(col) : buildBalloon(col));
  }

  group.position.copy(gridToWorld(0, row));
  scene.add(group);
  const data = { type: ROW_CIRCUS, group, blocked };
  rows.set(row, data);
  maybeAddPowerup(row, data, blocked);
}

// Coche de choque: cuerpo redondo colorido con parachoques de goma y mástil.
function buildBumperCar(color) {
  const g = new THREE.Group();
  // Pintura de carrocería: metal pintado con brillo, casi sin "glow" (más realista).
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55, emissive: color, emissiveIntensity: 0.05 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.85, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1c24, roughness: 0.7 });

  // Plataforma/base baja que pega el coche al suelo (sin sensación de flotar).
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.54, 0.12, 18), dark);
  base.position.y = 0.06; base.receiveShadow = true; g.add(base);

  // Parachoques de goma: toro grueso alrededor de la base (lo típico del coche de choque).
  const bumper = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.13, 12, 24), rubber);
  bumper.rotation.x = Math.PI / 2; bumper.position.y = 0.16; bumper.castShadow = true; g.add(bumper);

  // Carrocería: cuerpo bajo y ancho con morro inclinado (lectura de "cochecito").
  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.26, 0.84), paint);
  hull.position.y = 0.34; hull.castShadow = true; g.add(hull);
  // Morro frontal inclinado.
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.3), paint);
  nose.position.set(0, 0.3, 0.42); nose.rotation.x = -0.45; g.add(nose);
  // Aletas/cola trasera elevada.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.18), paint);
  tail.position.set(0, 0.42, -0.4); g.add(tail);

  // Cabina hundida (hueco oscuro donde va el conductor).
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.4), dark);
  cockpit.position.set(0, 0.47, -0.02); g.add(cockpit);
  // Respaldo del asiento.
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.1), paint);
  seatBack.position.set(0, 0.56, -0.28); g.add(seatBack);

  // Volante: pequeño aro inclinado sobre una columna.
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), dark);
  column.position.set(0, 0.5, 0.18); column.rotation.x = 0.5; g.add(column);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 16), dark);
  wheel.position.set(0, 0.58, 0.24); wheel.rotation.x = 1.1; g.add(wheel);

  // Franja decorativa lateral (detalle de feria, sin pasarse de luz).
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.05, 0.86),
    new THREE.MeshStandardMaterial({ color: 0xfff4d6, roughness: 0.4, emissive: 0xfff4d6, emissiveIntensity: 0.15 }));
  stripe.position.y = 0.27; g.add(stripe);

  // Mástil con bola de contacto luminosa que roza el techo (icónico del coche de choque).
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6),
    new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.25 })
  );
  pole.position.set(0, 0.86, -0.32); g.add(pole);
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xffe600, emissiveIntensity: 1.0 })
  );
  knob.position.set(0, 1.18, -0.32); g.add(knob);
  return g;
}

// Fila de coches de choque (letal como una carretera).
function createBumperRow(row) {
  const group = new THREE.Group();
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), matBumperFloor);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);
  // Chispas/destellos de neón en el suelo pulido.
  for (let x = -COLS; x <= COLS; x += 2) {
    const spark = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.02, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.7 })
    );
    spark.position.set(x + (Math.random() - 0.5), 0.01, (Math.random() - 0.5) * 0.5);
    group.add(spark);
  }
  group.position.copy(gridToWorld(0, row));
  scene.add(group);

  const dir = Math.random() < 0.5 ? 1 : -1;
  // Más fácil: coches de choque más lentos y con más hueco entre ellos.
  const speed = 1.1 + Math.random() * 1.0;
  const gap = 4.4 + Math.random() * 1.8;
  const lane = { type: ROW_BUMPER, group, dir, speed, gap, row, cars: [] };
  rows.set(row, lane);

  let x = -FIELD_WIDTH / 2 + Math.random() * gap;
  while (x < FIELD_WIDTH / 2) {
    spawnBumperCar(lane, x);
    x += gap;
  }
}

function spawnBumperCar(lane, x) {
  const color = CIRCUS_PALETTE[Math.floor(Math.random() * CIRCUS_PALETTE.length)];
  const mesh = buildBumperCar(color);
  mesh.position.set(x, 0, 0);
  lane.group.add(mesh);
  const car = { mesh, lane, halfWidth: 0.62, bumper: true, phase: Math.random() * 6 };
  lane.cars.push(car);
  activeVehicles.push(car);
  return car;
}

// Caballito de tiovivo: cuerpo + cabeza + barra dorada (lectura clara de "carrusel").
function buildCarouselHorse(color) {
  const h = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.14), mat);
  body.position.y = 0.42; body.castShadow = true; h.add(body);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.12), mat);
  neck.position.set(0.14, 0.54, 0); neck.rotation.z = -0.4; h.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.1), mat);
  head.position.set(0.24, 0.62, 0); h.add(head);
  // Patas.
  const legMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  for (const dx of [-0.1, 0.1]) for (const dz of [-0.04, 0.04]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.05), legMat);
    leg.position.set(dx, 0.27, dz); h.add(leg);
  }
  // Barra dorada que lo sujeta al techo.
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6),
    new THREE.MeshStandardMaterial({ color: 0xffcf3a, metalness: 0.8, roughness: 0.3, emissive: 0x4a3a00, emissiveIntensity: 0.3 })
  );
  bar.position.set(0, 0.72, 0); h.add(bar);
  return h;
}

// Tiovivo / carrusel: plataforma circular giratoria con caballitos y carpa
// rayada. Funciona como una plataforma móvil (te lleva, como un tronco).
function buildCarousel() {
  const g = new THREE.Group();
  const len = 1.9;
  const r = len / 2;
  // Plataforma de madera.
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.2, 20),
    new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.8 })
  );
  disc.position.y = 0.05; disc.receiveShadow = true; g.add(disc);
  // Borde dorado con bombillas de feria (puntos luminosos alrededor).
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(r, 0.07, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xffcf3a, metalness: 0.7, roughness: 0.3, emissive: 0x6a5210, emissiveIntensity: 0.4 })
  );
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.16; g.add(rim);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0b0, emissiveIntensity: 1.2 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), bulbMat);
    bulb.position.set(Math.cos(a) * r, 0.16, Math.sin(a) * r); g.add(bulb);
  }
  // Poste central rayado.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 1.0, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe0c0, roughness: 0.5 })
  );
  pole.position.y = 0.62; g.add(pole);
  // Caballitos repartidos alrededor del poste.
  const horseColors = [0xff2b4d, 0x00f0ff, 0xffe600, 0x7c4dff];
  const nHorses = 3;
  for (let i = 0; i < nHorses; i++) {
    const a = (i / nHorses) * Math.PI * 2;
    const horse = buildCarouselHorse(horseColors[i % horseColors.length]);
    horse.position.set(Math.cos(a) * (r * 0.62), 0, Math.sin(a) * (r * 0.62));
    horse.rotation.y = -a + Math.PI / 2; // mirar tangente (como girando)
    g.add(horse);
  }
  // Carpa cónica rayada (roja con gajos crema) sobre los caballitos.
  const roofR = r * 0.95;
  const segs = 8;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const wedgeColor = i % 2 === 0 ? 0xe23b4d : 0xfff0e0;
    const wedge = new THREE.Mesh(
      new THREE.ConeGeometry(roofR, 0.5, 4, 1, true, a0, (Math.PI * 2) / segs),
      new THREE.MeshStandardMaterial({ color: wedgeColor, roughness: 0.6, emissive: wedgeColor, emissiveIntensity: 0.12, side: THREE.DoubleSide })
    );
    wedge.position.y = 1.32; g.add(wedge);
  }
  // Faldón ondulado bajo la carpa (puntos crema).
  const valMat = new THREE.MeshStandardMaterial({ color: 0xfff0e0, roughness: 0.7 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.04), valMat);
    tab.position.set(Math.cos(a) * roofR, 1.06, Math.sin(a) * roofR);
    tab.rotation.y = -a; g.add(tab);
  }
  // Banderín en la cúspide.
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.1, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.7 })
  );
  flag.position.set(0.09, 1.62, 0); g.add(flag);
  g.userData.len = len;
  return g;
}

// Fila de carruseles: hueco "prohibido" (te caes si no vas sobre la plataforma).
function createCarouselRow(row) {
  const group = new THREE.Group();
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), matCarouselPit);
  tile.position.set(0, -0.25, 0);
  tile.receiveShadow = true;
  group.add(tile);
  group.position.copy(gridToWorld(0, row));
  scene.add(group);

  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = 1.2 + Math.random() * 1.2;
  const gap = 3.0 + Math.random() * 1.2;
  const lane = { type: ROW_CAROUSEL, group, dir, speed, gap, row, cars: [] };
  rows.set(row, lane);

  let x = -FIELD_WIDTH / 2 + Math.random() * gap;
  while (x < FIELD_WIDTH / 2) {
    spawnCarousel(lane, x);
    x += gap;
  }
}

function spawnCarousel(lane, x) {
  const mesh = buildCarousel();
  mesh.position.set(x, 0.02, 0);
  lane.group.add(mesh);
  const obj = { mesh, lane, halfWidth: mesh.userData.len / 2, isLog: true, spin: true };
  lane.cars.push(obj);
  activeVehicles.push(obj);
  return obj;
}

// Cañón decorativo en el borde del carril (apunta hacia la pista).
function buildCannon(facing) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x33343a, metalness: 0.7, roughness: 0.4 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.9, 12), mat);
  barrel.rotation.z = Math.PI / 2; barrel.position.y = 0.5; g.add(barrel);
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12),
    new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8 })
  );
  wheel.rotation.x = Math.PI / 2; wheel.position.y = 0.3; g.add(wheel);
  g.rotation.y = facing < 0 ? Math.PI : 0;
  return g;
}

// Bala de cañón: esfera pesada que cruza rodando (letal como un coche).
function buildCannonball() {
  const g = new THREE.Group();
  const r = 0.34;
  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(r, 0),
    new THREE.MeshStandardMaterial({ color: 0x222228, metalness: 0.6, roughness: 0.4, emissive: 0x551100, emissiveIntensity: 0.3, flatShading: true })
  );
  ball.castShadow = true; g.add(ball);
  g.userData.radius = r;
  return g;
}

// Fila de cañones: bolas pesadas y rápidas cruzando (letal).
function createCannonRow(row) {
  const group = new THREE.Group();
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), matCannonFloor);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);

  const dir = Math.random() < 0.5 ? 1 : -1;
  // El cañón se coloca en el lado de donde salen las bolas.
  const cannon = buildCannon(dir);
  cannon.position.set(dir > 0 ? -(COLS + 1) : (COLS + 1), 0, 0);
  group.add(cannon);

  group.position.copy(gridToWorld(0, row));
  scene.add(group);

  // Más fácil: bolas de cañón más lentas y más separadas.
  const speed = 2.4 + Math.random() * 1.4;
  const gap = 5.8 + Math.random() * 2.4;
  const lane = { type: ROW_CANNON, group, dir, speed, gap, row, cars: [] };
  rows.set(row, lane);

  let x = -FIELD_WIDTH / 2 + Math.random() * gap;
  while (x < FIELD_WIDTH / 2) {
    spawnCannonball(lane, x);
    x += gap;
  }
}

function spawnCannonball(lane, x) {
  const mesh = buildCannonball();
  mesh.position.set(x, mesh.userData.radius, 0);
  lane.group.add(mesh);
  const car = { mesh, lane, halfWidth: mesh.userData.radius + 0.05, roll: true, radius: mesh.userData.radius };
  lane.cars.push(car);
  activeVehicles.push(car);
  return car;
}

// ----------------------------------------------------------------------------
//  NIVEL 5 — APOCALIPSIS ZOMBIE
//  Hierba podrida con zombis que persiguen al pollo y plantas carnívoras
//  ocultas que emergen al pisarlas; carriles letales con helicópteros
//  zombificados y trenes que cruzan de golpe (con aviso). Todo se integra con
//  los sistemas existentes de colisión, muerte y puntuación.
// ----------------------------------------------------------------------------

// Materiales reutilizables del nivel 7.
const matZGrassL = new THREE.MeshStandardMaterial({ color: COLORS.zgrassLight, roughness: 1 });
const matZGrassD = new THREE.MeshStandardMaterial({ color: COLORS.zgrassDark, roughness: 1 });
const matZHeliFloor = new THREE.MeshStandardMaterial({ color: COLORS.zheliFloor, roughness: 0.95 });
const matZTrainFloor = new THREE.MeshStandardMaterial({ color: COLORS.ztrainFloor, roughness: 1 });
const matZombie = new THREE.MeshStandardMaterial({ color: COLORS.zombie, roughness: 0.9 });
const matZombieDark = new THREE.MeshStandardMaterial({ color: COLORS.zombieDark, roughness: 0.9 });
const matBrain = new THREE.MeshStandardMaterial({ color: COLORS.brain, roughness: 0.7, emissive: 0x5a1f33, emissiveIntensity: 0.25 });
const matRot = new THREE.MeshStandardMaterial({ color: COLORS.rot, roughness: 0.95, metalness: 0.1, emissive: 0x16240c, emissiveIntensity: 0.2 });
const matRotDark = new THREE.MeshStandardMaterial({ color: COLORS.rotDark, roughness: 1 });
const matSickWin = new THREE.MeshStandardMaterial({ color: 0xaaff66, emissive: 0x6fdd2a, emissiveIntensity: 1.0 });

// Lista global de zombis activos (no van en lane.cars porque persiguen al pollo
// en el mundo, no se limitan a moverse lateralmente). Se limpian por fila.
const zombies = [];

// --- Zombi voxel con cerebro expuesto ---
function buildZombie() {
  const g = new THREE.Group();
  // Cuerpo.
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.34), matZombie);
  body.position.y = 0.5;
  body.castShadow = true;
  g.add(body);
  // Camisa rasgada (banda más oscura).
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.26, 0.36), matZombieDark);
  shirt.position.y = 0.42;
  g.add(shirt);
  // Cabeza.
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.4), matZombie);
  head.position.y = 1.0;
  head.castShadow = true;
  g.add(head);
  // Cerebro rosado expuesto encima de la cabeza.
  const brain = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.34), matBrain);
  brain.position.y = 1.27;
  g.add(brain);
  const brain2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), matBrain);
  brain2.position.set(0.08, 0.38, 0.05);
  brain.add(brain2);
  // Ojos brillantes huecos.
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xffcc00, emissiveIntensity: 1.1 });
  for (const dx of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.06), eyeMat);
    eye.position.set(dx, 1.02, 0.2);
    g.add(eye);
  }
  // Brazos extendidos hacia delante (pose de zombi).
  const arms = [];
  for (const dx of [-0.34, 0.34]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), matZombie);
    arm.position.set(dx, 0.6, 0.28);
    arm.castShadow = true;
    g.add(arm);
    arms.push(arm);
  }
  // Piernas.
  const legs = [];
  for (const dx of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.18), matZombieDark);
    leg.position.set(dx, 0.2, 0);
    g.add(leg);
    legs.push(leg);
  }
  g.userData = { arms, legs, head };
  return g;
}

// --- Planta carnívora oculta (emerge del suelo) ---
function buildPlant() {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a6b2a, roughness: 0.9 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x8a1f3a, roughness: 0.7, emissive: 0x3a0a18, emissiveIntensity: 0.3 });
  // Tallo.
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), stemMat);
  stem.position.y = 0.35;
  g.add(stem);
  // Cabeza/boca (mandíbula superior e inferior).
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.5), headMat);
  upper.position.y = 0.85;
  g.add(upper);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.5), headMat);
  lower.position.y = 0.6;
  g.add(lower);
  // Dientes.
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xfff0e0 });
  for (let i = -2; i <= 2; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), toothMat);
    t.position.set(i * 0.12, 0.73, 0.24);
    g.add(t);
  }
  g.userData = { upper, lower };
  // Empieza oculta bajo el suelo (la animación de emerger sube el grupo).
  g.position.y = -1.2;
  g.visible = false;
  return g;
}

// --- Helicóptero zombificado (cruza un carril letal, va elevado) ---
function buildZHeli() {
  const g = new THREE.Group();
  // Fuselaje.
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.6), matRot);
  body.position.y = 0.1;
  body.castShadow = true;
  g.add(body);
  // Cabina con cristal enfermizo.
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.36, 0.5), matSickWin);
  cockpit.position.set(0.5, 0.12, 0);
  g.add(cockpit);
  // Cola.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.18), matRotDark);
  tail.position.set(-0.85, 0.18, 0);
  g.add(tail);
  // Rotor de cola.
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.08), matRotDark);
  tailRotor.position.set(-1.28, 0.18, 0);
  g.add(tailRotor);
  // Mástil + rotor principal giratorio.
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), matRotDark);
  mast.position.y = 0.45;
  g.add(mast);
  const rotor = new THREE.Group();
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.16), matRotDark);
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 2.2), matRotDark);
  rotor.add(blade1, blade2);
  rotor.position.y = 0.56;
  g.add(rotor);
  // Patines.
  for (const dz of [-0.3, 0.3]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), matRotDark);
    skid.position.set(0, -0.22, dz);
    g.add(skid);
  }
  g.userData = { rotor };
  return g;
}

// --- Tren zombificado (locomotora + vagones, largo y letal) ---
function buildZTrain(dir) {
  const g = new THREE.Group();
  const carLen = 1.9;
  const positions = [0, -carLen - 0.12, -2 * (carLen + 0.12)];
  positions.forEach((x, idx) => {
    const isLoco = idx === 0;
    const wagon = new THREE.Mesh(
      new THREE.BoxGeometry(carLen, 0.85, 0.78),
      idx % 2 === 0 ? matRot : matRotDark
    );
    wagon.position.set(x, 0.5, 0);
    wagon.castShadow = true;
    g.add(wagon);
    // Techo.
    const roof = new THREE.Mesh(new THREE.BoxGeometry(carLen * 0.9, 0.16, 0.7), matRotDark);
    roof.position.set(x, 0.98, 0);
    g.add(roof);
    // Ventanas enfermizas.
    for (const wx of [-0.5, 0, 0.5]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.02), matSickWin);
      win.position.set(x + wx, 0.6, 0.4);
      g.add(win);
      const win2 = win.clone();
      win2.position.z = -0.4;
      g.add(win2);
    }
    if (isLoco) {
      // Foco delantero de la locomotora (mira según el sentido).
      const front = dir > 0 ? carLen / 2 : -carLen / 2;
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xffdd66, emissive: 0xffbb22, emissiveIntensity: 1.3 }));
      lamp.position.set(front, 0.5, 0);
      g.add(lamp);
      // Chimenea.
      const stack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), matRotDark);
      stack.position.set(front * 0.6, 1.2, 0);
      g.add(stack);
    }
  });
  // halfWidth aproximado del conjunto (3 vagones).
  g.userData = { halfWidth: (3 * carLen + 2 * 0.12) / 2 };
  return g;
}

// --- Fila de hierba podrida: zombis + plantas carnívoras ocultas ---
function createZGrassRow(row) {
  const group = new THREE.Group();
  const mat = row % 2 === 0 ? matZGrassL : matZGrassD;
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), mat);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);

  const blocked = new Set();

  if (row === LEVEL_GOAL) {
    group.add(buildFinishArch());
    group.position.copy(gridToWorld(0, row));
    scene.add(group);
    rows.set(row, { type: ROW_ZGRASS, group, blocked });
    return;
  }

  // Lápidas/árboles muertos decorativos que además bloquean casillas.
  const decoCount = Math.floor(Math.random() * 3);
  for (let i = 0; i < decoCount; i++) {
    const col = Math.round((Math.random() * 2 - 1) * COLS);
    if (col === 0 && row < 2) continue;
    if (blocked.has(col)) continue;
    blocked.add(col);
    group.add(buildTombstone(col));
  }

  const data = { type: ROW_ZGRASS, group, blocked, plants: [] };

  // Las filas de arranque y de meta no llevan peligros (justo).
  const hazardous = row >= 3 && row < LEVEL_GOAL;

  // Plantas carnívoras ocultas: nunca bloquean toda la fila (dejamos huecos).
  if (hazardous && Math.random() < 0.7) {
    const plantCount = 1 + Math.floor(Math.random() * 2); // 1-2 por fila
    for (let i = 0; i < plantCount; i++) {
      const col = Math.round((Math.random() * 2 - 1) * (COLS - 1));
      if (blocked.has(col)) continue;
      if (data.plants.some((p) => p.col === col)) continue;
      const plant = buildPlant();
      plant.position.x = col * TILE;
      group.add(plant);
      data.plants.push({ col, mesh: plant, state: "hidden", t: 0 });
      // Pista sutil en el suelo: una mancha apenas visible.
      const hint = new THREE.Mesh(
        new THREE.CircleGeometry(0.28, 12),
        new THREE.MeshBasicMaterial({ color: 0x2a1a12, transparent: true, opacity: 0.35 })
      );
      hint.rotation.x = -Math.PI / 2;
      hint.position.set(col * TILE, 0.005, 0);
      group.add(hint);
    }
  }

  group.position.copy(gridToWorld(0, row));
  scene.add(group);
  rows.set(row, data);

  // Zombis perseguidores (se añaden a la escena, no al grupo de la fila).
  if (hazardous && Math.random() < 0.6) {
    const zCount = 1 + Math.floor(Math.random() * 2); // 1-2 zombis
    for (let i = 0; i < zCount; i++) {
      const mesh = buildZombie();
      const startCol = Math.round((Math.random() * 2 - 1) * COLS);
      const wp = gridToWorld(startCol, row);
      mesh.position.set(wp.x, 0, wp.z);
      scene.add(mesh);
      zombies.push({
        mesh, row, homeZ: wp.z,
        speed: 1.25 + Math.random() * 0.45,   // más lento que el pollo saltando
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  maybeAddPowerup(row, data, blocked);
}

// Lápida voxel (bloquea la casilla como un árbol).
function buildTombstone(col) {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 1 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.18), stoneMat);
  base.position.y = 0.45;
  base.castShadow = true;
  g.add(base);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.18), stoneMat);
  top.position.y = 0.85;
  g.add(top);
  // Cruz tenue.
  const crossMat = new THREE.MeshStandardMaterial({ color: 0x4a4a50 });
  const cv = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.02), crossMat);
  cv.position.set(0, 0.5, 0.1);
  g.add(cv);
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.02), crossMat);
  ch.position.set(0, 0.55, 0.1);
  g.add(ch);
  g.position.x = col * TILE;
  g.rotation.z = (Math.random() - 0.5) * 0.2; // ligeramente torcida
  return g;
}

// --- Fila de helicópteros zombificados (letal, elevada) ---
function createZHeliRow(row) {
  const group = new THREE.Group();
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), matZHeliFloor);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);
  // Grietas luminosas verdosas.
  for (let x = -COLS; x <= COLS; x += 2.4) {
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.02, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x3a5a22, emissive: 0x2a4a14, emissiveIntensity: 0.6 })
    );
    crack.position.set(x + (Math.random() - 0.5), 0.01, (Math.random() - 0.5) * 0.4);
    group.add(crack);
  }
  group.position.copy(gridToWorld(0, row));
  scene.add(group);

  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = 2.8 + Math.random() * 1.8;
  const gap = 5.5 + Math.random() * 2.5;
  const lane = { type: ROW_ZHELI, group, dir, speed, gap, row, cars: [] };
  rows.set(row, lane);

  let x = -FIELD_WIDTH / 2 + Math.random() * gap;
  while (x < FIELD_WIDTH / 2) {
    spawnZHeli(lane, x);
    x += gap;
  }
}

function spawnZHeli(lane, x) {
  const mesh = buildZHeli();
  mesh.position.set(x, 0.95, 0); // vuela elevado
  mesh.rotation.y = lane.dir > 0 ? 0 : Math.PI;
  lane.group.add(mesh);
  const car = { mesh, lane, halfWidth: 0.95, heli: true, lastDx: Infinity, nearDone: false };
  lane.cars.push(car);
  activeVehicles.push(car);
  return car;
}

// --- Fila de tren zombi (cruza de golpe con aviso) ---
function createZTrainRow(row) {
  const group = new THREE.Group();
  const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), matZTrainFloor);
  tile.position.set(0, -0.2, 0);
  tile.receiveShadow = true;
  group.add(tile);

  // Vías (dos raíles oxidados a lo largo de la fila).
  const railMat = new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.6, metalness: 0.3 });
  for (const dz of [-0.28, 0.28]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.06, 0.08), railMat);
    rail.position.set(0, 0.03, dz);
    group.add(rail);
  }
  // Traviesas.
  for (let x = -COLS; x <= COLS; x += 1) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 1 }));
    tie.position.set(x, 0.02, 0);
    group.add(tie);
  }
  // Aviso: franja roja que parpadea justo antes de que llegue el tren.
  const warnGlow = new THREE.Mesh(
    new THREE.BoxGeometry(FIELD_WIDTH, 0.02, TILE),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0 })
  );
  warnGlow.position.set(0, 0.04, 0);
  group.add(warnGlow);

  group.position.copy(gridToWorld(0, row));
  scene.add(group);

  const dir = Math.random() < 0.5 ? 1 : -1;
  const lane = {
    type: ROW_ZTRAIN, group, dir, row, cars: [],
    speed: 13 + Math.random() * 4,    // muy rápido
    train: null,                       // mesh del tren cuando está cruzando
    trainHalf: 0,
    state: "idle",                     // idle -> warn -> cross
    nextAt: performance.now() / 1000 + 2.5 + Math.random() * 4,
    warnUntil: 0,
    warnGlow,
  };
  rows.set(row, lane);
}

// Actualiza todas las filas de tren: temporización, aviso y cruce.
function updateTrains(dt, now) {
  for (const lane of rows.values()) {
    if (!lane || lane.type !== ROW_ZTRAIN) continue;
    const limit = FIELD_WIDTH / 2 + 4;

    if (lane.state === "idle") {
      if (now >= lane.nextAt) {
        lane.state = "warn";
        lane.warnUntil = now + 1.1;     // aviso de ~1.1 s
        sfxTrainWarn();
      }
    } else if (lane.state === "warn") {
      // Parpadeo del aviso.
      const blink = (Math.sin(now * 22) * 0.5 + 0.5) * 0.55;
      if (lane.warnGlow) lane.warnGlow.material.opacity = blink;
      if (now >= lane.warnUntil) {
        // Lanzar el tren desde el lado correspondiente.
        lane.state = "cross";
        const train = buildZTrain(lane.dir);
        lane.trainHalf = train.userData.halfWidth;
        const startX = lane.dir > 0 ? -limit - lane.trainHalf : limit + lane.trainHalf;
        train.position.set(startX, 0, 0);
        train.rotation.y = lane.dir > 0 ? 0 : Math.PI;
        lane.group.add(train);
        lane.train = train;
        if (lane.warnGlow) lane.warnGlow.material.opacity = 0;
        sfxTrain();
      }
    } else if (lane.state === "cross" && lane.train) {
      lane.train.position.x += lane.dir * lane.speed * dt;
      // Polvo bajo el tren.
      if (Math.random() < 0.4) {
        const wx = lane.train.position.x;
        spawnParticles(wx + lane.group.position.x, 0.1, lane.group.position.z, 0x5a5040, 2,
          { speed: 1.5, up: 1.0, life: 0.4 });
      }
      // ¿Ha salido por el otro lado? Reciclar y reprogramar.
      const out = lane.dir > 0 ? lane.train.position.x - lane.trainHalf > limit
                               : lane.train.position.x + lane.trainHalf < -limit;
      if (out) {
        lane.group.remove(lane.train);
        lane.train.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        lane.train = null;
        lane.state = "idle";
        lane.nextAt = now + 4 + Math.random() * 5;
      }
    }
  }
}

// Colisión con el tren (se comprueba aparte porque no va en lane.cars).
function checkTrainCollision() {
  if (!playerState.alive) return;
  const lane = rows.get(playerState.row);
  if (!lane || lane.type !== ROW_ZTRAIN || !lane.train) return;
  const now = performance.now() / 1000;
  const px = playerState.col * TILE;
  const dx = Math.abs(lane.train.position.x - px);
  if (dx < lane.trainHalf + 0.35) {
    if (invincibleActive(now)) return;
    if (power.shield) {
      power.shield = false;
      power.invincibleUntil = now + 1.2;
      updatePowerupHud(now);
      unlockAchievement("shieldsave");
      return;
    }
    die(false, "train");
  }
}

// Persecución de zombis: avanzan hacia el pollo (más lentos que él) y matan
// al tocarlo. Se mantienen cerca de su fila de origen para no amontonarse.
function updateZombies(dt, now) {
  if (!zombies.length) return;
  const slow = slowMoActive(now) || now < nearMissSlowUntil;
  const factor = slow ? 0.4 : 1;
  const px = player.position.x;
  const pz = player.position.z;
  // Disfraz de zombi: con la skin Zombi + la mascota Zombi equipadas, los zombis
  // te toman por uno de los suyos y no te persiguen ni te atacan.
  // Además, el Pollo Divino es DEMASIADO poderoso: los zombis no se le acercan.
  const disguised = (equippedSkin === "zombie" && equippedPet === "zombi")
    || equippedSkin === "cosmico";
  for (const z of zombies) {
    const m = z.mesh;
    if (disguised) {
      // Vagabundean perezosamente cerca de su fila y miran de un lado a otro.
      m.position.z += (z.homeZ - m.position.z) * Math.min(1, dt * 1.5);
      m.rotation.y = Math.sin(now * 0.5 + z.phase) * 1.2;
      const wobD = Math.sin(now * 3 + z.phase);
      m.position.y = Math.abs(wobD) * 0.04;
      if (m.userData.arms) {
        m.userData.arms[0].position.y = 0.6 + wobD * 0.03;
        m.userData.arms[1].position.y = 0.6 - wobD * 0.03;
      }
      continue; // ni persiguen ni matan
    }
    // Moverse hacia el pollo en X siempre; en Z solo cerca de su fila.
    const dxw = px - m.position.x;
    const dzw = pz - m.position.z;
    const dist = Math.hypot(dxw, dzw) || 1;
    const step = z.speed * factor * dt;
    m.position.x += (dxw / dist) * step;
    // Limitar el vagabundeo en Z a ±1.6 casillas de su fila de origen.
    const targetZ = z.homeZ + Math.max(-1.6, Math.min(1.6, pz - z.homeZ));
    m.position.z += (targetZ - m.position.z) * Math.min(1, dt * 2.5);
    // Mirar hacia el pollo.
    m.rotation.y = Math.atan2(dxw, dzw);
    // Gruñido ocasional cuando el zombi está cerca del pollo.
    if (dist < 4 && now > (z.growlAt || 0)) {
      z.growlAt = now + 1.6 + Math.random() * 2.5;
      if (Math.random() < 0.6) sfxZombie();
    }
    // Bamboleo de caminar zombi.
    const wob = Math.sin(now * 6 + z.phase);
    m.position.y = Math.abs(wob) * 0.06;
    if (m.userData.arms) {
      m.userData.arms[0].position.y = 0.6 + wob * 0.05;
      m.userData.arms[1].position.y = 0.6 - wob * 0.05;
    }
    // Colisión: si alcanza al pollo, muere (salvo invencible/escudo).
    if (playerState.alive && !playerState.moving) {
      const cdx = Math.abs(px - m.position.x);
      const cdz = Math.abs(pz - m.position.z);
      if (cdx < 0.55 && cdz < 0.6) {
        if (invincibleActive(now)) continue;
        if (power.shield) {
          power.shield = false;
          power.invincibleUntil = now + 1.2;
          updatePowerupHud(now);
          unlockAchievement("shieldsave");
          continue;
        }
        spawnParticles(px, 0.6, pz, COLORS.zombie, 16, { speed: 3, up: 2.5, life: 0.6 });
        die(false, "zombie");
      }
    }
  }
}

// Plantas carnívoras: emergen al pisar su casilla y atrapan al pollo.
function updatePlants(dt, now) {
  const lane = rows.get(playerState.row);
  if (lane && lane.type === ROW_ZGRASS && lane.plants && lane.plants.length) {
    for (const p of lane.plants) {
      if (p.state === "hidden" && !playerState.moving && playerState.alive
          && playerState.col === p.col) {
        // El pollo ha pisado la casilla: la planta emerge.
        p.state = "rising";
        p.t = 0;
        p.mesh.visible = true;
        sfxPlant();
      }
    }
  }
  // Animar todas las plantas en curso (de cualquier fila visible).
  for (const [, data] of rows) {
    if (data.type !== ROW_ZGRASS || !data.plants) continue;
    for (const p of data.plants) {
      if (p.state === "rising") {
        p.t += dt;
        const k = Math.min(1, p.t / 0.2);
        // Salto: emerge de golpe con un rebote por encima del suelo y se asienta.
        const ease = 1 - Math.pow(1 - k, 2);          // easeOut
        const overshoot = Math.sin(k * Math.PI) * 0.4; // brinco que sube y baja
        p.mesh.position.y = -1.2 + ease * 1.2 + overshoot;
        if (k >= 1) {
          // ¿Pilla al pollo en la casilla? Entonces se lo come.
          if (data === rows.get(playerState.row) && playerState.col === p.col
              && playerState.alive && !playerState.moving) {
            if (invincibleActive(now)) { p.state = "open"; p.t = 0; }
            else if (power.shield) {
              power.shield = false; power.invincibleUntil = now + 1.2;
              updatePowerupHud(now); unlockAchievement("shieldsave");
              p.state = "open"; p.t = 0;
            } else {
              // ¡La planta se abalanza y se come al pollo!
              p.state = "eating";
              startPlantEat(p);
            }
          } else {
            p.state = "open";
            p.t = 0;
          }
        }
      } else if (p.state === "open") {
        // Mandíbula que "mastica" un instante y luego se queda abierta.
        const chomp = Math.abs(Math.sin(now * 10)) * 0.12;
        if (p.mesh.userData.upper) p.mesh.userData.upper.position.y = 0.85 + chomp;
        if (p.mesh.userData.lower) p.mesh.userData.lower.position.y = 0.6 - chomp;
      }
    }
  }
}

// Limpia los zombis pertenecientes a una fila que se va a borrar.
function removeZombiesForRow(row) {
  for (let i = zombies.length - 1; i >= 0; i--) {
    if (zombies[i].row === row) {
      const m = zombies[i].mesh;
      scene.remove(m);
      m.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      zombies.splice(i, 1);
    }
  }
}

// ----------------------------------------------------------------------------
//  NIVEL 7 — MONSTRUOS DE LAVA (perseguidores que EMERGEN de la lava)
//  Funcionan igual que los zombis del nivel 5 pero con temática de lava: brotan
//  del suelo con una llamarada, persiguen al pollo por las filas de hierba y lo
//  achicharran al tocarlo. Viven en la escena (no en lane.cars) y se limpian por
//  fila, igual que los zombis.
// ----------------------------------------------------------------------------
const lavaMonsters = [];

// Materiales compartidos: roca oscura + grietas/ojos de lava incandescente.
const matRockDark = new THREE.MeshStandardMaterial({ color: 0x2e211c, roughness: 1 });
const matRockMid  = new THREE.MeshStandardMaterial({ color: 0x40291f, roughness: 1 });
const matLavaGlow = new THREE.MeshStandardMaterial({ color: 0xff5a14, emissive: 0xff4400, emissiveIntensity: 1.1, roughness: 0.5 });
const matLavaEye  = new THREE.MeshStandardMaterial({ color: 0xffe070, emissive: 0xffc020, emissiveIntensity: 1.4 });

// Colores vivos para los monstruos DECORATIVOS (quietos e inofensivos), así se
// distinguen a simple vista de los 4 LETALES (que brillan al rojo vivo y persiguen).
const DECO_LAVA_COLORS = [0x3ad1ff, 0x8a5cff, 0x35d07f, 0xff5ab0, 0xffd23a];

// --- Monstruo de lava voxel: roca oscura con grietas y ojos incandescentes ---
// deadly=true → letal (brilla intenso). deadly=false → decoración (lava apagada).
function buildLavaMonster(deadly) {
  const g = new THREE.Group();
  // Cuerpo principal: bloque de roca robusto.
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.66, 0.42), matRockDark);
  body.position.y = 0.5; body.castShadow = true; g.add(body);
  // Grietas de lava brillante en el cuerpo (vetas verticales). Cada una con su
  // material clonado para poder pulsar el brillo individualmente.
  const glow = [];
  for (const dx of [-0.18, 0.04, 0.2]) {
    const cm = matLavaGlow.clone();
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.02), cm);
    crack.position.set(dx, 0.5, 0.22);
    g.add(crack); glow.push(cm);
  }
  // Cabeza rocosa.
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.46, 0.46), matRockMid);
  head.position.y = 1.04; head.castShadow = true; g.add(head);
  // Costra superior irregular e incandescente (como en la referencia).
  for (const [lx, lz] of [[-0.16, 0], [0.14, -0.04], [0, 0.14], [0.2, 0.12]]) {
    const lm = matLavaGlow.clone();
    const lump = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), lm);
    lump.position.set(lx, 1.3 + Math.random() * 0.04, lz);
    g.add(lump); glow.push(lm);
  }
  // Ojos enfadados (cubos inclinados) y boca dentada brillante.
  for (const dx of [-0.12, 0.12]) {
    const em = matLavaEye.clone();
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.06), em);
    eye.position.set(dx, 1.08, 0.24); eye.rotation.z = dx < 0 ? -0.35 : 0.35;
    g.add(eye); glow.push(em);
  }
  const mm = matLavaEye.clone();
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), mm);
  mouth.position.set(0, 0.9, 0.24); g.add(mouth); glow.push(mm);
  for (const tx of [-0.08, 0.08]) { // "dientes" oscuros sobre la boca
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), matRockDark);
    tooth.position.set(tx, 0.9, 0.27); g.add(tooth);
  }
  // Brazos rocosos extendidos hacia delante (pose amenazante).
  const arms = [];
  for (const dx of [-0.42, 0.42]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.46), matRockMid);
    arm.position.set(dx, 0.62, 0.22); arm.castShadow = true;
    g.add(arm); arms.push(arm);
  }
  // Piernas cortas.
  for (const dx of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.2), matRockDark);
    leg.position.set(dx, 0.17, 0); g.add(leg);
  }
  // Si NO es letal, pintarlo de un color vivo y alegre (no rojo lava) para que
  // se note que es solo decoración: inofensivo y quieto.
  if (!deadly) {
    const c = DECO_LAVA_COLORS[(Math.random() * DECO_LAVA_COLORS.length) | 0];
    for (const mat of glow) { mat.color.setHex(c); mat.emissive.setHex(c); }
  }
  g.userData = { arms, glow, deadly };
  return g;
}

// Como máximo 4 monstruos LETALES vivos a la vez; el resto son decoración.
const MAX_DEADLY_LAVA = 4;

// Genera 1-2 monstruos que EMERGEN de la lava en una fila de hierba (nivel 7).
function spawnLavaMonstersForRow(row) {
  const count = 1 + (Math.random() < 0.35 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    // ¿Hay hueco para otro monstruo letal? Si ya hay 4, este es decorativo.
    let deadlyAlive = 0;
    for (const lm of lavaMonsters) if (lm.deadly) deadlyAlive++;
    const deadly = deadlyAlive < MAX_DEADLY_LAVA;

    const mesh = buildLavaMonster(deadly);
    const startCol = Math.round((Math.random() * 2 - 1) * COLS);
    const wp = gridToWorld(startCol, row);
    mesh.position.set(wp.x, -1.4, wp.z); // empieza enterrado: emergerá de la lava
    mesh.scale.set(0.6, 0.6, 0.6);
    scene.add(mesh);
    lavaMonsters.push({
      mesh, row, homeZ: wp.z, deadly,
      // Los letales persiguen MUY lentos (apenas se arrastran); los deco no se mueven.
      speed: deadly ? 0.45 + Math.random() * 0.25 : 0.45 + Math.random() * 0.25,
      phase: Math.random() * Math.PI * 2,
      emerging: true, emergeT: 0,
    });
    // Llamarada de aparición (más intensa para los letales).
    spawnParticles(wp.x, 0.1, wp.z, deadly ? 0xff4400 : 0xff7a1e, deadly ? 16 : 12, { speed: 3, up: 3.2, life: 0.7 });
  }
  sfxLavaRoar();
}

function removeLavaMonstersForRow(row) {
  for (let i = lavaMonsters.length - 1; i >= 0; i--) {
    if (lavaMonsters[i].row === row) {
      const m = lavaMonsters[i].mesh;
      scene.remove(m);
      m.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      lavaMonsters.splice(i, 1);
    }
  }
}

function clearLavaMonsters() {
  for (const z of lavaMonsters) {
    scene.remove(z.mesh);
    z.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  lavaMonsters.length = 0;
}

// Persecución de monstruos de lava: emergen, persiguen al pollo y lo asan al
// tocarlo (respetando invencible/escudo). Modelado sobre updateZombies.
function updateLavaMonsters(dt, now) {
  if (!lavaMonsters.length) return;
  const slow = slowMoActive(now) || now < nearMissSlowUntil;
  const factor = slow ? 0.4 : 1;
  const px = player.position.x;
  const pz = player.position.z;
  for (const z of lavaMonsters) {
    const m = z.mesh;
    // Pulso de brillo de la lava (grietas, ojos, costra). Los LETALES laten más
    // intenso (al rojo vivo); los decorativos, un brillo tenue de ascua apagada.
    const pulse = z.deadly
      ? 1.15 + Math.sin(now * 3.5 + z.phase) * 0.3
      : 0.85 + Math.sin(now * 2.5 + z.phase) * 0.2;   // decorativos: brillo de color estable
    if (m.userData.glow) for (const mat of m.userData.glow) mat.emissiveIntensity = pulse;
    // Fase de emerger: sube desde el suelo con chispas antes de empezar a perseguir.
    if (z.emerging) {
      z.emergeT += dt;
      const k = Math.min(1, z.emergeT / 0.7);
      m.position.y = -1.4 + 1.4 * k;
      const s = 0.6 + 0.4 * k;
      m.scale.set(s, s, s);
      m.rotation.y = Math.atan2(px - m.position.x, pz - m.position.z);
      if (Math.random() < 0.3) spawnParticles(m.position.x, 0.1, m.position.z, 0xff7a1e, 2, { speed: 2, up: 2.5, life: 0.5 });
      if (k >= 1) { z.emerging = false; m.position.y = 0; m.scale.set(1, 1, 1); }
      continue; // mientras emerge no persigue ni mata
    }
    // Decorativos: una vez fuera, se quedan QUIETOS (no persiguen ni se mueven).
    // Solo lucen su color como estatuas de lava. No hacen daño.
    if (!z.deadly) {
      m.position.y = 0;
      continue;
    }
    // Avanzar hacia el pollo en X siempre; en Z solo cerca de su fila.
    const dxw = px - m.position.x;
    const dzw = pz - m.position.z;
    const dist = Math.hypot(dxw, dzw) || 1;
    const step = z.speed * factor * dt;
    m.position.x += (dxw / dist) * step;
    // Persiguen muy despacio, sin alejarse mucho de su fila (±1.8).
    const reach = 1.8;
    const targetZ = z.homeZ + Math.max(-reach, Math.min(reach, pz - z.homeZ));
    m.position.z += (targetZ - m.position.z) * Math.min(1, dt * 1.2);
    m.rotation.y = Math.atan2(dxw, dzw);
    // Rugido ocasional cuando está cerca del pollo.
    if (dist < 4 && now > (z.roarAt || 0)) {
      z.roarAt = now + 1.8 + Math.random() * 2.5;
      if (Math.random() < 0.5) sfxLavaRoar();
    }
    // Bamboleo muy lento y pesado de caminar.
    const wob = Math.sin(now * 2.2 + z.phase);
    m.position.y = Math.abs(wob) * 0.035;
    if (m.userData.arms) {
      m.userData.arms[0].position.y = 0.62 + wob * 0.05;
      m.userData.arms[1].position.y = 0.62 - wob * 0.05;
    }
    // Colisión LETAL solo para los monstruos al rojo vivo (máximo 4). Los
    // decorativos (lava apagada) deambulan pero NO hacen daño.
    if (z.deadly && playerState.alive && !playerState.moving) {
      const cdx = Math.abs(px - m.position.x);
      const cdz = Math.abs(pz - m.position.z);
      if (cdx < 0.65 && cdz < 0.7) {
        if (invincibleActive(now)) continue;
        if (power.shield) {
          power.shield = false;
          power.invincibleUntil = now + 1.2;
          updatePowerupHud(now);
          unlockAchievement("shieldsave");
          continue;
        }
        spawnParticles(px, 0.6, pz, 0xff5a14, 18, { speed: 3, up: 2.5, life: 0.7 });
        die(true, "lavamonster"); // muerte ASADA (nivel 7)
      }
    }
  }
}

// ----------------------------------------------------------------------------
// 5. COCHES FUTURISTAS Y TRONCOS
// ----------------------------------------------------------------------------
// Coche deportivo "Ferrari del futuro" en estilo voxel low-poly con neón.
function buildFuturisticCar(color, flying) {
  const car = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({
    color, roughness: 0.35, metalness: 0.5,
    emissive: color, emissiveIntensity: 0.15,
  });
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0x10131a, roughness: 0.1, metalness: 0.8, emissive: 0x0a0f14,
  });
  const matNeon = new THREE.MeshStandardMaterial({
    color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 1.4,
  });

  // Chasis bajo y aerodinámico.
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.62), matBody);
  base.position.y = 0.28;
  base.castShadow = true;
  car.add(base);

  // Morro inclinado (caja más fina delante).
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.55), matBody);
  nose.position.set(0.78, 0.24, 0);
  car.add(nose);

  // Cabina / cristal.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.5), matGlass);
  cabin.position.set(-0.05, 0.46, 0);
  car.add(cabin);

  // Alerón trasero.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.6), matBody);
  wing.position.set(-0.72, 0.44, 0);
  car.add(wing);

  // Tira de neón inferior.
  const underglow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.66), matNeon);
  underglow.position.y = 0.15;
  car.add(underglow);

  // Faros delanteros (cian) y pilotos traseros (magenta).
  const headMat = new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: 0x9ff7ff, emissiveIntensity: 1.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2bd6, emissive: 0xff2bd6, emissiveIntensity: 1.2 });
  for (const dz of [-0.2, 0.2]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.12), headMat);
    hl.position.set(1.02, 0.28, dz);
    car.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.14), tailMat);
    tl.position.set(-0.84, 0.34, dz);
    car.add(tl);
  }

  if (flying) {
    // Los voladores no tienen ruedas: añadimos propulsores con estela brillante.
    const thrustMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 1.8 });
    for (const dz of [-0.22, 0.22]) {
      const th = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.12), thrustMat);
      th.position.set(-0.7, 0.18, dz);
      car.add(th);
    }
    const trail = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.06, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.35 })
    );
    trail.position.set(-1.2, 0.18, 0);
    car.add(trail);
  } else {
    // Ruedas voxel.
    const wMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    for (const dx of [0.5, -0.5]) {
      for (const dz of [-0.34, 0.34]) {
        const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.12), wMat);
        wheel.position.set(dx, 0.14, dz);
        car.add(wheel);
      }
    }
  }

  return car;
}

// ----------------------------------------------------------------------------
//  BLOQUE 6 — VARIEDAD DE VEHÍCULOS  (que el mundo se sienta vivo)
//  Varios modelos terrestres distintos + un coche "legendario" raro que da
//  puntos extra si lo esquivas pasando muy cerca (near-miss).
// ----------------------------------------------------------------------------

// Furgoneta: caja alta y achaparrada, con franja de neón y ruedas grandes.
function buildVan(color) {
  const car = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.4, emissive: color, emissiveIntensity: 0.12 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x10131a, roughness: 0.1, metalness: 0.8, emissive: 0x0a0f14 });
  const matNeon = new THREE.MeshStandardMaterial({ color: 0xff2bd6, emissive: 0xff2bd6, emissiveIntensity: 1.2 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.62, 0.7), matBody);
  body.position.y = 0.5; body.castShadow = true; car.add(body);
  // Cabina inclinada delante.
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.66), matBody);
  cab.position.set(0.82, 0.42, 0); car.add(cab);
  // Parabrisas.
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.6), matGlass);
  glass.position.set(1.02, 0.46, 0); car.add(glass);
  // Franja lateral de neón.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.72), matNeon);
  stripe.position.y = 0.34; car.add(stripe);
  // Faros / pilotos.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: 0x9ff7ff, emissiveIntensity: 1.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2bd6, emissive: 0xff2bd6, emissiveIntensity: 1.2 });
  for (const dz of [-0.22, 0.22]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.14), headMat); hl.position.set(1.06, 0.3, dz); car.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.16), tailMat); tl.position.set(-0.74, 0.4, dz); car.add(tl);
  }
  const wMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const dx of [0.5, -0.5]) for (const dz of [-0.36, 0.36]) {
    const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.14), wMat); wheel.position.set(dx, 0.16, dz); car.add(wheel);
  }
  return car;
}

// Camión: largo, con cabina y remolque de carga (el más grande y peligroso).
function buildTruck(color) {
  const car = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35, emissive: color, emissiveIntensity: 0.1 });
  const matCargo = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.6, metalness: 0.3, emissive: 0x101622, emissiveIntensity: 0.4 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x10131a, roughness: 0.1, metalness: 0.8, emissive: 0x0a0f14 });
  const matNeon = new THREE.MeshStandardMaterial({ color: 0x00ff9d, emissive: 0x00ff9d, emissiveIntensity: 1.3 });

  // Cabina delantera.
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), matBody);
  cab.position.set(0.95, 0.5, 0); cab.castShadow = true; car.add(cab);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.6), matGlass);
  glass.position.set(1.31, 0.52, 0); car.add(glass);
  // Remolque de carga.
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.74, 0.72), matCargo);
  cargo.position.set(-0.45, 0.56, 0); cargo.castShadow = true; car.add(cargo);
  // Tira de neón en el remolque.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.74), matNeon);
  stripe.position.set(-0.45, 0.34, 0); car.add(stripe);
  // Faros / pilotos.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: 0x9ff7ff, emissiveIntensity: 1.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2b4d, emissive: 0xff2b4d, emissiveIntensity: 1.2 });
  for (const dz of [-0.24, 0.24]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.14), headMat); hl.position.set(1.35, 0.34, dz); car.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.16), tailMat); tl.position.set(-1.2, 0.4, dz); car.add(tl);
  }
  const wMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const dx of [1.0, -0.1, -0.9]) for (const dz of [-0.38, 0.38]) {
    const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.14), wMat); wheel.position.set(dx, 0.17, dz); car.add(wheel);
  }
  return car;
}

// Buggy compacto: pequeño y redondeado, fácil de esquivar.
function buildBuggy(color) {
  const car = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5, emissive: color, emissiveIntensity: 0.2 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x10131a, roughness: 0.1, metalness: 0.8, emissive: 0x0a0f14 });
  const matNeon = new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xffe600, emissiveIntensity: 1.3 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.3, 0.6), matBody);
  body.position.y = 0.3; body.castShadow = true; car.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), matGlass);
  dome.position.set(-0.02, 0.46, 0); dome.scale.set(1, 0.7, 0.9); car.add(dome);
  const underglow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.64), matNeon);
  underglow.position.y = 0.18; car.add(underglow);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: 0x9ff7ff, emissiveIntensity: 1.2 });
  for (const dz of [-0.18, 0.18]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.12), headMat); hl.position.set(0.5, 0.3, dz); car.add(hl);
  }
  const wMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const dx of [0.32, -0.32]) for (const dz of [-0.33, 0.33]) {
    const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.13), wMat); wheel.position.set(dx, 0.14, dz); car.add(wheel);
  }
  return car;
}

// Coche LEGENDARIO: dorado/iridiscente, brillante y con corona. Raro.
function buildLegendaryCar() {
  const car = new THREE.Group();
  const gold = 0xffd700;
  const matBody = new THREE.MeshStandardMaterial({ color: gold, roughness: 0.15, metalness: 0.95, emissive: 0xff9a00, emissiveIntensity: 0.7 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x1a1030, roughness: 0.05, metalness: 0.9, emissive: 0x5a2bff, emissiveIntensity: 0.5 });
  const matNeon = new THREE.MeshStandardMaterial({ color: 0xfff2a0, emissive: 0xfff2a0, emissiveIntensity: 1.8 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.24, 0.66), matBody);
  base.position.y = 0.3; base.castShadow = true; car.add(base);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.58), matBody);
  nose.position.set(0.82, 0.26, 0); car.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.52), matGlass);
  cabin.position.set(-0.05, 0.5, 0); car.add(cabin);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.64), matBody);
  wing.position.set(-0.78, 0.48, 0); car.add(wing);
  const underglow = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.7), matNeon);
  underglow.position.y = 0.16; car.add(underglow);
  // Coronita encima de la cabina (marca de "legendario").
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffb300, emissiveIntensity: 1.2, metalness: 0.9, roughness: 0.2 });
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.3), crownMat);
  band.position.set(-0.05, 0.66, 0); car.add(band);
  for (const dx of [-0.1, 0, 0.1]) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), crownMat);
    sp.position.set(-0.05 + dx, 0.76, 0); car.add(sp);
  }
  // Ruedas doradas.
  const wMat = new THREE.MeshStandardMaterial({ color: 0x3a2c00, roughness: 0.4, metalness: 0.8, emissive: 0xffb300, emissiveIntensity: 0.3 });
  for (const dx of [0.55, -0.55]) for (const dz of [-0.35, 0.35]) {
    const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.13), wMat); wheel.position.set(dx, 0.15, dz); car.add(wheel);
  }
  car.userData.legendaryGlow = underglow;
  return car;
}

// Catálogo de modelos terrestres (con su pesos de aparición y medio-ancho real
// para las colisiones y la detección de "casi").
const CAR_MODELS = [
  { id: "sport", build: (c) => buildFuturisticCar(c, false), halfWidth: 0.85, weight: 38 },
  { id: "buggy", build: buildBuggy,                          halfWidth: 0.62, weight: 24 },
  { id: "van",   build: buildVan,                            halfWidth: 0.9,  weight: 22 },
  { id: "truck", build: buildTruck,                          halfWidth: 1.35, weight: 16 },
];
const CAR_MODEL_WEIGHT = CAR_MODELS.reduce((a, m) => a + m.weight, 0);
const LEGENDARY_CHANCE = 0.045; // ~4.5% de coches terrestres son legendarios

function pickCarModel() {
  let r = Math.random() * CAR_MODEL_WEIGHT;
  for (const m of CAR_MODELS) { if ((r -= m.weight) <= 0) return m; }
  return CAR_MODELS[0];
}

function spawnCar(lane, x) {
  const color = CAR_PALETTE[Math.floor(Math.random() * CAR_PALETTE.length)];
  let mesh, halfWidth, legendary = false;

  if (lane.flying) {
    // Los carriles voladores siguen usando el deportivo elevado (con estela).
    mesh = buildFuturisticCar(color, true);
    halfWidth = 0.85;
  } else if (Math.random() < LEGENDARY_CHANCE) {
    // Coche legendario raro: vale puntos extra si lo esquivas muy cerca.
    mesh = buildLegendaryCar();
    halfWidth = 0.9;
    legendary = true;
  } else {
    // Modelo terrestre aleatorio según pesos.
    const model = pickCarModel();
    mesh = model.build(color);
    halfWidth = model.halfWidth;
  }

  const y = lane.flying ? 0.75 : 0;   // los voladores van elevados
  mesh.position.set(x, y, 0);
  // Orientar el morro según el sentido de marcha.
  mesh.rotation.y = lane.dir > 0 ? 0 : Math.PI;
  lane.group.add(mesh);
  const car = { mesh, lane, halfWidth, legendary, lastDx: Infinity, nearDone: false };
  lane.cars.push(car);
  activeVehicles.push(car);
  return car;
}

function spawnLog(lane, x) {
  const len = 2 + Math.floor(Math.random() * 2); // 2-3 casillas
  const log = new THREE.Mesh(
    new THREE.BoxGeometry(len, 0.3, 0.7),
    new THREE.MeshStandardMaterial({ color: COLORS.log, roughness: 1 })
  );
  log.position.set(x, 0.02, 0);
  log.castShadow = true;
  lane.group.add(log);
  const obj = { mesh: log, lane, halfWidth: len / 2, isLog: true };
  lane.cars.push(obj);
  activeVehicles.push(obj);
  return obj;
}

// Roca rectangular grande: plataforma móvil (bloque de piedra) sobre la lava.
function spawnRock(lane, x) {
  const len = 1.4 + Math.random() * 0.5; // rocas más grandes = más fácil posarse (antes 1.0–1.4)
  const depth = 0.7;
  const rock = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(len, 0.4, depth),
    new THREE.MeshStandardMaterial({ color: COLORS.rock, roughness: 1 })
  );
  base.position.y = 0.05;
  base.castShadow = true;
  rock.add(base);
  // Cara superior más clara (donde se posa el pollo).
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(len * 0.92, 0.12, depth * 0.92),
    new THREE.MeshStandardMaterial({ color: COLORS.rockTop, roughness: 1 })
  );
  top.position.y = 0.26;
  rock.add(top);
  rock.position.set(x, 0.02, 0);
  lane.group.add(rock);
  // halfWidth = medio largo: el pollo debe quedar sobre el bloque para no caer.
  const obj = { mesh: rock, lane, halfWidth: len / 2, isLog: true };
  lane.cars.push(obj);
  activeVehicles.push(obj);
  return obj;
}

// Nube-plataforma móvil (nivel 4): se monta como un tronco; si te caes, caes al vacío.
function spawnCloudPlatform(lane, x) {
  const len = 1.6 + Math.random() * 0.8;
  const cloud = new THREE.Group();
  // Varias borlas para dar forma de nube esponjosa.
  const blobs = [
    [0, 0, len, 0.45],
    [-len * 0.28, 0.12, len * 0.5, 0.4],
    [len * 0.28, 0.1, len * 0.5, 0.38],
  ];
  for (const [bx, by, bw, bh] of blobs) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.7), matCloud);
    b.position.set(bx, 0.12 + by, 0);
    b.castShadow = true;
    cloud.add(b);
  }
  cloud.position.set(x, 0.05, 0);
  lane.group.add(cloud);
  const obj = { mesh: cloud, lane, halfWidth: len / 2, isLog: true };
  lane.cars.push(obj);
  activeVehicles.push(obj);
  return obj;
}

// ----------------------------------------------------------------------------
//  NIVELES 2 y 3 — TIBURÓN SUMERGIDO + PECES DECORATIVOS
//  El tiburón nada por DEBAJO de las plataformas (troncos/nubes); su aleta asoma
//  y, al pasar bajo una plataforma, la hace botar. Los peces son pura decoración
//  de los ríos. Ambos son HIJOS de lane.group: nadan en X local y NO se
//  reenganchan a la Z del pollo (así no "saltan" hacia delante cuando el jugador
//  avanza) y se limpian solos al reciclar la fila.
// ----------------------------------------------------------------------------
const matSharkBody  = new THREE.MeshStandardMaterial({ color: 0x5a6b86, roughness: 0.7 });
const matSharkBelly = new THREE.MeshStandardMaterial({ color: 0xd9e2ee, roughness: 0.8 });
const matSharkFin   = new THREE.MeshStandardMaterial({ color: 0x44546e, roughness: 0.7 });
const matSharkDark  = new THREE.MeshStandardMaterial({ color: 0x2a3242, roughness: 0.8 });
const matSharkTeeth = new THREE.MeshStandardMaterial({ color: 0xfdfdfd, roughness: 0.4 });
const matSharkGum   = new THREE.MeshStandardMaterial({ color: 0xc24a55, roughness: 0.8 });
const matEyeBlack   = new THREE.MeshStandardMaterial({ color: 0x111111 });
const matEyeWhite   = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
const FISH_COLORS = [0xff8a3a, 0xffd23a, 0x3ad1ff, 0xff5a8a, 0x8affc0];
const matFishes = FISH_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: c, emissiveIntensity: 0.12 }));

// --- Tiburón voxel (cuerpo medio sumergido + aleta dorsal que asoma) ---
function buildShark() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.4, 0.5), matSharkBody);
  g.add(body);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), matSharkBody);
  snout.position.set(0.78, 0.02, 0); g.add(snout);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.46), matSharkBelly);
  belly.position.set(-0.05, -0.16, 0); g.add(belly);
  // Aleta dorsal (asoma por encima de la superficie).
  const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.08), matSharkFin);
  dorsal.position.set(-0.05, 0.4, 0); dorsal.rotation.z = -0.15; g.add(dorsal);
  // Cola que aletea (pivote propio).
  const tail = new THREE.Group();
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.08), matSharkFin);
  tailFin.position.set(-0.16, 0, 0); tail.add(tailFin);
  tail.position.set(-0.72, 0.05, 0); g.add(tail);
  // Aletas laterales.
  for (const dz of [-0.3, 0.3]) {
    const pec = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.22), matSharkFin);
    pec.position.set(0.1, -0.1, dz); pec.rotation.x = dz < 0 ? 0.3 : -0.3; g.add(pec);
  }
  // Branquias (rayas en el costado, dan carácter a la cara).
  for (let i = 0; i < 3; i++) {
    const gill = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.02), matSharkDark);
    gill.position.set(0.34 - i * 0.12, 0.0, 0.26); g.add(gill);
    const gill2 = gill.clone(); gill2.position.z = -0.26; g.add(gill2);
  }
  // Ojos grandes y saltones (blanco + pupila negra) bien visibles.
  for (const dz of [-0.22, 0.22]) {
    const sclera = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.12), matEyeWhite);
    sclera.position.set(0.66, 0.12, dz); g.add(sclera);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.06), matEyeBlack);
    pupil.position.set(0.73, 0.12, dz); g.add(pupil);
  }
  // --- Boca abierta y dentona (lo que pidió el jugador: que se vean los dientes) ---
  // Encía/interior oscuro de fondo.
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.46), matSharkDark);
  jaw.position.set(0.78, -0.14, 0); g.add(jaw);
  const gum = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.42), matSharkGum);
  gum.position.set(0.82, -0.14, 0); g.add(gum);
  // Fila de dientes superior (triángulos = cubos girados 45°) e inferior.
  const teethZ = [-0.16, -0.08, 0, 0.08, 0.16];
  for (const tz of teethZ) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), matSharkTeeth);
    top.position.set(0.92, -0.04, tz); top.rotation.z = Math.PI / 4; g.add(top);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), matSharkTeeth);
    bot.position.set(0.92, -0.24, tz); bot.rotation.z = Math.PI / 4; g.add(bot);
  }
  g.userData = { tail };
  return g;
}

// --- Pez voxel pequeño decorativo (cuerpo + cola) ---
function buildFish(matIndex) {
  const g = new THREE.Group();
  const mat = matFishes[matIndex];
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.14), mat);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.04), mat);
  tail.position.x = -0.2; g.add(tail);
  for (const dz of [0.08, -0.08]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), matEyeBlack);
    eye.position.set(0.1, 0.03, dz); g.add(eye);
  }
  g.userData = { tail };
  return g;
}

// Añade un tiburón sumergido a una fila (río/nube). submergedY = profundidad.
function addSharkToLane(lane, submergedY) {
  if (!lane.sharks) lane.sharks = [];
  const mesh = buildShark();
  const dir = Math.random() < 0.5 ? 1 : -1;
  mesh.rotation.y = dir > 0 ? 0 : Math.PI;
  mesh.position.set((Math.random() * 2 - 1) * (FIELD_WIDTH / 2), submergedY, (Math.random() - 0.5) * 0.3);
  lane.group.add(mesh);
  lane.sharks.push({ mesh, dir, speed: 1.0 + Math.random() * 0.8, baseY: submergedY, phase: Math.random() * 6 });
}

// Añade peces decorativos a una fila de río.
function addFishToLane(lane) {
  if (!lane.fish) lane.fish = [];
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const mesh = buildFish((Math.random() * matFishes.length) | 0);
    const dir = Math.random() < 0.5 ? 1 : -1;
    mesh.rotation.y = dir > 0 ? 0 : Math.PI;
    mesh.position.set((Math.random() * 2 - 1) * (FIELD_WIDTH / 2), -0.12, (Math.random() - 0.5) * 0.5);
    mesh.scale.setScalar(0.8 + Math.random() * 0.5);
    lane.group.add(mesh);
    lane.fish.push({ mesh, dir, speed: 0.6 + Math.random() * 0.8, baseY: -0.12, phase: Math.random() * 6 });
  }
}

// Mueve tiburones y peces y hace BOTAR las plataformas cuando el tiburón pasa por
// debajo. Como son hijos de lane.group, nadan en X local sin seguir al pollo.
function updateRiverLife(dt, now) {
  // Los tiburones y peces solo existen en el nivel 2 (ríos).
  if (level !== 2) return;
  const limit = FIELD_WIDTH / 2 + 1.5;
  for (const lane of rows.values()) {
    // --- Tiburones ---
    if (lane.sharks) {
      for (const s of lane.sharks) {
        s.mesh.position.x += s.dir * s.speed * dt;
        if (s.mesh.position.x > limit) s.mesh.position.x = -limit;
        else if (s.mesh.position.x < -limit) s.mesh.position.x = limit;
        s.mesh.position.y = s.baseY + Math.sin(now * 1.5 + s.phase) * 0.05; // bobeo suave
        if (s.mesh.userData.tail) s.mesh.userData.tail.rotation.y = Math.sin(now * 6 + s.phase) * 0.5; // coletazo
        // Hacer botar las plataformas que tenga justo encima.
        if (lane.cars) {
          for (const car of lane.cars) {
            if (car.baseY === undefined) car.baseY = car.mesh.position.y;
            const dx = Math.abs(car.mesh.position.x - s.mesh.position.x);
            if (dx < 1.1) {
              const k = 1 - dx / 1.1;                                   // 1 justo encima, 0 lejos
              car.mesh.position.y = car.baseY + k * 0.12;               // empujón hacia arriba
              car.mesh.rotation.z = (car.mesh.position.x - s.mesh.position.x) * 0.12; // se inclina
              car._shaken = true;
            } else if (car._shaken) {
              // Volver suavemente al reposo cuando el tiburón se aleja.
              car.mesh.position.y += (car.baseY - car.mesh.position.y) * Math.min(1, dt * 6);
              car.mesh.rotation.z += (0 - car.mesh.rotation.z) * Math.min(1, dt * 6);
              if (Math.abs(car.mesh.position.y - car.baseY) < 0.005) {
                car.mesh.position.y = car.baseY; car.mesh.rotation.z = 0; car._shaken = false;
              }
            }
          }
        }
      }
    }
    // --- Peces decorativos ---
    if (lane.fish) {
      for (const f of lane.fish) {
        f.mesh.position.x += f.dir * f.speed * dt;
        if (f.mesh.position.x > limit) f.mesh.position.x = -limit;
        else if (f.mesh.position.x < -limit) f.mesh.position.x = limit;
        f.mesh.position.y = f.baseY + Math.sin(now * 2 + f.phase) * 0.04;
        if (f.mesh.userData.tail) f.mesh.userData.tail.rotation.y = Math.sin(now * 10 + f.phase) * 0.6;
      }
    }
  }
}

// Dron/avión futurista que cruza (nivel 4). Colisión = game over (como un coche).
function spawnDrone(lane, x) {
  const drone = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({
    color: 0xd0d6e6, metalness: 0.6, roughness: 0.3, emissive: 0x223044, emissiveIntensity: 0.3,
  });
  const matNeon = new THREE.MeshStandardMaterial({ color: 0xff2bd6, emissive: 0xff2bd6, emissiveIntensity: 1.4 });

  // Fuselaje.
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 0.4), matBody);
  body.position.y = 0.5;
  body.castShadow = true;
  drone.add(body);
  // Morro.
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.3), matBody);
  nose.position.set(0.78, 0.5, 0);
  drone.add(nose);
  // Alas.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 1.4), matBody);
  wing.position.set(-0.05, 0.5, 0);
  drone.add(wing);
  // Cola.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.28, 0.5), matBody);
  tail.position.set(-0.6, 0.6, 0);
  drone.add(tail);
  // Luces de neón en las puntas de las alas.
  for (const dz of [-0.68, 0.68]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.12), matNeon);
    tip.position.set(-0.05, 0.5, dz);
    drone.add(tip);
  }

  drone.position.set(x, 0, 0);
  drone.rotation.y = lane.dir > 0 ? 0 : Math.PI;
  lane.group.add(drone);
  const obj = { mesh: drone, lane, halfWidth: 0.8 };
  lane.cars.push(obj);
  activeVehicles.push(obj);
  return obj;
}

// ----------------------------------------------------------------------------
//  Monedas: 2 por nivel, sobre filas de hierba seguras. Giran y flotan.
// ----------------------------------------------------------------------------
function buildCoin() {
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.07, 18),
    new THREE.MeshStandardMaterial({
      color: 0xffd000, emissive: 0xffae00, emissiveIntensity: 0.6,
      metalness: 0.6, roughness: 0.25,
    })
  );
  coin.rotation.x = Math.PI / 2; // de canto, como una moneda que gira
  coin.castShadow = true;
  return coin;
}

function spawnCoinsForLevel() {
  clearCoins();
  coinsCollected = 0;
  updateCoinHud();

  // Candidatas: filas de hierba seguras ya generadas, lejos del inicio y meta.
  const candidates = [];
  for (const [r, data] of rows) {
    const safe = data.type === ROW_GRASS || data.type === ROW_SKY || data.type === ROW_SAND || data.type === ROW_CIRCUS || data.type === ROW_ZGRASS;
    if (safe && r >= 5 && r <= LEVEL_GOAL - 2) candidates.push(r);
  }
  // Barajar y tomar las primeras COINS_PER_LEVEL.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  if (candidates.length === 0) return;

  // Repartir las monedas entre las filas candidatas (varias por fila si hace
  // falta), evitando árboles y columnas ya ocupadas en la misma fila.
  const usedByRow = new Map(); // row -> Set de columnas ya usadas
  for (let i = 0; i < COINS_PER_LEVEL; i++) {
    const row = candidates[i % candidates.length];
    const data = rows.get(row);
    if (!usedByRow.has(row)) usedByRow.set(row, new Set());
    const used = usedByRow.get(row);

    let col = null;
    for (let tries = 0; tries < 14; tries++) {
      const c = Math.round((Math.random() * 2 - 1) * (COLS - 1));
      if (used.has(c)) continue;
      if (data.blocked && data.blocked.has(c)) continue;
      col = c;
      break;
    }
    if (col === null) continue; // fila saturada, saltar
    used.add(col);

    const coin = buildCoin();
    coin.position.set(col * TILE, 0.55, 0); // local a la fila
    data.group.add(coin);
    coins.push({ mesh: coin, col, row });
  }
}

function clearCoins() {
  for (const c of coins) {
    if (c.mesh.parent) c.mesh.parent.remove(c.mesh);
    c.mesh.geometry.dispose();
  }
  coins.length = 0;
}

function updateCoinHud() {
  elCoins.textContent = "Monedas: " + coinsCollected + "/" + COINS_PER_LEVEL;
}

// Giro/flotación + recogida cuando el pollo cae en la casilla de la moneda.
function updateCoins(dt) {
  const t = performance.now() / 1000;
  const magnet = magnetActive(t);
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.mesh.rotation.y += dt * 3;

    let collected = !playerState.moving && playerState.col === c.col && playerState.row === c.row;

    // Imán: atrae monedas cercanas hacia el pollo en coordenadas de mundo.
    if (magnet && !collected) {
      const drow = playerState.row - c.row;
      const dcol = playerState.col - c.col;
      if (Math.hypot(drow, dcol) <= MAGNET_RANGE) {
        // Reparentar a la escena una sola vez para mover en mundo sin saltos.
        if (!c.magnetized) { scene.attach(c.mesh); c.magnetized = true; }
        c.mesh.position.x += (player.position.x - c.mesh.position.x) * Math.min(1, MAGNET_PULL * dt);
        c.mesh.position.z += (player.position.z - c.mesh.position.z) * Math.min(1, MAGNET_PULL * dt);
        c.mesh.position.y += (0.55 - c.mesh.position.y) * Math.min(1, MAGNET_PULL * dt);
        const near = Math.hypot(player.position.x - c.mesh.position.x, player.position.z - c.mesh.position.z);
        if (near < 0.4) collected = true;
      }
    }
    if (!c.magnetized) {
      c.mesh.position.y = 0.55 + Math.sin(t * 3 + c.col) * 0.08; // flotación normal
    }

    if (collected) {
      // Recoger.
      if (c.mesh.parent) c.mesh.parent.remove(c.mesh);
      c.mesh.geometry.dispose();
      coins.splice(i, 1);
      coinsCollected++;
      updateCoinHud();
      addCoins(1); // a la cartera persistente (localStorage)
      addXp(XP_PER_COIN);            // XP por moneda
      addWeeklyProgress("coins", 1); // misión semanal "coins"
      sfxCoin();
      spawnParticles(player.position.x, 0.6, player.position.z, 0xffd000, 10, { speed: 2.5, up: 2, life: 0.6 });
      startCoinDance(); // Bloque 9: bailecito de celebración (solo visual)
    }
  }
}

// ----------------------------------------------------------------------------
//  BLOQUE 1 — POWER-UPS
//  Mejoras temporales que aparecen con poca probabilidad sobre filas seguras.
//  Cada una tiene su icono con cuenta atrás en la barra superior (#powerup-bar).
//    · shield      : absorbe un golpe de coche (aura visible).
//    · magnet      : atrae monedas cercanas durante unos segundos.
//    · longjump    : el salto cruza dos casillas durante unos segundos.
//    · slowmo      : ralentiza todos los coches; el pollo va a velocidad normal.
//    · invincible  : breve invulnerabilidad ante coches (parpadeo/brillo).
// ----------------------------------------------------------------------------
const POWERUP_TYPES = {
  shield:     { label: "Escudo",       icon: "🛡️", color: 0x00f0ff, duration: 0 },
  magnet:     { label: "Imán",         icon: "🧲", color: 0xff2bd6, duration: 7 },
  longjump:   { label: "Salto largo",  icon: "🦘", color: 0x00ff9d, duration: 7 },
  slowmo:     { label: "Cámara lenta", icon: "🐢", color: 0x7c4dff, duration: 6 },
  invincible: { label: "Invencible",   icon: "⭐", color: 0xffe600, duration: 5 },
};
const POWERUP_KEYS = Object.keys(POWERUP_TYPES);
const POWERUP_SPAWN_CHANCE = 0.05; // probabilidad por fila segura candidata (pocos)

// Estado de los power-ups activos. Los temporales guardan el instante (s) hasta
// el que siguen activos; el escudo es un booleano (un solo uso).
const power = {
  shield: false,
  magnetUntil: 0,
  longJumpUntil: 0,
  slowMoUntil: 0,
  invincibleUntil: 0,
};

// ---- BLOQUE 6: detección de "casi" (near-miss) y cámara lenta breve ----
let nearMissSlowUntil = 0;   // instante (s) hasta el que dura la ralentización por "casi"
let nearMissCombo = 0;       // racha de "casi" encadenados
let nearMissComboUntil = 0;  // instante (s) en el que expira la racha
let runBonus = 0;            // puntos extra de "casi" del nivel actual
let runNearMiss = 0;         // total de "casi" de la partida (para estadísticas)

const powerups = []; // {mesh, col, row, type}

const MAGNET_RANGE = 3.2;   // radio (en casillas) de atracción de monedas
const MAGNET_PULL = 7;      // velocidad de atracción

// Pieza recogible de power-up. Cada tipo es un modelo voxel reconocible:
// escudo, imán (herradura), tortuga (cámara lenta), canguro (salto largo) y
// estrella (invencible).
function pmat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.rough ?? 0.5, metalness: opts.metal ?? 0.1,
    emissive: opts.emissive ?? color, emissiveIntensity: opts.glow ?? 0.25,
  });
}
function pbox(group, w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  group.add(m);
  return m;
}

// Escudo: placa azulada con punta inferior y una cruz blanca.
function buildShield() {
  const g = new THREE.Group();
  const body = pmat(0x2f7bd6, { metal: 0.5, rough: 0.3, glow: 0.35 });
  const trim = pmat(0xeaf4ff, { glow: 0.5 });
  pbox(g, 0.5, 0.46, 0.12, 0, 0.08, 0, body);          // cuerpo
  const tip = pbox(g, 0.36, 0.36, 0.12, 0, -0.18, 0, body); // punta inferior
  tip.rotation.z = Math.PI / 4;
  pbox(g, 0.1, 0.42, 0.16, 0, 0.08, 0, trim);          // cruz vertical
  pbox(g, 0.34, 0.1, 0.16, 0, 0.12, 0, trim);          // cruz horizontal
  return g;
}

// Imán de herradura: U roja con dos polos plateados.
function buildMagnet() {
  const g = new THREE.Group();
  const red = pmat(0xe0263a, { glow: 0.4 });
  const tip = pmat(0xd8dde6, { metal: 0.6, rough: 0.3, glow: 0.2 });
  pbox(g, 0.16, 0.42, 0.18, -0.18, 0.12, 0, red);  // pata izquierda
  pbox(g, 0.16, 0.42, 0.18, 0.18, 0.12, 0, red);   // pata derecha
  pbox(g, 0.52, 0.16, 0.18, 0, 0.36, 0, red);      // arco superior
  pbox(g, 0.16, 0.14, 0.19, -0.18, -0.13, 0, tip); // polo izquierdo
  pbox(g, 0.16, 0.14, 0.19, 0.18, -0.13, 0, tip);  // polo derecho
  return g;
}

// Tortuga: caparazón verde abombado, cabeza y patas.
function buildTurtle() {
  const g = new THREE.Group();
  const shellMat = pmat(0x2f9e44, { rough: 0.7, glow: 0.2 });
  const bodyMat = pmat(0x8fd14f, { rough: 0.8, glow: 0.15 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), shellMat);
  shell.scale.set(1, 0.55, 1);
  shell.position.y = 0.16;
  shell.castShadow = true;
  g.add(shell);
  pbox(g, 0.6, 0.12, 0.42, 0, 0.02, 0, bodyMat);     // vientre
  pbox(g, 0.18, 0.14, 0.18, 0.34, 0.04, 0, bodyMat); // cabeza
  for (const [dx, dz] of [[-0.24, 0.2], [0.24, 0.2], [-0.24, -0.2], [0.24, -0.2]]) {
    pbox(g, 0.12, 0.1, 0.12, dx, -0.02, dz, bodyMat); // patas
  }
  return g;
}

// Canguro: cuerpo marrón inclinado, cabeza con orejas, cola gruesa y patas.
function buildKangaroo() {
  const g = new THREE.Group();
  const fur = pmat(0xc1763a, { rough: 0.8, glow: 0.15 });
  const furD = pmat(0xa05f2c, { rough: 0.8, glow: 0.1 });
  pbox(g, 0.26, 0.4, 0.22, 0, 0.28, 0, fur);          // torso
  pbox(g, 0.2, 0.2, 0.18, 0.02, 0.56, 0.04, fur);     // cabeza
  pbox(g, 0.05, 0.16, 0.05, -0.04, 0.74, 0, fur);     // oreja izq
  pbox(g, 0.05, 0.16, 0.05, 0.08, 0.74, 0, fur);      // oreja der
  const tail = pbox(g, 0.18, 0.12, 0.5, 0, 0.12, -0.28, furD); // cola
  tail.rotation.x = 0.5;
  pbox(g, 0.14, 0.12, 0.34, -0.08, 0.04, 0.06, furD); // pie izq
  pbox(g, 0.14, 0.12, 0.34, 0.08, 0.04, 0.06, furD);  // pie der
  return g;
}

// Estrella de cinco puntas (invencibilidad), amarilla y brillante.
function buildStar() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  const points = 5, outer = 0.36, inner = 0.16;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
  geo.center();
  const star = new THREE.Mesh(geo, pmat(0xffe600, { metal: 0.3, rough: 0.3, glow: 0.9 }));
  star.position.y = 0.18;
  star.castShadow = true;
  g.add(star);
  return g;
}

function buildPowerup(type) {
  let g;
  if (type === "shield") g = buildShield();
  else if (type === "magnet") g = buildMagnet();
  else if (type === "slowmo") g = buildTurtle();
  else if (type === "longjump") g = buildKangaroo();
  else g = buildStar(); // invincible
  return g;
}

// Intenta colocar un power-up en una fila segura (hierba o nube), columna libre.
function maybeAddPowerup(row, data, blocked) {
  if (row < 5 || row > LEVEL_GOAL - 2) return;
  if (Math.random() > POWERUP_SPAWN_CHANCE) return;

  const type = POWERUP_KEYS[Math.floor(Math.random() * POWERUP_KEYS.length)];
  let col = null;
  for (let tries = 0; tries < 12; tries++) {
    const c = Math.round((Math.random() * 2 - 1) * (COLS - 1));
    if (c === 0 && row < 3) continue;
    if (blocked && blocked.has(c)) continue;
    col = c;
    break;
  }
  if (col === null) return;

  const mesh = buildPowerup(type);
  mesh.position.set(col * TILE, 0.6, 0); // local a la fila
  data.group.add(mesh);
  powerups.push({ mesh, col, row, type });
}

// Aviso central inconfundible al recoger un power-up (icono + nombre).
let powerPopUntil = 0; // hasta cuándo dura el "pop" de escala del pollo
function showPowerupToast(type, now) {
  const cfg = POWERUP_TYPES[type];
  if (elToast) {
    const color = "#" + cfg.color.toString(16).padStart(6, "0");
    elToast.style.setProperty("--toast-color", color);
    elToast.textContent = cfg.icon + "  ¡" + cfg.label.toUpperCase() + "!";
    elToast.classList.remove("show");
    void elToast.offsetWidth; // reiniciar la animación CSS
    elToast.classList.add("show");
  }
  powerPopUntil = now + 0.3; // destello/escala del pollo
}

// Activa un power-up recogido y actualiza su temporizador.
function activatePowerup(type, now) {
  const cfg = POWERUP_TYPES[type];
  showPowerupToast(type, now);
  if (type === "shield") {
    power.shield = true;
  } else if (type === "magnet") {
    power.magnetUntil = now + cfg.duration;
  } else if (type === "longjump") {
    power.longJumpUntil = now + cfg.duration;
  } else if (type === "slowmo") {
    power.slowMoUntil = now + cfg.duration;
  } else if (type === "invincible") {
    power.invincibleUntil = now + cfg.duration;
  }
  updatePowerupHud(now);
}

// Limpia todos los power-ups (mundo y estado) al arrancar/reiniciar un nivel.
function resetPowerups() {
  for (const p of powerups) {
    if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
    p.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  powerups.length = 0;
  power.shield = false;
  power.magnetUntil = 0;
  power.longJumpUntil = 0;
  power.slowMoUntil = 0;
  power.invincibleUntil = 0;
  player.visible = true;
  player.scale.setScalar(1);
  powerPopUntil = 0;
  if (player.userData.aura) player.userData.aura.visible = false;
  if (elToast) elToast.classList.remove("show");
  updatePowerupHud(performance.now() / 1000);
}

// Atajos de consulta del estado activo.
function magnetActive(now) { return now < power.magnetUntil; }
function longJumpActive(now) { return now < power.longJumpUntil; }
function slowMoActive(now) { return now < power.slowMoUntil; }
function invincibleActive(now) { return now < power.invincibleUntil; }

// Giro/flotación de las piezas + recogida al caer en su casilla.
function updatePowerups(dt, now) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.mesh.rotation.y += dt * 1.6; // gira despacio para que se reconozca
    p.mesh.position.y = 0.6 + Math.sin(now * 3 + p.col) * 0.1;
    if (!playerState.moving && playerState.col === p.col && playerState.row === p.row) {
      if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
      p.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      powerups.splice(i, 1);
      activatePowerup(p.type, now);
      sfxPowerup();
      startHeroPose(); // Bloque 10: pose de superhéroe + musiquita épica (no bloquea)
      spawnParticles(player.position.x, 0.7, player.position.z, POWERUP_TYPES[p.type].color, 14, { speed: 3, up: 2.5, life: 0.7 });
      runPowerups++;
      unlockAchievement("powerup1");
      if (runPowerups >= 5) unlockAchievement("powerup5");
      addWeeklyProgress("powerups", 1); // misión semanal "powerups"
    }
  }
  updatePowerupVisuals(now);
  updatePowerupHud(now);
}

// Efectos visuales sobre el pollo: aura del escudo y parpadeo de invencibilidad.
function updatePowerupVisuals(now) {
  const aura = player.userData.aura;
  if (aura) {
    aura.visible = power.shield;
    if (power.shield) aura.material.opacity = 0.22 + Math.abs(Math.sin(now * 5)) * 0.18;
  }
  if (invincibleActive(now)) {
    player.visible = Math.floor(now * 12) % 2 === 0; // parpadeo
  } else {
    player.visible = true;
  }
  // Pop de escala al recoger cualquier power-up (feedback en el mundo).
  if (now < powerPopUntil) {
    const k = 1 + Math.sin((powerPopUntil - now) / 0.3 * Math.PI) * 0.35;
    player.scale.setScalar(k);
  } else {
    player.scale.setScalar(1);
  }
}

// Pinta la barra superior con un chip (icono + segundos) por power-up activo.
function updatePowerupHud(now) {
  if (!elPowerups) return;
  const chips = [];
  if (power.shield) chips.push({ type: "shield", secs: null });
  if (magnetActive(now)) chips.push({ type: "magnet", secs: Math.ceil(power.magnetUntil - now) });
  if (longJumpActive(now)) chips.push({ type: "longjump", secs: Math.ceil(power.longJumpUntil - now) });
  if (slowMoActive(now)) chips.push({ type: "slowmo", secs: Math.ceil(power.slowMoUntil - now) });
  if (invincibleActive(now)) chips.push({ type: "invincible", secs: Math.ceil(power.invincibleUntil - now) });

  let html = "";
  for (const ch of chips) {
    const cfg = POWERUP_TYPES[ch.type];
    const color = "#" + cfg.color.toString(16).padStart(6, "0");
    const time = ch.secs === null ? "" : '<span class="ptime">' + ch.secs + "s</span>";
    html += '<div class="pchip" style="--chip-color:' + color + '">' +
            '<span class="picon">' + cfg.icon + "</span>" +
            '<span class="pname">' + cfg.label + "</span>" + time + "</div>";
  }
  elPowerups.innerHTML = html;
}

// ----------------------------------------------------------------------------
//  Gestión del horizonte de filas: generar delante, borrar detrás.
// ----------------------------------------------------------------------------
function ensureRows() {
  const top = playerState.maxRow + ROWS_AHEAD;
  for (let r = 0; r <= top; r++) {
    if (!rows.has(r)) createRow(r);
  }
  // Borrar filas demasiado por detrás.
  const cutoff = playerState.row - ROWS_BEHIND;
  for (const [r, data] of rows) {
    if (r < cutoff) {
      removeRow(r, data);
    }
  }
}

function createRow(row) {
  // Atajo del circo: la fila ESCAPE_ROW del nivel 6 es una fila segura especial
  // con el cochecito de escape pegado a la derecha.
  if (level === 6 && row === ESCAPE_ROW) { createEscapeRow(row); return; }
  const type = pickRowType(row);
  if (type === ROW_ROAD) createRoadRow(row);
  else if (type === ROW_RIVER) createRiverRow(row);
  else if (type === ROW_LAVA) createLavaRow(row);
  else if (type === ROW_SKY) createCloudFloorRow(row);
  else if (type === ROW_CLOUD) createCloudRow(row);
  else if (type === ROW_SKYROAD) createSkyRoadRow(row);
  else if (type === ROW_LIGHTNING) createLightningRow(row);
  else if (type === ROW_SAND) createSandRow(row);
  else if (type === ROW_QUICKSAND) createQuicksandRow(row);
  else if (type === ROW_DESERTROAD) createDesertRoadRow(row);
  else if (type === ROW_CIRCUS) createCircusRow(row);
  else if (type === ROW_BUMPER) createBumperRow(row);
  else if (type === ROW_CAROUSEL) createCarouselRow(row);
  else if (type === ROW_CANNON) createCannonRow(row);
  else if (type === ROW_ZGRASS) createZGrassRow(row);
  else if (type === ROW_ZHELI) createZHeliRow(row);
  else if (type === ROW_ZTRAIN) createZTrainRow(row);
  else createGrassRow(row);
}

function removeRow(row, data) {
  if (data.cars) {
    for (const c of data.cars) {
      const idx = activeVehicles.indexOf(c);
      if (idx !== -1) activeVehicles.splice(idx, 1);
    }
  }
  // Nivel 5: limpiar zombis de esta fila (viven en la escena, no en el grupo).
  removeZombiesForRow(row);
  // Nivel 7: limpiar monstruos de lava de esta fila (también viven en la escena).
  removeLavaMonstersForRow(row);
  // Soltar power-ups que vivían en esta fila (su mesh se borra con el grupo).
  for (let i = powerups.length - 1; i >= 0; i--) {
    if (powerups[i].row === row) powerups.splice(i, 1);
  }
  // Si reciclamos la fila del cochecito de escape, soltar su referencia.
  if (escapeCar && escapeCar.row === row) escapeCar = null;
  scene.remove(data.group);
  data.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
  rows.delete(row);
}

// ----------------------------------------------------------------------------
// 6. MOVIMIENTO DEL JUGADOR (salto por casillas)
// ----------------------------------------------------------------------------
const HOP_DURATION = 0.14; // segundos
const HOP_HEIGHT = 0.6;

function tryMove(dir) {
  // Bloque 11: el movimiento se permite jugando normal O durante la pelea del
  // jefe (solo en la fase de combate, no durante el aviso dramático).
  const inBoss = gameState === "boss" && boss.active && boss.phase === "fight";
  if (!playerState.alive || playerState.moving) return;
  if (gameState !== "playing" && !inBoss) return;

  let { col, row } = playerState;
  let nCol = col, nRow = row;
  let facing = playerState.facing;

  // Salto largo: avanza/retrocede dos casillas mientras el power-up esté activo.
  const step = longJumpActive(performance.now() / 1000) ? 2 : 1;

  if (dir === "forward") { nRow = row + step; facing = 0; }
  else if (dir === "back") { nRow = row - step; facing = Math.PI; }
  else if (dir === "left") { nCol = col - 1; facing = Math.PI / 2; }
  else if (dir === "right") { nCol = col + 1; facing = -Math.PI / 2; }

  // Límites laterales.
  if (inBoss) {
    // Bloque 11: durante la pelea el pollito se mueve en una arena cerrada.
    if (nCol < -BOSS_ARENA_HALF || nCol > BOSS_ARENA_HALF) return;
    if (nRow < 0 || nRow > BOSS_ARENA_FRONT) return;
    // Las columnas de cobertura ocupan su casilla: no se puede entrar en ellas.
    if (boss.columnSet && boss.columnSet.has(nCol + "," + nRow)) return;
  } else {
    if (nCol < -COLS || nCol > COLS) return;
    if (nRow < 0) return; // no retroceder más allá del inicio
  }

  // ¿Casilla bloqueada por un árbol?
  const destRow = rows.get(nRow);
  if (destRow && destRow.blocked && destRow.blocked.has(nCol)) return;

  // Iniciar animación de salto.
  playerState.from.copy(player.position);
  const dest = gridToWorld(nCol, nRow);
  playerState.to.set(dest.x, 0, dest.z);
  playerState.moving = true;
  playerState.moveStart = performance.now() / 1000;
  playerState.facing = facing;
  playerState.col = nCol;
  playerState.row = nRow;
  playerState.onLog = null; // al saltar nos soltamos de cualquier tronco

  // Bloque 10: al saltar se cancela la pose de héroe y se endereza el cuerpo
  // (la inclinación/escala de las poses no debe arrastrarse al salto).
  heroPose.active = false;
  player.rotation.x = 0; player.rotation.z = 0;

  // Logro "sin frenos": un parón largo entre movimientos lo invalida.
  const tMove = performance.now() / 1000;
  if (tMove - lastMoveAt > NOSTOP_IDLE) { levelNoStop = false; runStreak = 0; }
  lastMoveAt = tMove;

  // Feedback de salto: "pío" + pequeña nube de polvo.
  sfxJump();
  spawnParticles(player.position.x, 0.1, player.position.z, 0xffffff, 4, { speed: 1.4, up: 0.8, life: 0.35 });

  // Puntuación: solo avanzar hacia adelante suma.
  // Bloque 11: en la pelea del jefe no hay puntuación ni generación de filas.
  if (!inBoss && nRow > playerState.maxRow) {
    const prevMax = playerState.maxRow;
    playerState.maxRow = nRow;
    setScore(playerState.maxRow);
    ensureRows();

    // Logros de progreso: carriles cruzados y vehículos voladores esquivados.
    const lanesGained = nRow - prevMax;
    runLanes += lanesGained;
    let flyingGained = 0;
    let carsDodgedNow = 0;
    for (let r = prevMax + 1; r <= nRow; r++) {
      const ld = rows.get(r);
      if (ld && ((ld.type === ROW_ROAD && ld.flying) || ld.type === ROW_SKYROAD)) flyingGained++;
      // Bloque 7: contar los coches del carril letal que acabamos de superar.
      const lethalLane = ld && (ld.type === ROW_ROAD || ld.type === ROW_SKYROAD || ld.type === ROW_DESERTROAD
        || ld.type === ROW_BUMPER || ld.type === ROW_CANNON || ld.type === ROW_ZHELI);
      if (lethalLane && ld.cars) carsDodgedNow += ld.cars.length;
    }
    runFlying += flyingGained;
    checkProgressAchievements();

    // Bloque 7: estadísticas a largo plazo.
    stats.distance += lanesGained;
    stats.carsDodged += carsDodgedNow;
    runStreak += lanesGained;
    if (runStreak > stats.bestStreak) stats.bestStreak = runStreak;

    // Progresión: XP por carriles y avance de misiones semanales.
    addXp((nRow - prevMax) * XP_PER_LANE);
    addWeeklyProgress("lanes", nRow - prevMax);
    addWeeklyProgress("flying", flyingGained);

    // ¿Hemos alcanzado la meta del nivel?
    if (playerState.maxRow >= LEVEL_GOAL) {
      completeLevel();
    }
  }
}

function updatePlayerMovement(now) {
  if (!playerState.moving) return;
  const t = (now - playerState.moveStart) / HOP_DURATION;
  if (t >= 1) {
    player.position.copy(playerState.to);
    playerState.moving = false;
  } else {
    player.position.lerpVectors(playerState.from, playerState.to, t);
    player.position.y = Math.sin(t * Math.PI) * HOP_HEIGHT; // arco del salto
  }
  // Giro suave hacia la dirección de movimiento.
  player.rotation.y = lerpAngle(player.rotation.y, playerState.facing, 0.4);
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// ----------------------------------------------------------------------------
// 7. ENTRADA: teclado, swipe y D-pad
// ----------------------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowUp": case "w": case "W": tryMove("forward"); break;
    case "ArrowDown": case "s": case "S": tryMove("back"); break;
    case "ArrowLeft": case "a": case "A": tryMove("left"); break;
    case "ArrowRight": case "d": case "D": tryMove("right"); break;
    // Bloque 11 (Parte 3): recoger / devolver el objeto en la pelea de jefe.
    case "l": case "L": case "q": case "Q": bossActionKey(); break;
  }
});

// Swipe táctil.
let touchStart = null;
const SWIPE_MIN = 24;
renderer.domElement.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });

renderer.domElement.addEventListener("touchend", (e) => {
  if (!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) {
    tryMove("forward"); // toque simple = avanzar
    return;
  }
  if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? "right" : "left");
  else tryMove(dy > 0 ? "back" : "forward");
}, { passive: true });

// Botones D-pad.
document.querySelectorAll(".dpad").forEach((btn) => {
  btn.addEventListener("click", () => tryMove(btn.dataset.dir));
});

// Botón táctil de acción del jefe (agarrar/lanzar): hace lo mismo que la tecla L/Q.
const elBossBtn = document.getElementById("boss-action-btn");
if (elBossBtn) {
  elBossBtn.addEventListener("click", (e) => { e.preventDefault(); bossActionKey(); });
}

// ----------------------------------------------------------------------------
// 8. ACTUALIZACIÓN DE VEHÍCULOS, COLISIONES Y AVANCE FORZADO
// ----------------------------------------------------------------------------
function updateVehicles(dt) {
  const limit = FIELD_WIDTH / 2 + 2;
  const now = performance.now() / 1000;
  // Cámara lenta: por el power-up de tortuga o por un "casi" reciente.
  const slow = slowMoActive(now) || now < nearMissSlowUntil;
  for (const lane of rows.values()) {
    if (!lane.cars) continue;
    // Las plataformas (troncos/rocas/nubes) mantienen su velocidad para no
    // dejar al pollo colgado; la cámara lenta solo frena al tráfico letal.
    const lethal = lane.type === ROW_ROAD || lane.type === ROW_SKYROAD || lane.type === ROW_DESERTROAD
      || lane.type === ROW_BUMPER || lane.type === ROW_CANNON || lane.type === ROW_ZHELI;
    const factor = (slow && lethal) ? 0.3 : 1;
    for (const car of lane.cars) {
      const move = lane.dir * lane.speed * factor * dt;
      car.mesh.position.x += move;
      // Roca rodante / bala de cañón: gira según avanza (rueda).
      if (car.roll && car.radius) car.mesh.rotation.z -= move / car.radius;
      // Serpiente: ondula los segmentos lateralmente.
      if (car.snake && car.mesh.userData.segments) {
        const segs = car.mesh.userData.segments;
        for (let i = 0; i < segs.length; i++) {
          segs[i].position.z = Math.sin(now * 6 + car.phase + i * 0.8) * 0.18;
        }
      }
      // Coche de choque: da bandazos y gira (movimiento caótico de feria).
      if (car.bumper) {
        // El morro apunta hacia donde circula + leve "serpenteo" de volante (no gira como peonza).
        const face = car.lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.mesh.position.z = Math.sin(now * 4 + car.phase) * 0.06;
        car.mesh.rotation.y = face + Math.sin(now * 3 + car.phase) * 0.12;
      }
      // Carrusel: la plataforma gira sobre sí misma mientras te lleva.
      if (car.spin) car.mesh.rotation.y += dt * 2.2;
      // Helicóptero zombi: rotor principal girando.
      if (car.heli && car.mesh.userData.rotor) car.mesh.userData.rotor.rotation.y += dt * 26;
      // Legendario: pulso brillante para que destaque a distancia.
      if (car.legendary && car.mesh.userData.legendaryGlow) {
        const pulse = 1.4 + Math.sin(now * 6) * 0.6;
        car.mesh.userData.legendaryGlow.material.emissiveIntensity = pulse;
      }
      // Reciclar al salir por un lado (efecto bucle infinito).
      if (lane.dir > 0 && car.mesh.position.x > limit) {
        car.mesh.position.x = -limit;
        car.nearDone = false; car.lastDx = Infinity; // puede volver a contar como "casi"
      } else if (lane.dir < 0 && car.mesh.position.x < -limit) {
        car.mesh.position.x = limit;
        car.nearDone = false; car.lastDx = Infinity;
      }
    }
  }
}

// Devuelve true si un power-up (invencible o escudo) absorbe un golpe letal.
// Centralizado para que los escudos/estrella protejan en TODOS los peligros
// (coches, río, lava, caídas, arenas, rayos...), no solo contra los coches.
function powerupAbsorbsHit(now) {
  if (invincibleActive(now)) return true;       // invencible: ignora el golpe
  if (power.shield) {                            // escudo: absorbe un golpe
    power.shield = false;
    power.invincibleUntil = now + 1.2;           // breve margen para apartarse
    updatePowerupHud(now);
    unlockAchievement("shieldsave");
    return true;
  }
  return false;
}

// Causa de muerte concreta según el tipo de carril letal (para los chistes).
function carCauseFor(laneType) {
  switch (laneType) {
    case ROW_BUMPER:     return "bumper";   // feria: coche de choque
    case ROW_CANNON:     return "cannon";   // feria: bala de cañón
    case ROW_ZHELI:      return "heli";     // nivel zombi: helicóptero
    case ROW_SKYROAD:    return "skycar";   // cielo: coche volador
    case ROW_DESERTROAD: return "desert";   // desierto: vehículo arenero
    default:             return "car";      // carretera normal
  }
}

function checkCollisions() {
  if (!playerState.alive || playerState.moving) return;
  const lane = rows.get(playerState.row);
  if (!lane) return;

  const px = playerState.col * TILE;

  if (lane.type === ROW_ROAD || lane.type === ROW_SKYROAD || lane.type === ROW_DESERTROAD
      || lane.type === ROW_BUMPER || lane.type === ROW_CANNON || lane.type === ROW_ZHELI) {
    const now = performance.now() / 1000;
    for (const car of lane.cars) {
      const dx = Math.abs(car.mesh.position.x - px);
      if (dx < car.halfWidth + 0.35) {
        if (powerupAbsorbsHit(now)) return;       // escudo/invencible salva del golpe
        return die(false, carCauseFor(lane.type)); // chiste según el vehículo
      }
    }
  } else if (lane.type === ROW_RIVER || lane.type === ROW_LAVA || lane.type === ROW_CLOUD || lane.type === ROW_CAROUSEL) {
    // En río/lava/cielo/carrusel hay que estar sobre una plataforma; si no, caes.
    let platform = null;
    for (const p of lane.cars) {
      const dx = Math.abs(p.mesh.position.x - px);
      if (dx < p.halfWidth + 0.1) { platform = p; break; }
    }
    if (!platform) {
      // El escudo/invencible también salva de ahogarse/quemarse/caer.
      const now = performance.now() / 1000;
      if (powerupAbsorbsHit(now)) return;
      // Causa según el terreno: lava, río, carrusel o caída al vacío (nube).
      const cause = lane.type === ROW_LAVA ? "lava"
        : lane.type === ROW_RIVER ? "river"
        : lane.type === ROW_CAROUSEL ? "carousel"
        : "fall";
      return die(true, cause); // hundimiento / caída al vacío
    }
    playerState.onLog = platform;
  }
}

// ----------------------------------------------------------------------------
//  BLOQUE 6 — DETECCIÓN DE "CASI" (NEAR-MISS)
//  Si un coche pasa muy cerca del pollo (sin tocarlo) mientras está quieto en
//  un carril letal, se cuenta como "casi": breve cámara lenta, partículas,
//  aviso "¡CASI!" y puntos extra con multiplicador por racha. Los legendarios
//  dan una recompensa mucho mayor.
// ----------------------------------------------------------------------------
function updateNearMiss(now) {
  if (!playerState.alive || playerState.moving) return;
  const lane = rows.get(playerState.row);
  if (!lane || !lane.cars) return;
  const lethal = lane.type === ROW_ROAD || lane.type === ROW_SKYROAD || lane.type === ROW_DESERTROAD
    || lane.type === ROW_BUMPER || lane.type === ROW_CANNON || lane.type === ROW_ZHELI;
  if (!lethal) return;

  const px = playerState.col * TILE;
  for (const car of lane.cars) {
    const dx = Math.abs(car.mesh.position.x - px);
    const hitBand = car.halfWidth + 0.35;       // si baja de aquí, es colisión (otro sistema)
    const nearBand = car.halfWidth + 1.05;      // banda de "roce" justo por fuera del golpe
    // Detectar el mínimo de acercamiento: el frame anterior estaba dentro de la
    // banda de roce y ahora se aleja → ese fue el punto más cercano.
    if (!car.nearDone && car.lastDx > hitBand && car.lastDx <= nearBand && dx > car.lastDx) {
      triggerNearMiss(car, now);
      car.nearDone = true;
    }
    car.lastDx = dx;
  }
}

function triggerNearMiss(car, now) {
  // Racha: si encadenas "casi" en poco tiempo, sube el multiplicador.
  if (now < nearMissComboUntil) nearMissCombo = Math.min(nearMissCombo + 1, 9);
  else nearMissCombo = 1;
  nearMissComboUntil = now + 2.6;

  const base = car.legendary ? 10 : 2;
  const gained = base * nearMissCombo;
  addBonusPoints(gained);
  runNearMiss++;

  // Pequeño golpe de cámara lenta para dar dramatismo.
  nearMissSlowUntil = now + (car.legendary ? 0.55 : 0.32);

  // Partículas en torno al pollo + aviso central.
  const col = car.legendary ? 0xffd700 : 0x00f0ff;
  spawnParticles(player.position.x, 0.6, player.position.z, col, car.legendary ? 18 : 10,
    { speed: 3, up: 2.5, life: 0.6 });
  showNearMissToast(car.legendary, nearMissCombo, gained);
  sfxNearMiss(car.legendary);
}

// Aviso central reutilizando el toast de power-ups.
function showNearMissToast(legendary, combo, gained) {
  if (!elToast) return;
  const color = legendary ? "#ffd700" : "#00f0ff";
  const label = legendary ? "¡LEGENDARIO!" : "¡CASI!";
  const comboTxt = combo > 1 ? "  x" + combo : "";
  elToast.style.setProperty("--toast-color", color);
  elToast.textContent = (legendary ? "👑 " : "💨 ") + label + comboTxt + "  +" + gained;
  elToast.classList.remove("show");
  void elToast.offsetWidth;
  elToast.classList.add("show");
}

// Si el jugador va montado en un tronco, se desplaza con él.
function updateLogRiding(dt) {
  const log = playerState.onLog;
  if (!log || playerState.moving) return;
  const lane = log.lane;
  player.position.x += lane.dir * lane.speed * dt;
  // Mantener sincronizada la columna lógica (aproximada) y comprobar límites.
  playerState.col = Math.round(player.position.x / TILE);
  if (player.position.x < -(COLS + 1) * TILE || player.position.x > (COLS + 1) * TILE) {
    die(true, "fall");
  }
}

// Avance forzado (mecánica del águila de Crossy Road).
// Una "línea de seguridad" trasera sube poco a poco; si te alcanza, pierdes.
const forced = { boundary: -5, baseSpeed: 0.42 };
function updateForcedAdvance(dt) {
  // La línea (el águila) persigue al jugador; se queda MÁS lejos (6 filas) y
  // sube más despacio que antes, para dar más margen.
  const target = playerState.maxRow - 6;
  const speed = forced.baseSpeed + Math.max(0, playerState.maxRow - forced.boundary) * 0.03;
  if (forced.boundary < target) {
    forced.boundary = Math.min(target, forced.boundary + speed * dt);
  }
  // AVISO: si el águila está a punto de alcanzarte (a <2 filas), parpadea el
  // borde rojo y aparece "¡MUÉVETE!" para que no te pille por sorpresa.
  const margin = playerState.row - forced.boundary;   // filas que te quedan
  if (elEagleWarn) {
    if (playerState.alive && margin < 2 && margin > -1) elEagleWarn.classList.add("show");
    else elEagleWarn.classList.remove("show");
  }
  // Si el jugador queda por detrás de la línea, game over (te pilla el águila).
  if (playerState.row < forced.boundary - 0.5) {
    die(false, "eagle");
  }
}

// ---- Arenas movedizas del nivel 5 ----
// Si el pollo se queda quieto sobre una casilla de arena movediza, se hunde
// poco a poco; si no se mueve a tiempo, cae y pierde.
let quicksandSink = 0;                 // progreso de hundimiento (0..1)
const QUICKSAND_SINK_TIME = 1.1;       // segundos quieto hasta hundirse del todo

function updateQuicksand(dt) {
  if (level !== 4) return;
  const lane = rows.get(playerState.row);
  const onQuick = lane && lane.type === ROW_QUICKSAND;
  // Solo cuenta si está quieto (no saltando) y vivo sobre arena movediza.
  if (onQuick && !playerState.moving && playerState.alive) {
    quicksandSink += dt / QUICKSAND_SINK_TIME;
    // Hundir visualmente el pollo dentro de la arena.
    player.position.y = -0.55 * Math.min(1, quicksandSink);
    if (quicksandSink >= 1) {
      quicksandSink = 0;
      // El escudo/invencibilidad también salva de la arena movediza.
      if (powerupAbsorbsHit(performance.now() / 1000)) {
        player.position.y = 0;
      } else {
        die(true, "sand");   // se hunde del todo: animación de caída + game over
      }
    }
  } else {
    // Al moverse o salir de la arena, recuperar la altura normal.
    quicksandSink = Math.max(0, quicksandSink - dt * 2.5);
    if (!playerState.moving) {
      player.position.y = -0.55 * Math.min(1, quicksandSink);
    }
  }
}

// ---- Tormentas de arena del nivel 5 ----
// Cada cierto tiempo la niebla se cierra (reduce visibilidad) y un velo de
// arena cubre la pantalla; luego se despeja gradualmente.
const elSandstorm = document.getElementById("sandstorm");
const elEagleWarn = document.getElementById("eagle-warning"); // aviso de "te alcanza el águila"
let stormStart = 0;       // instante en que empezó la tormenta actual
let stormDur = 0;         // duración de la tormenta actual
let nextStormAt = 0;      // instante de la próxima tormenta
const STORM_FOG_NEAR = 4; // niebla mínima durante la tormenta
const STORM_FOG_FAR = 13;

function scheduleNextStorm(now) {
  nextStormAt = now + 7 + Math.random() * 6;   // cada 7-13 s
  stormStart = 0;
  stormDur = 0;
}

function updateSandstorm(dt, now) {
  if (level !== 4) return;
  if (!scene.fog) return;

  // ¿Toca empezar una tormenta?
  if (stormDur === 0 && now >= nextStormAt) {
    stormStart = now;
    stormDur = 3.5 + Math.random() * 2.5;       // dura 3.5-6 s
  }

  if (stormDur > 0) {
    const t = (now - stormStart) / stormDur;    // 0..1 a lo largo de la tormenta
    if (t >= 1) {
      // Fin de la tormenta: restaurar visibilidad y programar la siguiente.
      scene.fog.near = FOG_NEAR;
      scene.fog.far = FOG_FAR;
      if (elSandstorm) elSandstorm.style.opacity = "0";
      scheduleNextStorm(now);
      return;
    }
    // Intensidad en forma de campana (sube y baja suavemente).
    const k = Math.sin(Math.PI * t);
    scene.fog.near = FOG_NEAR + (STORM_FOG_NEAR - FOG_NEAR) * k;
    scene.fog.far = FOG_FAR + (STORM_FOG_FAR - FOG_FAR) * k;
    if (elSandstorm) elSandstorm.style.opacity = (0.55 * k).toFixed(3);
  }
}

// ---- Rayos del nivel 4: avisan ~1 s antes y golpean una columna concreta. ----
const LIGHTNING_WARN = 1.0;    // segundos de aviso antes del impacto
const LIGHTNING_LETHAL = 0.35; // ventana letal del rayo

function makeLightningWarning(col) {
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe600, transparent: true, opacity: 0.6 })
  );
  ring.position.set(col * TILE, 0.03, 0);
  return ring;
}

function makeLightningBolt(col) {
  const bolt = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 6, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 1 })
  );
  bolt.position.set(col * TILE, 3, 0);
  return bolt;
}

function updateLightning(now) {
  for (const lane of rows.values()) {
    if (lane.type !== ROW_LIGHTNING) continue;

    // Programar un nuevo rayo.
    if (now >= lane.nextStrike) {
      const col = Math.round((Math.random() * 2 - 1) * COLS);
      const warning = makeLightningWarning(col);
      lane.group.add(warning);
      lane.strikes.push({
        col, struck: false,
        strikeTime: now + LIGHTNING_WARN,
        endTime: now + LIGHTNING_WARN + LIGHTNING_LETHAL,
        warning, bolt: null,
      });
      lane.nextStrike = now + 1.1 + Math.random() * 1.6;
    }

    for (let i = lane.strikes.length - 1; i >= 0; i--) {
      const s = lane.strikes[i];
      if (!s.struck) {
        // Aviso parpadeante (cada vez más intenso).
        s.warning.material.opacity = 0.35 + Math.abs(Math.sin(now * 12)) * 0.5;
        if (now >= s.strikeTime) {
          s.struck = true;
          s.bolt = makeLightningBolt(s.col);
          lane.group.add(s.bolt);
          lane.group.remove(s.warning);
          s.warning.geometry.dispose();
        }
      } else {
        // El rayo se desvanece.
        s.bolt.material.opacity = Math.max(0, (s.endTime - now) / LIGHTNING_LETHAL);
      }

      // Impacto letal: el pollo está en esa columna mientras cae el rayo.
      if (s.struck && now < s.endTime && !playerState.moving &&
          playerState.row === lane.row && playerState.col === s.col) {
        // El escudo/invencibilidad también salva del rayo.
        if (!powerupAbsorbsHit(now)) die(false, "lightning");
      }

      if (now >= s.endTime) {
        if (s.bolt) { lane.group.remove(s.bolt); s.bolt.geometry.dispose(); }
        lane.strikes.splice(i, 1);
      }
    }
  }
}

function die(sink = false, cause = "default") {
  if (!playerState.alive) return;
  playerState.alive = false;
  playerState.onLog = null;
  quicksandSink = 0;
  player.visible = true; // por si moría durante el parpadeo de invencibilidad
  player.scale.setScalar(1);
  coinDance.active = false;               // Bloque 9: cancelar bailecito si estaba activo
  heroPose.active = false; cocky = false; // Bloque 10: cancelar poses al morir
  player.rotation.x = 0;                   // (la muerte usa rotation.z para sus giros)
  powerPopUntil = 0;
  lastDeathCause = cause;                 // para el mensaje absurdo de Game Over
  deathX = player.position.x;             // dónde dejar el fantasmita
  deathZ = player.position.z;
  if (player.userData.aura) player.userData.aura.visible = false;
  if (elToast) elToast.classList.remove("show");

  // Feedback de muerte: sonido, vibración, parar motores/música y explosión.
  sfxCrash();
  vibrate(200);
  stopEngine();
  stopMusic();
  spawnParticles(player.position.x, 0.5, player.position.z,
    player.userData.bodyMaterial ? player.userData.bodyMaterial.color.getHex() : 0xffffff,
    22, { speed: 4, up: 3.5, life: 0.9 });

  if (sink) {
    if (level === 7) {
      // Nivel 7 (lava): el pollo salta y sale ASADO en vez de hundirse.
      startRoastDeath();
    } else if (level === 2) {
      // Nivel 2 (ríos): el pollo salta y sale CONGELADO en bloque de hielo.
      startFreezeDeath();
    } else {
      // El pollo se hunde (nube/carrusel) antes de mostrar Game Over.
      gameState = "dying";
    }
  } else {
    // Atropello/impacto: el pollo sale volando por los aires dando vueltas.
    startLaunchDeath();
  }
}

// Animación de hundimiento: el pollo baja y gira, luego muestra Game Over.
function updateDying(dt) {
  player.position.y -= dt * 2.2;
  player.rotation.z += dt * 4;
  if (player.position.y < -1.4) {
    gameState = "gameover";
    showGameOver();
  }
}

// --- Muerte en la LAVA (nivel 7): el pollo pega un salto y sale ASADO ---
let roastVy = 0; // velocidad vertical del saltito al asarse
function startRoastDeath() {
  gameState = "roasting";
  roastVy = 7.5;                 // impulso del salto hacia arriba
  // Convertir el pollo en POLLO ASADO: cuerpo dorado tostado y reluciente.
  const bm = player.userData.bodyMaterial;
  if (bm) {
    bm.color.setHex(0xae6a2e);
    bm.emissive.setHex(0x3a1500);
    bm.emissiveIntensity = 0.3;
    bm.metalness = 0.2;
    bm.roughness = 0.45;
  }
  // Al asarse se le cae el accesorio de la skin (cerebro, gorro, etc.).
  if (player.userData.skinAccessory) {
    player.remove(player.userData.skinAccessory);
    player.userData.skinAccessory.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    player.userData.skinAccessory = null;
  }
  player.scale.setScalar(1.18);  // "puff" al tostarse
  // Llamarada de la lava + humo del asado.
  spawnParticles(player.position.x, 0.4, player.position.z, 0xff7a1e, 16, { speed: 4, up: 4.5, life: 0.7 });
  spawnParticles(player.position.x, 0.6, player.position.z, 0x555555, 10, { speed: 2, up: 3, life: 1.1 });
  sfxSizzle();
}

// Animación del pollo asado: salta, voltereta en el aire y cae de nuevo.
function updateRoasting(dt) {
  roastVy -= dt * 18;                    // gravedad
  player.position.y += roastVy * dt;     // salto y posterior caída
  player.rotation.x += dt * 7;           // voltereta en el aire
  player.rotation.z += dt * 4;
  // Devolver el "puff" al tamaño normal de forma suave.
  const s = player.scale.x + (1 - player.scale.x) * Math.min(1, dt * 4);
  player.scale.setScalar(s);
  // Humillo intermitente mientras cae.
  if (Math.random() < 0.3) {
    spawnParticles(player.position.x, player.position.y + 0.4, player.position.z,
      0x666666, 2, { speed: 1, up: 2, life: 0.8 });
  }
  if (player.position.y < -1.6) {        // vuelve a hundirse en la lava
    gameState = "gameover";
    showGameOver();
  }
}

// --- Muerte en el RÍO (nivel 2): el pollo salta y sale CONGELADO en hielo ---
// Bloque de hielo translúcido con púas que envuelve al pollo.
function buildIceEncasement() {
  const g = new THREE.Group();
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0xbff0ff, transparent: true, opacity: 0.45,
    roughness: 0.1, metalness: 0.3, emissive: 0x4aa6ff, emissiveIntensity: 0.3,
  });
  // Bloque de hielo que rodea el cuerpo.
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.3, 0.95), iceMat);
  block.position.y = 0.62;
  g.add(block);
  // Cristales/púas de hielo apuntando hacia fuera.
  const spikeMat = new THREE.MeshStandardMaterial({
    color: 0xdff7ff, transparent: true, opacity: 0.75,
    roughness: 0.1, metalness: 0.4, emissive: 0x66c2ff, emissiveIntensity: 0.4,
  });
  const spikes = [
    [0.5, 0.9, 0.2, 0.45, 0.6], [-0.46, 0.5, -0.3, 0.5, -0.4],
    [0.28, 1.3, -0.18, 0.5, 0.2], [-0.3, 1.1, 0.36, 0.55, -0.3],
    [0.2, 0.18, 0.5, 0.4, 0.5], [-0.2, 0.7, 0.5, 0.4, 0.3],
  ];
  for (const [x, y, z, len, rot] of spikes) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.1, len, 5), spikeMat);
    sp.position.set(x, y, z);
    sp.rotation.set(rot, 0, rot);
    g.add(sp);
  }
  return g;
}

let freezeVy = 0; // velocidad vertical del saltito al congelarse
function startFreezeDeath() {
  gameState = "freezing";
  freezeVy = 7.5;                // impulso del salto hacia arriba
  // Cuerpo congelado: azul hielo brillante.
  const bm = player.userData.bodyMaterial;
  if (bm) {
    bm.color.setHex(0xbff0ff);
    bm.emissive.setHex(0x4aa6ff);
    bm.emissiveIntensity = 0.35;
    bm.metalness = 0.6;
    bm.roughness = 0.12;
  }
  // Al congelarse se le cubre el accesorio de la skin.
  if (player.userData.skinAccessory) {
    player.remove(player.userData.skinAccessory);
    player.userData.skinAccessory.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    player.userData.skinAccessory = null;
  }
  // Encajar el bloque de hielo alrededor del pollo.
  if (player.userData.iceEncasement) player.remove(player.userData.iceEncasement);
  const ice = buildIceEncasement();
  player.add(ice);
  player.userData.iceEncasement = ice;
  player.scale.setScalar(1.12); // ligero "puff" al congelarse
  // Escarcha y copos al congelarse.
  spawnParticles(player.position.x, 0.6, player.position.z, 0xbff0ff, 16, { speed: 3, up: 3.5, life: 0.9 });
  spawnParticles(player.position.x, 0.5, player.position.z, 0xffffff, 8, { speed: 2, up: 2.5, life: 1.0 });
  sfxFreeze();
}

// Animación del pollo congelado: salta y cae rígido girando como un témpano.
function updateFreezing(dt) {
  freezeVy -= dt * 18;                    // gravedad
  player.position.y += freezeVy * dt;     // salto y posterior caída
  player.rotation.y += dt * 3;            // gira rígido sobre sí mismo
  player.rotation.z += dt * 1.5;          // leve vuelco
  // Devolver el "puff" al tamaño normal de forma suave.
  const s = player.scale.x + (1 - player.scale.x) * Math.min(1, dt * 4);
  player.scale.setScalar(s);
  if (player.position.y < -1.6) {         // vuelve a hundirse en el río
    gameState = "gameover";
    showGameOver();
  }
}

// --- Planta carnívora (nivel 5): se abalanza y se ENGULLE al pollo ---
let eatingPlant = null; // planta que está comiéndose al pollo
let eatTimer = 0;
function startPlantEat(plant) {
  if (!playerState.alive) return;
  playerState.alive = false;
  playerState.onLog = null;
  quicksandSink = 0;
  powerPopUntil = 0;
  player.scale.setScalar(1);
  lastDeathCause = "plant";       // mensaje absurdo "la planta solo quería..."
  deathX = player.position.x;
  deathZ = player.position.z;
  if (player.userData.aura) player.userData.aura.visible = false;
  if (elToast) elToast.classList.remove("show");
  // Feedback: chasquido de la planta + impacto + parar motores/música.
  sfxPlant();
  sfxCrash();
  vibrate(200);
  stopEngine();
  stopMusic();
  spawnParticles(player.position.x, 0.6, player.position.z, 0x8a1f3a, 18,
    { speed: 3, up: 2.5, life: 0.6 });
  eatingPlant = plant;
  eatTimer = 0;
  gameState = "eaten";
}

// Animación: la planta da dentelladas mientras el pollo es succionado a la boca.
function updateEaten(dt) {
  eatTimer += dt;
  const p = eatingPlant;
  if (p && p.mesh) {
    const m = p.mesh;
    // Saltito de la planta al abalanzarse sobre el pollo.
    m.position.y = Math.sin(Math.min(eatTimer, 0.3) / 0.3 * Math.PI) * 0.5;
    // Dentelladas rápidas que se cierran sobre la presa.
    const chomp = Math.abs(Math.sin(eatTimer * 26)) * 0.18;
    if (m.userData.upper) m.userData.upper.position.y = 0.82 - chomp;
    if (m.userData.lower) m.userData.lower.position.y = 0.63 + chomp;
  }
  // El pollo es engullido: sube hacia la boca, se revuelve y se encoge.
  const k = Math.min(1, eatTimer / 0.35);
  player.position.y = 0.2 + k * 0.5;
  player.rotation.z += dt * 14;
  player.scale.setScalar(Math.max(0.001, 1 - k));
  if (eatTimer > 0.85) {
    player.visible = false;   // ya está dentro de la planta
    gameState = "gameover";
    showGameOver();
  }
}

// --- Muerte por ATROPELLO/IMPACTO: el pollo sale volando por los aires dando
// vueltas de forma exagerada antes del Game Over (coches, tren, rayos, etc.) ---
let launchVy = 0;
const launchVel = new THREE.Vector3();
const launchSpin = new THREE.Vector3();
function startLaunchDeath() {
  gameState = "launched";
  setPanic(true); // sigue con cara de pánico mientras vuela
  player.scale.setScalar(1);
  // Impulso muy exagerado: arriba del todo + deriva lateral aleatoria.
  launchVel.set((Math.random() - 0.5) * 5, 12 + Math.random() * 2, (Math.random() - 0.5) * 5);
  // Giro descontrolado en los tres ejes.
  const rnd = () => (Math.random() < 0.5 ? -1 : 1);
  launchSpin.set((4 + Math.random() * 3) * rnd(), (3 + Math.random() * 3) * rnd(), (5 + Math.random() * 4) * rnd());
  spawnParticles(player.position.x, 0.6, player.position.z, 0xffffff, 14, { speed: 4, up: 4, life: 0.7 });
}
function updateLaunched(dt) {
  launchVel.y -= dt * 22;                 // gravedad fuerte
  player.position.x += launchVel.x * dt;
  player.position.y += launchVel.y * dt;
  player.position.z += launchVel.z * dt;
  player.rotation.x += launchSpin.x * dt; // vueltas y más vueltas
  player.rotation.y += launchSpin.y * dt;
  player.rotation.z += launchSpin.z * dt;
  if (player.position.y < -1.6) {
    gameState = "gameover";
    showGameOver();
  }
}

// --- Cara de pánico: se enciende/apaga la mueca dramática del pollo ---
function setPanic(on) {
  if (player.userData.panicFace) player.userData.panicFace.visible = on;
}
// Detección predictiva: si un coche (o el tren) está a punto de arrollar al
// pollo mientras está quieto en un carril letal, pone cara de pánico.
function updatePanic() {
  if (gameState !== "playing") return;
  let panic = false;
  if (playerState.alive && !playerState.moving) {
    const lane = rows.get(playerState.row);
    const px = playerState.col * TILE;
    const lethal = lane && (lane.type === ROW_ROAD || lane.type === ROW_SKYROAD
      || lane.type === ROW_DESERTROAD || lane.type === ROW_BUMPER
      || lane.type === ROW_CANNON || lane.type === ROW_ZHELI);
    if (lethal && lane.cars) {
      for (const car of lane.cars) {
        const toPlayer = px - car.mesh.position.x;
        if (toPlayer * lane.dir > 0) {                 // el coche viene hacia ti
          const dist = Math.abs(toPlayer);
          const tti = dist / (lane.speed || 1);        // tiempo estimado al impacto
          if (tti < 0.6 && dist > car.halfWidth) { panic = true; break; }
        }
      }
    }
    if (!panic && lane && lane.type === ROW_ZTRAIN && lane.train) {
      const toP = px - lane.train.position.x;
      const dir = Math.sign(lane.train.userData.vx || 1);
      if (toP * dir > 0 && Math.abs(toP) / 8 < 0.7) panic = true;
    }
  }
  setPanic(panic);
}

// --- Fantasmita del pollo: al morir, sube flotando y se despide con el ala ---
let deathGhost = null;
let ghostT = 0;
let deathX = 0, deathZ = 0; // posición donde aparece el fantasmita
function buildDeathGhost() {
  const g = new THREE.Group();
  const matGhost = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.75,
    emissive: 0xaecbff, emissiveIntensity: 0.45, roughness: 0.6,
  });
  const mats = [matGhost];
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), matGhost);
  body.position.y = 0.3; body.scale.set(1, 1.15, 1); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), matGhost);
  head.position.set(0, 0.62, 0.05); g.add(head);
  // Cola fantasmal ondulada (tres puntas hacia abajo).
  for (const dx of [-0.16, 0, 0.16]) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8), matGhost);
    tip.position.set(dx, 0.02, 0); tip.rotation.x = Math.PI; g.add(tip);
  }
  // Crestita tenue.
  const combMat = new THREE.MeshStandardMaterial({ color: 0xff9bb0, transparent: true, opacity: 0.7 });
  mats.push(combMat);
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.06), combMat);
    p.position.set(0, 0.8, 0.08 - i * 0.07); g.add(p);
  }
  // Pico.
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xffc36b, transparent: true, opacity: 0.85 });
  mats.push(beakMat);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.1), beakMat);
  beak.position.set(0, 0.58, 0.24); g.add(beak);
  // Ojos dulces.
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222, transparent: true, opacity: 0.85 });
  mats.push(eyeMat);
  for (const dx of [-0.07, 0.07]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.04), eyeMat);
    e.position.set(dx, 0.65, 0.18); g.add(e);
  }
  // Ala que dice "adiós" (pivote en el hombro derecho).
  const wingPivot = new THREE.Group();
  wingPivot.position.set(0.3, 0.45, 0);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.18), matGhost);
  wing.position.set(0.04, 0.06, 0);
  wingPivot.add(wing); g.add(wingPivot);
  g.userData.wing = wingPivot;
  g.userData.mats = mats;
  return g;
}
function spawnDeathGhost(x, z) {
  removeDeathGhost();
  const ghost = buildDeathGhost();
  ghost.position.set(x, 0.4, z);
  scene.add(ghost);
  deathGhost = ghost;
  ghostT = 0;
}
function removeDeathGhost() {
  if (!deathGhost) return;
  scene.remove(deathGhost);
  deathGhost.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  if (deathGhost.userData.mats) deathGhost.userData.mats.forEach((m) => m.dispose());
  deathGhost = null;
}
function updateGhost(dt, now) {
  if (!deathGhost) return;
  ghostT += dt;
  deathGhost.position.y += dt * 0.7;                       // sube flotando
  deathGhost.position.x += Math.sin(now * 1.6) * dt * 0.4; // vaivén suave
  deathGhost.rotation.y = Math.sin(now * 1.2) * 0.25;
  // Agita el ala despidiéndose.
  if (deathGhost.userData.wing) {
    deathGhost.userData.wing.rotation.z = -0.6 - Math.abs(Math.sin(now * 7)) * 0.9;
  }
  // Se desvanece poco a poco.
  const fade = Math.max(0, 1 - ghostT / 3.4);
  if (deathGhost.userData.mats) {
    deathGhost.userData.mats.forEach((m) => {
      m.opacity = (m === deathGhost.userData.mats[0] ? 0.75 : 0.85) * fade;
    });
  }
  if (ghostT > 3.6) removeDeathGhost();
}

// Mensajes absurdos al morir, agrupados por causa de la muerte.
const DEATH_MESSAGES = {
  car: [
    "Te ha pillado un Ferrari mientras mirabas Instagram 📱",
    "Cruzaste mirando el móvil. Clásico error de pollo 🐔📵",
    "El deportivo tenía prisa... tú ya no 🚗💨",
    "Un coche del futuro te usó de badén.",
    "Mirabas a ambos lados... menos al que venía.",
  ],
  zombie: [
    "El zombi solo quería un abrazo 🧟🤗",
    "Te confundieron con un nugget no-muerto.",
    "El zombi te invitó a cenar. Eras el menú.",
    "Cerebro de pollo: el manjar favorito del zombi.",
  ],
  train: [
    "El tren no frena por pollos, lo siento 🚄",
    "Llegaste puntual... al andén equivocado.",
    "Chuuu-chuuu... ¡crunch!",
  ],
  plant: [
    "La planta solo quería pollo ecológico 🌱",
    "Te convertiste en abono premium.",
    "La planta dijo: '¡rico, rico!' 😋",
  ],
  lava: [
    "Te diste un bañito en lava. Estaba calentita 🌋",
    "Pollo a la brasa, término MUY hecho.",
    "Spoiler: la lava quema.",
  ],
  lavamonster: [
    "Un monstruo de lava salió del suelo y te abrazó 🔥",
    "El golem de lava quería pollo a la piedra 🪨🔥",
    "Te pilló un bicho de lava. Pollo achicharrado.",
    "Salió de la lava solo para asarte. Qué detalle.",
    "Roca + fuego + pollo despistado = barbacoa.",
  ],
  river: [
    "Frío, frío... ¡congelado! 🧊",
    "Quisiste nadar. El río dijo que no.",
    "Polo de pollo, sabor original.",
  ],
  fall: [
    "Mira, mamá, ¡sé vola...! 🕳️",
    "El suelo era opcional. Mala elección.",
    "Plataforma 1 - Pollo 0.",
  ],
  sand: [
    "Las arenas movedizas te tragaron enterito 🏜️",
    "Te quedaste pensando y el desierto te merendó.",
  ],
  lightning: [
    "Zap. Pollo frito por cortesía del cielo ⚡",
    "Estabas cargadito de razón... y de voltios.",
  ],
  eagle: [
    "Te dormiste en los laureles (y en la carretera) 🦅",
    "Por lento, la línea te alcanzó. ¡Corre más!",
  ],
  // --- Nivel 3: baldosas / cielo (coches voladores) ---
  skycar: [
    "Te atropelló un coche... ¡VOLADOR! El futuro es así 🚙💨",
    "Las baldosas del cielo no perdonan despistes ☁️",
    "Chocaste con el tráfico aéreo. ¿Quién conduce eso? 🛸",
    "Un platillo con prisa te mandó a las nubes... para siempre.",
  ],
  // --- Nivel 4: desierto (todoterrenos) ---
  desert: [
    "Un todoterreno te arrolló entre dunas 🏜️🚙",
    "El jeep del desierto no te vio. Ni te buscó.",
    "Polvo eras... y en polvo te dejó la rueda.",
    "Cruzar el desierto a lo loco: error de pollo.",
  ],
  // --- Nivel 5: zombi (helicóptero) ---
  heli: [
    "Las aspas del helicóptero hicieron paté de pollo 🚁",
    "Te metiste bajo el helicóptero zombi. Mal plan.",
    "Helicóptero 1 - Plumas 0.",
    "Fiuuu-fiuuu... ¡y a volar las plumas! 🪶",
  ],
  // --- Nivel 6: circo (coches de choque) ---
  bumper: [
    "¡Un coche de choque del circo te hizo CRACK! 🎪🚗",
    "En el circo el que choca eres tú, no ellos.",
    "Te dieron de lleno entre confeti y bocinas 🎉",
    "Coche de feria: pequeño, pero te dejó plano.",
  ],
  // --- Nivel 6: circo (cañón humano) ---
  cannon: [
    "Saliste disparado del cañón... sin red 🎪💥",
    "¡BOOM! Pollo bala de cañón, sin aterrizaje.",
    "El cañón del circo te lanzó al estrellato (literal).",
    "Volar molaba... hasta que se acabó el vuelo.",
  ],
  // --- Nivel 6: circo (carrusel) ---
  carousel: [
    "El carrusel te mareó y te tiró de cabeza 🎠",
    "Diste demasiadas vueltas. El circo gana.",
    "Caballito arriba, pollo abajo. Game over 🎪",
    "El tiovivo no era tan inofensivo, ¿eh?",
  ],
  default: [
    "Y así, sin más, dejaste de ser pollo.",
    "Game over, pero con muchísimo estilo.",
    "La física ganó. Como siempre.",
    "Ni idea de qué pasó, pero estás más tieso que un palo.",
  ],
};
let lastDeathCause = "default";

// ----------------------------------------------------------------------------
// 9. CÁMARA, HUD, ESTADOS Y BUCLE PRINCIPAL
// ----------------------------------------------------------------------------
// Fila a la que mira la cámara. Con "zona muerta": el pollo puede avanzar
// CAM_UP filas (subiendo por la pantalla) sin que el terreno se desplace; la
// vista solo se mueve cuando el pollo llega cerca del borde superior.
let camLookRow = 0;
const CAM_UP = 5;

function updateCamera() {
  // Empujar la vista solo si el pollo sale de la zona muerta por delante.
  if (playerState.maxRow > camLookRow + CAM_UP) {
    camLookRow = playerState.maxRow - CAM_UP;
  }

  const lookZ = -camLookRow * TILE;
  const targetX = CAM_OFFSET.x + player.position.x * 0.35; // leve seguimiento lateral

  camera.position.x += (targetX - camera.position.x) * 0.12;
  camera.position.y = CAM_OFFSET.y;
  camera.position.z += (lookZ + CAM_OFFSET.z - camera.position.z) * 0.12;

  const lookX = camera.position.x - CAM_OFFSET.x;
  const camLookZ = camera.position.z - CAM_OFFSET.z;
  camera.lookAt(lookX, 0, camLookZ);
  // Mover el foco del sol con la cámara para que las sombras se mantengan.
  sun.position.set(lookX + 10, 18, camLookZ + 8);
  sun.target.position.set(lookX, 0, camLookZ);
}

// ---- HUD / estado ----
let gameState = "start"; // "start" | "playing" | "launched" | "dying" | "roasting" | "freezing" | "eaten" | "gameover" | "levelComplete" | "won"
let best = 0;
let prevBest = 0; // récord al empezar la partida (para el mensaje de Game Over)

const elScore = document.getElementById("score");
const elBest = document.getElementById("best");
const elCoins = document.getElementById("coins");
const elLevel = document.getElementById("level-label");
const elHud = document.getElementById("hud");
const elStart = document.getElementById("start-screen");
const elGameOver = document.getElementById("gameover-screen");
const elFinal = document.getElementById("final-score");
const elBestScore = document.getElementById("best-score");
const elGameOverMsg = document.getElementById("gameover-msg");
const elTouch = document.getElementById("touch-controls");
const elPowerups = document.getElementById("powerup-bar");
const elToast = document.getElementById("powerup-toast");
const elMessage = document.getElementById("message-screen");
const elMsgTitle = document.getElementById("message-title");
const elMsgSub = document.getElementById("message-subtitle");
const elMsgBtn = document.getElementById("message-btn");

function setScore(v) {
  // La puntuación mostrada combina la distancia avanzada y los puntos extra
  // de "casi" (near-miss) del nivel actual.
  const total = v + runBonus;
  elScore.textContent = total;
  if (total > best) {
    best = total;
    elBest.textContent = "Récord: " + best;
    saveProgress();
  }
}

// Suma puntos extra (por "casi") y refresca el marcador.
function addBonusPoints(p) {
  runBonus += p;
  setScore(playerState.maxRow);
}

// Bloque 7: guarda la mejor puntuación alcanzada en un nivel concreto.
function recordLevelBest(lvl, score) {
  const key = String(lvl);
  if (!stats.bestByLevel[key] || score > stats.bestByLevel[key]) {
    stats.bestByLevel[key] = score;
    saveProgress();
  }
}

function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

// ----------------------------------------------------------------------------
//  BLOQUE 2 — COLECCIONABLES Y DESBLOQUEABLES
//  · Monedas persistentes (cartera) en localStorage.
//  · Tienda de skins del pollo (comprar/equipar).
//  · Logros/medallas con aviso y pantalla de medallero.
//  Todo se guarda en localStorage para que perdure entre sesiones.
// ----------------------------------------------------------------------------
const STORAGE_KEY = "turboPollito.save.v1";

// Estado persistente (se rellena en loadSave()).
let walletCoins = 0;            // monedas totales acumuladas (cartera)
let equippedSkin = "classic";   // skin equipada
let ownedSkins = new Set(["classic"]);
let unlockedAch = new Set();

// ---- BLOQUE 4: progresión (XP/nivel) y misiones semanales ----
let totalXp = 0;                 // experiencia total acumulada (persistente)
let playerLevel = 1;            // nivel del jugador (derivado de totalXp)
let weekId = 0;                 // identificador de la semana de las misiones activas
let weeklyStats = { lanes: 0, coins: 0, levels: 0, powerups: 0, games: 0, flying: 0 };
let missionsClaimed = new Set(); // ids de misiones ya cobradas esta semana
let missions = [];              // misiones activas (deterministas por semana)
let missionScreenOpen = false;

// Estado de seguimiento de la partida en curso (para logros).
let runLanes = 0;       // carriles cruzados en toda la partida (todos los niveles)
let runFlying = 0;      // vehículos voladores esquivados en la partida
let runPowerups = 0;    // power-ups recogidos en la partida
let levelNoStop = true; // ¿se ha completado el nivel sin pararse?
let lastMoveAt = 0;     // instante del último movimiento
const NOSTOP_IDLE = 1.5; // segundos quieto que cuentan como "parón"

// ---- Bloque 7: estadísticas persistentes a largo plazo ----
// games        : partidas jugadas
// bestByLevel  : mejor puntuación por nivel { "1": 18, ... }
// bestStreak   : mejor racha de carriles cruzados sin parar
// carsDodged   : coches esquivados en total (cruces de carriles letales)
// coinsTotal   : monedas recogidas en total (histórico, no la cartera actual)
// distance     : distancia total recorrida (carriles avanzados en todas las partidas)
let stats = { games: 0, bestByLevel: {}, bestStreak: 0, carsDodged: 0, coinsTotal: 0, distance: 0 };
let runStreak = 0;      // racha actual de carriles cruzados sin pararse

let shopScreenOpen = false;
let achScreenOpen = false;
let statsScreenOpen = false;
let albumScreenOpen = false;

// ---- Catálogo de skins ----
// "classic" usa el color por nivel; el resto fijan aspecto propio.
const SKINS = {
  classic:   { name: "Clásico",    price: 0,  swatch: "#ffd21a" },
  neon:      { name: "Neón",       price: 20, swatch: "#ff2bd6", color: 0xff2bd6, emissive: 0xff2bd6, glow: 0.7, metal: 0.2, rough: 0.4 },
  astronaut: { name: "Astronauta", price: 35, swatch: "#eaf0ff", color: 0xeef3ff, metal: 0.1, rough: 0.5, accessory: buildHelmet },
  golden:    { name: "Dorado",     price: 50, swatch: "#ffd700", color: 0xffd700, emissive: 0x4a3a00, glow: 0.25, metal: 0.9, rough: 0.2 },
  robot:     { name: "Robot",      price: 40, swatch: "#9aa3b2", color: 0x9aa3b2, emissive: 0x223044, glow: 0.3, metal: 0.85, rough: 0.3, accessory: buildAntenna },
  ninja:     { name: "Ninja",      price: 30, swatch: "#2b2f38", color: 0x2b2f38, metal: 0.1, rough: 0.7, accessory: buildHeadband },
  vaquero:   { name: "Vaquero",    price: 30, swatch: "#c8954b", color: 0xc8954b, metal: 0.05, rough: 0.8, accessory: buildHat },
  zombie:    { name: "Zombi",      price: 35, swatch: "#7faa55", color: 0x7faa55, emissive: 0x143a0a, glow: 0.28, metal: 0.05, rough: 0.95, accessory: buildZombieBrain },
  diablo:    { name: "Diablo",     price: 45, swatch: "#e21d2b", color: 0xd11020, emissive: 0xff2200, glow: 0.6, metal: 0.2, rough: 0.5, accessory: buildHorns },
  rey:       { name: "Rey",        price: 60, swatch: "#8a4bff", color: 0x8a4bff, emissive: 0x2a0a55, glow: 0.4, metal: 0.4, rough: 0.4, accessory: buildCrown },
  angel:     { name: "Ángel",      price: 55, swatch: "#fbfff0", color: 0xfcffe8, emissive: 0xfff4c0, glow: 0.3, metal: 0.1, rough: 0.4, accessory: buildHalo },
  fiesta:    { name: "Fiesta",     price: 40, swatch: "#ff3ea5", color: 0xff66c2, emissive: 0xff2bd6, glow: 0.55, metal: 0.3, rough: 0.4, accessory: buildPartyHat },
  fuego:     { name: "Fuego",      price: 50, swatch: "#ff6a00", color: 0xff6a00, emissive: 0xff3000, glow: 0.9, metal: 0.2, rough: 0.4 },
  hielo:     { name: "Hielo",      price: 50, swatch: "#bff0ff", color: 0xbff0ff, emissive: 0x4aa6ff, glow: 0.4, metal: 0.7, rough: 0.15 },
  pirata:    { name: "Pirata",     price: 40, swatch: "#3a2a1a", color: 0x5a4632, metal: 0.1, rough: 0.8, accessory: buildPirateHat },
  mago:      { name: "Mago",       price: 55, swatch: "#5a32c8", color: 0x5a32c8, emissive: 0x3a1a88, glow: 0.5, metal: 0.3, rough: 0.4, accessory: buildWizardHat },
  punk:      { name: "Punk",       price: 45, swatch: "#1c1c22", color: 0x222228, emissive: 0x00303a, glow: 0.25, metal: 0.4, rough: 0.5, accessory: buildMohawk },
  chef:      { name: "Chef",       price: 35, swatch: "#f0f0f0", color: 0xf4f4f4, metal: 0.05, rough: 0.7, accessory: buildChefHat },
  arcoiris:  { name: "Arcoíris",   price: 65, swatch: "#ff00cc", color: 0xff44dd, emissive: 0x00ffd0, glow: 0.85, metal: 0.5, rough: 0.25, reqLevel: 5 },
  galaxia:   { name: "Galaxia",    price: 70, swatch: "#1a0a4a", color: 0x2a1060, emissive: 0x6a2bff, glow: 0.7, metal: 0.6, rough: 0.3, reqLevel: 8 },
  samurai:   { name: "Samurái",    price: 55, swatch: "#b3122a", color: 0xb3122a, emissive: 0x3a0008, glow: 0.2, metal: 0.5, rough: 0.4, accessory: buildKabuto },
  vikingo:   { name: "Vikingo",    price: 45, swatch: "#9a8a6a", color: 0x9a8a6a, metal: 0.4, rough: 0.7, accessory: buildVikingHelmet },
  detective: { name: "Detective",  price: 40, swatch: "#6b5a3a", color: 0x7a684a, metal: 0.1, rough: 0.8, accessory: buildDetectiveHat },
  graduado:  { name: "Graduado",   price: 35, swatch: "#1c1c28", color: 0x23232f, metal: 0.2, rough: 0.6, accessory: buildGradCap },
  unicornio: { name: "Unicornio",  price: 65, swatch: "#ffd6f5", color: 0xffe2f7, emissive: 0xff9ae0, glow: 0.45, metal: 0.3, rough: 0.35, accessory: buildUnicornHorn },
  buzo:      { name: "Buzo",       price: 40, swatch: "#1f7fb5", color: 0x1f7fb5, emissive: 0x0a3a55, glow: 0.25, metal: 0.4, rough: 0.5, accessory: buildSnorkel },
  flores:    { name: "Flores",     price: 45, swatch: "#7bbf4a", color: 0x6fae44, metal: 0.05, rough: 0.8, accessory: buildFlowerCrown },
  cyber:     { name: "Cyber",      price: 60, swatch: "#0affc8", color: 0x16323a, emissive: 0x00ffc8, glow: 0.6, metal: 0.8, rough: 0.25, accessory: buildVisor, reqLevel: 6 },
  // ---- Bloque 8: skins nuevas ----
  esqueleto: { name: "Esqueleto",  price: 45, swatch: "#eef0f2", color: 0xeef0f2, emissive: 0x223040, glow: 0.25, metal: 0.1, rough: 0.5 },
  lava:      { name: "Lava",       price: 55, swatch: "#ff4400", color: 0x2a0a06, emissive: 0xff4400, glow: 1.0, metal: 0.3, rough: 0.5, reqLevel: 4 },
  chicle:    { name: "Chicle",     price: 35, swatch: "#ff77c8", color: 0xff8fd4, emissive: 0xff5db1, glow: 0.4, metal: 0.2, rough: 0.4 },
  esmeralda: { name: "Esmeralda",  price: 70, swatch: "#1fd97a", color: 0x18c46e, emissive: 0x0aff8a, glow: 0.7, metal: 0.7, rough: 0.2, reqLevel: 6 },
  obsidiana: { name: "Obsidiana",  price: 60, swatch: "#15151c", color: 0x101018, emissive: 0x3a1a66, glow: 0.3, metal: 0.9, rough: 0.15 },
  militar:   { name: "Militar",    price: 40, swatch: "#4a5a32", color: 0x55683a, metal: 0.2, rough: 0.8, accessory: buildArmyHelmet },
  dj:        { name: "DJ",         price: 45, swatch: "#1a1a22", color: 0x23232f, emissive: 0xff2bd6, glow: 0.3, metal: 0.4, rough: 0.5, accessory: buildHeadphones },
  princesa:  { name: "Princesa",   price: 50, swatch: "#ffc2e8", color: 0xffd0ee, emissive: 0xff9ad6, glow: 0.35, metal: 0.3, rough: 0.4, accessory: buildTiara },
  navidad:   { name: "Navidad",    price: 40, swatch: "#d11020", color: 0xd11020, emissive: 0x3a0008, glow: 0.2, metal: 0.1, rough: 0.7, accessory: buildSantaHat },
  invierno:  { name: "Invierno",   price: 35, swatch: "#9fd0ff", color: 0xcfe6ff, metal: 0.2, rough: 0.6, accessory: buildBeanie },
  bufon:     { name: "Bufón",      price: 45, swatch: "#9b2bff", color: 0x8a2be2, emissive: 0x4a0a88, glow: 0.4, metal: 0.3, rough: 0.5, accessory: buildJester },
  nerd:      { name: "Nerd",       price: 35, swatch: "#ff3b3b", color: 0xf0d6a0, metal: 0.05, rough: 0.7, accessory: buildPropeller },
  espartano: { name: "Espartano",  price: 65, swatch: "#c88a3a", color: 0xb87a2e, emissive: 0x3a2400, glow: 0.25, metal: 0.6, rough: 0.4, accessory: buildSpartanHelmet, reqLevel: 7 },
  panda:     { name: "Panda",      price: 45, swatch: "#f4f4f4", color: 0xf6f6f6, metal: 0.05, rough: 0.75, accessory: buildPandaEars },
  conejo:    { name: "Conejo",     price: 40, swatch: "#f6f2f0", color: 0xf6f2f0, metal: 0.05, rough: 0.8, accessory: buildBunnyEars },
  // ---- BLOQUE 11 (Parte 6): skin LEGENDARIA EXCLUSIVA, solo por vencer al jefe ----
  // No se compra (price 0 + exclusive). Es "todos los niveles juntos": cuerpo de
  // plumas claras envuelto por bandas de los 7 niveles + emblemas que orbitan +
  // corona, y la escolta de pollos guardaespaldas con esmoquin (updateLegendaryFx).
  cosmico:   { name: "Pollo Divino", price: 0, swatch: "rainbow", color: 0xffd24a, emissive: 0xffb020, glow: 0.7, metal: 0.9, rough: 0.15, accessory: buildLegendaryAura, exclusive: true, legendary: true },
};
const SKIN_ORDER = ["cosmico", "classic", "neon", "astronaut", "golden", "robot", "ninja", "vaquero", "zombie", "diablo", "rey", "angel", "fiesta", "fuego", "hielo", "pirata", "mago", "punk", "chef", "arcoiris", "galaxia", "samurai", "vikingo", "detective", "graduado", "unicornio", "buzo", "flores", "cyber", "esqueleto", "lava", "chicle", "esmeralda", "obsidiana", "militar", "dj", "princesa", "navidad", "invierno", "bufon", "nerd", "espartano", "panda", "conejo"];

// Accesorios de skin (se cuelgan del pollo en coordenadas locales).
function buildHelmet() {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.3 })
  );
  dome.position.set(0, 1.16, 0.34);
  g.add(dome);
  return g;
}
function buildZombieBrain() { // Skin Zombi: cerebro expuesto + tornillos de Frankenstein
  const g = new THREE.Group();
  const brainMat = new THREE.MeshStandardMaterial({ color: 0xe88aa0, emissive: 0x5a2030, emissiveIntensity: 0.35, roughness: 0.7 });
  // Cerebro principal asomando sobre la cabeza.
  const brain = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.42), brainMat);
  brain.position.set(0, 1.4, 0.33);
  brain.castShadow = true;
  g.add(brain);
  // Lóbulos (bultos) del cerebro.
  for (const [bx, bz] of [[-0.11, 0.1], [0.11, 0.1], [-0.11, -0.1], [0.11, -0.1]]) {
    const lobe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.16), brainMat);
    lobe.position.set(bx, 0.11, bz);
    brain.add(lobe);
  }
  // Surco central más oscuro.
  const groove = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.13, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xc25f78, roughness: 0.8 })
  );
  groove.position.set(0, 0.05, 0);
  brain.add(groove);
  // Tornillos de Frankenstein a los lados del cuello.
  const boltMat = new THREE.MeshStandardMaterial({ color: 0x8a8f99, metalness: 0.85, roughness: 0.35 });
  for (const dx of [-0.27, 0.27]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 8), boltMat);
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(dx, 0.95, 0.28);
    g.add(bolt);
  }
  // Puntada/cicatriz oscura en la frente.
  const scarMat = new THREE.MeshStandardMaterial({ color: 0x355020, roughness: 0.9 });
  const scar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), scarMat);
  scar.position.set(0.1, 1.16, 0.56);
  scar.rotation.z = 0.5;
  g.add(scar);
  return g;
}
function buildAntenna() {
  const g = new THREE.Group();
  const rod = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.26, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x556070, metalness: 0.8, roughness: 0.4 })
  );
  rod.position.set(0, 1.52, 0.34);
  g.add(rod);
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xff2b4d, emissive: 0xff2b4d, emissiveIntensity: 1.2 })
  );
  ball.position.set(0, 1.66, 0.34);
  g.add(ball);
  return g;
}
function buildHeadband() { // Ninja: cinta roja con dos colas
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe02030, roughness: 0.6 });
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), mat);
  band.position.set(0, 1.18, 0.34);
  g.add(band);
  const tail1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.1), mat);
  tail1.position.set(-0.28, 1.02, 0.02); tail1.rotation.z = 0.3;
  const tail2 = tail1.clone(); tail2.position.x = -0.36; tail2.position.y = 0.92;
  g.add(tail1, tail2);
  return g;
}
function buildCrown() { // Rey: corona dorada con puntas
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2, emissive: 0x4a3a00, emissiveIntensity: 0.3 });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 12), mat);
  ring.position.set(0, 1.42, 0.34);
  g.add(ring);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), mat);
    spike.position.set(Math.cos(a) * 0.22, 1.56, 0.34 + Math.sin(a) * 0.22);
    g.add(spike);
  }
  return g;
}
// BLOQUE 11 (Parte 6): skin legendaria ÉPICA "Pollo Divino". MUCHÍSIMA aura:
// doble disco de luz, TRIPLE esfera de aura, pilar de luz ascendente, alas de
// energía, llamas de aura, orbes orbitando y chispas que ascienden. SIN anillos
// ni corona. Se anima en updateLegendaryFx() leyendo g.userData.
function buildLegendaryAura() {
  const g = new THREE.Group();

  // Doble disco de luz girando bajo el pollo.
  const groundHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.8, 0.08, 10, 44),
    new THREE.MeshBasicMaterial({ color: 0xffe24a, transparent: true, opacity: 0.6 })
  );
  groundHalo.rotation.x = Math.PI / 2; groundHalo.position.y = 0.05; g.add(groundHalo);
  const groundHalo2 = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.05, 10, 48),
    new THREE.MeshBasicMaterial({ color: 0x8a2bff, transparent: true, opacity: 0.4 })
  );
  groundHalo2.rotation.x = Math.PI / 2; groundHalo2.position.y = 0.04; g.add(groundHalo2);

  // TRIPLE esfera de aura envolvente (cálida, mágica y un halo enorme tenue).
  const auraInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.92, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.22, side: THREE.BackSide })
  );
  auraInner.position.y = 0.6; g.add(auraInner);
  const auraMid = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xff5ad0, transparent: true, opacity: 0.14, side: THREE.BackSide })
  );
  auraMid.position.y = 0.6; g.add(auraMid);
  const auraOuter = new THREE.Mesh(
    new THREE.SphereGeometry(1.55, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0x8a2bff, transparent: true, opacity: 0.08, side: THREE.BackSide })
  );
  auraOuter.position.y = 0.6; g.add(auraOuter);

  // Pilar de luz que se eleva (más bajo, no sube tan alto).
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.85, 1.9, 22, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe24a, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  );
  pillar.position.y = 0.95; g.add(pillar);

  // Alas de energía a la espalda (plumas brillantes en abanico, más grandes).
  const wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const feather = new THREE.Mesh(
        new THREE.BoxGeometry(0.72 - i * 0.07, 0.12, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xfff0a0, emissive: 0xffc020, emissiveIntensity: 1.2, transparent: true, opacity: 0.92 })
      );
      feather.position.set(side * (0.3 + i * 0.17), 0.95 - i * 0.13, -0.32);
      feather.rotation.z = side * (0.35 + i * 0.12);
      wing.add(feather);
    }
    wing.userData.side = side;
    g.add(wing); wings.push(wing);
  }

  // Llamas de aura: lengüetas verticales que parpadean alrededor del pollo.
  const flames = [];
  const flameGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const hot = i % 2 === 0;
    const fl = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({
      color: hot ? 0xffd24a : 0xff5ad0, transparent: true, opacity: 0.7,
    }));
    fl.position.set(Math.cos(a) * 0.55, 0.4, Math.sin(a) * 0.55);
    fl.userData = { phase: i * 0.5, base: 0.4 };
    g.add(fl); flames.push(fl);
  }

  // Orbes-diamante que orbitan al pollo (más cantidad).
  const orbs = [];
  const orbGeo = new THREE.OctahedronGeometry(0.1);
  for (let i = 0; i < 10; i++) {
    const orb = new THREE.Mesh(orbGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd060, emissiveIntensity: 1.0 }));
    g.add(orb); orbs.push(orb);
  }

  // Chispas de energía que ascienden continuamente (más).
  const sparks = [];
  const sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  for (let i = 0; i < 20; i++) {
    const sp = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffe24a, transparent: true, opacity: 0.9 }));
    sp.userData = { phase: Math.random(), speed: 0.5 + Math.random() * 0.7, ang: Math.random() * 6.28, rad: 0.4 + Math.random() * 0.55 };
    g.add(sp); sparks.push(sp);
  }

  g.userData = { groundHalo, groundHalo2, auraInner, auraMid, auraOuter, pillar, wings, flames, orbs, sparks };
  return g;
}

// Guardaespaldas: POLLO con esmoquin elegante (frac negro, camisa blanca,
// pajarita y gafas de sol). Escolta al Pollo Cósmico. Animado en updateLegendaryGuards.
function buildLegendaryGuard() {
  const g = new THREE.Group();
  const matSuit  = new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 0.5 });
  const matHead  = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.75 });
  const matShirt = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  const matBeak  = new THREE.MeshStandardMaterial({ color: 0xff8a1e, roughness: 0.6 });
  const matComb  = new THREE.MeshStandardMaterial({ color: 0xe03030, roughness: 0.6 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.2, metalness: 0.6 });

  // Cuerpo con esmoquin negro.
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.5), matSuit);
  body.position.y = 0.32; body.castShadow = true; g.add(body);
  // Pechera blanca de la camisa.
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.05), matShirt);
  shirt.position.set(0, 0.32, 0.25); g.add(shirt);
  // Solapas blancas en V.
  for (const dx of [-0.08, 0.08]) {
    const lap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.04), matShirt);
    lap.position.set(dx, 0.4, 0.255); lap.rotation.z = dx < 0 ? 0.5 : -0.5; g.add(lap);
  }
  // Pajarita negra.
  const bow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.05), matSuit);
  bow.position.set(0, 0.48, 0.27); g.add(bow);
  // Cola tipo frac.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.13), matSuit);
  tail.position.set(0, 0.5, -0.3); tail.rotation.x = -0.5; g.add(tail);
  // Cabeza con plumas blancas.
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), matHead);
  head.position.set(0, 0.72, 0.18); head.castShadow = true; g.add(head);
  // Cresta roja.
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1 + i * 0.02, 0.07), matComb);
    p.position.set(0, 0.92, 0.24 - i * 0.09); g.add(p);
  }
  // Pico.
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.13), matBeak);
  beak.position.set(0, 0.69, 0.36); g.add(beak);
  // Gafas de sol de guardaespaldas (barra oscura).
  const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.04), matGlass);
  glasses.position.set(0, 0.76, 0.34); g.add(glasses);
  // Alas-brazos (se mueven al seguirte).
  const wings = [];
  for (const dx of [-0.24, 0.24]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.3), matSuit);
    w.position.set(dx, 0.34, 0); g.add(w); wings.push(w);
  }
  // Patas.
  for (const dx of [-0.1, 0.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.06), matBeak);
    leg.position.set(dx, 0.07, 0.03); g.add(leg);
  }
  g.userData = { wings };
  return g;
}

function buildHorns() { // Diablo: dos cuernos
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a0008, roughness: 0.5 });
  const h1 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 7), mat);
  h1.position.set(-0.16, 1.5, 0.34); h1.rotation.z = -0.3;
  const h2 = h1.clone(); h2.position.x = 0.16; h2.rotation.z = 0.3;
  g.add(h1, h2);
  return g;
}
function buildHat() { // Vaquero: sombrero marrón
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16), mat);
  brim.position.set(0, 1.34, 0.34);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.26, 12), mat);
  top.position.set(0, 1.48, 0.34);
  g.add(brim, top);
  return g;
}
function buildHalo() { // Ángel: aureola dorada flotante
  const g = new THREE.Group();
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.035, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xfff3a0, emissive: 0xffe070, emissiveIntensity: 1.3 })
  );
  halo.position.set(0, 1.66, 0.34); halo.rotation.x = Math.PI / 2;
  g.add(halo);
  return g;
}
function buildPartyHat() { // Fiesta: gorro cónico de colores
  const g = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.5, 12),
    new THREE.MeshStandardMaterial({ color: 0xff3ea5, emissive: 0xff3ea5, emissiveIntensity: 0.3, roughness: 0.5 })
  );
  cone.position.set(0, 1.6, 0.34);
  const pom = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.8 })
  );
  pom.position.set(0, 1.87, 0.34);
  g.add(cone, pom);
  return g;
}
function buildPirateHat() { // Pirata: bicornio negro con calavera
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.7 });
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.42, 0.2, 4), mat);
  hat.position.set(0, 1.44, 0.34); hat.rotation.y = Math.PI / 4;
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222, emissiveIntensity: 0.2 })
  );
  skull.position.set(0, 1.46, 0.56);
  g.add(hat, skull);
  return g;
}
function buildWizardHat() { // Mago: gorro cónico con estrellas
  const g = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.26, 0.62, 14),
    new THREE.MeshStandardMaterial({ color: 0x2a1a66, emissive: 0x3a1a88, emissiveIntensity: 0.4, roughness: 0.6 })
  );
  cone.position.set(0, 1.66, 0.34);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: 0x2a1a66, roughness: 0.6 }));
  brim.position.set(0, 1.36, 0.34);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.06),
    new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xffe600, emissiveIntensity: 1 }));
  star.position.set(0.12, 1.62, 0.42);
  g.add(cone, brim, star);
  return g;
}
function buildMohawk() { // Punk: cresta de pinchos
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.7, roughness: 0.4 });
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22 - Math.abs(i - 2) * 0.03, 6), mat);
    spike.position.set(0, 1.34, 0.1 + i * 0.12);
    g.add(spike);
  }
  return g;
}
function buildChefHat() { // Chef: gorro blanco
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.8 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 14), mat);
  band.position.set(0, 1.4, 0.34);
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), mat);
  puff.position.set(0, 1.56, 0.34); puff.scale.y = 0.8;
  g.add(band, puff);
  return g;
}
function buildKabuto() { // Samurái: casco con media luna dorada (maedate)
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.6, roughness: 0.4 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  dome.position.set(0, 1.3, 0.34);
  const gold = new THREE.MeshStandardMaterial({ color: 0xffcf3a, metalness: 0.9, roughness: 0.2, emissive: 0x4a3a00, emissiveIntensity: 0.3 });
  const crest = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 16, Math.PI), gold);
  crest.position.set(0, 1.5, 0.4); crest.rotation.z = Math.PI;
  g.add(dome, crest);
  return g;
}
function buildVikingHelmet() { // Vikingo: casco gris con dos cuernos laterales
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a8f99, metalness: 0.7, roughness: 0.4 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  dome.position.set(0, 1.3, 0.34);
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xf0ead6, roughness: 0.6 });
  const h1 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 8), hornMat);
  h1.position.set(-0.28, 1.42, 0.34); h1.rotation.z = 1.0;
  const h2 = h1.clone(); h2.position.x = 0.28; h2.rotation.z = -1.0;
  g.add(dome, h1, h2);
  return g;
}
function buildDetectiveHat() { // Detective: sombrero fedora marrón
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5a4630, roughness: 0.8 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 18), mat);
  brim.position.set(0, 1.33, 0.34);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.24, 14), mat);
  top.position.set(0, 1.46, 0.34);
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x2a1d10, roughness: 0.7 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.07, 14), bandMat);
  band.position.set(0, 1.37, 0.34);
  g.add(brim, top, band);
  return g;
}
function buildGradCap() { // Graduado: birrete negro con borla
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 0.6 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12), mat);
  cap.position.set(0, 1.36, 0.34);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), mat);
  board.position.set(0, 1.44, 0.34); board.rotation.y = Math.PI / 4;
  const tasselMat = new THREE.MeshStandardMaterial({ color: 0xffcf3a, emissive: 0x4a3a00, emissiveIntensity: 0.3 });
  const cord = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.03), tasselMat);
  cord.position.set(0.18, 1.36, 0.52);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), tasselMat);
  knob.position.set(0.18, 1.26, 0.52);
  g.add(cap, board, cord, knob);
  return g;
}
function buildUnicornHorn() { // Unicornio: cuerno espiral dorado + orejas rosas
  const g = new THREE.Group();
  const horn = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.42, 8),
    new THREE.MeshStandardMaterial({ color: 0xffd76a, metalness: 0.7, roughness: 0.25, emissive: 0x6a4a00, emissiveIntensity: 0.4 })
  );
  horn.position.set(0, 1.52, 0.42); horn.rotation.x = -0.15;
  const earMat = new THREE.MeshStandardMaterial({ color: 0xff9ad6, roughness: 0.6 });
  const e1 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), earMat);
  e1.position.set(-0.18, 1.36, 0.3); e1.rotation.z = 0.3;
  const e2 = e1.clone(); e2.position.x = 0.18; e2.rotation.z = -0.3;
  g.add(horn, e1, e2);
  return g;
}
function buildSnorkel() { // Buzo: máscara de buceo con tubo
  const g = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, metalness: 0.2, roughness: 0.1 })
  );
  glass.position.set(0, 0.95, 0.56);
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.6 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), tubeMat);
  tube.position.set(0.3, 1.0, 0.4);
  g.add(glass, tube);
  return g;
}
function buildFlowerCrown() { // Flores: corona de flores de colores
  const g = new THREE.Group();
  const colors = [0xff5db1, 0xffd23a, 0xff7a3a, 0x9b6bff, 0x4ad6ff];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const col = colors[i % colors.length];
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3, roughness: 0.5 })
    );
    flower.position.set(Math.cos(a) * 0.26, 1.24, 0.34 + Math.sin(a) * 0.26);
    flower.scale.y = 0.6;
    g.add(flower);
  }
  return g;
}
function buildVisor() { // Cyber: visor de neón sobre los ojos
  const g = new THREE.Group();
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.12, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x00ffc8, emissive: 0x00ffc8, emissiveIntensity: 1.3, metalness: 0.6, roughness: 0.2 })
  );
  visor.position.set(0, 0.98, 0.56);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.18, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x101418, metalness: 0.8, roughness: 0.3 })
  );
  frame.position.set(0, 0.98, 0.53);
  g.add(frame, visor);
  return g;
}

// ---- Builders NUEVOS de accesorios de skin (Bloque 8: más cosméticos) ----
function buildHeadphones() { // DJ: auriculares con almohadillas
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 18, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.4, metalness: 0.5 }));
  band.position.set(0, 1.34, 0.34); band.rotation.z = Math.PI; band.rotation.x = 0;
  g.add(band);
  const cupMat = new THREE.MeshStandardMaterial({ color: 0xff2bd6, emissive: 0xff2bd6, emissiveIntensity: 0.6, roughness: 0.4 });
  for (const dx of [-0.32, 0.32]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 14), cupMat);
    cup.rotation.z = Math.PI / 2; cup.position.set(dx, 1.12, 0.34); g.add(cup);
  }
  return g;
}
function buildTiara() { // Princesa: diadema con gema central
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd76a, metalness: 0.9, roughness: 0.2, emissive: 0x6a4a00, emissiveIntensity: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 18, Math.PI), mat);
  ring.position.set(0, 1.32, 0.34); ring.rotation.x = Math.PI / 2 - 0.5;
  g.add(ring);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.07),
    new THREE.MeshStandardMaterial({ color: 0xff4fa0, emissive: 0xff2bd6, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.2 }));
  gem.position.set(0, 1.46, 0.46); g.add(gem);
  for (const dx of [-0.16, 0.16]) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.035),
      new THREE.MeshStandardMaterial({ color: 0xbff0ff, emissive: 0x4aa6ff, emissiveIntensity: 0.7 }));
    s.position.set(dx, 1.4, 0.42); g.add(s);
  }
  return g;
}
function buildSantaHat() { // Navidad: gorro rojo con borla blanca
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xd11020, roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f6f6, roughness: 0.85 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 14), white);
  brim.position.set(0, 1.34, 0.34); g.add(brim);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.46, 14), red);
  cone.position.set(0.06, 1.58, 0.34); cone.rotation.z = -0.4; g.add(cone);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), white);
  pom.position.set(0.2, 1.78, 0.34); g.add(pom);
  return g;
}
function buildBeanie() { // Invierno: gorro de lana con pompón
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2b6cff, roughness: 0.9 });
  const knit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  knit.position.set(0, 1.28, 0.34); g.add(knit);
  const fold = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0xf0f4ff, roughness: 0.9 }));
  fold.position.set(0, 1.3, 0.34); g.add(fold);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }));
  pom.position.set(0, 1.56, 0.34); g.add(pom);
  return g;
}
function buildJester() { // Bufón: gorro de tres puntas con cascabeles
  const g = new THREE.Group();
  const cols = [0xff3ea5, 0x00f0ff, 0xffe600];
  const offs = [[-0.22, 1.5, -0.5], [0, 1.62, 0], [0.22, 1.5, 0.5]];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshStandardMaterial({ color: cols[i], emissive: cols[i], emissiveIntensity: 0.3, roughness: 0.5 });
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 7), m);
    spike.position.set(offs[i][0], offs[i][1], 0.34); spike.rotation.z = offs[i][2];
    g.add(spike);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.3 }));
    bell.position.set(offs[i][0] * 1.6, offs[i][1] + 0.12, 0.34); g.add(bell);
  }
  return g;
}
function buildPropeller() { // Nerd: gorro de hélice
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xff3b3b, roughness: 0.6 }));
  cap.position.set(0, 1.3, 0.34); g.add(cap);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6),
    new THREE.MeshStandardMaterial({ color: 0x222222 }));
  stick.position.set(0, 1.5, 0.34); g.add(stick);
  const propCols = [0x00f0ff, 0xffe600, 0xff2bd6, 0x35d07f];
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.07),
      new THREE.MeshStandardMaterial({ color: propCols[i], emissive: propCols[i], emissiveIntensity: 0.4 }));
    blade.position.set(0, 1.57, 0.34); blade.rotation.y = (i / 4) * Math.PI * 2;
    g.add(blade);
  }
  return g;
}
function buildArmyHelmet() { // Militar: casco verde con banda
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a5a32, roughness: 0.8, metalness: 0.2 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.31, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  dome.position.set(0, 1.3, 0.34); g.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 16), mat);
  brim.position.set(0, 1.28, 0.34); g.add(brim);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.315, 0.06, 16),
    new THREE.MeshStandardMaterial({ color: 0x6a7a4a, roughness: 0.85 }));
  band.position.set(0, 1.32, 0.34); g.add(band);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.05),
    new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x4a3a00, emissiveIntensity: 0.4, metalness: 0.6 }));
  star.position.set(0, 1.4, 0.6); g.add(star);
  return g;
}
function buildSpartanHelmet() { // Espartano: casco de bronce con cresta
  const g = new THREE.Group();
  const bronze = new THREE.MeshStandardMaterial({ color: 0xc88a3a, metalness: 0.8, roughness: 0.35, emissive: 0x3a2400, emissiveIntensity: 0.3 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), bronze);
  dome.position.set(0, 1.32, 0.34); g.add(dome);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), bronze);
  nose.position.set(0, 1.18, 0.58); g.add(nose);
  const crestMat = new THREE.MeshStandardMaterial({ color: 0xc0202a, roughness: 0.7 });
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.5), crestMat);
  crest.position.set(0, 1.56, 0.3); g.add(crest);
  return g;
}
function buildPandaEars() { // Panda: orejas y manchas negras
  const g = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  for (const dx of [-0.2, 0.2]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), black);
    ear.position.set(dx, 1.42, 0.3); g.add(ear);
  }
  for (const dx of [-0.13, 0.13]) {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), black);
    patch.scale.set(1, 1.2, 0.4); patch.position.set(dx, 1.18, 0.56); g.add(patch);
  }
  return g;
}
function buildBunnyEars() { // Conejo: orejas largas con interior rosa
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f2f0, roughness: 0.85 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xff9ec2, roughness: 0.7 });
  for (const dx of [-0.13, 0.13]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.06), white);
    ear.position.set(dx, 1.6, 0.32); ear.rotation.z = dx * 0.6; g.add(ear);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.03), pink);
    inner.position.set(dx * 1.05, 1.6, 0.36); inner.rotation.z = dx * 0.6; g.add(inner);
  }
  return g;
}
// ---- Builders NUEVOS de accesorios EXCLUSIVOS (Bloque 8) ----
function buildBowTie() { // Pajarita roja bajo el pico
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xd11020, roughness: 0.5 });
  for (const dx of [-0.12, 0.12]) {
    const w = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), mat);
    w.rotation.z = dx < 0 ? Math.PI / 2 : -Math.PI / 2; w.position.set(dx, 0.7, 0.5); g.add(w);
  }
  const knot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x8a0a14, roughness: 0.6 }));
  knot.position.set(0, 0.7, 0.52); g.add(knot);
  return g;
}
function buildScarf() { // Bufanda de rayas alrededor del cuello
  const g = new THREE.Group();
  const a = new THREE.MeshStandardMaterial({ color: 0x35d07f, roughness: 0.85 });
  const b = new THREE.MeshStandardMaterial({ color: 0xfff3c0, roughness: 0.85 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.07, 8, 16), a);
  ring.position.set(0, 0.78, 0.34); ring.rotation.x = Math.PI / 2; g.add(ring);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.08), b);
  tail.position.set(0.18, 0.58, 0.4); tail.rotation.z = 0.2; g.add(tail);
  return g;
}
function buildMonocle() { // Monóculo dorado en un ojo
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2 }));
  ring.position.set(0.13, 1.18, 0.56); g.add(ring);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.08, 16),
    new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.4 }));
  glass.position.set(0.13, 1.18, 0.55); g.add(glass);
  const chain = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 }));
  chain.position.set(0.13, 1.05, 0.55); chain.rotation.z = 0.3; g.add(chain);
  return g;
}
function buildMustache() { // Bigote negro elegante
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a120a, roughness: 0.7 });
  for (const dx of [-0.1, 0.1]) {
    const half = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.05), mat);
    half.position.set(dx, 1.0, 0.58); half.rotation.z = dx < 0 ? 0.4 : -0.4; g.add(half);
  }
  return g;
}
function buildEyepatch() { // Parche pirata sobre un ojo
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
  const patch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.04), mat);
  patch.position.set(-0.12, 1.18, 0.56); g.add(patch);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.015, 6, 18),
    new THREE.MeshStandardMaterial({ color: 0x222222 }));
  strap.position.set(0, 1.2, 0.34); strap.rotation.y = 0.2; g.add(strap);
  return g;
}
function buildBalloonAcc() { // Globo atado que flota sobre el pollo
  const g = new THREE.Group();
  const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xff3b6b, emissive: 0xff3b6b, emissiveIntensity: 0.3, roughness: 0.4 }));
  balloon.scale.y = 1.2; balloon.position.set(0.1, 2.0, 0.2); g.add(balloon);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.7, 5),
    new THREE.MeshStandardMaterial({ color: 0xffffff }));
  string.position.set(0.06, 1.5, 0.25); string.rotation.z = 0.06; g.add(string);
  return g;
}

// Aplica la skin equipada al pollo (color/material + accesorio opcional).
function applySkin(lvl) {
  const mat = player.userData.bodyMaterial;
  // Quitar accesorio previo.
  if (player.userData.skinAccessory) {
    player.remove(player.userData.skinAccessory);
    player.userData.skinAccessory.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    player.userData.skinAccessory = null;
  }
  const skin = SKINS[equippedSkin] || SKINS.classic;
  if (equippedSkin === "classic") {
    setChickenColorForLevel(lvl);
    mat.metalness = 0; mat.roughness = 0.85;
    mat.emissive.setHex(0x000000); mat.emissiveIntensity = 0;
  } else {
    mat.color.setHex(skin.color);
    mat.metalness = skin.metal ?? 0; mat.roughness = skin.rough ?? 0.6;
    mat.emissive.setHex(skin.emissive ?? 0x000000); mat.emissiveIntensity = skin.glow ?? 0;
  }
  if (skin.accessory) {
    const acc = skin.accessory();
    player.add(acc);
    player.userData.skinAccessory = acc;
  }
  // Escolta de guardaespaldas cósmicos (solo con la skin legendaria).
  applyLegendaryGuards();
  // Tras cambiar la skin, re-aplicamos el accesorio del jugador (slot aparte)
  // para que skin + accesorio puedan combinarse sin pisarse.
  if (typeof applyAccessory === "function") applyAccessory();
}

// ============================================================================
//  BLOQUE 5 — PERSONALIZACIÓN AVANZADA
//  Cuatro categorías NUEVAS e independientes entre sí y de la skin:
//    · accessory : sombreros/accesorios que se combinan con CUALQUIER skin.
//    · trail     : estelas/rastros de partículas que deja el pollo al saltar.
//    · theme     : temas visuales de la interfaz (oscuro / neón / claro).
//    · pio       : variante del sonido de "pío" al saltar.
//  Cada categoría tiene: catálogo, orden, set de desbloqueados y equipado.
//  Todo se compra con monedas (algunos por defecto son gratis) y se guarda en
//  localStorage. La tienda muestra una pestaña por categoría.
// ============================================================================

// ---- Estado persistente de personalización (se rellena en loadSave) ----
let ownedAccessories = new Set(["none"]);
let equippedAccessory = "none";
let ownedTrails = new Set(["none"]);
let equippedTrail = "none";
let ownedThemes = new Set(["dark"]);
let equippedTheme = "dark";
let ownedPios = new Set(["none", "classic"]);
let equippedPio = "classic";
// ---- Bloque 7: mascota acompañante (decorativa, no afecta a la jugabilidad) ----
let ownedPets = new Set(["none"]);
let equippedPet = "none";

// ---- Builders de accesorios EXCLUSIVOS de esta categoría ----
// (los demás reutilizan los builders de skin: buildCrown, buildHelmet, etc.)
function buildTopHat() { // Gorro de copa negro con cinta roja
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x161620, roughness: 0.5, metalness: 0.2 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 18), mat);
  brim.position.set(0, 1.34, 0.34);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.42, 16), mat);
  top.position.set(0, 1.58, 0.34);
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xd11020, roughness: 0.6 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.08, 16), bandMat);
  band.position.set(0, 1.42, 0.34);
  g.add(brim, top, band);
  return g;
}
function buildSunglasses() { // Gafas de sol sobre los ojos
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x0a0a0e, roughness: 0.4, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.1, metalness: 0.8, emissive: 0x001018, emissiveIntensity: 0.4 });
  for (const dx of [-0.13, 0.13]) {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.05), glass);
    lens.position.set(dx, 1.18, 0.56);
    g.add(lens);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.05), frame);
  bridge.position.set(0, 1.2, 0.56);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.04), frame);
  bar.position.set(0, 1.22, 0.55);
  g.add(bridge, bar);
  return g;
}

// ---- Catálogo: ACCESORIOS (combinables con cualquier skin) ----
// Reutilizamos builders de skin para tener variedad sin duplicar código.
const ACCESSORIES = {
  none:    { name: "Ninguno",        price: 0,  swatch: "#3a3550" },
  gorro:   { name: "Gorro de copa",  price: 30, swatch: "#161620", build: buildTopHat },
  gafas:   { name: "Gafas de sol",   price: 25, swatch: "#0a0a0e", build: buildSunglasses },
  corona:  { name: "Corona",         price: 45, swatch: "#ffd700", build: buildCrown },
  casco:   { name: "Casco espacial", price: 35, swatch: "#bfe6ff", build: buildHelmet },
  aureola: { name: "Aureola",        price: 40, swatch: "#fff3a0", build: buildHalo, reqLevel: 4 },
  cuernos: { name: "Cuernos",        price: 30, swatch: "#3a0008", build: buildHorns },
  vaquero: { name: "Sombrero",       price: 30, swatch: "#6b4423", build: buildHat },
  flor:    { name: "Corona floral",  price: 35, swatch: "#ff5db1", build: buildFlowerCrown },
  // ---- Bloque 8: accesorios nuevos ----
  pajarita:    { name: "Pajarita",     price: 20, swatch: "#d11020", build: buildBowTie },
  bufanda:     { name: "Bufanda",      price: 25, swatch: "#35d07f", build: buildScarf },
  monoculo:    { name: "Monóculo",     price: 30, swatch: "#ffd700", build: buildMonocle },
  bigote:      { name: "Bigote",       price: 20, swatch: "#1a120a", build: buildMustache },
  parche:      { name: "Parche",       price: 25, swatch: "#111111", build: buildEyepatch },
  auriculares: { name: "Auriculares",  price: 35, swatch: "#ff2bd6", build: buildHeadphones },
  globo:       { name: "Globo",        price: 30, swatch: "#ff3b6b", build: buildBalloonAcc },
  tiara:       { name: "Tiara",        price: 45, swatch: "#ffd76a", build: buildTiara, reqLevel: 4 },
  santa:       { name: "Gorro Santa",  price: 30, swatch: "#d11020", build: buildSantaHat },
  bufanda_dj:  { name: "Cresta punk",  price: 35, swatch: "#00e5ff", build: buildMohawk },
  birrete:     { name: "Birrete",      price: 30, swatch: "#14141c", build: buildGradCap },
  snorkel:     { name: "Snorkel",      price: 30, swatch: "#9fe8ff", build: buildSnorkel },
};
const ACCESSORY_ORDER = ["none", "gorro", "gafas", "corona", "casco", "aureola", "cuernos", "vaquero", "flor", "pajarita", "bufanda", "monoculo", "bigote", "parche", "auriculares", "globo", "tiara", "santa", "bufanda_dj", "birrete", "snorkel"];

// Aplica el accesorio equipado en un slot propio (userAccessory), distinto del
// accesorio que pueda traer la skin (skinAccessory). Así se combinan ambos.
function applyAccessory() {
  if (player.userData.userAccessory) {
    player.remove(player.userData.userAccessory);
    player.userData.userAccessory.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    player.userData.userAccessory = null;
  }
  const a = ACCESSORIES[equippedAccessory];
  if (a && a.build) {
    const g = a.build();
    player.add(g);
    player.userData.userAccessory = g;
  }
}

// ---- Catálogo: ESTELAS / RASTROS ----
// Cada estela define cómo emite partículas mientras el pollo salta.
//   colors : paleta de la que se elige al azar
//   shape  : "cube" | "star" | "feather"
//   rise   : velocidad vertical inicial
//   grav   : aceleración vertical (positivo cae, negativo sube → fuego)
//   life   : duración de cada partícula (s)
//   count  : partículas por emisión
const TRAILS = {
  none:      { name: "Ninguna",  price: 0,  swatch: "#3a3550" },
  plumas:    { name: "Plumas",   price: 25, swatch: "#fff3c0", colors: [0xfff3c0, 0xffd21a, 0xffffff], shape: "feather", rise: 0.5, grav: 2.0, life: 0.7, count: 2 },
  fuego:     { name: "Fuego",    price: 40, swatch: "#ff6a00", colors: [0xff6a00, 0xff3000, 0xffd000], shape: "cube",    rise: 1.4, grav: -1.6, life: 0.5, count: 3 },
  arcoiris:  { name: "Arcoíris", price: 60, swatch: "rainbow", colors: [0xff0040, 0xff9900, 0xffe600, 0x00ff66, 0x00aaff, 0x8a2be2], shape: "cube", rise: 0.8, grav: 1.0, life: 0.85, count: 3, reqLevel: 5 },
  estrellas: { name: "Estrellas",price: 50, swatch: "#ffe600", colors: [0xffe600, 0xfff7a0, 0xffffff], shape: "star",   rise: 0.9, grav: 0.3, life: 0.9, count: 2 },
  // ---- Bloque 8: estelas nuevas ----
  burbujas:  { name: "Burbujas", price: 30, swatch: "#9fe8ff", colors: [0x9fe8ff, 0xcdf3ff, 0xffffff], shape: "star",    rise: 1.2, grav: -1.2, life: 0.8, count: 2 },
  oro:       { name: "Oro",      price: 55, swatch: "#ffd700", colors: [0xffd700, 0xfff0a0, 0xffaa00], shape: "star",    rise: 0.7, grav: 1.4, life: 0.8, count: 3, reqLevel: 4 },
  neon:      { name: "Neón",     price: 45, swatch: "#ff2bd6", colors: [0xff2bd6, 0x00f0ff, 0xffe600], shape: "cube",    rise: 0.9, grav: 0.6, life: 0.75, count: 3 },
  nieve:     { name: "Nieve",    price: 30, swatch: "#eaf4ff", colors: [0xffffff, 0xeaf4ff, 0xcfe6ff], shape: "feather", rise: 0.3, grav: 1.8, life: 1.0, count: 2 },
  toxico:    { name: "Tóxico",   price: 40, swatch: "#7dff3a", colors: [0x7dff3a, 0x35d07f, 0xc8ff8a], shape: "cube",    rise: 0.8, grav: -0.8, life: 0.7, count: 3 },
  sombra:    { name: "Sombra",   price: 50, swatch: "#6a2bff", colors: [0x6a2bff, 0x3a1a88, 0x9b2bff], shape: "cube",    rise: 0.6, grav: 0.4, life: 0.9, count: 3, reqLevel: 6 },
  // ---- BLOQUE 11 (Parte 6): estela LEGENDARIA EXCLUSIVA (regalo del jefe) ----
  cosmica:   { name: "Cósmica",  price: 0,  swatch: "rainbow", colors: [0xff00cc, 0xffe600, 0x00f0ff, 0x6a2bff, 0x35d07f, 0xffffff], shape: "star", rise: 1.3, grav: 0.1, life: 1.4, count: 8, exclusive: true, big: true },
};
const TRAIL_ORDER = ["none", "plumas", "fuego", "arcoiris", "estrellas", "burbujas", "oro", "neon", "nieve", "toxico", "sombra", "cosmica"];

// Geometrías compartidas de las partículas de estela (no se eliminan).
const TRAIL_GEO_CUBE = new THREE.BoxGeometry(0.16, 0.16, 0.16);
const TRAIL_GEO_STAR = new THREE.OctahedronGeometry(0.13);
const TRAIL_GEO_FEATHER = new THREE.BoxGeometry(0.05, 0.2, 0.12);

const trailParticles = []; // {mesh, vel, grav, life, maxLife, spin}

// Emite una tanda de partículas de estela en la posición del pollo.
function emitTrailParticle(cfg) {
  const geo = cfg.shape === "star" ? TRAIL_GEO_STAR : cfg.shape === "feather" ? TRAIL_GEO_FEATHER : TRAIL_GEO_CUBE;
  const spread = cfg.big ? 0.55 : 0.3;
  const sizeMin = cfg.big ? 1.0 : 0.6;
  const sizeVar = cfg.big ? 1.1 : 0.7;
  for (let i = 0; i < cfg.count; i++) {
    const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(
      player.position.x + (Math.random() - 0.5) * spread,
      0.35 + Math.random() * (cfg.big ? 0.6 : 0.35),
      player.position.z + (Math.random() - 0.5) * spread
    );
    m.scale.setScalar(sizeMin + Math.random() * sizeVar);
    m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    scene.add(m);
    trailParticles.push({
      mesh: m,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, cfg.rise * (0.6 + Math.random() * 0.6), (Math.random() - 0.5) * 0.6),
      grav: cfg.grav,
      life: cfg.life,
      maxLife: cfg.life,
      spin: cfg.shape === "star",
    });
  }
}

// Emite estela mientras el pollo está saltando (rastro del salto).
let trailAccum = 0;
const TRAIL_INTERVAL = 0.025; // s entre emisiones durante el salto
function updateTrail(dt) {
  if (equippedTrail === "none" || !playerState.alive || !playerState.moving) return;
  const cfg = TRAILS[equippedTrail];
  if (!cfg) return;
  trailAccum += dt;
  while (trailAccum >= TRAIL_INTERVAL) {
    trailAccum -= TRAIL_INTERVAL;
    emitTrailParticle(cfg);
  }
}

// Anima y recicla las partículas de estela (solo se libera el material).
function updateTrailParticles(dt) {
  for (let i = trailParticles.length - 1; i >= 0; i--) {
    const p = trailParticles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.material.dispose();
      trailParticles.splice(i, 1);
      continue;
    }
    p.vel.y -= p.grav * dt;
    p.mesh.position.x += p.vel.x * dt;
    p.mesh.position.y += p.vel.y * dt;
    p.mesh.position.z += p.vel.z * dt;
    const k = p.life / p.maxLife;
    p.mesh.material.opacity = Math.max(0, k) * 0.9;
    p.mesh.scale.setScalar(Math.max(0.05, k) * (0.6 + 0.4 * k));
    if (p.spin) { p.mesh.rotation.y += dt * 5; p.mesh.rotation.x += dt * 3; }
  }
}

// BLOQUE 11 (Parte 6): animación de la skin legendaria "Campeón" (todos los
// niveles juntos): las bandas laten suavemente, los 7 emblemas orbitan la cabeza
// y la corona gira. Además mueve a los pollos guardaespaldas.
let legendaryFxT = 0;
function updateLegendaryFx(dt) {
  if (equippedSkin !== "cosmico") return;
  legendaryFxT += dt;
  const t = legendaryFxT;
  // Cuerpo: oro divino que late y oscila entre tonos cálidos y mágicos.
  const mat = player.userData.bodyMaterial;
  if (mat) {
    mat.emissive.setHSL((0.11 + Math.sin(t * 0.5) * 0.07 + 1) % 1, 1, 0.5);
    mat.emissiveIntensity = 0.7 + Math.sin(t * 3) * 0.3;
  }
  const fx = player.userData.skinAccessory;
  if (!fx || !fx.userData) { updateLegendaryGuards(dt, t); return; }
  const u = fx.userData;
  // Doble disco de luz en el suelo: giran (al revés entre sí), laten y parpadean.
  if (u.groundHalo) {
    u.groundHalo.rotation.z += dt * 1.2;
    u.groundHalo.scale.setScalar(1 + Math.sin(t * 2) * 0.08);
    u.groundHalo.material.opacity = 0.4 + Math.abs(Math.sin(t * 2)) * 0.45;
  }
  if (u.groundHalo2) {
    u.groundHalo2.rotation.z -= dt * 0.8;
    u.groundHalo2.scale.setScalar(1 + Math.sin(t * 1.5 + 1) * 0.1);
    u.groundHalo2.material.opacity = 0.25 + Math.abs(Math.sin(t * 1.5)) * 0.3;
  }
  // Triple esfera de aura: respira y cambia de tinte.
  if (u.auraInner) {
    u.auraInner.scale.setScalar(1 + Math.sin(t * 2.5) * 0.08);
    u.auraInner.material.opacity = 0.16 + Math.abs(Math.sin(t * 2)) * 0.16;
    u.auraInner.material.color.setHSL((0.1 + Math.sin(t * 0.5) * 0.08 + 1) % 1, 1, 0.55);
  }
  if (u.auraMid) {
    u.auraMid.scale.setScalar(1 + Math.sin(t * 2.1 + 0.6) * 0.09);
    u.auraMid.material.opacity = 0.1 + Math.abs(Math.sin(t * 1.8)) * 0.12;
    u.auraMid.material.color.setHSL((0.88 + Math.sin(t * 0.45) * 0.08 + 1) % 1, 1, 0.62);
  }
  if (u.auraOuter) {
    u.auraOuter.scale.setScalar(1 + Math.sin(t * 1.7 + 1) * 0.1);
    u.auraOuter.material.opacity = 0.05 + Math.abs(Math.sin(t * 1.4)) * 0.1;
    u.auraOuter.material.color.setHSL((0.72 + Math.sin(t * 0.4) * 0.1 + 1) % 1, 1, 0.6);
  }
  // Pilar de luz: gira lento, late y cambia de tinte.
  if (u.pillar) {
    u.pillar.rotation.y += dt * 0.6;
    u.pillar.material.opacity = 0.08 + Math.abs(Math.sin(t * 1.6)) * 0.12;
    u.pillar.material.color.setHSL((0.13 + Math.sin(t * 0.4) * 0.06 + 1) % 1, 1, 0.58);
  }
  // Alas de energía: aletean amplias.
  if (u.wings) {
    const flap = Math.sin(t * 3) * 0.28;
    for (const w of u.wings) {
      w.rotation.z = w.userData.side * flap;
      w.rotation.y = w.userData.side * (0.2 + Math.sin(t * 2) * 0.12);
    }
  }
  // Llamas de aura: se estiran y encogen parpadeando.
  if (u.flames) {
    for (let i = 0; i < u.flames.length; i++) {
      const fl = u.flames[i];
      const f = 0.6 + Math.abs(Math.sin(t * 6 + fl.userData.phase)) * 1.0;
      fl.scale.y = f;
      fl.position.y = fl.userData.base + f * 0.18;
      fl.material.opacity = 0.4 + Math.abs(Math.sin(t * 5 + fl.userData.phase)) * 0.45;
    }
  }
  // Orbes-diamante orbitando, brillando y cambiando de color.
  if (u.orbs && u.orbs.length) {
    const n = u.orbs.length;
    for (let i = 0; i < n; i++) {
      const o = u.orbs[i];
      const a = t * 1.5 + (i / n) * Math.PI * 2;
      const rad = 0.8 + Math.sin(t * 2 + i) * 0.06;
      o.position.set(Math.cos(a) * rad, 0.6 + Math.sin(t * 2.5 + i) * 0.3, Math.sin(a) * rad);
      o.rotation.y += dt * 4;
      o.material.emissiveIntensity = 0.7 + Math.abs(Math.sin(t * 5 + i)) * 0.7;
      o.material.color.setHSL((t * 0.4 + i / n) % 1, 1, 0.72);
    }
  }
  // Chispas de energía que ascienden y se desvanecen.
  if (u.sparks) {
    for (const sp of u.sparks) {
      sp.userData.phase += dt * sp.userData.speed;
      const p = sp.userData.phase % 1;
      sp.position.set(Math.cos(sp.userData.ang) * sp.userData.rad, 0.1 + p * 1.7, Math.sin(sp.userData.ang) * sp.userData.rad);
      sp.material.opacity = (1 - p) * 0.9;
      sp.scale.setScalar(0.5 + (1 - p) * 0.9);
    }
  }
  // Pollos guardaespaldas con esmoquin que escoltan al campeón.
  updateLegendaryGuards(dt, t);
}

// ---- Guardaespaldas cósmicos (escolta de la skin legendaria) ----
const legendaryGuards = [];  // { mesh, ox, oz, phase }

// Crea o destruye la escolta según la skin equipada (se llama desde applySkin).
function applyLegendaryGuards() {
  clearLegendaryGuards();
  if (equippedSkin !== "cosmico") return;
  // Dos centinelas que flanquean al pollo (izquierda y derecha, algo detrás).
  const offsets = [
    { ox: -1.05, oz: 0.55, phase: 0 },
    { ox: 1.05, oz: 0.55, phase: Math.PI },
  ];
  for (const o of offsets) {
    const mesh = buildLegendaryGuard();
    mesh.position.set(player.position.x + o.ox, 0, player.position.z + o.oz);
    scene.add(mesh);
    legendaryGuards.push({ mesh, ox: o.ox, oz: o.oz, phase: o.phase });
  }
}

function clearLegendaryGuards() {
  for (const gd of legendaryGuards) {
    scene.remove(gd.mesh);
    gd.mesh.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
  legendaryGuards.length = 0;
}

// Sigue al pollo con suavizado, flota y cicla colores. t = legendaryFxT.
function updateLegendaryGuards(dt, t) {
  if (!legendaryGuards.length) return;
  for (let i = 0; i < legendaryGuards.length; i++) {
    const gd = legendaryGuards[i];
    const m = gd.mesh;
    const tx = player.position.x + gd.ox;
    const tz = player.position.z + gd.oz;
    m.position.x += (tx - m.position.x) * Math.min(1, dt * 5);
    m.position.z += (tz - m.position.z) * Math.min(1, dt * 5);
    m.position.y = Math.abs(Math.sin(t * 6 + gd.phase)) * 0.1;     // saltitos al seguirte
    m.rotation.y = Math.atan2(player.position.x - m.position.x, player.position.z - m.position.z); // mira al pollo
    // Aleteo de las alas-brazos.
    if (m.userData.wings) {
      const flap = Math.sin(t * 8 + gd.phase) * 0.3;
      m.userData.wings[0].rotation.z = flap;
      m.userData.wings[1].rotation.z = -flap;
    }
  }
}

// Elimina todas las partículas de estela (al cambiar de nivel / reiniciar).
function clearTrailParticles() {
  for (const p of trailParticles) { scene.remove(p.mesh); p.mesh.material.dispose(); }
  trailParticles.length = 0;
  trailAccum = 0;
}

// ---- Catálogo: TEMAS DE INTERFAZ ----
const THEMES = {
  dark:  { name: "Oscuro", price: 0,  swatch: "#1a1033" },
  neon:  { name: "Neón",   price: 20, swatch: "#ff2bd6" },
  light: { name: "Claro",  price: 20, swatch: "#e6eeff" },
  // ---- Bloque 8: temas nuevos (CSS en style.css) ----
  retro:   { name: "Retro",   price: 30, swatch: "#ff2e88" },
  bosque:  { name: "Bosque",  price: 25, swatch: "#1f6e3a" },
  oceano:  { name: "Océano",  price: 25, swatch: "#0a4a7a" },
  caramelo:{ name: "Caramelo",price: 30, swatch: "#ff8fd4" },
  lava:    { name: "Lava",    price: 35, swatch: "#ff4400" },
  oro:     { name: "Oro",     price: 40, swatch: "#ffd700", reqLevel: 5 },
};
const THEME_ORDER = ["dark", "neon", "light", "retro", "bosque", "oceano", "caramelo", "lava", "oro"];

// Aplica el tema poniendo una clase en <body>; el CSS hace el resto.
function applyTheme(id) {
  if (!THEMES[id]) id = "dark";
  document.body.className = "theme-" + id;
}

// ---- Catálogo: SONIDOS DE PÍO ----
// Cada uno define play() usando el sintetizador tone() existente.
const PIOS = {
  // Sin pío: el pollo salta en silencio (no reproduce ningún sonido).
  none:    { name: "Ninguno", price: 0,  swatch: "#3a3550", play: () => {} },
  // Píos naturales = pollito real (peep con glissando + armónico).
  classic: { name: "Clásico", price: 0,  swatch: "#ffd21a", play: () => { peep(2000, 3200, 2300, 0.1, 0.3); peep(2200, 3500, 2400, 0.09, 0.26, 0.13); } }, // "pío-pío"
  agudo:   { name: "Agudo",   price: 15, swatch: "#00f0ff", play: () => { peep(2800, 4400, 3200, 0.07, 0.27); peep(3000, 4600, 3300, 0.06, 0.22, 0.09); } }, // pollito pequeñín
  grave:   { name: "Grave",   price: 15, swatch: "#7c4dff", play: () => { peep(900, 1150, 620, 0.16, 0.32); } }, // gallina mayor, descendente
  robot:   { name: "Robot",   price: 25, swatch: "#9aa3b2", play: () => { tone(523, 0.05, "square", 0.26); tone(392, 0.05, "square", 0.24, null, 0.06); tone(659, 0.05, "square", 0.24, null, 0.12); chirp(880, 440, 300, 0.12, "sawtooth", 0.2, null, 0.18); } }, // "bip-bup" + vrrt robótico
  dulce:   { name: "Dulce",   price: 20, swatch: "#ff66c2", play: () => { peep(1700, 2700, 2100, 0.16, 0.3); } }, // peep suave y melódico
  // ---- Bloque 8: píos nuevos ----
  laser:   { name: "Láser",   price: 25, swatch: "#00ffc8", play: () => { chirp(2800, 1500, 260, 0.16, "sawtooth", 0.3); chirp(2800, 1500, 260, 0.16, "square", 0.1); } }, // "pew" descendente
  moneda:  { name: "Moneda",  price: 20, swatch: "#ffd700", play: () => { tone(988, 0.06, "square", 0.3); tone(1319, 0.4, "square", 0.26, null, 0.06); } }, // coin clásico (B5 -> E6 con cola)
  trompeta:{ name: "Trompeta",price: 25, swatch: "#ff9a3a", play: () => { tone(523, 0.09, "sawtooth", 0.26); tone(523, 0.09, "sawtooth", 0.26, null, 0.11); chirp(680, 740, 784, 0.3, "sawtooth", 0.3, null, 0.22); chirp(340, 370, 392, 0.3, "sawtooth", 0.14, null, 0.22); } }, // fanfarria "ta-ta-taaa"
  ocho:    { name: "8-bit",   price: 20, swatch: "#35d07f", play: () => { tone(440, 0.05, "square", 0.24); tone(660, 0.05, "square", 0.22, null, 0.05); tone(880, 0.06, "square", 0.2, null, 0.1); } },
  campana: { name: "Campana", price: 25, swatch: "#bff0ff", play: () => { tone(1318, 0.8, "sine", 0.34); tone(3640, 0.6, "sine", 0.12); tone(7120, 0.45, "sine", 0.05); tone(659, 0.8, "sine", 0.12); } }, // parciales inarmónicos = repique metálico
  ufo:     { name: "OVNI",    price: 30, swatch: "#8a2be2", play: () => { chirp(620, 880, 560, 0.4, "sine", 0.26); chirp(560, 760, 640, 0.4, "sine", 0.2, null, 0.4); chirp(312, 442, 282, 0.8, "sine", 0.1); } }, // warble de platillo volante
  grito:   { name: "Grito",   price: 20, swatch: "#ff3b3b", play: () => { chirp(1500, 1050, 360, 0.32, "sawtooth", 0.32); chirp(1500, 1050, 360, 0.32, "square", 0.14); } }, // chillido que cae
};
const PIO_ORDER = ["none", "classic", "agudo", "grave", "robot", "dulce", "laser", "moneda", "trompeta", "ocho", "campana", "ufo", "grito"];

// ============================================================================
//  BLOQUE 7 — MASCOTA ACOMPAÑANTE (decorativa)
//  Una pequeña mascota voxel que sigue al pollo con un retardo suave. Es PURA
//  decoración: vive en la escena (no en carriles), nunca colisiona ni afecta a
//  la jugabilidad. Se compra/equipa en la tienda y se guarda en localStorage.
// ============================================================================

// Builders de mascotas (Group centrado en el origen, apoyado en el suelo).
function buildPetChick() { // Pollito amarillo en miniatura.
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd21a, roughness: 0.6, emissive: 0x3a2e00, emissiveIntensity: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.3), mat); body.position.y = 0.2; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.24), mat); head.position.set(0.06, 0.46, 0); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), new THREE.MeshStandardMaterial({ color: 0xff8a00 }));
  beak.rotation.z = -Math.PI / 2; beak.position.set(0.22, 0.46, 0); g.add(beak);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const dz of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), eyeMat); e.position.set(0.16, 0.5, dz); g.add(e); }
  return g;
}
function buildPetCat() { // Gatito gris con orejas y cola.
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.28), mat); body.position.y = 0.18; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), mat); head.position.set(0.16, 0.4, 0); g.add(head);
  for (const dz of [-0.08, 0.08]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), mat); ear.position.set(0.16, 0.56, dz); g.add(ear); }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.26), mat); tail.position.set(-0.22, 0.3, 0); tail.rotation.x = 0.5; g.add(tail);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1aff9d, emissive: 0x0a9d5a, emissiveIntensity: 0.6 });
  for (const dz of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), eyeMat); e.position.set(0.27, 0.42, dz); g.add(e); }
  return g;
}
function buildPetBot() { // Robotín cian flotante con antena.
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x16323a, roughness: 0.3, metalness: 0.8, emissive: 0x00ffc8, emissiveIntensity: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.26), mat); body.position.y = 0.34; body.castShadow = true; g.add(body);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.04), new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 1.6 }));
  eye.position.set(0.14, 0.4, 0); g.add(eye);
  const ant = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), mat); ant.position.set(0, 0.57, 0); g.add(ant);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff2bd6, emissive: 0xff2bd6, emissiveIntensity: 1.4 }));
  bulb.position.set(0, 0.65, 0); g.add(bulb);
  g.userData.float = true; // flota (no toca el suelo)
  return g;
}
function buildPetGhost() { // Fantasma blanco translúcido que flota.
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8ecff, roughness: 0.4, transparent: true, opacity: 0.78, emissive: 0x9fb0ff, emissiveIntensity: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.28), mat); body.position.y = 0.4; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat); head.position.set(0, 0.58, 0); g.add(head);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222244 });
  for (const dz of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.04), eyeMat); e.position.set(0.13, 0.56, dz); g.add(e); }
  g.userData.float = true;
  return g;
}
function buildPetDog() { // Perrito marrón con orejas caídas y cola.
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xb5793f, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x8a5a2c, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.26, 0.28), mat); body.position.y = 0.2; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.26), mat); head.position.set(0.2, 0.36, 0); g.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.14), dark); snout.position.set(0.34, 0.32, 0); g.add(snout);
  for (const dz of [-0.11, 0.11]) { const ear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.1), dark); ear.position.set(0.16, 0.34, dz); g.add(ear); }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.06), mat); tail.position.set(-0.28, 0.3, 0); tail.rotation.z = 0.6; g.add(tail);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const dz of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), eyeMat); e.position.set(0.31, 0.4, dz); g.add(e); }
  return g;
}
function buildPetBunny() { // Conejito blanco con orejas largas.
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf4f0ef, roughness: 0.85 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xff9ec2, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.26), mat); body.position.y = 0.2; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.22), mat); head.position.set(0.08, 0.44, 0); g.add(head);
  for (const dz of [-0.07, 0.07]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, 0.05), mat); ear.position.set(0.06, 0.66, dz); g.add(ear);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), pink); inner.position.set(0.08, 0.66, dz); g.add(inner);
  }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat); tail.position.set(-0.18, 0.22, 0); g.add(tail);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xc01f4a, emissive: 0x6a0a22, emissiveIntensity: 0.4 });
  for (const dz of [-0.06, 0.06]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), eyeMat); e.position.set(0.19, 0.46, dz); g.add(e); }
  return g;
}
function buildPetFox() { // Zorro naranja con orejas puntiagudas y cola con punta blanca.
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xff7a2e, roughness: 0.75 });
  const white = new THREE.MeshStandardMaterial({ color: 0xfbeede, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.26), mat); body.position.y = 0.2; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.26), mat); head.position.set(0.2, 0.36, 0); g.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.12), white); snout.position.set(0.35, 0.32, 0); g.add(snout);
  for (const dz of [-0.09, 0.09]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), dark); ear.position.set(0.16, 0.54, dz); g.add(ear); }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.12), mat); tail.position.set(-0.3, 0.3, 0); tail.rotation.z = 0.4; g.add(tail);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.12), white); tip.position.set(-0.42, 0.36, 0); g.add(tip);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const dz of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), eyeMat); e.position.set(0.31, 0.4, dz); g.add(e); }
  return g;
}
function buildPetBee() { // Abejita rayada que revolotea (flota).
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffcf1a, roughness: 0.6, emissive: 0x4a3a00, emissiveIntensity: 0.2 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.26), yellow); body.position.y = 0.38; g.add(body);
  for (const dx of [-0.06, 0.08]) { const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.27, 0.27), black); stripe.position.set(dx, 0.38, 0); g.add(stripe); }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), black); head.position.set(0.22, 0.4, 0); g.add(head);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.65, emissive: 0x88bbff, emissiveIntensity: 0.3 });
  const wings = [];
  for (const dz of [-0.16, 0.16]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.12), wingMat); w.position.set(0, 0.52, dz); g.add(w); wings.push(w); }
  const ant = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const dz of [-0.05, 0.05]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.02), ant); a.position.set(0.26, 0.54, dz); g.add(a); }
  g.userData.float = true; g.userData.wings = wings;
  return g;
}
function buildPetDragon() { // Dragoncito verde con alas y panza brillante (flota).
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3fbf5a, roughness: 0.6, emissive: 0x0a3a14, emissiveIntensity: 0.25 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xc8ff8a, roughness: 0.5, emissive: 0x6abf2a, emissiveIntensity: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.28), mat); body.position.y = 0.4; body.castShadow = true; g.add(body);
  const bel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.1), belly); bel.position.set(0.12, 0.38, 0); g.add(bel);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.24), mat); head.position.set(0.18, 0.6, 0); g.add(head);
  for (const dz of [-0.08, 0.08]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), belly); horn.position.set(0.12, 0.76, dz); g.add(horn); }
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x2a9d44, roughness: 0.6, side: THREE.DoubleSide });
  const wings = [];
  for (const dz of [-0.2, 0.2]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.3), wingMat); w.position.set(-0.05, 0.5, dz); g.add(w); wings.push(w); }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.08), mat); tail.position.set(-0.24, 0.34, 0); tail.rotation.z = 0.3; g.add(tail);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xffcc00, emissiveIntensity: 1.0 });
  for (const dz of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), eyeMat); e.position.set(0.3, 0.62, dz); g.add(e); }
  g.userData.float = true; g.userData.wings = wings;
  return g;
}
function buildPetZombie() { // Zombi mascota: mini-no-muerto con cerebro a la vista.
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7faa55, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x5e8240, roughness: 0.9 });
  const brain = new THREE.MeshStandardMaterial({ color: 0xe88aa0, roughness: 0.7, emissive: 0x5a1f33, emissiveIntensity: 0.25 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.24), mat); body.position.y = 0.2; body.castShadow = true; g.add(body);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.12, 0.25), dark); shirt.position.y = 0.16; g.add(shirt);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.22), mat); head.position.set(0.05, 0.46, 0); g.add(head);
  const br = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.18), brain); br.position.set(0.05, 0.6, 0); g.add(br);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xffcc00, emissiveIntensity: 1.0 });
  for (const dz of [-0.06, 0.06]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), eyeMat); e.position.set(0.16, 0.46, dz); g.add(e); }
  const arms = [];
  for (const dx of [-0.2, 0.2]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.24), mat); a.position.set(dx, 0.26, 0.14); g.add(a); arms.push(a); }
  g.userData.arms = arms;
  return g;
}

function buildPetPenguin() { // Pingüino con panza blanca y pico naranja.
  const g = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f7ff, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.28), black); body.position.y = 0.26; body.castShadow = true; g.add(body);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.1), white); belly.position.set(0.08, 0.24, 0); g.add(belly);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.24), black); head.position.set(0.05, 0.56, 0); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), new THREE.MeshStandardMaterial({ color: 0xff9a00 }));
  beak.rotation.z = -Math.PI / 2; beak.position.set(0.2, 0.54, 0); g.add(beak);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const dz of [-0.06, 0.06]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), eyeMat); e.position.set(0.15, 0.6, dz); g.add(e); }
  return g;
}
function buildPetPanda() { // Panda blanco con manchas y orejas negras.
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.8 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.28), white); body.position.y = 0.22; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.26), white); head.position.set(0.08, 0.46, 0); g.add(head);
  for (const dz of [-0.12, 0.12]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), black); ear.position.set(0.04, 0.6, dz); g.add(ear); }
  for (const dz of [-0.08, 0.08]) { const patch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.04), black); patch.position.set(0.2, 0.46, dz); g.add(patch); }
  const arm = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  for (const dz of [-0.16, 0.16]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), arm); a.position.set(0.05, 0.2, dz); g.add(a); }
  return g;
}
function buildPetDuck() { // Patito naranja regordete (flota un poco).
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffe14a, roughness: 0.6, emissive: 0x4a3a00, emissiveIntensity: 0.15 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat); body.position.y = 0.26; body.scale.set(1.1, 0.9, 1); body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat); head.position.set(0.14, 0.46, 0); g.add(head);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: 0xff8a00 }));
  beak.position.set(0.28, 0.44, 0); g.add(beak);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const dz of [-0.06, 0.06]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.03), eyeMat); e.position.set(0.2, 0.5, dz); g.add(e); }
  return g;
}
function buildPetSlime() { // Limo verde gelatinoso que rebota (flota).
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x35d07f, transparent: true, opacity: 0.82, emissive: 0x0aff6a, emissiveIntensity: 0.4, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.65), mat);
  body.position.y = 0.06; body.scale.set(1.2, 1, 1.2); g.add(body);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a2a18 });
  for (const dz of [-0.08, 0.08]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.04), eyeMat); e.position.set(0.18, 0.18, dz); g.add(e); }
  return g;
}
function buildPetDino() { // Dinosaurio verde con púas en la espalda.
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x4aa84a, roughness: 0.7 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xc8e88a, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.28), mat); body.position.y = 0.24; body.castShadow = true; g.add(body);
  const bel = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.1), belly); bel.position.set(0.12, 0.2, 0); g.add(bel);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.24), mat); head.position.set(0.22, 0.46, 0); g.add(head);
  const spikeMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.6 });
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), spikeMat); s.position.set(-0.05 + i * 0.12, 0.42, 0); g.add(s); }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.1), mat); tail.position.set(-0.28, 0.26, 0); tail.rotation.z = 0.3; g.add(tail);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const dz of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), eyeMat); e.position.set(0.33, 0.5, dz); g.add(e); }
  return g;
}
function buildPetOwl() { // Búho marrón con ojos grandes (flota).
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a6e3a, roughness: 0.8 });
  const light = new THREE.MeshStandardMaterial({ color: 0xd8b276, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.26), mat); body.position.y = 0.36; g.add(body);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.1), light); belly.position.set(0.06, 0.34, 0); g.add(belly);
  const wingMat = mat;
  const wings = [];
  for (const dz of [-0.17, 0.17]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.1), wingMat); w.position.set(0, 0.36, dz); g.add(w); wings.push(w); }
  for (const dz of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xffcc00, emissiveIntensity: 0.6 }));
    eye.position.set(0.13, 0.5, dz); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    pupil.position.set(0.2, 0.5, dz); g.add(pupil);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), new THREE.MeshStandardMaterial({ color: 0xff9a00 }));
  beak.rotation.z = -Math.PI / 2; beak.position.set(0.2, 0.42, 0); g.add(beak);
  for (const dz of [-0.1, 0.1]) { const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), mat); tuft.position.set(0, 0.6, dz); g.add(tuft); }
  g.userData.float = true; g.userData.wings = wings;
  return g;
}

// Mascota legendaria (regalo exclusivo por vencer al jefe): un ALIEN espacial
// verde de tres ojos, con MUCHA aura — doble esfera envolvente, disco de luz,
// antena luminosa, estrellas que orbitan y chispas que ascienden. Flota.
// Animada en updatePet (rama cosmic).
function buildPetCosmica() {
  const g = new THREE.Group();
  const green     = new THREE.MeshStandardMaterial({ color: 0x66c43a, roughness: 0.55, emissive: 0x1d3a0c, emissiveIntensity: 0.35 });
  const greenDark = new THREE.MeshStandardMaterial({ color: 0x4a9628, roughness: 0.7 });
  const white     = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  const black     = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const suit      = new THREE.MeshStandardMaterial({ color: 0x2f5fd0, roughness: 0.5 });
  const beltMat   = new THREE.MeshStandardMaterial({ color: 0x8a3bd0, roughness: 0.5, emissive: 0x3a1060, emissiveIntensity: 0.3 });

  // Cuerpo con TRAJE ESPACIAL azul + cabeza verde grandota.
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.3), suit);
  body.position.y = 0.46; g.add(body);
  // Cinturón morado.
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.32), beltMat);
  belt.position.y = 0.36; g.add(belt);
  // Emblema (planeta con anillo) en el pecho.
  const emblem = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe24a, emissive: 0xffd000, emissiveIntensity: 0.5 }));
  emblem.position.set(0, 0.5, 0.16); g.add(emblem);
  const emRing = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff }));
  emRing.position.set(0, 0.5, 0.16); emRing.rotation.y = 0.6; g.add(emRing);
  // Piernas/botas azules.
  for (const dx of [-0.09, 0.09]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.12), suit);
    leg.position.set(dx, 0.22, 0.02); g.add(leg);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.32), green);
  head.position.y = 0.78; g.add(head);
  // Orejas a los lados.
  for (const dx of [-0.22, 0.22]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.12), greenDark);
    ear.position.set(dx, 0.8, 0); g.add(ear);
  }
  // Antena con bombilla luminosa.
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), greenDark);
  antenna.position.set(0, 1.0, 0); g.add(antenna);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffe24a, emissive: 0xffd000, emissiveIntensity: 0.9 }));
  bulb.position.set(0, 1.1, 0); g.add(bulb);
  // Tres ojos sobre tallitos (el rasgo característico).
  const eyes = [];
  for (const dx of [-0.11, 0, 0.11]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.07, 6), greenDark);
    stalk.position.set(dx, 0.96, 0.1); g.add(stalk);
    const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), white);
    eyeW.position.set(dx, 1.0, 0.14); g.add(eyeW);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), black);
    pup.position.set(dx, 1.0, 0.19); g.add(pup);
    eyes.push(eyeW);
  }
  // Boca.
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), greenDark);
  mouth.position.set(0, 0.68, 0.17); g.add(mouth);
  // Bracitos: manga azul + mano verde (uno saludando, como en la referencia).
  for (const dx of [-0.23, 0.23]) {
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), suit);
    sleeve.position.set(dx, 0.46, 0.04); g.add(sleeve);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), green);
    hand.position.set(dx, dx > 0 ? 0.62 : 0.37, 0.05); g.add(hand); // mano derecha levantada
  }

  // --- Aura épica ---
  const auraInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x8aff5a, transparent: true, opacity: 0.26, side: THREE.BackSide })
  );
  auraInner.position.y = 0.7; g.add(auraInner);
  const auraOuter = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.12, side: THREE.BackSide })
  );
  auraOuter.position.y = 0.7; g.add(auraOuter);
  // Disco de luz girando bajo el alien.
  const groundGlow = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.045, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0x8aff5a, transparent: true, opacity: 0.55 })
  );
  groundGlow.rotation.x = Math.PI / 2; groundGlow.position.y = 0.2; g.add(groundGlow);
  // Estrellitas que orbitan y centellean.
  const stars = [];
  const starGeo = new THREE.OctahedronGeometry(0.045);
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    g.add(s); stars.push(s);
  }
  // Chispas que ascienden alrededor del alien.
  const sparks = [];
  const sparkGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0x8aff5a, transparent: true, opacity: 0.9 }));
    sp.userData = { phase: Math.random(), speed: 0.6 + Math.random() * 0.6, ang: Math.random() * 6.28, rad: 0.3 + Math.random() * 0.25 };
    g.add(sp); sparks.push(sp);
  }
  g.scale.setScalar(1.15);  // un pelín más grande que el resto de mascotas
  g.userData = { float: true, cosmic: true, alien: true, auraInner, auraOuter, groundGlow, stars, sparks, eyes, bulb };
  return g;
}

// ---- Catálogo de mascotas ----
const PETS = {
  none:     { name: "Ninguna",  price: 0,   swatch: "#3a3550" },
  // Mascota EXCLUSIVA legendaria: solo se consigue venciendo al JEFE FINAL.
  cosmica:  { name: "Alien", price: 0, swatch: "#66c43a", build: buildPetCosmica, exclusive: true, legendary: true },
  pollito:  { name: "Pollito",  price: 30,  swatch: "#ffd21a", build: buildPetChick },
  gato:     { name: "Gatito",   price: 40,  swatch: "#9aa3b2", build: buildPetCat },
  perro:    { name: "Perrito",  price: 40,  swatch: "#b5793f", build: buildPetDog },
  conejo:   { name: "Conejito", price: 45,  swatch: "#f4f0ef", build: buildPetBunny },
  fantasma: { name: "Fantasma", price: 45,  swatch: "#e8ecff", build: buildPetGhost },
  abeja:    { name: "Abejita",  price: 55,  swatch: "#ffcf1a", build: buildPetBee },
  robot:    { name: "Robotín",  price: 60,  swatch: "#00f0ff", build: buildPetBot,    reqLevel: 5 },
  zorro:    { name: "Zorro",    price: 70,  swatch: "#ff7a2e", build: buildPetFox,    reqLevel: 3 },
  zombi:    { name: "Zombi",    price: 85,  swatch: "#7faa55", build: buildPetZombie, reqLevel: 7 },
  dragon:   { name: "Dragón",   price: 120, swatch: "#3fbf5a", build: buildPetDragon, reqLevel: 8 },
  // ---- Bloque 8: mascotas nuevas ----
  pinguino: { name: "Pingüino", price: 45,  swatch: "#1b2230", build: buildPetPenguin },
  panda:    { name: "Panda",    price: 55,  swatch: "#f4f4f4", build: buildPetPanda },
  pato:     { name: "Patito",   price: 40,  swatch: "#ffe14a", build: buildPetDuck },
  limo:     { name: "Limo",     price: 50,  swatch: "#35d07f", build: buildPetSlime,   reqLevel: 4 },
  dino:     { name: "Dino",     price: 75,  swatch: "#4aa84a", build: buildPetDino,    reqLevel: 6 },
  buho:     { name: "Búho",     price: 60,  swatch: "#9a6e3a", build: buildPetOwl,     reqLevel: 5 },
};
const PET_ORDER = ["cosmica", "none", "pollito", "gato", "perro", "conejo", "fantasma", "abeja", "robot", "zorro", "zombi", "dragon", "pinguino", "panda", "pato", "limo", "dino", "buho"];

// Mascota viva en la escena (sigue al pollo con retardo).
let petMesh = null;
const petTarget = new THREE.Vector3();

// (Re)construye la mascota equipada y la coloca junto al pollo.
function applyPet() {
  if (petMesh) {
    scene.remove(petMesh);
    petMesh.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    petMesh = null;
  }
  const p = PETS[equippedPet];
  if (p && p.build) {
    petMesh = p.build();
    // Empezar detrás del pollo.
    petMesh.position.set(player.position.x - 0.9, 0, player.position.z + 0.9);
    scene.add(petMesh);
  }
}

// Movimiento de la mascota: persigue un punto detrás del pollo con suavizado.
function updatePet(dt, now) {
  if (!petMesh) return;
  // El Alien va centrado y MÁS atrás (detrás de los guardaespaldas, en medio);
  // las demás mascotas van un poco detrás y al lado del pollo.
  const ox = petMesh.userData.cosmic ? 0 : -0.7;
  const oz = petMesh.userData.cosmic ? 1.5 : 0.85;
  petTarget.set(player.position.x + ox, 0, player.position.z + oz);
  petMesh.position.x += (petTarget.x - petMesh.position.x) * Math.min(1, dt * 6);
  petMesh.position.z += (petTarget.z - petMesh.position.z) * Math.min(1, dt * 6);
  // Mirar hacia el pollo.
  const dx = player.position.x - petMesh.position.x;
  const dz = player.position.z - petMesh.position.z;
  if (dx * dx + dz * dz > 0.0004) petMesh.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
  // Bobeo: las que flotan se mantienen en alto; las demás dan saltitos.
  if (petMesh.userData.float) petMesh.position.y = 0.25 + Math.sin(now * 3) * 0.12;
  else petMesh.position.y = Math.abs(Math.sin(now * 6)) * 0.12;
  // Aleteo de las mascotas con alas (abeja, dragón).
  if (petMesh.userData.wings) {
    const flap = Math.sin(now * 22) * 0.6;
    petMesh.userData.wings[0].rotation.x = flap;
    petMesh.userData.wings[1].rotation.x = -flap;
  }
  // Brazos colgantes del zombi mascota.
  if (petMesh.userData.arms) {
    const sway = Math.sin(now * 5) * 0.15;
    petMesh.userData.arms[0].rotation.x = sway;
    petMesh.userData.arms[1].rotation.x = -sway;
  }
  // Mascota ALIEN: aura verde épica, disco de luz, estrellas en órbita, chispas
  // que ascienden, antena que parpadea y ojos que se balancean.
  if (petMesh.userData.cosmic) {
    const u = petMesh.userData;
    if (u.auraInner) {
      u.auraInner.material.color.setHSL((0.28 + Math.sin(now * 0.5) * 0.06 + 1) % 1, 1, 0.6);
      u.auraInner.material.opacity = 0.2 + Math.abs(Math.sin(now * 2)) * 0.18;
      u.auraInner.scale.setScalar(1 + Math.sin(now * 3) * 0.1);
    }
    if (u.auraOuter) {
      u.auraOuter.material.color.setHSL((0.5 + Math.sin(now * 0.4) * 0.08 + 1) % 1, 1, 0.6);
      u.auraOuter.material.opacity = 0.07 + Math.abs(Math.sin(now * 1.6)) * 0.12;
      u.auraOuter.scale.setScalar(1 + Math.sin(now * 2.2 + 1) * 0.12);
    }
    if (u.groundGlow) {
      u.groundGlow.rotation.z += dt * 1.4;
      u.groundGlow.material.opacity = 0.35 + Math.abs(Math.sin(now * 2.5)) * 0.4;
    }
    if (u.bulb) u.bulb.material.emissiveIntensity = 0.7 + Math.abs(Math.sin(now * 4)) * 0.8; // antena parpadea
    if (u.eyes) for (let i = 0; i < u.eyes.length; i++) {
      u.eyes[i].position.x += Math.sin(now * 2 + i) * 0.0008; // los ojos miran de lado a lado
    }
    if (u.stars) for (let i = 0; i < u.stars.length; i++) {
      const s = u.stars[i];
      const a = -now * 1.4 + (i / u.stars.length) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.5, 0.7 + Math.sin(now * 2 + i) * 0.26, Math.sin(a) * 0.5);
      s.material.color.setHSL((now * 0.5 + i / u.stars.length) % 1, 1, 0.72);
      s.scale.setScalar(0.6 + Math.abs(Math.sin(now * 5 + i)) * 0.7);
      s.rotation.y += dt * 4;
    }
    if (u.sparks) for (const sp of u.sparks) {
      sp.userData.phase += dt * sp.userData.speed;
      const p = sp.userData.phase % 1;
      sp.position.set(Math.cos(sp.userData.ang) * sp.userData.rad, 0.2 + p * 0.9, Math.sin(sp.userData.ang) * sp.userData.rad);
      sp.material.opacity = (1 - p) * 0.9;
    }
  }
}

// ---- Catálogo de logros ----
const ACHIEVEMENTS = {
  firstcoin: { name: "Primera moneda", desc: "Recoge tu primera moneda", icon: "🪙" },
  powerup1:  { name: "Estrenando", desc: "Recoge tu primer power-up", icon: "🎁" },
  lanes50:   { name: "Maratoniano", desc: "Cruza 50 carriles en una partida", icon: "🏁" },
  flying10:  { name: "As del cielo", desc: "Esquiva 10 vehículos voladores en una partida", icon: "✈️" },
  nostop:    { name: "Sin frenos", desc: "Completa un nivel sin pararte", icon: "⚡" },
  shieldsave:{ name: "Protegido", desc: "Sobrevive a un golpe con el escudo", icon: "🛡️" },
  powerup5:  { name: "Potenciado", desc: "Recoge 5 power-ups en una partida", icon: "💊" },
  coins100:  { name: "Ricachón", desc: "Junta 100 monedas en total", icon: "💰" },
  lanes100:  { name: "Imparable", desc: "Cruza 100 carriles en una partida", icon: "🚀" },
  win:       { name: "Campeón", desc: "Completa todos los niveles", icon: "🏆" },
  coins500:  { name: "Magnate", desc: "Junta 500 monedas en total", icon: "🤑" },
  collector: { name: "Coleccionista", desc: "Desbloquea todas las skins", icon: "🎨" },
};
const ACH_ORDER = ["firstcoin", "powerup1", "lanes50", "flying10", "nostop", "shieldsave", "powerup5", "coins100", "lanes100", "win", "coins500", "collector"];

// ---- Persistencia ----
function loadSave() {
  let data = {};
  try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { data = {}; }
  walletCoins = data.coins || 0;
  equippedSkin = data.equipped || "classic";
  ownedSkins = new Set(data.skins || ["classic"]);
  ownedSkins.add("classic");
  unlockedAch = new Set(data.achievements || []);
  best = data.best || 0;
  sfxMuted = !!data.sfxMuted;
  musicMuted = !!data.musicMuted;
  totalXp = data.xp || 0;
  playerLevel = levelFromXp(totalXp);
  weekId = data.weekId || 0;
  weeklyStats = Object.assign({ lanes: 0, coins: 0, levels: 0, powerups: 0, games: 0, flying: 0 }, data.weeklyStats || {});
  missionsClaimed = new Set(data.missionsClaimed || []);
  // Bloque 5: personalización (accesorios, estelas, temas, píos).
  ownedAccessories = new Set(data.accessories || ["none"]); ownedAccessories.add("none");
  equippedAccessory = data.equippedAccessory || "none";
  ownedTrails = new Set(data.trails || ["none"]); ownedTrails.add("none");
  equippedTrail = data.equippedTrail || "none";
  ownedThemes = new Set(data.themes || ["dark"]); ownedThemes.add("dark");
  equippedTheme = data.theme || "dark";
  ownedPios = new Set(data.pios || ["classic"]); ownedPios.add("classic"); ownedPios.add("none");
  equippedPio = data.pio || "classic";
  // Bloque 7: mascota acompañante.
  ownedPets = new Set(data.pets || ["none"]); ownedPets.add("none");
  equippedPet = data.pet || "none";
  // Bloque 7: estadísticas a largo plazo.
  stats = Object.assign(
    { games: 0, bestStreak: 0, carsDodged: 0, coinsTotal: 0, distance: 0 },
    data.stats || {}
  );
  stats.bestByLevel = Object.assign({}, (data.stats && data.stats.bestByLevel) || {});
  elBest.textContent = "Récord: " + best;
}
function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      coins: walletCoins,
      equipped: equippedSkin,
      skins: [...ownedSkins],
      achievements: [...unlockedAch],
      best,
      sfxMuted,
      musicMuted,
      xp: totalXp,
      weekId,
      weeklyStats,
      missionsClaimed: [...missionsClaimed],
      // Bloque 5: personalización.
      accessories: [...ownedAccessories],
      equippedAccessory,
      trails: [...ownedTrails],
      equippedTrail,
      themes: [...ownedThemes],
      theme: equippedTheme,
      pios: [...ownedPios],
      pio: equippedPio,
      // Bloque 7: mascota + estadísticas.
      pets: [...ownedPets],
      pet: equippedPet,
      stats,
    }));
  } catch (e) { /* almacenamiento no disponible */ }
}

// Sumar monedas a la cartera (se llama al recoger una moneda en el juego).
function addCoins(n) {
  walletCoins += n;
  stats.coinsTotal += n;   // Bloque 7: histórico de monedas recogidas
  saveProgress();
  updateCoinDisplays();
  if (walletCoins >= 1) unlockAchievement("firstcoin");
  if (walletCoins >= 100) unlockAchievement("coins100");
  if (walletCoins >= 500) unlockAchievement("coins500");
}

function updateCoinDisplays() {
  if (elMenuCoins) elMenuCoins.textContent = walletCoins;
  if (elShopCoins) elShopCoins.textContent = walletCoins;
}

// ---- Logros ----
function unlockAchievement(id) {
  if (unlockedAch.has(id)) return;
  unlockedAch.add(id);
  saveProgress();
  sfxAchievement();
  showAchToast(id);
  if (achScreenOpen) renderAchievements();
}

function checkProgressAchievements() {
  if (runLanes >= 50) unlockAchievement("lanes50");
  if (runLanes >= 100) unlockAchievement("lanes100");
  if (runFlying >= 10) unlockAchievement("flying10");
}

function showAchToast(id) {
  const a = ACHIEVEMENTS[id];
  if (!elAchToast || !a) return;
  elAchToast.innerHTML =
    '<span class="at-icon">' + a.icon + "</span>" +
    "<span><div class=\"at-title\">¡LOGRO!</div><div class=\"at-name\">" + a.name + "</div></span>";
  elAchToast.classList.remove("show");
  void elAchToast.offsetWidth; // reiniciar animación
  elAchToast.classList.add("show");
}

// ----------------------------------------------------------------------------
//  BLOQUE 4 — PROGRESIÓN (XP/NIVEL) Y MISIONES SEMANALES
//  · La XP se gana jugando (carriles, monedas, niveles). Al subir de nivel se
//    desbloquean recompensas: monedas y, en hitos, skins gratis.
//  · Cada semana hay 3 misiones (deterministas por semana) con premio en
//    monedas, que se cobra automáticamente al completarlas.
// ----------------------------------------------------------------------------

// ---- XP / nivel ----
const XP_PER_LANE = 1;    // por cada carril cruzado
const XP_PER_COIN = 4;    // por cada moneda recogida
const XP_PER_LEVEL = 30;  // por completar un nivel

// XP necesaria para PASAR del nivel L al L+1 (curva creciente y suave).
function xpToNext(level) { return 80 + (level - 1) * 40; }
// XP acumulada total necesaria para ALCANZAR un nivel dado.
function xpToReach(level) {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l);
  return sum;
}
// Nivel correspondiente a una XP total.
function levelFromXp(xp) {
  let level = 1;
  while (xp >= xpToReach(level + 1)) level++;
  return level;
}

// Recompensas al alcanzar cada nivel. Todos dan monedas; algunos hitos
// desbloquean una skin gratis.
const LEVEL_REWARDS = {
  2:  { coins: 20 },
  3:  { coins: 25, skin: "ninja" },
  4:  { coins: 30 },
  5:  { coins: 35, skin: "vaquero" },
  6:  { coins: 40 },
  7:  { coins: 45, skin: "zombie" },
  8:  { coins: 50 },
  10: { coins: 70, skin: "fuego" },
  12: { coins: 90, skin: "hielo" },
  15: { coins: 120, skin: "rey" },
};
function defaultReward(level) { return { coins: 15 + level * 5 }; }

// Sumar XP y procesar subidas de nivel (puede subir varios de golpe).
function addXp(n) {
  if (n <= 0) return;
  totalXp += n;
  const newLevel = levelFromXp(totalXp);
  while (playerLevel < newLevel) {
    playerLevel++;
    applyLevelReward(playerLevel);
  }
  saveProgress();
  updateLevelDisplay();
}

function applyLevelReward(level) {
  const r = LEVEL_REWARDS[level] || defaultReward(level);
  let extra = "";
  if (r.skin && !ownedSkins.has(r.skin)) {
    ownedSkins.add(r.skin);
    extra = " · Skin " + (SKINS[r.skin] ? SKINS[r.skin].name : r.skin);
    if (SKIN_ORDER.every((k) => SKINS[k].exclusive || ownedSkins.has(k))) unlockAchievement("collector");
  }
  if (r.coins) addCoins(r.coins);
  sfxAchievement();
  showLevelToast(level, "+" + (r.coins || 0) + " monedas" + extra);
  if (shopScreenOpen) renderShop();
}

function updateLevelDisplay() {
  if (elMenuLevelNum) elMenuLevelNum.textContent = playerLevel;
  const base = xpToReach(playerLevel);
  const need = xpToNext(playerLevel);
  const into = totalXp - base;
  const pct = Math.max(0, Math.min(100, (into / need) * 100));
  if (elMenuXpFill) elMenuXpFill.style.width = pct + "%";
  if (elMenuXpText) elMenuXpText.textContent = into + " / " + need + " XP";
}

function showLevelToast(level, detail) {
  bigToast("⬆️", "¡NIVEL " + level + "!", detail);
}
function showMissionToast(detail) {
  bigToast("✅", "¡MISIÓN COMPLETADA!", detail);
}
// Aviso grande reutilizable (nivel / misión).
function bigToast(icon, title, detail) {
  if (!elLevelToast) return;
  elLevelToast.innerHTML =
    '<span class="lt-icon">' + icon + "</span>" +
    '<span><div class="lt-title">' + title + '</div><div class="lt-name">' + detail + "</div></span>";
  elLevelToast.classList.remove("show");
  void elLevelToast.offsetWidth;
  elLevelToast.classList.add("show");
}

// ---- Misiones semanales ----
// Plantillas; cada semana se eligen varias de forma determinista por el nº de semana.
const MISSION_POOL = [
  { key: "lanes",    icon: "🏁", desc: (t) => "Cruza " + t + " carriles",        targets: [120, 180, 250], reward: 30 },
  { key: "coins",    icon: "🪙", desc: (t) => "Recoge " + t + " monedas",         targets: [30, 50, 80],    reward: 25 },
  { key: "levels",   icon: "🚩", desc: (t) => "Completa " + t + " niveles",       targets: [3, 5, 8],       reward: 40 },
  { key: "powerups", icon: "🎁", desc: (t) => "Recoge " + t + " power-ups",       targets: [6, 10, 15],     reward: 20 },
  { key: "games",    icon: "🎮", desc: (t) => "Juega " + t + " partidas",         targets: [3, 5, 10],      reward: 15 },
  { key: "flying",   icon: "✈️", desc: (t) => "Esquiva " + t + " voladores",      targets: [15, 30, 50],    reward: 35 },
  { key: "coins",    icon: "💰", desc: (t) => "Hazte rico: " + t + " monedas",    targets: [100, 150],      reward: 60 },
  { key: "lanes",    icon: "🚀", desc: (t) => "Maratón de " + t + " carriles",    targets: [350, 500],      reward: 70 },
  // ---- Bloque 8: misiones nuevas ----
  { key: "levels",   icon: "🏆", desc: (t) => "Supera " + t + " niveles",         targets: [10, 15],        reward: 80 },
  { key: "flying",   icon: "🦅", desc: (t) => "Burla " + t + " águilas y aves",    targets: [70, 100],       reward: 55 },
  { key: "powerups", icon: "⭐", desc: (t) => "Acumula " + t + " power-ups",       targets: [20, 30],        reward: 45 },
  { key: "games",    icon: "🕹️", desc: (t) => "Vicio: juega " + t + " partidas",  targets: [15, 20],        reward: 40 },
  { key: "lanes",    icon: "👟", desc: (t) => "Da " + t + " pasos al frente",      targets: [80, 120],       reward: 20 },
  { key: "coins",    icon: "✨", desc: (t) => "Brilla con " + t + " monedas",       targets: [40, 60],        reward: 30 },
];
const MISSIONS_PER_WEEK = 5; // misiones activas por semana

// PRNG determinista (mulberry32) para que las misiones sean iguales toda la semana.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function currentWeekId() { return Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)); }

// Genera MISSIONS_PER_WEEK misiones distintas a partir del id de semana.
function generateMissions(wid) {
  const rng = mulberry32(wid + 1);
  const pool = MISSION_POOL.slice();
  const out = [];
  for (let i = 0; i < MISSIONS_PER_WEEK && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    const tmpl = pool.splice(idx, 1)[0];
    const target = tmpl.targets[Math.floor(rng() * tmpl.targets.length)];
    out.push({ id: tmpl.key + "-" + target, key: tmpl.key, icon: tmpl.icon, desc: tmpl.desc(target), target, reward: tmpl.reward });
  }
  return out;
}

// Comprueba si toca renovar (nueva semana) y reconstruye las misiones activas.
function refreshWeeklyMissions() {
  const wid = currentWeekId();
  if (wid !== weekId) {
    weekId = wid;
    weeklyStats = { lanes: 0, coins: 0, levels: 0, powerups: 0, games: 0, flying: 0 };
    missionsClaimed = new Set();
    saveProgress();
  }
  missions = generateMissions(weekId);
}

// Suma progreso semanal de una categoría y cobra misiones completadas.
function addWeeklyProgress(key, n) {
  if (!n) return;
  weeklyStats[key] = (weeklyStats[key] || 0) + n;
  let changed = false;
  for (const m of missions) {
    if (m.key === key && !missionsClaimed.has(m.id) && weeklyStats[key] >= m.target) {
      missionsClaimed.add(m.id);
      addCoins(m.reward);          // premio automático
      sfxAchievement();
      showMissionToast(m.desc + " · +" + m.reward + " monedas");
      changed = true;
    }
  }
  saveProgress();
  if (changed && missionScreenOpen) renderMissions();
}

function renderMissions() {
  if (!elMissionsList) return;
  let html = "";
  for (const m of missions) {
    const prog = Math.min(weeklyStats[m.key] || 0, m.target);
    const done = missionsClaimed.has(m.id);
    const pct = Math.min(100, (prog / m.target) * 100);
    html += '<div class="mission-card' + (done ? " done" : "") + '">' +
      '<span class="mission-icon">' + m.icon + "</span>" +
      '<span class="mission-info">' +
        '<div class="mission-name">' + m.desc + "</div>" +
        '<div class="mission-bar"><div class="mission-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="mission-progress">' + prog + " / " + m.target + "</div>" +
      "</span>" +
      '<span class="mission-reward' + (done ? " claimed" : "") + '">' + (done ? "✓" : ('<span class="coin-icon"></span> ' + m.reward)) + "</span>" +
      "</div>";
  }
  elMissionsList.innerHTML = html;
  if (elMissionsTimer) {
    const msLeft = (weekId + 1) * 7 * 24 * 60 * 60 * 1000 - Date.now();
    const days = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
    elMissionsTimer.textContent = days + (days === 1 ? " día" : " días");
  }
}

// ---- Tienda (con pestañas por categoría) ----
// Pestañas disponibles; cada una mapea a un catálogo + set de desbloqueados.
const SHOP_TABS = [
  { id: "skins",     label: "Skins" },
  { id: "accessory", label: "Accesorios" },
  { id: "trail",     label: "Estelas" },
  { id: "theme",     label: "Temas" },
  { id: "pio",       label: "Píos" },
  { id: "pet",       label: "Mascotas" },
];
let activeShopTab = "skins";

// Devuelve la configuración (catálogo/orden/desbloqueados/equipado) de una pestaña.
function shopCategory(tab) {
  switch (tab) {
    case "accessory": return { catalog: ACCESSORIES, order: ACCESSORY_ORDER, owned: ownedAccessories, equipped: equippedAccessory };
    case "trail":     return { catalog: TRAILS,      order: TRAIL_ORDER,     owned: ownedTrails,      equipped: equippedTrail };
    case "theme":     return { catalog: THEMES,      order: THEME_ORDER,     owned: ownedThemes,      equipped: equippedTheme };
    case "pio":       return { catalog: PIOS,        order: PIO_ORDER,       owned: ownedPios,        equipped: equippedPio };
    case "pet":       return { catalog: PETS,        order: PET_ORDER,       owned: ownedPets,        equipped: equippedPet };
    default:          return { catalog: SKINS,       order: SKIN_ORDER,      owned: ownedSkins,       equipped: equippedSkin };
  }
}

// Estilo de la muestra de color (swatch); "rainbow" usa un degradado arcoíris.
function swatchStyle(swatch) {
  if (swatch === "rainbow") return "background:linear-gradient(90deg,#ff0040,#ff9900,#ffe600,#00ff66,#00aaff,#8a2be2)";
  return "background:" + swatch;
}

function renderShop() {
  if (!elShopList) return;
  if (elShopCoins) elShopCoins.textContent = walletCoins;

  // Barra de pestañas.
  if (elShopTabs) {
    elShopTabs.innerHTML = SHOP_TABS.map((t) =>
      '<button class="shop-tab' + (t.id === activeShopTab ? " active" : "") + '" data-tab="' + t.id + '">' + t.label + "</button>"
    ).join("");
    elShopTabs.querySelectorAll("[data-tab]").forEach((b) => {
      b.onclick = () => { activeShopTab = b.dataset.tab; renderShop(); };
    });
  }

  // Lista de artículos de la pestaña activa.
  const c = shopCategory(activeShopTab);
  let html = "";
  for (const id of c.order) {
    const s = c.catalog[id];
    const owned = c.owned.has(id);
    const equipped = c.equipped === id;
    const locked = s.reqLevel && playerLevel < s.reqLevel; // bloqueo por nivel (Bloque 3)
    const exclusiveLocked = s.exclusive && !owned;          // exclusiva sin desbloquear (Parte 6)
    let action;
    if (equipped) action = '<button class="skin-action equip" disabled>EQUIPADO</button>';
    else if (owned) action = '<button class="skin-action equip" data-equip="' + id + '">EQUIPAR</button>';
    else if (exclusiveLocked) action = '<button class="skin-action" disabled>🏆 Vence al jefe</button>';
    else if (locked) action = '<button class="skin-action" disabled>🔒 Nivel ' + s.reqLevel + "</button>";
    else action = '<button class="skin-action" data-buy="' + id + '"' + (walletCoins < s.price ? " disabled" : "") + '><span class="coin-icon"></span> ' + s.price + "</button>";
    const sub = owned ? (s.legendary ? "✦ LEGENDARIA ✦" : "Desbloqueado")
      : exclusiveLocked ? "Exclusiva: vence al JEFE FINAL"
      : locked ? ("Requiere nivel " + s.reqLevel)
      : ("Precio: " + s.price + " monedas");
    html += '<div class="skin-card' + (equipped ? " equipped" : "") + (s.legendary ? " legendary" : "") + '">' +
      '<span class="skin-swatch" style="' + swatchStyle(s.swatch) + '"></span>' +
      '<span class="skin-info"><div class="skin-name">' + s.name + (s.legendary ? ' <span class="legendary-badge">★</span>' : '') + '</div><div class="skin-price">' + sub + "</div></span>" +
      action + "</div>";
  }
  elShopList.innerHTML = html;
  elShopList.querySelectorAll("[data-buy]").forEach((b) => { b.onclick = () => buyItem(activeShopTab, b.dataset.buy); });
  elShopList.querySelectorAll("[data-equip]").forEach((b) => { b.onclick = () => equipItem(activeShopTab, b.dataset.equip); });
}

// Equipar un artículo de cualquier categoría (aplica el efecto + persiste).
function equipItem(tab, id) {
  const c = shopCategory(tab);
  if (!c.owned.has(id)) return;
  if (tab === "skins") { equippedSkin = id; applySkin(level); }
  else if (tab === "accessory") { equippedAccessory = id; applyAccessory(); }
  else if (tab === "trail") { equippedTrail = id; }
  else if (tab === "theme") { equippedTheme = id; applyTheme(id); }
  else if (tab === "pio") { equippedPio = id; sfxJump(); } // previsualizar el pío
  else if (tab === "pet") { equippedPet = id; applyPet(); } // Bloque 7: mascota
  saveProgress();
  renderShop();
}

// Comprar un artículo de cualquier categoría (y equiparlo automáticamente).
function buyItem(tab, id) {
  const c = shopCategory(tab);
  const s = c.catalog[id];
  if (!s || c.owned.has(id) || walletCoins < s.price) return;
  if (s.reqLevel && playerLevel < s.reqLevel) return; // bloqueo por nivel (Bloque 3)
  walletCoins -= s.price;
  c.owned.add(id);
  saveProgress();
  updateCoinDisplays();
  equipItem(tab, id); // al comprar, se equipa (también guarda y re-renderiza)
  if (tab === "skins" && SKIN_ORDER.every((k) => SKINS[k].exclusive || ownedSkins.has(k))) unlockAchievement("collector");
}

// ---- Medallero ----
function renderAchievements() {
  if (!elAchList) return;
  let html = "";
  for (const id of ACH_ORDER) {
    const a = ACHIEVEMENTS[id];
    const got = unlockedAch.has(id);
    html += '<div class="medal ' + (got ? "unlocked" : "locked") + '">' +
      '<span class="medal-icon">' + (got ? a.icon : "🔒") + "</span>" +
      '<span class="medal-text"><div class="medal-name">' + a.name + '</div><div class="medal-desc">' + a.desc + "</div></span></div>";
  }
  elAchList.innerHTML = html;
}

// ---- Estadísticas (Bloque 7) ----
const LEVEL_NAMES = { 1: "Ciudad", 2: "Ríos", 3: "Tormenta", 4: "Desierto", 5: "Apocalipsis", 6: "Circo", 7: "Lava" };

function renderStats() {
  if (!elStatsList) return;
  // Tarjetas de totales.
  const cards = [
    { icon: "🎮", label: "Partidas jugadas", value: stats.games },
    { icon: "👟", label: "Distancia total", value: stats.distance + " casillas" },
    { icon: "🚗", label: "Coches esquivados", value: stats.carsDodged },
    { icon: "⚡", label: "Mejor racha sin parar", value: stats.bestStreak + " carriles" },
    { icon: "🪙", label: "Monedas recogidas", value: stats.coinsTotal },
    { icon: "🏆", label: "Récord global", value: best },
  ];
  let html = '<div class="stat-cards">';
  for (const c of cards) {
    html += '<div class="stat-card"><span class="stat-icon">' + c.icon + '</span>' +
      '<span class="stat-value">' + c.value + '</span>' +
      '<span class="stat-label">' + c.label + '</span></div>';
  }
  html += "</div>";

  // Mejor puntuación por nivel.
  html += '<div class="stat-subtitle">Mejor puntuación por nivel</div>';
  html += '<div class="stat-levels">';
  for (let l = 1; l <= 7; l++) {
    const v = stats.bestByLevel[String(l)] || 0;
    html += '<div class="stat-level"><span class="sl-num">Nv ' + l + '</span>' +
      '<span class="sl-name">' + (LEVEL_NAMES[l] || "") + '</span>' +
      '<span class="sl-best">' + v + '</span></div>';
  }
  html += "</div>";
  elStatsList.innerHTML = html;
}

// ---- Álbum / colección (Bloque 7) ----
// Muestra TODOS los cosméticos: los conseguidos a color y los que faltan como
// silueta bloqueada. Agrupado por categoría con su contador.
const ALBUM_SECTIONS = [
  { title: "Skins",      catalog: () => SKINS,       order: () => SKIN_ORDER,      owned: () => ownedSkins },
  { title: "Accesorios", catalog: () => ACCESSORIES, order: () => ACCESSORY_ORDER, owned: () => ownedAccessories },
  { title: "Estelas",    catalog: () => TRAILS,      order: () => TRAIL_ORDER,     owned: () => ownedTrails },
  { title: "Mascotas",   catalog: () => PETS,        order: () => PET_ORDER,       owned: () => ownedPets },
];

function renderAlbum() {
  if (!elAlbumList) return;
  let html = "";
  for (const sec of ALBUM_SECTIONS) {
    const catalog = sec.catalog(), order = sec.order(), owned = sec.owned();
    const total = order.length;
    const got = order.filter((id) => owned.has(id)).length;
    html += '<div class="album-section-title">' + sec.title +
      ' <span class="album-count">' + got + "/" + total + "</span></div>";
    html += '<div class="album-grid">';
    for (const id of order) {
      const item = catalog[id];
      const has = owned.has(id);
      const style = has ? swatchStyle(item.swatch) : "";
      html += '<div class="album-item' + (has ? "" : " locked") + '">' +
        '<span class="album-swatch" style="' + style + '"></span>' +
        '<span class="album-name">' + (has ? item.name : "???") + "</span></div>";
    }
    html += "</div>";
  }
  elAlbumList.innerHTML = html;
}

// ---- Navegación de pantallas del menú ----
function openShop() { shopScreenOpen = true; renderShop(); elStart.classList.add("hidden"); elShopScreen.classList.remove("hidden"); }
function closeShop() { shopScreenOpen = false; elShopScreen.classList.add("hidden"); elStart.classList.remove("hidden"); }
function openAch() { achScreenOpen = true; renderAchievements(); elStart.classList.add("hidden"); elAchScreen.classList.remove("hidden"); }
function closeAch() { achScreenOpen = false; elAchScreen.classList.add("hidden"); elStart.classList.remove("hidden"); }
function openMissions() { missionScreenOpen = true; refreshWeeklyMissions(); renderMissions(); elStart.classList.add("hidden"); elMissionsScreen.classList.remove("hidden"); }
function closeMissions() { missionScreenOpen = false; elMissionsScreen.classList.add("hidden"); elStart.classList.remove("hidden"); }
function openStats() { statsScreenOpen = true; renderStats(); elStart.classList.add("hidden"); elStatsScreen.classList.remove("hidden"); }
function closeStats() { statsScreenOpen = false; elStatsScreen.classList.add("hidden"); elStart.classList.remove("hidden"); }
function openAlbum() { albumScreenOpen = true; renderAlbum(); elStart.classList.add("hidden"); elAlbumScreen.classList.remove("hidden"); }
function closeAlbum() { albumScreenOpen = false; elAlbumScreen.classList.add("hidden"); elStart.classList.remove("hidden"); }

// DOM de las pantallas nuevas.
const elMenuCoins = document.getElementById("menu-coin-count");
const elShopCoins = document.getElementById("shop-coin-count");
const elShopScreen = document.getElementById("shop-screen");
const elShopTabs = document.getElementById("shop-tabs");
const elShopList = document.getElementById("shop-list");
const elAchScreen = document.getElementById("achievements-screen");
const elAchList = document.getElementById("ach-list");
const elAchToast = document.getElementById("ach-toast");
// Progresión y misiones (Bloque 4).
const elMenuLevelNum = document.getElementById("menu-level-num");
const elMenuXpFill = document.getElementById("menu-xp-fill");
const elMenuXpText = document.getElementById("menu-xp-text");
const elLevelToast = document.getElementById("level-toast");
const elMissionsScreen = document.getElementById("missions-screen");
const elMissionsList = document.getElementById("missions-list");
const elMissionsTimer = document.getElementById("missions-timer");
// Estadísticas y álbum (Bloque 7).
const elStatsScreen = document.getElementById("stats-screen");
const elStatsList = document.getElementById("stats-list");
const elAlbumScreen = document.getElementById("album-screen");
const elAlbumList = document.getElementById("album-list");

// Contador GLOBAL de visitas: cada carga suma 1 en un servicio gratuito de
// contadores (sin registro) y muestra el total en el menú. Si el servicio falla,
// el contador simplemente no se actualiza (no afecta al juego).
function countVisit() {
  const el = document.getElementById("visit-count");
  if (!el) return;
  // Solo contar una vez por carga de página (no en cada vuelta al menú).
  if (window.__visitCounted) return;
  window.__visitCounted = true;
  fetch("https://abacus.jasoncameron.dev/hit/chickenrush-battlemundial/visitas")
    .then((r) => r.json())
    .then((d) => { if (d && typeof d.value === "number") el.textContent = d.value.toLocaleString("es-ES"); })
    .catch(() => { el.textContent = "—"; });
}

// Carga la partida guardada y aplica skin + botones del menú.
function initProgression() {
  loadSave();
  applyTheme(equippedTheme);   // Bloque 5: tema de UI guardado
  applySkin(1);                // applySkin re-aplica también el accesorio del jugador
  applyPet();                  // Bloque 7: mostrar la mascota equipada en el menú
  updateCoinDisplays();
  refreshWeeklyMissions();   // renueva misiones si ha cambiado la semana
  updateLevelDisplay();      // pinta nivel y barra de XP en el menú
  countVisit();              // contador global de visitas (servicio externo gratis)
  document.getElementById("shop-btn").addEventListener("click", openShop);
  document.getElementById("ach-btn").addEventListener("click", openAch);
  document.getElementById("missions-btn").addEventListener("click", openMissions);
  document.getElementById("shop-back").addEventListener("click", closeShop);
  document.getElementById("ach-back").addEventListener("click", closeAch);
  document.getElementById("missions-back").addEventListener("click", closeMissions);
  // Bloque 7: estadísticas y álbum.
  const statsBtn = document.getElementById("stats-btn");
  if (statsBtn) statsBtn.addEventListener("click", openStats);
  const statsBack = document.getElementById("stats-back");
  if (statsBack) statsBack.addEventListener("click", closeStats);
  const albumBtn = document.getElementById("album-btn");
  if (albumBtn) albumBtn.addEventListener("click", openAlbum);
  const albumBack = document.getElementById("album-back");
  if (albumBack) albumBack.addEventListener("click", closeAlbum);
  document.getElementById("sfx-btn").addEventListener("click", toggleSfx);
  document.getElementById("music-btn").addEventListener("click", toggleMusic);
  const resetBtn = document.getElementById("reset-btn");
  if (resetBtn) resetBtn.addEventListener("click", openResetConfirm);
  const resetConfirm = document.getElementById("reset-confirm");
  if (resetConfirm) resetConfirm.addEventListener("click", doResetGame);
  const resetCancel = document.getElementById("reset-cancel");
  if (resetCancel) resetCancel.addEventListener("click", closeResetConfirm);
  updateAudioButtons();
}

// ---- Reinicio total del progreso (con confirmación dentro del juego) ----
const elResetScreen = document.getElementById("reset-screen");

function openResetConfirm() {
  if (elResetScreen) {
    elResetScreen.classList.remove("hidden");
    elStart.classList.add("hidden");
  }
}
function closeResetConfirm() {
  if (elResetScreen) {
    elResetScreen.classList.add("hidden");
    elStart.classList.remove("hidden");
  }
}
// Borra el guardado de localStorage y recarga para empezar de cero.
function doResetGame() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* sin almacenamiento */ }
  location.reload(); // arranca limpio con los valores por defecto
}

// ----------------------------------------------------------------------------
//  BLOQUE 3 — SENSACIÓN Y FEEDBACK
//  Sonidos y música sintetizados con Web Audio API (sin archivos), vibración
//  en móvil, partículas y pantalla de Game Over mejorada.
// ----------------------------------------------------------------------------

// ---- Ajustes de audio (persisten en localStorage vía loadSave/saveProgress) --
let sfxMuted = false;
let musicMuted = false;

let audioCtx = null, sfxGain = null, musicGain = null;

function initAudio() {
  if (audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audioCtx = new AC();
  sfxGain = audioCtx.createGain();
  sfxGain.gain.value = sfxMuted ? 0 : 0.5;
  sfxGain.connect(audioCtx.destination);
  musicGain = audioCtx.createGain();
  musicGain.gain.value = musicMuted ? 0 : 0.22;
  musicGain.connect(audioCtx.destination);
}
// Crea/reanuda el contexto (debe llamarse dentro de un gesto del usuario).
function ensureAudio() {
  if (!audioCtx) initAudio();
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

// Nota con envolvente, enrutada a SFX (por defecto) o a música.
function tone(freq, dur, type = "square", peak = 0.5, dest = null, when = 0) {
  if (!audioCtx) return;
  const out = dest || sfxGain;
  if (!out) return;
  const t0 = audioCtx.currentTime + when;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(out);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

// "Peep" con glissando: la frecuencia barre f0 -> fMid -> fEnd durante la nota.
// Ese deslizamiento de tono es lo que hace que un pío suene a pájaro REAL en
// vez de a pitido plano. Un pollito típico sube y luego baja (V invertida).
// Parámetros: f0 inicio, fMid pico (a mitad), fEnd final; el resto como tone().
function chirp(f0, fMid, fEnd, dur, type = "triangle", peak = 0.34, dest = null, when = 0) {
  if (!audioCtx) return;
  const out = dest || sfxGain;
  if (!out) return;
  const t0 = audioCtx.currentTime + when;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  // Barrido de frecuencia (exponencial = suena natural al oído).
  osc.frequency.setValueAtTime(Math.max(1, f0), t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, fMid), t0 + dur * 0.45);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, fEnd), t0 + dur);
  // Envolvente rápida tipo chasquido de pío: ataque muy corto, caída suave.
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.setValueAtTime(peak, t0 + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(out);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

// Pío realista = peep fundamental (triangle) + armónico brillante tenue (sine
// una octava arriba siguiendo el mismo barrido). Suena a pollito de verdad.
function peep(f0, fMid, fEnd, dur, peak = 0.3, when = 0) {
  chirp(f0, fMid, fEnd, dur, "triangle", peak, null, when);
  chirp(f0 * 2, fMid * 2, fEnd * 2, dur * 0.9, "sine", peak * 0.22, null, when);
}

function sfxJump() { if (sfxMuted) return; ensureAudio(); const p = PIOS[equippedPio] || PIOS.classic; p.play(); }
function sfxCoin() { if (sfxMuted) return; ensureAudio(); tone(988, 0.08, "square", 0.35); tone(1319, 0.12, "square", 0.35, null, 0.07); }
function sfxPowerup() { if (sfxMuted) return; ensureAudio(); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, "triangle", 0.4, null, i * 0.06)); }
function sfxAchievement() { if (sfxMuted) return; ensureAudio(); [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.18, "triangle", 0.45, null, i * 0.1)); }
function sfxFanfare() { if (sfxMuted) return; ensureAudio(); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, "square", 0.4, null, i * 0.09)); }
// "Casi": un silbido rápido ascendente; el legendario suena más rico.
function sfxNearMiss(legendary) {
  if (sfxMuted) return; ensureAudio();
  if (legendary) [784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.1, "triangle", 0.4, null, i * 0.05));
  else { tone(880, 0.06, "sine", 0.3); tone(1245, 0.09, "sine", 0.3, null, 0.05); }
}
function sfxCrash() {
  if (sfxMuted) return;
  ensureAudio();
  if (!audioCtx || !sfxGain) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(300, t0);
  osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.35);
  g.gain.setValueAtTime(0.5, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
  osc.connect(g); g.connect(sfxGain);
  osc.start(t0); osc.stop(t0 + 0.37);
}

// Chisporroteo de la parrilla al asarse el pollo en la lava (nivel 7).
function sfxSizzle() {
  if (sfxMuted) return; ensureAudio();
  if (!audioCtx || !sfxGain) return;
  // Crepitar: ráfagas cortas y agudas.
  for (let i = 0; i < 6; i++) {
    tone(2000 + Math.random() * 1600, 0.05, "square", 0.12, null, i * 0.06);
  }
  // "Puff" grave del salto.
  tone(180, 0.22, "sawtooth", 0.3, null, 0);
}

// Cristalización de hielo al congelarse el pollo en el río (nivel 2).
function sfxFreeze() {
  if (sfxMuted) return; ensureAudio();
  if (!audioCtx || !sfxGain) return;
  // Tintineo agudo descendente (el hielo formándose).
  [1568, 1318, 1046, 880].forEach((f, i) => tone(f, 0.12, "triangle", 0.18, null, i * 0.05));
  // "Puff" grave del salto.
  tone(160, 0.2, "sine", 0.25, null, 0);
}

// ---- SFX del nivel 5 (apocalipsis zombie) ----
// Gruñido grave de zombi (sierra descendente).
function sfxZombie() {
  if (sfxMuted) return; ensureAudio();
  if (!audioCtx || !sfxGain) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(140, t0);
  osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.3);
  g.gain.setValueAtTime(0.35, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
  osc.connect(g); g.connect(sfxGain);
  osc.start(t0); osc.stop(t0 + 0.34);
}
// Rugido del monstruo de lava (nivel 7): bramido grave + crepitar de brasas.
function sfxLavaRoar() {
  if (sfxMuted) return; ensureAudio();
  if (!audioCtx || !sfxGain) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(95, t0);
  osc.frequency.exponentialRampToValueAtTime(48, t0 + 0.45);
  g.gain.setValueAtTime(0.4, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
  osc.connect(g); g.connect(sfxGain);
  osc.start(t0); osc.stop(t0 + 0.52);
  for (let i = 0; i < 4; i++) tone(1400 + Math.random() * 1000, 0.04, "square", 0.08, null, i * 0.07);
}
// Mordisco de planta carnívora (chasquido rápido).
function sfxPlant() {
  if (sfxMuted) return; ensureAudio();
  tone(420, 0.05, "square", 0.4);
  tone(180, 0.12, "sawtooth", 0.4, null, 0.04);
}
// Aviso de tren: pitidos de alarma.
function sfxTrainWarn() {
  if (sfxMuted) return; ensureAudio();
  [0, 0.18, 0.36].forEach((d) => tone(740, 0.1, "square", 0.4, null, d));
}
// Tren cruzando: bocina grave + traqueteo.
function sfxTrain() {
  if (sfxMuted) return; ensureAudio();
  tone(110, 0.6, "sawtooth", 0.45);
  tone(82, 0.7, "square", 0.35, null, 0.05);
}

// ---- Zumbido del motor (ambiente mientras se juega) ----
let engineOsc = null, engineGain = null, engineLfo = null, engineLfoGain = null, engineFilter = null;
const ENGINE_VOL = 0.04;
function startEngine() {
  ensureAudio();
  if (!audioCtx || engineOsc) return;
  const t0 = audioCtx.currentTime;
  engineGain = audioCtx.createGain();
  engineGain.gain.setValueAtTime(0.0001, t0);
  engineGain.gain.exponentialRampToValueAtTime(sfxMuted ? 0.0001 : ENGINE_VOL, t0 + 0.4); // entrada suave
  // Filtro paso-bajo: quita los armónicos agudos y ásperos del motor.
  engineFilter = audioCtx.createBiquadFilter();
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 200;
  engineFilter.Q.value = 0.7;
  engineGain.connect(audioCtx.destination);
  engineFilter.connect(engineGain);
  engineOsc = audioCtx.createOscillator();
  engineOsc.type = "triangle"; // más suave que sawtooth
  engineOsc.frequency.value = 55;
  engineLfo = audioCtx.createOscillator(); // vibrato lento para que "ronronee"
  engineLfoGain = audioCtx.createGain();
  engineLfo.frequency.value = 5;
  engineLfoGain.gain.value = 3;
  engineLfo.connect(engineLfoGain); engineLfoGain.connect(engineOsc.frequency);
  engineOsc.connect(engineFilter);
  engineOsc.start(); engineLfo.start();
}
function stopEngine() {
  // Salida suave (fade-out) para evitar el "clic" al cortar el oscilador.
  const osc = engineOsc, lfo = engineLfo, lfoGain = engineLfoGain, gain = engineGain, filter = engineFilter;
  engineOsc = engineLfo = engineLfoGain = engineGain = engineFilter = null;
  if (audioCtx && gain) {
    const t = audioCtx.currentTime;
    try { gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); } catch (e) {}
  }
  setTimeout(() => {
    if (osc) { try { osc.stop(); } catch (e) {} osc.disconnect(); }
    if (lfo) { try { lfo.stop(); } catch (e) {} lfo.disconnect(); }
    if (lfoGain) lfoGain.disconnect();
    if (filter) filter.disconnect();
    if (gain) gain.disconnect();
  }, 200);
}

// ---- Música de fondo por nivel (secuenciador simple) ----
const MUSIC = {
  1: { tempo: 210, wave: "square",   notes: [523, 0, 392, 440, 523, 0, 659, 0, 587, 0, 494, 440, 392, 0, 440, 0] },
  2: { tempo: 250, wave: "triangle", notes: [440, 0, 0, 494, 523, 0, 0, 440, 392, 0, 0, 440, 494, 0, 0, 0] },
  3: { tempo: 185, wave: "sawtooth", notes: [329, 0, 392, 0, 329, 294, 0, 262, 294, 0, 329, 0, 262, 0, 220, 0] },
  // Nivel 4 (desierto): escala "oriental"/cálida, tempo medio y aire misterioso.
  4: { tempo: 160, wave: "triangle", notes: [294, 0, 311, 349, 0, 311, 294, 0, 262, 0, 294, 311, 349, 0, 392, 0] },
  // Nivel 5 (apocalipsis zombie): tema lento, grave y disonante (menor).
  5: { tempo: 230, wave: "sawtooth", notes: [196, 0, 0, 233, 0, 207, 0, 0, 175, 0, 196, 0, 233, 0, 0, 0] },
  // Nivel 6 (circo): melodía de calíope rápida, saltarina y festiva.
  6: { tempo: 240, wave: "square",   notes: [523, 659, 784, 659, 523, 659, 784, 1047, 880, 698, 784, 659, 587, 523, 587, 0] },
  // Nivel 7 (lava): tema grave y tenso.
  7: { tempo: 175, wave: "square",   notes: [262, 294, 329, 294, 262, 0, 247, 0, 220, 247, 262, 247, 220, 0, 196, 0] },
};
let musicTimer = null, musicStep = 0, musicData = null;
function startMusic(lvl) {
  ensureAudio();
  if (!audioCtx) return;
  stopMusic();
  musicData = MUSIC[lvl] || MUSIC[1];
  musicStep = 0;
  musicTimer = setInterval(musicTick, musicData.tempo);
}
function musicTick() {
  if (!musicData || !musicGain) return;
  const dur = (musicData.tempo / 1000) * 0.9;
  const f = musicData.notes[musicStep % musicData.notes.length];
  if (f) tone(f, dur, musicData.wave, 0.5, musicGain);
  if (f && musicStep % 4 === 0) tone(f / 2, dur * 1.7, "triangle", 0.4, musicGain); // bajo
  musicStep++;
}
function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

// ---- Mute / botones de audio ----
function toggleSfx() {
  ensureAudio();
  sfxMuted = !sfxMuted;
  if (sfxGain) sfxGain.gain.value = sfxMuted ? 0 : 0.5;
  if (engineGain) engineGain.gain.value = sfxMuted ? 0 : ENGINE_VOL;
  saveProgress();
  updateAudioButtons();
}
function toggleMusic() {
  ensureAudio();
  musicMuted = !musicMuted;
  if (musicGain) musicGain.gain.value = musicMuted ? 0 : 0.22;
  saveProgress();
  updateAudioButtons();
}
function updateAudioButtons() {
  if (elSfxBtn) { elSfxBtn.textContent = sfxMuted ? "🔇" : "🔊"; elSfxBtn.classList.toggle("muted", sfxMuted); }
  if (elMusicBtn) { elMusicBtn.textContent = musicMuted ? "🔕" : "🎵"; elMusicBtn.classList.toggle("muted", musicMuted); }
}
const elSfxBtn = document.getElementById("sfx-btn");
const elMusicBtn = document.getElementById("music-btn");

// ---- Vibración en móvil ----
function vibrate(ms) { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } }

// ---- Partículas 3D (polvo, brillos, explosión) ----
const particles = [];
const PARTICLE_GEO = new THREE.BoxGeometry(0.12, 0.12, 0.12);
function spawnParticles(x, y, z, colorHex, count = 8, opts = {}) {
  const speed = opts.speed ?? 3;
  const life = opts.life ?? 0.6;
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    const m = new THREE.Mesh(PARTICLE_GEO, mat);
    m.position.set(x, y, z);
    m.scale.setScalar(0.5 + Math.random() * 0.9);
    scene.add(m);
    const a = Math.random() * Math.PI * 2;
    const up = (opts.up ?? 1.5) * (0.5 + Math.random());
    particles.push({
      mesh: m,
      vel: new THREE.Vector3(
        Math.cos(a) * speed * (0.4 + Math.random()),
        up,
        Math.sin(a) * speed * (0.4 + Math.random())
      ),
      life, maxLife: life,
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.material.dispose();
      particles.splice(i, 1);
      continue;
    }
    p.vel.y -= 9.8 * dt; // gravedad
    p.mesh.position.x += p.vel.x * dt;
    p.mesh.position.y += p.vel.y * dt;
    p.mesh.position.z += p.vel.z * dt;
    p.mesh.scale.setScalar(Math.max(0.05, p.life / p.maxLife));
    p.mesh.rotation.x += dt * 6;
    p.mesh.rotation.y += dt * 6;
  }
}

// ----------------------------------------------------------------------------
//  BLOQUE 6 — VIDA AMBIENTAL DECORATIVA
//  Pájaros que cruzan el cielo y pequeños bichos en los márgenes del campo.
//  Son SOLO decoración: nunca se añaden a carriles ni a colisiones, así que no
//  afectan a la jugabilidad. Se recolocan cada frame cerca del jugador para que
//  siempre haya movimiento de fondo.
// ----------------------------------------------------------------------------
const ambient = []; // {mesh, kind, ...}
const AMBIENT_EDGE = COLS + 2; // los bichos viven más allá de la zona jugable

function clearAmbient() {
  for (const a of ambient) {
    scene.remove(a.mesh);
    a.mesh.traverse((o) => { if (o.isMesh) o.material.dispose(); });
  }
  ambient.length = 0;
}

// Pájaro voxel: cuerpo + dos alas que aletean.
function buildBird(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.15 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.18), mat);
  g.add(body);
  const wMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.3), wMat);
  wingL.position.set(0, 0.05, 0.22); g.add(wingL);
  const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.3), wMat);
  wingR.position.set(0, 0.05, -0.22); g.add(wingR);
  g.userData.wings = [wingL, wingR];
  return g;
}

// Bicho de margen: cuerpo pequeño que da saltitos.
function buildCritter(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, emissive: color, emissiveIntensity: 0.1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.3), mat);
  body.position.y = 0.16; body.castShadow = true; g.add(body);
  const ear = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.06), mat);
  ear.position.set(0.08, 0.36, 0.07); g.add(ear);
  const ear2 = ear.clone(); ear2.position.z = -0.07; g.add(ear2);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), eyeMat);
  eye.position.set(0.16, 0.2, 0.08); g.add(eye);
  return g;
}

const BIRD_COLORS = [0xffffff, 0xffe600, 0x00f0ff, 0xff8ad0, 0xb0e0ff];
const CRITTER_COLORS = [0xb98a5a, 0x9ad16a, 0xd0d0d8, 0xe0a060, 0xc8b0ff];

// DESACTIVADO a petición del jugador: la vida ambiental (pájaros del cielo y
// animalitos de los márgenes) resultaba molesta, así que ya no se genera nada.
// Se mantiene clearAmbient() por seguridad (limpia cualquier resto previo) y
// updateAmbient sale solo al estar el array vacío. Para reactivarla, restaurar
// el cuerpo original de esta función (el código de generación queda más abajo
// comentado en buildBird/buildCritter, que siguen disponibles).
function setupAmbientLife(n) {
  clearAmbient();
  // (sin pájaros ni bichos de fondo)
}

function updateAmbient(dt, now) {
  if (!ambient.length) return;
  const pz = player.position.z;
  const xLimit = FIELD_WIDTH / 2 + 3;
  for (const a of ambient) {
    if (a.kind === "bird") {
      a.mesh.position.x += a.vx * dt;
      a.mesh.position.y = a.baseY + Math.sin(now * 3 + a.phase) * 0.3;
      a.mesh.position.z = pz + a.zOff; // se mantiene cerca del jugador
      // Aleteo.
      if (a.mesh.userData.wings) {
        const flap = Math.sin(now * 14 + a.phase) * 0.5;
        a.mesh.userData.wings[0].rotation.x = flap;
        a.mesh.userData.wings[1].rotation.x = -flap;
      }
      // Recircular cuando sale por un lado.
      if (a.mesh.position.x > xLimit) { a.mesh.position.x = -xLimit; a.zOff = -6 - Math.random() * 16; }
      else if (a.mesh.position.x < -xLimit) { a.mesh.position.x = xLimit; a.zOff = -6 - Math.random() * 16; }
    } else {
      // Bicho: saltitos suaves y leve deriva lateral en su margen.
      a.hopT += dt * a.hopSpeed;
      a.mesh.position.y = Math.abs(Math.sin(a.hopT)) * 0.2;
      a.mesh.position.x += a.drift * dt;
      a.mesh.position.z = pz + a.zOff;
      // Mantenerlo en su margen lateral.
      const minX = AMBIENT_EDGE, maxX = AMBIENT_EDGE + 4;
      const side = Math.sign(a.x) || 1;
      const ax = Math.abs(a.mesh.position.x);
      if (ax < minX || ax > maxX) a.drift *= -1;
      a.mesh.position.x = side * Math.min(maxX, Math.max(minX, ax));
    }
  }
}

// ============================================================================
//  BLOQUE 9 — HUMOR: CRUCES RANDOM DE FONDO + BAILECITO DE MONEDA
//  Dos detalles puramente cosméticos que NO afectan a la jugabilidad:
//   1) Cruces decorativos: de vez en cuando un personaje gracioso atraviesa la
//      pantalla de lado a lado. Nunca se añaden a carriles ni a colisiones, así
//      que el pollo jamás puede chocar con ellos.
//   2) Bailecito al recoger moneda: una celebración exagerada de ~0,5 s que es
//      solo visual y se cancela en cuanto el jugador salta (no bloquea control).
// ============================================================================

// ---- 9.1 Cruces random de fondo (decorativos) -----------------------------
const crossers = [];        // cruces activos: {mesh, vx, baseY, zOff, type, anim, ...}
const crosserDebris = [];   // estela de pizzas del repartidor: {mesh, vy, life, ...}
let nextCrosserAt = 0;      // momento (s) del próximo cruce; 0 = sin programar
let duckGlanceReturn = false; // ¿hay que devolver al pollo a su orientación tras mirar al pato?

// Programa el siguiente cruce con baja frecuencia y de forma aleatoria.
function scheduleNextCrosser(now) { nextCrosserAt = now + 8 + Math.random() * 12; }

// Efectos de sonido graciosos y opcionales de cada cruce (respetan el mute).
function sfxGrandma() { if (sfxMuted) return; ensureAudio(); tone(880, 0.07, "square", 0.22); tone(660, 0.09, "square", 0.18, null, 0.09); }
function sfxDuck()    { if (sfxMuted) return; ensureAudio(); tone(300, 0.12, "sawtooth", 0.2); tone(240, 0.14, "sawtooth", 0.16, null, 0.1); }
function sfxCarpet()  { if (sfxMuted) return; ensureAudio(); tone(659, 0.1, "sine", 0.18); tone(988, 0.12, "sine", 0.16, null, 0.06); tone(1319, 0.14, "sine", 0.14, null, 0.12); }
function sfxPizza()   { if (sfxMuted) return; ensureAudio(); tone(120, 0.28, "sawtooth", 0.2); tone(110, 0.3, "sawtooth", 0.16, null, 0.05); }

// --- Builders voxel/low-poly (coherentes con el resto del juego) ---
// Todos miran hacia +x (dirección de avance por defecto); para entrar por la
// derecha se les gira 180º en spawnCrosser.

function buildScooterGrandma() { // Abuela en patinete a toda velocidad.
  const g = new THREE.Group();
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xff2b4d, roughness: 0.5, metalness: 0.3 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.24), deckMat); deck.position.set(0, 0.18, 0); deck.castShadow = true; g.add(deck);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), deckMat); stem.position.set(0.42, 0.48, 0); g.add(stem);
  const barMat = new THREE.MeshStandardMaterial({ color: 0x222229, metalness: 0.6, roughness: 0.4 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.34), barMat); bar.position.set(0.42, 0.78, 0); g.add(bar);
  // Ruedas: cilindro con el eje girado a Z para que ruede en X.
  const wheelGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12); wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x15151b, roughness: 0.6 });
  const wheels = [];
  for (const wx of [-0.4, 0.4]) { const wh = new THREE.Mesh(wheelGeo, wheelMat); wh.position.set(wx, 0.16, 0); g.add(wh); wheels.push(wh); }
  // Abuela.
  const dressMat = new THREE.MeshStandardMaterial({ color: 0x7c4dff, roughness: 0.7 });
  const dress = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.3), dressMat); dress.position.set(0.05, 0.55, 0); dress.castShadow = true; g.add(dress);
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd9b3, roughness: 0.6 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.24), skinMat); head.position.set(0.07, 0.86, 0); g.add(head);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xddddE6, roughness: 0.8 })); bun.position.set(0, 0.98, 0); g.add(bun);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const dz of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), eyeMat); e.position.set(0.2, 0.88, dz); g.add(e); }
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), dressMat); arm.position.set(0.27, 0.7, 0); arm.rotation.z = -0.5; g.add(arm);
  const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.1), new THREE.MeshStandardMaterial({ color: 0xff2bd6, roughness: 0.6 }));
  scarf.position.set(-0.18, 0.74, 0); scarf.rotation.z = 0.3; g.add(scarf); // bufanda al viento
  g.userData.wheels = wheels;
  return g;
}

function buildCalmDuck() { // Pato que cruza tranquilamente ignorando el peligro.
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), bodyMat); body.position.y = 0.32; body.castShadow = true; g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.22), bodyMat); tail.position.set(-0.3, 0.4, 0); tail.rotation.z = 0.5; g.add(tail);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), bodyMat); head.position.set(0.28, 0.56, 0); g.add(head);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.14), new THREE.MeshStandardMaterial({ color: 0xff9a00, roughness: 0.5 }));
  beak.position.set(0.45, 0.52, 0); g.add(beak);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const dz of [-0.08, 0.08]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), eyeMat); e.position.set(0.36, 0.6, dz); g.add(e); }
  const footMat = new THREE.MeshStandardMaterial({ color: 0xff9a00, roughness: 0.6 });
  for (const fx of [-0.1, 0.14]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.16), footMat); f.position.set(fx, 0.16, 0); g.add(f); }
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.18), new THREE.MeshStandardMaterial({ color: 0xe6e6df, roughness: 0.7 }));
  wing.position.set(0, 0.4, 0.16); g.add(wing);
  g.userData.head = head;
  return g;
}

function buildFlyingCarpet() { // Alfombra voladora con pasajero que saluda.
  const g = new THREE.Group();
  const colA = CIRCUS_PALETTE[(Math.random() * CIRCUS_PALETTE.length) | 0];
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: 0x8a1f5a, roughness: 0.7, emissive: 0x2a0a22, emissiveIntensity: 0.2 }));
  carpet.castShadow = true; g.add(carpet);
  for (let i = -1; i <= 1; i++) { const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.42), new THREE.MeshStandardMaterial({ color: colA, emissive: colA, emissiveIntensity: 0.3, roughness: 0.5 })); stripe.position.set(i * 0.32, 0.01, 0); g.add(stripe); }
  const fringe = new THREE.MeshStandardMaterial({ color: 0xffe600, roughness: 0.6 });
  for (const ex of [-0.56, 0.56]) for (const fz of [-0.18, 0, 0.18]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.08), fringe); f.position.set(ex, 0, fz); g.add(f); }
  // Pasajero sentado.
  const robe = new THREE.MeshStandardMaterial({ color: 0x1f9bd9, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.26), robe); torso.position.set(0, 0.24, 0); g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshStandardMaterial({ color: 0xffd9b3, roughness: 0.6 })); head.position.set(0, 0.52, 0); g.add(head);
  const turban = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })); turban.position.set(0, 0.66, 0); g.add(turban);
  // Brazo que saluda (pivote en el hombro).
  const arm = new THREE.Group();
  const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.06), robe); armMesh.position.set(0, 0.13, 0); arm.add(armMesh);
  arm.position.set(0.14, 0.42, 0); arm.rotation.z = -1.0; g.add(arm);
  g.userData.arm = arm;
  return g;
}

function buildPizzaScooter() { // Repartidor de pizza que va tardísimo.
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff3b3b, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.26), bodyMat); body.position.set(0, 0.3, 0); body.castShadow = true; g.add(body);
  const front = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.2), bodyMat); front.position.set(0.34, 0.42, 0); g.add(front);
  const barMat = new THREE.MeshStandardMaterial({ color: 0x222229, metalness: 0.6, roughness: 0.4 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), barMat); bar.position.set(0.42, 0.6, 0); g.add(bar);
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xfff0a0, emissiveIntensity: 1.0 })); light.position.set(0.45, 0.42, 0); g.add(light);
  const wheelGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.1, 12); wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x15151b, roughness: 0.6 });
  const wheels = [];
  for (const wx of [-0.34, 0.34]) { const wh = new THREE.Mesh(wheelGeo, wheelMat); wh.position.set(wx, 0.17, 0); g.add(wh); wheels.push(wh); }
  // Repartidor.
  const uni = new THREE.MeshStandardMaterial({ color: 0x2b6cff, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.26), uni); torso.position.set(-0.05, 0.6, 0); g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshStandardMaterial({ color: 0xffd9b3, roughness: 0.6 })); head.position.set(-0.05, 0.88, 0); g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.26), new THREE.MeshStandardMaterial({ color: 0xff3b3b, roughness: 0.6 })); cap.position.set(-0.05, 1.0, 0); g.add(cap);
  // Pila de cajas de pizza que se tambalea.
  const pizzaBox = new THREE.Group();
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.3), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf0e0c0 : 0xe9b44a, roughness: 0.7 })); b.position.y = i * 0.08; pizzaBox.add(b); }
  pizzaBox.position.set(-0.05, 0.84, 0); g.add(pizzaBox);
  g.userData.wheels = wheels; g.userData.pizzaBox = pizzaBox;
  return g;
}

// --- Animaciones por tipo (se llaman cada frame con (crosser, dt, now)) ---
function animScooter(c, dt, now) {
  const w = c.mesh.userData.wheels; if (w) for (const wh of w) wh.rotation.z -= Math.sign(c.vx) * dt * 14;
  c.mesh.position.y = c.baseY + Math.abs(Math.sin(now * 16 + c.phase)) * 0.04; // traqueteo
}
function animDuck(c, dt, now) {
  c.mesh.position.y = c.baseY + Math.abs(Math.sin(now * 8 + c.phase)) * 0.06;  // contoneo
  const h = c.mesh.userData.head; if (h) h.rotation.x = Math.sin(now * 5 + c.phase) * 0.15;
}
function animCarpet(c, dt, now) {
  c.mesh.position.y = c.baseY + Math.sin(now * 2 + c.phase) * 0.25;            // flota
  c.mesh.rotation.z = Math.sin(now * 3 + c.phase) * 0.08;                      // ondula
  const arm = c.mesh.userData.arm; if (arm) arm.rotation.z = -1.0 + Math.sin(now * 10 + c.phase) * 0.5; // saluda
}
function animPizza(c, dt, now) {
  const w = c.mesh.userData.wheels; if (w) for (const wh of w) wh.rotation.z -= Math.sign(c.vx) * dt * 16;
  c.mesh.position.y = c.baseY + Math.abs(Math.sin(now * 20 + c.phase)) * 0.05;
  const box = c.mesh.userData.pizzaBox; if (box) box.rotation.z = Math.sin(now * 18 + c.phase) * 0.08;
}

// Suelta una pizza detrás del repartidor (estela decorativa).
function emitPizzaCrumb(c) {
  const geo = new THREE.CylinderGeometry(0.14, 0.14, 0.05, 10);
  const mat = new THREE.MeshStandardMaterial({ color: 0xe9b44a, emissive: 0x6a3a00, emissiveIntensity: 0.2, roughness: 0.7, transparent: true, opacity: 1 });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(c.mesh.position.x - Math.sign(c.vx) * 0.5, c.baseY + 0.5, c.mesh.position.z + (Math.random() - 0.5) * 0.2);
  m.rotation.x = Math.random() * Math.PI; m.rotation.z = Math.random() * Math.PI;
  scene.add(m);
  crosserDebris.push({ mesh: m, vy: 0.6 + Math.random(), life: 1.2, maxLife: 1.2, spin: (Math.random() - 0.5) * 6 });
}

// Crea un cruce aleatorio y lo añade a la escena.
function spawnCrosser() {
  const type = ["grandma", "duck", "carpet", "pizza"][(Math.random() * 4) | 0];
  const dir = Math.random() < 0.5 ? 1 : -1;        // 1 = hacia la derecha
  const limit = FIELD_WIDTH / 2 + 3.5;
  let mesh, speed, y, zOff, anim, emitPizza = false;
  if (type === "grandma")      { mesh = buildScooterGrandma(); speed = 8 + Math.random() * 3;   y = 0;   zOff = -2 - Math.random() * 5; anim = animScooter; sfxGrandma(); }
  else if (type === "duck")    { mesh = buildCalmDuck();       speed = 2 + Math.random() * 1.2; y = 0;   zOff = -1 - Math.random() * 3; anim = animDuck;    sfxDuck(); }
  else if (type === "carpet")  { mesh = buildFlyingCarpet();   speed = 3.5 + Math.random() * 1.8; y = 1.7 + Math.random() * 0.6; zOff = -3 - Math.random() * 5; anim = animCarpet; sfxCarpet(); }
  else                         { mesh = buildPizzaScooter();   speed = 6.5 + Math.random() * 2; y = 0;   zOff = -2 - Math.random() * 5; anim = animPizza;   emitPizza = true; sfxPizza(); }
  mesh.rotation.y = dir > 0 ? 0 : Math.PI;
  mesh.position.set(-dir * limit, y, player.position.z + zOff);
  scene.add(mesh);
  crossers.push({ mesh, vx: dir * speed, baseY: y, zOff, type, anim, emitPizza, pizzaT: 0.18, phase: Math.random() * 6 });
}

// El pollo mira al pato con cara de envidia si pasa cerca (solo visual).
function tryDuckGlance(duckMesh) {
  if (gameState !== "playing" || playerState.moving || !playerState.alive) return false;
  const dx = duckMesh.position.x - player.position.x;
  const dz = duckMesh.position.z - player.position.z;
  if (Math.hypot(dx, dz) > 3.6) return false;
  const yaw = Math.atan2(-dx, -dz);              // orientación hacia el pato
  player.rotation.y = lerpAngle(player.rotation.y, yaw, 0.18);
  duckGlanceReturn = true;
  return true;
}

// Limpia todos los cruces y su estela (cambio de nivel / volver al menú).
function clearCrossers() {
  for (const c of crossers) { scene.remove(c.mesh); c.mesh.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
  crossers.length = 0;
  for (const d of crosserDebris) { scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); }
  crosserDebris.length = 0;
  nextCrosserAt = 0;
}

// Programa, mueve, anima y recicla los cruces y su estela. Se llama cada frame.
function updateCrossers(dt, now) {
  // Lanzar un cruce de vez en cuando (solo durante el juego y sin saturar).
  if (gameState === "playing") {
    if (nextCrosserAt === 0) scheduleNextCrosser(now);
    if (now >= nextCrosserAt && crossers.length < 2) { spawnCrosser(); scheduleNextCrosser(now); }
  }
  const limit = FIELD_WIDTH / 2 + 3.5;
  let duckGlanced = false;
  for (let i = crossers.length - 1; i >= 0; i--) {
    const c = crossers[i];
    c.mesh.position.x += c.vx * dt;
    // La Z se fija al aparecer (en spawnCrosser) y ya NO se reengancha al jugador
    // cada frame: así el personaje cruza el fondo con naturalidad y no "salta"
    // hacia delante cada vez que el pollo avanza una fila.
    c.anim(c, dt, now);
    if (c.emitPizza) { c.pizzaT -= dt; if (c.pizzaT <= 0) { c.pizzaT = 0.18; emitPizzaCrumb(c); } }
    if (c.type === "duck" && tryDuckGlance(c.mesh)) duckGlanced = true;
    // Fuera de pantalla → eliminar (no se recircula; aparecen aleatoriamente).
    if (Math.abs(c.mesh.position.x) > limit) {
      scene.remove(c.mesh);
      c.mesh.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      crossers.splice(i, 1);
    }
  }
  // Si ya no hay pato cerca, devolver suavemente al pollo a su orientación.
  if (!duckGlanced && duckGlanceReturn && gameState === "playing" && !playerState.moving && playerState.alive) {
    player.rotation.y = lerpAngle(player.rotation.y, playerState.facing, 0.12);
    let d2 = player.rotation.y - playerState.facing;
    d2 = Math.atan2(Math.sin(d2), Math.cos(d2));
    if (Math.abs(d2) < 0.03) { player.rotation.y = playerState.facing; duckGlanceReturn = false; }
  }
  // Animar y reciclar las pizzas de la estela.
  for (let i = crosserDebris.length - 1; i >= 0; i--) {
    const d = crosserDebris[i];
    d.life -= dt;
    if (d.life <= 0) { scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); crosserDebris.splice(i, 1); continue; }
    d.vy -= 9 * dt;
    d.mesh.position.y += d.vy * dt;
    if (d.mesh.position.y < 0.05) { d.mesh.position.y = 0.05; d.vy = 0; }
    d.mesh.rotation.y += d.spin * dt;
    d.mesh.material.opacity = Math.min(1, (d.life / d.maxLife) * 1.5);
  }
}

// ---- 9.2 Bailecito al recoger moneda --------------------------------------
// Celebración exagerada de ~0,5 s, SOLO visual. No bloquea el control: si el
// jugador salta (playerState.moving) o muere, se cancela de inmediato.
const coinDance = { active: false, t: 0 };
const COIN_DANCE_DUR = 0.55;
function startCoinDance() { coinDance.active = true; coinDance.t = 0; heroPose.active = false; }
function endCoinDance() {
  coinDance.active = false;
  player.scale.set(1, 1, 1);
  // Solo restauramos pose si el pollo está quieto; si se mueve, de eso ya se
  // encarga updatePlayerMovement (no debemos pisar su animación de salto).
  if (!playerState.moving) { player.position.y = 0; player.rotation.y = playerState.facing; }
}
function updateCoinDance(dt) {
  if (!coinDance.active) return;
  if (playerState.moving || !playerState.alive || gameState !== "playing") { endCoinDance(); return; }
  coinDance.t += dt;
  const p = coinDance.t / COIN_DANCE_DUR;
  if (p >= 1) { endCoinDance(); return; }
  const ease = 1 - Math.pow(1 - p, 3);                  // easeOutCubic
  player.rotation.y = playerState.facing + ease * Math.PI * 2; // giro completo
  player.position.y = Math.sin(p * Math.PI) * 0.35;           // saltito
  const wob = Math.sin(p * Math.PI * 4) * 0.12;              // meneo (squash/stretch)
  player.scale.set(1 - wob, 1 + wob, 1 - wob);
}

// ============================================================================
//  BLOQUE 10 — REACCIONES GRACIOSAS DEL POLLITO + EASTER EGGS
//  TODO es estético: no mata, no bloquea el control ni cambia las reglas.
//   10.1 Pose de superhéroe al recoger power-up (+ musiquita épica).
//   10.2 Modo "chulito" cuando lleva una buena racha de carriles.
//   10.3 Eclosión del huevo al reaparecer tras morir (cara de resignación).
//   10.4 Menú: tocarle mucho al pollito -> se enfada y mira a cámara.
//   10.5 Código konami -> sombreros de fiesta a todos los vehículos (cosmético).
//   10.6 Evento sorpresa: gorro de cumpleaños a todos (fecha concreta o raro).
//  Las animaciones de pose/chulito se aplican DESPUÉS de updatePowerups en el
//  bucle, igual que el bailecito, para que updatePowerupVisuals no las pise.
// ============================================================================
function lerpN(a, b, t) { return a + (b - a) * t; }

// ---- 10.1/10.2 Poses con alas y actitud --------------------------------------
const HERO_POSE_DUR = 0.6;
const heroPose = { active: false, t: 0 };
const COCKY_STREAK = 8;            // carriles seguidos para ponerse "chulito"
let cocky = false;
let cockyPhase = 0;
// Objetivos de rotación de cada ala (pivote en el hombro). Reposo = pegada.
const WING_REST_L = { x: 0, z: 0.12 },  WING_REST_R = { x: 0, z: -0.12 };
const WING_AKIMBO_L = { x: 0.7, z: -0.8 }, WING_AKIMBO_R = { x: 0.7, z: 0.8 }; // "en jarra"
const WING_BACK_L = { x: -1.0, z: 0.25 },  WING_BACK_R = { x: -1.0, z: -0.25 }; // hacia atrás
function lerpWing(pivot, tgt, t) {
  pivot.rotation.x = lerpN(pivot.rotation.x, tgt.x, t);
  pivot.rotation.z = lerpN(pivot.rotation.z, tgt.z, t);
}

// Musiquita épica de ~0,5 s (respeta el mute de SFX como el resto de efectos).
function sfxHeroFanfare() {
  if (sfxMuted) return; ensureAudio();
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.13, "sawtooth", 0.3, null, i * 0.08));
  tone(1568, 0.3, "triangle", 0.24, null, 0.34); // remate brillante
}
// Llamado al recoger un power-up. No bloquea: se cancela si el pollo salta/muere.
function startHeroPose() {
  heroPose.active = true; heroPose.t = 0;
  coinDance.active = false;   // que no se peleen por el cuerpo
  sfxHeroFanfare();
}

// Actualiza pose de héroe + modo chulito + alas. SOLO toca cuerpo si está quieto
// (si se mueve, manda updatePlayerMovement) y nunca si la danza de moneda manda.
function updateChickAttitude(dt, now) {
  const wL = player.userData.wingL, wR = player.userData.wingR;
  if (gameState !== "playing") {
    if (wL && wR) { lerpWing(wL, WING_REST_L, 0.2); lerpWing(wR, WING_REST_R, 0.2); }
    return;
  }
  // Avanzar/cancelar la pose de héroe.
  if (heroPose.active) {
    if (playerState.moving || !playerState.alive) heroPose.active = false;
    else { heroPose.t += dt; if (heroPose.t >= HERO_POSE_DUR) heroPose.active = false; }
  }
  if (coinDance.active) return; // la danza de moneda gestiona cuerpo/alas

  // Decidir el modo actual.
  let mode = "neutral";
  if (heroPose.active) mode = "hero";
  else if (playerState.alive && runStreak >= COCKY_STREAK) mode = "cocky";
  cocky = (mode === "cocky");

  // Alas (siempre: son hijos independientes, nada más las toca).
  if (wL && wR) {
    if (mode === "hero") { lerpWing(wL, WING_AKIMBO_L, 0.3); lerpWing(wR, WING_AKIMBO_R, 0.3); }
    else if (mode === "cocky") { lerpWing(wL, WING_BACK_L, 0.2); lerpWing(wR, WING_BACK_R, 0.2); }
    else { lerpWing(wL, WING_REST_L, 0.2); lerpWing(wR, WING_REST_R, 0.2); }
  }

  // Cuerpo: solo en reposo (si se mueve, no pisamos el salto).
  if (playerState.moving) return;
  if (mode === "hero") {
    const p = heroPose.t / HERO_POSE_DUR;
    const e = Math.sin(p * Math.PI);
    player.rotation.x = -0.22 * e;                       // pecho hacia fuera
    player.rotation.z = lerpN(player.rotation.z, 0, 0.3);
    player.position.y = 0.14 * e;                        // saltito triunfal
  } else if (mode === "cocky") {
    cockyPhase += dt * 5;
    player.rotation.z = Math.sin(cockyPhase) * 0.07;     // contoneo sobrado
    player.rotation.x = -0.08;                           // barbilla alta
    player.position.y = Math.abs(Math.sin(cockyPhase)) * 0.05;
  } else {
    player.rotation.z = lerpN(player.rotation.z, 0, 0.25);
    player.rotation.x = lerpN(player.rotation.x, 0, 0.25);
    player.position.y = lerpN(player.position.y, 0, 0.4);
  }
}

// ---- 10.4 Easter egg de menú: tocar mucho al pollito -> se enfada ------------
let menuAngry = 0;                 // segundos de enfado restantes
let menuClicks = 0, menuClickLast = 0;
const MENU_ANGER_THRESHOLD = 6;
function sfxAngry() {
  if (sfxMuted) return; ensureAudio();
  tone(220, 0.16, "sawtooth", 0.26); tone(170, 0.22, "square", 0.22, null, 0.1); // gruñido de fastidio
}
function bumpMenuAnger() {
  const t = performance.now();
  if (t - menuClickLast > 700) menuClicks = 0; // si tardas, se reinicia la racha
  menuClickLast = t;
  menuClicks++;
  // Respingo de alas en cada toque (feedback inmediato).
  if (player.userData.wingL) { player.userData.wingL.rotation.x = 0.5; player.userData.wingR.rotation.x = 0.5; }
  if (menuClicks >= MENU_ANGER_THRESHOLD) {
    menuClicks = 0;
    menuAngry = 2.2;
    if (elStart) elStart.classList.add("peek");          // revelar la escena un momento
    if (player.userData.angryFace) player.userData.angryFace.visible = true;
    sfxAngry();
  }
}
function updateMenuChick(dt, now) {
  if (gameState !== "start") return;
  if (menuAngry > 0) {
    menuAngry -= dt;
    player.rotation.y = lerpN(player.rotation.y, Math.PI / 4, 0.18); // mirar a cámara
    player.rotation.z = Math.sin(now * 40) * 0.05;                   // temblar de rabia
    player.scale.setScalar(lerpN(player.scale.x, 1.7, 0.15));        // acercarse furioso
    player.position.y = lerpN(player.position.y, 0.2, 0.15);
    if (menuAngry <= 0) {
      menuAngry = 0;
      if (elStart) elStart.classList.remove("peek");
      if (player.userData.angryFace) player.userData.angryFace.visible = false;
      player.rotation.z = 0; player.scale.setScalar(1); player.position.y = 0;
    }
  } else {
    // Idle del menú: balanceo lento y alas en reposo.
    player.rotation.y = lerpN(player.rotation.y, 0.5, 0.05);
    player.rotation.z = lerpN(player.rotation.z, 0, 0.1);
    player.scale.setScalar(lerpN(player.scale.x, 1, 0.1));
    player.position.y = Math.sin(now * 1.5) * 0.05;
    if (player.userData.wingL) { lerpWing(player.userData.wingL, WING_REST_L, 0.15); lerpWing(player.userData.wingR, WING_REST_R, 0.15); }
  }
}
if (elStart) {
  elStart.addEventListener("click", (e) => {
    if (gameState !== "start") return;
    if (e.target.closest("button")) return; // los botones del menú hacen su función
    bumpMenuAnger();
  });
}

// ---- 10.5/10.6 Sombreros de fiesta (konami) y de cumpleaños (sorpresa) -------
let festiveHats = false;           // ¿hay sombreros activos esta partida?
let festiveBirthday = false;       // true = gorro de cumple; false = cono de fiesta
function buildFestiveHat(birthday) {
  const g = new THREE.Group();
  const hue = birthday ? 0xff3ea5 : [0x00f0ff, 0xffe600, 0xff3ea5, 0x35d07f, 0xff7a1e][Math.floor(Math.random() * 5)];
  const coneMat = new THREE.MeshStandardMaterial({ color: hue, roughness: 0.5, emissive: hue, emissiveIntensity: 0.25 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 12), coneMat);
  cone.position.y = 0.25; g.add(cone);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 }));
  pom.position.y = 0.52; g.add(pom);
  if (birthday) { // velita de cumpleaños
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff3c4 }));
    candle.position.y = 0.6; g.add(candle);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: 0xffb030, emissive: 0xff7a00, emissiveIntensity: 0.8 }));
    flame.position.y = 0.72; g.add(flame);
  }
  return g;
}
// Coloca un sombrero sobre la cima de cualquier mesh (sin tocar colisiones).
function addFestiveHatTo(mesh) {
  if (!mesh || mesh.userData.festiveHat) return;
  mesh.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(mesh);
  if (!isFinite(box.max.y)) return;
  const topWorld = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
  const local = mesh.worldToLocal(topWorld.clone());
  const hat = buildFestiveHat(festiveBirthday);
  hat.position.copy(local);
  mesh.add(hat);
  mesh.userData.festiveHat = hat;
}
// Cada frame, pone sombrero a los vehículos que aún no lo tengan (incluye nuevos).
function updateFestiveHats() {
  if (!festiveHats) return;
  for (const car of activeVehicles) { if (car && car.mesh) addFestiveHatTo(car.mesh); }
}
function activatePartyHats(birthday) {
  festiveHats = true; festiveBirthday = birthday;
  // Retrofit inmediato de los vehículos ya en pantalla.
  for (const car of activeVehicles) { if (car && car.mesh) { car.mesh.userData.festiveHat = null; addFestiveHatTo(car.mesh); } }
  bigToast(birthday ? "🎂" : "🎉", birthday ? "¡FELIZ CUMPLE!" : "¡CÓDIGO SECRETO!", birthday ? "Todos con gorro" : "Fiesta de sombreros");
}
// Quita la fiesta: borra los sombreros actuales y la desactiva para próximas partidas.
function deactivatePartyHats() {
  if (!festiveHats && !konamiArmed) return; // nada que quitar
  festiveHats = false; festiveBirthday = false; konamiArmed = false;
  for (const car of activeVehicles) {
    if (car && car.mesh && car.mesh.userData.festiveHat) {
      const hat = car.mesh.userData.festiveHat;
      car.mesh.remove(hat);
      hat.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      car.mesh.userData.festiveHat = null;
    }
  }
  bigToast("🚫", "FIESTA CANCELADA", "Adiós a los sombreros");
}
// ¿Hoy es el día del evento sorpresa? Fecha concreta o MUY raro (~0,5%).
function isBirthdaySurprise() {
  const d = new Date();
  if (d.getMonth() === 8 && d.getDate() === 2) return true; // getMonth: 0=enero, 8=septiembre
  return Math.random() < 0.005;
}
// Códigos secretos: escribir "lol" activa la fiesta; "67" la quita.
const CODE_ON = ["l", "o", "l"];
const CODE_OFF = ["6", "7"];
const CODE_EPIC = "calcetin sucio".split("");   // código secreto: desbloquea el Pollo Divino
let onIdx = 0, offIdx = 0, epicIdx = 0;
let konamiArmed = false;            // una vez activado, los sombreros vuelven en cada partida
window.addEventListener("keydown", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  // Activar fiesta con "lol".
  if (k === CODE_ON[onIdx]) {
    onIdx++;
    if (onIdx >= CODE_ON.length) {
      onIdx = 0;
      konamiArmed = true;           // queda activado para esta y las siguientes partidas
      activatePartyHats(false);     // aplica ya (si estás jugando) + aviso en pantalla
    }
  } else {
    onIdx = (k === CODE_ON[0]) ? 1 : 0; // permite reempezar la secuencia
  }
  // Quitar fiesta con "67".
  if (k === CODE_OFF[offIdx]) {
    offIdx++;
    if (offIdx >= CODE_OFF.length) { offIdx = 0; deactivatePartyHats(); }
  } else {
    offIdx = (k === CODE_OFF[0]) ? 1 : 0;
  }
  // Desbloquear y equipar la skin legendaria al momento con "calcetin sucio".
  if (k === CODE_EPIC[epicIdx]) {
    epicIdx++;
    if (epicIdx >= CODE_EPIC.length) { epicIdx = 0; unlockLegendaryNow(); }
  } else {
    epicIdx = (k === CODE_EPIC[0]) ? 1 : 0;
  }
});

// Atajo de prueba: desbloquea y equipa la skin legendaria + estela + mascota +
// guardaespaldas sin tener que vencer al jefe. (Se puede borrar cuando quieras.)
function unlockLegendaryNow() {
  ownedSkins.add("cosmico"); ownedTrails.add("cosmica"); ownedPets.add("cosmica");
  equippedSkin = "cosmico"; equippedTrail = "cosmica"; equippedPet = "cosmica";
  applySkin(level); applyPet(); legendaryFxT = 0;
  saveProgress();
  if (typeof sfxLegendary === "function") sfxLegendary();
  if (typeof bigToast === "function") bigToast("✦", "¡SKIN ÉPICA!", "Pollo Divino equipado");
}

// Arranca un nivel concreto (1 ó 2), limpiando y regenerando el mundo.
function startLevel(n) {
  level = n;

  // Limpiar el mundo anterior.
  for (const [r, data] of rows) removeRow(r, data);
  rows.clear();
  cheerers.length = 0;          // el público de la meta se regenera con la nueva meta
  activeVehicles.length = 0;
  // Nivel 5: limpiar cualquier zombi que quedara suelto en la escena.
  for (const z of zombies) {
    scene.remove(z.mesh);
    z.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  zombies.length = 0;
  clearLavaMonsters();     // Nivel 7: limpiar monstruos de lava del nivel anterior
  clearTrailParticles();   // Bloque 5: limpiar rastros del nivel anterior
  clearCrossers();         // Bloque 9: limpiar cruces decorativos del nivel anterior
  clearBossFight();        // Bloque 11: limpiar la pelea de jefe si veníamos de ella
  coinDance.active = false; duckGlanceReturn = false; // Bloque 9: resetear estados de humor
  // Bloque 10: resetear poses, enfado de menú y caras especiales.
  heroPose.active = false; cocky = false; cockyPhase = 0;
  menuAngry = 0; menuClicks = 0;
  if (elStart) elStart.classList.remove("peek");
  if (player.userData.angryFace) player.userData.angryFace.visible = false;
  if (player.userData.wingL) { lerpWing(player.userData.wingL, WING_REST_L, 1); lerpWing(player.userData.wingR, WING_REST_R, 1); }

  // Reset del jugador.
  playerState.col = 0;
  playerState.row = 0;
  playerState.maxRow = 0;
  playerState.moving = false;
  playerState.onLog = null;
  playerState.alive = true;
  playerState.facing = 0;
  player.position.set(0, 0, 0);
  player.rotation.set(0, 0, 0);
  player.scale.setScalar(1);   // por si venía de la animación de asado (lava)
  player.visible = true;        // por si venía de ser engullido por una planta
  // Quitar el bloque de hielo si venía de morir congelado en el río (nivel 2).
  if (player.userData.iceEncasement) {
    player.remove(player.userData.iceEncasement);
    player.userData.iceEncasement.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    player.userData.iceEncasement = null;
  }
  setPanic(false);        // quitar la cara de pánico de la muerte anterior
  removeDeathGhost();     // limpiar el fantasmita del Game Over anterior
  forced.boundary = -5;
  escapeCar = null; escapeUsed = false; // atajo del circo: estado limpio por nivel

  // Reset de mecánicas del Bloque 6 (puntos de "casi" y vida ambiental).
  runBonus = 0;
  nearMissCombo = 0;
  nearMissComboUntil = 0;
  nearMissSlowUntil = 0;
  setupAmbientLife(n);
  applyPet();                 // Bloque 7: recolocar la mascota junto al pollo

  applySkin(n);
  setSkyForLevel(n);
  setScore(0);
  elLevel.textContent = "Nivel " + n;
  levelNoStop = true;                       // logro "sin frenos"
  lastMoveAt = performance.now() / 1000;

  // Reset de mecánicas del nivel 4 (arenas movedizas + tormentas de arena).
  quicksandSink = 0;
  if (scene.fog) { scene.fog.near = FOG_NEAR; scene.fog.far = FOG_FAR; }
  if (elSandstorm) elSandstorm.style.opacity = "0";
  if (n === 4) scheduleNextStorm(performance.now() / 1000);
  else { stormDur = 0; nextStormAt = 0; }

  resetPowerups();
  ensureRows();
  spawnCoinsForLevel();
  startMusic(n);   // música de fondo del nivel
  startEngine();   // zumbido de motores de coches

  // Colocar cámara directamente sobre el inicio.
  camLookRow = 0;
  camera.position.set(CAM_OFFSET.x, CAM_OFFSET.y, CAM_OFFSET.z);

  gameState = "playing";
  elStart.classList.add("hidden");
  elGameOver.classList.add("hidden");
  elMessage.classList.add("hidden");
  elHud.classList.remove("hidden");
  if (isTouchDevice()) elTouch.classList.remove("hidden");

  // Aviso de disfraz de zombi (skin Zombi + mascota Zombi) en el nivel 5:
  // los zombis te toman por uno de los suyos y no te persiguen.
  if (n === 5 && equippedSkin === "zombie" && equippedPet === "zombi" && elToast) {
    elToast.style.setProperty("--toast-color", "#7faa55");
    elToast.textContent = "🧟  ¡DISFRAZ ZOMBI! Los zombis te ignoran";
    elToast.classList.remove("show");
    void elToast.offsetWidth; // reiniciar la animación CSS
    elToast.classList.add("show");
  }
}

// Inicia siempre desde el nivel 1.
function startGame() {
  ensureAudio();      // desbloquea el AudioContext con el gesto del usuario
  prevBest = best;    // récord previo, para el mensaje de "¡Casi!" al morir
  runLanes = 0;       // contadores acumulados de la partida (para logros)
  runFlying = 0;
  runPowerups = 0;
  runNearMiss = 0;    // "casi" acumulados de la partida
  runStreak = 0;      // Bloque 7: racha de carriles sin parar
  stats.games++;      // Bloque 7: partidas jugadas
  saveProgress();
  refreshWeeklyMissions();          // por si cambió la semana entre partidas
  addWeeklyProgress("games", 1);    // misión semanal "games"
  // Bloque 10: cada partida empieza sin sombreros... salvo que el konami esté activado.
  festiveHats = false; festiveBirthday = false;
  startLevel(1);
  if (konamiArmed) {
    // Konami activado: los sombreros de fiesta vuelven en cada partida.
    activatePartyHats(false);
  } else if (isBirthdaySurprise()) {
    // Bloque 10.6: evento sorpresa de cumpleaños (fecha concreta o muy raro).
    activatePartyHats(true);
  }
}

function showGameOver() {
  const score = playerState.maxRow + runBonus;
  recordLevelBest(level, score);   // Bloque 7: mejor puntuación de este nivel
  elFinal.textContent = score;
  elBestScore.textContent = best;

  // Mensaje absurdo según la causa de la muerte (+ guiño al récord).
  if (elGameOverMsg) {
    const pool = DEATH_MESSAGES[lastDeathCause] || DEATH_MESSAGES.default;
    let msg = pool[(Math.random() * pool.length) | 0];
    const diff = prevBest - score;
    if (score > prevBest && prevBest > 0) {
      msg = "🏆 ¡NUEVO RÉCORD! " + msg;
    } else if (diff > 0 && diff <= 3) {
      msg = msg + "  (¡a " + diff + " del récord!)";
    }
    elGameOverMsg.textContent = msg;
  }

  // Dejar un fantasmita del pollo que sube flotando y se despide con el ala.
  spawnDeathGhost(deathX, deathZ);

  elGameOver.classList.remove("hidden");
  elTouch.classList.add("hidden");
}

// Pantalla genérica de mensaje (nivel completado / victoria).
function showMessage(title, subtitle, btnLabel, onClick) {
  elMsgTitle.textContent = title;
  elMsgSub.textContent = subtitle;
  elMsgBtn.textContent = btnLabel;
  elMsgBtn.onclick = onClick;
  elMessage.classList.remove("hidden");
  elTouch.classList.add("hidden");
}

// ============================================================================
//  BLOQUE 11 — JEFE FINAL: ZOMBI GIGANTE VAGO
//  Pelea final al terminar el nivel 7 (Lava). Mecánica sencilla por turnos:
//  el jefe lanzará objetos telegrafiados y el pollito los recogerá/devolverá
//  con L/Q (partes 2-3). Cada acierto le quita un trozo de su barra de vida.
//  El pollito tiene 3 vidas SOLO en esta pelea. Todo el estado vive en `boss`
//  y se limpia con clearBossFight(), sin tocar el resto del juego.
//  --- PARTE 1: aparición + barra de vida + 3 vidas + aviso/cambio de música.
//  --- PARTE 2: el jefe lanza objetos telegrafiados (váter, sofá, gallina...).
//  --- PARTE 3: recoger el objeto (L/Q) y devolverlo con la misma tecla.
//  --- PARTE 4: sistema de daño (3 vidas, parpadeo de invulnerabilidad, fin).
//  --- PARTE 5: humor (caras de dolor, frases, despistes, pánico, deshincharse).
//  --- PARTE 6: victoria + skin LEGENDARIA exclusiva ("Pollo Cósmico").
// ============================================================================

// --- Constantes de la pelea ---
const BOSS_MAX_HP = 8;          // trozos de la barra de vida del jefe (más = más difícil)
const BOSS_START_LIVES = 3;     // vidas del pollito durante la pelea
const BOSS_ARENA_HALF = 4;      // semiancho jugable de la arena (columnas -4..4)
const BOSS_ARENA_FRONT = 8;     // fila más adelantada a la que puede ir el pollito
const BOSS_ROW = 7;             // fila donde se planta el jefe
const BOSS_SCALE = 3.2;         // tamaño gigante del zombi jefe
const BOSS_INTRO_DUR = 2.6;     // segundos del aviso "¡ALGO SE ACERCA!"

// Parte 2: lanzamiento de objetos.
const BOSS_THROW_TYPES = ["toilet", "sofa", "chicken", "tv"]; // trastos que lanza
const BOSS_THROW_INTERVAL = 2.3;   // segundos entre lanzamientos (lanza más a menudo)
const BOSS_TELEGRAPH_DUR = 0.95;   // aviso (marca en el suelo) antes de salir volando (menos margen)
const BOSS_ARC_DUR = 0.85;         // duración del vuelo en arco
const BOSS_LAND_LINGER = 1.6;      // tiempo que el objeto queda en el suelo tras caer

// Parte 3: recoger y devolver.
const BOSS_PICKUP_RANGE = 1;       // distancia (en casillas) a la que se puede recoger
const BOSS_RETURN_DUR = 0.7;       // duración del vuelo del objeto devuelto

// Parte 4: daño e invulnerabilidad.
const BOSS_INVULN_DUR = 1.2;       // segundos de invulnerabilidad/parpadeo tras un golpe

// --- Estado global de la pelea (modular, fácil de limpiar) ---
const boss = {
  active: false,    // ¿estamos en la pelea?
  phase: "idle",    // "idle" | "intro" | "fight" | "dead"
  mesh: null,       // grupo 3D del zombi gigante
  arena: null,      // grupo 3D del suelo de la arena
  columnSet: null,  // Set "col,row" de columnas de cobertura (bloquean y protegen)
  hp: BOSS_MAX_HP,
  lives: BOSS_START_LIVES,
  introUntil: 0,    // momento (s) en que termina el aviso
  t: 0,             // reloj interno para animaciones
  projectiles: [],  // Parte 2: objetos lanzados activos
  nextThrowAt: 0,   // Parte 2: momento del próximo lanzamiento
  windup: 0,        // Parte 2: gesto de brazos al preparar el lanzamiento (0..1)
  held: null,       // Parte 3: objeto que el pollito lleva en brazos (o null)
  invulnUntil: 0,   // Parte 4: momento (s) hasta el que el pollito es invulnerable
  // Parte 5: toques de humor.
  speechUntil: 0,   // momento (s) hasta el que se ve el bocadillo de diálogo
  painUntil: 0,     // momento (s) hasta el que se ve la cara de dolor
  recoil: 0,        // sacudida hacia atrás al recibir un golpe (1→0)
  nextIdleAt: 0,    // momento del próximo despiste (bostezo/rascarse)
  idleUntil: 0,     // momento (s) hasta el que dura el gesto de despiste
  deathT: 0,        // reloj de la animación de muerte (deshincharse)
  deathDone: false, // ¿ya se ha resuelto la victoria? (evita repetirla)
};

// Elementos de UI de la pelea.
const elBossUI = document.getElementById("boss-ui");
const elBossHpFill = document.getElementById("boss-hp-fill");
const elBossLives = document.getElementById("boss-lives");
const elBossIntro = document.getElementById("boss-intro");
const elBossSpeech = document.getElementById("boss-speech"); // Parte 5: bocadillo de diálogo

// Parte 5: frases cómicas del jefe según el momento.
const BOSS_PHRASES_PAIN = [
  "¡eso es trampa!",
  "¡pero si soy un pollito chiquitín!",
  "¡última vez, eh!",
  "¡AYYY mi cerebro!",
  "¡me has despeinado!",
];
const BOSS_PHRASES_IDLE = [
  "*bosteza*",
  "qué pereza...",
  "¿ya es la hora de comer?",
  "zzz... ¿eh? ¿qué?",
  "me rasco un poco",
];
const BOSS_PHRASES_PANIC = [
  "¡¿de dónde sacas tanta fuerza?!",
  "¡basta, basta!",
  "¡esto no estaba en mi contrato!",
  "¡socorrooo!",
  "¡toma toma toma!",
];
function bossPickPhrase(arr) { return arr[(Math.random() * arr.length) | 0]; }

// Muestra el bocadillo del jefe durante `dur` segundos (se oculta en updateBoss).
function bossSay(text, dur = 2) {
  if (!elBossSpeech) return;
  elBossSpeech.textContent = text;
  elBossSpeech.classList.remove("hidden", "pop");
  void elBossSpeech.offsetWidth;   // reinicia la animación de "pop"
  elBossSpeech.classList.add("pop");
  boss.speechUntil = performance.now() / 1000 + dur;
}

// Música propia del jefe: tensa, grave y machacona.
MUSIC.boss = { tempo: 150, wave: "sawtooth", notes: [131, 0, 131, 156, 0, 175, 0, 131, 0, 156, 0, 175, 196, 0, 175, 0] };

// --- Construye el zombi gigante reutilizando el modelo del zombi del nivel 5 ---
function buildBossZombie() {
  const g = buildZombie();        // mismo arte voxel (cuerpo, cerebro, ojos, brazos)
  g.scale.setScalar(BOSS_SCALE);  // ...pero GIGANTE
  g.rotation.y = 0;               // su frente (+Z) ya mira hacia el pollito

  // Parte 5: cara de dolor exagerada, oculta salvo cuando recibe un golpe.
  const painFace = new THREE.Group();
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  // Bocaza abierta de "¡AAAY!".
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.05), black);
  mouth.position.set(0, 0.86, 0.21);
  painFace.add(mouth);
  // Cejas en V de sufrimiento (justo encima de los ojos amarillos).
  for (const dx of [-0.12, 0.12]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.05), black);
    brow.position.set(dx, 1.13, 0.21);
    brow.rotation.z = dx < 0 ? -0.6 : 0.6;
    painFace.add(brow);
  }
  // Lagrimones de cómic.
  const tearMat = new THREE.MeshBasicMaterial({ color: 0x6ec6ff });
  for (const dx of [-0.16, 0.16]) {
    const tear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.04), tearMat);
    tear.position.set(dx, 0.96, 0.21);
    painFace.add(tear);
  }
  painFace.visible = false;
  g.add(painFace);
  g.userData.painFace = painFace;
  return g;
}

// Casillas (col,row) donde se planta una COLUMNA de cobertura. Reparto simétrico
// que deja carriles libres pero ofrece sitios donde esconderse del jefe.
const BOSS_COLUMNS = [
  [-3, 2], [3, 2],
  [0, 4],
  [-2, 6], [2, 6],
];

// --- Columna de piedra con runas (cobertura): bloquea y te protege del jefe ---
function buildBossColumn() {
  const g = new THREE.Group();
  const stone  = new THREE.MeshStandardMaterial({ color: 0x6a6478, roughness: 1 });
  const stoneD = new THREE.MeshStandardMaterial({ color: 0x514c5e, roughness: 1 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.2, 0.82), stoneD);
  base.position.y = 0.1; base.castShadow = true; g.add(base);
  // Fuste: bloques apilados ligeramente irregulares.
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 0.6), i % 2 ? stone : stoneD);
    seg.position.set((Math.random() - 0.5) * 0.05, 0.4 + i * 0.42, 0);
    seg.castShadow = true; g.add(seg);
  }
  // Capitel superior.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.8), stoneD);
  cap.position.y = 0.4 + 4 * 0.42; g.add(cap);
  // Runas verdes brillantes (tema zombi) en el fuste.
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x8aff5a, emissive: 0x4bd000, emissiveIntensity: 0.8 });
  for (let i = 0; i < 3; i++) {
    const rune = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.64), glowMat);
    rune.position.set(0, 0.62 + i * 0.5, 0); g.add(rune);
  }
  return g;
}

// --- Suelo de la arena de la pelea (sustituye al mundo del nivel) ---
function buildBossArena() {
  const g = new THREE.Group();
  const matFloorA = new THREE.MeshStandardMaterial({ color: 0x2a2336, roughness: 1 });
  const matFloorB = new THREE.MeshStandardMaterial({ color: 0x342b44, roughness: 1 });
  for (let r = -1; r <= BOSS_ARENA_FRONT + 2; r++) {
    const mat = r % 2 === 0 ? matFloorA : matFloorB;
    const tile = new THREE.Mesh(new THREE.BoxGeometry(FIELD_WIDTH, 0.4, TILE), mat);
    const w = gridToWorld(0, r);
    tile.position.set(0, -0.2, w.z);
    tile.receiveShadow = true;
    g.add(tile);
  }

  // Columnas de cobertura dentro de la arena. Registramos sus casillas para
  // bloquear el movimiento del pollito y para que protejan de los trastazos.
  boss.columnSet = new Set();
  for (const [c, r] of BOSS_COLUMNS) {
    const col = buildBossColumn();
    const w = gridToWorld(c, r);
    col.position.set(w.x, 0, w.z);
    g.add(col);
    boss.columnSet.add(c + "," + r);
  }

  // Decoración: público de zombis y coches "aparcados" en los márgenes (fuera de
  // la zona jugable). Son puramente ambientales; no interactúan ni te golpean.
  const sideX = (BOSS_ARENA_HALF + 2) * TILE;
  const carColors = [0xff3b3b, 0x3aa0ff, 0xffd21a, 0x35d07f];
  for (let r = 0; r <= BOSS_ARENA_FRONT; r += 2) {
    const w = gridToWorld(0, r);
    for (const sx of [-sideX, sideX]) {
      if (Math.random() < 0.7) {
        const zk = buildZombie();
        zk.position.set(sx + (Math.random() - 0.5) * 1.2, 0, w.z);
        zk.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2; // mirando a la arena
        zk.userData.decoPhase = Math.random() * 6.28;
        g.add(zk);
      } else {
        const car = buildFuturisticCar(carColors[(Math.random() * carColors.length) | 0], false);
        car.position.set(sx + (Math.random() - 0.5) * 1.2, 0, w.z);
        car.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(car);
      }
    }
  }

  scene.add(g);
  return g;
}

// ----------------------------------------------------------------------------
//  PARTE 2 — Objetos que lanza el jefe (constructores voxel graciosos)
// ----------------------------------------------------------------------------
// Libera la geometría/material de un grupo (para no dejar fugas al limpiar).
function disposeBossObj(o) {
  o.traverse((c) => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) { Array.isArray(c.material) ? c.material.forEach((m) => m.dispose()) : c.material.dispose(); }
  });
}

// Váter / inodoro.
function buildThrowToilet() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.5 });
  const bowl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.5), white);
  bowl.position.y = 0.13; g.add(bowl);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.16), white);
  tank.position.set(0, 0.3, -0.22); g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.5), white);
  seat.position.y = 0.28; g.add(seat);
  const water = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.34), new THREE.MeshStandardMaterial({ color: 0x49b6ff, emissive: 0x1f6fae, emissiveIntensity: 0.3 }));
  water.position.y = 0.27; g.add(water);
  return g;
}

// Sofá.
function buildThrowSofa() {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0xb5462f, roughness: 0.9 });
  const clothD = new THREE.MeshStandardMaterial({ color: 0x923826, roughness: 0.9 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.4), cloth);
  base.position.y = 0.16; g.add(base);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.26, 0.12), clothD);
  back.position.set(0, 0.32, -0.14); g.add(back);
  for (const dx of [-0.36, 0.36]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, 0.4), clothD);
    arm.position.set(dx, 0.28, 0); g.add(arm);
  }
  for (const dx of [-0.18, 0.18]) {
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.34), cloth);
    cushion.position.set(dx, 0.3, 0.02); g.add(cushion);
  }
  return g;
}

// Gallina enfadada.
function buildThrowChicken() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.36, 0.34), bodyMat);
  body.position.y = 0.3; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.24), bodyMat);
  head.position.set(0, 0.56, 0.06); g.add(head);
  // Cresta y pico.
  const red = new THREE.MeshStandardMaterial({ color: 0xff3b3b });
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.18), red);
  comb.position.set(0, 0.72, 0.06); g.add(comb);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.1), new THREE.MeshStandardMaterial({ color: 0xffa61a }));
  beak.position.set(0, 0.55, 0.22); g.add(beak);
  // Cejas enfadadas (en V) + ojos.
  const black = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const dx of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), black);
    eye.position.set(dx, 0.58, 0.19); g.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), black);
    brow.position.set(dx, 0.64, 0.19);
    brow.rotation.z = dx < 0 ? -0.5 : 0.5; // V de enfado
    g.add(brow);
  }
  return g;
}

// Tele vieja.
function buildThrowTv() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.42), new THREE.MeshStandardMaterial({ color: 0x4a4f5a, roughness: 0.6 }));
  shell.position.y = 0.25; g.add(shell);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.04), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x3aa0ff, emissiveIntensity: 0.6 }));
  screen.position.set(0, 0.27, 0.22); g.add(screen);
  for (const dx of [-0.1, 0.1]) {
    const ant = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.28, 0.02), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    ant.position.set(dx, 0.56, -0.1);
    ant.rotation.z = dx < 0 ? 0.4 : -0.4; g.add(ant);
  }
  return g;
}

function buildThrowObject(type) {
  switch (type) {
    case "toilet":  return buildThrowToilet();
    case "sofa":    return buildThrowSofa();
    case "chicken": return buildThrowChicken();
    case "tv":      return buildThrowTv();
    default:        return buildThrowToilet();
  }
}

// Marca de aviso en la casilla de impacto (cuadro rojo que palpita en el suelo).
function buildTelegraph() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.5 });
  const ring = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.04, 0.92), mat);
  ring.position.y = 0.04;
  g.add(ring);
  // Crucecita central para que se lea bien la casilla objetivo.
  const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.1), mat);
  const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.5), mat);
  cross1.position.y = 0.05; cross2.position.y = 0.05;
  g.add(cross1); g.add(cross2);
  g.userData = { ring, mat };
  return g;
}

// ¿Está el jefe en modo pánico? (poca vida → lanza más y peor).
function bossInPanic() { return boss.phase === "fight" && boss.hp <= 2; }

// Cadencia de lanzamiento según la vida: tranquilo al principio, frenético al final.
function bossThrowInterval() {
  if (boss.hp <= 2) return 1.4;            // pánico: casi sin pausa
  if (boss.hp <= 4) return 2.2;            // se va acelerando
  return BOSS_THROW_INTERVAL;              // ritmo calmado inicial
}

// Elige la casilla objetivo: la del pollito (a veces una adyacente) para que esquive.
// En pánico tira casi a lo loco y suele FALLAR (parte del humor).
function bossPickTargetTile() {
  let col = playerState.col;
  let row = playerState.row;
  if (bossInPanic()) {
    // Desesperado: dispara a un sitio casi aleatorio de la arena.
    col = ((Math.random() * (BOSS_ARENA_HALF * 2 + 1)) | 0) - BOSS_ARENA_HALF;
    row = (Math.random() * (BOSS_ARENA_FRONT + 1)) | 0;
  } else {
    const r = Math.random();
    if (r < 0.35) col += (Math.random() < 0.5 ? -1 : 1);
    else if (r < 0.6) row += (Math.random() < 0.5 ? -1 : 1);
  }
  col = Math.max(-BOSS_ARENA_HALF, Math.min(BOSS_ARENA_HALF, col));
  row = Math.max(0, Math.min(BOSS_ARENA_FRONT, row));
  return { col, row };
}

// Sonidos sencillos del lanzamiento e impacto (reutilizan el sintetizador `tone`).
function sfxBossThrow() { if (sfxMuted) return; ensureAudio(); tone(420, 0.12, "sawtooth", 0.25); tone(300, 0.18, "sawtooth", 0.2, null, 0.06); }
function sfxBossThud()  { if (sfxMuted) return; ensureAudio(); tone(90, 0.22, "square", 0.3); tone(70, 0.26, "triangle", 0.22, null, 0.04); }

// Lanza un nuevo objeto telegrafiado.
function spawnBossThrow() {
  if (!boss.mesh) return;
  const type = BOSS_THROW_TYPES[(Math.random() * BOSS_THROW_TYPES.length) | 0];
  const { col, row } = bossPickTargetTile();
  const land = gridToWorld(col, row);

  // Marca de aviso en el suelo.
  const tele = buildTelegraph();
  tele.position.set(land.x, 0, land.z);
  scene.add(tele);

  // Objeto, empieza diminuto en las "manos" del jefe (efecto de preparar).
  const mesh = buildThrowObject(type);
  const bz = gridToWorld(0, BOSS_ROW).z;
  const startX = boss.mesh.position.x;
  mesh.position.set(startX, 2.3, bz + 0.9);
  mesh.scale.setScalar(0.05);
  scene.add(mesh);

  boss.projectiles.push({
    type, mesh, tele,
    state: "telegraph", t: 0,
    targetCol: col, targetRow: row,
    start: new THREE.Vector3(startX, 2.4, bz + 0.9),
    land: new THREE.Vector3(land.x, 0, land.z),
    spin: (Math.random() - 0.5) * 10,
  });

  boss.windup = 1; // el jefe levanta los brazos al preparar
}

// Avanza la física/estados de todos los objetos lanzados.
function updateBossThrows(dt, now) {
  // Programar el siguiente lanzamiento (ritmo tranquilo de momento).
  if (now >= boss.nextThrowAt) {
    spawnBossThrow();
    boss.nextThrowAt = now + bossThrowInterval();
    // En pánico suelta a veces una frase de desesperación al lanzar.
    if (bossInPanic() && Math.random() < 0.5) bossSay(bossPickPhrase(BOSS_PHRASES_PANIC), 1.4);
  }

  for (let i = boss.projectiles.length - 1; i >= 0; i--) {
    const p = boss.projectiles[i];
    if (!p) continue;   // por si el array cambió (p. ej. game over limpia la pelea)
    p.t += dt;

    if (p.state === "telegraph") {
      // La marca palpita y el objeto "crece" en las manos del jefe.
      const k = p.t / BOSS_TELEGRAPH_DUR;
      if (p.tele) {
        const s = 1 + Math.sin(p.t * 14) * 0.16;
        p.tele.userData.ring.scale.set(s, 1, s);
        p.tele.userData.mat.opacity = 0.4 + Math.abs(Math.sin(p.t * 14)) * 0.45;
      }
      p.mesh.scale.setScalar(Math.min(1, 0.2 + k * 1.1));
      p.mesh.rotation.y += dt * 3;
      if (p.t >= BOSS_TELEGRAPH_DUR) {
        p.state = "flying"; p.t = 0;
        p.mesh.scale.setScalar(1);
        sfxBossThrow();
      }

    } else if (p.state === "flying") {
      // Vuelo en arco hasta la casilla objetivo.
      const k = Math.min(1, p.t / BOSS_ARC_DUR);
      p.mesh.position.x = p.start.x + (p.land.x - p.start.x) * k;
      p.mesh.position.z = p.start.z + (p.land.z - p.start.z) * k;
      p.mesh.position.y = p.start.y * (1 - k) + Math.sin(k * Math.PI) * 3.0;
      p.mesh.rotation.x += dt * p.spin;
      p.mesh.rotation.z += dt * p.spin * 0.6;
      if (p.tele) p.tele.userData.mat.opacity = 0.45 + k * 0.5;
      if (k >= 1) {
        // Impacto: cae al suelo, partículas, quitar la marca.
        p.state = "landed"; p.t = 0;
        p.mesh.position.set(p.land.x, 0.3, p.land.z);
        p.mesh.rotation.set(0, p.mesh.rotation.y, 0);
        spawnParticles(p.land.x, 0.2, p.land.z, 0xd8d8d8, 12, { speed: 2.6, up: 2.2, life: 0.5 });
        if (p.tele) { scene.remove(p.tele); disposeBossObj(p.tele); p.tele = null; }
        sfxBossThud();
        vibrate(40);
        // Parte 4: si el pollito sigue en la casilla de impacto, recibe daño...
        // ...SALVO que haya una columna entre él y el jefe (cobertura): el
        // trastazo se estrella contra la columna y el pollito se salva.
        if (boss.lives > 0 && playerState.alive && !playerState.moving
            && p.targetCol === playerState.col && p.targetRow === playerState.row) {
          const shielded = boss.columnSet
            && boss.columnSet.has(playerState.col + "," + (playerState.row + 1));
          if (shielded) {
            const cw = gridToWorld(playerState.col, playerState.row + 1);
            spawnParticles(cw.x, 1.4, cw.z, 0x8aff5a, 16, { speed: 2.8, up: 2.2, life: 0.5 });
            if (Math.random() < 0.4) bossSay(bossPickPhrase(BOSS_PHRASES_PAIN), 1.2);
          } else {
            bossDamagePlayer(now);
            // El golpe pudo provocar el Game Over, que limpia la pelea: salir ya.
            if (!boss.active) return;
          }
        }
      }

    } else if (p.state === "landed") {
      // El objeto descansa en el suelo un momento; se puede recoger (Parte 3).
      p.mesh.position.y = 0.3 + Math.sin(p.t * 4) * 0.03;
      if (p.t >= BOSS_LAND_LINGER) {
        scene.remove(p.mesh); disposeBossObj(p.mesh);
        boss.projectiles.splice(i, 1);
      }

    } else if (p.state === "held") {
      // Parte 3: el pollito lo lleva sobre la cabeza hasta que lo devuelve.
      p.mesh.position.set(player.position.x, 0.95 + Math.sin(p.t * 6) * 0.04, player.position.z);
      p.mesh.rotation.y += dt * 1.5;

    } else if (p.state === "returning") {
      // Parte 3: vuelo del objeto devuelto (hacia el jefe o fallido).
      const k = Math.min(1, p.t / BOSS_RETURN_DUR);
      p.mesh.position.x = p.start.x + (p.land.x - p.start.x) * k;
      p.mesh.position.z = p.start.z + (p.land.z - p.start.z) * k;
      p.mesh.position.y = p.start.y * (1 - k) + p.land.y * k + Math.sin(k * Math.PI) * 2.2;
      p.mesh.rotation.x += dt * p.spin;
      p.mesh.rotation.z += dt * p.spin * 0.5;
      if (k >= 1) {
        if (p.willHit) bossTakeHit(p.mesh.position.x, 1.6, p.mesh.position.z);
        else spawnParticles(p.mesh.position.x, 0.3, p.mesh.position.z, 0x888888, 8, { speed: 2, up: 1.6, life: 0.4 });
        scene.remove(p.mesh); disposeBossObj(p.mesh);
        boss.projectiles.splice(i, 1);
      }
    }
  }

  // El gesto de brazos del lanzamiento baja suavemente.
  if (boss.windup > 0) boss.windup = Math.max(0, boss.windup - dt * 2);
}

// Limpia todos los objetos lanzados (al salir/reiniciar la pelea).
function clearBossProjectiles() {
  for (const p of boss.projectiles) {
    if (p.mesh) { scene.remove(p.mesh); disposeBossObj(p.mesh); }
    if (p.tele) { scene.remove(p.tele); disposeBossObj(p.tele); }
  }
  boss.projectiles.length = 0;
  boss.held = null;
}

// ----------------------------------------------------------------------------
//  PARTE 3 — Recoger el objeto (L/Q) y devolverlo con la misma tecla
// ----------------------------------------------------------------------------
// Sonidos de recoger y de devolver/acertar.
function sfxBossPickup() { if (sfxMuted) return; ensureAudio(); tone(660, 0.08, "square", 0.3); tone(990, 0.1, "square", 0.28, null, 0.05); }
function sfxBossReturn() { if (sfxMuted) return; ensureAudio(); tone(520, 0.09, "sawtooth", 0.3); tone(740, 0.12, "sawtooth", 0.26, null, 0.05); }
function sfxBossHit()    { if (sfxMuted) return; ensureAudio(); tone(180, 0.16, "square", 0.35); tone(120, 0.22, "triangle", 0.3, null, 0.05); }

// Tecla de acción de la pelea (L o Q): recoge si no llevas nada, o devuelve.
function bossActionKey() {
  if (!boss.active || boss.phase !== "fight") return;
  if (boss.held) bossThrowBack();
  else bossTryPickup();
}

// Intenta recoger un objeto caído que esté sobre o junto a la casilla del pollito.
function bossTryPickup() {
  if (boss.held || playerState.moving) return;
  let best = null, bestDist = 999;
  for (const p of boss.projectiles) {
    if (p.state !== "landed") continue;
    const dcol = Math.abs(p.targetCol - playerState.col);
    const drow = Math.abs(p.targetRow - playerState.row);
    if (dcol <= BOSS_PICKUP_RANGE && drow <= BOSS_PICKUP_RANGE) {
      const dist = dcol + drow;
      if (dist < bestDist) { bestDist = dist; best = p; }
    }
  }
  if (!best) return;
  // Cogido: pasa a estado "held"; lo llevaremos sobre la cabeza del pollito.
  best.state = "held";
  best.t = 0;
  boss.held = best;
  if (best.tele) { scene.remove(best.tele); disposeBossObj(best.tele); best.tele = null; }
  sfxBossPickup();
  spawnParticles(player.position.x, 0.6, player.position.z, 0xffe600, 8, { speed: 2, up: 2, life: 0.4 });
}

// Devuelve el objeto. Acierta SOLO si el pollito mira hacia el jefe (hacia delante).
function bossThrowBack() {
  const p = boss.held;
  if (!p) return;
  boss.held = null;

  // ¿Mira hacia el jefe? El jefe está delante (avanzar = facing 0).
  let f = playerState.facing % (Math.PI * 2);
  if (f > Math.PI) f -= Math.PI * 2;
  if (f < -Math.PI) f += Math.PI * 2;
  const facingBoss = Math.abs(f) < 0.3;

  p.state = "returning";
  p.t = 0;
  p.start = new THREE.Vector3(player.position.x, 0.8, player.position.z);
  if (facingBoss && boss.mesh) {
    // Vuela hacia el jefe: impactará y le quitará un trozo de vida.
    p.land = new THREE.Vector3(boss.mesh.position.x, 1.6, gridToWorld(0, BOSS_ROW).z + 0.4);
    p.willHit = true;
  } else {
    // Tiro fallido: sale despedido en la dirección a la que mira el pollito.
    const dx = Math.sin(playerState.facing), dz = -Math.cos(playerState.facing);
    p.land = new THREE.Vector3(player.position.x + dx * 4, 0, player.position.z + dz * 4);
    p.willHit = false;
  }
  p.spin = (Math.random() - 0.5) * 14;
  sfxBossReturn();
}

// Aplica un impacto del objeto devuelto sobre el jefe (le quita vida).
function bossTakeHit(x, y, z) {
  boss.hp = Math.max(0, boss.hp - 1);
  renderBossUI();
  sfxBossHit();
  vibrate(80);
  spawnParticles(x, y, z, 0xb6ff5a, 16, { speed: 3.4, up: 3, life: 0.7 });
  spawnParticles(x, y, z, 0xff3b3b, 10, { speed: 2.6, up: 2.4, life: 0.6 });

  // Parte 5: reacción cómica al recibir el golpe.
  const nowS = performance.now() / 1000;
  boss.recoil = 1;                 // se echa hacia atrás del impacto
  boss.painUntil = nowS + 0.7;     // pone cara de dolor un instante
  if (boss.mesh && boss.mesh.userData.painFace) boss.mesh.userData.painFace.visible = true;
  // Suelta una frase quejica (o de pánico si ya le queda poca vida).
  bossSay(bossPickPhrase(boss.hp <= 2 ? BOSS_PHRASES_PANIC : BOSS_PHRASES_PAIN), 1.8);

  // Parte 5/6: al quedarse sin vida, arranca la animación de derrota (deshincharse).
  if (boss.hp <= 0) { bossStartDeath(); return; }
  bigToast("💥", "¡TOMA!", "Le has dado al zombi");
}

// ----------------------------------------------------------------------------
//  PARTE 4 — Sistema de daño (3 vidas, invulnerabilidad/parpadeo, fin)
// ----------------------------------------------------------------------------
// El pollito recibe un golpe de un objeto que le ha caído encima.
function bossDamagePlayer(now) {
  if (boss.lives <= 0) return;
  if (now < boss.invulnUntil) return;     // invulnerable tras el golpe anterior
  if (!playerState.alive) return;

  boss.lives -= 1;
  renderBossUI();
  boss.invulnUntil = now + BOSS_INVULN_DUR;

  // Si llevaba un objeto en brazos, se le cae del susto.
  if (boss.held) {
    const idx = boss.projectiles.indexOf(boss.held);
    if (idx >= 0) { scene.remove(boss.held.mesh); disposeBossObj(boss.held.mesh); boss.projectiles.splice(idx, 1); }
    boss.held = null;
  }

  // Feedback de golpe: sonido, vibración y partículas con el color del pollito.
  sfxCrash();
  vibrate(150);
  const col = player.userData.bodyMaterial ? player.userData.bodyMaterial.color.getHex() : 0xffffff;
  spawnParticles(player.position.x, 0.5, player.position.z, col, 14, { speed: 3, up: 2.6, life: 0.6 });

  if (boss.lives <= 0) {
    bossPlayerDie();
  } else {
    bigToast("💔", "¡AY!", "Te quedan " + boss.lives + " vida" + (boss.lives === 1 ? "" : "s"));
  }
}

// El pollito se queda sin vidas en la pelea: Game Over.
function bossPlayerDie() {
  playerState.alive = false;
  deathX = player.position.x;
  deathZ = player.position.z;
  lastDeathCause = "default";
  player.visible = true;          // por si moría durante el parpadeo
  stopMusic();
  sfxCrash();
  vibrate(220);
  spawnParticles(player.position.x, 0.5, player.position.z,
    player.userData.bodyMaterial ? player.userData.bodyMaterial.color.getHex() : 0xffffff,
    22, { speed: 4, up: 3.5, life: 0.9 });
  clearBossFight();               // quitar jefe, arena, objetos y la UI de la pelea
  gameState = "gameover";
  showGameOver();
}

// --- Refresca la barra de vida del jefe y los corazones del pollito ---
function renderBossUI() {
  if (elBossHpFill) {
    const pct = Math.max(0, boss.hp / BOSS_MAX_HP) * 100;
    elBossHpFill.style.width = pct + "%";
    elBossHpFill.classList.toggle("low", boss.hp <= 2);
  }
  if (elBossLives) {
    let html = "";
    for (let i = 0; i < BOSS_START_LIVES; i++) {
      html += '<span class="' + (i < boss.lives ? "heart" : "heart-lost") + '">❤️</span>';
    }
    elBossLives.innerHTML = html;
  }
}

function showBossIntro() { if (elBossIntro) elBossIntro.classList.remove("hidden"); }
function hideBossIntro() { if (elBossIntro) elBossIntro.classList.add("hidden"); }

// ----------------------------------------------------------------------------
//  PARTE 5 — Humor: despistes de vago, pánico y muerte deshinchándose
// ----------------------------------------------------------------------------
// Despiste de vago entre ataques: bosteza/se rasca y suelta una frase perezosa.
function bossDoIdle() {
  const nowS = performance.now() / 1000;
  boss.idleUntil = nowS + 1.3;     // dura un gesto de estiramiento/bostezo
  bossSay(bossPickPhrase(BOSS_PHRASES_IDLE), 1.6);
}

// Sonido cómico al morir: el aire se escapa (silbido que baja) + trompetilla triste.
function sfxBossDeflate() {
  if (sfxMuted) return; ensureAudio();
  const seq = [880, 760, 640, 540, 450, 370, 300, 240, 190, 150];
  seq.forEach((f, i) => tone(f, 0.13, "sawtooth", 0.22, null, i * 0.11));
  [200, 150, 110].forEach((f, i) => tone(f, 0.32, "triangle", 0.32, null, 1.25 + i * 0.18));
}

// Arranca la animación de derrota: el jefe se deshincha como un globo.
function bossStartDeath() {
  boss.phase = "dead";
  boss.deathT = 0;
  boss.deathDone = false;
  boss.held = null;
  clearBossProjectiles();          // fuera trastos voladores
  stopMusic();
  sfxBossDeflate();
  vibrate(220);
  if (boss.mesh && boss.mesh.userData.painFace) boss.mesh.userData.painFace.visible = true;
  bossSay("¡me deshinchooo... adióóós!", 3);
  bigToast("🎉", "¡LO HAS VENCIDO!", "El zombi se desinfla del todo...");
}

// ----------------------------------------------------------------------------
//  PARTE 6 — Victoria + desbloqueo de la skin LEGENDARIA exclusiva
// ----------------------------------------------------------------------------
// Jingle triunfal y "mágico" para la recompensa legendaria.
function sfxLegendary() {
  if (sfxMuted) return; ensureAudio();
  // Fanfarria ascendente brillante + destello final agudo.
  [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.16, "square", 0.4, null, i * 0.1));
  [2093, 2637].forEach((f, i) => tone(f, 0.4, "triangle", 0.3, null, 0.7 + i * 0.12));
}

// Lluvia de confeti de colores cayendo sobre el pollo (celebración).
function spawnVictoryConfetti() {
  const cols = [0xff00cc, 0xffe600, 0x00f0ff, 0x6a2bff, 0x35d07f, 0xffffff];
  for (let i = 0; i < 80; i++) {
    const c = cols[(Math.random() * cols.length) | 0];
    spawnParticles(
      player.position.x + (Math.random() - 0.5) * 6,
      4 + Math.random() * 3,
      player.position.z + (Math.random() - 0.5) * 4,
      c, 1, { speed: 1.2, up: -1.5, life: 1.6 + Math.random() }
    );
  }
}

// Se ha vencido al jefe: recompensa LEGENDARIA + pantalla de victoria.
function onBossDefeated() {
  // ¿Era la primera vez? (para el texto y para no repetir el "estreno").
  const firstTime = !ownedSkins.has("cosmico") || !ownedPets.has("cosmica");

  // Limpiar la pelea (quita jefe, arena, objetos y UI), pero el pollo se queda
  // en el centro para celebrar con su nueva aura.
  clearBossFight();
  stopMusic();

  // --- Desbloquear y equipar la recompensa: skin + estela + MASCOTA legendarias. ---
  ownedSkins.add("cosmico");
  ownedTrails.add("cosmica");
  ownedPets.add("cosmica");
  equippedSkin = "cosmico";
  equippedTrail = "cosmica";
  equippedPet = "cosmica";
  applySkin(level);          // monta el aura animada en el pollo al instante
  applyPet();                // invoca a la mascota cósmica junto al pollo
  legendaryFxT = 0;          // arranca la animación del aura desde cero

  // Premio extra de monedas por la hazaña.
  addCoins(150);             // (addCoins ya persiste y refresca la UI)
  saveProgress();            // asegurar que skin/estela equipadas quedan guardadas

  // Festejo: confeti + jingle legendario + vibración + logro de campeón.
  spawnVictoryConfetti();
  sfxLegendary();
  vibrate([60, 40, 60, 40, 120]);
  unlockAchievement("win");  // por si se llegó al jefe sin pasar por completeLevel

  // Cámara mirando al pollo celebrando.
  camLookRow = 0;
  updateCamera();

  // Pantalla de victoria.
  gameState = "won";
  const sub = firstTime
    ? "Has desbloqueado ✦: skin ÉPICA «Pollo Divino» (¡aura, alas y halos!) con escolta de guardaespaldas, estela «Cósmica» y la mascota «Alien» 👽 · +150 monedas"
    : "¡Otra vez! +150 monedas · Skin, estela y mascota cósmicas ya son tuyas ✦";
  showMessage("✦ ¡JEFE DERROTADO! ✦", sub, "¡GENIAL!", goToMenu);
}

// --- Arranca la pelea de jefe (se llama al completar el nivel 7) ---
function startBossFight() {
  // Limpiar el mundo del nivel 7 (filas, vehículos, zombis), como en startLevel.
  for (const [r, data] of rows) removeRow(r, data);
  rows.clear();
  cheerers.length = 0;
  activeVehicles.length = 0;
  for (const z of zombies) { scene.remove(z.mesh); z.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  zombies.length = 0;
  clearLavaMonsters();     // Nivel 7: limpiar monstruos de lava antes de la pelea
  clearTrailParticles();
  clearCrossers();

  // Reset del pollito al centro de la arena, vivo y mirando al jefe.
  playerState.col = 0; playerState.row = 0; playerState.maxRow = 0;
  playerState.moving = false; playerState.onLog = null; playerState.alive = true;
  playerState.facing = 0;
  player.position.set(0, 0, 0);
  player.rotation.set(0, 0, 0);
  player.scale.setScalar(1);
  player.visible = true;
  setPanic(false);

  // Construir arena + jefe gigante.
  boss.arena = buildBossArena();
  boss.mesh = buildBossZombie();
  const bw = gridToWorld(0, BOSS_ROW);
  boss.mesh.position.set(bw.x, 0, bw.z);
  scene.add(boss.mesh);

  // Estado inicial de la pelea.
  boss.active = true;
  boss.phase = "intro";
  boss.hp = BOSS_MAX_HP;
  boss.lives = BOSS_START_LIVES;
  boss.t = 0;
  boss.introUntil = performance.now() / 1000 + BOSS_INTRO_DUR;
  // Parte 2: empezar a lanzar un poco después de que termine el aviso.
  clearBossProjectiles();
  boss.nextThrowAt = boss.introUntil + 1.2;
  boss.windup = 0;
  boss.invulnUntil = 0;
  // Parte 5: reset del humor (frases, dolor, sacudidas, despistes, muerte).
  boss.speechUntil = 0;
  boss.painUntil = 0;
  boss.recoil = 0;
  boss.idleUntil = 0;
  boss.nextIdleAt = boss.introUntil + 2.5;   // primer despiste un poco tras empezar
  boss.deathT = 0;
  boss.deathDone = false;
  if (elBossSpeech) elBossSpeech.classList.add("hidden");

  // Estado del juego + interfaz.
  gameState = "boss";
  if (elBossUI) elBossUI.classList.remove("hidden");
  // Botón de acción del jefe solo en móvil/iPad (para agarrar y lanzar trastos).
  if (elBossBtn && isTouchDevice()) elBossBtn.classList.remove("hidden");
  elHud.classList.add("hidden");          // ocultar HUD normal durante la pelea
  renderBossUI();
  showBossIntro();

  // Audio: parar motores y arrancar la música tensa del jefe.
  stopEngine();
  startMusic("boss");

  // Aviso sonoro/feedback dramático.
  if (typeof sfxCrash === "function") sfxCrash();
  vibrate(120);

  // Cámara: encuadrar la arena (entre el pollito y el jefe).
  camLookRow = 4;
  camera.position.set(CAM_OFFSET.x, CAM_OFFSET.y, gridToWorld(0, camLookRow).z + CAM_OFFSET.z);
}

// --- Limpia por completo la pelea (al salir al menú o reiniciar) ---
function clearBossFight() {
  boss.active = false;
  boss.phase = "idle";
  clearBossProjectiles();   // Parte 2: limpiar objetos lanzados
  if (boss.mesh) {
    scene.remove(boss.mesh);
    boss.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    boss.mesh = null;
  }
  if (boss.arena) {
    scene.remove(boss.arena);
    boss.arena.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    boss.arena = null;
  }
  boss.columnSet = null;   // soltar las casillas de columnas de cobertura
  if (elBossUI) elBossUI.classList.add("hidden");
  if (elBossBtn) elBossBtn.classList.add("hidden");        // ocultar el botón de acción del jefe
  if (elBossSpeech) elBossSpeech.classList.add("hidden");  // Parte 5: quitar bocadillo
  hideBossIntro();
}

// --- Bucle de la pelea (se llama desde animate cuando gameState==="boss") ---
function updateBoss(dt, now) {
  boss.t += dt;

  // Botón táctil: cambia entre "AGARRAR" y "LANZAR" según lleves trasto o no.
  if (elBossBtn && !elBossBtn.classList.contains("hidden")) {
    const lbl = elBossBtn.querySelector(".bab-label");
    if (lbl) lbl.textContent = boss.held ? "LANZAR" : "AGARRAR";
    elBossBtn.firstChild.textContent = boss.held ? "🎯" : "✊";
  }

  // Parte 5: ocultar el bocadillo de diálogo cuando se acaba su tiempo.
  if (boss.speechUntil && now >= boss.speechUntil) {
    if (elBossSpeech) elBossSpeech.classList.add("hidden");
    boss.speechUntil = 0;
  }

  // Parte 5: animación de DERROTA — el jefe se deshincha como un globo y se hunde.
  if (boss.phase === "dead") {
    boss.deathT += dt;
    const k = Math.min(1, boss.deathT / 2.6);
    if (boss.mesh) {
      // Tambaleo de globo perdiendo aire: encoge mientras hace "wobble".
      const wob = Math.sin(boss.deathT * 22) * (1 - k) * 0.28;
      const sx = BOSS_SCALE * (1 - k * 0.82) * (1 + wob);
      const sy = BOSS_SCALE * (1 - k * 0.9) * (1 - wob);
      boss.mesh.scale.set(Math.max(0.05, sx), Math.max(0.05, sy), Math.max(0.05, sx));
      boss.mesh.rotation.z = Math.sin(boss.deathT * 9) * 0.35 * (1 - k);
      boss.mesh.rotation.x = 0;
      const bw = gridToWorld(0, BOSS_ROW);
      boss.mesh.position.set(bw.x + Math.sin(boss.deathT * 14) * 0.15 * (1 - k), -k * 0.2, bw.z);
      // Chorritos de aire que se escapan.
      if (Math.floor(boss.deathT * 14) % 2 === 0) {
        spawnParticles(bw.x + (Math.random() - 0.5) * 2, 1.6 * (1 - k) + 0.3, bw.z + 0.4,
          0xb6ff5a, 4, { speed: 5, up: 1.2, life: 0.5 });
      }
    }
    updateParticles(dt);
    updateCamera();
    if (k >= 1 && !boss.deathDone) { boss.deathDone = true; onBossDefeated(); }
    return;
  }

  // Fase de aviso dramático: el jefe "despierta" temblando.
  if (boss.phase === "intro") {
    if (boss.mesh) boss.mesh.position.x = Math.sin(boss.t * 30) * 0.06; // temblor
    if (now >= boss.introUntil) {
      boss.phase = "fight";
      hideBossIntro();
      bigToast("🧟", "¡A LUCHAR!", "Recoge y devuelve con L o Q (mira al jefe)");
    }
  }

  // Parte 5: la sacudida del golpe (recoil) decae poco a poco.
  if (boss.recoil > 0) boss.recoil = Math.max(0, boss.recoil - dt * 2.5);
  const panic = bossInPanic();        // poca vida → más nervioso
  const yawning = now < boss.idleUntil; // despiste de vago (estira/bosteza)

  // Balanceo perezoso del jefe (vago y patoso): respira y se bambolea.
  if (boss.mesh) {
    const bw = gridToWorld(0, BOSS_ROW);
    // En pánico tiembla deprisa; si no, vaivén lento de vago.
    const jitter = panic ? Math.sin(boss.t * 40) * 0.07 : 0;
    if (boss.phase !== "intro") boss.mesh.position.x = Math.sin(boss.t * 0.7) * 0.1 + jitter;
    boss.mesh.position.z = bw.z + Math.sin(boss.t * 1.2) * 0.12;
    boss.mesh.position.y = Math.abs(Math.sin(boss.t * 1.6)) * 0.1;
    boss.mesh.rotation.z = Math.sin(boss.t * 0.8) * 0.05;
    boss.mesh.rotation.x = -boss.recoil * 0.4;   // se echa hacia atrás al recibir
    const arms = boss.mesh.userData.arms;
    if (arms && arms.length === 2) {
      // Balanceo normal + gesto de lanzamiento + estiramiento de bostezo.
      const swing = Math.sin(boss.t * 1.4) * 0.2;
      const lift = -boss.windup * 1.4 - (yawning ? 1.6 : 0);
      arms[0].rotation.x = swing + lift;
      arms[1].rotation.x = -swing + lift;
    }
    // Cara de dolor visible solo durante un instante tras el golpe.
    if (boss.mesh.userData.painFace) boss.mesh.userData.painFace.visible = boss.painUntil > now;
  }

  // Parte 5: despistes de vago entre ataques (solo si NO está en pánico).
  if (boss.phase === "fight" && !panic && now >= boss.nextIdleAt) {
    bossDoIdle();
    boss.nextIdleAt = now + 4 + Math.random() * 3;
  }

  // Parte 2: gestión de los objetos lanzados (solo en fase de combate).
  if (boss.phase === "fight") updateBossThrows(dt, now);

  // Parte 4: parpadeo de invulnerabilidad tras recibir un golpe.
  if (boss.invulnUntil > now) player.visible = Math.floor(now * 12) % 2 === 0;
  else if (playerState.alive) player.visible = true;

  // El pollito puede moverse por la arena (fase de combate).
  updatePlayerMovement(now);

  // Cámara fija encuadrando la arena + partículas.
  camLookRow = 4;
  updateCamera();
  updateParticles(dt);
}

// Se alcanzó la meta del nivel.
function completeLevel() {
  // Asentar al pollo en la casilla de meta (cancelar salto en curso).
  player.position.set(playerState.to.x, 0, playerState.to.z);
  playerState.moving = false;
  player.visible = true; // limpiar parpadeo de invencibilidad al terminar nivel

  stopEngine();
  stopMusic();
  sfxFanfare();   // jingle de nivel completado

  // Confeti de celebración cayendo sobre la meta.
  const confetti = [0xff3b3b, 0xffd21a, 0x35d07f, 0x3aa0ff, 0xff7ad9];
  for (let i = 0; i < confetti.length; i++) {
    spawnParticles(
      player.position.x + (Math.random() - 0.5) * 5, 3, player.position.z - 0.6,
      confetti[i], 12, { speed: 3.5, up: 4.5, life: 1.8 }
    );
  }

  recordLevelBest(level, playerState.maxRow + runBonus); // Bloque 7: mejor del nivel
  if (levelNoStop) unlockAchievement("nostop"); // completado sin pararse

  // Progresión: XP por completar nivel y avance de misión semanal "levels".
  addXp(XP_PER_LEVEL);
  addWeeklyProgress("levels", 1);

  if (level === 1) {
    gameState = "levelComplete";
    showMessage(
      "¡Primer nivel completado!",
      "Ahora cruza los ríos saltando por las plataformas.",
      "IR AL NIVEL 2",
      () => startLevel(2)
    );
  } else if (level === 2) {
    gameState = "levelComplete";
    showMessage(
      "¡Nivel 2 completado!",
      "¡TORMENTA! Salta entre nubes, esquiva drones y rayos.",
      "IR AL NIVEL 3",
      () => startLevel(3)
    );
  } else if (level === 3) {
    gameState = "levelComplete";
    showMessage(
      "¡Nivel 3 completado!",
      "¡EL DESIERTO! Arenas movedizas, tormentas y serpientes.",
      "IR AL NIVEL 4",
      () => startLevel(4)
    );
  } else if (level === 4) {
    gameState = "levelComplete";
    showMessage(
      "¡Nivel 4 completado!",
      "¡APOCALIPSIS ZOMBIE! Huye de los zombis, esquiva helicópteros y trenes... y cuidado con las plantas.",
      "IR AL NIVEL 5",
      () => startLevel(5)
    );
  } else if (level === 5) {
    gameState = "levelComplete";
    showMessage(
      "¡Nivel 5 completado!",
      "¡AL CIRCO! Coches de choque, carruseles y cañones.",
      "IR AL NIVEL 6",
      () => startLevel(6)
    );
  } else if (level === 6) {
    gameState = "levelComplete";
    showMessage(
      "¡Nivel 6 completado!",
      "¡LAVA! Salta de roca en roca.",
      "IR AL NIVEL 7",
      () => startLevel(7)
    );
  } else {
    // Bloque 11: el nivel 7 ya no termina la partida: ¡aparece el JEFE FINAL!
    unlockAchievement("win"); // completó todos los niveles normales
    startBossFight();
  }
}

// Volver a la pantalla principal desde el Game Over.
function goToMenu() {
  stopEngine();
  stopMusic();
  gameState = "start";
  setPanic(false);        // por si quedó la cara de pánico de la muerte
  removeDeathGhost();     // limpiar el fantasmita al volver al menú
  clearCrossers();        // Bloque 9: limpiar cruces decorativos
  clearBossFight();       // Bloque 11: limpiar la pelea de jefe si veníamos de ella
  coinDance.active = false; duckGlanceReturn = false; // Bloque 9: resetear estados de humor
  // Bloque 10: dejar el pollito del menú limpio (sin poses, caras ni sombreros).
  heroPose.active = false; cocky = false; cockyPhase = 0;
  menuAngry = 0; menuClicks = 0;
  festiveHats = false; festiveBirthday = false;
  player.position.set(0, 0, 0);
  player.rotation.set(0, 0, 0);
  player.scale.setScalar(1);
  player.visible = true;
  if (elStart) elStart.classList.remove("peek");
  if (player.userData.angryFace) player.userData.angryFace.visible = false;
  if (player.userData.wingL) { lerpWing(player.userData.wingL, WING_REST_L, 1); lerpWing(player.userData.wingR, WING_REST_R, 1); }
  if (elSandstorm) elSandstorm.style.opacity = "0";  // limpiar velo de tormenta
  if (scene.fog) { scene.fog.near = FOG_NEAR; scene.fog.far = FOG_FAR; }
  elGameOver.classList.add("hidden");
  elMessage.classList.add("hidden");   // ocultar el cartel de victoria/nivel (el botón GENIAL nos trae aquí)
  elHud.classList.add("hidden");
  elTouch.classList.add("hidden");
  elStart.classList.remove("hidden");
  updateCoinDisplays(); // refrescar el contador de monedas del menú
}

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("restart-btn").addEventListener("click", startGame);
document.getElementById("gameover-menu-btn").addEventListener("click", goToMenu);

// ---- Bucle principal ----
let lastTime = performance.now() / 1000;
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now() / 1000;
  let dt = now - lastTime;
  lastTime = now;
  if (dt > 0.1) dt = 0.1; // evitar saltos grandes tras pausas

  updateCheerers(dt, now); // el público de la meta anima siempre que exista
  updateGhost(dt, now);    // el fantasmita flota y se despide aunque sea Game Over
  updateCrossers(dt, now); // Bloque 9: cruces decorativos de fondo (solo jugando se generan)

  if (gameState === "playing") {
    updatePanic();              // cara de pánico si un coche está a punto de pillarte
    updatePlayerMovement(now);
    updateVehicles(dt);
    updateRiverLife(dt, now);    // Niveles 2 y 3: tiburón + peces decorativos
    updateLogRiding(dt);
    updateCoins(dt);
    updatePowerups(dt, now);
    updateLightning(now);
    updateQuicksand(dt);
    updateSandstorm(dt, now);
    updateTrains(dt, now);      // Nivel 5: trenes zombi (aviso + cruce)
    updateZombies(dt, now);     // Nivel 5: zombis perseguidores
    updateLavaMonsters(dt, now);// Nivel 7: monstruos de lava perseguidores
    updatePlants(dt, now);      // Nivel 5: plantas carnívoras ocultas
    checkCollisions();
    checkTrainCollision();      // Nivel 5: colisión con el tren
    updateNearMiss(now);        // Bloque 6: detección de "casi"
    updateForcedAdvance(dt);
    updateParticles(dt);
    updateAmbient(dt, now);     // Bloque 6: vida ambiental decorativa
    updatePet(dt, now);         // Bloque 7: mascota acompañante
    updateTrail(dt);            // Bloque 5: emisión de estela al saltar
    updateTrailParticles(dt);   // Bloque 5: animación del rastro
    updateCoinDance(dt);        // Bloque 9: bailecito al recoger moneda (no bloquea el control)
    updateChickAttitude(dt, now); // Bloque 10: pose de héroe / modo chulito (después de updatePowerups)
    updateFestiveHats();        // Bloque 10: sombreros de fiesta a vehículos nuevos
    if (level === 6) checkEscapeCar(); // atajo del circo: subirse al cochecito pasa el nivel
    updateCamera();
  } else if (gameState === "dying") {
    updateVehicles(dt);   // las plataformas siguen moviéndose de fondo
    updateRiverLife(dt, now);   // tiburón + peces siguen de fondo
    updateTrains(dt, now);      // el tren sigue cruzando de fondo
    updateZombies(dt, now);     // los zombis siguen vagando de fondo
    updateLavaMonsters(dt, now);// los monstruos de lava siguen de fondo
    updatePlants(dt, now);      // animar plantas en curso
    updateDying(dt);
    updateParticles(dt);
    updateAmbient(dt, now);     // el mundo sigue vivo de fondo
    updatePet(dt, now);         // la mascota sigue de fondo
    updateTrailParticles(dt);   // dejar que el rastro se desvanezca
    updateCamera();
  } else if (gameState === "launched") {
    updateVehicles(dt);         // el tráfico sigue de fondo
    updateRiverLife(dt, now);   // tiburón + peces siguen de fondo
    updateTrains(dt, now);
    updateZombies(dt, now);
    updateLaunched(dt);         // el pollo sale volando dando vueltas
    updateParticles(dt);
    updateAmbient(dt, now);
    updatePet(dt, now);
    updateTrailParticles(dt);
    updateCamera();
  } else if (gameState === "roasting") {
    updateVehicles(dt);         // las plataformas de lava siguen de fondo
    updateLavaMonsters(dt, now);// los monstruos de lava siguen de fondo
    updateRoasting(dt);         // salto + pollo asado
    updateParticles(dt);
    updateAmbient(dt, now);
    updatePet(dt, now);
    updateTrailParticles(dt);
    updateCamera();
  } else if (gameState === "freezing") {
    updateVehicles(dt);         // los troncos del río siguen de fondo
    updateRiverLife(dt, now);   // tiburón + peces siguen de fondo
    updateFreezing(dt);         // salto + pollo congelado
    updateParticles(dt);
    updateAmbient(dt, now);
    updatePet(dt, now);
    updateTrailParticles(dt);
    updateCamera();
  } else if (gameState === "eaten") {
    updateVehicles(dt);         // el mundo sigue de fondo
    updateTrains(dt, now);
    updateZombies(dt, now);     // los zombis siguen vagando de fondo
    updateEaten(dt);            // la planta engulle al pollo
    updateParticles(dt);
    updateAmbient(dt, now);
    updatePet(dt, now);
    updateTrailParticles(dt);
    updateCamera();
  } else if (gameState === "boss") {
    // Bloque 11: pelea de JEFE FINAL (aparición + animación del jefe).
    updateBoss(dt, now);
  } else if (gameState === "levelComplete" || gameState === "won") {
    // Mientras se muestra el mensaje de victoria: confeti cayendo y público
    // de la meta celebrando de fondo.
    updateParticles(dt);
    updateAmbient(dt, now);
    updateCamera();
  }

  updateMenuChick(dt, now); // Bloque 10: pollito del menú (solo actúa si gameState==="start")
  updateLegendaryFx(dt);    // Bloque 11 (Parte 6): aura animada de la skin legendaria
  // Fuera del juego activo, asegurar que el aviso del águila no se quede pegado.
  if (gameState !== "playing" && elEagleWarn) elEagleWarn.classList.remove("show");

  renderer.render(scene, camera);
}

// Cargar progreso (monedas, skin equipada, logros, récord) antes de empezar.
initProgression();

// Generar el mundo inicial para que la pantalla de inicio tenga fondo.
ensureRows();
updateCamera();
animate();

// ----------------------------------------------------------------------------
//  Resize responsivo.
// ----------------------------------------------------------------------------
window.addEventListener("resize", () => {
  const aspect = window.innerWidth / window.innerHeight;
  const d = 7;
  camera.left = -d * aspect;
  camera.right = d * aspect;
  camera.top = d;
  camera.bottom = -d;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
