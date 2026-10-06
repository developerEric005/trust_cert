import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const RPC_URL = process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Load contract ABI
let abi: any = [];
const abiPath = path.resolve(__dirname, "../abi/TrustCert.json");
if (fs.existsSync(abiPath)) {
  const fileContent = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
  abi = fileContent.abi || fileContent;
}

export class ChainService {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  public contractAddress: string;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contractAddress = CONTRACT_ADDRESS || "";

    if (
      PRIVATE_KEY &&
      PRIVATE_KEY.startsWith("0x") &&
      PRIVATE_KEY.length === 66
    ) {
      this.signer = new ethers.Wallet(PRIVATE_KEY, this.provider);
      if (this.contractAddress) {
        this.contract = new ethers.Contract(this.contractAddress, abi, this.signer);
      }
    } else if (this.contractAddress) {
      // Read-only contract instance
      this.contract = new ethers.Contract(this.contractAddress, abi, this.provider);
    }
  }

  private ensureContract(): ethers.Contract {
    if (!this.contract) {
      if (!this.contractAddress) {
        throw new Error(
          "CONTRACT_ADDRESS is not configured in .env. Please deploy the contract first."
        );
      }
      this.contract = new ethers.Contract(
        this.contractAddress,
        abi,
        this.signer || this.provider
      );
    }
    return this.contract;
  }

  private ensureSigner(): ethers.Wallet {
    if (!this.signer) {
      throw new Error(
        "PRIVATE_KEY is not configured or invalid in .env. Cannot submit transactions."
      );
    }
    return this.signer;
  }

  /**
   * Registers a Merkle root on-chain for a batch of certificates.
   */
  async registerRoot(
    root: string,
    count: number
  ): Promise<{ txHash: string; blockNumber: number; batchId: number }> {
    this.ensureSigner();
    const contract = this.ensureContract();

    const tx = await contract.registerRoot(root, count);
    const receipt = await tx.wait(1);

    // Parse event logs for RootRegistered
    let batchId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === "RootRegistered") {
          batchId = Number(parsed.args[0]);
          break;
        }
      } catch {
        // Not a TrustCert event log
      }
    }

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      batchId,
    };
  }

  /**
   * Queries the issuer address of a Merkle root.
   * Returns ethers.ZeroAddress if unknown.
   */
  async rootIssuer(root: string): Promise<string> {
    const contract = this.ensureContract();
    return await contract.rootIssuer(root);
  }

  /**
   * Checks whether a certificate leaf has been revoked on-chain.
   */
  async isRevoked(leaf: string): Promise<boolean> {
    const contract = this.ensureContract();
    return await contract.isRevoked(leaf);
  }

  /**
   * Revokes a certificate leaf on-chain.
   */
  async revoke(
    leaf: string
  ): Promise<{ txHash: string; blockNumber: number }> {
    this.ensureSigner();
    const contract = this.ensureContract();

    const tx = await contract.revoke(leaf);
    const receipt = await tx.wait(1);

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  /**
   * Checks whether a university wallet is approved on-chain.
   */
  async isApproved(walletAddress: string): Promise<boolean> {
    const contract = this.ensureContract();
    return await contract.isApproved(walletAddress);
  }

  /**
   * Approves a university wallet on-chain (Owner-only).
   */
  async approveUniversity(
    walletAddress: string
  ): Promise<{ txHash: string }> {
    this.ensureSigner();
    const contract = this.ensureContract();

    const tx = await contract.approveUniversity(walletAddress);
    const receipt = await tx.wait(1);

    return {
      txHash: receipt.hash,
    };
  }
}

export const chainService = new ChainService();
