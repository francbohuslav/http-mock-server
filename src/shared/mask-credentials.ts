/**
 * Hides the password in URLs like amqp://user:password@host, so it does not end up in logs.
 */
export function maskCredentials(url: string): string {
  return url.replace(/(\/\/[^:/@]+):[^@/]*@/, "$1:***@");
}
