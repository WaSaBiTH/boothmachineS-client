import os
import socket
import uuid
import sys
import platform
import subprocess
import re

import urllib.request
import json
import threading
import time

def get_ip_address():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(0)
    try:
        # doesn't even have to be reachable
        s.connect(('10.254.254.254', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def get_mac_address_linux(ip):
    # Method 1: Try to find interface via route
    try:
        if ip and ip != '127.0.0.1':
            result = subprocess.check_output(f"ip route get {ip}", shell=True).decode()
            match = re.search(r"dev\s+(\S+)", result)
            if match:
                interface = match.group(1)
                with open(f"/sys/class/net/{interface}/address", 'r') as f:
                    mac = f.read().strip().upper()
                    if len(mac) == 17 and mac != '00:00:00:00:00:00':
                        return mac
    except Exception:
        pass

    # Method 2: Scan common interfaces in /sys/class/net
    try:
        if os.path.exists('/sys/class/net'):
            interfaces = os.listdir('/sys/class/net')
            # Sort to prefer eth0/wlan0 over others
            interfaces.sort()
            for iface in interfaces:
                if iface == 'lo' or iface.startswith('docker') or iface.startswith('veth'):
                    continue
                try:
                    with open(f"/sys/class/net/{iface}/address", 'r') as f:
                        mac = f.read().strip().upper()
                        # specific check for valid MAC format
                        if len(mac) == 17 and mac != '00:00:00:00:00:00':
                            return mac
                except:
                    continue
    except:
        pass
        
    return None

def get_mac_address_global():
    # Fallback to uuid
    try:
        mac_num = uuid.getnode()
        mac = ':'.join(('%012X' % mac_num)[i:i+2] for i in range(0, 12, 2))
        if mac != '00:00:00:00:00:00':
             return mac
    except: pass
    
    return "00:00:00:00:00:00"

def get_real_mac(ip):
    system = platform.system()
    mac = None
    
    if system == "Linux":
        mac = get_mac_address_linux(ip)
    
    if not mac or mac == '00:00:00:00:00:00':
        mac = get_mac_address_global()
        
    return mac

def update_env():
    print("--- Auto-Configuring Environment ---")
    
    ip = get_ip_address()
    mac = get_real_mac(ip)
    
    print(f"Detected IP:  {ip}")
    print(f"Detected MAC: {mac}")
    
    client_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(client_dir, '.env')
    
    env_lines = []
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            env_lines = f.readlines()
            
    new_lines = []
    keys_updated = set()
    
    # Track existing config
    config = {
        "PORT": "3000",
        "NEXT_PUBLIC_API_URL": "http://localhost:4000",
        "NEXT_PUBLIC_POLLING_INTERVAL": "30000" # Default 30s
    }

    # Update existing lines
    for line in env_lines:
        line = line.strip()
        if not line or line.startswith('#'):
            new_lines.append(line)
            continue
            
        key_val = line.split('=')
        key = key_val[0].strip()
        val = key_val[1].strip() if len(key_val) > 1 else ""
        
        if key == 'NEXT_PUBLIC_DEVICE_ID':
            new_lines.append(f"NEXT_PUBLIC_DEVICE_ID={mac}")
            keys_updated.add(key)
        elif key == 'NEXT_PUBLIC_DEVICE_IP':
            new_lines.append(f"NEXT_PUBLIC_DEVICE_IP={ip}")
            keys_updated.add(key)
        elif key in config:
            if val:
                config[key] = val
            new_lines.append(line)
        else:
            new_lines.append(line)
            
    # Add if missing
    if 'NEXT_PUBLIC_DEVICE_ID' not in keys_updated:
        new_lines.append(f"NEXT_PUBLIC_DEVICE_ID={mac}")
    if 'NEXT_PUBLIC_DEVICE_IP' not in keys_updated:
        new_lines.append(f"NEXT_PUBLIC_DEVICE_IP={ip}")
        
    with open(env_path, 'w') as f:
        f.write('\n'.join(new_lines) + '\n')
        
    print(f"Updated {env_path}")
    print("------------------------------------")
    
    return {
        "port": config["PORT"],
        "api_url": config["NEXT_PUBLIC_API_URL"],
        "polling_interval": int(config.get("NEXT_PUBLIC_POLLING_INTERVAL", 30000)),
        "ip": ip,
        "mac": mac
    }

def send_heartbeat(api_url, mac, ip):
    # Fix URL Protocol
    if not api_url.startswith('http'):
        api_url = f"http://{api_url}"

    url = f"{api_url}/api/device/heartbeat"
    data = {
        "macAddress": mac,
        "ipAddress": ip
    }
    
    try:
        req = urllib.request.Request(
            url, 
            data=json.dumps(data).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                # print(f"Heartbeat sent to {url}")
                pass
            else:
                print(f"Heartbeat failed: {response.status}")
    except Exception as e:
        print(f"Heartbeat error: {e}")

def heartbeat_loop(config):
    # Normalize URL once
    api_url = config['api_url']
    if not api_url.startswith('http'):
        api_url = f"http://{api_url}"

    interval = config["polling_interval"] / 1000.0 # Convert to seconds
    if interval < 5: interval = 5 # Minimum 5 seconds
    
    print(f"Starting heartbeat loop every {interval}s to {api_url}")
    
    while True:
        # Re-detect IP in case it changes
        current_ip = get_ip_address()
        send_heartbeat(api_url, config["mac"], current_ip)
        time.sleep(interval)

def run_command(command, port):
    if not command:
        return

    cmd = []
    if command == "dev":
        cmd = ["npx", "next", "dev", "-p", port, "-H", "127.0.0.1"]
    elif command == "start":
        cmd = ["npx", "next", "start", "-p", port, "-H", "127.0.0.1"]
    elif command == "build":
        cmd = ["npx", "next", "build"]
    else:
        print(f"Unknown command: {command}")
        return

    print(f"Exec: {' '.join(cmd)}")
    try:
        # shell=True is often needed on Windows for npx resolution if not fully qualified
        subprocess.run(cmd, shell=(platform.system() == "Windows"))
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"Error running command: {e}")

if __name__ == "__main__":
    config = update_env()
    
    # Start heartbeat thread
    if config["api_url"]:
        t = threading.Thread(target=heartbeat_loop, args=(config,), daemon=True)
        t.start()
    
    if len(sys.argv) > 1:
        run_command(sys.argv[1], config["port"])
