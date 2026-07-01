import { EventEmitter } from "node:events";
import { Wallet, JsonRpcProvider, Contract, formatUnits, parseUnits } from "ethers";
import type { AppConfig } from "@main/config";
import type { WalletSnapshot } from "@shared/types";

const USDC_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const CTF_ABI = [
  "function getProxyForMarket(address marketId) view returns (address)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
];

export class WalletService extends EventEmitter {
  private wallet: Wallet | null = null;
  private provider: JsonRpcProvider;
  private _address: string | null = null;

  constructor(private readonly config: AppConfig) {
    super();
    this.provider = new JsonRpcProvider(config.polygonRpc, config.chainId);
  }

  get isConnected(): boolean {
    return this.wallet !== null;
  }

  get address(): string | null {
    return this._address;
  }

  get signer(): Wallet | null {
    return this.wallet;
  }

  async connect(): Promise<void> {
    if (!this.config.privateKey) {
      this.emit("error", "No private key configured");
      return;
    }

    try {
      this.wallet = new Wallet(this.config.privateKey, this.provider);
      this._address = await this.wallet.getAddress();
      this.emit("connected", this._address);
    } catch (err) {
      this.wallet = null;
      this._address = null;
      this.emit("error", `Wallet init failed: ${err}`);
    }
  }

  disconnect(): void {
    this.wallet = null;
    this._address = null;
    this.emit("disconnected");
  }

  async snapshot(): Promise<WalletSnapshot> {
    const usdc = await this.getUsdcBalance();
    const polygon = await this.getPolygonBalance();
    return {
      status: this.wallet ? "connected" : "disconnected",
      address: this._address,
      network: "Polygon",
      usdcBalance: usdc,
      polygonBalance: polygon,
    };
  }

  async getUsdcBalance(): Promise<number> {
    if (!this.wallet || !this._address) return 0;
    try {
      const usdc = new Contract(this.config.usdcContract, USDC_ABI, this.provider);
      const balance = await usdc.balanceOf(this._address);
      return Number(formatUnits(balance, 6));
    } catch {
      return 0;
    }
  }

  async getPolygonBalance(): Promise<number> {
    if (!this.wallet || !this._address) return 0;
    try {
      const balance = await this.provider.getBalance(this._address);
      return Number(formatUnits(balance, 18));
    } catch {
      return 0;
    }
  }

  async approveUsdc(spender: string, amount: number): Promise<boolean> {
    if (!this.wallet) return false;
    try {
      const usdc = new Contract(this.config.usdcContract, USDC_ABI, this.wallet);
      const parsed = parseUnits(amount.toFixed(6), 6);
      const tx = await usdc.approve(spender, parsed);
      await tx.wait();
      return true;
    } catch (err) {
      console.error("[wallet] approve failed:", err);
      return false;
    }
  }

  async getUsdcAllowance(spender: string): Promise<number> {
    if (!this.wallet || !this._address) return 0;
    try {
      const usdc = new Contract(this.config.usdcContract, USDC_ABI, this.provider);
      const allowance = await usdc.allowance(this._address, spender);
      return Number(formatUnits(allowance, 6));
    } catch {
      return 0;
    }
  }
}
