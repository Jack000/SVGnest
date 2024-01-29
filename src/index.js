// UI-specific stuff, button clicks go here
function ready(fn) {
  if (document.readyState != "loading") {
    fn();
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}

ready(function () {
  // FAQ toggle
  var faq = document.getElementById("faq");
  var faqbutton = document.getElementById("faqbutton");

  var faqvisible = false;
  faqbutton.onclick = function (e) {
    if (!faqvisible) {
      faq.setAttribute("style", "display: block");
    } else {
      faq.removeAttribute("style");
    }
    faqvisible = !faqvisible;
  };

  function hideSplash() {
    var splash = document.getElementById("splash");
    var svgnest = document.getElementById("svgnest");
    if (splash) {
      splash.remove();
    }
    svgnest.setAttribute("style", "display: block");
  }

  var demo = document.getElementById("demo");
  var upload = document.getElementById("upload");
  var display = document.getElementById("select");

  demo.onclick = function () {
    try {
      var svg = window.SvgNest.parsesvg(display.innerHTML);
      display.innerHTML = "";
      display.appendChild(svg);
    } catch (e) {
      message.innerHTML = e;
      message.className = "error animated bounce";
      return;
    }

    hideSplash();
    message.innerHTML = "Click on the outline to use as the bin";
    message.className = "active animated bounce";

    attachSvgListeners(svg);
  };

  var message = document.getElementById("message");

  if (
    !document.createElementNS ||
    !document.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGRect
  ) {
    message.innerHTML = "Your browser does not have SVG support";
    message.className = "error animated bounce";
    return;
  }

  if (!window.SvgNest) {
    message.innerHTML = "Couldn't initialize SVGnest";
    message.className = "error animated bounce";
    return;
  }

  if (!window.File || !window.FileReader) {
    message.innerHTML = "Your browser does not have file upload support";
    message.className = "error animated bounce";
    return;
  }

  if (!window.Worker) {
    message.innerHTML = "Your browser does not have web worker support";
    message.className = "error animated bounce";
    return;
  }

  // button clicks
  var upload = document.getElementById("upload");
  var start = document.getElementById("start");
  var download = document.getElementById("download");
  var startlabel = document.getElementById("startlabel");
  var fileinput = document.getElementById("fileinput");

  var config = document.getElementById("config");
  var configbutton = document.getElementById("configbutton");
  var configsave = document.getElementById("configsave");

  var zoomin = document.getElementById("zoominbutton");
  var zoomout = document.getElementById("zoomoutbutton");
  var exit = document.getElementById("exitbutton");

  var isworking = false;

  start.onclick = function () {
    if (this.className == "button start disabled") {
      return false;
    }
    iterations = 0;
    if (isworking) {
      stopnest();
    } else {
      startnest();
    }

    display.className = "disabled";
    document.getElementById("info_time").setAttribute("style", "display: none");
  };

  function startnest() {
    // Once started, don't allow this anymore
    document.removeEventListener("dragover", FileDragHover, false);
    document.removeEventListener("dragleave", FileDragHover, false);
    document.removeEventListener("drop", FileDrop, false);

    SvgNest.start(progress, renderSvg);
    startlabel.innerHTML = "Stop Nest";
    start.className = "button spinner";
    configbutton.className = "button config disabled";
    config.className = "";
    zoomin.className = "button zoomin disabled";
    zoomout.className = "button zoomout disabled";

    var svg = document.querySelector("#select svg");
    if (svg) {
      svg.removeAttribute("style");
    }

    isworking = true;
  }

  function stopnest() {
    SvgNest.stop();
    startlabel.innerHTML = "Start Nest";
    start.className = "button start";
    configbutton.className = "button config";

    isworking = false;
  }

  // config
  var configvisible = false;
  configbutton.onclick = function () {
    if (this.className == "button config disabled") {
      return false;
    }
    if (!configvisible) {
      config.className = "active";
      configbutton.className = "button close";
    } else {
      config.className = "";
      configbutton.className = "button config";
    }
    configvisible = !configvisible;

    return false;
  };

  configsave.onclick = function () {
    var c = {};
    var inputs = document.querySelectorAll("#config input");
    for (var i = 0; i < inputs.length; i++) {
      var key = inputs[i].getAttribute("data-config");
      if (inputs[i].getAttribute("type") == "text") {
        c[key] = inputs[i].value;
      } else if (inputs[i].getAttribute("type") == "checkbox") {
        c[key] = inputs[i].checked;
      }
    }

    window.SvgNest.config(c);

    // new configs will invalidate current nest
    if (isworking) {
      stopnest();
    }
    configvisible = false;
    config.className = "";
    return false;
  };

  upload.onclick = function () {
    fileinput.click();
  };
  document.addEventListener("dragover", FileDragHover, false);
  document.addEventListener("dragleave", FileDragHover, false);
  document.addEventListener("drop", FileDrop, false);
  function FileDragHover(e) {
    e.stopPropagation();
    e.preventDefault();
    upload.style.backgroundColor = e.type == "dragover" ? "#d7e9b7" : "";
  }
  function FileDrop(e) {
    e.stopPropagation(); // Make sure not to replace website by file
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  }

  download.onclick = function () {
    if (download.className == "button download disabled") {
      return false;
    }

    var bins = document.getElementById("bins");

    if (bins.children.length == 0) {
      message.innerHTML = "No SVG to export";
      message.className = "error animated bounce";
      return;
    }

    var svg;
    svg = display.querySelector("svg");

    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    }

    svg = svg.cloneNode(false);

    // maintain stroke, fill etc of input
    if (SvgNest.style) {
      svg.appendChild(SvgNest.style);
    }

    var binHeight = parseInt(bins.children[0].getAttribute("height"));

    for (var i = 0; i < bins.children.length; i++) {
      var b = bins.children[i];
      var group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute(
        "transform",
        "translate(0 " + binHeight * 1.1 * i + ")"
      );
      for (var j = 0; j < b.children.length; j++) {
        group.appendChild(b.children[j].cloneNode(true));
      }

      svg.appendChild(group);
    }

    var output;
    if (typeof XMLSerializer != "undefined") {
      output = new XMLSerializer().serializeToString(svg);
    } else {
      output = svg.outerHTML;
    }

    var blob = new Blob([output], { type: "image/svg+xml;charset=utf-8" });
    saveAs(blob, "SVGnest-output.svg");
  };

  var zoomlevel = 1.0;

  zoomin.onclick = function () {
    if (this.className == "button zoomin disabled") {
      return false;
    }
    zoomlevel *= 1.2;
    var svg = document.querySelector("#select svg");
    if (svg) {
      svg.setAttribute(
        "style",
        "transform-origin: top left; transform:scale(" +
          zoomlevel +
          "); -webkit-transform:scale(" +
          zoomlevel +
          "); -moz-transform:scale(" +
          zoomlevel +
          "); -ms-transform:scale(" +
          zoomlevel +
          "); -o-transform:scale(" +
          zoomlevel +
          ");"
      );
    }
  };

  zoomout.onclick = function () {
    if (this.className == "button zoomout disabled") {
      return false;
    }
    zoomlevel *= 0.8;
    if (zoomlevel < 0.02) {
      zoomlevel = 0.02;
    }
    var svg = document.querySelector("#select svg");
    if (svg) {
      svg.setAttribute(
        "style",
        "transform-origin: top left; transform:scale(" +
          zoomlevel +
          "); -webkit-transform:scale(" +
          zoomlevel +
          "); -moz-transform:scale(" +
          zoomlevel +
          "); -ms-transform:scale(" +
          zoomlevel +
          "); -o-transform:scale(" +
          zoomlevel +
          ");"
      );
    }
  };

  exit.onclick = function () {
    location.reload();
  };

  fileinput.onchange = function (e) {
    handleFile(e.target.files[0]);
  };

  function handleFile(file) {
    if (!file) {
      return;
    }

    if (
      !file.type ||
      (file.type.search("svg") < 0 &&
        file.type.search("xml") < 0 &&
        file.type.search("text") < 0)
    ) {
      message.innerHTML = "Only SVG files allowed";
      message.className = "error animated bounce";
      return;
    }

    var reader = new FileReader();
    var input = this;
    reader.onload = function (e) {
      input.value = null;

      if (reader.result) {
        try {
          var svg = window.SvgNest.parsesvg(reader.result);
          {
            var wholeSVG = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "svg"
            );
            // Copy relevant scaling info
            wholeSVG.setAttribute("width", svg.getAttribute("width"));
            wholeSVG.setAttribute("height", svg.getAttribute("height"));
            wholeSVG.setAttribute("viewBox", svg.getAttribute("viewBox"));
            var rect = document.createElementNS(wholeSVG.namespaceURI, "rect");
            rect.setAttribute("x", wholeSVG.viewBox.baseVal.x);
            rect.setAttribute("y", wholeSVG.viewBox.baseVal.x);
            rect.setAttribute("width", wholeSVG.viewBox.baseVal.width);
            rect.setAttribute("height", wholeSVG.viewBox.baseVal.height);
            rect.setAttribute("class", "fullRect");
            wholeSVG.appendChild(rect);
          }
          display.innerHTML = "";
          display.appendChild(wholeSVG); // As a default bin in background
          display.appendChild(svg);
        } catch (e) {
          message.innerHTML = e;
          message.className = "error animated bounce";
          return;
        }

        hideSplash();
        message.innerHTML = "Click on the outline to use as the bin";
        message.className = "active animated bounce";
        start.className = "button start disabled";

        attachSvgListeners(svg);
        attachSvgListeners(wholeSVG);
      }
    };

    reader.readAsText(file);
  }

  function attachSvgListeners(svg) {
    // attach event listeners
    for (var i = 0; i < svg.childNodes.length; i++) {
      var node = svg.childNodes[i];
      if (node.nodeType == 1) {
        node.onclick = function () {
          if (display.className == "disabled") {
            return;
          }
          var currentbin = document.querySelector("#select .active");
          if (currentbin) {
            var className = currentbin
              .getAttribute("class")
              .replace("active", "")
              .trim();
            if (!className) currentbin.removeAttribute("class");
            else currentbin.setAttribute("class", className);
          }

          window.SvgNest.setbin(this);
          this.setAttribute(
            "class",
            (this.getAttribute("class")
              ? this.getAttribute("class") + " "
              : "") + "active"
          );

          start.className = "button start animated bounce";
          message.className = "";
        };
      }
    }
  }

  var prevpercent = 0;
  var startTime = null;

  function progress(percent) {
    var transition = percent > prevpercent ? "; transition: width 0.1s" : "";
    document
      .getElementById("info_progress")
      .setAttribute(
        "style",
        "width: " + Math.round(percent * 100) + "% " + transition
      );
    document.getElementById("info").setAttribute("style", "display: block");

    prevpercent = percent;

    var now = new Date().getTime();
    if (startTime && now) {
      var diff = now - startTime;
      // show a time estimate for long-running placements
      var estimate = (diff / percent) * (1 - percent);
      document.getElementById("info_time").innerHTML =
        millisecondsToStr(estimate) + " remaining";

      if (diff > 5000 && percent < 0.3 && percent > 0.02 && estimate > 10000) {
        document
          .getElementById("info_time")
          .setAttribute("style", "display: block");
      }
    }

    if (percent > 0.95 || percent < 0.02) {
      document
        .getElementById("info_time")
        .setAttribute("style", "display: none");
    }
    if (percent < 0.02) {
      startTime = new Date().getTime();
    }
  }

  var iterations = 0;

  function renderSvg(svglist, efficiency, placed, total) {
    iterations++;
    document.getElementById("info_iterations").innerHTML = iterations;

    if (!svglist || svglist.length == 0) {
      return;
    }
    var bins = document.getElementById("bins");
    bins.innerHTML = "";

    for (var i = 0; i < svglist.length; i++) {
      if (svglist.length > 2) {
        svglist[i].setAttribute("class", "grid");
      }
      bins.appendChild(svglist[i]);
    }

    if (efficiency || efficiency === 0) {
      document.getElementById("info_efficiency").innerHTML = Math.round(
        efficiency * 100
      );
    }

    document.getElementById("info_placed").innerHTML = placed + "/" + total;

    document
      .getElementById("info_placement")
      .setAttribute("style", "display: block");
    display.setAttribute("style", "display: none");
    download.className = "button download animated bounce";
  }

  message.onclick = function (e) {
    this.className = "";
  };

  function millisecondsToStr(milliseconds) {
    function numberEnding(number) {
      return number > 1 ? "s" : "";
    }

    var temp = Math.floor(milliseconds / 1000);
    var years = Math.floor(temp / 31536000);
    if (years) {
      return years + " year" + numberEnding(years);
    }
    var days = Math.floor((temp %= 31536000) / 86400);
    if (days) {
      return days + " day" + numberEnding(days);
    }
    var hours = Math.floor((temp %= 86400) / 3600);
    if (hours) {
      return hours + " hour" + numberEnding(hours);
    }
    var minutes = Math.floor((temp %= 3600) / 60);
    if (minutes) {
      return minutes + " minute" + numberEnding(minutes);
    }
    var seconds = temp % 60;
    if (seconds) {
      return seconds + " second" + numberEnding(seconds);
    }
    return "less than a second";
  }
});
