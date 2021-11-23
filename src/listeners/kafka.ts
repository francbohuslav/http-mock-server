import { Consumer, Kafka, KafkaMessage, PartitionAssigners, Producer } from "kafkajs";
import { delay } from "../core";
import { IKafkaListenerConfig, IKafkaTopicConfig, IRequestConfig, IResponseConfig } from "../interfaces";
import Memory, { IMemoryData } from "../memory";
import { Responses } from "../responses";
import { Listener } from "./listener";

export class KafkaListener extends Listener {
    private consumer: Consumer;
    private producer: Producer;

    constructor(private config: IKafkaListenerConfig, private memory: Memory, private responses: Responses, responseProcessors: any) {
        super(responseProcessors);
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
        for (const topic of Object.keys(this.config.topics)) {
            await this.consumer.subscribe({ topic: topic, fromBeginning: false });
        }
        await this.consumer.run({
            eachMessage: async ({ topic, message }) => {
                try {
                    await this.processRequest(topic, message, this.config.topics[topic]);
                } catch (ex) {
                    console.error(ex);
                }
            },
        });

        /*setTimeout(() => {
            console.log("posima");
            this.producer.send({
                topic: "incoming_kafka_topic",
                messages: [{ value: "test" }],
            });
            this.producer.send({
                topic: "incoming_kafka_topic2",
                messages: [{ value: "test2" }],
            });
        }, 2000);
*/
        return this;
    }

    private async processRequest(topic: string, request: KafkaMessage, topicConfig: IKafkaTopicConfig): Promise<void> {
        const requestBody = request.value.toString();
        const requestObject: IRequestConfig = { time: new Date().toISOString(), headers: {}, body: request.value.toString() };
        console.log(`-------------------------------------------------------------------------------- ${new Date().toLocaleString()}`);
        console.log(`Received Kafka request in ${topic} topic`);
        requestObject.headers = request.headers;
        this.printHeaders(request.headers);
        console.log("");
        console.log(requestBody || "{no body}");
        console.log("");
        const memoryData = this.memory.pushRequest("kafka", "/" + topic, requestObject, null);
        if (topicConfig.sendResponse) {
            if (topicConfig.delay) {
                await delay(topicConfig.delay);
            }
            await this.sendResponse(memoryData, topicConfig);
        }
    }

    private async sendResponse(memoryData: IMemoryData, topicConfig: IKafkaTopicConfig): Promise<void> {
        let responseConfig: IResponseConfig = null;
        if (topicConfig.response.startsWith("text:")) {
            responseConfig = this.responses.getResponseFromText(topicConfig.response.substr(5));
        } else if (topicConfig.response.startsWith("file:")) {
            responseConfig = this.responses.parseResponseFile(topicConfig.response.substr(5));
        } else responseConfig = { time: new Date().toISOString(), error: `Unknown response definition in config for Kafka ${topicConfig.response}` };
        if (topicConfig && topicConfig.responseProcessor) {
            this.runResponseProcessor(topicConfig.responseProcessor, memoryData.request, responseConfig);
        }
        memoryData.response = responseConfig;
        console.log(`-------------------------------------------------------------------------------- ${new Date().toLocaleString()}`);
        console.log(`Sending Kafka response to topic ${topicConfig.targetTopic}`);
        this.printHeaders(responseConfig.headers);
        console.log("");
        console.log(responseConfig.body || "{no body}");
        console.log("");
        await this.producer.send({
            topic: topicConfig.targetTopic,
            messages: [{ headers: responseConfig.headers, value: responseConfig.body }],
        });
    }
}
