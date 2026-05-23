const hre = require("hardhat");
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying SignedSeal from:", deployer.address);
  const F = await hre.ethers.getContractFactory("SignedSeal");
  const c = await F.deploy();
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("SignedSeal deployed:", addr);
  console.log("https://testnet.arcscan.app/address/" + addr);
  console.log("VITE_CONTRACT_ADDRESS=" + addr);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
