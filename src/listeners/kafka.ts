import { Consumer, Kafka, KafkaMessage, PartitionAssigners, Producer } from "kafkajs";
import { IKafkaListenerConfig, IKafkaResponseDefConfig, IRequestContent, IRequestDefConfig, IResponseContent } from "../interfaces";
import Memory from "../memory";
import { Responses } from "../responses";
import { Listener } from "./listener";

export class KafkaListener extends Listener {
    private consumer: Consumer;
    private producer: Producer;

    constructor(private name: string, private config: IKafkaListenerConfig, private memory: Memory, responses: Responses) {
        super(responses);
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

    private async processRequest(topic: string, request: KafkaMessage, requestDefConfig: IRequestDefConfig): Promise<void> {
        const requestBody = request.value.toString();
        const requestObject: IRequestContent = { time: new Date().toISOString(), headers: {}, body: request.value.toString() };
        console.log(`-------------------------------------------------------------------------------- ${new Date().toLocaleString()}`);
        console.log(`Received Kafka request in ${topic} topic`);
        requestObject.headers = request.headers;
        this.printHeaders(request.headers);
        console.log("");
        console.log(requestBody || "{no body}");
        console.log("");
        const memoryData = this.memory.pushRequest("kafka", "/" + topic, requestObject, null);
        if (requestDefConfig.sendResponse) {
            await this.responses.sendResponse(this.name, requestDefConfig, memoryData);
        }
    }

    public async sendResponse(responseConfig: IKafkaResponseDefConfig, responseContent: IResponseContent): Promise<void> {
        console.log(`-------------------------------------------------------------------------------- ${new Date().toLocaleString()}`);
        console.log(`Sending Kafka response to topic ${responseConfig.targetTopic}`);
        this.printHeaders(responseContent.headers);
        console.log("");
        console.log(responseContent.body || "{no body}");
        console.log("");
        await this.producer.send({
            topic: responseConfig.targetTopic,
            messages: [{ headers: responseContent.headers, value: responseContent.body }],
        });
    }
}
