import { withinDistance } from "../geometry-util";

function _degreesToRadians(angle) {
  return angle * (Math.PI / 180);
}

function _radiansToDegrees(angle) {
  return angle * (180 / Math.PI);
}

// convert from SVG format arc to center point arc
function svgToCenter(p1, p2, rx, ry, angleDegrees, largearc, sweep) {
  var mid = {
    x: 0.5 * (p1.x + p2.x),
    y: 0.5 * (p1.y + p2.y)
  };

  var diff = {
    x: 0.5 * (p2.x - p1.x),
    y: 0.5 * (p2.y - p1.y)
  };

  var angle = _degreesToRadians(angleDegrees % 360);

  var cos = Math.cos(angle);
  var sin = Math.sin(angle);

  var x1 = cos * diff.x + sin * diff.y;
  var y1 = -sin * diff.x + cos * diff.y;

  rx = Math.abs(rx);
  ry = Math.abs(ry);
  var Prx = rx * rx;
  var Pry = ry * ry;
  var Px1 = x1 * x1;
  var Py1 = y1 * y1;

  var radiiCheck = Px1 / Prx + Py1 / Pry;
  var radiiSqrt = Math.sqrt(radiiCheck);
  if (radiiCheck > 1) {
    rx = radiiSqrt * rx;
    ry = radiiSqrt * ry;
    Prx = rx * rx;
    Pry = ry * ry;
  }

  var sign = largearc != sweep ? -1 : 1;
  var sq = (Prx * Pry - Prx * Py1 - Pry * Px1) / (Prx * Py1 + Pry * Px1);

  sq = sq < 0 ? 0 : sq;

  var coef = sign * Math.sqrt(sq);
  var cx1 = coef * ((rx * y1) / ry);
  var cy1 = coef * -((ry * x1) / rx);

  var cx = mid.x + (cos * cx1 - sin * cy1);
  var cy = mid.y + (sin * cx1 + cos * cy1);

  var ux = (x1 - cx1) / rx;
  var uy = (y1 - cy1) / ry;
  var vx = (-x1 - cx1) / rx;
  var vy = (-y1 - cy1) / ry;
  var n = Math.sqrt(ux * ux + uy * uy);
  var p = ux;
  sign = uy < 0 ? -1 : 1;

  var theta = sign * Math.acos(p / n);
  theta = _radiansToDegrees(theta);

  n = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
  p = ux * vx + uy * vy;
  sign = ux * vy - uy * vx < 0 ? -1 : 1;
  var delta = sign * Math.acos(p / n);
  delta = _radiansToDegrees(delta);

  if (sweep == 1 && delta > 0) {
    delta -= 360;
  } else if (sweep == 0 && delta < 0) {
    delta += 360;
  }

  delta %= 360;
  theta %= 360;

  return {
    center: { x: cx, y: cy },
    rx: rx,
    ry: ry,
    theta: theta,
    extent: delta,
    angle: angleDegrees
  };
}

// convert from center point/angle sweep definition to SVG point and flag definition of arcs
// ported from http://commons.oreilly.com/wiki/index.php/SVG_Essentials/Paths
function centerToSvg(center, rx, ry, theta1, extent, angleDegrees) {
  var theta2 = theta1 + extent;

  theta1 = _degreesToRadians(theta1);
  theta2 = _degreesToRadians(theta2);
  var angle = _degreesToRadians(angleDegrees);

  var cos = Math.cos(angle);
  var sin = Math.sin(angle);

  var t1cos = Math.cos(theta1);
  var t1sin = Math.sin(theta1);

  var t2cos = Math.cos(theta2);
  var t2sin = Math.sin(theta2);

  var x0 = center.x + cos * rx * t1cos + -sin * ry * t1sin;
  var y0 = center.y + sin * rx * t1cos + cos * ry * t1sin;

  var x1 = center.x + cos * rx * t2cos + -sin * ry * t2sin;
  var y1 = center.y + sin * rx * t2cos + cos * ry * t2sin;

  var largearc = extent > 180 ? 1 : 0;
  var sweep = extent > 0 ? 1 : 0;

  return {
    p1: { x: x0, y: y0 },
    p2: { x: x1, y: y1 },
    rx: rx,
    ry: ry,
    angle: angle,
    largearc: largearc,
    sweep: sweep
  };
}

export default function linearize(p1, p2, rx, ry, angle, largearc, sweep, tol) {
  var finished = [p2]; // list of points to return

  var arc = svgToCenter(p1, p2, rx, ry, angle, largearc, sweep);
  var todo = [arc]; // list of arcs to divide

  // recursion could stack overflow, loop instead
  while (todo.length > 0) {
    arc = todo[0];

    var fullarc = centerToSvg(
      arc.center,
      arc.rx,
      arc.ry,
      arc.theta,
      arc.extent,
      arc.angle
    );
    var subarc = centerToSvg(
      arc.center,
      arc.rx,
      arc.ry,
      arc.theta,
      0.5 * arc.extent,
      arc.angle
    );
    var arcmid = subarc.p2;

    var mid = {
      x: 0.5 * (fullarc.p1.x + fullarc.p2.x),
      y: 0.5 * (fullarc.p1.y + fullarc.p2.y)
    };

    // compare midpoint of line with midpoint of arc
    // this is not 100% accurate, but should be a good heuristic for flatness in most cases
    if (withinDistance(mid, arcmid, tol)) {
      finished.unshift(fullarc.p2);
      todo.shift();
    } else {
      var arc1 = {
        center: arc.center,
        rx: arc.rx,
        ry: arc.ry,
        theta: arc.theta,
        extent: 0.5 * arc.extent,
        angle: arc.angle
      };
      var arc2 = {
        center: arc.center,
        rx: arc.rx,
        ry: arc.ry,
        theta: arc.theta + 0.5 * arc.extent,
        extent: 0.5 * arc.extent,
        angle: arc.angle
      };
      todo.splice(0, 1, arc1, arc2);
    }
  }
  return finished;
}
