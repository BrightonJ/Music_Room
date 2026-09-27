// Error whose message can be shown to the client (validation, permissions...).
// Anything else is logged server-side and answered with a generic message.
class ClientError extends Error {
  constructor(message, status = 400, code) {
    super(message);
    this.name = 'ClientError';
    this.status = status;
    this.code = code;
  }
}

module.exports = { ClientError };
