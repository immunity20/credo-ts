import type { ConnectionRecord } from "@credo-ts/didcomm";
import type {
  BasicMessageStateChangedEvent,
  ConnectionStateChangedEvent,
  ProofStateChangedEvent,
  ProofExchangeRecord,
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

import { Alice } from "./Alice";
import { purpleText, greenText, redText } from "./OutputClass";

export const runAliceNATServer = async () => {
  clear();
  console.log("Alice NAT-Friendly Server Starting...");
  const aliceServer = await AliceNATServer.build();
  await aliceServer.start();
};

export class AliceNATServer {
  public alice: Alice;
  public app: express.Application;
  private port: number = 3015; // REST API port (only local access needed)
  public name: string;
  public outOfBandId?: string;

  // Polling configuration
  private pollingInterval: number = 5000; // 5 seconds
  private pollingTimer?: NodeJS.Timeout;
  private issuerEndpoint: string = "https://issuer.yanis.gr";
  private verifierEndpoint: string = "https://verifier.yanis.gr";

  public constructor(alice: Alice) {
    this.alice = alice;
    this.name = "Alice (NAT-Friendly)";
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventListeners();
    this.startPolling();
  }

  public static async build(): Promise<AliceNATServer> {
    // Alice behind NAT - no need for external endpoints
    // Only needs outbound connectivity
    const alice = await Alice.build(
      ["http://localhost:3001"], // Local only
      3001, // Local DIDComm port
      "alice"
    );
    return new AliceNATServer(alice);
  }

  private setupEventListeners() {
    // Proof request listener - auto-accept proof requests
    this.alice.agent.events.on(
      ProofEventTypes.ProofStateChanged,
      async (event: ProofStateChangedEvent) => {
        const { proofRecord } = event.payload;
        console.log(`\n🔍 Alice proof state changed: ${proofRecord.state}`);

        if (proofRecord.state === ProofState.RequestReceived) {
          console.log(greenText("📩 Alice received proof request!"));

          try {
            // Auto-accept the proof request
            await this.alice.acceptProofRequest(proofRecord);
            console.log(
              greenText("✅ Alice automatically accepted proof request")
            );
          } catch (error) {
            console.error(redText("Error accepting proof request:"), error);
          }
        }

        if (proofRecord.state === ProofState.Done) {
          console.log(greenText("✅ Alice proof exchange completed!"));

          // Extract hash from the credential for automatic KPI submission
          try {
            const hash = await this.extractHashFromCredentials();
            if (hash) {
              console.log(greenText(`🔗 Auto-extracted hash: ${hash}`));

              // Automatically submit KPIs to blockchain via Verifier
              await this.submitKPIsToBlockchain(hash, 1000, 250); // Example values
            }
          } catch (error) {
            console.error(redText("Error during auto-hash extraction:"), error);
          }
        }
      }
    );

    // Message listener
    this.alice.agent.events.on(
      BasicMessageEventTypes.BasicMessageStateChanged,
      async (event: BasicMessageStateChangedEvent) => {
        if (
          event.payload.basicMessageRecord.role === BasicMessageRole.Receiver
        ) {
          console.log(
            purpleText(
              `\n${this.name} received a message: ${event.payload.message.content}\n`
            )
          );
        }
      }
    );

    // Connection state listener
    this.alice.agent.events.on(
      ConnectionEventTypes.ConnectionStateChanged,
      async (event: ConnectionStateChangedEvent) => {
        console.log(
          `Alice connection state changed: ${event.payload.connectionRecord.state}`
        );

        if (event.payload.connectionRecord.state === "completed") {
          console.log(greenText("🔗 Alice connection established!"));
        }
      }
    );
  }

  private startPolling() {
    console.log(
      purpleText("🔄 Starting polling for new connections and messages...")
    );

    this.pollingTimer = setInterval(() => {
      this.pollForUpdates();
    }, this.pollingInterval);
  }

  private async pollForUpdates() {
    try {
      // Poll for new invitations from Faber (issuer)
      await this.checkForFaberInvitation();

      // Poll for proof requests from Verifier
      await this.checkForProofRequests();
    } catch (error) {
      console.error("Error during polling:", error);
    }
  }

  private async checkForFaberInvitation() {
    try {
      // Check if Alice is already connected to Faber
      const connections = await this.alice.agent.modules.connections.getAll();
      const faberConnection = connections.find(
        (conn) =>
          conn.theirLabel?.toLowerCase().includes("faber") ||
          conn.theirLabel?.toLowerCase().includes("issuer")
      );

      if (!faberConnection || faberConnection.state !== "completed") {
        // Try to get invitation from Faber
        const response = await fetch(
          `${this.issuerEndpoint}/api/connection/create-invitation`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (response.ok) {
          const data = (await response.json()) as any;
          if (data.success && data.invitationUrl) {
            console.log(greenText("📨 Found new invitation from Faber!"));
            await this.alice.acceptConnection(data.invitationUrl);
          }
        }
      }
    } catch (error) {
      // Silently handle polling errors to avoid spam
      if (error instanceof Error && !error.message.includes("ECONNREFUSED")) {
        console.error("Error checking for Faber invitation:", error.message);
      }
    }
  }

  private async checkForProofRequests() {
    try {
      // Check for proof requests by getting all proofs
      const proofs = await this.alice.agent.modules.proofs.getAll();
      const pendingProofs = proofs.filter(
        (proof) => proof.state === ProofState.RequestReceived
      );

      if (pendingProofs.length > 0) {
        console.log(
          greenText(
            `📋 Found ${pendingProofs.length} pending proof request(s)!`
          )
        );

        for (const proof of pendingProofs) {
          try {
            await this.alice.acceptProofRequest(proof);
            console.log(
              greenText(`✅ Auto-accepted proof request ${proof.id}`)
            );
          } catch (error) {
            console.error(redText(`Error accepting proof ${proof.id}:`), error);
          }
        }
      }
    } catch (error) {
      // Silently handle polling errors
      if (error instanceof Error && !error.message.includes("ECONNREFUSED")) {
        console.error("Error checking for proof requests:", error.message);
      }
    }
  }

  private async extractHashFromCredentials(): Promise<string | null> {
    try {
      const credentials = await this.alice.agent.modules.credentials.getAll();

      for (const credential of credentials) {
        if (credential.state === "done") {
          // Get credential format data
          const formatData =
            await this.alice.agent.modules.credentials.getFormatData(
              credential.id
            );

          // Extract hash from AnonCreds credential
          if (formatData.offer && (formatData.offer as any).anoncreds) {
            const anoncredsData = (formatData.offer as any).anoncreds;

            // Look for hash in credential attributes
            if (anoncredsData.cred_def_id) {
              // Get the credential exchange record
              const credentialRecord =
                await this.alice.agent.modules.credentials.getById(
                  credential.id
                );

              if (credentialRecord.credentialAttributes) {
                const hashAttribute =
                  credentialRecord.credentialAttributes.find((attr) =>
                    attr.name.toLowerCase().includes("hash")
                  );

                if (hashAttribute) {
                  console.log(
                    greenText(
                      `🔗 Found hash in credential: ${hashAttribute.value}`
                    )
                  );
                  return hashAttribute.value;
                }
              }
            }
          }
        }
      }

      console.log("No hash found in credentials");
      return null;
    } catch (error) {
      console.error("Error extracting hash from credentials:", error);
      return null;
    }
  }

  private async submitKPIsToBlockchain(
    hash: string,
    baseLine: number,
    savings: number
  ) {
    try {
      console.log(
        purpleText(`🚀 Submitting KPIs to blockchain via Verifier...`)
      );
      console.log(
        purpleText(`Hash: ${hash}, Baseline: ${baseLine}, Savings: ${savings}`)
      );

      const response = await fetch(
        `${this.verifierEndpoint}/api/blockchain/set-kpis`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hash,
            baseLine,
            savings,
          }),
        }
      );

      if (response.ok) {
        const result = (await response.json()) as any;
        console.log(greenText("🎉 KPIs successfully submitted to blockchain!"));
        console.log(purpleText(`Transaction hash: ${result.transactionHash}`));
        console.log(purpleText(`Block number: ${result.blockNumber}`));
      } else {
        const errorData = (await response.json()) as any;
        console.error(redText("Failed to submit KPIs:"), errorData.error);
      }
    } catch (error) {
      console.error(redText("Error submitting KPIs to blockchain:"), error);
    }
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
        agent: "alice-nat",
        name: this.name,
        outOfBandId: this.outOfBandId,
        polling: !!this.pollingTimer,
        pollingInterval: this.pollingInterval,
      });
    });

    // Manually connect to Faber
    this.app.post("/connect-to-faber", async (req, res) => {
      try {
        const response = await fetch(
          `${this.issuerEndpoint}/api/connection/create-invitation`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (response.ok) {
          const data = (await response.json()) as any;
          if (data.success && data.invitationUrl) {
            await this.alice.acceptConnection(data.invitationUrl);

            res.json({
              success: true,
              message: "Successfully connected to Faber",
              invitationUrl: data.invitationUrl,
            });
          } else {
            throw new Error("Invalid response from Faber");
          }
        } else {
          throw new Error(`Faber responded with status: ${response.status}`);
        }
      } catch (error: any) {
        console.error("Error connecting to Faber:", error);
        res.status(500).json({
          error: "Failed to connect to Faber",
          details: error.message,
        });
      }
    });

    // Connect to Verifier for proof exchange
    this.app.post("/connect-to-verifier", async (req, res) => {
      try {
        const response = await fetch(
          `${this.verifierEndpoint}/api/connection/create-invitation`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (response.ok) {
          const data = (await response.json()) as any;
          if (data.success && data.invitationUrl) {
            await this.alice.acceptConnection(data.invitationUrl);

            res.json({
              success: true,
              message: "Successfully connected to Verifier",
              invitationUrl: data.invitationUrl,
            });
          } else {
            throw new Error("Invalid response from Verifier");
          }
        } else {
          throw new Error(`Verifier responded with status: ${response.status}`);
        }
      } catch (error: any) {
        console.error("Error connecting to Verifier:", error);
        res.status(500).json({
          error: "Failed to connect to Verifier",
          details: error.message,
        });
      }
    });

    // Get all connections
    this.app.get("/connections", async (req, res) => {
      try {
        const connections = await this.alice.agent.modules.connections.getAll();
        res.json({
          success: true,
          connections: connections.map((conn) => ({
            id: conn.id,
            state: conn.state,
            theirLabel: conn.theirLabel,
            outOfBandId: conn.outOfBandId,
            createdAt: conn.createdAt,
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
        const credentials = await this.alice.agent.modules.credentials.getAll();
        res.json({
          success: true,
          credentials: credentials.map((cred) => ({
            id: cred.id,
            state: cred.state,
            createdAt: cred.createdAt,
            credentialAttributes: cred.credentialAttributes,
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
        const proofs = await this.alice.agent.modules.proofs.getAll();
        res.json({
          success: true,
          proofs: proofs.map((proof) => ({
            id: proof.id,
            state: proof.state,
            isVerified: proof.isVerified,
            createdAt: proof.createdAt,
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

    // Manual KPI submission
    this.app.post("/submit-kpis", async (req, res) => {
      try {
        const { hash, baseLine, savings } = req.body;

        if (!hash || baseLine === undefined || savings === undefined) {
          return res.status(400).json({
            error: "hash, baseLine, and savings are required",
          });
        }

        await this.submitKPIsToBlockchain(hash, baseLine, savings);

        res.json({
          success: true,
          message: "KPIs submitted to blockchain",
          hash,
          baseLine,
          savings,
        });
      } catch (error: any) {
        console.error("Error submitting KPIs:", error);
        res.status(500).json({
          error: "Failed to submit KPIs",
          details: error.message,
        });
      }
    });

    // Auto-extract hash and submit KPIs
    this.app.post("/auto-submit-kpis", async (req, res) => {
      try {
        const { baseLine, savings } = req.body;

        if (baseLine === undefined || savings === undefined) {
          return res.status(400).json({
            error: "baseLine and savings are required",
          });
        }

        const hash = await this.extractHashFromCredentials();
        if (!hash) {
          return res.status(404).json({
            error: "No hash found in credentials",
          });
        }

        await this.submitKPIsToBlockchain(hash, baseLine, savings);

        res.json({
          success: true,
          message: "KPIs auto-submitted to blockchain",
          hash,
          baseLine,
          savings,
        });
      } catch (error: any) {
        console.error("Error auto-submitting KPIs:", error);
        res.status(500).json({
          error: "Failed to auto-submit KPIs",
          details: error.message,
        });
      }
    });

    // Control polling
    this.app.post("/polling/start", (req, res) => {
      if (!this.pollingTimer) {
        this.startPolling();
        res.json({ success: true, message: "Polling started" });
      } else {
        res.json({ success: true, message: "Polling already active" });
      }
    });

    this.app.post("/polling/stop", (req, res) => {
      if (this.pollingTimer) {
        clearInterval(this.pollingTimer);
        this.pollingTimer = undefined;
        res.json({ success: true, message: "Polling stopped" });
      } else {
        res.json({ success: true, message: "Polling not active" });
      }
    });

    // Shutdown agent
    this.app.post("/shutdown", async (req, res) => {
      try {
        if (this.pollingTimer) {
          clearInterval(this.pollingTimer);
        }
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
      this.app.listen(this.port, () => {
        console.log(
          `\n${this.name} REST API server running on http://localhost:${this.port}`
        );
        console.log(
          "🔒 This server works behind NAT/firewall (outbound connections only)"
        );
        console.log("\nAvailable endpoints:");
        console.log("  GET  /status - Check server status");
        console.log("  POST /connect-to-faber - Manually connect to Faber");
        console.log(
          "  POST /connect-to-verifier - Manually connect to Verifier"
        );
        console.log("  GET  /connections - Get all connections");
        console.log("  GET  /credentials - Get all credentials");
        console.log("  GET  /proofs - Get all proofs");
        console.log("  POST /submit-kpis - Manual KPI submission");
        console.log(
          "  POST /auto-submit-kpis - Auto-extract hash and submit KPIs"
        );
        console.log("  POST /polling/start - Start polling");
        console.log("  POST /polling/stop - Stop polling");
        console.log("  POST /shutdown - Shutdown the agent");
        console.log("\n");
        console.log("🔄 Automatic polling enabled - Alice will automatically:");
        console.log("   • Connect to Faber when invitation available");
        console.log("   • Accept proof requests automatically");
        console.log("   • Extract hashes and submit KPIs to blockchain");
        console.log("\n");
        resolve();
      });
    });
  }
}

void runAliceNATServer();
