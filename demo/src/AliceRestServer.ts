import type {
  CredentialExchangeRecord,
  ProofExchangeRecord,
} from "@credo-ts/didcomm";
import type {
  BasicMessageStateChangedEvent,
  CredentialStateChangedEvent,
  ProofStateChangedEvent,
} from "@credo-ts/didcomm";

import express from "express";
import cors from "cors";
import { clear } from "console";
import crypto from "crypto";
import {
  BasicMessageEventTypes,
  BasicMessageRole,
  CredentialEventTypes,
  CredentialState,
  ProofEventTypes,
  ProofState,
} from "@credo-ts/didcomm";

import { Alice } from "./Alice";
import { purpleText } from "./OutputClass";

export const runAliceServer = async () => {
  clear();
  console.log("Alice REST API Server Starting...");
  const aliceServer = await AliceServer.build();
  await aliceServer.start();
};

export class AliceServer {
  public alice: Alice;
  public app: express.Application;
  private port: number = 3011; // Express server port
  private agentPort: number = 3001; // DIDComm agent port
  private autoAcceptCredentials: boolean = false;

  public constructor(alice: Alice) {
    this.alice = alice;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventListeners();
  }

  public static async build(): Promise<AliceServer> {
    // Alice agent runs on port 3001 for DIDComm, Express server on 3011
    // Server deployment: both local and external endpoints for proper DIDComm routing
    const alice = await Alice.build(
      ["http://localhost:3001", "https://holder.yanis.gr"], // Local for internal, external for invitations
      3001, // DIDComm agent port
      "alice"
    );
    return new AliceServer(alice);
  }

  private setupEventListeners() {
    // Message listener
    this.alice.agent.events.on(
      BasicMessageEventTypes.BasicMessageStateChanged,
      async (event: BasicMessageStateChangedEvent) => {
        if (
          event.payload.basicMessageRecord.role === BasicMessageRole.Receiver
        ) {
          console.log(
            purpleText(
              `\n${this.alice.name} received a message: ${event.payload.message.content}\n`
            )
          );
        }
      }
    );

    // Credential offer listener
    this.alice.agent.events.on(
      CredentialEventTypes.CredentialStateChanged,
      async ({ payload }: CredentialStateChangedEvent) => {
        if (payload.credentialRecord.state === CredentialState.OfferReceived) {
          this.handleCredentialOffer(payload.credentialRecord);
        }
      }
    );

    // Proof request listener
    this.alice.agent.events.on(
      ProofEventTypes.ProofStateChanged,
      async ({ payload }: ProofStateChangedEvent) => {
        if (payload.proofRecord.state === ProofState.RequestReceived) {
          this.handleProofRequest(payload.proofRecord);
        }
      }
    );
  }

  private async handleCredentialOffer(
    credentialRecord: CredentialExchangeRecord
  ) {
    console.log(`Received credential offer with ID: ${credentialRecord.id}`);

    if (credentialRecord.credentialAttributes) {
      console.log("\nCredential preview:");
      for (const element of credentialRecord.credentialAttributes) {
        console.log(purpleText(`${element.name}: ${element.value}`));
      }
    }

    // Auto-accept if we're in automated mode
    if (this.autoAcceptCredentials) {
      console.log(purpleText("\n🤖 Auto-accepting credential offer..."));
      try {
        await this.alice.acceptCredentialOffer(credentialRecord);
        console.log(purpleText("✅ Credential offer accepted automatically!"));
        this.autoAcceptCredentials = false; // Reset the flag
      } catch (error) {
        console.error("Error auto-accepting credential offer:", error);
        this.autoAcceptCredentials = false; // Reset the flag even on error
      }
    } else {
      console.log(
        "Use POST /credentials/accept-offer or POST /credentials/decline-offer to respond"
      );
    }
  }

