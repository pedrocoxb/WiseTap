import { useState, useRef, useEffect } from 'react'
import { fetchNearbyPOI, poiName, poiIcon, poiType } from './poi.js'

const MODES = [
  { key:'history', icon:'🏛️', label:'Historia' },
  { key:'culture', icon:'🎭', label:'Cultura'  },
  { key:'legends', icon:'✨', label:'Leyendas' },
  { key:'food',    icon:'🍽️', label:'Gastro'   },
]
const LANGS = [
  { value:'es', label:'🌍 Español',   tts:'es-ES' },
  { value:'en', label:'🌐 English',   tts:'en-US' },
  { value:'fr', label:'🗼 Français',  tts:'fr-FR' },
  { value:'it', label:'🏛️ Italiano',  tts:'it-IT' },
  { value:'pt', label:'🎶 Português', tts:'pt-BR' },
]
const TEMA = {
  history:{ es:'historia y origen histórico',          en:'history and origin', fr:'histoire', it:'storia',      pt:'história'    },
  culture:{ es:'cultura, costumbres y vida cotidiana', en:'culture',            fr:'culture',  it:'cultura',     pt:'cultura'     },
  legends:{ es:'leyendas, mitos y relatos populares',  en:'legends and myths',  fr:'légendes', it:'leggende',    pt:'lendas'      },
  food:   { es:'gastronomía y platos típicos',         en:'gastronomy',         fr:'gastronomie',it:'gastronomia',pt:'gastronomia' },
}
const SYS_LANG = {
  es:'Responde completamente en español.',
  en:'Respond entirely in English.',
  fr:'Réponds entièrement en français.',
  it:'Rispondi interamente in italiano.',
  pt:'Responda inteiramente em português.',
}
const CHIPS = [
  { key:'curiosidades', icon:'🔍', label:'Curiosidades', prompt:'curiosidades y datos sorprendentes poco conocidos'  },
  { key:'arquitectura', icon:'🏗️', label:'Arquitectura', prompt:'arquitectura, estilo y detalles constructivos'      },
  { key:'personajes',   icon:'👑', label:'Personajes',   prompt:'personajes históricos famosos ligados a este lugar'  },
  { key:'visitar',      icon:'🗺️', label:'Qué ver cerca', prompt:'los lugares más imperdibles para visitar cerca'    },
]

const G='#c8963e', GL='#e8b96a', T='#b05c3a'
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || ''

// ─── Geo helpers ──────────────────────────────────────────
async function reverseGeocode(lat, lon) {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
    { headers:{ 'Accept-Language':'es' } }
  )
  const d = await r.json()
  const a = d.address || {}
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

// ─── Groq API ─────────────────────────────────────────────
async function askGroq(prompt, key) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 900,
      temperature: 0.8,
    }),
  })
  if (!r.ok) {
    const errText = await r.text()
    throw new Error('Groq API ' + r.status + ': ' + errText)
  }
  const d = await r.json()
  return d.choices?.[0]?.message?.content || ''
}

