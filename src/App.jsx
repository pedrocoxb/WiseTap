import { useState, useRef, useEffect } from 'react'
import { fetchNearbyPOI, poiName, poiIcon, poiType } from './poi.js'

// ─── Constants ────────────────────────────────────────────
const TABS = [
  { key:'history', icon:'🏛️', label:'Historia'    },
  { key:'legends', icon:'✨', label:'Leyendas'    },
  { key:'food',    icon:'🍽️', label:'Gastronomía' },
  { key:'places',  icon:'🗺️', label:'Monumentos'  },
]

const LANGS = [
  { value:'es', label:'🌍 Español',   tts:'es-ES' },
  { value:'en', label:'🌐 English',   tts:'en-US' },
  { value:'fr', label:'🗼 Français',  tts:'fr-FR' },
  { value:'it', label:'🏛️ Italiano',  tts:'it-IT' },
  { value:'pt', label:'🎶 Português', tts:'pt-BR' },
]

const SYS_LANG = {
  es:'Responde completamente en español.',
  en:'Respond entirely in English.',
  fr:'Réponds entièrement en français.',
  it:'Rispondi interamente in italiano.',
  pt:'Responda inteiramente em português.',
}

const PROMPTS = {
  history: (place, extra='') =>
    `Eres un guía histórico experto. Habla con claridad y precisión. Sin frases poéticas. Solo datos reales, fechas y hechos verificables.
Lugar: ${place}. ${extra}
Narra la historia en 220-260 palabras:
- Cuándo fue fundado y por quién
- Los eventos históricos más importantes
- Cómo ha cambiado con el tiempo
- Su importancia hoy
Empieza directo con los datos históricos.`,

  legends: (place, extra='') =>
    `Eres un experto en folclore y mitología. Narra leyendas de forma entretenida, dejando claro que son relatos populares.
Lugar: ${place}. ${extra}
Cuenta las leyendas más famosas en 220-260 palabras:
- La leyenda más conocida con todos sus detalles
- Otros relatos o supersticiones locales
- Qué representan culturalmente
Empieza directamente contando la primera leyenda.`,

  food: (place, extra='') =>
    `Eres un crítico gastronómico experto en cocina regional. Habla de forma concreta. Sin metáforas. Información práctica sobre qué comer.
Lugar: ${place}. ${extra}
Describe la gastronomía en 220-260 palabras:
- Los 3-4 platos típicos más representativos con sus ingredientes
- Bebidas o postres típicos
- Dónde o cuándo se suelen comer
- Una curiosidad sobre la cocina local
Empieza directamente con el primer plato típico.`,

  monument: (place, type='', city='') =>
    `Eres un guía turístico experto. Habla con claridad y datos precisos. Sin frases poéticas innecesarias.
Monumento: ${place}. Tipo: ${type}. Ciudad: ${city}.
Narra la historia completa en 260-300 palabras:
- Cuándo fue construido, por quién y con qué propósito
- Los eventos o personajes históricos más importantes ligados a él
- Sus características arquitectónicas o artísticas destacadas
- Por qué vale la pena visitarlo hoy
Empieza directamente con los datos del monumento.`,
}

const G='#c8963e', GL='#e8b96a', T='#b05c3a'
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || ''
const EL_KEY   = import.meta.env.VITE_ELEVENLABS_KEY || ''
// ElevenLabs Voice: Adam — deep, narrative male
const EL_VOICE = 'pNInz6obpgDQGcFmaJgB'

// ─── API helpers ──────────────────────────────────────────
async function askGroq(prompt, key, lang) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
    body: JSON.stringify({
      model:'llama-3.3-70b-versatile',
      messages:[
        { role:'system', content: SYS_LANG[lang]||SYS_LANG.es },
        { role:'user',   content: prompt },
      ],
      max_tokens:1000, temperature:0.7,
    }),
  })
  if (!r.ok) throw new Error('Groq ' + r.status)
  const d = await r.json()
  return d.choices?.[0]?.message?.content || ''
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
  const a = d.address||{}
  const city = a.city||a.town||a.village||a.municipality||a.county||'Tu ubicación'
  return { city, neighbourhood:a.suburb||a.neighbourhood||'', state:a.state||'', country:a.country||'', full:[city,a.state,a.country].filter(Boolean).join(', ') }
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

