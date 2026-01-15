"use client"

import { useEffect, useState, useRef } from "react"
import { QRCodeSVG } from "qrcode.react"
// Remove Card/Skeleton if unused in the final code, but keeping imports if needed
// The original code imported them but used standard divs mostly. I will keep them if they were used.
// Original imports: import { Card } from "@/components/ui/card" -> Not used in the visible code but imported.
// import { Skeleton } from "@/components/ui/skeleton" -> Not used.
// I will keep the imports or remove them to be clean. The original code didn't seem to use them in the rendered JSX provided.
// Actually, I'll remove them to avoid unused var errors, unless I see them used.
// Looking at the original file: they were imported but I don't see `<Card>` or `<Skeleton>` in the JSX.
// I will comment them out.

type Status = "AVAILABLE" | "UPCOMING" | "OCCUPIED" | "PENDING" | "DISABLED"

// Helper to determine status based on time (mock logic for now)
const getStatusParams = (status: Status) => {
  switch (status) {
    case "AVAILABLE":
      return {
        bgColor: "bg-green-500",
        message: "Room Available",
        subtext: "Scan to book instantly"
      }
    case "UPCOMING":
      return {
        bgColor: "bg-yellow-500",
        message: "Session Starting Soon",
        subtext: "Please prepare to enter"
      }
    case "OCCUPIED":
      return {
        bgColor: "bg-zinc-900",
        message: "Do Not Disturb",
        subtext: "Activity in progress"
      }
    case "PENDING":
      return {
        bgColor: "bg-black",
        message: "Not Registered",
        subtext: "Contact Admin"
      }
    case "DISABLED":
      return {
        bgColor: "bg-black",
        message: "Device Disabled",
        subtext: "System Offline"
      }
  }
}

