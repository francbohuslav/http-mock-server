import { Consumer, Kafka, KafkaMessage, PartitionAssigners, Producer } from "kafkajs";
import { IConsole, IMessageBrokerListenerConfig, IMessageBrokerResponseDefConfig, IRequestContent, IRequestDefConfig, IResponseContent } from "../interfaces";
import Memory from "../memory";
import { Responses } from "../responses";
import { MessageBrokerListener } from "./message-broker-listener";

export class KafkaListener extends MessageBrokerListener {
  private consumer: Consumer;
  private producer: Producer;

  constructor(name: string, config: IMessageBrokerListenerConfig, memory: Memory, responses: Responses, console: IConsole) {
    super(responses, memory, "kafka", name, config, console);
  }

  public async listen(): Promise<KafkaListener> {
    console.log(`Kafka listener on ${this.config.host}...`);

    const kafka = new Kafka({
      clientId: "http-mock-server",
      brokers: [this.config.host],
    });
    this.consumer = kafka.consumer({
      groupId: "group_id.mockserver" + new Date().getTime(),
      partitionAssigners: [PartitionAssigners.roundRobin],
    });
    this.producer = kafka.producer();

    await this.producer.connect();
    await this.consumer.connect();
    for (const topic of Object.keys(this.config.requests)) {
      await this.consumer.subscribe({ topic: topic, fromBeginning: false });
    }
    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          await this.processRequest(topic, message, this.config.requests[topic]);
        } catch (ex) {
          console.error(ex);
        }
      },
    });

    return this;
  }

  private async processRequest(topic: string, request: KafkaMessage, requestDefConfig: IRequestDefConfig): Promise<void> {
    const requestObject: IRequestContent = {
      time: new Date().toISOString(),
      headers: request.headers,
      body: request.value.toString(),
    };
    this.processMessageBrokerRequest(topic, requestObject, requestDefConfig);
  }

  public async sendResponse(responseConfig: IMessageBrokerResponseDefConfig, responseContent: IResponseContent): Promise<void> {
    await this.printSendResponse(responseConfig, responseContent);
    await this.producer.send({
      topic: responseConfig.targetTopic,
      messages: [{ headers: responseContent.headers, value: responseContent.body }],
    });
  }
}
