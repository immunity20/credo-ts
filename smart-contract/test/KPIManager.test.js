const { expect } = require("chai");
const { ethers } = require("hardhat");

// Import anyValue for testing timestamp in events
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("KPIManager", function () {
  let KPIManager;
  let kpiManager;
  let owner;
  let addr1;
  let addr2;

  const testHash1 =
    "59994ab0b1b46f8d11c2b6b3574778644dd51293dee51634c4d6ea82cf7b97b5";
  const testHash2 =
    "abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yz567890abcdef12";

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    KPIManager = await ethers.getContractFactory("KPIManager");
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy a new contract for each test
    kpiManager = await KPIManager.deploy();
    await kpiManager.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await kpiManager.owner()).to.equal(owner.address);
    });

    it("Should start with zero hashes", async function () {
      expect(await kpiManager.getHashCount()).to.equal(0);
    });
  });

  describe("Setting KPIs", function () {
    it("Should set KPIs correctly for a new hash", async function () {
      const baseline = 1000;
      const savings = 250;

      await expect(kpiManager.setKPIs(testHash1, baseline, savings))
        .to.emit(kpiManager, "KPIsSet")
        .withArgs(
          testHash1,
          baseline,
          savings,
          baseline,
          savings,
          owner.address,
          anyValue
        );

      const result = await kpiManager.getKPIs(testHash1);
      expect(result.totalBaseline).to.equal(baseline);
      expect(result.totalSavings).to.equal(savings);
      expect(result.entryCount).to.equal(1);
      expect(result.exists).to.equal(true);
    });

    it("Should accumulate KPIs for existing hash", async function () {
      const baseline1 = 1000;
      const savings1 = 250;
      const baseline2 = 500;
      const savings2 = 150;

      // First entry
      await kpiManager.setKPIs(testHash1, baseline1, savings1);

      // Second entry
      await kpiManager.setKPIs(testHash1, baseline2, savings2);

      const result = await kpiManager.getKPIs(testHash1);
      expect(result.totalBaseline).to.equal(baseline1 + baseline2);
      expect(result.totalSavings).to.equal(savings1 + savings2);
      expect(result.entryCount).to.equal(2);
      expect(result.exists).to.equal(true);
    });

    it("Should emit KPIsUpdated event", async function () {
      const baseline1 = 1000;
      const savings1 = 250;
      const baseline2 = 500;
      const savings2 = 150;

      await kpiManager.setKPIs(testHash1, baseline1, savings1);

      await expect(kpiManager.setKPIs(testHash1, baseline2, savings2))
        .to.emit(kpiManager, "KPIsUpdated")
        .withArgs(
          testHash1,
          baseline1,
          savings1,
          baseline1 + baseline2,
          savings1 + savings2,
          2
        );
    });

    it("Should reject empty hash", async function () {
      await expect(kpiManager.setKPIs("", 1000, 250)).to.be.revertedWith(
        "Hash cannot be empty"
      );
    });

    it("Should reject zero values for both baseline and savings", async function () {
      await expect(kpiManager.setKPIs(testHash1, 0, 0)).to.be.revertedWith(
        "At least one value must be greater than 0"
      );
    });

    it("Should allow zero baseline with positive savings", async function () {
      await kpiManager.setKPIs(testHash1, 0, 250);
      const result = await kpiManager.getKPIs(testHash1);
      expect(result.totalBaseline).to.equal(0);
      expect(result.totalSavings).to.equal(250);
    });

    it("Should allow zero savings with positive baseline", async function () {
      await kpiManager.setKPIs(testHash1, 1000, 0);
      const result = await kpiManager.getKPIs(testHash1);
      expect(result.totalBaseline).to.equal(1000);
      expect(result.totalSavings).to.equal(0);
    });
  });

  describe("Getting KPIs", function () {
    it("Should return correct data for existing hash", async function () {
      const baseline = 1000;
      const savings = 250;

      await kpiManager.setKPIs(testHash1, baseline, savings);

      const result = await kpiManager.getKPIs(testHash1);
      expect(result.totalBaseline).to.equal(baseline);
      expect(result.totalSavings).to.equal(savings);
      expect(result.entryCount).to.equal(1);
      expect(result.exists).to.equal(true);
    });

    it("Should return zeros for non-existing hash", async function () {
      const result = await kpiManager.getKPIs("nonexistent");
      expect(result.totalBaseline).to.equal(0);
      expect(result.totalSavings).to.equal(0);
      expect(result.entryCount).to.equal(0);
      expect(result.exists).to.equal(false);
    });
  });

  describe("Hash management", function () {
    it("Should track all hashes", async function () {
      await kpiManager.setKPIs(testHash1, 1000, 250);
      await kpiManager.setKPIs(testHash2, 500, 100);

      const allHashes = await kpiManager.getAllHashes();
      expect(allHashes.length).to.equal(2);
      expect(allHashes).to.include(testHash1);
      expect(allHashes).to.include(testHash2);
    });

    it("Should not duplicate hashes", async function () {
      await kpiManager.setKPIs(testHash1, 1000, 250);
      await kpiManager.setKPIs(testHash1, 500, 100);

      const allHashes = await kpiManager.getAllHashes();
      expect(allHashes.length).to.equal(1);
      expect(allHashes[0]).to.equal(testHash1);
    });

    it("Should check hash existence correctly", async function () {
      expect(await kpiManager.hashExists(testHash1)).to.equal(false);

      await kpiManager.setKPIs(testHash1, 1000, 250);

      expect(await kpiManager.hashExists(testHash1)).to.equal(true);
      expect(await kpiManager.hashExists(testHash2)).to.equal(false);
    });
  });

  describe("Batch operations", function () {
    beforeEach(async function () {
      await kpiManager.setKPIs(testHash1, 1000, 250);
      await kpiManager.setKPIs(testHash2, 500, 100);
    });

    it("Should return batch KPI data correctly", async function () {
      const hashes = [testHash1, testHash2, "nonexistent"];
      const result = await kpiManager.getBatchKPIs(hashes);

      expect(result.baselines[0]).to.equal(1000);
      expect(result.savings[0]).to.equal(250);
      expect(result.entryCounts[0]).to.equal(1);
      expect(result.existsFlags[0]).to.equal(true);

      expect(result.baselines[1]).to.equal(500);
      expect(result.savings[1]).to.equal(100);
      expect(result.entryCounts[1]).to.equal(1);
      expect(result.existsFlags[1]).to.equal(true);

      expect(result.baselines[2]).to.equal(0);
      expect(result.savings[2]).to.equal(0);
      expect(result.entryCounts[2]).to.equal(0);
      expect(result.existsFlags[2]).to.equal(false);
    });
  });

  describe("Global statistics", function () {
    it("Should calculate global stats correctly", async function () {
      await kpiManager.setKPIs(testHash1, 1000, 250);
      await kpiManager.setKPIs(testHash2, 500, 100);
      await kpiManager.setKPIs(testHash1, 200, 50); // Add more to first hash

      const stats = await kpiManager.getGlobalStats();
      expect(stats.totalUniqueHashes).to.equal(2);
      expect(stats.globalBaseline).to.equal(1700); // 1000 + 200 + 500
      expect(stats.globalSavings).to.equal(400); // 250 + 50 + 100
      expect(stats.totalEntries).to.equal(3); // 3 total setKPIs calls
    });

    it("Should return zeros for empty contract", async function () {
      const stats = await kpiManager.getGlobalStats();
      expect(stats.totalUniqueHashes).to.equal(0);
      expect(stats.globalBaseline).to.equal(0);
      expect(stats.globalSavings).to.equal(0);
      expect(stats.totalEntries).to.equal(0);
    });
  });

  describe("Access control", function () {
    it("Should allow anyone to set KPIs", async function () {
      await expect(kpiManager.connect(addr1).setKPIs(testHash1, 1000, 250)).to
        .not.be.reverted;
    });

    it("Should allow anyone to read KPIs", async function () {
      await kpiManager.setKPIs(testHash1, 1000, 250);

      const result = await kpiManager.connect(addr1).getKPIs(testHash1);
      expect(result.totalBaseline).to.equal(1000);
    });
  });
});
