import { useState, useRef, useEffect } from 'react'

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
  es: "Eres un guia turistico experto. REGLAS ESTRICTAS: 1) Responde SIEMPRE en español, sin excepciones. 2) Nunca uses palabras en ingles ni en otro idioma. Si algo se llama city di ciudad, si se llama tour di recorrido. 3) Sin metaforas, sin frases poeticas. 4) Solo datos concretos, fechas, nombres y hechos reales. 5) Tono claro, directo y ameno.",
  en: "You are an expert tour guide. STRICT RULES: 1) Always respond in English, no exceptions. 2) Never use words in other languages. 3) No metaphors, no poetic language. 4) Only concrete facts, dates, names and real events. 5) Clear, direct and engaging tone.",
  fr: "Tu es un guide touristique expert. REGLES STRICTES: 1) Reponds TOUJOURS en francais, sans exception. 2) Pas de mots dans d'autres langues. 3) Pas de metaphores ni de langage poetique. 4) Uniquement des faits concrets et dates reelles. 5) Ton clair et direct.",
  it: "Sei una guida turistica esperta. REGOLE STRETTE: 1) Rispondi SEMPRE in italiano, senza eccezioni. 2) Niente parole in altre lingue. 3) Niente metafore o linguaggio poetico. 4) Solo fatti concreti, date e eventi reali. 5) Tono chiaro e diretto.",
  pt: "Voce e um guia turistico especialista. REGRAS ESTRITAS: 1) Responda SEMPRE em portugues, sem excecoes. 2) Nunca use palavras em outros idiomas. 3) Sem metaforas ou linguagem poetica. 4) Apenas fatos concretos, datas e eventos reais. 5) Tom claro e direto.",
}

const LANG_NAMES = { es:'español', en:'English', fr:'français', it:'italiano', pt:'português' }
const PROMPTS = {
  history: (place, lang) =>
    `Lugar: ${place}.
Narra la historia de este lugar en 350-400 palabras en ${LANG_NAMES[lang]||'español'}:
- Cuándo fue fundado, por quién y en qué contexto histórico
- Los hechos y eventos históricos más importantes, con fechas concretas
- Los personajes históricos relevantes ligados al lugar
- Cómo evolucionó con el tiempo hasta hoy
- Su importancia actual
IMPORTANTE: Sin introducción genérica. Empieza directamente con el primer dato histórico. TODO el texto en ${LANG_NAMES[lang]||'español'}, sin palabras en otros idiomas.`,

  legends: (place, lang) =>
    `Lugar: ${place}.
Cuenta las leyendas y relatos populares de este lugar en 350-400 palabras en ${LANG_NAMES[lang]||'español'}:
- La leyenda más famosa del lugar, contada con detalle
- Otros relatos populares, mitos o supersticiones locales
- El origen conocido de estas historias
- Por qué estas leyendas siguen siendo parte de la cultura local
IMPORTANTE: Deja claro que son relatos populares, no hechos históricos. Empieza directamente con la primera leyenda. TODO en ${LANG_NAMES[lang]||'español'}, sin palabras en otros idiomas.`,

  food: (place, lang) =>
    `Lugar: ${place}.
Describe la gastronomía típica de este lugar en 350-400 palabras en ${LANG_NAMES[lang]||'español'}:
- Los 4-5 platos más representativos, con sus ingredientes principales y cómo se preparan
- Las bebidas típicas de la región
- Los postres o dulces tradicionales
- En qué ocasiones o lugares se suelen comer estos platos
- Una curiosidad gastronómica del lugar
IMPORTANTE: Información práctica y concreta. Sin metáforas sobre sabores. Empieza directamente con el primer plato. TODO en ${LANG_NAMES[lang]||'español'}, sin palabras en otros idiomas.`,

  monument: (place, type, city, lang) =>
    `Lugar: ${place}. Tipo: ${type}. Ciudad: ${city}.
Narra la historia completa en 350-400 palabras en ${LANG_NAMES[lang]||'español'}:
- Cuándo fue construido o creado, por quién y con qué propósito
- Los eventos o personajes históricos más importantes ligados a él, con fechas
- Sus características arquitectónicas, artísticas o culturales más destacadas
- Cómo ha cambiado o sido restaurado con el tiempo
- Por qué es importante visitarlo hoy y qué puede ver el turista
IMPORTANTE: Empieza directamente con los datos del lugar. Sin introducción genérica. TODO en ${LANG_NAMES[lang]||'español'}, sin palabras en otros idiomas.`,

  famous: (city, lang) => {
    const instrucciones = {
      es: `Lista los 8 monumentos, museos, plazas e iglesias más importantes de: ${city}. Devuelve SOLO este JSON sin texto adicional ni comillas de código:\n[{"name":"Nombre en español","type":"Tipo en español","icon":"emoji","description":"Una frase en español"}]`,
      en: `List the 8 most important monuments, museums, squares and churches of: ${city}. Return ONLY this JSON with no extra text or code quotes:\n[{"name":"Name in English","type":"Type in English","icon":"emoji","description":"One sentence in English"}]`,
      fr: `Liste les 8 monuments, musées, places et églises les plus importants de: ${city}. Retourne UNIQUEMENT ce JSON sans texte ni guillemets de code:\n[{"name":"Nom en français","type":"Type en français","icon":"emoji","description":"Une phrase en français"}]`,
      it: `Elenca gli 8 monumenti, musei, piazze e chiese più importanti di: ${city}. Restituisci SOLO questo JSON senza testo né virgolette di codice:\n[{"name":"Nome in italiano","type":"Tipo in italiano","icon":"emoji","description":"Una frase in italiano"}]`,
      pt: `Liste os 8 monumentos, museus, praças e igrejas mais importantes de: ${city}. Retorne APENAS este JSON sem texto nem aspas de código:\n[{"name":"Nome em português","type":"Tipo em português","icon":"emoji","description":"Uma frase em português"}]`,
    }
    return instrucciones[lang] || instrucciones.es
  },
}

