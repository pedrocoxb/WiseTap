import { useState, useRef, useEffect } from 'react'
import { fetchNearbyPOI, poiName, poiIcon, poiType } from './poi.js'

// ─── Constants ────────────────────────────────────────────
const MODES = [
  { key:'history', icon:'🏛️', label:'Historia',     color:'#3b82f6' },
  { key:'culture', icon:'🎭', label:'Cultura',      color:'#8b5cf6' },
  { key:'legends', icon:'✨', label:'Leyendas',     color:'#f59e0b' },
  { key:'food',    icon:'🍽️', label:'Gastronomía',  color:'#10b981' },
]

const LANGS = [
  { value:'es', label:'🌍 Español',   tts:'es-ES' },
  { value:'en', label:'🌐 English',   tts:'en-US' },
  { value:'fr', label:'🗼 Français',  tts:'fr-FR' },
  { value:'it', label:'🏛️ Italiano',  tts:'it-IT' },
  { value:'pt', label:'🎶 Português', tts:'pt-BR' },
]

// Prompts diferenciados por modo — sin poesía, directos y específicos
const PROMPTS = {
  history: (place, extra) => `Eres un guía histórico experto. Habla con claridad, precisión y entusiasmo. Sin frases poéticas ni metáforas. Solo datos reales, fechas, personajes y hechos verificables.

Lugar: ${place}. ${extra}
Narra la historia de este lugar en 280-320 palabras:
- Cuándo fue fundado o construido y por quién
- Los eventos históricos más importantes que ocurrieron aquí
- Cómo ha cambiado a lo largo del tiempo
- Su importancia histórica hoy en día
Sin introducción poética. Empieza directo con los datos.`,

  culture: (place, extra) => `Eres un experto en cultura y antropología. Habla de forma clara y amena. Sin metáforas ni lenguaje poético. Información concreta sobre cómo vive la gente.

Lugar: ${place}. ${extra}
Describe la cultura de este lugar en 280-320 palabras:
- Costumbres y tradiciones locales más distintivas
- Fiestas, festivales o celebraciones importantes
- Cómo es la vida cotidiana de sus habitantes
- Arte, música o expresiones culturales propias
Empieza directamente con la información cultural, sin introducción.`,

  legends: (place, extra) => `Eres un experto en folclore y mitología local. Narra leyendas de forma entretenida y vívida, pero dejando claro que son relatos populares, no hechos históricos.

Lugar: ${place}. ${extra}
Cuenta las leyendas y mitos más famosos de este lugar en 280-320 palabras:
- La leyenda más conocida del lugar con todos sus detalles
- Otros relatos populares o supersticiones locales
- El origen de estas historias y qué representan culturalmente
- Si tienen alguna base histórica real
Empieza directamente contando la primera leyenda.`,

  food: (place, extra) => `Eres un crítico gastronómico y chef experto en cocina regional. Habla de forma concreta y apetitosa. Sin metáforas. Información práctica sobre qué comer y por qué.

Lugar: ${place}. ${extra}
Describe la gastronomía de este lugar en 280-320 palabras:
- Los 3-4 platos típicos más representativos con sus ingredientes principales
- Bebidas o postres típicos del lugar
- Dónde o cuándo se suelen comer estos platos (mercados, restaurantes, festividades)
- Una curiosidad o dato interesante sobre la cocina local
Empieza directamente con el primer plato típico.`,
}

const SYS_LANG = {
  es:'Responde completamente en español.',
  en:'Respond entirely in English.',
  fr:'Réponds entièrement en français.',
  it:'Rispondi interamente in italiano.',
  pt:'Responda inteiramente em português.',
}

// Design tokens
const C = {
  bg:      '#0a1628',
  card:    '#111e35',
  border:  'rgba(37,99,235,.2)',
  borderHi:'rgba(37,99,235,.5)',
  blue:    '#2563eb',
  blueL:   '#3b82f6',
  blueXL:  '#60a5fa',
  white:   '#f8fafc',
  white7:  'rgba(248,250,252,.75)',
  white4:  'rgba(248,250,252,.4)',
  white2:  'rgba(248,250,252,.12)',
  accent:  '#f59e0b',
  green:   '#10b981',
  red:     '#ef4444',
}

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || ''
const EL_KEY   = import.meta.env.VITE_ELEVENLABS_KEY || ''
// ElevenLabs Voice ID: Adam (deep, narrative male)
const EL_VOICE = 'pNInz6obpgDQGcFmaJgB'

// ─── API helpers ──────────────────────────────────────────
async function askGroq(prompt, key, lang) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role:'system', content: SYS_LANG[lang] || SYS_LANG.es },
        { role:'user',   content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  })
  if (!r.ok) throw new Error('Groq ' + r.status)
  const d = await r.json()
  return d.choices?.[0]?.message?.content || ''
}

