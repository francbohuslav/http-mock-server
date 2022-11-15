module.exports = {
  /**
   *
   * @param {import("../../src/interfaces").IRequestContent} requestContent
   * @param {import("../../src/interfaces").IResponseContent} responseContent
   */
  upperCase: (requestContent, responseContent) => {
    responseContent.body = responseContent.body.toUpperCase();
    responseContent.headers.someHeader = requestContent.headers.someHeader;
  },
};
