import type { RegisterCredentialDefinitionReturnStateFinished } from "@credo-ts/anoncreds";
import type {
  ConnectionRecord,
  ConnectionStateChangedEvent,
} from "@credo-ts/didcomm";
import type {
  IndyVdrRegisterCredentialDefinitionOptions,
  IndyVdrRegisterSchemaOptions,
} from "@credo-ts/indy-vdr";
import type BottomBar from "inquirer/lib/ui/bottom-bar";

import { TypedArrayEncoder, utils } from "@credo-ts/core";
import { ConnectionEventTypes } from "@credo-ts/didcomm";
import { ui } from "inquirer";

import { transformPrivateKeyToPrivateJwk } from "@credo-ts/askar";
import { BaseAgent, indyNetworkConfig } from "./BaseAgent";
import { Color, Output, greenText, purpleText, redText } from "./OutputClass";

export enum RegistryOptions {
  indy = "did:indy",
  cheqd = "did:cheqd",
}

export class Faber extends BaseAgent {
  public outOfBandId?: string;
  public credentialDefinition?: RegisterCredentialDefinitionReturnStateFinished;
  public anonCredsIssuerId?: string;
  public ui: BottomBar;
  public schemaId?: string; // Store the schema ID to reuse
  public schemaRegistered: boolean = false; // Track if schema is already registered

  public constructor(port: number, name: string, endpoints?: string[]) {
    super({ port, name, endpoints });
    this.ui = new ui.BottomBar();
  }

  public static async build(
    endpoints?: string[],
    port?: number,
    name?: string
  ): Promise<Faber> {
    const faberPort = port || 9001;
    const faberName = name || "faber";
    const faber = new Faber(faberPort, faberName, endpoints);
    await faber.initializeAgent();
    return faber;
  }

