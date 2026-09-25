module.exports = {
  echo(requestContent, responseContent) {
    responseContent.body = `echo ${requestContent.url}: ${requestContent.body}`;
    responseContent.headers.sourceHeader = requestContent.headers.source;
  },

  async failing() {
    throw new Error("processor failed");
  },
};
