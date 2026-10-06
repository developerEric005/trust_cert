import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("==================================================");
  console.log(`Deploying TrustCert on network: ${network.name}`);
  console.log(`Deployer address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} POL / MATIC`);

  if (balance === 0n && network.name !== "hardhat") {
    console.warn("WARNING: Deployer wallet balance is 0. Deployment may fail if gas is required.");
  }

  // 1. Deploy TrustCert
  const TrustCertFactory = await ethers.getContractFactory("TrustCert");
  const trustCert = await TrustCertFactory.deploy();
  await trustCert.waitForDeployment();

  const contractAddress = await trustCert.getAddress();
  const txHash = trustCert.deploymentTransaction()?.hash;
  console.log(`TrustCert deployed successfully at: ${contractAddress}`);
  if (txHash) {
    console.log(`Deployment Tx Hash: ${txHash}`);
  }

  // 2. Approve deployer wallet so it can register roots / act as initial test university
  console.log(`Approving deployer (${deployer.address}) as initial university...`);
  const approveTx = await trustCert.approveUniversity(deployer.address);
  await approveTx.wait();
  console.log(`Deployer approved on-chain!`);

  // 3. Print Polygonscan link if on Amoy
  if (network.name === "amoy" || network.config.chainId === 80002) {
    console.log(`Polygonscan Amoy: https://amoy.polygonscan.com/address/${contractAddress}`);
  }

  // 4. Write /contracts/deployments/amoy.json (or ${network.name}.json)
  const deploymentsDir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentData = {
    network: network.name,
    chainId: network.config.chainId || 80002,
    contractAddress,
    deployer: deployer.address,
    deploymentTx: txHash,
    deployedAt: new Date().toISOString(),
    explorerUrl: `https://amoy.polygonscan.com/address/${contractAddress}`,
  };

  const deploymentFilePath = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
  console.log(`Deployment record saved to: ${deploymentFilePath}`);

  // Also write amoy.json specifically if deployed on amoy or localhost
  const amoyRecordPath = path.join(deploymentsDir, "amoy.json");
  fs.writeFileSync(amoyRecordPath, JSON.stringify(deploymentData, null, 2));
  console.log(`Deployment record also saved to: ${amoyRecordPath}`);

  // 5. Copy ABI to /backend/src/abi/TrustCert.json
  const artifactPath = path.resolve(
    __dirname,
    "../artifacts/contracts/TrustCert.sol/TrustCert.json"
  );
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    const backendAbiDir = path.resolve(__dirname, "../../backend/src/abi");
    if (!fs.existsSync(backendAbiDir)) {
      fs.mkdirSync(backendAbiDir, { recursive: true });
    }
    const backendAbiPath = path.join(backendAbiDir, "TrustCert.json");
    fs.writeFileSync(
      backendAbiPath,
      JSON.stringify({ address: contractAddress, abi: artifact.abi }, null, 2)
    );
    console.log(`Contract ABI and address copied to: ${backendAbiPath}`);
  } else {
    console.warn(`Artifact not found at ${artifactPath}. Run 'npm run compile' first.`);
  }

  console.log("==================================================");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
