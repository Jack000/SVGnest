import Worker from "./shared.worker";
import Operation from "./opertaion";

export default class Parallel {
  constructor(id, data, env, onSpawn) {
    this._data = data;
    this._maxWorkers = navigator.hardwareConcurrency || 4;
    this._options = { id, env };
    this._operation = new Operation(this._data);
    this._onSpawn = onSpawn;
  }

  _spawnWorker(inputWorker) {
    let worker = inputWorker;

    if (!worker) {
      try {
        worker = new Worker();
        worker.postMessage(this._options);
      } catch (e) {
        throw e;
      }
    }

    return worker;
  }

  _triggerWorker(worker, data, onMessage, onError) {
    if (!worker) {
      return;
    }

    worker.onmessage = onMessage;
    worker.onerror = onError;
    worker.postMessage(data);
  }

  _spawnMapWorker(i, done, worker) {
    this._onSpawn && this._onSpawn();

    const resultWorker = this._spawnWorker(worker);
    const onMessage = (message) => {
      this._data[i] = message.data;
      done(null, resultWorker);
    };
    const onError = (error) => {
      resultWorker.terminate();
      done(error);
    };

    this._triggerWorker(resultWorker, this._data[i], onMessage, onError);
  }

  _triggerOperation(operation, resolve, reject) {
    this._operation.then(resolve, reject);
    this._operation = operation;
  }

  _processResult(callback, operation, data) {
    if (callback) {
      const result = callback(data);

      if (result !== undefined) {
        this._data = result;
      }

      operation.resolve(this._data);
    } else {
      operation.resolve(data);
    }
  }

  _getDataResolveCallback(operation) {
    if (!this._data.length) {
      return () => {
        const worker = this._spawnWorker();
        const onMessage = (message) => {
          worker.terminate();
          this._data = message.data;
          operation.resolve(this._data);
        };
        const onError = (error) => {
          worker.terminate();
          operation.reject(error);
        };

        this._triggerWorker(worker, this._data, onMessage, onError);
      };
    }

    let startedOps = 0;
    let doneOps = 0;

    const done = (error, worker) => {
      if (error) {
        operation.reject(error);
      } else if (++doneOps === this._data.length) {
        operation.resolve(this._data);
        if (worker) {
          worker.terminate();
        }
      } else if (startedOps < this._data.length) {
        this._spawnMapWorker(startedOps++, done, worker);
      } else if (worker) {
        worker.terminate();
      }
    };

    return () => {
      for (
        ;
        startedOps - doneOps < this._maxWorkers &&
        startedOps < this._data.length;
        ++startedOps
      ) {
        this._spawnMapWorker(startedOps, done);
      }
    };
  }

  then(successCallback, errorCallback = () => {}) {
    const dataOperation = new Operation();
    const chainOperation = new Operation();

    this._triggerOperation(
      dataOperation,
      this._getDataResolveCallback(dataOperation),
      (error) => dataOperation.reject(error)
    );

    this._triggerOperation(
      chainOperation,
      () => {
        try {
          this._processResult(successCallback, chainOperation, this._data);
        } catch (error) {
          this._processResult(errorCallback, chainOperation, error);
        }
      },
      (error) => this._processResult(errorCallback, chainOperation, error)
    );
  }
}
