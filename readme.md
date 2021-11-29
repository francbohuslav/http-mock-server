# HTTP mock server

Print out requests in console window and send specific response.

Home page: <https://github.com/francbohuslav/http-mock-server>  
Skype: [cis_franc](skype:cis_franc), E-mail: [bohuslav.franc@unicornuniverse.eu](bohuslav.franc@unicornuniverse.eu)

---

## Preparation

[Node.js](https://nodejs.org/) must be installed.

---

## Instalation

1. Clone GIT repository https://github.com/francbohuslav/http-mock-server.git.
2. Go to directory of http-mock-server.
3. Install node modules by command `npm i`.
4. Build app by command `npm run build`.

Update of app can be done by `pull_and_build.bat` file.

---

## Usage

1. Run command `node index`.
2. Execute requests against localhost:4444
3. Get requests history on address http://localhost:4445/
4. Get last request info on address http://localhost:4445/get-last-request/{your-request-url}

### Options

Look into `config.jsonc` and I think you will understand :-).