  private async handleProofRequest(proofRecord: ProofExchangeRecord) {
    console.log(`Received proof request with ID: ${proofRecord.id}`);

    // For automatic flows, auto-accept proof requests
    // In production, you might want to add conditions or user confirmation
    try {
      console.log("🔄 Automatically accepting proof request...");
      await this.alice.acceptProofRequest(proofRecord);
      console.log("✅ Proof request automatically accepted and sent!");
    } catch (error) {
      console.error("❌ Error auto-accepting proof request:", error);
      console.log(
        "Use POST /proofs/accept-request or POST /proofs/decline-request to respond manually"
      );
    }
  }

  private setupMiddleware() {
    // Configure CORS to allow all origins and common headers
    this.app.use(
      cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
        credentials: false,
      })
    );
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes() {
    // Status check endpoint
    this.app.get("/status", (req, res) => {
      res.json({
        status: "ok",
        connected: this.alice.connected,
        connectionId: this.alice.connectionRecordFaberId,
      });
    });

    // Receive connection invitation
    this.app.post("/connection/receive-invitation", async (req, res) => {
      try {
        const { invitationUrl } = req.body;

        if (!invitationUrl) {
          return res.status(400).json({ error: "invitationUrl is required" });
        }

        await this.alice.acceptConnection(invitationUrl);

        res.json({
          success: true,
          connected: this.alice.connected,
          connectionId: this.alice.connectionRecordFaberId,
          message: "Connection invitation processed successfully",
        });
      } catch (error: any) {
        console.error("Error processing connection invitation:", error);
        res.status(500).json({
          error: "Failed to process connection invitation",
          details: error.message,
        });
      }
    });

    // Send message
    this.app.post("/message/send", async (req, res) => {
      try {
        const { message } = req.body;

        if (!message) {
          return res.status(400).json({ error: "message is required" });
        }

        if (!this.alice.connected || !this.alice.connectionRecordFaberId) {
          return res.status(400).json({
            error: "No active connection. Please establish a connection first.",
          });
        }

        await this.alice.sendMessage(message);

        res.json({
          success: true,
          message: "Message sent successfully",
        });
      } catch (error: any) {
        console.error("Error sending message:", error);
        res.status(500).json({
          error: "Failed to send message",
          details: error.message,
        });
      }
    });

    // Accept credential offer
    this.app.post("/credentials/accept-offer", async (req, res) => {
      try {
        const { credentialRecordId } = req.body;

        if (!credentialRecordId) {
          return res
            .status(400)
            .json({ error: "credentialRecordId is required" });
        }

        const credentialRecord =
          await this.alice.agent.modules.credentials.getById(
            credentialRecordId
          );
        await this.alice.acceptCredentialOffer(credentialRecord);

        res.json({
          success: true,
          message: "Credential offer accepted successfully",
        });
      } catch (error: any) {
        console.error("Error accepting credential offer:", error);
        res.status(500).json({
          error: "Failed to accept credential offer",
          details: error.message,
        });
      }
    });

    // Decline credential offer
    this.app.post("/credentials/decline-offer", async (req, res) => {
      try {
        const { credentialRecordId } = req.body;

        if (!credentialRecordId) {
          return res
            .status(400)
            .json({ error: "credentialRecordId is required" });
        }

        await this.alice.agent.modules.credentials.declineOffer(
          credentialRecordId
        );

        res.json({
          success: true,
          message: "Credential offer declined successfully",
        });
      } catch (error: any) {
        console.error("Error declining credential offer:", error);
        res.status(500).json({
          error: "Failed to decline credential offer",
          details: error.message,
        });
      }
    });

    // Accept proof request
    this.app.post("/proofs/accept-request", async (req, res) => {
      try {
        const { proofRecordId } = req.body;

        if (!proofRecordId) {
          return res.status(400).json({ error: "proofRecordId is required" });
        }

        const proofRecord = await this.alice.agent.modules.proofs.getById(
          proofRecordId
        );
        await this.alice.acceptProofRequest(proofRecord);

        res.json({
          success: true,
          message: "Proof request accepted successfully",
        });
      } catch (error: any) {
        console.error("Error accepting proof request:", error);
        res.status(500).json({
          error: "Failed to accept proof request",
          details: error.message,
        });
      }
    });

    // Decline proof request
    this.app.post("/proofs/decline-request", async (req, res) => {
      try {
        const { proofRecordId } = req.body;

        if (!proofRecordId) {
          return res.status(400).json({ error: "proofRecordId is required" });
        }

        await this.alice.agent.modules.proofs.declineRequest({ proofRecordId });

        res.json({
          success: true,
          message: "Proof request declined successfully",
        });
      } catch (error: any) {
        console.error("Error declining proof request:", error);
        res.status(500).json({
          error: "Failed to decline proof request",
          details: error.message,
        });
      }
    });

    // Get all credentials
    this.app.get("/credentials", async (req, res) => {
      try {
        const credentials = await this.alice.agent.modules.credentials.getAll();
        res.json({
          success: true,
          credentials: credentials.map((cred) => ({
            id: cred.id,
            state: cred.state,
            createdAt: cred.createdAt,
            updatedAt: cred.updatedAt,
          })),
        });
      } catch (error: any) {
        console.error("Error fetching credentials:", error);
        res.status(500).json({
          error: "Failed to fetch credentials",
          details: error.message,
        });
      }
    });

    // Get detailed credential information including attributes
    this.app.get("/credentials/details", async (req, res) => {
      try {
        const credentials = await this.alice.agent.modules.credentials.getAll();

        const detailedCredentials = credentials.map((cred) => ({
          id: cred.id,
          state: cred.state,
          createdAt: cred.createdAt,
          updatedAt: cred.updatedAt,
          attributes: cred.credentialAttributes || [],
        }));

        // Find credentials with hash attributes
        const credentialsWithHash = detailedCredentials.filter((cred) =>
          cred.attributes.some((attr) => attr.name === "hash")
        );

        res.json({
          success: true,
          totalCredentials: credentials.length,
          credentialsWithHash: credentialsWithHash.length,
          credentials: detailedCredentials,
          hashExtraction:
            credentialsWithHash.length > 0
              ? {
                  available: true,
                  latestHash: credentialsWithHash[
                    credentialsWithHash.length - 1
                  ]?.attributes.find((attr) => attr.name === "hash")?.value,
                  message: "Hash can be auto-extracted for KPI submission",
                }
              : {
                  available: false,
                  message:
                    "No credentials with hash found. Get a credential from Faber first.",
                },
        });
      } catch (error: any) {
        console.error("Error fetching detailed credentials:", error);
        res.status(500).json({
          error: "Failed to fetch detailed credentials",
          details: error.message,
        });
      }
    });

    // Get all proofs
    this.app.get("/proofs", async (req, res) => {
      try {
        const proofs = await this.alice.agent.modules.proofs.getAll();
        res.json({
          success: true,
          proofs: proofs.map((proof) => ({
            id: proof.id,
            state: proof.state,
            createdAt: proof.createdAt,
            updatedAt: proof.updatedAt,
          })),
        });
      } catch (error: any) {
        console.error("Error fetching proofs:", error);
        res.status(500).json({
          error: "Failed to fetch proofs",
          details: error.message,
        });
      }
    });

    // Connect to Faber and request credential
    this.app.post("/credentials/connect-and-request", async (req, res) => {
      try {
        const { mac, deviceId } = req.body;

        if (!mac || !deviceId) {
          return res.status(400).json({
            error: "Both mac and deviceId are required",
          });
        }

        // Generate SHA-256 hash of deviceId
        const hash = crypto.createHash("sha256").update(deviceId).digest("hex");

        // Enable auto-accept for this credential request
        this.autoAcceptCredentials = true;

        console.log(purpleText(`\nInitiating connection with Faber server...`));
        console.log(purpleText(`MAC: ${mac}`));
        console.log(purpleText(`Device ID: ${deviceId}`));
        console.log(purpleText(`Hash: ${hash}`));

        // Step 1: Get invitation from Faber server
        const faberResponse = await fetch(
          "https://issuer.yanis.gr/connection/create-invitation",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          }
        );

        if (!faberResponse.ok) {
          throw new Error(
            `Faber server responded with status: ${faberResponse.status}`
          );
        }

        const faberData = (await faberResponse.json()) as any;
        const invitationUrl = faberData.invitationUrl;

        console.log(purpleText(`\nReceived invitation from Faber`));

        // Step 2: Accept the connection invitation
        await this.alice.acceptConnection(invitationUrl);

        console.log(purpleText(`\nConnection established with Faber!`));

        // Step 3: Request Faber to import DID (required for credential issuance)
        const didImportResponse = await fetch(
          "https://issuer.yanis.gr/did/import",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ registry: "did:cheqd" }),
          }
        );

        if (!didImportResponse.ok) {
          throw new Error(
            `Failed to import DID on Faber: ${didImportResponse.status}`
          );
        }

        console.log(purpleText(`\nDID imported on Faber`));

        // Step 4: Request credential issuance from Faber
        const credentialResponse = await fetch(
          "https://issuer.yanis.gr/credentials/issue",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ mac, deviceId, hash }),
          }
        );

        if (!credentialResponse.ok) {
          throw new Error(
            `Failed to request credential: ${credentialResponse.status}`
          );
        }

        const credentialData = (await credentialResponse.json()) as any;

        console.log(purpleText(`\nCredential offer sent by Faber!`));
        console.log(
          purpleText(`\nWaiting for credential offer to be received...`)
        );

        res.json({
          success: true,
          connected: this.alice.connected,
          connectionId: this.alice.connectionRecordFaberId,
          mac,
          deviceId,
          hash,
          message:
            "Connected to Faber and credential offer requested. Check console for credential offer details.",
          credentialDefinitionId: credentialData.credentialDefinitionId,
        });
      } catch (error: any) {
        // Reset auto-accept flag on error
        this.autoAcceptCredentials = false;
        console.error(
          "Error connecting to Faber and requesting credential:",
          error
        );
        res.status(500).json({
          error: "Failed to connect to Faber and request credential",
          details: error.message,
        });
      }
    });

    // Connect to Verifier and present proof
    this.app.post("/verifier/connect-and-prove", async (req, res) => {
      try {
        console.log(
          purpleText(`\n🔗 Connecting to Verifier for proof presentation...`)
        );

        // Step 1: Get invitation from Verifier server (https://verifier.yanis.gr)
        const verifierResponse = await fetch(
          "https://verifier.yanis.gr/api/connection/create-invitation",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          }
        );

        if (!verifierResponse.ok) {
          throw new Error(
            `Verifier server responded with status: ${verifierResponse.status}`
          );
        }

        const verifierData = (await verifierResponse.json()) as any;
        const invitationUrl = verifierData.invitationUrl;
        console.log(invitationUrl);
        console.log(purpleText(`\n📩 Received invitation from Verifier`));

        // Step 2: Accept the connection invitation from Verifier
        await this.alice.acceptConnection(invitationUrl);

        console.log(purpleText(`\n✅ Connection established with Verifier!`));

        // Wait a bit for connection to stabilize
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Step 3: Automatically trigger proof request from Verifier
        console.log(
          purpleText(`\n🎯 Automatically requesting proof from Verifier...`)
        );

        const proofRequestResponse = await fetch(
          "https://verifier.yanis.gr/api/proofs/request",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              connectionId: this.alice.connectionRecordFaberId,
            }),
          }
        );

        if (!proofRequestResponse.ok) {
          throw new Error(
            `Proof request failed with status: ${proofRequestResponse.status}`
          );
        }

        const proofData = (await proofRequestResponse.json()) as any;
        console.log(purpleText(`\n✅ Proof request sent and processed!`));

        res.json({
          success: true,
          connected: this.alice.connected,
          connectionId: this.alice.connectionRecordFaberId,
          proofVerified: true,
          message: "Connected to Verifier and proof automatically verified!",
          proofResult: proofData,
          nextStep: "You can now submit KPIs using /verifier/submit-kpis",
        });
      } catch (error: any) {
        console.error("Error connecting to Verifier:", error);
        res.status(500).json({
          error: "Failed to connect to Verifier",
          details: error.message,
        });
      }
    });

    // Submit KPIs to Verifier (requires prior proof verification)
    this.app.post("/verifier/submit-kpis", async (req, res) => {
      try {
        const { hash, baseLine, savings, contractAddress } = req.body;

        if (!hash || baseLine === undefined || savings === undefined) {
          return res.status(400).json({
            error: "hash, baseLine, and savings are required",
          });
        }

        if (!contractAddress) {
          return res.status(400).json({
            error: "contractAddress is required",
          });
        }

        console.log(purpleText(`\n📊 Submitting KPIs to Verifier...`));
        console.log(purpleText(`Hash: ${hash}`));
        console.log(purpleText(`Baseline: ${baseLine}`));
        console.log(purpleText(`Savings: ${savings}`));

        // Submit KPIs to Verifier's blockchain endpoint
        const kpiResponse = await fetch(
          "https://verifier.yanis.gr/api/blockchain/set-kpis",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              hash: crypto.createHash("sha256").update(hash).digest("hex"),
              baseLine,
              savings,
              contractAddress,
            }),
          }
        );

        const kpiData = (await kpiResponse.json()) as any;

        if (!kpiResponse.ok) {
          if (kpiResponse.status === 401) {
            console.log(
              purpleText(
                `\n❌ KPI submission rejected - No verified proof found`
              )
            );
            return res.status(401).json({
              error: "Unauthorized: No verified proof found for this hash",
              details: kpiData.error,
              message:
                "You need to present a valid proof containing this hash before submitting KPIs",
            });
          }
          throw new Error(`Verifier rejected KPI submission: ${kpiData.error}`);
        }

        console.log(
          purpleText(`\n✅ KPIs submitted successfully to blockchain!`)
        );
        console.log(purpleText(`Transaction hash: ${kpiData.transactionHash}`));

        res.json({
          success: true,
          message: "KPIs submitted successfully to blockchain",
          transactionHash: kpiData.transactionHash,
          blockNumber: kpiData.blockNumber,
          gasUsed: kpiData.gasUsed,
          kpis: {
            hash,
            baseLine,
            savings,
          },
        });
      } catch (error: any) {
        console.error("Error submitting KPIs:", error);
        res.status(500).json({
          error: "Failed to submit KPIs",
          details: error.message,
        });
      }
    });

    // Submit KPIs to Verifier using hash from credential (auto-extract hash)
    this.app.post("/verifier/submit-kpis-auto", async (req, res) => {
      try {
        const { hash, baseLine, savings } = req.body;

        if (!hash || baseLine === undefined || savings === undefined) {
          return res.status(400).json({
            error: "hash, baseLine, and savings are required",
          });
        }

        // Generate the crypto hash to search for in credentials
        const cryptoHash = crypto
          .createHash("sha256")
          .update(hash)
          .digest("hex");

        // Hardcoded contract address for the KPI smart contract
        const contractAddress = "0xf868d9130EA1a1B9Ca0b406411b4D6f646dDcD89";

        console.log(
          purpleText(`\n🔍 Looking for hash in Alice's credentials...`)
        );
        console.log(purpleText(`Input hash: ${hash}`));
        console.log(purpleText(`Crypto hash to find: ${cryptoHash}`));

        // Get all credentials
        const credentials = await this.alice.agent.modules.credentials.getAll();

        if (credentials.length === 0) {
          return res.status(400).json({
            error: "No credentials found. Please obtain a credential first.",
            suggestion:
              "Use POST /credentials/connect-and-request to get a credential from Faber",
          });
        }

        // Find the credential with the matching hash attribute
        let extractedHash = null;
        let credentialUsed = null;

        for (const credential of credentials) {
          if (
            credential.state === CredentialState.Done &&
            credential.credentialAttributes
          ) {
            // Look for hash attribute in credential that matches our crypto hash
            for (const attr of credential.credentialAttributes) {
              if (attr.name === "hash" && attr.value === cryptoHash) {
                extractedHash = attr.value;
                credentialUsed = credential;
                break;
              }
            }
            if (extractedHash) break;
          }
        }

        if (!extractedHash) {
          return res.status(400).json({
            error: `No credential found with hash matching '${hash}' (crypto: ${cryptoHash}). Please ensure you have a valid credential for this device.`,
            suggestion:
              "Use POST /credentials/connect-and-request to get a credential from Faber for this device",
            credentialsFound: credentials.length,
            availableHashes: credentials
              .filter((cred) => cred.credentialAttributes)
              .map((cred) => {
                const hashAttr = cred.credentialAttributes?.find(
                  (attr) => attr.name === "hash"
                );
                return hashAttr ? hashAttr.value : null;
              })
              .filter((h) => h !== null),
          });
        }

        console.log(
          purpleText(
            `\n✅ Found matching credential with hash: ${extractedHash}`
          )
        );
        console.log(purpleText(`📄 Credential ID: ${credentialUsed?.id}`));
        console.log(purpleText(`📊 Submitting KPIs to Verifier...`));
        console.log(purpleText(`Contract: ${contractAddress}`));
        console.log(purpleText(`Hash: ${extractedHash}`));
        console.log(purpleText(`Baseline: ${baseLine}`));
        console.log(purpleText(`Savings: ${savings}`));

        // Submit KPIs to Verifier's blockchain endpoint
        const kpiResponse = await fetch(
          "https://verifier.yanis.gr/api/blockchain/set-kpis",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              hash: extractedHash,
              baseLine,
              savings,
              contractAddress,
            }),
          }
        );

        const kpiData = (await kpiResponse.json()) as any;

        if (!kpiResponse.ok) {
          if (kpiResponse.status === 401) {
            console.log(
              purpleText(
                `\n❌ KPI submission rejected - No verified proof found`
              )
            );
            return res.status(401).json({
              error: "Unauthorized: No verified proof found for this hash",
              details: kpiData.error,
              message:
                "You need to present a valid proof containing this hash before submitting KPIs",
              hashUsed: extractedHash,
            });
          }
          throw new Error(`Verifier rejected KPI submission: ${kpiData.error}`);
        }

        console.log(
          purpleText(`\n✅ KPIs submitted successfully to blockchain!`)
        );
        console.log(purpleText(`Transaction hash: ${kpiData.transactionHash}`));

        res.json({
          success: true,
          message:
            "KPIs submitted successfully to blockchain using credential hash verification",
          transactionHash: kpiData.transactionHash,
          blockNumber: kpiData.blockNumber,
          gasUsed: kpiData.gasUsed,
          contractAddress,
          credentialUsed: {
            id: credentialUsed?.id,
            createdAt: credentialUsed?.createdAt,
          },
          kpis: {
            inputHash: hash,
            cryptoHash: extractedHash,
            baseLine,
            savings,
          },
        });
      } catch (error: any) {
        console.error("Error submitting KPIs with hash verification:", error);
        res.status(500).json({
          error: "Failed to submit KPIs with hash verification",
          details: error.message,
        });
      }
    });

    // Get credential from Faber and connect/verify workflow
    this.app.post("/workflow/complete-flow", async (req, res) => {
      try {
        const { mac, deviceId, baseLine, savings } = req.body;

        if (!mac || !deviceId) {
          return res.status(400).json({
            error: "mac and deviceId are required",
          });
        }

        if (baseLine === undefined || savings === undefined) {
          return res.status(400).json({
            error: "baseLine and savings are required for KPI submission",
          });
        }

        // Hardcoded contract address for the KPI smart contract
        const contractAddress = "0xf868d9130EA1a1B9Ca0b406411b4D6f646dDcD89";

        console.log(purpleText(`\n🚀 Starting complete workflow...`));
        console.log(purpleText(`1️⃣ Getting credential from Faber`));
        console.log(purpleText(`2️⃣ Connecting to Verifier`));
        console.log(purpleText(`3️⃣ Presenting proof to Verifier`));
        console.log(purpleText(`4️⃣ Submitting KPIs to blockchain`));

        // Step 1: Get credential from Faber
        const credentialResponse = await fetch(
          "http://localhost:3001/credentials/connect-and-request",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ mac, deviceId }),
          }
        );

        if (!credentialResponse.ok) {
          throw new Error("Failed to get credential from Faber");
        }

        const credentialData = (await credentialResponse.json()) as any;
        const hash = credentialData.hash;

        console.log(purpleText(`\n✅ Step 1 complete: Credential received`));
        console.log(purpleText(`   Hash: ${hash}`));

        // Wait for credential to be processed
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Step 2: Connect to Verifier
        const verifierConnectionResponse = await fetch(
          "http://localhost:3001/verifier/connect-and-prove",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          }
        );

        if (!verifierConnectionResponse.ok) {
          throw new Error("Failed to connect to Verifier");
        }

        console.log(purpleText(`\n✅ Step 2 complete: Connected to Verifier`));

        // Wait for connection to stabilize
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Step 3: Request proof from Verifier (this would normally be done by Verifier, but we'll trigger it)
        console.log(
          purpleText(
            `\n⏳ Step 3: Proof exchange (requires manual trigger from Verifier)`
          )
        );

        // Step 4: Submit KPIs using auto-extracted hash
        console.log(purpleText(`\n📊 Step 4: Submitting KPIs...`));

        const kpiResponse = await fetch(
          "http://localhost:3001/verifier/submit-kpis-auto",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              baseLine,
              savings,
            }),
          }
        );

        const kpiData = (await kpiResponse.json()) as any;

        res.json({
          success: true,
          message: "Workflow completed successfully",
          contractAddress,
          steps: {
            credential: {
              completed: true,
              hash: hash,
              mac: mac,
              deviceId: deviceId,
            },
            verifierConnection: {
              completed: true,
              message: "Connected to Verifier",
            },
            proofExchange: {
              completed: false,
              message: "Requires manual proof request from Verifier",
              instruction:
                "Call POST https://verifier.yanis.gr/api/proofs/request to request proof",
            },
            kpiSubmission: {
              completed: kpiResponse.ok,
              status: kpiResponse.status,
              data: kpiData,
            },
          },
        });
      } catch (error: any) {
        console.error("Error in complete workflow:", error);
        res.status(500).json({
          error: "Workflow failed",
          details: error.message,
        });
      }
    });

    // Shutdown agent
    this.app.post("/shutdown", async (req, res) => {
      try {
        await this.alice.exit();
        res.json({
          success: true,
          message: "Agent shutdown successfully",
        });
      } catch (error: any) {
        console.error("Error shutting down agent:", error);
        res.status(500).json({
          error: "Failed to shutdown agent",
          details: error.message,
        });
      }
    });
  }

  public async start() {
    return new Promise<void>((resolve) => {
      this.app.listen(this.port, "0.0.0.0", () => {
        console.log(
          `\nAlice REST API server running on http://localhost:${this.port}`
        );
        console.log("\nAvailable endpoints:");
        console.log("  GET  /status - Check server and connection status");
        console.log(
          "  POST /connection/receive-invitation - Accept connection invitation"
        );
        console.log("  POST /message/send - Send a message");
        console.log(
          "  POST /credentials/accept-offer - Accept credential offer"
        );
        console.log(
          "  POST /credentials/decline-offer - Decline credential offer"
        );
        console.log(
          "  POST /credentials/connect-and-request - Connect to Faber and request credential with MAC/deviceId"
        );
        console.log("  POST /proofs/accept-request - Accept proof request");
        console.log("  POST /proofs/decline-request - Decline proof request");
        console.log(
          "  POST /verifier/connect-and-prove - Connect to Verifier for proof presentation"
        );
        console.log(
          "  POST /verifier/submit-kpis - Submit KPIs to Verifier (requires hash)"
        );
        console.log(
          "  POST /verifier/submit-kpis-auto - Submit KPIs using auto-extracted hash from credential"
        );
        console.log(
          "  POST /workflow/complete-flow - Complete end-to-end workflow (credential → proof → KPIs)"
        );
        console.log("  GET  /credentials - Get all credentials");
        console.log(
          "  GET  /credentials/details - Get detailed credentials with attributes and hash info"
        );
        console.log("  GET  /proofs - Get all proofs");
        console.log("  POST /shutdown - Shutdown the agent");
        console.log("\n");
        resolve();
      });
    });
  }
}

void runAliceServer();
