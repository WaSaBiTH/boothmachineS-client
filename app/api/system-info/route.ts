import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
    const interfaces = os.networkInterfaces();
    let mac = '00:00:00:00:00:00';
    let ip = '127.0.0.1';

    // Strategy: Find the first non-internal IPv4 interface
    // Priority: Ethernet > WiFi > Others

    // Flatten interfaces into a single list with interface name attached
    const flatInterfaces: { name: string; info: os.NetworkInterfaceInfo }[] = [];

    Object.keys(interfaces).forEach((ifaceName) => {
        const ifaceInfo = interfaces[ifaceName];
        if (ifaceInfo) {
            ifaceInfo.forEach((info) => {
                flatInterfaces.push({ name: ifaceName, info });
            });
        }
    });

    // Filter valid interfaces
    const validInterfaces = flatInterfaces.filter(
        (item) => !item.info.internal && item.info.family === 'IPv4' && item.info.mac !== '00:00:00:00:00:00'
    );

    // Sorting logic for priority
    validInterfaces.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();

        // Check for Ethernet preference
        const isEthA = nameA.includes('eth') || nameA.includes('en') || nameA.includes('ethernet');
        const isEthB = nameB.includes('eth') || nameB.includes('en') || nameB.includes('ethernet');

        if (isEthA && !isEthB) return -1;
        if (!isEthA && isEthB) return 1;

        return 0;
    });

    if (validInterfaces.length > 0) {
        mac = validInterfaces[0].info.mac.toUpperCase();
        ip = validInterfaces[0].info.address;
    }

    return NextResponse.json({
        mac,
        ip
    });
}
