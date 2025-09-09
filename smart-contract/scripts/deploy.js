const hre = require("hardhat");

async function main() {
  console.log("Deploying KPIManager contract...");

  // Get the ContractFactory and Signers here.
  const KPIManager = await hre.ethers.getContractFactory("KPIManager");

  // Deploy the contract
  const kpiManager = await KPIManager.deploy();

  await kpiManager.waitForDeployment();

  const contractAddress = await kpiManager.getAddress();

  console.log("KPIManager deployed to:", contractAddress);

  // Get the deployer's address
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployed by:", deployer.address);
  console.log(
    "Deployer balance:",
    hre.ethers.formatEther(
      await hre.ethers.provider.getBalance(deployer.address)
    ),
    "ETH"
  );

  // Wait for a few confirmations before verification
  if (hre.network.name !== "hardhat") {
    console.log("Waiting for confirmations...");
    await kpiManager.deploymentTransaction().wait(6);

    console.log("Contract deployed and confirmed!");
    console.log(`Contract address: ${contractAddress}`);
    console.log(`Network: ${hre.network.name}`);

    // Save deployment info
    const fs = require("fs");
    const deploymentInfo = {
      contractAddress: contractAddress,
      network: hre.network.name,
      deployer: deployer.address,
      deploymentTime: new Date().toISOString(),
      transactionHash: kpiManager.deploymentTransaction().hash,
    };

    fs.writeFileSync(
      "deployment-info.json",
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("Deployment info saved to deployment-info.json");

    // Verification instructions
    console.log("\nTo verify the contract on Etherscan, run:");
    console.log(
      `npx hardhat verify --network ${hre.network.name} ${contractAddress}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
