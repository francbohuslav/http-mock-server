module.exports = {
  /**
   *
   * @param {import("../../src/interfaces").IRequestContent} requestContent
   * @param {import("../../src/interfaces").IResponseContent} responseContent
   */
  upperCase: (_requestContent, responseContent) => {
    responseContent.body = responseContent.body.toUpperCase();
  },
};