// Fetch POIs with larger radius
async function fetchPOI(lat, lon) {
  const radius = 500 // 500m radius — wider search
  const q = `[out:json][timeout:15];(
    node["historic"](around:${radius},${lat},${lon});
    node["tourism"~"museum|attraction|monument|artwork|viewpoint|gallery|memorial|yes"](around:${radius},${lat},${lon});
    node["amenity"~"place_of_worship|theatre|library|cinema"](around:${radius},${lat},${lon});
    node["leisure"~"park|garden|nature_reserve"](around:${radius},${lat},${lon});
    node["building"~"cathedral|church|chapel|mosque|synagogue|temple|castle|palace|monument"](around:${radius},${lat},${lon});
    node["landuse"~"cemetery"](around:${radius},${lat},${lon});
    way["historic"](around:${radius},${lat},${lon});
    way["tourism"~"museum|attraction|monument|artwork|viewpoint|gallery|memorial|yes"](around:${radius},${lat},${lon});
    way["amenity"~"place_of_worship|theatre"](around:${radius},${lat},${lon});
    way["leisure"~"park|garden"](around:${radius},${lat},${lon});
    way["building"~"cathedral|church|chapel|mosque|synagogue|temple|castle|palace|monument"](around:${radius},${lat},${lon});
  );out body center 30;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method:'POST', body:'data='+encodeURIComponent(q),
  })
  if (!res.ok) throw new Error('Overpass error')
  const data = await res.json()

  function calcDist(la1,lo1,la2,lo2){const R=6371000,dLat=(la2-la1)*Math.PI/180,dLon=(lo2-lo1)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLon/2)**2;return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)))}

  const els = (data.elements||[]).map(el=>({
    ...el, lat:el.lat??el.center?.lat, lon:el.lon??el.center?.lon,
  })).filter(el => {
    if (!el.lat||!el.lon) return false
    const t = el.tags||{}
    // Must have a name
    const name = t.name||t['name:es']||t['name:en']
    return !!name
  })

  const withDist = els.map(el=>({...el, dist:calcDist(lat,lon,el.lat,el.lon)})).sort((a,b)=>a.dist-b.dist)
  const seen = new Set()
  return withDist.filter(el=>{
    const n = poiName(el)
    if(seen.has(n)) return false
    seen.add(n); return true
  }).slice(0,12)
}

// ─── UI helpers ───────────────────────────────────────────
function Spin({size=14}) {
  return <span style={{display:'inline-block',width:size,height:size,border:'2px solid rgba(255,255,255,.25)',borderTopColor:'#fff',borderRadius:'50%',animation:'wtspin .7s linear infinite',verticalAlign:'middle',flexShrink:0}}/>
}
function Card({label, children, highlight=false}) {
  return (
    <div style={{background:highlight?'rgba(200,150,62,.07)':'rgba(245,239,224,.04)',border:`1px solid ${highlight?'rgba(200,150,62,.4)':'rgba(200,150,62,.22)'}`,borderRadius:14,padding:'1.1rem',position:'relative',overflow:'hidden'}}>
      {highlight&&<div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${G},transparent)`}}/>}
      {label&&<div style={{fontFamily:'sans-serif',fontSize:'.58rem',fontWeight:700,letterSpacing:'.26em',textTransform:'uppercase',color:G,marginBottom:'.7rem',display:'flex',alignItems:'center',gap:'.5rem'}}>{label}<span style={{flex:1,height:1,background:'rgba(200,150,62,.18)'}}/></div>}
      {children}
    </div>
  )
}
function Pill({type='info',children}) {
  const s={
    info: {bg:'rgba(200,150,62,.08)',border:'rgba(200,150,62,.2)', color:'rgba(245,239,224,.65)'},
    ok:   {bg:'rgba(90,122,94,.12)', border:'rgba(90,122,94,.3)',  color:'#a8d8a8'},
    error:{bg:'rgba(176,92,58,.12)', border:'rgba(176,92,58,.35)', color:'#e8a8a8'},
  }[type]||{}
  return <div style={{padding:'.55rem .85rem',borderRadius:9,fontFamily:'sans-serif',fontSize:'.7rem',lineHeight:1.55,background:s.bg,border:`1px solid ${s.border}`,color:s.color}}>{children}</div>
}
function POICard({poi, onSelect, selected}) {
  const name=poiName(poi), icon=poiIcon(poi), type=poiType(poi), close=poi.dist<=80
  return (
    <button onClick={()=>onSelect(poi)}
      style={{width:'100%',textAlign:'left',padding:'.75rem .9rem',background:selected?'rgba(200,150,62,.15)':close?'rgba(200,150,62,.07)':'rgba(245,239,224,.03)',border:`1px solid ${selected?'rgba(200,150,62,.5)':close?'rgba(200,150,62,.3)':'rgba(245,239,224,.08)'}`,borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',gap:'.75rem',transition:'all .2s'}}>
      <span style={{fontSize:'1.4rem',flexShrink:0}}>{icon}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:'Georgia,serif',fontSize:'.95rem',color:selected?GL:'#f5efe0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{name}</div>
        <div style={{fontFamily:'sans-serif',fontSize:'.62rem',color:'rgba(245,239,224,.4)',marginTop:'.12rem'}}>{type}</div>
      </div>
      <div style={{flexShrink:0,textAlign:'right'}}>
        <div style={{fontFamily:'sans-serif',fontSize:'.68rem',fontWeight:700,color:close?'#a8d8a8':G}}>{poi.dist}m</div>
        {close&&<div style={{fontFamily:'sans-serif',fontSize:'.55rem',color:'#a8d8a8'}}>¡Estás aquí!</div>}
      </div>
    </button>
  )
}

function Player({story, ctx, playing, progress, audioCtx, spd, onToggle, onRestart, onSpeed}) {
  const isActive = audioCtx===ctx
  return (
    <>
      <div style={{height:1,background:'rgba(200,150,62,.15)',marginBottom:'1rem'}}/>
      {EL_KEY && <div style={{display:'flex',alignItems:'center',gap:'.4rem',marginBottom:'.6rem'}}><div style={{width:6,height:6,borderRadius:'50%',background:'#10b981'}}/><span style={{fontFamily:'sans-serif',fontSize:'.62rem',color:'#10b981',fontWeight:500}}>Voz ElevenLabs — Adam</span></div>}
      <div style={{display:'flex',alignItems:'center',gap:'.9rem'}}>
        <button onClick={onToggle}
          style={{width:52,height:52,borderRadius:'50%',background:`linear-gradient(135deg,${G},${T})`,border:'none',cursor:'pointer',fontSize:'1.2rem',flexShrink:0,boxShadow:'0 4px 16px rgba(200,150,62,.4)',display:'flex',alignItems:'center',justifyContent:'center',animation:playing&&isActive?'wtpulse 2s infinite':''}}>
          {playing&&isActive?'⏸️':'▶️'}
        </button>
        <div style={{flex:1}}>
          <div style={{height:4,background:'rgba(200,150,62,.15)',borderRadius:2,overflow:'hidden',marginBottom:'.35rem'}}>
            <div style={{height:'100%',background:`linear-gradient(90deg,${G},${GL})`,width:isActive?(progress*100)+'%':'0%',transition:'width .4s linear'}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontFamily:'sans-serif',fontSize:'.6rem',color:'rgba(245,239,224,.3)'}}>
            <span>{isActive?Math.round(progress*100):0}%</span>
            <span style={{color:playing&&isActive?'#a0d0a0':isActive&&progress>0?'#d0c080':'rgba(245,239,224,.3)'}}>
              {playing&&isActive?'🔊 reproduciendo':isActive&&progress>0?'⏸ pausado':'toca ▶ para escuchar'}
            </span>
          </div>
        </div>
        <div style={{display:'flex',gap:3,alignItems:'flex-end',height:26}}>
          {[7,15,10,21,13,8].map((h,i)=>(
            <div key={i} style={{width:3,background:G,borderRadius:2,height:playing&&isActive?h:3,opacity:playing&&isActive?.85:.2,transition:`height ${.2+i*.04}s ease,opacity .3s`}}/>
          ))}
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'.7rem'}}>
        <button onClick={onSpeed}
          style={{fontFamily:'sans-serif',fontSize:'.62rem',fontWeight:700,background:'rgba(200,150,62,.1)',border:'1px solid rgba(200,150,62,.28)',color:G,padding:'.22rem .65rem',borderRadius:20,cursor:'pointer'}}>
          {spd}× velocidad
        </button>
        <button onClick={onRestart}
          style={{fontFamily:'sans-serif',fontSize:'.62rem',background:'none',border:'none',color:'rgba(245,239,224,.35)',cursor:'pointer'}}>
          ↺ Reiniciar
        </button>
      </div>
    </>
  )
}

