import type { ConnectionRecord } from "@credo-ts/didcomm";
import type {
  BasicMessageStateChangedEvent,
  ConnectionStateChangedEvent,
} from "@credo-ts/didcomm";

import express from "express";
import cors from "cors";
import { clear } from "console";
import {
  BasicMessageEventTypes,
  BasicMessageRole,
  ConnectionEventTypes,
} from "@credo-ts/didcomm";

import { BaseAgent } from "./BaseAgent";
import { purpleText, greenText, redText } from "./OutputClass";

export const runMediatorServer = async () => {
  clear();
  console.log("Mediator Server Starting...");
  const mediatorServer = await MediatorServer.build();
  await mediatorServer.start();
};

export class MediatorServer {
  public agent: BaseAgent;
  public app: express.Application;
  private port: number = 3014; // REST API port
  private agentPort: number = 3004; // DIDComm port
  public name: string;

  // Store messages for Alice
  private messageQueue: Map<string, any[]> = new Map();

  public constructor(agent: BaseAgent, name: string) {
    this.agent = agent;
    this.name = name;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventListeners();
  }

  public static async build(): Promise<MediatorServer> {
    // Mediator runs on public server with HTTPS
    const agent = await BaseAgent.build(
      ["http://localhost:3004", "https://mediator.yanis.gr"],
      3004,
      "mediator"
    );
    return new MediatorServer(agent, "Mediator");
  }

  private setupEventListeners() {
    // Message listener - store messages for Alice
    this.agent.agent.events.on(
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

          // Store message for Alice to poll
          const connectionId = event.payload.basicMessageRecord.connectionId;
          if (!this.messageQueue.has(connectionId)) {
            this.messageQueue.set(connectionId, []);
          }
          this.messageQueue.get(connectionId)!.push({
            type: "basicMessage",
            content: event.payload.message.content,
            timestamp: new Date().toISOString(),
          });
        }
      }
    );

    // Connection state listener
    this.agent.agent.events.on(
      ConnectionEventTypes.ConnectionStateChanged,
      async (event: ConnectionStateChangedEvent) => {
        console.log(
          `Connection state changed: ${event.payload.connectionRecord.state}`
        );
      }
    );
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes() {
    // Health check
    this.app.get("/status", (req, res) => {
      res.json({
        status: "ok",
        agent: "mediator",
        name: this.name,
      });
    });

    // Alice polls for messages
    this.app.get("/messages/:connectionId", (req, res) => {
      const { connectionId } = req.params;
      const messages = this.messageQueue.get(connectionId) || [];

      // Clear messages after Alice retrieves them
      this.messageQueue.set(connectionId, []);

      res.json({
        success: true,
        messages,
        count: messages.length,
      });
    });

    // Forward message to Alice (store for polling)
    this.app.post("/messages/forward", (req, res) => {
      const { connectionId, message } = req.body;

      if (!this.messageQueue.has(connectionId)) {
        this.messageQueue.set(connectionId, []);
      }

      this.messageQueue.get(connectionId)!.push({
        type: "forwarded",
        content: message,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: "Message queued for Alice",
      });
    });

    // Create invitation for Alice to connect
    this.app.post("/connection/create-invitation", async (req, res) => {
      try {
        const invitationUrl = await this.agent.createConnectionInvitation(
          "https://mediator.yanis.gr"
        );

        res.json({
          success: true,
          invitationUrl,
          message: "Mediator invitation created for Alice",
        });
      } catch (error: any) {
        console.error("Error creating mediator invitation:", error);
        res.status(500).json({
          error: "Failed to create mediator invitation",
          details: error.message,
        });
      }
    });

    // Get all connections
    this.app.get("/connections", async (req, res) => {
      try {
        const connections = await this.agent.agent.modules.connections.getAll();
        res.json({
          success: true,
          connections: connections.map((conn) => ({
            id: conn.id,
            state: conn.state,
            theirLabel: conn.theirLabel,
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
  }

  public async start() {
    return new Promise<void>((resolve) => {
      this.app.listen(this.port, () => {
        console.log(
          `\nMediator server running on http://localhost:${this.port}`
        );
        console.log("DIDComm agent running on port:", this.agentPort);
        console.log("\nAvailable endpoints:");
        console.log("  GET  /status - Check server status");
        console.log(
          "  POST /connection/create-invitation - Create invitation for Alice"
        );
        console.log("  GET  /connections - Get all connections");
        console.log(
          "  GET  /messages/:connectionId - Alice polls for messages"
        );
        console.log("  POST /messages/forward - Forward message to Alice");
        console.log("\n");
        resolve();
      });
    });
  }
}

void runMediatorServer();
