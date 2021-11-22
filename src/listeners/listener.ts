export abstract class Listener {
    public printHeaders(headers: RawHeaders): StringHeaders {
        const res: StringHeaders = {};
        if (Object.keys(headers).length) {
            console.log("");
            for (const header of Object.keys(headers)) {
                console.log(header + ": " + headers[header]);
                res[header] = headers[header].toString();
            }
        }
        return res;
    }
}

export type RawHeaders = { [key: string]: any };
export type StringHeaders = { [key: string]: string };