// ─── Main App ─────────────────────────────────────────────
export default function App() {
  const [keyInput,  setKeyInput]  = useState('')
  const [keySaved,  setKeySaved]  = useState(!!GROQ_KEY)

  const [inputMode, setInputMode] = useState('gps')
  const [cityInput, setCityInput] = useState('')
  const [activeTab, setActiveTab] = useState('history')
  const [lang,      setLang]      = useState('es')

  const [busy,      setBusy]      = useState(false)
  const [gpsPhase,  setGpsPhase]  = useState('idle')
  const [gpsMsg,    setGpsMsg]    = useState('')
  const [geoInfo,   setGeoInfo]   = useState(null)
  const [coords,    setCoords]    = useState(null)

  const [stories,   setStories]   = useState({})
  const [shown,     setShown]     = useState({})

  const [pois,      setPois]      = useState([])
  const [selPoi,    setSelPoi]    = useState(null)
  const [poiStory,  setPoiStory]  = useState('')
  const [poiShown,  setPoiShown]  = useState('')
  const [poiBusy,   setPoiBusy]   = useState(false)

  const [err,       setErr]       = useState('')
  const [playing,   setPlaying]   = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [spd,       setSpd]       = useState(1.0)
  const [audioCtx,  setAudioCtx]  = useState(null)
  const [audioLoading,setAudioLoading]=useState(false)
  const [audioSrc,  setAudioSrc]  = useState({}) // {tab: url, poi: url}

  const typeTimers = useRef({})
  const progTimer  = useRef(null)
  const storyRef   = useRef('')
  const spdRef     = useRef(1.0)
  const audioRef   = useRef(null)

  useEffect(() => { spdRef.current = spd }, [spd])
  useEffect(() => {
    window.speechSynthesis?.getVoices()
    const h = () => window.speechSynthesis.getVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', h)
    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', h)
      Object.values(typeTimers.current).forEach(clearInterval)
      clearInterval(progTimer.current)
      window.speechSynthesis?.cancel()
    }
  }, [])

  function typewrite(text, setterKey) {
    if (typeTimers.current[setterKey]) clearInterval(typeTimers.current[setterKey])
    if (setterKey === 'poi') { setPoiShown('') }
    else setShown(p=>({...p,[setterKey]:''}))
    const words = text.split(' '); let i=0
    typeTimers.current[setterKey] = setInterval(() => {
      i++
      const chunk = words.slice(0,i).join(' ')
      if (setterKey==='poi') setPoiShown(chunk)
      else setShown(p=>({...p,[setterKey]:chunk}))
      if (i>=words.length) clearInterval(typeTimers.current[setterKey])
    }, 22)
  }

  function stopAudio() {
    clearInterval(progTimer.current)
    try { window.speechSynthesis.cancel() } catch {}
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime=0 }
    setPlaying(false)
  }

  function startBrowserTTS(text, ctx) {
    const synth = window.speechSynthesis
    const ttsTag = LANGS.find(l=>l.value===lang)?.tts||'es-ES'
    const voices = synth.getVoices()
    const voice = voices.find(v=>v.lang===ttsTag)||voices.find(v=>v.lang.startsWith(lang+'-'))||voices.find(v=>v.lang.startsWith(lang))||null
    const parts = text.match(/[^.!?]+[.!?]*/g)||[text]
    const totalSec = (text.split(/\s+/).length/130)*60/spdRef.current
    const t0 = Date.now()
    progTimer.current = setInterval(()=>{
      try{if(synth.paused)synth.resume()}catch{}
      setProgress(Math.min((Date.now()-t0)/1000/totalSec,.99))
    },400)
    let idx=0
    function next(){
      if(idx>=parts.length){clearInterval(progTimer.current);setPlaying(false);setProgress(1);return}
      const u=new SpeechSynthesisUtterance(parts[idx])
      u.rate=spdRef.current;u.pitch=1;u.volume=1;if(voice)u.voice=voice
      u.onend=()=>{idx++;next()}
      u.onerror=e=>{if(e.error!=='interrupted'){clearInterval(progTimer.current);setPlaying(false)}}
      synth.speak(u);idx++
    }
    storyRef.current=text; setAudioCtx(ctx); setPlaying(true); setProgress(0); next()
  }

  async function playWithEL(text, ctx) {
    // Check if we already have audio for this context
    if (audioSrc[ctx]) {
      if (audioRef.current) {
        audioRef.current.src = audioSrc[ctx]
        audioRef.current.playbackRate = spdRef.current
        audioRef.current.play()
        setAudioCtx(ctx); setPlaying(true)
        audioRef.current.ontimeupdate = () => {
          if(audioRef.current) setProgress(audioRef.current.currentTime/audioRef.current.duration)
        }
        audioRef.current.onended = () => { setPlaying(false); setProgress(1) }
      }
      return
    }
    setAudioLoading(true)
    try {
      const url = await elevenLabsTTS(text, EL_KEY)
      setAudioSrc(p=>({...p,[ctx]:url}))
      setAudioLoading(false)
      if (audioRef.current) {
        audioRef.current.src = url
        audioRef.current.playbackRate = spdRef.current
        audioRef.current.play()
        setAudioCtx(ctx); setPlaying(true); setProgress(0)
        audioRef.current.ontimeupdate = () => {
          if(audioRef.current) setProgress(audioRef.current.currentTime/audioRef.current.duration)
        }
        audioRef.current.onended = () => { setPlaying(false); setProgress(1) }
      }
    } catch {
      setAudioLoading(false)
      startBrowserTTS(text, ctx)
    }
  }

  async function toggleAudio(text, ctx) {
    if (playing && audioCtx===ctx) {
      if (EL_KEY && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause(); setPlaying(false)
      } else {
        window.speechSynthesis.pause(); clearInterval(progTimer.current); setPlaying(false)
      }
      return
    }
    if (audioCtx===ctx && !playing) {
      if (EL_KEY && audioRef.current && audioRef.current.paused && audioRef.current.src) {
        audioRef.current.play(); setPlaying(true); return
      }
      if (!EL_KEY && window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
        const totalSec=(storyRef.current.split(/\s+/).length/130)*60/spdRef.current
        const t0=Date.now()-progress*totalSec*1000
        progTimer.current=setInterval(()=>{try{if(window.speechSynthesis.paused)window.speechSynthesis.resume()}catch{}setProgress(Math.min((Date.now()-t0)/1000/totalSec,.99))},400)
        setPlaying(true); return
      }
    }
    stopAudio()
    if (EL_KEY) await playWithEL(text, ctx)
    else startBrowserTTS(text, ctx)
  }

  async function generateTab(tab, place) {
    if (stories[tab] && stories[tab]!=='error') return
    setStories(p=>({...p,[tab]:'loading'}))
    setErr('')
    try {
      const promptFn = PROMPTS[tab]||PROMPTS.history
      const text = await askGroq(promptFn(place), GROQ_KEY, lang)
      setStories(p=>({...p,[tab]:text}))
      typewrite(text, tab)
      setAudioSrc(p=>({...p,[tab]:null})) // reset audio for new story
    } catch {
      setStories(p=>({...p,[tab]:'error'}))
      setErr('Error al generar. Verifica tu API key de Groq.')
    }
  }

  async function detectGPS() {
    if (!navigator.geolocation) { setGpsPhase('error'); setGpsMsg('Tu navegador no soporta GPS.'); return }
    setGpsPhase('detecting'); setGpsMsg('Solicitando permiso...')
    setErr(''); setStories({}); setShown({}); setPois([]); setSelPoi(null)
    setPoiStory(''); setPoiShown(''); setAudioSrc({}); stopAudio()

    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude:lat, longitude:lon } = pos.coords
      setCoords({lat,lon})
      setGpsPhase('scanning'); setGpsMsg('Identificando ubicación y monumentos...')

      const [geoRes, poisRes] = await Promise.allSettled([
        reverseGeocode(lat, lon),
        fetchPOI(lat, lon),
      ])
      const geo = geoRes.status==='fulfilled' ? geoRes.value : { full:'Tu ubicación', city:'Este lugar', neighbourhood:'' }
      const nearby = poisRes.status==='fulfilled' ? poisRes.value : []

      setGeoInfo(geo); setPois(nearby); setGpsPhase('done')
      setGpsMsg(`${geo.neighbourhood ? geo.neighbourhood+', ' : ''}${geo.full} — ${nearby.length} lugares encontrados`)
      setBusy(false)
      await generateTab('history', geo.full)

    }, e => {
      setGpsPhase('error')
      setGpsMsg({1:'Permiso denegado. Actívalo en tu navegador.',2:'No se pudo determinar la posición.',3:'Tiempo agotado.'}[e.code]||'Error de GPS.')
      setBusy(false)
    }, { enableHighAccuracy:true, timeout:15000, maximumAge:0 })

    setBusy(true)
  }

  async function searchManual() {
    const q = cityInput.trim(); if (!q||busy) return
    setErr(''); setStories({}); setShown({}); setPois([]); setSelPoi(null)
    setPoiStory(''); setPoiShown(''); setAudioSrc({}); stopAudio(); setBusy(true)
    const geo = await geocodeName(q)
    setGeoInfo({ full:geo.full, city:geo.city, neighbourhood:'' })
    setGpsMsg(geo.full); setGpsPhase('done')
    if (geo.lat&&geo.lon) {
      setCoords({lat:geo.lat,lon:geo.lon})
      try { const p=await fetchPOI(geo.lat,geo.lon); setPois(p) } catch {}
    }
    await generateTab('history', geo.full)
    setBusy(false)
  }

  async function switchTab(tab) {
    setActiveTab(tab); stopAudio()
    if (tab!=='places' && geoInfo && (!stories[tab]||stories[tab]==='error')) {
      await generateTab(tab, geoInfo.full)
    }
  }

  async function selectPoi(poi) {
    const name=poiName(poi)
    if (selPoi===poi) return
    setSelPoi(poi); stopAudio(); setPoiBusy(true); setPoiStory(''); setPoiShown('')
    setAudioSrc(p=>({...p,poi:null}))
    try {
      const text = await askGroq(PROMPTS.monument(name, poiType(poi), geoInfo?.full||''), GROQ_KEY, lang)
      setPoiStory(text); typewrite(text, 'poi')
    } catch { setErr('Error al narrar el monumento.') }
    setPoiBusy(false)
  }

  const place    = geoInfo?.full||''
  const curStory = activeTab!=='places' ? (stories[activeTab]||'') : ''
  const curShown = activeTab!=='places' ? (shown[activeTab]||'')   : ''
  const curDone  = !!curStory && curStory!=='loading' && curStory!=='error' && curShown===curStory
  const poiDone  = !!poiStory && poiShown===poiStory

  const handleSpeed = (currentStory, ctx) => {
    const o=[0.75,1.0,1.25,1.5]; const next=o[(o.indexOf(spd)+1)%o.length]; setSpd(next)
    if (playing && !EL_KEY) { stopAudio(); setTimeout(()=>startBrowserTTS(currentStory,ctx),100) }
    if (playing && EL_KEY && audioRef.current) { audioRef.current.playbackRate=next }
  }

  return (
    <>
      <style>{`
        @keyframes wtspin  {to{transform:rotate(360deg)}}
        @keyframes wtblink {0%,50%{opacity:1}51%,100%{opacity:0}}
        @keyframes wtpulse {0%,100%{box-shadow:0 0 0 0 rgba(200,150,62,.4)}50%{box-shadow:0 0 0 14px rgba(200,150,62,0)}}
        @keyframes wtfade  {from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(200,150,62,.3);border-radius:2px}
      `}</style>

      <audio ref={audioRef} style={{display:'none'}}/>

      <div style={{fontFamily:'Georgia,serif',background:'#1a1208',minHeight:'100vh',color:'#f5efe0',padding:'1.2rem 1rem 2rem',display:'flex',flexDirection:'column',gap:'.9rem',maxWidth:500,margin:'0 auto'}}>

        {/* Header */}
        <div style={{textAlign:'center',paddingBottom:'1rem',borderBottom:'1px solid rgba(200,150,62,.2)'}}>
          <div style={{fontSize:'2.2rem',fontWeight:300,color:G,letterSpacing:'.12em'}}>🧭 WiseTap</div>
          <div style={{fontFamily:'sans-serif',fontSize:'.58rem',letterSpacing:'.3em',textTransform:'uppercase',color:'rgba(245,239,224,.35)',marginTop:'.2rem'}}>Audioguía histórica con inteligencia artificial</div>
        </div>

        {/* API Key */}
        {!keySaved ? (
          <Card label="🔑 API Key de Groq">
            <p style={{fontFamily:'sans-serif',fontSize:'.73rem',color:'rgba(245,239,224,.65)',lineHeight:1.65,marginBottom:'.85rem'}}>
              Consigue tu key gratuita en <strong style={{color:GL}}>console.groq.com</strong> → API Keys
            </p>
            <div style={{display:'flex',gap:'.5rem'}}>
              <input type="password" placeholder="gsk_..."
                value={keyInput} onChange={e=>setKeyInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&keyInput.trim()&&setKeySaved(true)}
                style={{flex:1,background:'rgba(245,239,224,.07)',border:`1px solid ${G}`,borderRadius:8,color:'#f5efe0',fontFamily:'sans-serif',fontSize:'.82rem',padding:'.65rem .9rem',outline:'none'}}
              />
              <button onClick={()=>keyInput.trim()&&setKeySaved(true)}
                style={{padding:'.65rem 1.1rem',background:`linear-gradient(135deg,${G},${T})`,border:'none',borderRadius:8,color:'#faf6ed',fontFamily:'sans-serif',fontSize:'.75rem',fontWeight:700,cursor:'pointer'}}>
                Guardar
              </button>
            </div>
          </Card>
        ) : (
          <>
            {/* Input mode */}
            <div style={{display:'flex',gap:'.5rem'}}>
              {[['gps','📡 Usar GPS'],['manual','✏️ Escribir ciudad']].map(([t,lbl])=>(
                <button key={t} onClick={()=>setInputMode(t)}
                  style={{flex:1,padding:'.55rem',background:inputMode===t?'rgba(200,150,62,.13)':'rgba(245,239,224,.04)',border:`1px solid ${inputMode===t?'rgba(200,150,62,.5)':'rgba(245,239,224,.1)'}`,borderRadius:9,color:inputMode===t?GL:'rgba(245,239,224,.4)',fontFamily:'sans-serif',fontSize:'.65rem',fontWeight:700,cursor:'pointer'}}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* GPS */}
            {inputMode==='gps' && (
              <Card label="Detección de ubicación">
                <button onClick={detectGPS} disabled={busy}
                  style={{width:'100%',padding:'.85rem',background:busy?'rgba(200,150,62,.3)':`linear-gradient(135deg,${G},${T})`,border:'none',borderRadius:9,color:'#faf6ed',fontFamily:'sans-serif',fontSize:'.75rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',cursor:busy?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'.6rem',animation:gpsPhase==='detecting'||gpsPhase==='scanning'?'wtpulse 2s infinite':''}}>
                  {gpsPhase==='detecting'||gpsPhase==='scanning'?<><Spin/>{gpsPhase==='scanning'?'Buscando monumentos...':'Detectando...'}</>:'📡 Detectar mi ubicación'}
                </button>
                {gpsMsg&&<div style={{marginTop:'.7rem'}}><Pill type={gpsPhase==='error'?'error':gpsPhase==='done'?'ok':'info'}>{gpsPhase==='detecting'||gpsPhase==='scanning'?'⏳ ':gpsPhase==='done'?'📍 ':gpsPhase==='error'?'❌ ':''}{gpsMsg}</Pill></div>}
              </Card>
            )}

            {/* Manual */}
            {inputMode==='manual' && (
              <Card label="Buscar ciudad">
                <div style={{display:'flex',gap:'.5rem'}}>
                  <input type="text" placeholder="Roma, Santiago, Tokio..."
                    value={cityInput} onChange={e=>setCityInput(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&searchManual()}
                    style={{flex:1,background:'rgba(245,239,224,.07)',border:`1px solid ${G}`,borderRadius:8,color:'#f5efe0',fontSize:'1rem',padding:'.6rem .85rem',outline:'none',fontFamily:'Georgia,serif'}}
                  />
                  <button onClick={searchManual} disabled={busy||!cityInput.trim()}
                    style={{padding:'.6rem 1.1rem',background:busy||!cityInput.trim()?'rgba(200,150,62,.3)':`linear-gradient(135deg,${G},${T})`,border:'none',borderRadius:8,color:'#faf6ed',fontFamily:'sans-serif',fontSize:'.75rem',fontWeight:700,cursor:busy||!cityInput.trim()?'not-allowed':'pointer'}}>
                    {busy?<Spin/>:'Ir →'}
                  </button>
                </div>
              </Card>
            )}

            {/* Language selector */}
            {geoInfo && (
              <div style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
                <span style={{fontFamily:'sans-serif',fontSize:'.62rem',color:'rgba(245,239,224,.4)',whiteSpace:'nowrap'}}>Idioma:</span>
                <select value={lang} onChange={e=>{setLang(e.target.value);setStories({});setShown({});setAudioSrc({})}}
                  style={{flex:1,background:'rgba(245,239,224,.06)',border:'1px solid rgba(200,150,62,.22)',borderRadius:8,color:'#f5efe0',fontFamily:'sans-serif',fontSize:'.78rem',padding:'.4rem .7rem',outline:'none',cursor:'pointer'}}>
                  {LANGS.map(l=><option key={l.value} value={l.value} style={{background:'#1a1208'}}>{l.label}</option>)}
                </select>
              </div>
            )}

            {err&&<Pill type="error">❌ {err}</Pill>}

            {/* Content tabs */}
            {geoInfo && (
              <>
                <div style={{display:'flex',gap:'.3rem',overflowX:'auto',paddingBottom:'.1rem'}}>
                  {TABS.map(t=>(
                    <button key={t.key} onClick={()=>switchTab(t.key)}
                      style={{flexShrink:0,padding:'.5rem .75rem',background:activeTab===t.key?'rgba(200,150,62,.15)':'rgba(245,239,224,.04)',border:`1px solid ${activeTab===t.key?'rgba(200,150,62,.5)':'rgba(245,239,224,.1)'}`,borderRadius:9,color:activeTab===t.key?GL:'rgba(245,239,224,.4)',fontFamily:'sans-serif',fontSize:'.63rem',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:'.3rem',whiteSpace:'nowrap'}}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {/* Story tabs */}
                {activeTab!=='places' && (
                  <Card label={`${TABS.find(t=>t.key===activeTab)?.icon} ${TABS.find(t=>t.key===activeTab)?.label} — ${place}`} highlight={curDone}>
                    {stories[activeTab]==='loading'||(!stories[activeTab]&&busy) ? (
                      <div style={{display:'flex',alignItems:'center',gap:'.6rem',color:'rgba(245,239,224,.5)',fontFamily:'sans-serif',fontSize:'.75rem',padding:'.5rem 0'}}>
                        <Spin/> Generando...
                      </div>
                    ) : stories[activeTab]==='error' ? (
                      <Pill type="error">Error. <button onClick={()=>generateTab(activeTab,place)} style={{background:'none',border:'none',color:GL,cursor:'pointer',fontFamily:'sans-serif',fontSize:'.7rem'}}>Reintentar</button></Pill>
                    ) : (
                      <>
                        <div style={{fontFamily:'Georgia,serif',fontSize:'1.05rem',lineHeight:1.9,color:'rgba(245,239,224,.87)',fontWeight:300,marginBottom:curDone?'1rem':0,animation:'wtfade .4s ease'}}>
                          {curShown}
                          {!curDone&&curShown&&<span style={{display:'inline-block',width:2,height:'.9em',background:G,verticalAlign:'middle',marginLeft:2,animation:'wtblink .8s infinite'}}/>}
                        </div>
                        {curDone&&(
                          <Player
                            story={curStory} ctx={activeTab}
                            playing={playing} progress={progress} audioCtx={audioCtx} spd={spd}
                            onToggle={()=>toggleAudio(curStory,activeTab)}
                            onRestart={()=>{stopAudio();setProgress(0);setAudioSrc(p=>({...p,[activeTab]:null}));setTimeout(()=>toggleAudio(curStory,activeTab),150)}}
                            onSpeed={()=>handleSpeed(curStory,activeTab)}
                          />
                        )}
                      </>
                    )}
                  </Card>
                )}

                {/* Monuments tab */}
                {activeTab==='places' && (
                  <>
                    {pois.length===0 ? (
                      <Card>
                        <div style={{fontFamily:'sans-serif',fontSize:'.78rem',color:'rgba(245,239,224,.5)',textAlign:'center',padding:'1rem 0',lineHeight:1.7}}>
                          {coords ? 'No se encontraron monumentos en un radio de 500m.\nIntenta en una zona con más lugares históricos.' : 'Usa el GPS para detectar monumentos cercanos.\nLa búsqueda cubre un radio de 500 metros.'}
                        </div>
                      </Card>
                    ) : (
                      <Card label={`🗺️ ${pois.length} lugares encontrados (radio 500m)`}>
                        <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
                          {pois.map((poi,i)=>(
                            <POICard key={i} poi={poi} selected={selPoi===poi} onSelect={selectPoi}/>
                          ))}
                        </div>
                      </Card>
                    )}

                    {(poiBusy||poiShown) && (
                      <Card label={selPoi?`${poiIcon(selPoi)} ${poiName(selPoi)}`:'🏛️ Monumento'} highlight={poiDone}>
                        {poiBusy ? (
                          <div style={{display:'flex',alignItems:'center',gap:'.6rem',color:'rgba(245,239,224,.5)',fontFamily:'sans-serif',fontSize:'.75rem',padding:'.5rem 0'}}>
                            <Spin/> Narrando historia...
                          </div>
                        ) : (
                          <>
                            <div style={{fontFamily:'Georgia,serif',fontSize:'1.05rem',lineHeight:1.9,color:'rgba(245,239,224,.87)',fontWeight:300,marginBottom:poiDone?'1rem':0,animation:'wtfade .4s ease'}}>
                              {poiShown}
                              {!poiDone&&poiShown&&<span style={{display:'inline-block',width:2,height:'.9em',background:G,verticalAlign:'middle',marginLeft:2,animation:'wtblink .8s infinite'}}/>}
                            </div>
                            {poiDone&&(
                              <Player
                                story={poiStory} ctx="poi"
                                playing={playing} progress={progress} audioCtx={audioCtx} spd={spd}
                                onToggle={()=>toggleAudio(poiStory,'poi')}
                                onRestart={()=>{stopAudio();setProgress(0);setAudioSrc(p=>({...p,poi:null}));setTimeout(()=>toggleAudio(poiStory,'poi'),150)}}
                                onSpeed={()=>handleSpeed(poiStory,'poi')}
                              />
                            )}
                          </>
                        )}
                      </Card>
                    )}
                  </>
                )}
              </>
            )}

            <button onClick={()=>{setKeySaved(false);setKeyInput('')}}
              style={{fontFamily:'sans-serif',fontSize:'.6rem',background:'none',border:'none',color:'rgba(245,239,224,.2)',cursor:'pointer',textDecoration:'underline',textAlign:'center'}}>
              Cambiar API key
            </button>
          </>
        )}

        <div style={{textAlign:'center',fontFamily:'sans-serif',fontSize:'.55rem',letterSpacing:'.15em',textTransform:'uppercase',color:'rgba(245,239,224,.15)',paddingTop:'.25rem'}}>
          WiseTap v3 · Groq{EL_KEY?' + ElevenLabs':''} AI
        </div>
      </div>
    </>
  )
}
