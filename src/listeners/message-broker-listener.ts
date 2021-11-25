import {
    IListenerType,
    IMessageBrokerListenerConfig,
    IMessageBrokerResponseDefConfig,
    IRequestContent,
    IRequestDefConfig,
    IResponseContent,
} from "../interfaces";
import Memory from "../memory";
import { Responses } from "../responses";
import { Listener } from "./listener";

export abstract class MessageBrokerListener extends Listener {
    constructor(
        protected responses: Responses,
        protected memory: Memory,
        protected listenerType: IListenerType,
        protected listenerName: string,
        protected config: IMessageBrokerListenerConfig
    ) {
        super(responses);
    }

    protected async processMessageBrokerRequest(topic: string, requestObject: IRequestContent, requestDefConfig: IRequestDefConfig): Promise<void> {
        console.log(`-------------------------------------------------------------------------------- ${new Date().toLocaleString()}`);
        console.log(`Received ${this.listenerType} request in ${topic} topic`);
        this.printHeaders(requestObject.headers);
        console.log("");
        console.log(requestObject.body || "{no body}");
        console.log("");
        const memoryData = this.memory.pushRequest(this.listenerType, "/" + topic, requestObject, null);
        if (requestDefConfig.sendResponse) {
            await this.responses.sendResponse(this.listenerName, requestDefConfig, memoryData);
        }
    }

    protected async printSendResponse(responseConfig: IMessageBrokerResponseDefConfig, responseContent: IResponseContent): Promise<void> {
        console.log(`-------------------------------------------------------------------------------- ${new Date().toLocaleString()}`);
        console.log(`Sending ${this.listenerType} response to topic ${responseConfig.targetTopic}`);
        this.printHeaders(responseContent.headers);
        console.log("");
        console.log(responseContent.body || "{no body}");
        console.log("");
    }

    protected getQueueSettins(topic: string) {
        let settings = {};
        for (const [mask, sets] of Object.entries(this.config.queueSettings)) {
            if (topic.match(new RegExp(mask))) {
                settings = sets;
            }
        }
        return settings;
    }
}
