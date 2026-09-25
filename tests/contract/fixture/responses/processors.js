module.exports = {
  upperCase(requestContent, responseContent) {
    responseContent.body = responseContent.body.toUpperCase();
    responseContent.headers.someHeader = requestContent.headers.someheader;
    responseContent.headers.requestUrl = requestContent.url;
  },

  echoRequest(requestContent, responseContent) {
    responseContent.headers["Content-Type"] = "application/json";
    responseContent.body = JSON.stringify({
      url: requestContent.url,
      body: requestContent.body,
      customHeader: requestContent.headers["x-custom"],
      hasTime: typeof requestContent.time === "string",
    });
  },

  setStatus(_requestContent, responseContent) {
    responseContent.statusCode = 418;
    responseContent.statusMessage = "I'm a teapot";
  },

  async delayedUpperCase(_requestContent, responseContent) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    responseContent.body = responseContent.body.toUpperCase();
  },

  async failing() {
    await new Promise((resolve) => setTimeout(resolve, 10));
    throw new Error("processor failed");
  },

  returnsValue(_requestContent, responseContent) {
    responseContent.body = "mutated";
    return { body: "ignored" };
  },
};
