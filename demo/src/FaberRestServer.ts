import type { ConnectionRecord } from "@credo-ts/didcomm";
import type {
  BasicMessageStateChangedEvent,
  ConnectionStateChangedEvent,
  ProofStateChangedEvent,
} from "@credo-ts/didcomm";

import express from "express";
import cors from "cors";
import { clear } from "console";
import {
  BasicMessageEventTypes,
  BasicMessageRole,
  ConnectionEventTypes,
  ProofEventTypes,
  ProofState,
} from "@credo-ts/didcomm";

import { Faber, RegistryOptions } from "./Faber";
import { purpleText, greenText, redText } from "./OutputClass";

export const runFaberServer = async () => {
  clear();
  console.log("Faber REST API Server Starting...");
  const faberServer = await FaberServer.build();
  await faberServer.start();
};

export class FaberServer {
  public faber: Faber;
  public app: express.Application;
  private port: number = 3012; // Express server port
  private agentPort: number = 3002; // DIDComm agent port

  public constructor(faber: Faber) {
    this.faber = faber;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventListeners();
  }

  public static async build(): Promise<FaberServer> {
    // Faber runs on server1 with issuer.yanis.gr domain
    // Use both local and external endpoints for maximum compatibility
    const faber = await Faber.build(
      ["http://localhost:3002", "https://issuer.yanis.gr"], // Local first, external as fallback
      3002, // DIDComm agent port
      "faber"
    );
    return new FaberServer(faber);
  }

  private setupEventListeners() {
    // Message listener
    this.faber.agent.events.on(
      BasicMessageEventTypes.BasicMessageStateChanged,
      async (event: BasicMessageStateChangedEvent) => {
        if (
          event.payload.basicMessageRecord.role === BasicMessageRole.Receiver
        ) {
          console.log(
            purpleText(
              `\n${this.faber.name} received a message: ${event.payload.message.content}\n`
            )
          );
        }
      }
    );

    // Connection state listener
    this.faber.agent.events.on(
      ConnectionEventTypes.ConnectionStateChanged,
      async (event: ConnectionStateChangedEvent) => {
        console.log(
          `Connection state changed: ${event.payload.connectionRecord.state}`
        );
      }
    );

    // Proof state listener
    this.faber.agent.events.on(
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
              await this.faber.agent.modules.proofs.acceptPresentation({
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
        outOfBandId: this.faber.outOfBandId,
        hasCredentialDefinition: !!this.faber.credentialDefinition,
        anonCredsIssuerId: this.faber.anonCredsIssuerId,
      });
    });

