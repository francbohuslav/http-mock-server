import Ajv from "ajv";
import { readFileSync } from "fs";
import { parse, ParseError, printParseErrorCode } from "jsonc-parser";
import schema from "../config.schema.json";
import { RawConfig } from "./raw-config";

/**
 * Reads config.jsonc. The file is read again on every `load()` so that rules and templates can be edited without restart.
 */
export class ConfigProvider {
  private readonly validateSchema = new Ajv({ allErrors: true, strict: false }).compile(schema);

  constructor(private readonly configPath: string) {}

  public load(): RawConfig {
    const text = readFileSync(this.configPath, "utf-8");
    const errors: ParseError[] = [];
    const config = parse(text, errors, { allowTrailingComma: true });
    if (errors.length) {
      const details = errors.map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`).join(", ");
      throw new Error(`Invalid JSONC in ${this.configPath}: ${details}`);
    }
    if (!config || typeof config !== "object" || !config.listeners || typeof config.listeners !== "object") {
      throw new Error(`Config ${this.configPath} must be an object with "apiPort" and "listeners"`);
    }
    return config as RawConfig;
  }

  /**
   * Returns schema violations as human readable messages. They are reported as warnings only, so that older configs keep working.
   */
  public validate(config: RawConfig): string[] {
    if (this.validateSchema(config)) {
      return [];
    }
    return (this.validateSchema.errors || []).map((error) => {
      const extra = error.keyword === "additionalProperties" ? ` (${(error.params as { additionalProperty: string }).additionalProperty})` : "";
      return `${error.instancePath || "/"} ${error.message}${extra}`;
    });
  }
}