  public async importDid(registry: string) {
    // NOTE: we assume the did is already registered on the ledger, we just store the private key in the wallet
    // and store the existing did in the wallet
    // indy did is based on private key (seed)
    const unqualifiedIndyDid = "2jEvRuKmfBJTRa7QowDpNN";
    const cheqdDid = "did:cheqd:testnet:d37eba59-513d-42d3-8f9f-d1df0548b675";
    const indyDid = `did:indy:${indyNetworkConfig.indyNamespace}:${unqualifiedIndyDid}`;
    const didDocumentRelativeKeyId =
      registry === RegistryOptions.indy ? "#verkey" : "#key-1";

    const did = registry === RegistryOptions.indy ? indyDid : cheqdDid;
    const { privateJwk } = transformPrivateKeyToPrivateJwk({
      type: {
        crv: "Ed25519",
        kty: "OKP",
      },
      privateKey: TypedArrayEncoder.fromString(
        "afjdemoverysercure00000000000000"
      ),
    });

    const { keyId } = await this.agent.kms.importKey({
      privateJwk,
    });

    await this.agent.dids.import({
      did,
      overwrite: true,
      keys: [
        {
          didDocumentRelativeKeyId,
          kmsKeyId: keyId,
        },
      ],
    });
    this.anonCredsIssuerId = did;
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

  private async printConnectionInvite() {
    const outOfBand = await this.agent.modules.oob.createInvitation();
    this.outOfBandId = outOfBand.id;

    console.log(
      Output.ConnectionLink,
      outOfBand.outOfBandInvitation.toUrl({
        domain: `http://localhost:${this.port}`,
      }),
      "\n"
    );
    return outOfBand.outOfBandInvitation.toUrl({
      domain: `http://localhost:${this.port}`,
    });
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

  public async setupConnection() {
    const url = await this.printConnectionInvite();
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

  private printSchema(name: string, version: string, attributes: string[]) {
    console.log("\n\nThe credential definition will look like this:\n");
    console.log(purpleText(`Name: ${Color.Reset}${name}`));
    console.log(purpleText(`Version: ${Color.Reset}${version}`));
    console.log(
      purpleText(
        `Attributes: ${Color.Reset}${attributes[0]}, ${attributes[1]}, ${attributes[2]}\n`
      )
    );
  }

  private async registerSchema() {
    if (!this.anonCredsIssuerId) {
      throw new Error(redText("Missing anoncreds issuerId"));
    }

    // Use a fixed schema name instead of random UUID to allow reuse
    const schemaTemplate = {
      name: "DomX IoT Device Credential",
      version: "1.0.0",
      attrNames: ["mac", "deviceId", "hash"],
      issuerId: this.anonCredsIssuerId,
    };

    this.printSchema(
      schemaTemplate.name,
      schemaTemplate.version,
      schemaTemplate.attrNames
    );
    this.ui.updateBottomBar(greenText("\nRegistering schema...\n", false));

    const { schemaState } =
      await this.agent.modules.anoncreds.registerSchema<IndyVdrRegisterSchemaOptions>(
        {
          schema: schemaTemplate,
          options: {
            endorserMode: "internal",
            endorserDid: this.anonCredsIssuerId,
          },
        }
      );

    if (schemaState.state !== "finished") {
      throw new Error(
        `Error registering schema: ${
          schemaState.state === "failed" ? schemaState.reason : "Not Finished"
        }`
      );
    }
    this.ui.updateBottomBar("\nSchema registered!\n");
    this.schemaId = schemaState.schemaId;
    this.schemaRegistered = true;
    return schemaState;
  }

  private async registerCredentialDefinition(schemaId: string) {
    if (!this.anonCredsIssuerId) {
      throw new Error(redText("Missing anoncreds issuerId"));
    }

    this.ui.updateBottomBar("\nRegistering credential definition...\n");
    const { credentialDefinitionState } =
      await this.agent.modules.anoncreds.registerCredentialDefinition<IndyVdrRegisterCredentialDefinitionOptions>(
        {
          credentialDefinition: {
            schemaId,
            issuerId: this.anonCredsIssuerId,
            tag: "latest",
          },
          options: {
            supportRevocation: false,
            endorserMode: "internal",
            endorserDid: this.anonCredsIssuerId,
          },
        }
      );

    if (credentialDefinitionState.state !== "finished") {
      throw new Error(
        `Error registering credential definition: ${
          credentialDefinitionState.state === "failed"
            ? credentialDefinitionState.reason
            : "Not Finished"
        }}`
      );
    }

    this.credentialDefinition = credentialDefinitionState;
    this.ui.updateBottomBar("\nCredential definition registered!!\n");
    return this.credentialDefinition;
  }

  public async issueCredential({
    mac,
    deviceId,
    hash,
  }: {
    mac: string;
    deviceId: string;
    hash: string;
  }) {
    // Only register schema and credential definition if not already done
    if (!this.schemaRegistered || !this.credentialDefinition) {
      console.log(
        purpleText(
          "\n🔧 Setting up schema and credential definition (first time only)..."
        )
      );

      const schema = await this.registerSchema();
      const credentialDefinition = await this.registerCredentialDefinition(
        schema.schemaId
      );

      console.log(
        purpleText("✅ Schema and credential definition ready for reuse!")
      );
    } else {
      console.log(
        purpleText("\n♻️ Reusing existing schema and credential definition...")
      );
    }

    const connectionRecord = await this.getConnectionRecord();

    this.ui.updateBottomBar("\nSending credential offer...\n");

    await this.agent.modules.credentials.offerCredential({
      connectionId: connectionRecord.id,
      protocolVersion: "v2",
      credentialFormats: {
        anoncreds: {
          attributes: [
            {
              name: "mac",
              value: mac,
            },
            {
              name: "deviceId",
              value: deviceId,
            },
            {
              name: "hash",
              value: hash,
            },
          ],
          credentialDefinitionId:
            this.credentialDefinition!.credentialDefinitionId,
        },
      },
    });
    this.ui.updateBottomBar(
      `\nCredential offer sent!\n\nGo to the Alice agent to accept the credential offer\n\n${Color.Reset}`
    );
  }

  private async printProofFlow(print: string) {
    this.ui.updateBottomBar(print);
    await new Promise((f) => setTimeout(f, 2000));
  }

  private async newProofAttribute() {
    await this.printProofFlow(
      greenText(`Creating new proof attribute for 'name' ...\n`)
    );
    const proofAttribute = {
      name: {
        name: "name",
        restrictions: [
          {
            cred_def_id: this.credentialDefinition?.credentialDefinitionId,
          },
        ],
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
    this.ui.updateBottomBar(
      `\nProof request sent!\n\nGo to the Alice agent to accept the proof request\n\n${Color.Reset}`
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
