"use client"

import { useEffect, useState } from "react"

interface ClockProps {
    className?: string
}

export function Clock({ className }: ClockProps) {
    const [time, setTime] = useState<string>("")

    useEffect(() => {
        // Initial set
        const formatTime = (date: Date) => {
            const hours = date.getHours();
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        }

        setTime(formatTime(new Date()));

        const timer = setInterval(() => {
            setTime(formatTime(new Date()));
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
