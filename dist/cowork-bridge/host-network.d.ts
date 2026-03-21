/**
 * Host Network Detection
 *
 * Detects the host gateway IP that a VM (Co-work, WSL2) can use
 * to reach UABServer on the host machine.
 *
 * Also generates API keys for authenticated access.
 */
export interface HostNetworkInfo {
    /** IP address that VMs can reach the host on */
    hostIp: string;
    /** How the IP was detected */
    method: 'wsl-adapter' | 'hyperv-adapter' | 'vm-adapter' | 'lan' | 'fallback';
    /** Name of the network adapter used */
    adapterName: string;
}
/**
 * Detect the host IP that a VM can use to reach the host.
 *
 * Priority:
 * 1. WSL / Hyper-V virtual ethernet adapter (172.x.x.x range)
 * 2. Any vEthernet / vmnet adapter
 * 3. LAN IP (Wi-Fi or Ethernet)
 * 4. Fallback to 127.0.0.1
 */
export declare function detectHostGatewayIp(): HostNetworkInfo;
/**
 * Generate a random API key for UABServer authentication.
 */
export declare function generateApiKey(): string;
/**
 * Get or create a persisted API key.
 * The same key is used across installs so existing skill files stay valid.
 */
export declare function getOrCreateApiKey(): string;
//# sourceMappingURL=host-network.d.ts.map