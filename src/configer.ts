import { readFileSync } from "fs";
import { parse } from "jsonc-parser";
import { IConfig } from "./interfaces";

export class Configer {
    constructor(private configPath: string) {}

    public loadConfig(): IConfig {
        const config: IConfig = parse(readFileSync(this.configPath, "utf-8"));
        return config;
    }
}
