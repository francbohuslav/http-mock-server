import { Kafka, KafkaMessage, PartitionAssigners } from "kafkajs";
import { IKafkaListenerConfig, IRequestConfig } from "../interfaces";
import Memory from "../memory";

export class KafkaListener {
    constructor(private config: IKafkaListenerConfig, configPath: string, responsesDirectory: string, private memory: Memory) {}

    public async listen(): Promise<KafkaListener> {
        console.log(`Kafka listener on ${this.config.host}...`);

        const kafka = new Kafka({
            clientId: "http-mock-server",
            brokers: [this.config.host],
        });
        const consumer = kafka.consumer({
            groupId: "group_id.mockserver" + new Date().getTime(),
            partitionAssigners: [PartitionAssigners.roundRobin],
        });

        await consumer.connect();
        Object.entries(this.config.queues).forEach(async ([queue, queueConfig]) => {
            await consumer.subscribe({ topic: queue, fromBeginning: true }); //TODO: BF: vypnout true

            await consumer.run({
                eachMessage: async ({ topic, message }) => {
                    this.processRequest(topic, message);
                },
            });
        });
        return this;
    }

    private processRequest(queue: string, request: KafkaMessage) {
        const requestBody = request.value.toString();
        const requestObject: IRequestConfig = { time: new Date().toISOString(), headers: {}, body: request.value.toString() };
        console.log(`-------------------------------------------------------------------------------- ${new Date().toLocaleString()}`);
        console.log(`Received Kafka request in ${queue} queue`);
        console.log("");
        for (const header of Object.keys(request.headers)) {
            console.log(header + ": " + request.headers[header]);
            requestObject.headers[header] = request.headers[header].toString();
        }
        console.log("");
        console.log(requestBody || "{no body}");
        console.log("");
        this.memory.pushRequest("kafka", queue, requestObject, null);
    }
}
