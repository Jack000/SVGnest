this.onmessage = function (code) {
  console.log(code);
  eval(code.data);
};