// ─── UI helpers ───────────────────────────────────────────
function Spin({size=14}) {
  return <span style={{display:'inline-block',width:size,height:size,border:'2px solid rgba(255,255,255,.25)',borderTopColor:'#fff',borderRadius:'50%',animation:'wtspin .7s linear infinite',verticalAlign:'middle',flexShrink:0}}/>
}
function Card({label, children, highlight=false}) {
  return (
    <div style={{background:highlight?'rgba(200,150,62,.07)':'rgba(245,239,224,.04)',border:`1px solid ${highlight?'rgba(200,150,62,.4)':'rgba(200,150,62,.2)'}`,borderRadius:14,padding:'1.1rem',position:'relative',overflow:'hidden'}}>
      {highlight && <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${G},transparent)`}}/>}
      {label && <div style={{fontFamily:'sans-serif',fontSize:'.58rem',fontWeight:700,letterSpacing:'.26em',textTransform:'uppercase',color:G,marginBottom:'.7rem',display:'flex',alignItems:'center',gap:'.5rem'}}>{label}<span style={{flex:1,height:1,background:'rgba(200,150,62,.18)'}}/></div>}
      {children}
    </div>
  )
}
function Pill({type='info', children}) {
  const s={info:{bg:'rgba(200,150,62,.08)',border:'rgba(200,150,62,.2)',color:'rgba(245,239,224,.65)'},ok:{bg:'rgba(90,122,94,.12)',border:'rgba(90,122,94,.3)',color:'#a8d8a8'},error:{bg:'rgba(176,92,58,.12)',border:'rgba(176,92,58,.35)',color:'#e8a8a8'}}[type]||{}
  return <div style={{padding:'.55rem .85rem',borderRadius:9,fontFamily:'sans-serif',fontSize:'.7rem',lineHeight:1.55,background:s.bg,border:`1px solid ${s.border}`,color:s.color}}>{children}</div>
}
function POICard({poi, onSelect, selected}) {
  const name=poiName(poi), icon=poiIcon(poi), type=poiType(poi), close=poi.dist<=80
  return (
    <button onClick={()=>onSelect(poi)} style={{width:'100%',textAlign:'left',padding:'.7rem .9rem',background:selected?'rgba(200,150,62,.15)':close?'rgba(200,150,62,.07)':'rgba(245,239,224,.03)',border:`1px solid ${selected?'rgba(200,150,62,.5)':close?'rgba(200,150,62,.3)':'rgba(245,239,224,.1)'}`,borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',gap:'.75rem'}}>
      <span style={{fontSize:'1.4rem',flexShrink:0}}>{icon}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:'Georgia,serif',fontSize:'1rem',color:selected?GL:'#f5efe0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{name}</div>
        <div style={{fontFamily:'sans-serif',fontSize:'.6rem',color:'rgba(245,239,224,.4)',marginTop:'.1rem'}}>{type}</div>
      </div>
      <div style={{flexShrink:0,textAlign:'right'}}>
        <div style={{fontFamily:'sans-serif',fontSize:'.65rem',fontWeight:700,color:close?'#a8d8a8':G}}>{poi.dist}m</div>
        {close&&<div style={{fontFamily:'sans-serif',fontSize:'.55rem',color:'#a8d8a8'}}>¡Estás aquí!</div>}
      </div>
    </button>
  )
}

// ─── Main App ─────────────────────────────────────────────
export default function App() {
  const [apiKey,    setApiKey]    = useState(GROQ_KEY)
  const [keyInput,  setKeyInput]  = useState('')
  const [keySaved,  setKeySaved]  = useState(!!GROQ_KEY)
  const [tab,       setTab]       = useState('gps')
  const [cityInput, setCityInput] = useState('')
  const [mode,      setMode]      = useState('history')
  const [lang,      setLang]      = useState('es')
  const [busy,      setBusy]      = useState(false)
  const [gpsPhase,  setGpsPhase]  = useState('idle')
  const [gpsMsg,    setGpsMsg]    = useState('')
  const [coords,    setCoords]    = useState(null)
  const [geoInfo,   setGeoInfo]   = useState(null)
  const [pois,      setPois]      = useState([])
  const [selPoi,    setSelPoi]    = useState(null)
  const [story,     setStory]     = useState('')
  const [shown,     setShown]     = useState('')
  const [err,       setErr]       = useState('')
  const [chip,      setChip]      = useState(null)
  const [storyCtx,  setStoryCtx]  = useState('')
  const [playing,   setPlaying]   = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [spd,       setSpd]       = useState(1.0)

  const typeTimer = useRef(null)
  const progTimer = useRef(null)
  const storyRef  = useRef('')
  const spdRef    = useRef(1.0)

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

  function typewrite(text) {
    clearInterval(typeTimer.current)
    storyRef.current = text; stopAudio(); setShown(''); setProgress(0)
    const words = text.split(' '); let i = 0
    typeTimer.current = setInterval(() => {
      i++; setShown(words.slice(0,i).join(' '))
      if (i >= words.length) clearInterval(typeTimer.current)
    }, 26)
  }

  function stopAudio() {
    clearInterval(progTimer.current)
    try { window.speechSynthesis.cancel() } catch {}
    setPlaying(false)
  }

  function startAudio() {
    stopAudio()
    const text = storyRef.current; if (!text) return
    const synth  = window.speechSynthesis
    const ttsTag = LANGS.find(l=>l.value===lang)?.tts||'es-ES'
    const voices = synth.getVoices()
    const voice  = voices.find(v=>v.lang===ttsTag)||voices.find(v=>v.lang.startsWith(lang+'-'))||voices.find(v=>v.lang.startsWith(lang))||null
    const parts  = text.match(/[^.!?]+[.!?]*/g)||[text]
    const totalSec = (text.split(/\s+/).length/140)*60/spdRef.current
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

  function toggleAudio() {
    const synth=window.speechSynthesis
    if(playing){synth.pause();clearInterval(progTimer.current);setPlaying(false)}
    else if(synth.paused){
      synth.resume()
      const totalSec=(storyRef.current.split(/\s+/).length/140)*60/spdRef.current
      const t0=Date.now()-progress*totalSec*1000
      progTimer.current=setInterval(()=>{try{if(synth.paused)synth.resume()}catch{}setProgress(Math.min((Date.now()-t0)/1000/totalSec,.99))},400)
      setPlaying(true)
    } else { startAudio() }
  }

  async function generateStory(contextLabel, extra='') {
    setChip(null);setErr('');setBusy(true);setStory('');setShown('');setStoryCtx(contextLabel)
    try {
      const tema=TEMA[mode]?.[lang]||TEMA[mode]?.es
      const prompt=`${SYS_LANG[lang]||''}\nEres WiseTap, guía turístico narrador apasionado. Narras con emoción, datos reales y estilo evocador, como un audiobook de viaje.\n\nEl viajero se encuentra en: ${contextLabel}.\n${extra}\nNárrame sobre "${tema}" en 200-240 palabras.\n- Abre con una frase poética que lo sitúe exactamente en el lugar\n- Incluye datos históricos o culturales reales y fascinantes\n- Menciona detalles visuales del lugar si los conoces\n- Ritmo fluido, pensado para escuchar en voz alta\n- Sin títulos, sin listas, solo narración continua\n- Cierra con una invitación emotiva a explorar`
      const text=await askGroq(prompt, apiKey)
      setStory(text);typewrite(text)
    } catch { setErr('Error al generar. Verifica tu API key y conexión.') }
    setBusy(false)
  }

  function detectGPS() {
    if(!navigator.geolocation){setGpsPhase('error');setGpsMsg('Tu navegador no soporta GPS.');return}
    setGpsPhase('detecting');setGpsMsg('Solicitando permiso...')
    setErr('');setStory('');setShown('');setPois([]);setSelPoi(null);setCoords(null);stopAudio()
    navigator.geolocation.getCurrentPosition(async pos=>{
      const{latitude:lat,longitude:lon}=pos.coords
      setCoords({lat,lon});setGpsPhase('scanning');setGpsMsg('Escaneando lugares cercanos...')
      const[geoRes,poisRes]=await Promise.allSettled([reverseGeocode(lat,lon),fetchNearbyPOI(lat,lon)])
      const geo=geoRes.status==='fulfilled'?geoRes.value:{full:'Tu ubicación',city:'Este lugar',neighbourhood:''}
      const poisData=poisRes.status==='fulfilled'?poisRes.value:[]
      setGeoInfo(geo);setPois(poisData);setGpsPhase('done')
      if(poisData.length>0){
        const closest=poisData[0]
        if(closest.dist<=80){
          setSelPoi(closest);setGpsMsg(`¡Estás en: ${poiName(closest)}!`)
          await generateStory(poiName(closest),`Tipo: ${poiType(closest)}. Ciudad: ${geo.full}.`)
        } else {
          setGpsMsg(`${geo.full} — ${poisData.length} lugar${poisData.length!==1?'es':''} de interés cerca`)
          setBusy(false)
        }
      } else {
        setGpsMsg(geo.full);await generateStory(geo.full)
      }
    },e=>{
      setGpsPhase('error')
      setGpsMsg({1:'Permiso denegado. Actívalo en tu navegador.',2:'No se pudo determinar la posición.',3:'Tiempo agotado.'}[e.code]||'Error de GPS.')
      setBusy(false)
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0})
  }

  async function searchManual() {
    const q=cityInput.trim();if(!q||busy)return
    setErr('');setPois([]);setSelPoi(null);setGeoInfo(null);stopAudio();setBusy(true)
    const geo=await geocodeName(q)
    setGeoInfo({full:geo.full,city:geo.city,neighbourhood:''});setGpsMsg(geo.full);setGpsPhase('done')
    if(geo.lat&&geo.lon){
      setCoords({lat:geo.lat,lon:geo.lon})
      try{const p=await fetchNearbyPOI(geo.lat,geo.lon);setPois(p);if(p.length===0)await generateStory(geo.full);else setBusy(false)}
      catch{await generateStory(geo.full)}
    } else { await generateStory(geo.full) }
  }

  async function selectPoi(poi){
    setSelPoi(poi)
    await generateStory(poiName(poi),`Tipo: ${poiType(poi)}. Ciudad: ${geoInfo?.full||''}.`)
  }

  async function narrateCity(){
    setSelPoi(null)
    const label=geoInfo?.neighbourhood?`${geoInfo.neighbourhood}, ${geoInfo.full}`:geoInfo?.full||''
    await generateStory(label)
  }

  async function doChip(c){
    if(busy||!storyCtx)return;setChip(c.key);stopAudio();setBusy(true);setErr('')
    try{
      const prompt=`${SYS_LANG[lang]||''}\nEres WiseTap, guía cultural apasionado.\nSobre "${storyCtx}", cuéntame: ${c.prompt}. Narración fluida de 150 palabras, estilo audioguía, sin listas.`
      const text=await askGroq(prompt,apiKey);setStory(text);typewrite(text)
    }catch{setErr('Error al obtener información.')}
    setBusy(false)
  }

  const storyDone=!!story&&shown===story

  return(
    <>
      <style>{`
        @keyframes wtspin  {to{transform:rotate(360deg)}}
        @keyframes wtblink {0%,50%{opacity:1}51%,100%{opacity:0}}
        @keyframes wtpulse {0%,100%{box-shadow:0 0 0 0 rgba(200,150,62,.4)}50%{box-shadow:0 0 0 14px rgba(200,150,62,0)}}
        @keyframes wtfade  {from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
      `}</style>
      <div style={{fontFamily:'Georgia,serif',background:'#1a1208',minHeight:'100vh',color:'#f5efe0',padding:'1.2rem 1rem',display:'flex',flexDirection:'column',gap:'.9rem',maxWidth:500,margin:'0 auto'}}>

        {/* Header */}
        <div style={{textAlign:'center',paddingBottom:'1rem',borderBottom:'1px solid rgba(200,150,62,.2)'}}>
          <div style={{fontSize:'2.2rem',fontWeight:300,color:G,letterSpacing:'.12em'}}>🧭 WiseTap</div>
          <div style={{fontFamily:'sans-serif',fontSize:'.58rem',letterSpacing:'.3em',textTransform:'uppercase',color:'rgba(245,239,224,.35)',marginTop:'.2rem'}}>Audioguía histórica con inteligencia artificial</div>
        </div>

        {/* API Key */}
        {!keySaved?(
          <Card label="🔑 API Key de Groq">
            <p style={{fontFamily:'sans-serif',fontSize:'.72rem',color:'rgba(245,239,224,.6)',lineHeight:1.6,marginBottom:'.75rem'}}>
              Obtén tu API key <strong style={{color:GL}}>gratis y sin tarjeta</strong> en:<br/>
              <strong style={{color:GL}}>console.groq.com</strong> → API Keys
            </p>
            <div style={{display:'flex',gap:'.5rem'}}>
              <input type="password" placeholder="gsk_..."
                value={keyInput} onChange={e=>setKeyInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&(setApiKey(keyInput.trim()),setKeySaved(true))}
                style={{flex:1,background:'rgba(245,239,224,.07)',border:`1px solid ${G}`,borderRadius:8,color:'#f5efe0',fontSize:'.85rem',padding:'.6rem .85rem',outline:'none',fontFamily:'sans-serif'}}
              />
              <button onClick={()=>{if(keyInput.trim()){setApiKey(keyInput.trim());setKeySaved(true)}}}
                style={{padding:'.6rem 1rem',background:`linear-gradient(135deg,${G},${T})`,border:'none',borderRadius:8,color:'#faf6ed',fontFamily:'sans-serif',fontSize:'.72rem',fontWeight:700,cursor:'pointer'}}>
                Guardar
              </button>
            </div>
          </Card>
        ):(
          <>
            {/* Tabs */}
            <div style={{display:'flex',gap:'.5rem'}}>
              {[['gps','📡 Usar GPS'],['manual','✏️ Escribir ciudad']].map(([t,lbl])=>(
                <button key={t} onClick={()=>setTab(t)}
                  style={{flex:1,padding:'.55rem',background:tab===t?'rgba(200,150,62,.13)':'rgba(245,239,224,.04)',border:`1px solid ${tab===t?'rgba(200,150,62,.5)':'rgba(245,239,224,.1)'}`,borderRadius:9,color:tab===t?GL:'rgba(245,239,224,.4)',fontFamily:'sans-serif',fontSize:'.65rem',fontWeight:700,cursor:'pointer'}}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* GPS */}
            {tab==='gps'&&(
              <Card label="Detección de ubicación">
                <button onClick={detectGPS} disabled={busy}
                  style={{width:'100%',padding:'.85rem',background:busy?'rgba(200,150,62,.3)':`linear-gradient(135deg,${G},${T})`,border:'none',borderRadius:9,color:'#faf6ed',fontFamily:'sans-serif',fontSize:'.75rem',fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',cursor:busy?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'.6rem',animation:gpsPhase==='detecting'||gpsPhase==='scanning'?'wtpulse 2s infinite':''}}>
                  {gpsPhase==='detecting'||gpsPhase==='scanning'?<><Spin/>{gpsPhase==='scanning'?'Buscando lugares...':'Detectando...'}</>:'📡 Detectar mi ubicación'}
                </button>
                {gpsMsg&&<div style={{marginTop:'.7rem'}}><Pill type={gpsPhase==='error'?'error':gpsPhase==='done'?'ok':'info'}>{gpsPhase==='detecting'||gpsPhase==='scanning'?'⏳ ':gpsPhase==='done'?'📍 ':gpsPhase==='error'?'❌ ':''}{gpsMsg}</Pill></div>}
              </Card>
            )}

            {/* Manual */}
            {tab==='manual'&&(
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

            {/* Lang + Mode */}
            <Card label="Idioma y tema">
              <select value={lang} onChange={e=>setLang(e.target.value)}
                style={{width:'100%',background:'rgba(245,239,224,.06)',border:'1px solid rgba(200,150,62,.22)',borderRadius:8,color:'#f5efe0',fontFamily:'sans-serif',fontSize:'.8rem',padding:'.5rem .75rem',outline:'none',marginBottom:'.75rem',cursor:'pointer'}}>
                {LANGS.map(l=><option key={l.value} value={l.value} style={{background:'#1a1208'}}>{l.label}</option>)}
              </select>
              <div style={{display:'flex',gap:'.4rem'}}>
                {MODES.map(m=>(
                  <button key={m.key} onClick={()=>setMode(m.key)}
                    style={{flex:1,padding:'.5rem .2rem',background:mode===m.key?'rgba(200,150,62,.15)':'rgba(245,239,224,.04)',border:`1px solid ${mode===m.key?'rgba(200,150,62,.5)':'rgba(245,239,224,.1)'}`,borderRadius:8,color:mode===m.key?GL:'rgba(245,239,224,.4)',fontFamily:'sans-serif',fontSize:'.58rem',fontWeight:700,textTransform:'uppercase',cursor:'pointer',textAlign:'center'}}>
                    <div style={{fontSize:'1rem',marginBottom:2}}>{m.icon}</div>{m.label}
                  </button>
                ))}
              </div>
            </Card>

            {err&&<Pill type="error">❌ {err}</Pill>}

            {/* POI list */}
            {pois.length>0&&gpsPhase==='done'&&(
              <Card label={`🗺️ ${pois.length} lugares de interés cerca`} highlight>
                <div style={{display:'flex',flexDirection:'column',gap:'.45rem',marginBottom:'.7rem'}}>
                  {pois.map((poi,i)=><POICard key={i} poi={poi} selected={selPoi===poi} onSelect={selectPoi}/>)}
                </div>
                <button onClick={narrateCity}
                  style={{width:'100%',padding:'.6rem',background:'rgba(245,239,224,.04)',border:'1px solid rgba(245,239,224,.12)',borderRadius:9,color:'rgba(245,239,224,.5)',fontFamily:'sans-serif',fontSize:'.65rem',fontWeight:600,cursor:'pointer'}}>
                  🏙️ Narrar historia del barrio / ciudad
                </button>
              </Card>
            )}

            {/* Story */}
            {shown&&(
              <Card label={`${MODES.find(m=>m.key===mode)?.icon} ${storyCtx}`} highlight={storyDone}>
                <div style={{fontSize:'1.1rem',lineHeight:1.9,color:'rgba(245,239,224,.88)',fontWeight:300,marginBottom:storyDone?'1rem':0,animation:'wtfade .4s ease'}}>
                  {shown}
                  {!storyDone&&<span style={{display:'inline-block',width:2,height:'.9em',background:G,verticalAlign:'middle',marginLeft:2,animation:'wtblink .8s infinite'}}/>}
                </div>
                {storyDone&&(
                  <>
                    <div style={{height:1,background:'rgba(200,150,62,.15)',marginBottom:'1rem'}}/>
                    <div style={{display:'flex',alignItems:'center',gap:'.9rem'}}>
                      <button onClick={toggleAudio}
                        style={{width:54,height:54,borderRadius:'50%',background:`linear-gradient(135deg,${G},${T})`,border:'none',cursor:'pointer',fontSize:'1.3rem',flexShrink:0,boxShadow:'0 4px 18px rgba(200,150,62,.45)',display:'flex',alignItems:'center',justifyContent:'center',animation:playing?'wtpulse 2s infinite':''}}>
                        {playing?'⏸️':'▶️'}
                      </button>
                      <div style={{flex:1}}>
                        <div style={{height:4,background:'rgba(200,150,62,.15)',borderRadius:2,overflow:'hidden',marginBottom:'.35rem'}}>
                          <div style={{height:'100%',background:`linear-gradient(90deg,${G},${GL})`,width:(progress*100)+'%',transition:'width .4s linear'}}/>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',fontFamily:'sans-serif',fontSize:'.6rem',color:'rgba(245,239,224,.3)'}}>
                          <span>{Math.round(progress*100)}%</span>
                          <span style={{color:playing?'#a0d0a0':progress>0?'#d0c080':'rgba(245,239,224,.3)'}}>{playing?'🔊 reproduciendo':progress>0?'⏸ pausado':'toca ▶ para escuchar'}</span>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:3,alignItems:'flex-end',height:26}}>
                        {[7,15,10,21,13,8].map((h,i)=>(
                          <div key={i} style={{width:3,background:G,borderRadius:2,height:playing?h:3,opacity:playing?.85:.2,transition:`height ${.2+i*.04}s ease,opacity .3s`}}/>
                        ))}
                      </div>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'.75rem'}}>
                      <button onClick={()=>{const o=[0.75,1.0,1.25,1.5];setSpd(o[(o.indexOf(spd)+1)%o.length]);if(playing){stopAudio();setTimeout(startAudio,100)}}}
                        style={{fontFamily:'sans-serif',fontSize:'.62rem',fontWeight:700,background:'rgba(200,150,62,.1)',border:'1px solid rgba(200,150,62,.28)',color:G,padding:'.22rem .65rem',borderRadius:20,cursor:'pointer'}}>
                        {spd}× velocidad
                      </button>
                      <button onClick={()=>{stopAudio();setProgress(0);setTimeout(startAudio,150)}}
                        style={{fontFamily:'sans-serif',fontSize:'.62rem',background:'none',border:'none',color:'rgba(245,239,224,.35)',cursor:'pointer'}}>
                        ↺ Reiniciar
                      </button>
                    </div>
                  </>
                )}
              </Card>
            )}

            {/* Chips */}
            {storyDone&&(
              <div>
                <div style={{fontFamily:'sans-serif',fontSize:'.58rem',fontWeight:700,letterSpacing:'.26em',textTransform:'uppercase',color:G,marginBottom:'.55rem'}}>Explorar más</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'.45rem'}}>
                  {CHIPS.map(c=>(
                    <button key={c.key} onClick={()=>doChip(c)}
                      style={{fontFamily:'sans-serif',fontSize:'.62rem',fontWeight:600,background:chip===c.key?'rgba(200,150,62,.15)':'rgba(245,239,224,.05)',border:`1px solid ${chip===c.key?'rgba(200,150,62,.45)':'rgba(245,239,224,.12)'}`,color:chip===c.key?GL:'rgba(245,239,224,.45)',padding:'.28rem .7rem',borderRadius:20,cursor:'pointer'}}>
                      {c.icon} {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={()=>{setKeySaved(false);setApiKey('');setKeyInput('')}}
              style={{fontFamily:'sans-serif',fontSize:'.58rem',background:'none',border:'none',color:'rgba(245,239,224,.2)',cursor:'pointer',textDecoration:'underline',textAlign:'center'}}>
              Cambiar API key
            </button>
          </>
        )}

        <div style={{textAlign:'center',fontFamily:'sans-serif',fontSize:'.55rem',letterSpacing:'.15em',textTransform:'uppercase',color:'rgba(245,239,224,.15)',paddingTop:'.25rem'}}>
          WiseTap v2 · Powered by Groq AI
        </div>
      </div>
    </>
  )
}
