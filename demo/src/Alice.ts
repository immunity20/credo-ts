import type {
  ConnectionRecord,
  CredentialExchangeRecord,
  ProofExchangeRecord,
} from "@credo-ts/didcomm";

import { BaseAgent } from "./BaseAgent";
import { Output, greenText, redText } from "./OutputClass";

export class Alice extends BaseAgent {
  public connected: boolean;
  public connectionRecordFaberId?: string;

  public constructor(port: number, name: string, endpoints?: string[]) {
    super({ port, name, endpoints });
    this.connected = false;
  }

  public static async build(
    endpoints?: string[],
    port?: number,
    name?: string
  ): Promise<Alice> {
    // Alice runs on server1 with holder.yanis.gr domain
    // Need to specify external endpoint so verifier can reach back to Alice
    const alicePort = port || 3001;
    const aliceName = name || "alice";
    const alice = new Alice(alicePort, aliceName, endpoints);
    await alice.initializeAgent();
    return alice;
  }

  private async getConnectionRecord() {
    if (!this.connectionRecordFaberId) {
      throw Error(redText(Output.MissingConnectionRecord));
    }
    return await this.agent.modules.connections.getById(
      this.connectionRecordFaberId
    );
  }

  private async receiveConnectionRequest(invitationUrl: string) {
    console.log(`🔍 Parsing invitation URL: ${invitationUrl}`);

    const { connectionRecord, outOfBandRecord } =
      await this.agent.modules.oob.receiveInvitationFromUrl(invitationUrl);

    if (!connectionRecord) {
      throw new Error(redText(Output.NoConnectionRecordFromOutOfBand));
    }

    console.log(`📋 Out-of-band record details:`, {
      id: outOfBandRecord.id,
      state: outOfBandRecord.state,
      autoAcceptConnection: outOfBandRecord.autoAcceptConnection,
    });

    return connectionRecord;
  }

  private async waitForConnection(connectionRecord: ConnectionRecord) {
    console.log(
      `🔄 Waiting for connection ${connectionRecord.id} to establish...`
    );

    try {
      // Increase timeout to 60 seconds for cross-network connections
      const record = await this.agent.modules.connections.returnWhenIsConnected(
        connectionRecord.id,
        { timeoutMs: 60000 } // 60 second timeout instead of default 20 seconds
      );
      console.log("omg2");
      this.connected = true;
      console.log(greenText(Output.ConnectionEstablished));
      return record.id;
    } catch (error) {
      console.log(`❌ Connection timeout after 60 seconds. Error:`, error);
      throw error;
    }
  }

  public async acceptConnection(invitation_url: string) {
    console.log(`📨 Accepting invitation from URL: ${invitation_url}`);
    const connectionRecord = await this.receiveConnectionRequest(
      invitation_url
    );
    console.log(`🔗 Connection record created:`, {
      id: connectionRecord.id,
      state: connectionRecord.state,
      theirDid: connectionRecord.theirDid,
      outOfBandId: connectionRecord.outOfBandId,
    });
    this.connectionRecordFaberId = await this.waitForConnection(
      connectionRecord
    );
  }

  public async acceptCredentialOffer(
    credentialRecord: CredentialExchangeRecord
  ) {
    await this.agent.modules.credentials.acceptOffer({
      credentialRecordId: credentialRecord.id,
    });
  }

  public async acceptProofRequest(proofRecord: ProofExchangeRecord) {
    const requestedCredentials =
      await this.agent.modules.proofs.selectCredentialsForRequest({
        proofRecordId: proofRecord.id,
      });

    await this.agent.modules.proofs.acceptRequest({
      proofRecordId: proofRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    });
    console.log(greenText("\nProof request accepted!\n"));
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
