class Operation {
  constructor(result = null) {
    this._successCallbacks = [];
    this._errorCallbacks = [];
    this._status = result ? 1 : 0;
    this._result = result;
  }

  resolve(value) {
    this._proceed(1, value);
  }

  reject(value) {
    this._proceed(2, value);
  }

  then(resolve, reject) {
    switch (this._status) {
      case 1:
        return resolve && resolve(this._result);
      case 2:
        return reject && reject(this._result);
      default: {
        resolve && this._successCallbacks.push(resolve);
        reject && this._errorCallbacks.push(reject);
      }
    }

    return this;
  }

  _proceed(status, result) {
    this._status = status;
    this._result = result;

    const callbacks =
      status === 2 ? this._errorCallbacks : this._successCallbacks;
    const count = callbacks.length;
    let i = 0;

    for (i = 0; i < count; ++i) {
      callbacks[i](result);
    }

    this._successCallbacks = [];
    this._errorCallbacks = [];
  }
}

class Parallel {
  constructor(id, data, env, onSpawn) {
    this.data = data;
    this._maxWorkers = navigator.hardwareConcurrency || 4;
    this._options = { id, env };
    this._operation = new Operation(this.data);
    this._onSpawn = onSpawn;
  }

  _spawnWorker() {
    let worker;

    try {
      worker = new Worker("src/util/shared-worker.js");
      worker.postMessage(this._options);
    } catch (e) {
      throw e;
    }

    return worker;
  }

  spawn() {
    const operation = new Operation();

    this._operation.then(() => {
      const worker = this._spawnWorker();

      if (worker) {
        worker.onmessage = (message) => {
          worker.terminate();
          this.data = message.data;
          operation.resolve(this.data);
        };
        worker.onerror = (error) => {
          worker.terminate();
          operation.reject(error);
        };
        worker.postMessage(this.data);
      } else {
        throw new Error(
          "Workers do not exist and synchronous operation not allowed!"
        );
      }
    });

    this._operation = operation;

    return this;
  }

  _spawnMapWorker(i, done, worker) {
    this._onSpawn && this._onSpawn();

    if (!worker) {
      worker = this._spawnWorker();
    }

    if (worker) {
      worker.onmessage = (message) => {
        this.data[i] = message.data;
        done(null, worker);
      };
      worker.onerror = (e) => {
        worker.terminate();
        done(e);
      };
      worker.postMessage(this.data[i]);
    } else {
      throw new Error(
        "Workers do not exist and synchronous operation not allowed!"
      );
    }
  }

  map() {
    if (!this.data.length) {
      return this.spawn();
    }

    let startedOps = 0;
    let doneOps = 0;
    const operation = new Operation();

    const done = (error, worker) => {
      if (error) {
        operation.reject(error);
      } else if (++doneOps === this.data.length) {
        operation.resolve(this.data);
        if (worker) {
          worker.terminate();
        }
      } else if (startedOps < this.data.length) {
        this._spawnMapWorker(startedOps++, done, worker);
      } else if (worker) {
        worker.terminate();
      }
    };

    this._operation.then(
      () => {
        for (
          ;
          startedOps - doneOps < this._maxWorkers &&
          startedOps < this.data.length;
          ++startedOps
        ) {
          this._spawnMapWorker(startedOps, done);
        }
      },
      function (error) {
        operation.reject(error);
      }
    );
    this._operation = operation;
  }

  then(successCallback, errorCallback = () => {}) {
    this.map();
    const operation = new Operation();

    this._operation.then(
      () => {
        let result;

        try {
          if (successCallback) {
            result = successCallback(this.data);
            if (result !== undefined) {
              this.data = result;
            }
          }
          operation.resolve(this.data);
        } catch (error) {
          if (errorCallback) {
            result = errorCallback(error);

            if (result !== undefined) {
              this.data = result;
            }

            operation.resolve(this.data);
          } else {
            operation.resolve(error);
          }
        }
      },
      (error) => {
        if (errorCallback) {
          retData = errorCallback(error);

          if (retData !== undefined) {
            this.data = retData;
          }

          operation.resolve(this.data);
        } else {
          operation.resolve(error);
        }
      }
    );
    this._operation = operation;
    return this;
  }

  static setImmediate(callback) {
    setTimeout(callback, 0);
  }

  // static method
  static isSupported() {
    return true;
  }
}
