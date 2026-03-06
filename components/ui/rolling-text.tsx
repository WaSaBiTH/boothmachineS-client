"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface RollingTextProps {
    texts: string[]
    intervalMs?: number
    className?: string
}

export const RollingText: React.FC<RollingTextProps> = ({
    texts,
    intervalMs = 15000,
    className = "",
}) => {
    const [index, setIndex] = useState(0)

    useEffect(() => {
        if (texts.length <= 1) return

        const timer = setInterval(() => {
            setIndex((prevIndex) => (prevIndex + 1) % texts.length)
        }, intervalMs)

        return () => clearInterval(timer)
    }, [texts, intervalMs])

    return (
        <div className={`relative overflow-hidden flex items-center justify-center ${className}`}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={index}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-full text-center"
                >
                    {texts[index]}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}

export default RollingText
