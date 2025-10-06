const hre = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("Checking environment configuration...");

  // Check if we have the required environment variables
  if (
    !process.env.INFURA_API_KEY ||
    process.env.INFURA_API_KEY === "your_infura_api_key_here"
  ) {
    console.error("❌ INFURA_API_KEY is not set in .env file");
    console.log("Please:");
    console.log("1. Go to https://infura.io and create a free account");
    console.log("2. Create a new project and get your API key");
    console.log("3. Update the INFURA_API_KEY in your .env file");
    process.exit(1);
  }

  if (!process.env.PRIVATE_KEY) {
    console.error("❌ PRIVATE_KEY is not set in .env file");
    process.exit(1);
  }

  console.log("✅ Environment configuration looks good");
  console.log(`Network: ${hre.network.name}`);

  try {
    console.log("Deploying KPIManager contract...");

    // Get the ContractFactory and Signers here.
    const KPIManager = await hre.ethers.getContractFactory("KPIManager");

    // Get deployer info before deployment
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

    if (balance === 0n) {
      console.error("❌ Account has no ETH for deployment");
      console.log("Please get some Sepolia ETH from:");
      console.log("- https://sepoliafaucet.com/");
      console.log("- https://faucet.sepolia.dev/");
      process.exit(1);
    }

    // Deploy the contract
    console.log("Deploying contract...");
    const kpiManager = await KPIManager.deploy();

    console.log("Waiting for deployment transaction...");
    await kpiManager.waitForDeployment();

    const contractAddress = await kpiManager.getAddress();

    console.log("✅ KPIManager deployed successfully!");
    console.log("📍 Contract address:", contractAddress);
    console.log(
      "🔗 Transaction hash:",
      kpiManager.deploymentTransaction().hash
    );

    // Wait for a few confirmations before verification
    if (hre.network.name !== "hardhat") {
      console.log("⏳ Waiting for block confirmations...");
      await kpiManager.deploymentTransaction().wait(6);

      console.log("✅ Contract deployment confirmed!");

      // Save deployment info
      const fs = require("fs");
      const deploymentInfo = {
        contractAddress: contractAddress,
        network: hre.network.name,
        deployer: deployer.address,
        deploymentTime: new Date().toISOString(),
        transactionHash: kpiManager.deploymentTransaction().hash,
        blockNumber: (await kpiManager.deploymentTransaction().wait())
          .blockNumber,
      };

      fs.writeFileSync(
        "deployment-info.json",
        JSON.stringify(deploymentInfo, null, 2)
      );
      console.log("💾 Deployment info saved to deployment-info.json");

      // Verification instructions
      console.log("\n🔍 To verify the contract on Etherscan, run:");
      console.log(
        `npx hardhat verify --network ${hre.network.name} ${contractAddress}`
      );

      console.log("\n🎉 Deployment Summary:");
      console.log(`Contract: KPIManager`);
      console.log(`Address: ${contractAddress}`);
      console.log(`Network: ${hre.network.name}`);
      console.log(`Deployer: ${deployer.address}`);
      console.log(
        `Gas used: ${(
          await kpiManager.deploymentTransaction().wait()
        ).gasUsed.toString()}`
      );
    }
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);

    if (error.code === "INSUFFICIENT_FUNDS") {
      console.log("💡 Your account doesn't have enough ETH for deployment");
      console.log("Get Sepolia ETH from: https://sepoliafaucet.com/");
    } else if (error.code === "NETWORK_ERROR") {
      console.log("💡 Network connection issue - check your Infura API key");
    }

    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  });
