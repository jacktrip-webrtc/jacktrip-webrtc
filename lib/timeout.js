/**
 * @class
 *
 * Class to create a timeout
**/
class Timeout {
  /**
   * @constructor
   *
   * @param {Number} seconds
   *    Seconds the timeout has to last
   *
   * @param {Function} callback
   *    Callback which is called when the timeout ends
   *
  **/
  constructor(seconds, callback) {
    this.seconds = seconds;
    this.callback = callback;

    this.timeout = undefined; // Variable used to store the timeout
  }

  /**
   * @method
   *
   * Method to start/restart the timeout
  **/
  start() {
    // Start it only if it was stopped
    if(this.timeout === undefined){
      this.timeout = setTimeout(() => {
        this.callback();
        this.timeout = undefined;
      }, this.seconds *1000);
    }
  }

  /**
   * @method
   *
   * Method to stop the timeout
  **/
  stop() {
    // Start it only if it was stopped
    if(this.timeout !== undefined){
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }
}

module.exports = Timeout;
