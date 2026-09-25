module.exports = {
  /**
   *
   * @param {import("../../src/interfaces").IRequestContent} requestContent
   * @param {import("../../src/interfaces").IResponseContent} responseContent
   */
  upperCase: (requestContent, responseContent) => {
    responseContent.body = responseContent.body.toUpperCase();
    responseContent.headers.someHeader = requestContent.headers.someHeader;
    responseContent.headers.requestUrl = requestContent.url;
  },

  /**
   * @param {import("../../src/interfaces").IRequestContent} _requestContent
   * @param {import("../../src/interfaces").IResponseContent} responseContent
   */
  delayedUpperCase: async (_requestContent, responseContent) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    responseContent.body = responseContent.body.toUpperCase();
  },

  failing: async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    throw new Error("processor failed");
  },
};
