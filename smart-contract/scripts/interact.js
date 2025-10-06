const hre = require("hardhat");

async function main() {
  // Replace with your deployed contract address
  const contractAddress =
    process.env.CONTRACT_ADDRESS || "YOUR_CONTRACT_ADDRESS_HERE";

  if (contractAddress === "YOUR_CONTRACT_ADDRESS_HERE") {
    console.error(
      "Please set the CONTRACT_ADDRESS environment variable or update the script"
    );
    process.exit(1);
  }

  console.log(`Interacting with KPIManager contract at: ${contractAddress}`);

  // Get the contract instance
  const KPIManager = await hre.ethers.getContractFactory("KPIManager");
  const kpiManager = KPIManager.attach(contractAddress);

  // Example usage
  const [signer] = await hre.ethers.getSigners();
  console.log("Using account:", signer.address);

  // Example hash from your credential system
  const exampleHash =
    "59994ab0b1b46f8d11c2b6b3574778644dd51293dee51634c4d6ea82cf7b97b5";
  const baseline = 1000;
  const savings = 250;

  try {
    console.log("\n--- Setting KPIs ---");
    console.log(`Hash: ${exampleHash}`);
    console.log(`Baseline: ${baseline}`);
    console.log(`Savings: ${savings}`);

    // Set KPIs
    const tx = await kpiManager.setKPIs(exampleHash, baseline, savings);
    console.log("Transaction hash:", tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

    // Get the events
    const events = receipt.logs.filter((log) => {
      try {
        return kpiManager.interface.parseLog(log);
      } catch {
        return false;
      }
    });

    if (events.length > 0) {
      console.log("\n--- Events Emitted ---");
      events.forEach((log) => {
        const parsedLog = kpiManager.interface.parseLog(log);
        if (parsedLog.name === "KPIsSet") {
          console.log("KPIsSet Event:");
          console.log(`  Hash: ${parsedLog.args.hash}`);
          console.log(`  Baseline: ${parsedLog.args.baseline}`);
          console.log(`  Savings: ${parsedLog.args.savings}`);
          console.log(
            `  New Total Baseline: ${parsedLog.args.newTotalBaseline}`
          );
          console.log(`  New Total Savings: ${parsedLog.args.newTotalSavings}`);
          console.log(`  Sender: ${parsedLog.args.sender}`);
        }
      });
    }

    console.log("\n--- Getting KPIs ---");
    // Get KPIs
    const result = await kpiManager.getKPIs(exampleHash);
    console.log(`Total Baseline: ${result.totalBaseline}`);
    console.log(`Total Savings: ${result.totalSavings}`);
    console.log(`Entry Count: ${result.entryCount}`);
    console.log(`Exists: ${result.exists}`);

    // Get global stats
    console.log("\n--- Global Stats ---");
    const globalStats = await kpiManager.getGlobalStats();
    console.log(`Total Unique Hashes: ${globalStats.totalUniqueHashes}`);
    console.log(`Global Baseline: ${globalStats.globalBaseline}`);
    console.log(`Global Savings: ${globalStats.globalSavings}`);
    console.log(`Total Entries: ${globalStats.totalEntries}`);
  } catch (error) {
    console.error("Error:", error.message);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
