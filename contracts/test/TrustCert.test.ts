import { expect } from "chai";
import { ethers } from "hardhat";
import { TrustCert } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("TrustCert Smart Contract", function () {
  let trustCert: TrustCert;
  let owner: HardhatEthersSigner;
  let university1: HardhatEthersSigner;
  let university2: HardhatEthersSigner;
  let unapproved: HardhatEthersSigner;

  // Sample bytes32 values for testing
  const sampleRoot1 = "0x" + "11".repeat(32);
  const sampleRoot2 = "0x" + "22".repeat(32);
  const sampleLeaf1 = "0x" + "aa".repeat(32);
  const zeroBytes32 = ethers.ZeroHash;

  beforeEach(async function () {
    [owner, university1, university2, unapproved] = await ethers.getSigners();

    const TrustCertFactory = await ethers.getContractFactory("TrustCert");
    trustCert = await TrustCertFactory.deploy();
    await trustCert.waitForDeployment();
  });

  describe("University Approval", function () {
    it("owner can approve a university", async function () {
      expect(await trustCert.isApproved(university1.address)).to.equal(false);
      await expect(trustCert.connect(owner).approveUniversity(university1.address))
        .to.emit(trustCert, "UniversityApproved")
        .withArgs(university1.address);
      expect(await trustCert.isApproved(university1.address)).to.equal(true);
    });

    it("non-owner cannot approve a university (owner-only)", async function () {
      await expect(
        trustCert.connect(unapproved).approveUniversity(university1.address)
      ).to.be.revertedWithCustomError(trustCert, "OwnableUnauthorizedAccount");
    });

    it("reverts if approving zero address", async function () {
      await expect(
        trustCert.connect(owner).approveUniversity(ethers.ZeroAddress)
      ).to.be.revertedWith("Zero address");
    });
  });

  describe("Register Root", function () {
    beforeEach(async function () {
      await trustCert.connect(owner).approveUniversity(university1.address);
    });

    it("unapproved wallet cannot registerRoot", async function () {
      await expect(
        trustCert.connect(unapproved).registerRoot(sampleRoot1, 10)
      ).to.be.revertedWith("Not approved university");
    });

    it("registerRoot stores batch, sets rootIssuer, increments batchId starting at 1, and emits RootRegistered event", async function () {
      const tx = await trustCert.connect(university1).registerRoot(sampleRoot1, 42);
      await expect(tx)
        .to.emit(trustCert, "RootRegistered")
        .withArgs(1, sampleRoot1, university1.address, 42);

      // Verify batch storage
      const batch = await trustCert.batches(1);
      expect(batch.root).to.equal(sampleRoot1);
      expect(batch.issuer).to.equal(university1.address);
      expect(batch.count).to.equal(42);
      expect(batch.timestamp).to.be.greaterThan(0);

      // Verify rootIssuer for known root
      expect(await trustCert.rootIssuer(sampleRoot1)).to.equal(university1.address);

      // Second registration gets batchId 2
      const tx2 = await trustCert.connect(university1).registerRoot(sampleRoot2, 5);
      await expect(tx2)
        .to.emit(trustCert, "RootRegistered")
        .withArgs(2, sampleRoot2, university1.address, 5);
    });

    it("rootIssuer returns zero address for unknown root", async function () {
      expect(await trustCert.rootIssuer(sampleRoot1)).to.equal(ethers.ZeroAddress);
    });

    it("reverts on duplicate root", async function () {
      await trustCert.connect(university1).registerRoot(sampleRoot1, 10);
      await expect(
        trustCert.connect(university1).registerRoot(sampleRoot1, 20)
      ).to.be.revertedWith("Duplicate root");
    });

    it("reverts on zero root", async function () {
      await expect(
        trustCert.connect(university1).registerRoot(zeroBytes32, 10)
      ).to.be.revertedWith("Zero root");
    });

    it("reverts on zero count", async function () {
      await expect(
        trustCert.connect(university1).registerRoot(sampleRoot1, 0)
      ).to.be.revertedWith("Zero count");
    });
  });

  describe("Revocations", function () {
    beforeEach(async function () {
      await trustCert.connect(owner).approveUniversity(university1.address);
    });

    it("unapproved wallet cannot revoke", async function () {
      await expect(
        trustCert.connect(unapproved).revoke(sampleLeaf1)
      ).to.be.revertedWith("Not approved university");
    });

    it("approved wallet can revoke: sets isRevoked and emits Revoked event", async function () {
      expect(await trustCert.isRevoked(sampleLeaf1)).to.equal(false);

      await expect(trustCert.connect(university1).revoke(sampleLeaf1))
        .to.emit(trustCert, "Revoked")
        .withArgs(sampleLeaf1, university1.address);

      expect(await trustCert.isRevoked(sampleLeaf1)).to.equal(true);
    });

    it("reverts on zero leaf", async function () {
      await expect(
        trustCert.connect(university1).revoke(zeroBytes32)
      ).to.be.revertedWith("Zero leaf");
    });
  });
});
