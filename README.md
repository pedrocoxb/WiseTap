# 🧭 WiseTap v2 — Audioguía con IA + Detección de monumentos

## Qué hace esta versión
- 📡 Detecta tu GPS con precisión
- 🗿 Identifica monumentos, iglesias, museos, parques, plazas en un radio de 150-200m
- 🤖 Si estás a menos de 80m de un lugar, lo narra automáticamente
- 🏙️ Si no hay lugares cerca, narra la historia del barrio o ciudad
- 🔊 Audio real con Text-to-Speech en 5 idiomas
- 📱 Instalable como app en el celular (PWA)

---

## Instalación y despliegue en Vercel

### Paso 1 — Subir a GitHub
1. Crea un repositorio nuevo en **github.com** llamado `wisetap`
2. Sube todos los archivos de esta carpeta al repositorio

### Paso 2 — Desplegar en Vercel
1. Ve a **vercel.com** e inicia sesión con GitHub
2. Click en **"Add New Project"** → selecciona el repositorio `wisetap`
3. En **"Environment Variables"** agrega:
   - **Name:** `VITE_ANTHROPIC_API_KEY`
   - **Value:** tu API key de Anthropic (empieza con `sk-ant-...`)
4. Click **"Deploy"** → en 2 minutos tienes tu URL

### Paso 3 — Instalar en el celular
**Android (Chrome):** Menú ⋮ → "Agregar a pantalla de inicio"
**iPhone (Safari):** Botón compartir → "Agregar a pantalla de inicio"

---

## Cómo funciona la detección de lugares

1. Al tocar "Detectar mi ubicación", obtiene tu GPS
2. Consulta **OpenStreetMap Overpass API** buscando en 150m de radio:
   - Monumentos históricos
   - Museos y galerías
   - Iglesias, catedrales, mezquitas, sinagogas
   - Parques y jardines
   - Teatros y bibliotecas
   - Plazas y mercados
   - Castillos y palacios
3. Muestra la lista ordenada por distancia
4. Si estás a menos de 80m de alguno, lo narra automáticamente
5. Puedes tocar cualquier lugar de la lista para escuchar su historia
6. También puedes pedir la historia del barrio/ciudad completa

---

## Estructura del proyecto
```
wisetap-v2/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── manifest.json
└── src/
    ├── main.jsx
    ├── App.jsx      ← Lógica principal + UI
    └── poi.js       ← Detección de puntos de interés (Overpass API)
```

## Para modificar más adelante
- **Cambiar radio de búsqueda:** en `poi.js`, cambia los valores `around:150` y `around:200`
- **Agregar tipos de lugares:** en `poi.js`, agrega tags en `POI_TAGS`
- **Cambiar idiomas:** en `App.jsx`, agrega entradas al array `LANGS`
- **Cambiar diseño:** en `App.jsx`, modifica los valores de color `G`, `GL`, `T`
