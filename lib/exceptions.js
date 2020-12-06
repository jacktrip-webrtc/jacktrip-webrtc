class Exception extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class CommunicationException extends Exception {
  constructor(message) {
    super(message);
  }
}

module.exports = {
  Exception,
  CommunicationException
};