    // Create connection invitation
    this.app.post("/connection/create-invitation", async (req, res) => {
      try {
        // Just create the invitation, don't wait for connection
        const invitationUrl = await this.faber.createConnectionInvitation(
          "https://issuer.yanis.gr"
        );

        res.json({
          success: true,
          invitationUrl,
          outOfBandId: this.faber.outOfBandId,
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

    // Check connection status
    this.app.get("/connections", async (req, res) => {
      try {
        const connections = await this.faber.agent.modules.connections.getAll();
        res.json({
          success: true,
          connections: connections.map((conn) => ({
            id: conn.id,
            state: conn.state,
            theirLabel: conn.theirLabel,
            createdAt: conn.createdAt,
            outOfBandId: conn.outOfBandId,
          })),
        });
      } catch (error: any) {
        console.error("Error getting connections:", error);
        res.status(500).json({
          error: "Failed to get connections",
          details: error.message,
        });
      }
    });

    // Get specific connection by outOfBandId
    this.app.get("/connections/oob/:outOfBandId", async (req, res) => {
      try {
        const { outOfBandId } = req.params;
        const connections =
          await this.faber.agent.modules.connections.findAllByOutOfBandId(
            outOfBandId
          );

        if (connections.length === 0) {
          return res.status(404).json({
            success: false,
            message: "No connection found for this invitation",
          });
        }

        const connection = connections[0];
        res.json({
          success: true,
          connection: {
            id: connection.id,
            state: connection.state,
            theirLabel: connection.theirLabel,
            createdAt: connection.createdAt,
            outOfBandId: connection.outOfBandId,
          },
        });
      } catch (error: any) {
        console.error("Error getting connection:", error);
        res.status(500).json({
          error: "Failed to get connection",
          details: error.message,
        });
      }
    });

    // Import DID for credential issuance
    this.app.post("/did/import", async (req, res) => {
      try {
        const { registry } = req.body;

        if (!registry || !Object.values(RegistryOptions).includes(registry)) {
          return res.status(400).json({
            error:
              'registry is required and must be either "did:indy" or "did:cheqd"',
          });
        }

        await this.faber.importDid(registry);

        res.json({
          success: true,
          registry,
          anonCredsIssuerId: this.faber.anonCredsIssuerId,
          message: "DID imported successfully",
        });
      } catch (error: any) {
        console.error("Error importing DID:", error);
        res.status(500).json({
          error: "Failed to import DID",
          details: error.message,
        });
      }
    });

    // Issue credential
    this.app.post("/credentials/issue", async (req, res) => {
      const { mac, deviceId, hash } = req.body;
      if (!mac || !deviceId || !hash) {
        return res.status(400).json({
          error: "mac, deviceId and hash are required",
        });
      }
      try {
        if (!this.faber.anonCredsIssuerId) {
          return res.status(400).json({
            error: "DID must be imported first. Use POST /did/import",
          });
        }

        if (!this.faber.outOfBandId) {
          return res.status(400).json({
            error:
              "Connection must be established first. Use POST /connection/create-invitation",
          });
        }

        await this.faber.issueCredential({ mac, deviceId, hash });

        res.json({
          success: true,
          credentialDefinitionId:
            this.faber.credentialDefinition?.credentialDefinitionId,
          message: "Credential offer sent successfully",
        });
      } catch (error: any) {
        console.error("Error issuing credential:", error);
        res.status(500).json({
          error: "Failed to issue credential",
          details: error.message,
        });
      }
    });

    // Send proof request
    this.app.post("/proofs/request", async (req, res) => {
      try {
        if (!this.faber.credentialDefinition) {
          return res.status(400).json({
            error:
              "Credential must be issued first. Use POST /credentials/issue",
          });
        }

        if (!this.faber.outOfBandId) {
          return res.status(400).json({
            error:
              "Connection must be established first. Use POST /connection/create-invitation",
          });
        }

        await this.faber.sendProofRequest();

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

        if (!this.faber.outOfBandId) {
          return res.status(400).json({
            error: "No active connection. Please create a connection first.",
          });
        }

        await this.faber.sendMessage(message);

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
        const connections = await this.faber.agent.modules.connections.getAll();
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

    // Get all credentials
    this.app.get("/credentials", async (req, res) => {
      try {
        const credentials = await this.faber.agent.modules.credentials.getAll();
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
        const proofs = await this.faber.agent.modules.proofs.getAll();
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

    // Get credential definition
    this.app.get("/credential-definition", (req, res) => {
      if (!this.faber.credentialDefinition) {
        return res.status(404).json({
          error: "No credential definition found. Issue a credential first.",
        });
      }

      res.json({
        success: true,
        credentialDefinition: {
          id: this.faber.credentialDefinition.credentialDefinitionId,
          state: this.faber.credentialDefinition.state,
        },
      });
    });

    // Accept presentation manually
    this.app.post("/proofs/accept-presentation", async (req, res) => {
      try {
        const { proofRecordId } = req.body;

        if (!proofRecordId) {
          return res.status(400).json({ error: "proofRecordId is required" });
        }

        const proofRecord = await this.faber.agent.modules.proofs.getById(
          proofRecordId
        );

        if (proofRecord.state !== ProofState.PresentationReceived) {
          return res.status(400).json({
            error: `Cannot accept presentation. Current state: ${proofRecord.state}. Expected: ${ProofState.PresentationReceived}`,
          });
        }

        await this.faber.agent.modules.proofs.acceptPresentation({
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

        const proofRecord = await this.faber.agent.modules.proofs.getById(
          proofRecordId
        );

        // Get format data which contains the actual proof data
        const formatData = await this.faber.agent.modules.proofs.getFormatData(
          proofRecordId
        );

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

    // Shutdown agent
    this.app.post("/shutdown", async (req, res) => {
      try {
        await this.faber.exit();
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
          `\nFaber REST API server running on http://localhost:${this.port}`
        );
        console.log("\nAvailable endpoints:");
        console.log("  GET  /health - Check server status");
        console.log(
          "  POST /connection/create-invitation - Create connection invitation"
        );
        console.log("  GET  /connections - Get all connections");
        console.log(
          "  GET  /connections/oob/:outOfBandId - Get connection by invitation ID"
        );
        console.log("  POST /did/import - Import DID for credential issuance");
        console.log("  POST /credentials/issue - Issue credential");
        console.log("  POST /proofs/request - Send proof request");
        console.log(
          "  POST /proofs/accept-presentation - Manually accept presentation"
        );
        console.log(
          "  GET  /proofs/:id/verification - Get proof verification details"
        );
        console.log("  POST /message/send - Send a message");
        console.log("  GET  /credentials - Get all credentials");
        console.log("  GET  /proofs - Get all proofs");
        console.log(
          "  GET  /credential-definition - Get credential definition info"
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

void runFaberServer();
