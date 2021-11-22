import fs from "fs";
import { join } from "path";
import { IResponseConfig } from "./interfaces";

export class Responses {
    constructor(private defaultResponseLocation: string) {}

    public getResponseFromText(text: string): IResponseConfig {
        return {
            time: new Date().toISOString(),
            headers: {},
            body: text,
        };
    }

    public parseResponseFile(responseFile: string): IResponseConfig {
        responseFile = join(this.defaultResponseLocation, responseFile);
        const lines = fs
            .readFileSync(responseFile, "utf-8")
            .split("\n")
            .map((l) => l.trim());
        const index = lines.indexOf("");
        if (index == -1) {
            console.error(`Response file must contains header, empty line, body. Inspire from file ${this.defaultResponseLocation}`);
            process.exit(1);
        }
        const headers: { [name: string]: string } = {};
        for (let i = 0; i < index; i++) {
            const match = lines[i].match(/^(.*):(.*)$/);
            if (!match) {
                console.error(`Line ${lines[i]} is not valid header`);
            } else {
                headers[match[1].trim()] = match[2].trim();
            }
        }
        return { time: new Date().toISOString(), headers, body: lines.slice(index + 1).join("\n") };
    }
}
