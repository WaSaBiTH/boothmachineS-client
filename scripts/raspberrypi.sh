#!/bin/bash
set -e

RED='\033[31m'; GREEN='\033[32m'; YELLOW='\033[0;33m'; MAGENTA='\033[35m'; CYAN='\033[36m'; NC='\033[0m'

REAL_USER="${SUDO_USER:-$(logname)}"
REPO_NAME="boothmachineS-client"
REPO_URL="https://github.com/WaSaBiTH/boothmachineS-client.git"

log(){
    local level="$1"; shift
    case "$level" in
        info) color=$GREEN ;;
        sub) color=$CYAN ;;
        warn) color=$YELLOW ;;
        error) color=$RED ;;
    esac
    printf "${color}%s${NC}\n" "$*"
}
run() {
    printf "${MAGENTA}Run \"%s\"${NC}\n" "$*";
    "$@";
}
root() { 
    run sudo "$@"; 
}

log info "Raspberry Pi Installer Script"

if [[ $EUID -eq 0 ]]; then
    log warn "This script is running as root."
    log warn "Running installer scripts as root may create root-owned files."
    printf "${CYAN}Continue anyway? (y/N): ${NC}"
    read -r CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        printf "${RED}Aborted.${NC}\n"
        exit 1
    fi
fi

log sub "Please Enter Password For Sudo If Prompt"
sudo -v

log info "Checking system time"
SERVER_DATE=$(curl -s --head http://google.com | grep '^Date:' | cut -d' ' -f 3-)
SERVER_EPOCH=$(date -d "$SERVER_DATE" +%s)
LOCAL_EPOCH=$(date -u +%s)
DIFF=$(( SERVER_EPOCH - LOCAL_EPOCH ))
ABS_DIFF=${DIFF#-}
if [ "$ABS_DIFF" -gt 5 ]; then
    log info "System time differs by ${ABS_DIFF}s, updating..."
    root date -s "$SERVER_DATE"
else
    log sub "System time is accurate (diff ${ABS_DIFF}s)"
fi

log info "Checking for System upgradable packages"
root apt update
root apt upgrade -y
log sub "System is up to date"

if ! command -v node >/dev/null 2>&1; then
    log warn "Node.js is not installed"
    log info "Installing Node.js current"
    if [ -f /etc/apt/sources.list.d/nodesource.sources ]; then
        log sub "NodeSource repo already exists"
        log sub "Skipping node repo init"
    else
        log sub "Adding Nodesource to apt source list"
        run curl -fsSL https://deb.nodesource.com/setup_current.x | sudo bash -
    fi
    root apt install -y nodejs
    log sub "Finished installed and"
else
    log sub "Node is installed and"
fi
log sub "Node $(node -v) | npm $(npm -v)"

log info "Checking for ${REPO_NAME}"
if [ ! -d "$REPO_NAME" ]; then
    log warn "${REPO_NAME} not found, cloning..."
    run git clone "$REPO_URL"
else
    log sub "${REPO_NAME} already exists, skipping clone"
    log sub "Updating repository"
    git -C "$REPO_NAME" pull
fi

run cd "$REPO_NAME"
APP_DIR="$(pwd)"

log info "Checking node modules"

if [ -d node_modules ]; then
    log warn "node_modules already exists, skipping install"
else
    log sub "Fresh install node modules"
    run npm ci || {
        log warn "npm install failed, retrying..."
        run ci || true
    }
fi

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    log info "No .env found, running setup script"
    python3 ./scripts/setup_device.py
else
    log sub ".env already exists, skipping setup"
fi

log info "Start build next project"
run npm run build

log info "Generate Systemd Service Startup"
if [[ -L "/etc/systemd/system/boothmachineS-client.service" ]]; then
    log warn "old service exit at /etc/systemd/system/boothmachineS-client.service"
    log warn "Disable old service before continue"
    root systemctl stop boothmachineS-client.service
    root systemctl disable boothmachineS-client.service
    run rm ./scripts/boothmachineS-client.service
fi
log sub "Generate new Systemd Service file"
run tee ./scripts/boothmachineS-client.service >/dev/null <<EOF
[Unit]
Description=boothmachineS-client runtime service
After=network.target

[Service]
User=$REAL_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

root systemctl enable --now ./scripts/boothmachineS-client.service

log info "Adding labwc start chromium kiosk"
AUTOSTART="$HOME/.config/labwc/autostart"
log sub "checking if autostart exit"
if [ -f "$AUTOSTART" ]; then
    rm "$AUTOSTART"
fi

PORT=$(grep '^PORT=' .env | cut -d '=' -f2)
run tee "$AUTOSTART" >/dev/null << EOF
#!/bin/bash
chromium --kiosk --noerrdialogs --disable-infobars --no-first-run --enable-features=OverlayScrollbar --start-maximized --password-store=basic http://127.0.0.1:$PORT
EOF
run chmod 0755 "$AUTOSTART"
log info "Finish setting the environment\n The suggestion now is to reboot the device."
log warn "After reboot, if everything works correctly\n you should see Chromium open withboothmachineS-client open"
