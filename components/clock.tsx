"use client"

import { useEffect, useState } from "react"

interface ClockProps {
    className?: string
}

export function Clock({ className }: ClockProps) {
    const [time, setTime] = useState<string>("")

    useEffect(() => {
        // Initial set
        setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))

        const timer = setInterval(() => {
            setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))
        }, 1000)

        return () => clearInterval(timer)
    }, [])

    // Prevent hydration mismatch by rendering a placeholder or empty string initially/server-side if needed,
    // but since we set state in useEffect, initial render is empty string.
    return (
        <div className={className}>
            {time}
        </div>
    )
}
