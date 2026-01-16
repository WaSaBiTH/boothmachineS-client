# BoothMachine Smart Screen Client

A Next.js 14 client application for the BoothMachine Smart Room Display System. This client runs on classroom displays (Raspberry Pi, Windows, etc.), showing room availability, schedules, and QR codes for check-in.

## Features

- **Dynamic Identification**: Automatically detects the device's Real MAC Address and IP Address at runtime.
- **Persistent Heartbeat**: Periodically reports IP usage to the API (every 30s by default) to keep status live.
- **Auto-Configuration**: Updates `.env` automatically on startup using `auto_config.py`.
- **Configurable API**: Supports split Host/Port configuration.
- **Cross-Platform Setup**: Includes `setup_device.py` for easy initialization.

## Prerequisites

- Node.js 18+
- Python 3.x (For auto-configuration scripts)

## Getting Started

### 1. Initial Setup

Run the interactive setup script to configure the API connection.

```bash
# Windows / Linux / macOS
python scripts/setup_device.py
```

Prompts:
- **API URL**: The URL of your main `boothmachineS-config` API (e.g., `http://192.168.1.10:4000`).
- **Client Port**: The port this screen should run on (e.g., `3001.`).

This will generate a `.env` file and platform-specific startup scripts.

### 2. Running the Application

You can use the native npm commands or the generated helper scripts.

#### Using Helper Scripts (Recommended)

- **Windows**: Double-click `start_client.bat`.
- **Linux / Raspberry Pi**: Run `./start_client.sh`.

#### Using NPM

```bash
npm run dev
# or
npm start
```

> [!NOTE]
> When you run `npm run dev` or `npm start`, the `scripts/auto_config.py` script runs automatically first. It detects your current network interface's MAC address and IP, then injects them into `.env`. This ensures the device ID always matches the physical hardware.

## Configuration

The `.env` file is automatically managed, but you can manually configure the API connection:

```env
# API Configuration
NEXT_PUBLIC_API_HOST=http://localhost
NEXT_PUBLIC_API_PORT=4000

# Client Port
PORT=3001

# Heartbeat Configuration
NEXT_PUBLIC_POLLING_INTERVAL=30000 
# (in ms, default: 30000)

# Auto-Generated (Do not edit manually unless necessary)
NEXT_PUBLIC_DEVICE_ID=XX:XX:XX:XX:XX:XX
NEXT_PUBLIC_DEVICE_IP=192.168.X.X
```

## Project Structure

- `app/`: Next.js App Router source code.
- `scripts/`: Python utility scripts (`setup_device.py`, `auto_config.py`).
- `start_client.*`: Convenience startup scripts.
