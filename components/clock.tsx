"use client"

import { useEffect, useState } from "react"

interface ClockProps {
    className?: string
}

export function Clock({ className }: ClockProps) {
    const [time, setTime] = useState<string>("")
    const [date, setDate] = useState<string>("")

    useEffect(() => {
        const updateDateTime = () => {
            const now = new Date();
            
            // Format time
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            setTime(`${hours}:${minutes}`);

            // Format date (Buddhist Era: year + 543)
            const d = now.getDate().toString().padStart(2, '0');
            const m = (now.getMonth() + 1).toString().padStart(2, '0');
            const y = (now.getFullYear() + 543).toString();
            setDate(`${d}/${m}/${y}`);
        }

        updateDateTime();

        const timer = setInterval(updateDateTime, 1000)

        return () => clearInterval(timer)
    }, [])

    return (
        <div className={`flex flex-col items-end leading-none ${className}`}>
            <div className="text-xs font-semibold tracking-[0.35em] opacity-70 uppercase border-b border-white/40 pb-1 mb-0.5 w-fit">
                {date}
            </div>
            <div className="text-5xl font-mono font-medium tracking-tight">
                {time}
            </div>
        </div>
    )
}
