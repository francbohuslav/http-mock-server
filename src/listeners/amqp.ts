import amqp, { Channel, Connection, Message } from "amqplib/callback_api";
import { promisify } from "util";
import { IConsole, IMessageBrokerListenerConfig, IMessageBrokerResponseDefConfig, IRequestContent, IRequestDefConfig, IResponseContent } from "../interfaces";
import Memory from "../memory";
import { Responses } from "../responses";
import { MessageBrokerListener } from "./message-broker-listener";

export class AmqpListener extends MessageBrokerListener {
  private connection: Connection;
  private channel: Channel;

  private assertedChannels: Set<string> = new Set<string>();

  constructor(name: string, config: IMessageBrokerListenerConfig, memory: Memory, responses: Responses, console: IConsole) {
    super(responses, memory, "amqp", name, config, console);
  }

  public async listen(): Promise<AmqpListener> {
    console.log(`AMQP listener on ${this.config.host}...`);

    const socketOptions = {};
    /*
        Example for SSL

        "host": "amqps://guest:guest@localhost:5671/dfg?adminPort=15672", // in config.jsonc

        const socketOptions = {
            cert: fs.readFileSync("C:\\{path}\\certificates\\client1\\client1.cer"),
            key: fs.readFileSync("C:\\{path}\\certificates\\client1\\client1.key"),
            passphrase: "",
            ca: [fs.readFileSync("C:\\{path}\\certificates\\ca\\ca.crt")],
            rejectUnauthorized: false, // For self signed certificate
        };
        */

    const connectAsync = promisify<string, any, Connection>(amqp.connect);
    this.connection = await connectAsync(this.config.host, socketOptions);

    this.channel = await promisify(this.connection.createChannel.bind(this.connection))();
    for (const topic of Object.keys(this.config.requests)) {
      this.assertChannel(topic);
    }

    for (const topic of Object.keys(this.config.requests)) {
      this.channel.consume(
        topic,
        async (message) => {
          try {
            await this.processRequest(topic, message, this.config.requests[topic]);
          } catch (ex) {
            console.error(ex);
          }
        },
        {
          noAck: true,
        }
      );
    }

    return this;
  }

  private assertChannel(topic: string) {
    if (this.assertedChannels.has(topic)) {
      return;
    }
    const settings = this.getQueueSettins(topic);
    this.channel.assertQueue(topic, settings);
    this.assertedChannels.add(topic);
  }

  private async processRequest(topic: string, request: Message, requestDefConfig: IRequestDefConfig): Promise<void> {
    const requestObject: IRequestContent = {
      time: new Date().toISOString(),
      headers: request.properties.headers,
      body: request.content.toString(),
    };
    this.processMessageBrokerRequest(topic, requestObject, requestDefConfig);
  }

  public async sendResponse(responseConfig: IMessageBrokerResponseDefConfig, responseContent: IResponseContent): Promise<void> {
    await this.printSendResponse(responseConfig, responseContent);
    this.assertChannel(responseConfig.targetTopic);
    this.channel.sendToQueue(responseConfig.targetTopic, Buffer.from(responseContent.body), {
      headers: responseContent.headers,
    });
  }
}
