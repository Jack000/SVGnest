export default class Operation {
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
