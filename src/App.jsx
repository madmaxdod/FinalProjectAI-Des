import React, { useEffect, useRef, useState } from 'react'
import { Search, Play, Pause, Zap, Wifi, WifiOff } from 'lucide-react'

export default function App() {
  const playerRef = useRef(null)
  const iframeRef = useRef(null)
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)

  const [socketStatus, setSocketStatus] = useState('closed')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)

  // Connect websocket
  useEffect(() => {
    let ws
    function connect() {
      setSocketStatus('connecting')
      ws = new WebSocket('ws://localhost:3001')
      wsRef.current = ws

      ws.onopen = () => setSocketStatus('open')
      ws.onclose = () => {
        setSocketStatus('closed')
        // auto-reconnect
        reconnectTimer.current = setTimeout(connect, 1500)
      }
      ws.onerror = () => setSocketStatus('error')
      ws.onmessage = () => {}
    }
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  // Utility: send JSON on websocket if open
  function sendWs(payload) {
    try {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
    } catch (e) {
      // ignore
    }
  }

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      initPlayer()
      return
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.body.appendChild(tag)

    window.onYouTubeIframeAPIReady = () => initPlayer()

    return () => {
      // cleanup
      if (playerRef.current && playerRef.current.destroy) playerRef.current.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function initPlayer() {
    playerRef.current = new window.YT.Player(iframeRef.current, {
      height: '360',
      width: '640',
      playerVars: { controls: 0, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          const p = playerRef.current
          setDuration(p.getDuration() || 0)
          setRate(p.getPlaybackRate() || 1)
          // poll for current time
          setInterval(() => {
            if (!p || !p.getCurrentTime) return
            const t = p.getCurrentTime()
            setCurrentTime(t)
          }, 250)
        },
        onStateChange: (e) => {
          const state = e.data
          // PLAYING = 1, PAUSED = 2
          if (state === 1) {
            setPlaying(true)
            sendWs({ type: 'play' })
          } else if (state === 2) {
            setPlaying(false)
            sendWs({ type: 'pause' })
          }
        }
      }
    })
  }

  function loadVideo(videoId, start = 0) {
    const p = playerRef.current
    if (!p) return
    p.loadVideoById({ videoId, startSeconds: start })
    setTimeout(() => {
      setDuration(p.getDuration() || 0)
    }, 800)
    sendWs({ type: 'load', id: videoId })
  }

  function handlePlayPause() {
    const p = playerRef.current
    if (!p) return
    const state = p.getPlayerState()
    if (state === 1) {
      p.pauseVideo()
    } else {
      p.playVideo()
    }
  }

  function handleSeek(val) {
    const p = playerRef.current
    if (!p) return
    p.seekTo(parseFloat(val), true)
    setCurrentTime(parseFloat(val))
    sendWs({ type: 'seek', val: parseFloat(val) })
  }

  function handleRateChange(val) {
    const p = playerRef.current
    if (!p) return
    p.setPlaybackRate(parseFloat(val))
    setRate(parseFloat(val))
    sendWs({ type: 'rate', val: parseFloat(val) })
  }

  async function doSearch(q) {
    if (!q) {
      setResults([])
      return
    }
    try {
      const res = await fetch('http://localhost:5000/api/search?q=' + query);
      const json = await res.json()
      // try to parse common YouTube search structure
      const items = json.items || json.results || json
      setResults(items || [])
    } catch (e) {
      setResults([])
    }
  }

  // simple debounce for search
  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function trigger(index) {
    sendWs({ type: 'trigger', val: index })
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Real-Time YouTube VJ Interface</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {socketStatus === 'open' ? (
              <Wifi className="text-green-400" />
            ) : (
              <WifiOff className="text-red-400" />
            )}
            <span className="text-sm">{socketStatus}</span>
          </div>
        </div>
      </header>

      {/* Video Player - 16:9 */}
      <div className="w-full bg-black rounded-xl overflow-hidden mb-4" style={{aspectRatio: '16/9'}}>
        <div ref={iframeRef} className="w-full h-full" />
      </div>

      {/* Scrub & Rate */}
      <section className="mb-4">
        <div className="flex items-center gap-3">
          <button onClick={handlePlayPause} className="p-2 bg-slate-800 rounded-md">
            {playing ? <Pause /> : <Play />}
          </button>
          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.round(duration || 0))}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              onChange={(e) => handleSeek(e.target.value)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>{new Date((currentTime || 0) * 1000).toISOString().substr(11, 8)}</span>
              <span>{new Date((duration || 0) * 1000).toISOString().substr(11, 8)}</span>
            </div>
          </div>

          <div className="w-40 ml-3">
            <label className="text-xs text-slate-400">Rate</label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={rate}
              onChange={(e) => handleRateChange(e.target.value)}
              className="w-full"
            />
            <div className="text-right text-sm">{rate.toFixed(1)}x</div>
          </div>
        </div>
      </section>

      {/* Triggers */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => trigger(n)}
            className="p-4 rounded-lg bg-gradient-to-br from-pink-600 to-amber-500 text-black font-bold flex items-center justify-center gap-2"
          >
            <Zap /> Trigger {n}
          </button>
        ))}
      </section>

      {/* Search */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Search />
          <input
            className="w-full bg-slate-800 rounded-md p-2"
            placeholder="Search YouTube (via local proxy)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-64 overflow-auto bg-slate-800 rounded-md p-2">
          {results.length === 0 && query ? (
            <div className="text-sm text-slate-400">No results</div>
          ) : null}

          {results.map((it, idx) => {
            const id = it.id?.videoId || it.videoId || (typeof it === 'string' ? it : null)
            const title = it.snippet?.title || it.title || it.name || 'Untitled'
            const thumb = it.snippet?.thumbnails?.default?.url || it.thumbnail || ''
            return (
              <div
                key={idx}
                className="flex items-center gap-3 p-2 rounded hover:bg-slate-700 cursor-pointer"
                onClick={() => id && loadVideo(id)}
              >
                <img src={thumb} alt="thumb" className="w-20 h-12 object-cover rounded" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{title}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
