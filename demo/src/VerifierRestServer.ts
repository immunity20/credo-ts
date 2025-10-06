import type { ConnectionRecord } from "@credo-ts/didcomm";
import type {
  BasicMessageStateChangedEvent,
  ConnectionStateChangedEvent,
  ProofStateChangedEvent,
} from "@credo-ts/didcomm";

import express from "express";
import cors from "cors";
import { clear } from "console";
import { ethers } from "ethers";
import {
  BasicMessageEventTypes,
  BasicMessageRole,
  ConnectionEventTypes,
  ProofEventTypes,
  ProofState,
} from "@credo-ts/didcomm";

import { Verifier } from "./Verifier";
import { purpleText, greenText, redText } from "./OutputClass";

export const runVerifierServer = async () => {
  clear();
  console.log("Verifier REST API Server Starting...");
  const verifierServer = await VerifierServer.build();
  await verifierServer.start();
};

export class VerifierServer {
  public verifier: Verifier;
  public app: express.Application;
  private port: number = 3013; // Use different port for Express server
  private agentPort: number = 3003; // Agent port for DIDComm

  public constructor(verifier: Verifier) {
    this.verifier = verifier;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventListeners();
  }

  public static async build(): Promise<VerifierServer> {
    // For verifier running on verifier.yanis.gr, use both local and external endpoints
    // Note: nginx handles SSL termination and proxies to localhost:3013 for REST API
    // DIDComm agent runs on port 3003
    const verifier = await Verifier.build(
      ["http://localhost:3003", "https://verifier.yanis.gr"], // Local first, external as fallback
      3003, // Agent port for DIDComm
      "verifier"
    );
    return new VerifierServer(verifier);
  }

