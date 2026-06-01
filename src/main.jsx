import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('App error:', error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ fontFamily:'sans-serif', background:'#1a1208', minHeight:'100vh', color:'#f5efe0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', textAlign:'center' }}>
          <div style={{ fontSize:'2rem', marginBottom:'1rem' }}>🧭</div>
          <div style={{ fontSize:'1.1rem', color:'#c8963e', marginBottom:'.5rem' }}>Algo salió mal</div>
          <div style={{ fontSize:'.8rem', color:'rgba(245,239,224,.5)', marginBottom:'1.5rem' }}>{this.state.error?.message || 'Error inesperado'}</div>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            style={{ padding:'.75rem 1.5rem', background:'linear-gradient(135deg,#c8963e,#b05c3a)', border:'none', borderRadius:9, color:'#faf6ed', fontFamily:'sans-serif', fontSize:'.8rem', fontWeight:700, cursor:'pointer' }}>
            Reiniciar app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
