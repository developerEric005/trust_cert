import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import * as path from "path";

// Load from contracts/.env first, then fallback to root .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const RPC_URL = process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
const PRIVATE_KEY = process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.startsWith("0x") && process.env.PRIVATE_KEY.length === 66
  ? [process.env.PRIVATE_KEY]
  : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    amoy: {
      url: RPC_URL,
      accounts: PRIVATE_KEY,
      chainId: 80002,
    },
  },
};

export default config;
