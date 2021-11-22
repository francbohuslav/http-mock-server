import http, { IncomingMessage, OutgoingMessage } from "http";
import Memory from "../memory";
import { IConfig, IHttpListenerConfig, IKafkaListenerConfig, IRequestConfig, IResponseConfig } from "../interfaces";
import fs from "fs";
import path from "path";
import { Kafka, PartitionAssigners } from "kafkajs";

export class KafkaListener {
    constructor(private config: IKafkaListenerConfig, configPath: string, responsesDirectory: string, memory: Memory) {}

    public listen(): KafkaListener {
        console.log(`Kafka listener on ${this.config.host}...`);

        const kafka = new Kafka({
            clientId: "http-mock-server",
            brokers: [this.config.host],
        });
        const consumer = kafka.consumer({
            groupId: "group_id.mockserver" + new Date().getTime(),
            partitionAssigners: [PartitionAssigners.roundRobin],
        });
        (async () => {
            await consumer.connect();
            Object.entries(this.config.queues).forEach(async ([queue, queueConfig]) => {
                await consumer.subscribe({ topic: queue, fromBeginning: true }); //TODO: BF: vypnout true

                await consumer.run({
                    eachMessage: async ({ topic, partition, message }) => {
                        console.log({
                            topic,
                            partition,
                            value: message.value.toString(),
                        });
                    },
                });
            });
        })();
        return this;
    }
}
