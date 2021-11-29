import { readFileSync } from "fs";
import { jsonc } from "jsonc";
import { IConfig } from "./interfaces";

export class Configer {
    constructor(private configPath: string) {}

    public loadConfig(): IConfig {
        const config: IConfig = jsonc.parse(readFileSync(this.configPath, "utf-8"));
        return config;
    }
}