  private setupEventListeners() {
    // Message listener
    this.verifier.agent.events.on(
      BasicMessageEventTypes.BasicMessageStateChanged,
      async (event: BasicMessageStateChangedEvent) => {
        if (
          event.payload.basicMessageRecord.role === BasicMessageRole.Receiver
        ) {
          console.log(
            purpleText(
              `\n${this.verifier.name} received a message: ${event.payload.message.content}\n`
            )
          );
        }
      }
    );

    // Connection state listener
    this.verifier.agent.events.on(
      ConnectionEventTypes.ConnectionStateChanged,
      async (event: ConnectionStateChangedEvent) => {
        console.log(
          `Connection state changed: ${event.payload.connectionRecord.state}`
        );
      }
    );

    // Proof state listener
    this.verifier.agent.events.on(
      ProofEventTypes.ProofStateChanged,
      async (event: ProofStateChangedEvent) => {
        const { proofRecord } = event.payload;
        console.log(`\n🔍 Proof state changed: ${proofRecord.state}`);
        console.log(`Proof ID: ${proofRecord.id}`);

        if (proofRecord.state === ProofState.PresentationReceived) {
          console.log(greenText("✅ Proof received from Alice!"));

          // Check if proof is verified (verification happens automatically in processPresentation)
          if (proofRecord.isVerified === true) {
            console.log(greenText("🎉 Proof is VALID! ✅"));
            console.log(
              "Proof verification successful - Alice has provided valid credentials."
            );

            // Automatically accept the valid presentation
            try {
              await this.verifier.agent.modules.proofs.acceptPresentation({
                proofRecordId: proofRecord.id,
              });
              console.log(greenText("✅ Presentation accepted automatically"));
            } catch (error) {
              console.error(redText("Error accepting presentation:"), error);
            }
          } else if (proofRecord.isVerified === false) {
            console.log(redText("❌ Proof is INVALID!"));
            console.log(
              "Proof verification failed - credentials may be tampered with or invalid."
            );
            if (proofRecord.errorMessage) {
              console.log(redText("Error details:"), proofRecord.errorMessage);
            }
          } else {
            console.log("⏳ Proof verification status unknown");
          }
        }

        if (proofRecord.state === ProofState.Done) {
          console.log(greenText("✅ Proof exchange completed successfully!"));
          console.log("The complete proof verification flow has finished.");
        }
      }
    );
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get("/status", (req, res) => {
      res.json({
        status: "ok",
        outOfBandId: this.verifier.outOfBandId,
        agent: "verifier",
        name: this.verifier.name,
      });
    });

    // Create connection invitation
    this.app.post("/connection/create-invitation", async (req, res) => {
      try {
        // Use HTTPS for verifier invitations (nginx handles SSL termination)
        const invitationUrl = await this.verifier.createConnectionInvitation(
          "https://verifier.yanis.gr"
        );

        res.json({
          success: true,
          invitationUrl,
          outOfBandId: this.verifier.outOfBandId,
          message: "Connection invitation created successfully",
        });
      } catch (error: any) {
        console.error("Error creating connection invitation:", error);
        res.status(500).json({
          error: "Failed to create connection invitation",
          details: error.message,
        });
      }
    });

    // Send proof request
    this.app.post("/proofs/request", async (req, res) => {
      try {
        if (!this.verifier.outOfBandId) {
          return res.status(400).json({
            error:
              "Connection must be established first. Use POST /connection/create-invitation",
          });
        }

        await this.verifier.sendProofRequest();

        res.json({
          success: true,
          message: "Proof request sent successfully",
        });
      } catch (error: any) {
        console.error("Error sending proof request:", error);
        res.status(500).json({
          error: "Failed to send proof request",
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

        if (!this.verifier.outOfBandId) {
          return res.status(400).json({
            error: "No active connection. Please create a connection first.",
          });
        }

        await this.verifier.sendMessage(message);

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

    // Get all connections
    this.app.get("/connections", async (req, res) => {
      try {
        const connections =
          await this.verifier.agent.modules.connections.getAll();
        res.json({
          success: true,
          connections: connections.map((conn) => ({
            id: conn.id,
            state: conn.state,
            outOfBandId: conn.outOfBandId,
            createdAt: conn.createdAt,
            updatedAt: conn.updatedAt,
          })),
        });
      } catch (error: any) {
        console.error("Error fetching connections:", error);
        res.status(500).json({
          error: "Failed to fetch connections",
          details: error.message,
        });
      }
    });

    // Get connection status by outOfBandId
    this.app.get("/connections/oob/:outOfBandId", async (req, res) => {
      try {
        const { outOfBandId } = req.params;
        const connections =
          await this.verifier.agent.modules.connections.findAllByOutOfBandId(
            outOfBandId
          );

        if (connections.length === 0) {
          return res.json({
            success: true,
            connected: false,
            message: "No connection found for this invitation",
          });
        }

        const connection = connections[0];
        res.json({
          success: true,
          connected: connection.state === "completed",
          connection: {
            id: connection.id,
            state: connection.state,
            outOfBandId: connection.outOfBandId,
            createdAt: connection.createdAt,
            updatedAt: connection.updatedAt,
          },
        });
      } catch (error: any) {
        console.error("Error checking connection status:", error);
        res.status(500).json({
          error: "Failed to check connection status",
          details: error.message,
        });
      }
    });

    // Get all credentials
    this.app.get("/credentials", async (req, res) => {
      try {
        const credentials =
          await this.verifier.agent.modules.credentials.getAll();
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

    // Get all proofs
    this.app.get("/proofs", async (req, res) => {
      try {
        const proofs = await this.verifier.agent.modules.proofs.getAll();
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

    // Accept presentation manually
    this.app.post("/proofs/accept-presentation", async (req, res) => {
      try {
        const { proofRecordId } = req.body;

        if (!proofRecordId) {
          return res.status(400).json({ error: "proofRecordId is required" });
        }

        const proofRecord = await this.verifier.agent.modules.proofs.getById(
          proofRecordId
        );

        if (proofRecord.state !== ProofState.PresentationReceived) {
          return res.status(400).json({
            error: `Cannot accept presentation. Current state: ${proofRecord.state}. Expected: ${ProofState.PresentationReceived}`,
          });
        }

        await this.verifier.agent.modules.proofs.acceptPresentation({
          proofRecordId,
        });

        res.json({
          success: true,
          isVerified: proofRecord.isVerified,
          message: "Presentation accepted successfully",
        });
      } catch (error: any) {
        console.error("Error accepting presentation:", error);
        res.status(500).json({
          error: "Failed to accept presentation",
          details: error.message,
        });
      }
    });

    // Get proof verification details
    this.app.get("/proofs/:proofRecordId/verification", async (req, res) => {
      try {
        const { proofRecordId } = req.params;

        const proofRecord = await this.verifier.agent.modules.proofs.getById(
          proofRecordId
        );

        // Get format data which contains the actual proof data
        const formatData =
          await this.verifier.agent.modules.proofs.getFormatData(proofRecordId);

        res.json({
          success: true,
          proofRecord: {
            id: proofRecord.id,
            state: proofRecord.state,
            isVerified: proofRecord.isVerified,
            errorMessage: proofRecord.errorMessage,
            createdAt: proofRecord.createdAt,
            updatedAt: proofRecord.updatedAt,
          },
          formatData,
          verificationResult: {
            isValid: proofRecord.isVerified === true,
            status:
              proofRecord.isVerified === true
                ? "VALID"
                : proofRecord.isVerified === false
                ? "INVALID"
                : "UNKNOWN",
            message:
              proofRecord.isVerified === true
                ? "Proof verification successful"
                : proofRecord.isVerified === false
                ? "Proof verification failed"
                : "Proof verification status unknown",
          },
        });
      } catch (error: any) {
        console.error("Error getting proof verification details:", error);
        res.status(500).json({
          error: "Failed to get proof verification details",
          details: error.message,
        });
      }
    });

    // Get KPI data from blockchain by hash
    this.app.get("/blockchain/get-kpi/:hash", async (req, res) => {
      const contractAddress = "0xf868d9130EA1a1B9Ca0b406411b4D6f646dDcD89";
      try {
        const { hash } = req.params;

        if (!hash) {
          return res.status(400).json({
            error: "hash parameter is required",
          });
        }

        console.log(purpleText(`\n🔍 Getting KPI data for hash: ${hash}`));

        // Initialize Ethereum provider
        const infuraKey = "91c6aecb929146d7a1a33993be21c5a8"; // Hardcoded Infura API key
        const rpcUrl = `https://sepolia.infura.io/v3/${infuraKey}`;
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Contract ABI for getKPIs function (note: plural 'KPIs')
        const contractABI = [
          "function getKPIs(string hash) external view returns (uint256 totalBaseline, uint256 totalSavings, uint256 entryCount, bool exists)",
        ];

        // Create contract instance (read-only, no wallet needed)
        const contract = new ethers.Contract(
          contractAddress,
          contractABI,
          provider
        );

        // Call the getKPIs function (note: plural 'KPIs')
        const result = await contract.getKPIs(hash);
        const totalBaseLine = result[0];
        const totalSavings = result[1];
        const entryCount = result[2];
        const exists = result[3];

        console.log(greenText(`\n✅ KPI data retrieved successfully!`));
        console.log(purpleText(`Hash: ${hash}`));
        console.log(purpleText(`Total Baseline: ${totalBaseLine.toString()}`));
        console.log(purpleText(`Total Savings: ${totalSavings.toString()}`));
        console.log(purpleText(`Entry Count: ${entryCount.toString()}`));
        console.log(purpleText(`Exists: ${exists}`));

        res.json({
          success: true,
          hash,
          totalBaseLine: totalBaseLine.toString(),
          totalSavings: totalSavings.toString(),
          entryCount: entryCount.toString(),
          exists,
          contractAddress,
          message: "KPI data retrieved successfully",
        });
      } catch (error: any) {
        console.error(redText("Error getting KPI data:"), error);

        // Handle specific ethers errors
        let errorMessage = "Failed to get KPI data";
        if (error.code === "CALL_EXCEPTION") {
          errorMessage = "Smart contract call failed - hash may not exist";
        } else if (error.code === "NETWORK_ERROR") {
          errorMessage = "Network error - check Sepolia connection";
        } else if (error.reason) {
          errorMessage = `Contract call failed: ${error.reason}`;
        }

        res.status(500).json({
          error: errorMessage,
          details: error.message,
          code: error.code,
        });
      }
    });

    // Get blockchain events for the smart contract (all events)
    this.app.get("/blockchain/events", async (req, res) => {
      const contractAddress = "0xf868d9130EA1a1B9Ca0b406411b4D6f646dDcD89";
      try {
        // Get blocks parameter from query (default to 100)
        const blocks = parseInt(req.query.blocks as string) || 100;

        if (blocks <= 0 || blocks > 10000) {
          return res.status(400).json({
            error: "blocks parameter must be between 1 and 10000",
          });
        }

        console.log(
          purpleText(`\n🔍 Getting all events from last ${blocks} blocks`)
        );

        // Initialize Ethereum provider with retry logic
        const infuraKey = "91c6aecb929146d7a1a33993be21c5a8"; // Hardcoded Infura API key
        const rpcUrl = `https://sepolia.infura.io/v3/${infuraKey}`;
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Add retry logic for rate limiting
        const retryRequest = async (
          fn: () => Promise<any>,
          retries = 3,
          delay = 1000
        ): Promise<any> => {
          try {
            return await fn();
          } catch (error: any) {
            if (
              error.code === "NETWORK_ERROR" &&
              error.message?.includes("Too Many Requests") &&
              retries > 0
            ) {
              console.log(
                purpleText(
                  `Rate limited, retrying in ${delay}ms... (${retries} retries left)`
                )
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
              return retryRequest(fn, retries - 1, delay * 2);
            }
            throw error;
          }
        };

        // Get current block number with retry
        const currentBlock = await retryRequest(() =>
          provider.getBlockNumber()
        );
        const fromBlock = Math.max(0, currentBlock - blocks);

        console.log(purpleText(`Current block: ${currentBlock}`));
        console.log(purpleText(`Searching from block: ${fromBlock}`));

        // Contract ABI with events (note: correct event name and structure)
        const contractABI = [
          "event KPIsSet(string indexed hash, uint256 indexed baseline, uint256 indexed savings, uint256 newTotalBaseline, uint256 newTotalSavings, address sender, uint256 timestamp)",
        ];

        // Create contract instance
        const contract = new ethers.Contract(
          contractAddress,
          contractABI,
          provider
        );

        // Get ALL events from the specified block range with retry
        const eventFilter = contract.filters.KPIsSet();
        const events = await retryRequest(() =>
          contract.queryFilter(eventFilter, fromBlock, currentBlock)
        );

        console.log(greenText(`\n✅ Found ${events.length} KPI events`));

        // Process events to extract the required data
        const processedEvents = await Promise.all(
          events.map(async (event: any) => {
            // Get block details for timestamp with retry
            const block = await retryRequest(() =>
              provider.getBlock(event.blockNumber)
            );
            const timestamp = block
              ? new Date(block.timestamp * 1000)
              : new Date();

            return {
              date: timestamp.toISOString(),
              hash: event.args?.hash?.hash || "",
              baseline: event.args?.baseline
                ? event.args.baseline.toString()
                : "0",
              savings: event.args?.savings
                ? event.args.savings.toString()
                : "0",
              user: event.args?.user || "",
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash,
            };
          })
        );

        // Sort by block number (most recent first)
        processedEvents.sort((a: any, b: any) => b.blockNumber - a.blockNumber);

        res.json({
          success: true,
          events: processedEvents,
          totalEvents: processedEvents.length,
          blocksScanned: blocks,
          fromBlock,
          toBlock: currentBlock,
          contractAddress,
          message: `Retrieved ${processedEvents.length} KPI events from last ${blocks} blocks`,
        });
      } catch (error: any) {
        console.error(redText("Error getting blockchain events:"), error);

        // Handle specific ethers errors
        let errorMessage = "Failed to get blockchain events";
        if (error.code === "NETWORK_ERROR") {
          errorMessage = "Network error - check Sepolia connection";
        } else if (error.reason) {
          errorMessage = `Event query failed: ${error.reason}`;
        }

        res.status(500).json({
          error: errorMessage,
          details: error.message,
          code: error.code,
        });
      }
    });

    // Get blockchain events for a specific hash
    this.app.get("/blockchain/events/:hash", async (req, res) => {
      const contractAddress = "0xf868d9130EA1a1B9Ca0b406411b4D6f646dDcD89";
      try {
        const { hash } = req.params;
        // Get blocks parameter from query (default to 100)
        const blocks = parseInt(req.query.blocks as string) || 100;

        if (!hash) {
          return res.status(400).json({
            error: "hash parameter is required",
          });
        }

        if (blocks <= 0 || blocks > 10000) {
          return res.status(400).json({
            error: "blocks parameter must be between 1 and 10000",
          });
        }

        console.log(
          purpleText(
            `\n🔍 Getting events for hash: ${hash} from last ${blocks} blocks`
          )
        );

        // Initialize Ethereum provider
        const infuraKey = "91c6aecb929146d7a1a33993be21c5a8"; // Hardcoded Infura API key
        const rpcUrl = `https://sepolia.infura.io/v3/${infuraKey}`;
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Retry function for handling rate limiting
        const retryRequest = async (
          requestFn: () => Promise<any>,
          maxRetries = 3
        ): Promise<any> => {
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              return await requestFn();
            } catch (error: any) {
              if (error.status === 429 || error.code === "RATE_LIMITED") {
                if (attempt < maxRetries) {
                  const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                  console.log(
                    `Rate limited, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`
                  );
                  await new Promise((resolve) => setTimeout(resolve, delay));
                  continue;
                }
              }
              throw error;
            }
          }
        };

        // Get current block number with retry
        const currentBlock = await retryRequest(() =>
          provider.getBlockNumber()
        );
        const fromBlock = Math.max(0, currentBlock - blocks);

        console.log(purpleText(`Current block: ${currentBlock}`));
        console.log(purpleText(`Searching from block: ${fromBlock}`));

        // Contract ABI with events (note: correct event name and structure)
        const contractABI = [
          "event KPIsSet(string indexed hash, uint256 indexed baseline, uint256 indexed savings, uint256 newTotalBaseline, uint256 newTotalSavings, address sender, uint256 timestamp)",
        ];

        // Create contract instance
        const contract = new ethers.Contract(
          contractAddress,
          contractABI,
          provider
        );

        // Get events filtered by specific hash from the specified block range with retry
        const eventFilter = contract.filters.KPIsSet(hash); // Filter by specific hash
        const events = await retryRequest(() =>
          contract.queryFilter(eventFilter, fromBlock, currentBlock)
        );

        console.log(
          greenText(`\n✅ Found ${events.length} KPI events for hash: ${hash}`)
        );

        // Process events to extract the required data
        const processedEvents = await Promise.all(
          events.map(async (event: any) => {
            // Get block details for timestamp with retry
            const block = await retryRequest(() =>
              provider.getBlock(event.blockNumber)
            );
            const timestamp = block
              ? new Date(block.timestamp * 1000)
              : new Date();

            return {
              date: timestamp.toISOString(),
              hash: event.args?.hash?.hash || "",
              baseline: event.args?.baseline
                ? event.args.baseline.toString()
                : "0",
              savings: event.args?.savings
                ? event.args.savings.toString()
                : "0",
              user: event.args?.user || "",
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash,
            };
          })
        );

        // Sort by block number (most recent first)
        processedEvents.sort((a: any, b: any) => b.blockNumber - a.blockNumber);

        res.json({
          success: true,
          events: processedEvents,
          totalEvents: processedEvents.length,
          blocksScanned: blocks,
          fromBlock,
          toBlock: currentBlock,
          contractAddress,
          message: `Retrieved ${processedEvents.length} KPI events for hash '${hash}' from last ${blocks} blocks`,
        });
      } catch (error: any) {
        console.error(redText("Error getting blockchain events:"), error);

        // Handle specific ethers errors
        let errorMessage = "Failed to get blockchain events";
        if (error.code === "NETWORK_ERROR") {
          errorMessage = "Network error - check Sepolia connection";
        } else if (error.reason) {
          errorMessage = `Event query failed: ${error.reason}`;
        }

        res.status(500).json({
          error: errorMessage,
          details: error.message,
          code: error.code,
        });
      }
    });

    // Send blockchain transaction (KPIs)
    this.app.post("/blockchain/set-kpis", async (req, res) => {
      const contractAddress = "0xf868d9130EA1a1B9Ca0b406411b4D6f646dDcD89";
      try {
        const { hash, baseLine, savings } = req.body;
        console.log(hash, baseLine, savings);
        // Validate required parameters
        if (!hash || baseLine === undefined || savings === undefined) {
          return res.status(400).json({
            error: "hash, baseLine, and savings are required",
          });
        }

        console.log(
          purpleText(`\n🔍 Checking for verified proof with hash: ${hash}`)
        );

        // Check if there's a verified proof with the specified hash
        const proofs = await this.verifier.agent.modules.proofs.getAll();
        let validProofFound = false;
        let matchingProof = null;

        for (const proof of proofs) {
          // Only check verified proofs that are in Done state
          if (proof.isVerified === true && proof.state === ProofState.Done) {
            console.log(`🔍 Examining verified proof ID: ${proof.id}`);
            try {
              // Get the format data to access the actual proof content
              const formatData =
                await this.verifier.agent.modules.proofs.getFormatData(
                  proof.id
                );

              console.log(`📋 Format data structure:`, {
                hasPresentation: !!formatData.presentation,
                hasAnoncreds: !!(
                  formatData.presentation && formatData.presentation.anoncreds
                ),
              });

              // Check if the proof contains the specified hash in its attributes
              if (
                formatData.presentation &&
                formatData.presentation.anoncreds
              ) {
                const presentation = formatData.presentation.anoncreds as any;

                console.log(`🔍 Presentation structure:`, {
                  hasRequestedAttributes: !!presentation.requested_attributes,
                  hasRevealedAttrs: !!presentation.revealed_attrs,
                  hasProof: !!presentation.proof,
                  hasRequestedProof: !!presentation.requested_proof,
                  keys: Object.keys(presentation),
                });

                // Check in requested_proof (where AnonCreds stores the actual revealed attribute values)
                if (
                  presentation.requested_proof &&
                  presentation.requested_proof.revealed_attrs
                ) {
                  console.log(
                    `🔍 Checking requested_proof.revealed_attrs:`,
                    presentation.requested_proof.revealed_attrs
                  );
                  for (const [referent, attribute] of Object.entries(
                    presentation.requested_proof.revealed_attrs
                  )) {
                    const attrValue =
                      (attribute as any).raw || (attribute as any).value;

                    console.log(
                      `🔍 Checking requested_proof attribute - Referent: ${referent}, Value: ${attrValue}`
                    );
                    console.log(`🔍 Looking for hash: ${hash}`);
                    console.log(
                      `🔍 Match check: ${
                        attrValue === hash ? "MATCH!" : "no match"
                      }`
                    );

                    // Check if this attribute contains our hash
                    if (attrValue === hash) {
                      validProofFound = true;
                      matchingProof = proof;
                      console.log(
                        greenText(`✅ Found verified proof with matching hash!`)
                      );
                      console.log(greenText(`   Proof ID: ${proof.id}`));
                      console.log(greenText(`   Attribute: ${attrValue}`));
                      break;
                    }
                  }
                }

                // Look through the revealed attributes in the presentation (actual presented values)
                if (presentation.revealed_attrs) {
                  console.log(
                    `🔍 Checking revealed_attrs:`,
                    presentation.revealed_attrs
                  );
                  for (const [referent, attribute] of Object.entries(
                    presentation.revealed_attrs
                  )) {
                    const attrValue =
                      (attribute as any).raw || (attribute as any).value;

                    console.log(
                      `🔍 Checking revealed attribute - Referent: ${referent}, Value: ${attrValue}`
                    );
                    console.log(`🔍 Looking for hash: ${hash}`);
                    console.log(
                      `🔍 Match check: ${
                        attrValue === hash ? "MATCH!" : "no match"
                      }`
                    );

                    // Check if this attribute contains our hash
                    if (attrValue === hash) {
                      validProofFound = true;
                      matchingProof = proof;
                      console.log(
                        greenText(`✅ Found verified proof with matching hash!`)
                      );
                      console.log(greenText(`   Proof ID: ${proof.id}`));
                      console.log(greenText(`   Attribute: ${attrValue}`));
                      break;
                    }
                  }
                }

                // Also check in requested_attributes if it exists
                if (presentation.requested_attributes) {
                  for (const [referent, attribute] of Object.entries(
                    presentation.requested_attributes
                  )) {
                    const attrValue =
                      (attribute as any).raw || (attribute as any).value;

                    console.log(
                      `🔍 Checking requested attribute - Referent: ${referent}, Value: ${attrValue}`
                    );
                    console.log(`🔍 Looking for hash: ${hash}`);
                    console.log(
                      `🔍 Match check: ${
                        attrValue === hash ? "MATCH!" : "no match"
                      }`
                    );

                    // Check if this attribute contains our hash
                    if (attrValue === hash) {
                      validProofFound = true;
                      matchingProof = proof;
                      console.log(
                        greenText(`✅ Found verified proof with matching hash!`)
                      );
                      console.log(greenText(`   Proof ID: ${proof.id}`));
                      console.log(greenText(`   Attribute: ${attrValue}`));
                      break;
                    }
                  }
                }

                // Also check in proof.requested_attributes if the structure is different
                if (
                  !validProofFound &&
                  (presentation as any).proof &&
                  (presentation as any).proof.requested_attributes
                ) {
                  for (const [referent, attribute] of Object.entries(
                    (presentation as any).proof.requested_attributes
                  )) {
                    const attrValue =
                      (attribute as any).raw || (attribute as any).value;

                    if (attrValue === hash) {
                      validProofFound = true;
                      matchingProof = proof;
                      console.log(
                        greenText(`✅ Found verified proof with matching hash!`)
                      );
                      console.log(greenText(`   Proof ID: ${proof.id}`));
                      console.log(greenText(`   Attribute: ${attrValue}`));
                      break;
                    }
                  }
                }
              }
            } catch (error) {
              console.log(`Error checking proof ${proof.id}:`, error);
              continue;
            }
          }

          if (validProofFound) break;
        }

        if (!validProofFound) {
          console.log(redText(`❌ No verified proof found with hash: ${hash}`));
          return res.status(401).json({
            error:
              "Unauthorized: No verified proof found with the specified hash",
            hash,
            message:
              "A verified credential containing this hash is required to perform this transaction",
          });
        }

        console.log(greenText(`\n🚀 Sending blockchain transaction...`));
        console.log(purpleText(`Contract: ${contractAddress}`));
        console.log(purpleText(`Hash: ${hash}`));
        console.log(purpleText(`Baseline: ${baseLine}`));
        console.log(purpleText(`Savings: ${savings}`));

        // Initialize Ethereum provider and wallet
        const infuraKey = "91c6aecb929146d7a1a33993be21c5a8"; // Hardcoded Infura API key
        const rpcUrl = `https://sepolia.infura.io/v3/${infuraKey}`;
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const privateKey =
          "92a876bd5419518f133ae8d0321bc7aa5d1d83dff206aeb3c4c5fde32315682b";
        const wallet = new ethers.Wallet(privateKey, provider);

        // Contract ABI for setKPIs function (note: plural 'KPIs')
        const contractABI = [
          "function setKPIs(string hash, uint256 baseline, uint256 savings) external",
        ];

        // Create contract instance
        const contract = new ethers.Contract(
          contractAddress,
          contractABI,
          wallet
        );

        // Send transaction
        const tx = await contract.setKPIs(hash, baseLine, savings);

        console.log(greenText(`\n✅ Transaction sent!`));
        console.log(purpleText(`Transaction hash: ${tx.hash}`));
        console.log(purpleText(`Waiting for confirmation...`));

        // Wait for transaction confirmation
        const receipt = await tx.wait();

        console.log(greenText(`\n🎉 Transaction confirmed!`));
        console.log(purpleText(`Block number: ${receipt.blockNumber}`));
        console.log(purpleText(`Gas used: ${receipt.gasUsed.toString()}`));

        res.json({
          success: true,
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          proofId: matchingProof?.id,
          contractAddress,
          kpis: {
            hash,
            baseLine,
            savings,
          },
          message: "KPIs set successfully on blockchain",
        });
      } catch (error: any) {
        console.error(redText("Error sending blockchain transaction:"), error);

        // Handle specific ethers errors
        let errorMessage = "Failed to send blockchain transaction";
        if (error.code === "INSUFFICIENT_FUNDS") {
          errorMessage = "Insufficient funds for transaction";
        } else if (error.code === "NETWORK_ERROR") {
          errorMessage = "Network error - check Sepolia connection";
        } else if (error.reason) {
          errorMessage = `Transaction failed: ${error.reason}`;
        }

        res.status(500).json({
          error: errorMessage,
          details: error.message,
          code: error.code,
        });
      }
    });

    // Clear all proofs
    this.app.delete("/proofs/clear", async (req, res) => {
      try {
        console.log(purpleText("\n🗑️  Clearing all proof records..."));

        // Get all proof records
        const proofs = await this.verifier.agent.modules.proofs.getAll();
        console.log(
          purpleText(`Found ${proofs.length} proof records to delete`)
        );

        // Delete each proof record
        let deletedCount = 0;
        for (const proof of proofs) {
          try {
            await this.verifier.agent.modules.proofs.deleteById(proof.id);
            deletedCount++;
            console.log(
              purpleText(`✅ Deleted proof ${proof.id} (state: ${proof.state})`)
            );
          } catch (error) {
            console.log(
              redText(`❌ Failed to delete proof ${proof.id}: ${error}`)
            );
          }
        }

        console.log(
          greenText(
            `\n🎉 Successfully deleted ${deletedCount}/${proofs.length} proof records`
          )
        );

        res.json({
          success: true,
          deletedCount,
          totalFound: proofs.length,
          message: `Successfully cleared ${deletedCount} proof records`,
        });
      } catch (error: any) {
        console.error(redText("Error clearing proofs:"), error);
        res.status(500).json({
          error: "Failed to clear proofs",
          details: error.message,
        });
      }
    });

    // Clear all connections
    this.app.delete("/connections/clear", async (req, res) => {
      try {
        console.log(purpleText("\n🗑️  Clearing all connection records..."));

        // Get all connection records
        const connections =
          await this.verifier.agent.modules.connections.getAll();
        console.log(
          purpleText(`Found ${connections.length} connection records to delete`)
        );

        // Delete each connection record
        let deletedCount = 0;
        for (const connection of connections) {
          try {
            await this.verifier.agent.modules.connections.deleteById(
              connection.id
            );
            deletedCount++;
            console.log(
              purpleText(
                `✅ Deleted connection ${connection.id} (state: ${connection.state})`
              )
            );
          } catch (error) {
            console.log(
              redText(
                `❌ Failed to delete connection ${connection.id}: ${error}`
              )
            );
          }
        }

        console.log(
          greenText(
            `\n🎉 Successfully deleted ${deletedCount}/${connections.length} connection records`
          )
        );

        res.json({
          success: true,
          deletedCount,
          totalFound: connections.length,
          message: `Successfully cleared ${deletedCount} connection records`,
        });
      } catch (error: any) {
        console.error(redText("Error clearing connections:"), error);
        res.status(500).json({
          error: "Failed to clear connections",
          details: error.message,
        });
      }
    });

    // Clear all data (proofs + connections)
    this.app.delete("/clear-all", async (req, res) => {
      try {
        console.log(purpleText("\n🗑️  Clearing ALL agent data..."));

        // Clear proofs
        const proofs = await this.verifier.agent.modules.proofs.getAll();
        let deletedProofs = 0;
        for (const proof of proofs) {
          try {
            await this.verifier.agent.modules.proofs.deleteById(proof.id);
            deletedProofs++;
          } catch (error) {
            console.log(redText(`Failed to delete proof ${proof.id}`));
          }
        }

        // Clear connections
        const connections =
          await this.verifier.agent.modules.connections.getAll();
        let deletedConnections = 0;
        for (const connection of connections) {
          try {
            await this.verifier.agent.modules.connections.deleteById(
              connection.id
            );
            deletedConnections++;
          } catch (error) {
            console.log(
              redText(`Failed to delete connection ${connection.id}`)
            );
          }
        }

        // Reset the outOfBandId
        this.verifier.outOfBandId = undefined;

        console.log(greenText(`\n🎉 Agent data cleared successfully!`));
        console.log(
          purpleText(`   - Deleted ${deletedProofs}/${proofs.length} proofs`)
        );
        console.log(
          purpleText(
            `   - Deleted ${deletedConnections}/${connections.length} connections`
          )
        );

        res.json({
          success: true,
          deletedProofs,
          totalProofs: proofs.length,
          deletedConnections,
          totalConnections: connections.length,
          message: `Successfully cleared all agent data`,
        });
      } catch (error: any) {
        console.error(redText("Error clearing all data:"), error);
        res.status(500).json({
          error: "Failed to clear all data",
          details: error.message,
        });
      }
    });

    // Shutdown agent
    this.app.post("/shutdown", async (req, res) => {
      try {
        await this.verifier.exit();
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
      this.app.listen(this.port, () => {
        console.log(
          `\nVerifier REST API server running on http://localhost:${this.port}`
        );
        console.log("\nAvailable endpoints:");
        console.log("  GET  /status - Check server status");
        console.log(
          "  POST /connection/create-invitation - Create connection invitation"
        );
        console.log("  GET  /connections - Get all connections");
        console.log(
          "  GET  /connections/oob/:outOfBandId - Check connection status by invitation ID"
        );
        console.log("  POST /proofs/request - Send proof request");
        console.log(
          "  POST /proofs/accept-presentation - Manually accept presentation"
        );
        console.log(
          "  GET  /proofs/:id/verification - Get proof verification details"
        );
        console.log("  POST /message/send - Send a message");
        console.log("  GET  /proofs - Get all proofs");
        console.log("  DELETE /proofs/clear - Clear all proof records");
        console.log(
          "  DELETE /connections/clear - Clear all connection records"
        );
        console.log(
          "  DELETE /clear-all - Clear all agent data (proofs + connections)"
        );
        console.log(
          "  GET  /blockchain/get-kpi/:hash - Get KPI data by hash from blockchain"
        );
        console.log(
          "  GET  /blockchain/events?blocks=N - Get KPI events from last N blocks"
        );
        console.log(
          "  POST /blockchain/set-kpis - Send KPIs to blockchain (requires verified proof)"
        );
        console.log("  POST /shutdown - Shutdown the agent");
        console.log("\n");
        console.log(
          "💡 Tip: Proof verification happens automatically when presentations are received."
        );
        console.log("   Check the console logs for verification results!");
        console.log("\n");
        resolve();
      });
    });
  }
}

void runVerifierServer();
