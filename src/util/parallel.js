function extend(from, to = {}) {
  for (let key in from) {
    if (to[key] === undefined) {
      to[key] = from[key];
    }
  }

  return to;
}

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

var defaults = {
  evalPath: null,
  maxWorkers: navigator.hardwareConcurrency || 4,
  synchronous: true,
  env: {},
  envNamespace: "env",
};

class Parallel {
  constructor(data, options) {
    this.data = data;
    this.options = extend(defaults, options);
    this.operation = new Operation(this.data);
    this.requiredScripts = [];
    this.requiredFunctions = [];
  }

  getWorkerSource(cb, env) {
    const importCount = this.requiredFunctions.length;
    let preStr = "";
    let i = 0;
    if (this.requiredScripts.length !== 0) {
      preStr +=
        'importScripts("' + this.requiredScripts.join('","') + '");\r\n';
    }
    let requiredFunction;

    for (i = 0; i < importCount; ++i) {
      requiredFunction = this.requiredFunctions[i];

      if (requiredFunction.name) {
        preStr +=
          "var " +
          requiredFunction.name +
          " = " +
          requiredFunction.fn.toString() +
          ";";
      } else {
        preStr += requiredFunction.fn.toString();
      }
    }

    env = JSON.stringify(env || {});

    var ns = this.options.envNamespace;

    return (
      preStr +
      "self.onmessage = function(e) {var global = {}; global." +
      ns +
      " = " +
      env +
      ";self.postMessage((" +
      cb.toString() +
      ")(e.data))}"
    );
  }

  require() {
    var args = Array.prototype.slice.call(arguments, 0),
      func;

    for (var i = 0; i < args.length; i++) {
      func = args[i];

      if (typeof func === "string") {
        this.requiredScripts.push(func);
      } else if (typeof func === "function") {
        this.requiredFunctions.push({ fn: func });
      } else if (typeof func === "object") {
        this.requiredFunctions.push(func);
      }
    }

    return this;
  }

  _spawnWorker(cb, env) {
    var worker;
    var src = this.getWorkerSource(cb, env);

    try {
      if (this.requiredScripts.length !== 0) {
        if (this.options.evalPath !== null) {
          worker = new Worker(this.options.evalPath);
          worker.postMessage(src);
        } else {
          throw new Error("Can't use required scripts without eval.js!");
        }
      } else {
        var blob = new Blob([src], { type: "text/javascript" });
        var url = URL.createObjectURL(blob);

        worker = new Worker(url);
      }
    } catch (e) {
      if (this.options.evalPath !== null) {
        // blob/url unsupported, cross-origin error
        worker = new Worker(this.options.evalPath);
        worker.postMessage(src);
      } else {
        throw e;
      }
    }

    return worker;
  }

  spawn = function (cb, env) {
    const operation = new Operation();

    env = extend(this.options.env, env);

    this.operation.then(() => {
      const worker = this._spawnWorker(cb, env);

      if (worker !== undefined) {
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
      } else if (this.options.synchronous) {
        Parallel.setImmediate(() => {
          try {
            this.data = cb(this.data);
            operation.resolve(this.data);
          } catch (error) {
            operation.reject(error);
          }
        });
      } else {
        throw new Error(
          "Workers do not exist and synchronous operation not allowed!"
        );
      }
    });

    this.operation = operation;

    return this;
  };

  _spawnMapWorker(i, cb, done, env, worker) {
    if (!worker) worker = this._spawnWorker(cb, env);

    if (worker !== undefined) {
      worker.onmessage = (message) => {
        this.data[i] = message.data;
        done(null, worker);
      };
      worker.onerror = (e) => {
        worker.terminate();
        done(e);
      };
      worker.postMessage(this.data[i]);
    } else if (this.options.synchronous) {
      Parallel.setImmediate(() => {
        this.data[i] = cb(this.data[i]);
        done();
      });
    } else {
      throw new Error(
        "Workers do not exist and synchronous operation not allowed!"
      );
    }
  }

  map(cb, env) {
    env = extend(this.options.env, env || {});

    if (!this.data.length) {
      return this.spawn(cb, env);
    }

    var startedOps = 0;
    var doneOps = 0;
    const operation = new Operation();

    const done = (error, worker) => {
      if (error) {
        operation.reject(error);
      } else if (++doneOps === this.data.length) {
        operation.resolve(this.data);
        if (worker) worker.terminate();
      } else if (startedOps < this.data.length) {
        this._spawnMapWorker(startedOps++, cb, done, env, worker);
      } else if (worker) {
        worker.terminate();
      }
    };

    this.operation.then(
      () => {
        for (
          ;
          startedOps - doneOps < this.options.maxWorkers &&
          startedOps < this.data.length;
          ++startedOps
        ) {
          this._spawnMapWorker(startedOps, cb, done, env);
        }
      },
      function (error) {
        operation.reject(error);
      }
    );
    this.operation = operation;
    return this;
  }

  _spawnReduceWorker(data, callback, done, env, worker) {
    if (!worker) worker = this._spawnWorker(callback, env);

    if (worker !== undefined) {
      worker.onmessage = (message) => {
        this.data[that.data.length] = message.data;
        done(null, worker);
      };
      worker.onerror = (error) => {
        worker.terminate();
        done(error, null);
      };
      worker.postMessage(data);
    } else if (this.options.synchronous) {
      Parallel.setImmediate(() => {
        this.data[this.data.length] = callback(data);
        done();
      });
    } else {
      throw new Error(
        "Workers do not exist and synchronous operation not allowed!"
      );
    }
  }

  reduce(callback, env) {
    env = extend(this.options.env, env || {});

    if (!this.data.length) {
      throw new Error("Can't reduce non-array data");
    }

    var runningWorkers = 0;
    var operation = new Operation();

    const done = (error, worker) => {
      --runningWorkers;
      if (error) {
        operation.reject(error);
      } else if (this.data.length === 1 && runningWorkers === 0) {
        this.data = this.data[0];
        operation.resolve(this.data);
        if (worker) {
          worker.terminate();
        }
      } else if (this.data.length > 1) {
        ++runningWorkers;
        this._spawnReduceWorker(
          [this.data[0], this.data[1]],
          callback,
          done,
          env,
          worker
        );
        this.data.splice(0, 2);
      } else if (worker) {
        worker.terminate();
      }
    };

    this.operation.then(() => {
      if (this.data.length === 1) {
        operation.resolve(this.data[0]);
      } else {
        for (
          let i = 0;
          i < this.options.maxWorkers && i < Math.floor(this.data.length / 2);
          ++i
        ) {
          ++runningWorkers;
          this._spawnReduceWorker(
            [this.data[i * 2], this.data[i * 2 + 1]],
            callback,
            done,
            env
          );
        }

        this.data.splice(0, i * 2);
      }
    });

    this.operation = operation;
    return this;
  }

  then(successCallback, errorCallback = () => {}) {
    const operation = new Operation();

    this.operation.then(
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
    this.operation = operation;
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
