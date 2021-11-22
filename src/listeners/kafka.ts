import { Consumer, Kafka, KafkaMessage, PartitionAssigners, Producer } from "kafkajs";
import { IKafkaListenerConfig, IKafkaTopicConfig, IRequestConfig, IResponseConfig } from "../interfaces";
import Memory, { IMemoryData } from "../memory";
import { Responses } from "../responses";
import { Listener } from "./listener";

export class KafkaListener extends Listener {
    private consumer: Consumer;
    private producer: Producer;

    constructor(private config: IKafkaListenerConfig, private memory: Memory, private responses: Responses) {
        super();
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
        Object.entries(this.config.topics).forEach(async ([topic, topicConfig]) => {
            await this.consumer.subscribe({ topic: topic, fromBeginning: true }); //TODO: BF: vypnout true

            await this.consumer.run({
                eachMessage: async ({ topic, message }) => {
                    this.processRequest(topic, message, topicConfig);
                },
            });
        });
        return this;
    }

    private processRequest(topic: string, request: KafkaMessage, topicConfig: IKafkaTopicConfig) {
        const requestBody = request.value.toString();
        const requestObject: IRequestConfig = { time: new Date().toISOString(), headers: {}, body: request.value.toString() };
        console.log(`-------------------------------------------------------------------------------- ${new Date().toLocaleString()}`);
        console.log(`Received Kafka request in ${topic} topic`);
        requestObject.headers = this.printHeaders(request.headers);
        console.log("");
        console.log(requestBody || "{no body}");
        console.log("");
        const memoryData = this.memory.pushRequest("kafka", topic, requestObject, null);
        if (topicConfig.sendResponse) {
            setTimeout(() => this.sendResponse(memoryData, topicConfig), topicConfig.delay);
        }
    }

    private sendResponse(memoryData: IMemoryData, topicConfig: IKafkaTopicConfig): void {
        let responseConfig: IResponseConfig = null;
        if (topicConfig.response.startsWith("text:")) {
            responseConfig = this.responses.getResponseFromText(topicConfig.response.substr(5));
        } else if (topicConfig.response.startsWith("file:")) {
            responseConfig = this.responses.parseResponseFile(topicConfig.response.substr(5));
        } else responseConfig = { time: new Date().toISOString(), error: `Unknown response definition in config for Kafka ${topicConfig.response}` };
        memoryData.response = responseConfig;
        console.log(`-------------------------------------------------------------------------------- ${new Date().toLocaleString()}`);
        console.log(`Sending Kafka response to topic ${topicConfig.targetTopic}`);
        this.printHeaders(responseConfig.headers);
        console.log("");
        console.log(responseConfig.body || "{no body}");
        console.log("");
        this.producer.send({
            topic: topicConfig.targetTopic,
            messages: [{ headers: responseConfig.headers, value: responseConfig.body }],
        });
    }
}