const G='#c8963e', GL='#e8b96a', T='#b05c3a'
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || ''
const EL_KEY   = import.meta.env.VITE_ELEVENLABS_KEY || ''
const EL_VOICE = 'pNInz6obpgDQGcFmaJgB' // Adam — deep male voice

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

async function getFamousPlaces(city, key, lang) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
    body: JSON.stringify({
      model:'llama-3.3-70b-versatile',
      messages:[
        { role:'system', content:'Eres un experto en turismo mundial. Responde SOLO con JSON válido, sin texto adicional, sin backticks, sin markdown.' },
        { role:'user',   content: PROMPTS.famous(city, lang) },
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
    if (!d.length) return { full:name, city:name }
    const a = d[0].address||{}
    const city = a.city||a.town||a.village||a.municipality||name
    return { city, full:[city,a.state,a.country].filter(Boolean).join(', ') }
  } catch { return { full:name, city:name } }
}

// ─── UI Components ────────────────────────────────────────
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

function Pill({type='info', children}) {
  const s={
    info: {bg:'rgba(200,150,62,.08)',border:'rgba(200,150,62,.2)',color:'rgba(245,239,224,.65)'},
    ok:   {bg:'rgba(90,122,94,.12)', border:'rgba(90,122,94,.3)', color:'#a8d8a8'},
    error:{bg:'rgba(176,92,58,.12)', border:'rgba(176,92,58,.35)',color:'#e8a8a8'},
  }[type]||{}
  return <div style={{padding:'.55rem .85rem',borderRadius:9,fontFamily:'sans-serif',fontSize:'.7rem',lineHeight:1.55,background:s.bg,border:`1px solid ${s.border}`,color:s.color}}>{children}</div>
}

function PlaceCard({place, onSelect, selected}) {
  return (
    <button onClick={()=>onSelect(place)}
      style={{width:'100%',textAlign:'left',padding:'.75rem .9rem',background:selected?'rgba(200,150,62,.15)':'rgba(245,239,224,.03)',border:`1px solid ${selected?'rgba(200,150,62,.5)':'rgba(245,239,224,.08)'}`,borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',gap:'.75rem',transition:'all .2s'}}>
      <span style={{fontSize:'1.5rem',flexShrink:0}}>{place.icon||'🏛️'}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:'Georgia,serif',fontSize:'.95rem',color:selected?GL:'#f5efe0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{place.name}</div>
        <div style={{fontFamily:'sans-serif',fontSize:'.62rem',color:'rgba(245,239,224,.4)',marginTop:'.12rem'}}>{place.type} {place.description ? '· '+place.description : ''}</div>
      </div>
    </button>
  )
}

function Player({ctx, playing, progress, audioCtx, spd, onToggle, onRestart, onSpeed, audioLoading}) {
  const isActive = audioCtx===ctx
  return (
    <>
      <div style={{height:1,background:'rgba(200,150,62,.15)',marginBottom:'1rem'}}/>
      {EL_KEY && (
        <div style={{display:'flex',alignItems:'center',gap:'.4rem',marginBottom:'.6rem'}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:'#10b981'}}/>
          <span style={{fontFamily:'sans-serif',fontSize:'.62rem',color:'#10b981',fontWeight:500}}>Voz ElevenLabs — Adam</span>
        </div>
      )}
      <div style={{display:'flex',alignItems:'center',gap:'.9rem'}}>
        <button onClick={onToggle} disabled={audioLoading}
          style={{width:52,height:52,borderRadius:'50%',background:`linear-gradient(135deg,${G},${T})`,border:'none',cursor:audioLoading?'wait':'pointer',fontSize:'1.2rem',flexShrink:0,boxShadow:'0 4px 16px rgba(200,150,62,.4)',display:'flex',alignItems:'center',justifyContent:'center',animation:playing&&isActive?'wtpulse 2s infinite':''}}>
          {audioLoading&&isActive ? <Spin size={20}/> : playing&&isActive ? '⏸️' : '▶️'}
        </button>
        <div style={{flex:1}}>
          <div style={{height:4,background:'rgba(200,150,62,.15)',borderRadius:2,overflow:'hidden',marginBottom:'.35rem'}}>
            <div style={{height:'100%',background:`linear-gradient(90deg,${G},${GL})`,width:isActive?(progress*100)+'%':'0%',transition:'width .4s linear'}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontFamily:'sans-serif',fontSize:'.6rem',color:'rgba(245,239,224,.3)'}}>
            <span>{isActive?Math.round(progress*100):0}%</span>
            <span style={{color:audioLoading&&isActive?'#d0c080':playing&&isActive?'#a0d0a0':isActive&&progress>0?'#d0c080':'rgba(245,239,224,.3)'}}>
              {audioLoading&&isActive?'⏳ generando audio...':playing&&isActive?'🔊 reproduciendo':isActive&&progress>0?'⏸ pausado':'toca ▶ para escuchar'}
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
        <button onClick={onSpeed} style={{fontFamily:'sans-serif',fontSize:'.62rem',fontWeight:700,background:'rgba(200,150,62,.1)',border:'1px solid rgba(200,150,62,.28)',color:G,padding:'.22rem .65rem',borderRadius:20,cursor:'pointer'}}>{spd}× velocidad</button>
        <button onClick={onRestart} style={{fontFamily:'sans-serif',fontSize:'.62rem',background:'none',border:'none',color:'rgba(245,239,224,.35)',cursor:'pointer'}}>↺ Reiniciar</button>
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

  const [stories,   setStories]   = useState({})
  const [shown,     setShown]     = useState({})

  // Famous places from AI
  const [places,      setPlaces]      = useState([])
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  const [selPlace,    setSelPlace]    = useState(null)
  const [placeStory,  setPlaceStory]  = useState('')
  const [placeShown,  setPlaceShown]  = useState('')
  const [placeBusy,   setPlaceBusy]   = useState(false)

  const [err,          setErr]         = useState('')
  const [playing,      setPlaying]     = useState(false)
  const [progress,     setProgress]    = useState(0)
  const [spd,          setSpd]         = useState(1.0)
  const [audioCtx,     setAudioCtx]    = useState(null)
  const [audioLoading, setAudioLoading]= useState(false)
  const [audioUrls,    setAudioUrls]   = useState({})

  const typeTimers = useRef({})
  const progTimer  = useRef(null)
  const storyRef   = useRef('')
  const spdRef     = useRef(1.0)
  const audioRef   = useRef(null)

  useEffect(()=>{ spdRef.current = spd },[spd])
  useEffect(()=>{
    window.speechSynthesis?.getVoices()
    const h=()=>window.speechSynthesis.getVoices()
    window.speechSynthesis?.addEventListener('voiceschanged',h)
    return()=>{
      window.speechSynthesis?.removeEventListener('voiceschanged',h)
      Object.values(typeTimers.current).forEach(clearInterval)
      clearInterval(progTimer.current)
      window.speechSynthesis?.cancel()
    }
  },[])

  // ── Typewriter ─────────────────────────────────────────
  function typewrite(text, key) {
    if (typeTimers.current[key]) clearInterval(typeTimers.current[key])
    if (key==='place') setPlaceShown('')
    else setShown(p=>({...p,[key]:''}))
    const words=text.split(' '); let i=0
    typeTimers.current[key]=setInterval(()=>{
      i++; const chunk=words.slice(0,i).join(' ')
      if (key==='place') setPlaceShown(chunk)
      else setShown(p=>({...p,[key]:chunk}))
      if (i>=words.length) clearInterval(typeTimers.current[key])
    },22)
  }

  // ── Audio ──────────────────────────────────────────────
  function stopAudio() {
    clearInterval(progTimer.current)
    try { window.speechSynthesis.cancel() } catch {}
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime=0 }
    setPlaying(false)
  }

  function startBrowserTTS(text, ctx) {
    const synth=window.speechSynthesis
    const ttsTag=LANGS.find(l=>l.value===lang)?.tts||'es-ES'
    const voices=synth.getVoices()
    const voice=voices.find(v=>v.lang===ttsTag)||voices.find(v=>v.lang.startsWith(lang+'-'))||voices.find(v=>v.lang.startsWith(lang))||null
    const parts=text.match(/[^.!?]+[.!?]*/g)||[text]
    const totalSec=(text.split(/\s+/).length/130)*60/spdRef.current
    const t0=Date.now()
    progTimer.current=setInterval(()=>{try{if(synth.paused)synth.resume()}catch{};setProgress(Math.min((Date.now()-t0)/1000/totalSec,.99))},400)
    let idx=0
    function next(){
      if(idx>=parts.length){clearInterval(progTimer.current);setPlaying(false);setProgress(1);return}
      const u=new SpeechSynthesisUtterance(parts[idx]);u.rate=spdRef.current;u.pitch=1;u.volume=1;if(voice)u.voice=voice
      u.onend=()=>{idx++;next()};u.onerror=e=>{if(e.error!=='interrupted'){clearInterval(progTimer.current);setPlaying(false)}}
      synth.speak(u);idx++
    }
    storyRef.current=text; setAudioCtx(ctx); setPlaying(true); setProgress(0); next()
  }

  async function playEL(text, ctx) {
    if (audioUrls[ctx]) {
      if (audioRef.current) {
        audioRef.current.src=audioUrls[ctx]; audioRef.current.playbackRate=spdRef.current
        audioRef.current.play(); setAudioCtx(ctx); setPlaying(true)
        audioRef.current.ontimeupdate=()=>{ if(audioRef.current) setProgress(audioRef.current.currentTime/audioRef.current.duration) }
        audioRef.current.onended=()=>{ setPlaying(false); setProgress(1) }
      }
      return
    }
    setAudioLoading(true); setAudioCtx(ctx)
    try {
      const url=await elevenLabsTTS(text, EL_KEY)
      setAudioUrls(p=>({...p,[ctx]:url})); setAudioLoading(false)
      if (audioRef.current) {
        audioRef.current.src=url; audioRef.current.playbackRate=spdRef.current
        audioRef.current.play(); setPlaying(true); setProgress(0)
        audioRef.current.ontimeupdate=()=>{ if(audioRef.current) setProgress(audioRef.current.currentTime/audioRef.current.duration) }
        audioRef.current.onended=()=>{ setPlaying(false); setProgress(1) }
      }
    } catch { setAudioLoading(false); startBrowserTTS(text,ctx) }
  }

  async function toggleAudio(text, ctx) {
    if (playing&&audioCtx===ctx) {
      if (EL_KEY&&audioRef.current&&!audioRef.current.paused) { audioRef.current.pause(); setPlaying(false) }
      else { window.speechSynthesis.pause(); clearInterval(progTimer.current); setPlaying(false) }
      return
    }
    if (!playing&&audioCtx===ctx) {
      if (EL_KEY&&audioRef.current?.paused&&audioRef.current?.src) { audioRef.current.play(); setPlaying(true); return }
      if (!EL_KEY&&window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
        const totalSec=(storyRef.current.split(/\s+/).length/130)*60/spdRef.current
        const t0=Date.now()-progress*totalSec*1000
        progTimer.current=setInterval(()=>{try{if(window.speechSynthesis.paused)window.speechSynthesis.resume()}catch{};setProgress(Math.min((Date.now()-t0)/1000/totalSec,.99))},400)
        setPlaying(true); return
      }
    }
    stopAudio()
    if (EL_KEY) await playEL(text,ctx)
    else startBrowserTTS(text,ctx)
  }

  // ── Generate story ─────────────────────────────────────
  async function generateTab(tab, place) {
    if (stories[tab]&&stories[tab]!=='error') return
    setStories(p=>({...p,[tab]:'loading'})); setErr('')
    try {
      const text=await askGroq(PROMPTS[tab](place, lang), GROQ_KEY, lang)
      setStories(p=>({...p,[tab]:text})); typewrite(text,tab)
      setAudioUrls(p=>({...p,[tab]:null}))
    } catch { setStories(p=>({...p,[tab]:'error'})); setErr('Error al generar.') }
  }

  // ── Load famous places from AI ─────────────────────────
  async function loadFamousPlaces(city) {
    setLoadingPlaces(true); setPlaces([])
    try {
      const list=await getFamousPlaces(city, GROQ_KEY, lang)
      setPlaces(list)
    } catch { setPlaces([]) }
    setLoadingPlaces(false)
  }

  // ── GPS ────────────────────────────────────────────────
  async function detectGPS() {
    if (!navigator.geolocation) { setGpsPhase('error'); setGpsMsg('Tu navegador no soporta GPS.'); return }
    setGpsPhase('detecting'); setGpsMsg('Solicitando permiso...')
    setErr(''); setStories({}); setShown({}); setPlaces([]); setSelPlace(null)
    setPlaceStory(''); setPlaceShown(''); setAudioUrls({}); stopAudio(); setBusy(true)

    navigator.geolocation.getCurrentPosition(async pos=>{
      const{latitude:lat,longitude:lon}=pos.coords
      setGpsPhase('scanning'); setGpsMsg('Identificando tu ubicación...')
      try {
        const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,{headers:{'Accept-Language':'es'}})
        const d=await r.json(); const a=d.address||{}
        const city=a.city||a.town||a.village||a.municipality||a.county||'Tu ubicación'
        const geo={city,neighbourhood:a.suburb||a.neighbourhood||'',state:a.state||'',country:a.country||'',full:[city,a.state,a.country].filter(Boolean).join(', ')}
        setGeoInfo(geo); setGpsPhase('done')
        setGpsMsg(`📍 ${geo.neighbourhood?geo.neighbourhood+', ':''}${geo.full}`)
        await generateTab('history',geo.full)
        loadFamousPlaces(geo.city)
      } catch {
        setGpsPhase('error'); setGpsMsg('No se pudo identificar el lugar.')
      }
      setBusy(false)
    },e=>{
      setGpsPhase('error')
      setGpsMsg({1:'Permiso denegado. Actívalo en tu navegador.',2:'No se pudo determinar la posición.',3:'Tiempo agotado.'}[e.code]||'Error de GPS.')
      setBusy(false)
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0})
  }

  // ── Manual search ──────────────────────────────────────
  async function searchManual() {
    const q=cityInput.trim(); if(!q||busy) return
    setErr(''); setStories({}); setShown({}); setPlaces([]); setSelPlace(null)
    setPlaceStory(''); setPlaceShown(''); setAudioUrls({}); stopAudio(); setBusy(true)
    const geo=await geocodeName(q)
    setGeoInfo({full:geo.full,city:geo.city,neighbourhood:''})
    setGpsMsg(`📍 ${geo.full}`); setGpsPhase('done')
    await generateTab('history',geo.full)
    loadFamousPlaces(geo.city)
    setBusy(false)
  }

  // ── Switch tab ─────────────────────────────────────────
  async function switchTab(tab) {
    setActiveTab(tab); stopAudio()
    if (tab!=='places'&&geoInfo&&(!stories[tab]||stories[tab]==='error')) {
      await generateTab(tab,geoInfo.full)
    }
  }

  // ── Select place ───────────────────────────────────────
  async function selectPlace(place) {
    if (selPlace?.name===place.name) return
    setSelPlace(place); stopAudio(); setPlaceBusy(true); setPlaceStory(''); setPlaceShown('')
    setAudioUrls(p=>({...p,place:null}))
    try {
      const text=await askGroq(PROMPTS.monument(place.name, place.type, geoInfo?.city||'', lang), GROQ_KEY, lang)
      setPlaceStory(text); typewrite(text,'place')
    } catch { setErr('Error al narrar el monumento.') }
    setPlaceBusy(false)
  }

  const place    = geoInfo?.full||''
  const curStory = activeTab!=='places'?(stories[activeTab]||''):''
  const curShown = activeTab!=='places'?(shown[activeTab]||''):''
  const curDone  = !!curStory&&curStory!=='loading'&&curStory!=='error'&&curShown===curStory
  const placeDone= !!placeStory&&placeShown===placeStory

  return (
    <>
      <style>{`
        @keyframes wtspin{to{transform:rotate(360deg)}}
        @keyframes wtblink{0%,50%{opacity:1}51%,100%{opacity:0}}
        @keyframes wtpulse{0%,100%{box-shadow:0 0 0 0 rgba(200,150,62,.4)}50%{box-shadow:0 0 0 14px rgba(200,150,62,0)}}
        @keyframes wtfade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
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

        {/* API Key screen */}
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
            {inputMode==='gps'&&(
              <Card label="Detección de ubicación">
                <button onClick={detectGPS} disabled={busy}
                  style={{width:'100%',padding:'.85rem',background:busy?'rgba(200,150,62,.3)':`linear-gradient(135deg,${G},${T})`,border:'none',borderRadius:9,color:'#faf6ed',fontFamily:'sans-serif',fontSize:'.75rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',cursor:busy?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'.6rem',animation:gpsPhase==='detecting'||gpsPhase==='scanning'?'wtpulse 2s infinite':''}}>
                  {gpsPhase==='detecting'||gpsPhase==='scanning'?<><Spin/>{gpsPhase==='scanning'?'Identificando...':'Detectando...'}</>:'📡 Detectar mi ubicación'}
                </button>
                {gpsMsg&&<div style={{marginTop:'.7rem'}}><Pill type={gpsPhase==='error'?'error':gpsPhase==='done'?'ok':'info'}>{gpsPhase==='detecting'||gpsPhase==='scanning'?'⏳ ':''}{gpsMsg}</Pill></div>}
              </Card>
            )}

            {/* Manual */}
            {inputMode==='manual'&&(
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

            {/* Language */}
            {geoInfo&&(
              <div style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
                <span style={{fontFamily:'sans-serif',fontSize:'.62rem',color:'rgba(245,239,224,.4)',whiteSpace:'nowrap'}}>Idioma:</span>
                <select value={lang} onChange={e=>{setLang(e.target.value);setStories({});setShown({});setPlaces([]);setAudioUrls({})}}
                  style={{flex:1,background:'rgba(245,239,224,.06)',border:'1px solid rgba(200,150,62,.22)',borderRadius:8,color:'#f5efe0',fontFamily:'sans-serif',fontSize:'.78rem',padding:'.4rem .7rem',outline:'none',cursor:'pointer'}}>
                  {LANGS.map(l=><option key={l.value} value={l.value} style={{background:'#1a1208'}}>{l.label}</option>)}
                </select>
              </div>
            )}

            {err&&<Pill type="error">❌ {err}</Pill>}

            {/* Content */}
            {geoInfo&&(
              <>
                {/* Tab bar */}
                <div style={{display:'flex',gap:'.3rem',overflowX:'auto',paddingBottom:'.1rem'}}>
                  {TABS.map(t=>(
                    <button key={t.key} onClick={()=>switchTab(t.key)}
                      style={{flexShrink:0,padding:'.5rem .75rem',background:activeTab===t.key?'rgba(200,150,62,.15)':'rgba(245,239,224,.04)',border:`1px solid ${activeTab===t.key?'rgba(200,150,62,.5)':'rgba(245,239,224,.1)'}`,borderRadius:9,color:activeTab===t.key?GL:'rgba(245,239,224,.4)',fontFamily:'sans-serif',fontSize:'.63rem',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:'.3rem',whiteSpace:'nowrap'}}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {/* Story tabs */}
                {activeTab!=='places'&&(
                  <Card label={`${TABS.find(t=>t.key===activeTab)?.icon} ${TABS.find(t=>t.key===activeTab)?.label} — ${place}`} highlight={curDone}>
                    {stories[activeTab]==='loading'||(!stories[activeTab]&&busy)?(
                      <div style={{display:'flex',alignItems:'center',gap:'.6rem',color:'rgba(245,239,224,.5)',fontFamily:'sans-serif',fontSize:'.75rem',padding:'.5rem 0'}}><Spin/> Generando...</div>
                    ):stories[activeTab]==='error'?(
                      <Pill type="error">Error. <button onClick={()=>generateTab(activeTab,place)} style={{background:'none',border:'none',color:GL,cursor:'pointer',fontFamily:'sans-serif',fontSize:'.7rem'}}>Reintentar</button></Pill>
                    ):(
                      <>
                        <div style={{fontFamily:'Georgia,serif',fontSize:'1.05rem',lineHeight:1.9,color:'rgba(245,239,224,.87)',fontWeight:300,marginBottom:curDone?'1rem':0,animation:'wtfade .4s ease'}}>
                          {curShown}
                          {!curDone&&curShown&&<span style={{display:'inline-block',width:2,height:'.9em',background:G,verticalAlign:'middle',marginLeft:2,animation:'wtblink .8s infinite'}}/>}
                        </div>
                        {curDone&&(
                          <Player ctx={activeTab} playing={playing} progress={progress} audioCtx={audioCtx} spd={spd} audioLoading={audioLoading}
                            onToggle={()=>toggleAudio(curStory,activeTab)}
                            onRestart={()=>{stopAudio();setProgress(0);setAudioUrls(p=>({...p,[activeTab]:null}));setTimeout(()=>toggleAudio(curStory,activeTab),150)}}
                            onSpeed={()=>{const o=[0.75,1.0,1.25,1.5];const next=o[(o.indexOf(spd)+1)%o.length];setSpd(next);if(playing&&EL_KEY&&audioRef.current)audioRef.current.playbackRate=next;else if(playing){stopAudio();setTimeout(()=>startBrowserTTS(curStory,activeTab),100)}}}
                          />
                        )}
                      </>
                    )}
                  </Card>
                )}

                {/* Monuments tab */}
                {activeTab==='places'&&(
                  <>
                    <Card label={`⭐ Monumentos principales de ${geoInfo.city}`}>
                      {loadingPlaces?(
                        <div style={{display:'flex',alignItems:'center',gap:'.6rem',color:'rgba(245,239,224,.5)',fontFamily:'sans-serif',fontSize:'.75rem',padding:'.5rem 0'}}><Spin/> Buscando los lugares más importantes...</div>
                      ):places.length===0?(
                        <div style={{fontFamily:'sans-serif',fontSize:'.78rem',color:'rgba(245,239,224,.4)',padding:'.5rem 0'}}>No se encontraron lugares. Intenta de nuevo.</div>
                      ):(
                        <div style={{display:'flex',flexDirection:'column',gap:'.4rem'}}>
                          {places.map((p,i)=>(
                            <PlaceCard key={i} place={p} selected={selPlace?.name===p.name} onSelect={selectPlace}/>
                          ))}
                        </div>
                      )}
                    </Card>

                    {(placeBusy||placeShown)&&(
                      <Card label={selPlace?`${selPlace.icon||'🏛️'} ${selPlace.name}`:'🏛️ Monumento'} highlight={placeDone}>
                        {placeBusy?(
                          <div style={{display:'flex',alignItems:'center',gap:'.6rem',color:'rgba(245,239,224,.5)',fontFamily:'sans-serif',fontSize:'.75rem',padding:'.5rem 0'}}><Spin/> Narrando historia...</div>
                        ):(
                          <>
                            <div style={{fontFamily:'Georgia,serif',fontSize:'1.05rem',lineHeight:1.9,color:'rgba(245,239,224,.87)',fontWeight:300,marginBottom:placeDone?'1rem':0,animation:'wtfade .4s ease'}}>
                              {placeShown}
                              {!placeDone&&placeShown&&<span style={{display:'inline-block',width:2,height:'.9em',background:G,verticalAlign:'middle',marginLeft:2,animation:'wtblink .8s infinite'}}/>}
                            </div>
                            {placeDone&&(
                              <Player ctx="place" playing={playing} progress={progress} audioCtx={audioCtx} spd={spd} audioLoading={audioLoading}
                                onToggle={()=>toggleAudio(placeStory,'place')}
                                onRestart={()=>{stopAudio();setProgress(0);setAudioUrls(p=>({...p,place:null}));setTimeout(()=>toggleAudio(placeStory,'place'),150)}}
                                onSpeed={()=>{const o=[0.75,1.0,1.25,1.5];const next=o[(o.indexOf(spd)+1)%o.length];setSpd(next);if(playing&&EL_KEY&&audioRef.current)audioRef.current.playbackRate=next;else if(playing){stopAudio();setTimeout(()=>startBrowserTTS(placeStory,'place'),100)}}}
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