export default function DisplayScreen() {
  const [mac, setMac] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>("AVAILABLE")
  const [deviceInfo, setDeviceInfo] = useState<{ name?: string, room?: string }>({})
  const [activity, setActivity] = useState<{ title: string, imageUrl?: string, startTime: string, endTime: string, description?: string, qrCode?: { data: string, type: 'GENERATED' | 'IMAGE_URL' } } | null>(null)
  const [ad, setAd] = useState<{ id: string, name: string, type: 'IMAGE' | 'VIDEO', url: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<{ msg: string, type: 'info' | 'error' }[]>([])
  const [time, setTime] = useState(new Date())
  const [lastSync, setLastSync] = useState<Date | null>(null)

  // Initialize MAC from Env or API
  useEffect(() => {
    const initSystem = async () => {
      // 1. Check Env first (populated by auto_config.py)
      let deviceId = process.env.NEXT_PUBLIC_DEVICE_ID

      if (deviceId) {
        setMac(deviceId)
        if (loading) addLog(`Env Detected MAC: ${deviceId}`)
      } else {
        // 2. Fallback to API
        try {
          if (loading) addLog("Detecting System Info...")

          const res = await fetch('/api/system-info')
          const sysData = await res.json()

          if (sysData.mac && sysData.mac !== '00:00:00:00:00:00') {
            setMac(sysData.mac)
            if (loading) addLog(`API Detected MAC: ${sysData.mac}`)
          } else {
            // Fallback
            let storedId = localStorage.getItem("smartroom_device_id")
            if (!storedId) {
              const random = Math.random().toString(36).substring(2, 8).toUpperCase()
              storedId = `TERM-${random}`
              localStorage.setItem("smartroom_device_id", storedId)
            }
            setMac(storedId)
          }
        } catch {
          let storedId = localStorage.getItem("smartroom_device_id") || 'TERM-ERR'
          setMac(storedId)
        }
      }
    }
    initSystem()
  }, []) // Run once on mount

  const addLog = (message: string, type: 'info' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
    setLogs(prev => [...prev.slice(-5), { msg: `[${timestamp}] ${message}`, type }])
  }

  const lastApiStatus = useRef<string | null>(null)

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Poll API
  useEffect(() => {
    if (!mac) return;

    // Initial log
    if (loading && logs.length === 0) {
      addLog("System starting...")
      addLog(`Device ID: ${mac}`)
    }

    let timeoutId: NodeJS.Timeout

    const fetchStatus = async () => {
      // Default to 10s if not set, but user requested 30s.
      // Logic: Read env -> parse int -> fallback to 30000
      const envInterval = process.env.NEXT_PUBLIC_POLLING_INTERVAL
      const pollInterval = envInterval ? parseInt(envInterval) : 30000
      let nextDelay = pollInterval

      try {
        if (loading && logs.length < 3) addLog("Detecting IP address...")

        const apiHost = process.env.NEXT_PUBLIC_API_HOST || 'http://localhost';
        const apiPort = process.env.NEXT_PUBLIC_API_PORT || '4000';
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${apiHost}:${apiPort}`;

        // 1. Get IP if explicitly set or fetch
        let currentIp = process.env.NEXT_PUBLIC_DEVICE_IP || 'Unknown';

        // Only fetch whoami if we don't have an Env IP
        if (currentIp === 'Unknown') {
          try {
            const ipRes = await fetch(`${apiUrl}/api/whoami`);
            const ipData = await ipRes.json();
            currentIp = ipData.ip;
          } catch (e) {
            // console.error("IP Fetch error", e);
          }
        }

        if (loading && logs.length < 4) addLog(`IP Detected: ${currentIp}`)
        if (loading) addLog("Connecting to server...")

        const res = await fetch(`${apiUrl}/api/device/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            macAddress: mac,
            ipAddress: currentIp
          })
        })

        if (loading) addLog("Response received...")

        const data = await res.json()
        setLastSync(new Date())

        if (data.command === 'REFRESH') {
          addLog("Command: REFRESH executing...")
          window.location.reload()
        }

        // Update info
        setDeviceInfo({ name: data.deviceName, room: data.roomNumber })
        setActivity(data.activity || null)
        setAd(data.ad || null)

        // Handle Status
        const newStatus = data.deviceStatus

        // Check for status change and reload if needed
        if (lastApiStatus.current !== null && lastApiStatus.current !== newStatus) {
          console.log(`Status changed from ${lastApiStatus.current} to ${newStatus}. Reloading...`)
          addLog("Status changed. Reloading system...")
          setTimeout(() => window.location.reload(), 1000)
          return
        }
        lastApiStatus.current = newStatus

        if (newStatus === 'PENDING') {
          setStatus('PENDING')
          if (loading) addLog("Status: Device not registered")
        } else if (newStatus === 'DISABLED') {
          setStatus('DISABLED')
          if (loading) addLog("Status: Device Disabled")
        } else if (newStatus === 'ACTIVE') {
          if (data.activity) {
            if (status !== 'OCCUPIED') setStatus('OCCUPIED')
          } else {
            if (status !== 'AVAILABLE') setStatus('AVAILABLE')
          }
          if (loading) addLog("Status: Active. Loading interface...")
        }

        if (loading) {
          setLoading(false)
        }

      } catch (err) {
        console.error("Heartbeat failed", err)
        if (loading) {
          addLog(`Error: ${err instanceof Error ? err.message : 'Connection failed'}`, 'error')
          addLog("Retrying in 10s...", 'error')
        }
        nextDelay = 10000
      }

      timeoutId = setTimeout(fetchStatus, nextDelay)
    }

    fetchStatus()

    return () => clearTimeout(timeoutId)
  }, [mac, status, loading])

  const uiParams = getStatusParams(status)

  if (!mac) return <div className="bg-black w-screen h-screen"></div>

  // 1. Initial "Starting" Black Screen with Logs
  if (loading) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-start justify-end p-12 text-green-500 font-mono text-lg">
        <div className="mb-auto w-full pt-12">
          <h1 className="text-white text-4xl font-bold tracking-wider mb-2">SYSTEM BOOT</h1>
          <div className="h-1 w-32 bg-green-500 mb-8"></div>
        </div>

        <div className="space-y-2 w-full max-w-2xl">
          {logs.map((log, i) => (
            <p key={i} className={`opacity-80 border-l-2 pl-4 animate-in slide-in-from-left-2 duration-300 ${log.type === 'error' ? 'text-red-500 border-red-900' : 'text-green-500 border-green-900'}`}>
              {log.msg}
            </p>
          ))}
          <p className="animate-pulse">_</p>
        </div>
      </div>
    )
  }

  // 2. Disabled - Black Screen
  if (status === 'DISABLED') {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center p-8 text-white">
        <div className="w-24 h-24 border-4 border-gray-600 rounded-full flex items-center justify-center mb-8">
          <span className="text-4xl text-gray-500">OFF</span>
        </div>
        <h1 className="text-4xl font-bold tracking-widest uppercase mb-4 text-center text-red-500">
          DEVICE DISABLED
        </h1>
        <div className="text-center space-y-2">
          <p className="text-gray-500">
            This display client has been disabled by administrator.
          </p>
          <p className="text-gray-700 font-mono text-xs mt-4">
            ID: {mac}
          </p>
        </div>
      </div>
    )
  }

  // 3. Not Registered (Pending) - Black Screen
  if (status === 'PENDING') {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center p-8 text-white">
        <div className="w-24 h-24 border-4 border-red-600 rounded-full flex items-center justify-center mb-8 animate-pulse">
          <span className="text-4xl">!</span>
        </div>
        <h1 className="text-4xl font-light tracking-widest uppercase mb-4 text-center">
          Device Not Registered
        </h1>
        <div className="text-center space-y-2">
          <p className="text-white/50 font-mono bg-white/10 px-4 py-2 rounded inline-block mx-2">
            ID: {mac}
          </p>
          {logs.find(l => l.msg.includes('IP Detected')) && (
            <p className="text-green-500/80 font-mono bg-green-900/20 px-4 py-2 rounded inline-block mx-2">
              {logs.find(l => l.msg.includes('IP Detected'))?.msg.split('IP Detected: ')[1] || 'Unknown IP'}
            </p>
          )}
        </div>
        <p className="text-white/40 text-sm mt-8 animate-bounce">
          Waiting for administrator...
        </p>
      </div>
    )
  }

  // 3. Main Registered UI
  return (
    <div className={`w-screen h-screen flex flex-col transition-colors duration-1000 ${uiParams.bgColor} text-white overflow-hidden`}>
      {/* Header Info */}
      <header className="flex justify-between items-center px-8 py-6 bg-black/20 backdrop-blur-sm h-24 shrink-0">
        {activity?.imageUrl ? (
          <div className="flex items-center gap-6">
            <img src={activity.imageUrl} alt="Activity Logo" className="h-16 w-16 object-cover rounded-xl bg-white/10" />
            <div className="flex flex-col">
              <span className="text-3xl font-bold tracking-tighter">{deviceInfo.room || 'Room'}</span>
              <span className="text-sm opacity-70 uppercase tracking-widest">Running Activity</span>
            </div>
          </div>
        ) : (
          <div className="text-4xl font-bold tracking-tighter">
            Room <span className="text-2xl font-light opacity-80">| {deviceInfo.room || 'Unassigned Room'}</span>
          </div>
        )}
        <div className="text-5xl font-mono font-medium">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-stretch justify-center p-8 gap-8 overflow-hidden relative">

        {/* 1. QR SCREEN MODE */}
        {activity?.qrCode ? (
          (() => {
            return (
              <div className="flex-1 w-full h-full flex items-center justify-center gap-6 lg:gap-10">
                {/* Left/Main Panel: QR Code, Title, Description */}
                <div className={`flex flex-col justify-center items-center text-center animate-in zoom-in-95 duration-500 ${ad ? 'w-[60%] lg:w-[65%]' : 'w-full'} transition-all`}>

                  {/* QR Code Container */}
                  <div className={`bg-white p-6 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] shadow-[0_0_70px_-10px_rgba(255,255,255,0.3)] ring-4 ring-white/20 flex items-center justify-center aspect-square w-auto mb-6 lg:mb-10 mt-4 lg:mt-8 ${ad ? 'max-h-[38vh] lg:max-h-[42vh]' : 'max-h-[42vh] lg:max-h-[50vh]'}`}>
                    {activity.qrCode.type === 'IMAGE_URL' ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={activity.qrCode.data} alt="QR" className="w-full h-full object-contain" />
                    ) : (
                      <QRCodeSVG value={activity.qrCode.data} size={400} level="H" className="w-full h-full" />
                    )}
                  </div>

                  {/* Text Content */}
                  <div className={`space-y-1 lg:space-y-4 max-w-4xl flex flex-col items-center ${ad ? 'px-4' : ''}`}>
                    <h1 className={`${ad ? 'text-4xl lg:text-6xl' : 'text-5xl lg:text-8xl'} font-black tracking-tight leading-none break-words line-clamp-2`}>
                      {activity.title}
                    </h1>
                    {activity.description && (
                      <p className={`${ad ? 'text-xl lg:text-3xl' : 'text-2xl lg:text-5xl'} mt-2 lg:mt-0 font-light opacity-80 leading-tight line-clamp-3`}>
                        {activity.description}
                      </p>
                    )}
                    <div className={`pt-3 lg:pt-4 opacity-60 font-mono border-t border-white/20 inline-block mt-4 ${ad ? 'text-lg lg:text-xl' : 'text-lg lg:text-2xl'}`}>
                      {new Date(activity.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      <span className="mx-3">-</span>
                      {new Date(activity.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* Right Panel: Ad */}
                {ad && (
                  <div className="w-[40%] lg:w-[35%] shrink-0 flex flex-col h-full max-h-[85vh] animate-in slide-in-from-right-10 duration-700 justify-center">
                    <div className="w-full h-full bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative">
                      {ad.type === 'VIDEO' ? (
                        <video src={ad.url} autoPlay loop muted className="w-full h-full object-contain bg-zinc-900" />
                      ) : (
                        <img src={ad.url} alt={ad.name} className="w-full h-full object-contain bg-zinc-900" />
                      )}
                      <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur text-white/80 text-[10px] lg:text-xs px-2 py-1 lg:px-3 lg:py-1 rounded-full uppercase tracking-wider">
                        Sponsored
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })()
        ) : (
          /* 2. STANDARD ACTIVITY MODE */
          <>
            {/* Left Panel: Ad (Priority) OR Activity Info */}
            <div className="flex-1 flex flex-col justify-center space-y-8 animate-in fade-in slide-in-from-left-10 duration-500 min-w-0">
              {ad ? (
                <div className="w-full h-full max-h-[calc(100vh-12rem)] relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 ring-4 ring-black/20 bg-black">
                  {ad.type === 'VIDEO' ? (
                    <video src={ad.url} autoPlay loop muted className="w-full h-full object-contain" />
                  ) : (
                    <img src={ad.url} alt={ad.name} className="w-full h-full object-contain" />
                  )}

                  {/* Overlay Box Logic */}
                  {status === 'AVAILABLE' ? (
                    <div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-md p-6 rounded-2xl border-l-8 border-white animate-in slide-in-from-bottom-4 duration-700 delay-300 max-w-[80%]">
                      <h3 className="text-lg opacity-75 uppercase tracking-widest mb-1">Room Available</h3>
                      <p className="text-2xl font-bold">Scan to book instantly</p>
                    </div>
                  ) : (
                    <>
                      {activity ? (
                        <div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-md p-6 rounded-2xl border-l-8 border-white animate-in slide-in-from-bottom-4 duration-700 delay-300 max-w-[80%]">
                          <h3 className="text-lg opacity-75 uppercase tracking-widest mb-1">Current Activity</h3>
                          <p className="text-3xl font-bold mb-1 truncate">{activity.title}</p>
                          <p className="text-lg font-mono opacity-80">
                            {new Date(activity.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            <span className="mx-2">-</span>
                            {new Date(activity.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ) : (
                        status === 'OCCUPIED' && (
                          <div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-md p-6 rounded-2xl border-l-8 border-white animate-in slide-in-from-bottom-4 duration-700 delay-300 max-w-[80%]">
                            <h3 className="text-lg opacity-75 uppercase tracking-widest mb-1">Current Activity</h3>
                            <p className="text-2xl font-bold">Meeting in Progress</p>
                          </div>
                        )
                      )}
                    </>
                  )}
                </div>
              ) : (
                // No Ad - Standard Text UI
                <div className="flex flex-col justify-center h-full">
                  <h1 className="text-7xl lg:text-8xl font-black uppercase tracking-tight leading-none break-words">
                    {uiParams.message}
                  </h1>
                  <p className="text-3xl lg:text-4xl mt-4 opacity-90 font-light">{uiParams.subtext}</p>

                  {/* Activity Info */}
                  {activity && (
                    <div className="mt-8 lg:mt-12 bg-black/30 p-8 rounded-2xl border-l-8 border-white">
                      <h3 className="text-xl lg:text-2xl opacity-75 uppercase tracking-widest text-sm mb-2">Current Activity</h3>
                      <p className="text-4xl lg:text-5xl font-bold truncate">{activity.title}</p>
                      <p className="text-xl lg:text-2xl font-light mt-2 opacity-80 border-t border-white/20 pt-2 inline-block">
                        {new Date(activity.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="mx-2">-</span>
                        {new Date(activity.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                  {!activity && status === 'OCCUPIED' && (
                    <div className="mt-8 lg:mt-12 bg-black/30 p-8 rounded-2xl border-l-8 border-white">
                      <h3 className="text-xl lg:text-2xl opacity-75 uppercase tracking-widest text-sm mb-2">Current Activity</h3>
                      <p className="text-4xl lg:text-5xl font-bold">Meeting in Progress</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Panel: Fixed QR Code (Always on Right for Standard Mode) */}
            <div className="w-[30%] max-w-sm shrink-0 bg-white rounded-3xl shadow-2xl flex flex-col items-center justify-center p-8 text-slate-900 animate-in zoom-in-50 duration-500 h-full max-h-full">
              <div className="bg-white p-4 rounded-xl shadow-sm mb-6 shrink-0">
                <QRCodeSVG value="https://docs.google.com/forms/d/1avJMz3UUmtTo6N08Jeq4lRPmGWOv9GKXd2QxRL_ZAm4" size={180} level="H" className="w-full h-auto max-w-[200px]" />
              </div>
              <p className="text-center text-xl font-bold shrink-0">Scan to Check-in</p>
              <p className="text-center text-slate-500 mt-2 shrink-0">Use your phone to register your attendance.</p>
            </div>
          </>
        )}
      </main>

      {/* Footer / Ticker */}
      <footer className="p-4 bg-black/10 text-center text-sm opacity-60 h-14 shrink-0 flex items-center justify-center">
        TermId: {mac} | Room: {deviceInfo.room || '-'} | Updated: {lastSync ? lastSync.toLocaleTimeString() : 'Connecting...'}
      </footer>
    </div>
  )
}