async function askGroqFamous(city, lang, key) {
  const prompt = `Lista los 6 monumentos, museos, plazas o lugares más famosos e importantes de: ${city}.
Para cada uno devuelve SOLO este formato JSON, sin texto adicional:
[
  {"name": "Nombre del lugar", "type": "Tipo (Monumento/Museo/Plaza/Iglesia/etc)", "icon": "emoji apropiado", "description": "Una sola frase de descripción muy breve"},
  ...
]
Solo el JSON, nada más.`
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
    body: JSON.stringify({
      model:'llama-3.3-70b-versatile',
      messages:[
        { role:'system', content: SYS_LANG[lang] || SYS_LANG.es },
        { role:'user', content: prompt },
      ],
      max_tokens:600, temperature:0.3,
    }),
  })
  if (!r.ok) throw new Error('Groq ' + r.status)
  const d = await r.json()
  const text = d.choices?.[0]?.message?.content || '[]'
  try {
    const match = text.match(/\[[\s\S]*\]/)
    return match ? JSON.parse(match[0]) : []
  } catch { return [] }
}

async function elevenLabsTTS(text, key) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'xi-api-key':key },
    body: JSON.stringify({
      text,
      model_id:'eleven_multilingual_v2',
      voice_settings:{ stability:0.5, similarity_boost:0.75, style:0.2, use_speaker_boost:true },
    }),
  })
  if (!r.ok) throw new Error('ElevenLabs ' + r.status)
  const blob = await r.blob()
  return URL.createObjectURL(blob)
}

// ─── Geo helpers ──────────────────────────────────────────
async function reverseGeocode(lat, lon) {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
    { headers:{ 'Accept-Language':'es' } }
  )
  const d = await r.json()
  const a = d.address || {}
  const city = a.city||a.town||a.village||a.municipality||a.county||'Tu ubicación'
  return {
    city,
    neighbourhood: a.suburb||a.neighbourhood||a.quarter||'',
    state: a.state||'',
    country: a.country||'',
    full: [city, a.state, a.country].filter(Boolean).join(', '),
  }
}

async function geocodeName(name) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&addressdetails=1&limit=1`,
      { headers:{ 'Accept-Language':'es' } }
    )
    const d = await r.json()
    if (!d.length) return { full:name, city:name, lat:null, lon:null }
    const a = d[0].address||{}
    const city = a.city||a.town||a.village||a.municipality||name
    return { city, full:[city,a.state,a.country].filter(Boolean).join(', '), lat:parseFloat(d[0].lat), lon:parseFloat(d[0].lon) }
  } catch { return { full:name, city:name, lat:null, lon:null } }
}

// ─── Small UI components ──────────────────────────────────
function Spin({ size=14 }) {
  return <span style={{ display:'inline-block', width:size, height:size, border:'2px solid rgba(255,255,255,.2)', borderTopColor:'#fff', borderRadius:'50%', animation:'wtspin .7s linear infinite', verticalAlign:'middle', flexShrink:0 }}/>
}

function Card({ children, highlight=false, onClick, style={} }) {
  return (
    <div onClick={onClick} style={{
      background: highlight ? 'rgba(37,99,235,.1)' : C.card,
      border:`1px solid ${highlight ? C.borderHi : C.border}`,
      borderRadius:16, padding:'1.1rem', position:'relative', overflow:'hidden',
      cursor: onClick ? 'pointer' : 'default',
      transition:'all .2s',
      ...style,
    }}>
      {highlight && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${C.blue},transparent)` }}/>}
      {children}
    </div>
  )
}

function SectionLabel({ children, color }) {
  return (
    <div style={{ fontFamily:'Inter,sans-serif', fontSize:'.6rem', fontWeight:700, letterSpacing:'.2em', textTransform:'uppercase', color: color||C.blueXL, marginBottom:'.7rem', display:'flex', alignItems:'center', gap:'.5rem' }}>
      {children}
      <span style={{ flex:1, height:1, background:'rgba(37,99,235,.2)' }}/>
    </div>
  )
}

function Pill({ type='info', children }) {
  const s = {
    info:  { bg:'rgba(37,99,235,.1)',  border:'rgba(37,99,235,.3)',  color:C.blueXL  },
    ok:    { bg:'rgba(16,185,129,.1)', border:'rgba(16,185,129,.3)', color:'#6ee7b7' },
    error: { bg:'rgba(239,68,68,.1)',  border:'rgba(239,68,68,.3)',  color:'#fca5a5' },
    warn:  { bg:'rgba(245,158,11,.1)', border:'rgba(245,158,11,.3)', color:'#fcd34d' },
  }[type]||{}
  return <div style={{ padding:'.55rem .9rem', borderRadius:10, fontFamily:'Inter,sans-serif', fontSize:'.7rem', lineHeight:1.55, background:s.bg, border:`1px solid ${s.border}`, color:s.color }}>{children}</div>
}

