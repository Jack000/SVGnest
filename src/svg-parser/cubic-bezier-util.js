function isFlat(p1, p2, c1, c2, tol) {
  tol = 16 * tol * tol;

  var ux = 3 * c1.x - 2 * p1.x - p2.x;
  ux *= ux;

  var uy = 3 * c1.y - 2 * p1.y - p2.y;
  uy *= uy;

  var vx = 3 * c2.x - 2 * p2.x - p1.x;
  vx *= vx;

  var vy = 3 * c2.y - 2 * p2.y - p1.y;
  vy *= vy;

  if (ux < vx) {
    ux = vx;
  }
  if (uy < vy) {
    uy = vy;
  }

  return ux + uy <= tol;
}

function subdivide(p1, p2, c1, c2, t) {
  var mid1 = {
    x: p1.x + (c1.x - p1.x) * t,
    y: p1.y + (c1.y - p1.y) * t
  };

  var mid2 = {
    x: c2.x + (p2.x - c2.x) * t,
    y: c2.y + (p2.y - c2.y) * t
  };

  var mid3 = {
    x: c1.x + (c2.x - c1.x) * t,
    y: c1.y + (c2.y - c1.y) * t
  };

  var mida = {
    x: mid1.x + (mid3.x - mid1.x) * t,
    y: mid1.y + (mid3.y - mid1.y) * t
  };

  var midb = {
    x: mid3.x + (mid2.x - mid3.x) * t,
    y: mid3.y + (mid2.y - mid3.y) * t
  };

  var midx = {
    x: mida.x + (midb.x - mida.x) * t,
    y: mida.y + (midb.y - mida.y) * t
  };

  var seg1 = { p1: p1, p2: midx, c1: mid1, c2: mida };
  var seg2 = { p1: midx, p2: p2, c1: midb, c2: mid2 };

  return [seg1, seg2];
}

export default function linearize(p1, p2, c1, c2, tol) {
  var finished = [p1]; // list of points to return
  var todo = [{ p1: p1, p2: p2, c1: c1, c2: c2 }]; // list of Beziers to divide

  // recursion could stack overflow, loop instead

  while (todo.length > 0) {
    var segment = todo[0];

    if (isFlat(segment.p1, segment.p2, segment.c1, segment.c2, tol)) {
      // reached subdivision limit
      finished.push({ x: segment.p2.x, y: segment.p2.y });
      todo.shift();
    } else {
      var divided = subdivide(
        segment.p1,
        segment.p2,
        segment.c1,
        segment.c2,
        0.5
      );
      todo.splice(0, 1, divided[0], divided[1]);
    }
  }
  return finished;
}
