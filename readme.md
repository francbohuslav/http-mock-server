# HTTP mock server

Print out requests in console window and send specific response.

Home page: <https://github.com/francbohuslav/http-mock-server>  
Skype: [cis_franc](skype:cis_franc), E-mail: [bohuslav.franc@unicornuniverse.eu](bohuslav.franc@unicornuniverse.eu)

---

## Preparation

[Node.js](https://nodejs.org/) must be installed.

---

## Instalation

1. Clone GIT repository https://github.com/francbohuslav/egw-builder.git.
2. Install node modules by command `npm i` from folder of builder.

---

## Usage

Run command `node index`.


### Options

Look into `config.json` and I think you will understand :-).

```jsonc
{
    // App listen requests on this port
    "port": 8888,

    // Request => response mapping
    "requests": {

        // Regular expresion for request URI: response type
        // First match wins.
        // E.g. request to /tests will generate simple text response "This is text response"
        "^/test$": "text:This is text response",

        // All unhandled requests are processed here. 
        // E.g. response is taken from file responses/defaultResponse.txt
        // Files supports custom response headers
        "": "file:defaultResponse.txt"
    }
}
```