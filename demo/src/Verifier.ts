import type {
  ConnectionRecord,
  ConnectionStateChangedEvent,
} from "@credo-ts/didcomm";

import { ConnectionEventTypes } from "@credo-ts/didcomm";

import { BaseAgent } from "./BaseAgent";
import { Color, Output, greenText, purpleText, redText } from "./OutputClass";

export class Verifier extends BaseAgent {
  public outOfBandId?: string;

  public constructor(port: number, name: string, endpoints?: string[]) {
    super({ port, name, endpoints });
  }

  public static async build(
    endpoints?: string[],
    port?: number,
    name?: string
  ): Promise<Verifier> {
    const verifierPort = port || 3003;
    const verifierName = name || "verifier";
    const verifier = new Verifier(verifierPort, verifierName, endpoints);
    await verifier.initializeAgent();
    return verifier;
  }

  private async getConnectionRecord() {
    if (!this.outOfBandId) {
      throw Error(redText(Output.MissingConnectionRecord));
    }

    const [connection] =
      await this.agent.modules.connections.findAllByOutOfBandId(
        this.outOfBandId
      );

    if (!connection) {
      throw Error(redText(Output.MissingConnectionRecord));
    }

    return connection;
  }

  private async printConnectionInvite(domain?: string) {
    const outOfBand = await this.agent.modules.oob.createInvitation();
    this.outOfBandId = outOfBand.id;

    const invitationDomain = domain || `http://localhost:${this.port}`;
    const invitationUrl = outOfBand.outOfBandInvitation.toUrl({
      domain: invitationDomain,
    });

    console.log(Output.ConnectionLink, invitationUrl, "\n");
    return invitationUrl;
  }

  private async waitForConnection() {
    if (!this.outOfBandId) {
      throw new Error(redText(Output.MissingConnectionRecord));
    }

    console.log("Waiting for Alice to finish connection...");

    const getConnectionRecord = (outOfBandId: string) =>
      new Promise<ConnectionRecord>((resolve, reject) => {
        // Timeout of 20 seconds
        const timeoutId = setTimeout(
          () => reject(new Error(redText(Output.MissingConnectionRecord))),
          20000
        );

        // Start listener
        this.agent.events.on<ConnectionStateChangedEvent>(
          ConnectionEventTypes.ConnectionStateChanged,
          (e) => {
            if (e.payload.connectionRecord.outOfBandId !== outOfBandId) return;

            clearTimeout(timeoutId);
            resolve(e.payload.connectionRecord);
          }
        );

        // Also retrieve the connection record by invitation if the event has already fired
        void this.agent.modules.connections
          .findAllByOutOfBandId(outOfBandId)
          .then(([connectionRecord]) => {
            if (connectionRecord) {
              clearTimeout(timeoutId);
              resolve(connectionRecord);
            }
          });
      });

    const connectionRecord = await getConnectionRecord(this.outOfBandId);

    try {
      await this.agent.modules.connections.returnWhenIsConnected(
        connectionRecord.id
      );
    } catch (_e) {
      console.log(
        redText("\nTimeout of 20 seconds reached.. Returning to home screen.\n")
      );
      return;
    }
    console.log(greenText(Output.ConnectionEstablished));
  }

  public async setupConnection(domain?: string) {
    const url = await this.printConnectionInvite(domain);
    await this.waitForConnection();
    return url;
  }

  public async createConnectionInvitation(customDomain?: string) {
    const outOfBand = await this.agent.modules.oob.createInvitation();
    this.outOfBandId = outOfBand.id;

    const domain = customDomain || `http://localhost:${this.port}`;
    const invitationUrl = outOfBand.outOfBandInvitation.toUrl({
      domain: domain,
    });

    console.log(Output.ConnectionLink, invitationUrl, "\n");
    return invitationUrl;
  }

  private async printProofFlow(print: string) {
    console.log(print);
    await new Promise((f) => setTimeout(f, 2000));
  }

  private async newProofAttribute() {
    await this.printProofFlow(
      greenText(`Creating new proof attribute for verification...\n`)
    );

    // For verifier, we want to verify all attributes from the credential
    const proofAttribute = {
      mac: {
        name: "mac",
        restrictions: [], // Accept any credential with this attribute
      },
      deviceId: {
        name: "deviceId",
        restrictions: [],
      },
      hash: {
        name: "hash",
        restrictions: [],
      },
    };

    return proofAttribute;
  }

  public async sendProofRequest() {
    const connectionRecord = await this.getConnectionRecord();
    const proofAttribute = await this.newProofAttribute();
    await this.printProofFlow(greenText("\nRequesting proof...\n", false));

    await this.agent.modules.proofs.requestProof({
      protocolVersion: "v2",
      connectionId: connectionRecord.id,
      proofFormats: {
        anoncreds: {
          name: "proof-request",
          version: "1.0",
          requested_attributes: proofAttribute,
        },
      },
    });
    console.log(
      `\nProof request sent!\n\nWaiting for Alice to respond with proof\n\n${Color.Reset}`
    );
  }

  public async sendMessage(message: string) {
    const connectionRecord = await this.getConnectionRecord();
    await this.agent.modules.basicMessages.sendMessage(
      connectionRecord.id,
      message
    );
  }

  public async exit() {
    console.log(Output.Exit);
    await this.agent.shutdown();
    process.exit(0);
  }

  public async restart() {
    await this.agent.shutdown();
  }
}
