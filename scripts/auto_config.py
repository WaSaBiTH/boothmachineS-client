import os
import socket
import uuid
import sys
import platform
import subprocess
import re

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
    # Try to find interface for the IP
    try:
        # ip route get <ip> usually tells us the interface
        # output example: "10.254.254.254 via 192.168.1.1 dev eth0 src 192.168.1.50 uid 1000"
        if not ip or ip == '127.0.0.1': return None
        
        result = subprocess.check_output(f"ip route get {ip}", shell=True).decode()
        match = re.search(r"dev\s+(\S+)", result)
        if match:
            interface = match.group(1)
            with open(f"/sys/class/net/{interface}/address", 'r') as f:
                return f.read().strip().upper()
    except Exception as e:
        pass
    return None

def get_mac_address_global():
    # Fallback to uuid
    mac = uuid.getnode()
    return ':'.join(('%012X' % mac)[i:i+2] for i in range(0, 12, 2))

def get_real_mac(ip):
    system = platform.system()
    mac = None
    
    if system == "Linux":
        mac = get_mac_address_linux(ip)
    
    if not mac:
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
    
    # Update existing lines
    for line in env_lines:
        line = line.strip()
        if not line or line.startswith('#'):
            new_lines.append(line)
            continue
            
        key = line.split('=')[0].strip()
        if key == 'NEXT_PUBLIC_DEVICE_ID':
            new_lines.append(f"NEXT_PUBLIC_DEVICE_ID={mac}")
            keys_updated.add(key)
        elif key == 'NEXT_PUBLIC_DEVICE_IP':
            new_lines.append(f"NEXT_PUBLIC_DEVICE_IP={ip}")
            keys_updated.add(key)
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

if __name__ == "__main__":
    update_env()