// Nearby POI card (from GPS)
function NearbyCard({ poi, onSelect, selected }) {
  const name=poiName(poi), icon=poiIcon(poi), type=poiType(poi), close=poi.dist<=80
  return (
    <button onClick={()=>onSelect({ name, type, icon, source:'nearby', dist:poi.dist })}
      style={{ width:'100%', textAlign:'left', padding:'.7rem .9rem', background:selected?'rgba(37,99,235,.18)':close?'rgba(37,99,235,.07)':'rgba(255,255,255,.03)', border:`1px solid ${selected?C.borderHi:close?'rgba(37,99,235,.3)':'rgba(255,255,255,.07)'}`, borderRadius:12, cursor:'pointer', display:'flex', alignItems:'center', gap:'.75rem', transition:'all .2s' }}>
      <span style={{ fontSize:'1.4rem', flexShrink:0 }}>{icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:'Inter,sans-serif', fontSize:'.88rem', fontWeight:500, color:selected?C.blueXL:C.white, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</div>
        <div style={{ fontFamily:'Inter,sans-serif', fontSize:'.62rem', color:C.white4, marginTop:'.1rem' }}>{type}</div>
      </div>
      <div style={{ flexShrink:0, textAlign:'right' }}>
        <div style={{ fontFamily:'Inter,sans-serif', fontSize:'.68rem', fontWeight:600, color:close?C.green:C.blueL }}>{poi.dist}m</div>
        {close && <div style={{ fontFamily:'Inter,sans-serif', fontSize:'.55rem', color:C.green }}>¡Estás aquí!</div>}
      </div>
    </button>
  )
}

// Famous POI card (from AI)
function FamousCard({ place, onSelect, selected }) {
  return (
    <button onClick={()=>onSelect({ ...place, source:'famous' })}
      style={{ width:'100%', textAlign:'left', padding:'.7rem .9rem', background:selected?'rgba(37,99,235,.18)':'rgba(255,255,255,.03)', border:`1px solid ${selected?C.borderHi:'rgba(255,255,255,.07)'}`, borderRadius:12, cursor:'pointer', display:'flex', alignItems:'center', gap:'.75rem', transition:'all .2s' }}>
      <span style={{ fontSize:'1.4rem', flexShrink:0 }}>{place.icon||'🏛️'}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:'Inter,sans-serif', fontSize:'.88rem', fontWeight:500, color:selected?C.blueXL:C.white, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{place.name}</div>
        <div style={{ fontFamily:'Inter,sans-serif', fontSize:'.62rem', color:C.white4, marginTop:'.1rem' }}>{place.description}</div>
      </div>
      <div style={{ fontFamily:'Inter,sans-serif', fontSize:'.62rem', fontWeight:500, color:C.blueXL, flexShrink:0 }}>{place.type}</div>
    </button>
  )
}

// Audio player component
function AudioPlayer({ playing, progress, audioLoading, onToggle, onRestart, spd, onSpeedChange, elActive }) {
  return (
    <div>
      {elActive && (
        <div style={{ display:'flex', alignItems:'center', gap:'.4rem', marginBottom:'.65rem' }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:C.green }}/>
          <span style={{ fontFamily:'Inter,sans-serif', fontSize:'.62rem', color:C.green, fontWeight:500 }}>Voz ElevenLabs — Adam</span>
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
        <button onClick={onToggle} disabled={audioLoading}
          style={{ width:54, height:54, borderRadius:'50%', background:`linear-gradient(135deg,${C.blue},#1d4ed8)`, border:'none', cursor:audioLoading?'wait':'pointer', fontSize:'1.2rem', flexShrink:0, boxShadow:`0 4px 20px rgba(37,99,235,.45)`, display:'flex', alignItems:'center', justifyContent:'center', animation:playing?'wtpulse 2s infinite':'' }}>
          {audioLoading ? <Spin size={20}/> : playing ? '⏸️' : '▶️'}
        </button>
        <div style={{ flex:1 }}>
          <div style={{ height:4, background:'rgba(255,255,255,.08)', borderRadius:2, overflow:'hidden', marginBottom:'.4rem' }}>
            <div style={{ height:'100%', background:`linear-gradient(90deg,${C.blue},${C.blueXL})`, width:(progress*100)+'%', transition:'width .4s linear', borderRadius:2 }}/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'Inter,sans-serif', fontSize:'.62rem', color:C.white4 }}>
            <span>{Math.round(progress*100)}%</span>
            <span style={{ color:audioLoading?C.accent:playing?C.green:progress>0?C.accent:C.white4 }}>
              {audioLoading?'⏳ generando audio...':playing?'🔊 reproduciendo':progress>0?'⏸ pausado':'toca ▶ para escuchar'}
            </span>
          </div>
        </div>
        <div style={{ display:'flex', gap:3, alignItems:'flex-end', height:28 }}>
          {[8,16,11,22,14,9].map((h,i)=>(
            <div key={i} style={{ width:3, background:C.blueL, borderRadius:2, height:playing?h:3, opacity:playing?.8:.2, transition:`height ${.2+i*.04}s ease,opacity .3s` }}/>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'.75rem' }}>
        <button onClick={onSpeedChange}
          style={{ fontFamily:'Inter,sans-serif', fontSize:'.65rem', fontWeight:600, background:'rgba(37,99,235,.12)', border:`1px solid ${C.border}`, color:C.blueXL, padding:'.25rem .7rem', borderRadius:20, cursor:'pointer' }}>
          {spd}× velocidad
        </button>
        <button onClick={onRestart}
          style={{ fontFamily:'Inter,sans-serif', fontSize:'.65rem', background:'none', border:'none', color:C.white4, cursor:'pointer' }}>
          ↺ Reiniciar
        </button>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────
export default function App() {
  // Keys
  const [groqKey,   setGroqKey]   = useState(GROQ_KEY)
  const [elKey,     setElKey]     = useState(EL_KEY)
  const [groqInput, setGroqInput] = useState('')
  const [elInput,   setElInput]   = useState('')
  const [keySaved,  setKeySaved]  = useState(!!GROQ_KEY)

  // UI
  const [tab,       setTab]       = useState('gps')
  const [cityInput, setCityInput] = useState('')
  const [mode,      setMode]      = useState('history')
  const [lang,      setLang]      = useState('es')

  // Location
  const [gpsPhase,  setGpsPhase]  = useState('idle')
  const [gpsMsg,    setGpsMsg]    = useState('')
  const [geoInfo,   setGeoInfo]   = useState(null)

  // Places
  const [nearbyPois,  setNearbyPois]  = useState([])
  const [famousPois,  setFamousPois]  = useState([])
  const [loadingFamous, setLoadingFamous] = useState(false)
  const [selPlace,    setSelPlace]    = useState(null)

  // Story
  const [busy,      setBusy]      = useState(false)
  const [story,     setStory]     = useState('')
  const [shown,     setShown]     = useState('')
  const [err,       setErr]       = useState('')
  const [storyCtx,  setStoryCtx]  = useState('')

  // Audio
  const [playing,      setPlaying]      = useState(false)
  const [progress,     setProgress]     = useState(0)
  const [spd,          setSpd]          = useState(1.0)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioSrc,     setAudioSrc]     = useState(null)

  const typeTimer = useRef(null)
  const progTimer = useRef(null)
  const storyRef  = useRef('')
  const spdRef    = useRef(1.0)
  const audioRef  = useRef(null)

  useEffect(() => { spdRef.current = spd }, [spd])
  useEffect(() => {
    window.speechSynthesis?.getVoices()
    const h = () => window.speechSynthesis.getVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', h)
    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', h)
      clearInterval(typeTimer.current); clearInterval(progTimer.current)
      window.speechSynthesis?.cancel()
    }
  }, [])

  // ── Typewriter ─────────────────────────────────────────
  function typewrite(text) {
    clearInterval(typeTimer.current)
    storyRef.current = text
    stopAudio(); setShown(''); setProgress(0); setAudioSrc(null)
    const words = text.split(' '); let i = 0
    typeTimer.current = setInterval(() => {
      i++; setShown(words.slice(0,i).join(' '))
      if (i >= words.length) clearInterval(typeTimer.current)
    }, 22)
  }

  // ── Audio ──────────────────────────────────────────────
  function stopAudio() {
    clearInterval(progTimer.current)
    try { window.speechSynthesis.cancel() } catch {}
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
    setPlaying(false)
  }

  function startBrowserTTS() {
    const synth = window.speechSynthesis
    const text = storyRef.current
    const ttsTag = LANGS.find(l=>l.value===lang)?.tts||'es-ES'
    const voices = synth.getVoices()
    const voice = voices.find(v=>v.lang===ttsTag)||voices.find(v=>v.lang.startsWith(lang+'-'))||voices.find(v=>v.lang.startsWith(lang))||null
    const parts = text.match(/[^.!?]+[.!?]*/g)||[text]
    const totalSec = (text.split(/\s+/).length/130)*60/spdRef.current
    const t0 = Date.now()
    progTimer.current = setInterval(() => {
      try { if(synth.paused) synth.resume() } catch {}
      setProgress(Math.min((Date.now()-t0)/1000/totalSec,.99))
    }, 400)
    let idx=0
    function next() {
      if(idx>=parts.length){clearInterval(progTimer.current);setPlaying(false);setProgress(1);return}
      const u=new SpeechSynthesisUtterance(parts[idx])
      u.rate=spdRef.current;u.pitch=1;u.volume=1;if(voice)u.voice=voice
      u.onend=()=>{idx++;next()}
      u.onerror=e=>{if(e.error!=='interrupted'){clearInterval(progTimer.current);setPlaying(false)}}
      synth.speak(u);idx++
    }
    setPlaying(true);next()
  }

  async function toggleAudio() {
    if (playing) { stopAudio(); return }
    if (elKey && !audioSrc) {
      setAudioLoading(true)
      try {
        const url = await elevenLabsTTS(storyRef.current, elKey)
        setAudioSrc(url)
        setAudioLoading(false)
        if (audioRef.current) {
          audioRef.current.src = url
          audioRef.current.playbackRate = spdRef.current
          audioRef.current.play()
          setPlaying(true)
          audioRef.current.ontimeupdate = () => {
            if (audioRef.current) setProgress(audioRef.current.currentTime / audioRef.current.duration)
          }
          audioRef.current.onended = () => { setPlaying(false); setProgress(1) }
        }
      } catch {
        setAudioLoading(false)
        startBrowserTTS()
      }
    } else if (elKey && audioSrc && audioRef.current) {
      if (audioRef.current.paused) { audioRef.current.play(); setPlaying(true) }
      else { audioRef.current.pause(); setPlaying(false) }
    } else {
      startBrowserTTS()
    }
  }

  function handleRestart() {
    stopAudio(); setProgress(0); setAudioSrc(null)
    setTimeout(toggleAudio, 150)
  }

  function handleSpeedChange() {
    const o=[0.75,1.0,1.25,1.5]
    setSpd(o[(o.indexOf(spd)+1)%o.length])
    if (playing && !elKey) { stopAudio(); setTimeout(startBrowserTTS, 100) }
  }

  // ── Generate story ─────────────────────────────────────
  async function generateStory(placeName, extra='') {
    setErr(''); setBusy(true); setStory(''); setShown(''); setStoryCtx(placeName); setAudioSrc(null)
    try {
      const promptFn = PROMPTS[mode] || PROMPTS.history
      const text = await askGroq(promptFn(placeName, extra), groqKey, lang)
      setStory(text); typewrite(text)
    } catch { setErr('Error al generar. Verifica tu API key de Groq.') }
    setBusy(false)
  }

  // ── Load famous places for a city ─────────────────────
  async function loadFamousPlaces(city) {
    setLoadingFamous(true)
    try {
      const places = await askGroqFamous(city, lang, groqKey)
      setFamousPois(places)
    } catch { setFamousPois([]) }
    setLoadingFamous(false)
  }

  // ── GPS ────────────────────────────────────────────────
  function detectGPS() {
    if (!navigator.geolocation) { setGpsPhase('error'); setGpsMsg('Tu navegador no soporta GPS.'); return }
    setGpsPhase('detecting'); setGpsMsg('Solicitando permiso...')
    setErr(''); setStory(''); setShown(''); setNearbyPois([]); setFamousPois([]); setSelPlace(null); stopAudio()

    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude:lat, longitude:lon } = pos.coords
      setGpsPhase('scanning'); setGpsMsg('Escaneando tu ubicación...')

      const [geoRes, poisRes] = await Promise.allSettled([
        reverseGeocode(lat, lon),
        fetchNearbyPOI(lat, lon),
      ])

      const geo = geoRes.status==='fulfilled' ? geoRes.value : { full:'Tu ubicación', city:'Este lugar', neighbourhood:'' }
      const nearby = poisRes.status==='fulfilled' ? poisRes.value : []

      setGeoInfo(geo)
      setNearbyPois(nearby)
      setGpsPhase('done')
      setGpsMsg(geo.neighbourhood ? `${geo.neighbourhood}, ${geo.full}` : geo.full)

      // Auto-narrate the city
      await generateStory(geo.full)

      // Load famous places in background
      loadFamousPlaces(geo.city)

    }, e => {
      setGpsPhase('error')
      setGpsMsg({ 1:'Permiso denegado. Actívalo en tu navegador.', 2:'No se pudo determinar la posición.', 3:'Tiempo agotado.' }[e.code]||'Error de GPS.')
      setBusy(false)
    }, { enableHighAccuracy:true, timeout:15000, maximumAge:0 })
  }

  // ── Manual search ──────────────────────────────────────
  async function searchManual() {
    const q = cityInput.trim(); if (!q||busy) return
    setErr(''); setNearbyPois([]); setFamousPois([]); setSelPlace(null); stopAudio(); setBusy(true)
    const geo = await geocodeName(q)
    setGeoInfo({ full:geo.full, city:geo.city, neighbourhood:'' })
    setGpsMsg(geo.full); setGpsPhase('done')

    // Nearby POIs if we have coords
    if (geo.lat && geo.lon) {
      try { const p = await fetchNearbyPOI(geo.lat, geo.lon); setNearbyPois(p) } catch {}
    }

    await generateStory(geo.full)
    loadFamousPlaces(geo.city)
  }

  // ── Select a place ─────────────────────────────────────
  async function selectPlace(place) {
    setSelPlace(place)
    stopAudio()
    const extra = place.source==='nearby'
      ? `Tipo de lugar: ${place.type}. Distancia: ${place.dist}m de donde está el visitante.`
      : `Tipo de lugar: ${place.type}. Es uno de los lugares más famosos de la ciudad.`
    await generateStory(place.name, extra)
  }

  const storyDone = !!story && shown === story
  const currentMode = MODES.find(m=>m.key===mode)

  return (
    <>
      <style>{`
        @keyframes wtspin  { to{transform:rotate(360deg)} }
        @keyframes wtblink { 0%,50%{opacity:1}51%,100%{opacity:0} }
        @keyframes wtpulse { 0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.5)}50%{box-shadow:0 0 0 14px rgba(37,99,235,0)} }
        @keyframes wtfade  { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px }
        ::-webkit-scrollbar-thumb { background:rgba(37,99,235,.3); border-radius:2px }
        input:focus { border-color: #2563eb !important; }
      `}</style>

      <audio ref={audioRef} style={{display:'none'}}/>

      <div style={{ fontFamily:'Inter,sans-serif', background:C.bg, minHeight:'100vh', color:C.white, padding:'1.2rem 1rem 2rem', display:'flex', flexDirection:'column', gap:'1rem', maxWidth:500, margin:'0 auto' }}>

        {/* ── Header ── */}
        <div style={{ textAlign:'center', padding:'1.5rem 0 1.2rem', borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:'.65rem', marginBottom:'.5rem' }}>
            <div style={{ width:38, height:38, borderRadius:11, background:`linear-gradient(135deg,${C.blue},#1d4ed8)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', boxShadow:`0 4px 16px rgba(37,99,235,.4)` }}>🧭</div>
            <span style={{ fontFamily:'Playfair Display,serif', fontSize:'2rem', fontWeight:700, color:C.white, letterSpacing:'-.02em' }}>WiseTap</span>
          </div>
          <div style={{ fontFamily:'Inter,sans-serif', fontSize:'.6rem', fontWeight:500, letterSpacing:'.25em', textTransform:'uppercase', color:C.white4 }}>
            Audioguía histórica con inteligencia artificial
          </div>
        </div>

        {/* ── API Key setup ── */}
        {!keySaved ? (
          <Card>
            <SectionLabel>🔑 Configurar API Keys</SectionLabel>
            <p style={{ fontFamily:'Inter,sans-serif', fontSize:'.75rem', color:C.white7, lineHeight:1.65, marginBottom:'1rem' }}>
              Necesitas una API key de <strong style={{color:C.blueXL}}>Groq</strong> (gratis, sin tarjeta) en <strong style={{color:C.blueXL}}>console.groq.com</strong>
            </p>
            <input type="password" placeholder="gsk_... (Groq — obligatorio)"
              value={groqInput} onChange={e=>setGroqInput(e.target.value)}
              style={{ width:'100%', background:'rgba(255,255,255,.06)', border:`1px solid ${C.border}`, borderRadius:10, color:C.white, fontFamily:'Inter,sans-serif', fontSize:'.8rem', padding:'.65rem .9rem', outline:'none', marginBottom:'.6rem' }}
            />
            <input type="password" placeholder="sk_... (ElevenLabs — opcional, mejor voz)"
              value={elInput} onChange={e=>setElInput(e.target.value)}
              style={{ width:'100%', background:'rgba(255,255,255,.06)', border:`1px solid ${C.border}`, borderRadius:10, color:C.white, fontFamily:'Inter,sans-serif', fontSize:'.8rem', padding:'.65rem .9rem', outline:'none', marginBottom:'.6rem' }}
            />
            <p style={{ fontFamily:'Inter,sans-serif', fontSize:'.68rem', color:C.white4, marginBottom:'1rem', lineHeight:1.5 }}>
              ElevenLabs es opcional. Ofrece voz masculina profunda y natural. Plan gratis en <strong style={{color:C.blueXL}}>elevenlabs.io</strong> con 10.000 caracteres/mes.
            </p>
            <button onClick={()=>{ if(groqInput.trim()){ setGroqKey(groqInput.trim()); if(elInput.trim()) setElKey(elInput.trim()); setKeySaved(true) }}}
              disabled={!groqInput.trim()}
              style={{ width:'100%', padding:'.85rem', background:groqInput.trim()?`linear-gradient(135deg,${C.blue},#1d4ed8)`:'rgba(37,99,235,.25)', border:'none', borderRadius:10, color:'#fff', fontFamily:'Inter,sans-serif', fontSize:'.82rem', fontWeight:600, cursor:groqInput.trim()?'pointer':'not-allowed', letterSpacing:'.03em', boxShadow:groqInput.trim()?`0 4px 14px rgba(37,99,235,.35)`:'none' }}>
              Guardar y comenzar →
            </button>
          </Card>
        ) : (
          <>
            {/* ── Tabs ── */}
            <div style={{ display:'flex', gap:'.4rem', background:C.card, borderRadius:12, padding:'.3rem' }}>
              {[['gps','📡 GPS'],['manual','✏️ Ciudad']].map(([t,lbl])=>(
                <button key={t} onClick={()=>setTab(t)}
                  style={{ flex:1, padding:'.55rem', background:tab===t?C.blue:'transparent', border:'none', borderRadius:9, color:tab===t?'#fff':C.white4, fontFamily:'Inter,sans-serif', fontSize:'.72rem', fontWeight:600, cursor:'pointer', transition:'all .2s' }}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* ── GPS ── */}
            {tab==='gps' && (
              <Card>
                <SectionLabel>Detección de ubicación</SectionLabel>
                <button onClick={detectGPS} disabled={busy}
                  style={{ width:'100%', padding:'.9rem', background:busy?'rgba(37,99,235,.25)':`linear-gradient(135deg,${C.blue},#1d4ed8)`, border:'none', borderRadius:10, color:'#fff', fontFamily:'Inter,sans-serif', fontSize:'.82rem', fontWeight:600, cursor:busy?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'.6rem', boxShadow:busy?'none':`0 4px 14px rgba(37,99,235,.35)`, animation:gpsPhase==='detecting'||gpsPhase==='scanning'?'wtpulse 2s infinite':'' }}>
                  {gpsPhase==='detecting'||gpsPhase==='scanning' ? <><Spin/>{gpsPhase==='scanning'?'Escaneando lugares...':'Detectando...'}</> : '📡 Detectar mi ubicación'}
                </button>
                {gpsMsg && (
                  <div style={{ marginTop:'.75rem' }}>
                    <Pill type={gpsPhase==='error'?'error':gpsPhase==='done'?'ok':'info'}>
                      {gpsPhase==='detecting'||gpsPhase==='scanning'?'⏳ ':gpsPhase==='done'?'📍 ':gpsPhase==='error'?'❌ ':''}{gpsMsg}
                    </Pill>
                  </div>
                )}
              </Card>
            )}

            {/* ── Manual ── */}
            {tab==='manual' && (
              <Card>
                <SectionLabel>Buscar ciudad o lugar</SectionLabel>
                <div style={{ display:'flex', gap:'.5rem' }}>
                  <input type="text" placeholder="Roma, Santiago, Tokio, el Coliseo..."
                    value={cityInput} onChange={e=>setCityInput(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&searchManual()}
                    style={{ flex:1, background:'rgba(255,255,255,.06)', border:`1px solid ${C.border}`, borderRadius:10, color:C.white, fontFamily:'Playfair Display,serif', fontSize:'1rem', padding:'.65rem .9rem', outline:'none' }}
                  />
                  <button onClick={searchManual} disabled={busy||!cityInput.trim()}
                    style={{ padding:'.65rem 1.2rem', background:busy||!cityInput.trim()?'rgba(37,99,235,.25)':`linear-gradient(135deg,${C.blue},#1d4ed8)`, border:'none', borderRadius:10, color:'#fff', fontFamily:'Inter,sans-serif', fontSize:'.82rem', fontWeight:600, cursor:busy||!cityInput.trim()?'not-allowed':'pointer', boxShadow:busy||!cityInput.trim()?'none':`0 4px 14px rgba(37,99,235,.35)` }}>
                    {busy?<Spin/>:'Ir →'}
                  </button>
                </div>
              </Card>
            )}

            {/* ── Lang + Mode ── */}
            <Card>
              <SectionLabel>Idioma y tema</SectionLabel>
              <select value={lang} onChange={e=>setLang(e.target.value)}
                style={{ width:'100%', background:'rgba(255,255,255,.06)', border:`1px solid ${C.border}`, borderRadius:10, color:C.white, fontFamily:'Inter,sans-serif', fontSize:'.82rem', padding:'.6rem .9rem', outline:'none', marginBottom:'.75rem', cursor:'pointer' }}>
                {LANGS.map(l=><option key={l.value} value={l.value} style={{background:'#0a1628'}}>{l.label}</option>)}
              </select>
              <div style={{ display:'flex', gap:'.4rem' }}>
                {MODES.map(m=>(
                  <button key={m.key} onClick={()=>setMode(m.key)}
                    style={{ flex:1, padding:'.55rem .2rem', background:mode===m.key?`${m.color}22`:'rgba(255,255,255,.04)', border:`1px solid ${mode===m.key?m.color+'66':'rgba(255,255,255,.08)'}`, borderRadius:10, color:mode===m.key?m.color:C.white4, fontFamily:'Inter,sans-serif', fontSize:'.58rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', cursor:'pointer', textAlign:'center', transition:'all .2s' }}>
                    <div style={{fontSize:'1rem',marginBottom:3}}>{m.icon}</div>{m.label}
                  </button>
                ))}
              </div>
            </Card>

            {/* ── Error ── */}
            {err && <Pill type="error">❌ {err}</Pill>}

            {/* ── Story (city overview) ── */}
            {shown && (
              <Card highlight={storyDone} style={{animation:'wtfade .4s ease'}}>
                <SectionLabel color={currentMode?.color}>
                  {currentMode?.icon} {storyCtx}
                </SectionLabel>
                <div style={{ fontFamily:'Playfair Display,serif', fontSize:'1.05rem', lineHeight:1.95, color:C.white7, marginBottom:storyDone?'1.1rem':0 }}>
                  {shown}
                  {!storyDone && <span style={{ display:'inline-block', width:2, height:'.9em', background:C.blue, verticalAlign:'middle', marginLeft:2, animation:'wtblink .8s infinite' }}/>}
                </div>
                {storyDone && (
                  <>
                    <div style={{ height:1, background:C.border, marginBottom:'1rem' }}/>
                    <AudioPlayer
                      playing={playing} progress={progress} audioLoading={audioLoading} spd={spd}
                      onToggle={toggleAudio} onRestart={handleRestart} onSpeedChange={handleSpeedChange}
                      elActive={!!elKey}
                    />
                  </>
                )}
              </Card>
            )}

            {/* ── Nearby POIs ── */}
            {nearbyPois.length > 0 && (
              <Card>
                <SectionLabel>📍 Lugares cercanos a ti</SectionLabel>
                <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
                  {nearbyPois.map((poi,i) => (
                    <NearbyCard key={i} poi={poi}
                      selected={selPlace?.name===poiName(poi)&&selPlace?.source==='nearby'}
                      onSelect={selectPlace}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* ── Famous places ── */}
            {(famousPois.length > 0 || loadingFamous) && (
              <Card>
                <SectionLabel>⭐ Lugares más famosos</SectionLabel>
                {loadingFamous ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'.6rem', color:C.white4, fontFamily:'Inter,sans-serif', fontSize:'.75rem', padding:'.5rem 0' }}>
                    <Spin/> Buscando lugares famosos...
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'.4rem' }}>
                    {famousPois.map((place,i) => (
                      <FamousCard key={i} place={place}
                        selected={selPlace?.name===place.name&&selPlace?.source==='famous'}
                        onSelect={selectPlace}
                      />
                    ))}
                  </div>
                )}
              </Card>
            )}

            <button onClick={()=>{ setKeySaved(false); setGroqKey(''); setElKey(''); setGroqInput(''); setElInput('') }}
              style={{ fontFamily:'Inter,sans-serif', fontSize:'.6rem', background:'none', border:'none', color:'rgba(255,255,255,.18)', cursor:'pointer', textDecoration:'underline', textAlign:'center' }}>
              Cambiar API keys
            </button>
          </>
        )}

        <div style={{ textAlign:'center', fontFamily:'Inter,sans-serif', fontSize:'.58rem', fontWeight:500, letterSpacing:'.15em', textTransform:'uppercase', color:'rgba(255,255,255,.15)', paddingTop:'.25rem' }}>
          WiseTap v3 · Groq + ElevenLabs AI
        </div>
      </div>
    </>
  )
}
