/*!
 * General purpose geometry functions for polygon/Bezier calculations
 * Copyright 2015 Jack Qiao
 * Licensed under the MIT license
 */

(function(root){
	'use strict';
	
	// private shared variables/methods
	
	// floating point comparison tolerance
	var TOL = Math.pow(10, -9); // Floating point error is likely to be above 1 epsilon
	
	function _almostEqual(a, b, tolerance){
		if(!tolerance){
			tolerance = TOL
		}
		return Math.abs(a - b) < tolerance;
	}
	
	// returns true if points are within the given distance
	function _withinDistance(p1, p2, distance){
		var dx = p1.x-p2.x;
		var dy = p1.y-p2.y;
		return ((dx*dx + dy*dy) < distance*distance);
	}
	
	function _degreesToRadians(angle){
		return angle*(Math.PI/180);
	}
	
	function _radiansToDegrees(angle){
		return angle*(180/Math.PI);
	}
	
	// normalize vector into a unit vector
	function _normalizeVector(v){
		if(_almostEqual(v.x*v.x + v.y*v.y, 1)){
			return v; // given vector was already a unit vector
		}
		var len = Math.sqrt(v.x*v.x + v.y*v.y);
		var inverse = 1/len;
		
		return {
			x: v.x*inverse,
			y: v.y*inverse
		};
	}
	
	// returns true if p lies on the line segment defined by AB, but not at any endpoints
	// may need work!
	function _onSegment(A,B,p){
				
		// vertical line
		if(_almostEqual(A.x, B.x) && _almostEqual(p.x, A.x)){
			if(!_almostEqual(p.y, B.y) && !_almostEqual(p.y, A.y) && p.y < Math.max(B.y, A.y) && p.y > Math.min(B.y, A.y)){
				return true;
			}
			else{
				return false;
			}
		}

		// horizontal line
		if(_almostEqual(A.y, B.y) && _almostEqual(p.y, A.y)){
			if(!_almostEqual(p.x, B.x) && !_almostEqual(p.x, A.x) && p.x < Math.max(B.x, A.x) && p.x > Math.min(B.x, A.x)){
				return true;
			}
			else{
				return false;
			}
		}		
		
		//range check
		if((p.x < A.x && p.x < B.x) || (p.x > A.x && p.x > B.x) || (p.y < A.y && p.y < B.y) || (p.y > A.y && p.y > B.y)){
			return false;
		}
		
		
		// exclude end points
		if((_almostEqual(p.x, A.x) && _almostEqual(p.y, A.y)) || (_almostEqual(p.x, B.x) && _almostEqual(p.y, B.y))){
			return false;
		}
		
		var cross = (p.y - A.y) * (B.x - A.x) - (p.x - A.x) * (B.y - A.y);
		
		if(Math.abs(cross) > TOL){
			return false;
		}
		
		var dot = (p.x - A.x) * (B.x - A.x) + (p.y - A.y)*(B.y - A.y);
		
		
		
		if(dot < 0 || _almostEqual(dot, 0)){
			return false;
		}
		
		var len2 = (B.x - A.x)*(B.x - A.x) + (B.y - A.y)*(B.y - A.y);
		
		
		
		if(dot > len2 || _almostEqual(dot, len2)){
			return false;
		}
		
		return true;
	}
	
	// returns the intersection of AB and EF
	// or null if there are no intersections or other numerical error
	// if the infinite flag is set, AE and EF describe infinite lines without endpoints, they are finite line segments otherwise
	function _lineIntersect(A,B,E,F,infinite){
		var a1, a2, b1, b2, c1, c2, x, y;
		
		a1= B.y-A.y;
		b1= A.x-B.x;
		c1= B.x*A.y - A.x*B.y;
		a2= F.y-E.y;
		b2= E.x-F.x;
		c2= F.x*E.y - E.x*F.y;
		
		var denom=a1*b2 - a2*b1;
		
		x = (b1*c2 - b2*c1)/denom,
		y = (a2*c1 - a1*c2)/denom
		
		if(!isFinite(x) || !isFinite(y)){
			return null;
		}
		
		// lines are colinear
		/*var crossABE = (E.y - A.y) * (B.x - A.x) - (E.x - A.x) * (B.y - A.y);
		var crossABF = (F.y - A.y) * (B.x - A.x) - (F.x - A.x) * (B.y - A.y);
		if(_almostEqual(crossABE,0) && _almostEqual(crossABF,0)){
			return null;
		}*/
		
		if(!infinite){
			// coincident points do not count as intersecting
			if (Math.abs(A.x-B.x) > TOL && (( A.x < B.x ) ? x < A.x || x > B.x : x > A.x || x < B.x )) return null;
			if (Math.abs(A.y-B.y) > TOL && (( A.y < B.y ) ? y < A.y || y > B.y : y > A.y || y < B.y )) return null;

			if (Math.abs(E.x-F.x) > TOL && (( E.x < F.x ) ? x < E.x || x > F.x : x > E.x || x < F.x )) return null;
			if (Math.abs(E.y-F.y) > TOL && (( E.y < F.y ) ? y < E.y || y > F.y : y > E.y || y < F.y )) return null;
		}
		
		return {x: x, y: y};
	}
	
	// public methods
	root.GeometryUtil = {
	
		withinDistance: _withinDistance,
		
		lineIntersect: _lineIntersect,
		
		almostEqual: _almostEqual,
		
		// Bezier algos from http://algorithmist.net/docs/subdivision.pdf
		QuadraticBezier: {
			
			// Roger Willcocks bezier flatness criterion
			isFlat: function(p1, p2, c1, tol){
				tol = 4*tol*tol;
				
				var ux = 2*c1.x - p1.x - p2.x;
				ux *= ux;
				
				var uy = 2*c1.y - p1.y - p2.y;
				uy *= uy;
				
				return (ux+uy <= tol);
			},
			
			// turn Bezier into line segments via de Casteljau, returns an array of points
			linearize: function(p1, p2, c1, tol){
				var finished = [p1]; // list of points to return
				var todo = [{p1: p1, p2: p2, c1: c1}]; // list of Beziers to divide
				
				// recursion could stack overflow, loop instead
				while(todo.length > 0){
					var segment = todo[0];
					
					if(this.isFlat(segment.p1, segment.p2, segment.c1, tol)){ // reached subdivision limit
						finished.push({x: segment.p2.x, y: segment.p2.y});
						todo.shift();
					}
					else{
						var divided = this.subdivide(segment.p1, segment.p2, segment.c1, 0.5);
						todo.splice(0,1,divided[0],divided[1]);
					}
				}				
				return finished;
			},
			
			// subdivide a single Bezier
			// t is the percent along the Bezier to divide at. eg. 0.5
			subdivide: function(p1, p2, c1, t){
				var mid1 = {	
					x: p1.x+(c1.x-p1.x)*t,
					y: p1.y+(c1.y-p1.y)*t
				};
				
				var mid2 = {
					x: c1.x+(p2.x-c1.x)*t,
					y: c1.y+(p2.y-c1.y)*t
				};
				
				var mid3 = {
					x: mid1.x+(mid2.x-mid1.x)*t,
					y: mid1.y+(mid2.y-mid1.y)*t
				};
				
				var seg1 = {p1: p1, p2: mid3, c1: mid1};
				var seg2 = {p1: mid3, p2: p2, c1: mid2};
								
				return [seg1, seg2];
			}
		},
		
		CubicBezier: {
			isFlat: function(p1, p2, c1, c2, tol){
				tol = 16*tol*tol;
			
				var ux = 3*c1.x - 2*p1.x - p2.x;
				ux *= ux;
				
				var uy = 3*c1.y - 2*p1.y - p2.y;
				uy *= uy;
				
				var vx = 3*c2.x - 2*p2.x - p1.x;
				vx *= vx;
				
				var vy = 3*c2.y - 2*p2.y - p1.y;
				vy *= vy;
				
				if (ux < vx){
					ux = vx;
				}
				if (uy < vy){
					uy = vy;
				}
				
				return (ux+uy <= tol);
			},
			
			linearize: function(p1, p2, c1, c2, tol){
				var finished = [p1]; // list of points to return
				var todo = [{p1: p1, p2: p2, c1: c1, c2: c2}]; // list of Beziers to divide
				
				// recursion could stack overflow, loop instead

				while(todo.length > 0){
					var segment = todo[0];
					
					if(this.isFlat(segment.p1, segment.p2, segment.c1, segment.c2, tol)){ // reached subdivision limit
						finished.push({x: segment.p2.x, y: segment.p2.y});
						todo.shift();
					}
					else{
						var divided = this.subdivide(segment.p1, segment.p2, segment.c1, segment.c2, 0.5);
						todo.splice(0,1,divided[0],divided[1]);
					}
				}
				return finished;
			},
			
			subdivide: function(p1, p2, c1, c2, t){
				var mid1 = { 
					x: p1.x+(c1.x-p1.x)*t,
					y: p1.y+(c1.y-p1.y)*t
				};
				
				var mid2 = {
					x:c2.x+(p2.x-c2.x)*t,
					y:c2.y+(p2.y-c2.y)*t
				};
				
				var mid3 = {
					x: c1.x+(c2.x-c1.x)*t,
					y: c1.y+(c2.y-c1.y)*t
				};
				
				var mida = {
					x: mid1.x+(mid3.x-mid1.x)*t,
					y: mid1.y+(mid3.y-mid1.y)*t
				};
				
				var midb = {
					x: mid3.x+(mid2.x-mid3.x)*t,
					y: mid3.y+(mid2.y-mid3.y)*t
				};
				
				var midx = {
					x: mida.x+(midb.x-mida.x)*t,
					y: mida.y+(midb.y-mida.y)*t
				};
				
				var seg1 = {p1: p1, p2: midx, c1: mid1, c2: mida};
				var seg2 = {p1: midx, p2: p2, c1: midb, c2: mid2};
				
				return [seg1, seg2];
			}
		},
		
		Arc: {
		
			linearize: function(p1, p2, rx, ry, angle, largearc, sweep, tol){
				
				var finished = [p2]; // list of points to return
				
				var arc = this.svgToCenter(p1, p2, rx, ry, angle, largearc, sweep);
				var todo = [arc]; // list of arcs to divide
				
				// recursion could stack overflow, loop instead
				while(todo.length > 0){
					arc = todo[0];
										
					var fullarc = this.centerToSvg(arc.center, arc.rx, arc.ry, arc.theta, arc.extent, arc.angle);
					var subarc = this.centerToSvg(arc.center, arc.rx, arc.ry, arc.theta, 0.5*arc.extent, arc.angle);
					var arcmid = subarc.p2;
					
					var mid = {
						x: 0.5*(fullarc.p1.x + fullarc.p2.x),
						y: 0.5*(fullarc.p1.y + fullarc.p2.y)
					}
					
					// compare midpoint of line with midpoint of arc
					// this is not 100% accurate, but should be a good heuristic for flatness in most cases
					if(_withinDistance(mid, arcmid, tol)){
						finished.unshift(fullarc.p2);
						todo.shift();
					}
					else{
						var arc1 = {
							center: arc.center,
							rx: arc.rx,
							ry: arc.ry,
							theta: arc.theta,
							extent: 0.5*arc.extent,
							angle: arc.angle
						};
						var arc2 = {
							center: arc.center,
							rx: arc.rx,
							ry: arc.ry,
							theta: arc.theta+0.5*arc.extent,
							extent: 0.5*arc.extent,
							angle: arc.angle
						};
						todo.splice(0,1,arc1,arc2);
					}
				}
				return finished;				
			},
			
			// convert from center point/angle sweep definition to SVG point and flag definition of arcs
			// ported from http://commons.oreilly.com/wiki/index.php/SVG_Essentials/Paths
			centerToSvg: function(center, rx, ry, theta1, extent, angleDegrees){

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
				
				var x0 = center.x + cos * rx * t1cos +	(-sin) * ry * t1sin;
				var y0 = center.y + sin * rx * t1cos +	cos * ry * t1sin;

				var x1 = center.x + cos * rx * t2cos +	(-sin) * ry * t2sin;
				var y1 = center.y + sin * rx * t2cos +	cos * ry * t2sin;

				var largearc = (extent > 180) ? 1 : 0;
				var sweep = (extent > 0) ? 1 : 0;
				
				return {
					p1: {x: x0, y: y0},
					p2: {x: x1, y: y1},
					rx: rx,
					ry: ry,
					angle: angle,
					largearc: largearc,
					sweep: sweep
				};
			},
			
			// convert from SVG format arc to center point arc
			svgToCenter: function(p1, p2, rx, ry, angleDegrees, largearc, sweep){
				
				var mid = {
					x: 0.5*(p1.x+p2.x),
					y: 0.5*(p1.y+p2.y)
				}
				
				var diff = {
					x: 0.5*(p2.x-p1.x),
					y: 0.5*(p2.y-p1.y)
				}
				
				var angle = _degreesToRadians(angleDegrees%360);
				
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
				
				var radiiCheck = Px1/Prx + Py1/Pry;
				var radiiSqrt = Math.sqrt(radiiCheck);
				if (radiiCheck > 1) {
					rx = radiiSqrt * rx;
					ry = radiiSqrt * ry;
					Prx = rx * rx;
					Pry = ry * ry;
				}
				
				var sign = (largearc != sweep) ? -1 : 1;
				var sq = ((Prx * Pry) - (Prx * Py1) - (Pry * Px1)) / ((Prx * Py1) + (Pry * Px1));
				
				sq = (sq < 0) ? 0 : sq;
				
				var coef = sign * Math.sqrt(sq);
				var cx1 = coef * ((rx * y1) / ry);
				var cy1 = coef * -((ry * x1) / rx);

				var cx = mid.x + (cos * cx1 - sin * cy1);
				var cy = mid.y + (sin * cx1 + cos * cy1);
				
				var ux = (x1 - cx1) / rx;
				var uy = (y1 - cy1) / ry;
				var vx = (-x1 - cx1) / rx;
				var vy = (-y1 - cy1) / ry;
				var n = Math.sqrt( (ux * ux) + (uy * uy) );
				var p = ux;
				sign = (uy < 0) ? -1 : 1;

				var theta = sign * Math.acos( p / n );
				theta = _radiansToDegrees(theta);

				n = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
				p = ux * vx + uy * vy;
				sign = ((ux * vy - uy * vx) < 0) ? -1 : 1;
				var delta = sign * Math.acos( p / n );
				delta = _radiansToDegrees(delta);

				if (sweep == 1 && delta > 0)
				{
					delta -= 360;
				}
				else if (sweep == 0 && delta < 0)
				{
					delta += 360;
				}

				delta %= 360;
				theta %= 360;
				
				return {
					center: {x: cx, y: cy},
					rx: rx,
					ry: ry,
					theta: theta,
					extent: delta,
					angle: angleDegrees
				};
			}
			
		},
		
		// returns the rectangular bounding box of the given polygon
		getPolygonBounds: function(polygon){
			if(!polygon || polygon.length < 3){
				return null;
			}
			
			var xmin = polygon[0].x;
			var xmax = polygon[0].x;
			var ymin = polygon[0].y;
			var ymax = polygon[0].y;
			
			for(var i=1; i<polygon.length; i++){
				if(polygon[i].x > xmax){
					xmax = polygon[i].x;
				}
				else if(polygon[i].x < xmin){
					xmin = polygon[i].x;
				}
				
				if(polygon[i].y > ymax){
					ymax = polygon[i].y;
				}
				else if(polygon[i].y < ymin){
					ymin = polygon[i].y;
				}
			}
			
			return {
				x: xmin,
				y: ymin,
				width: xmax-xmin,
				height: ymax-ymin
			};
		},
		
		// return true if point is in the polygon, false if outside, and null if exactly on a point or edge
		pointInPolygon: function(point, polygon){
			if(!polygon || polygon.length < 3){
				return null;
			}
			
			var inside = false;
			var offsetx = polygon.offsetx || 0;
			var offsety = polygon.offsety || 0;
			
			for (var i = 0, j = polygon.length - 1; i < polygon.length; j=i++) {
				var xi = polygon[i].x + offsetx;
				var yi = polygon[i].y + offsety;
				var xj = polygon[j].x + offsetx;
				var yj = polygon[j].y + offsety;
				
				if(_almostEqual(xi, point.x) && _almostEqual(yi, point.y)){
					return null; // no result
				}
				
				if(_onSegment({x: xi, y: yi}, {x: xj, y: yj}, point)){
					return null; // exactly on the segment
				}
				
				if(_almostEqual(xi, xj) && _almostEqual(yi, yj)){ // ignore very small lines
					continue;
				}
				
				var intersect = ((yi > point.y) != (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
				if (intersect) inside = !inside;
			}
			
			return inside;
		},
		
		// returns the area of the polygon, assuming no self-intersections
		// a negative area indicates counter-clockwise winding direction
		polygonArea: function(polygon){
			var area = 0;
			var i, j;
			for (i=0, j=polygon.length-1; i<polygon.length; j=i++){
				area += (polygon[j].x+polygon[i].x) * (polygon[j].y-polygon[i].y); 
			}
			return 0.5*area;
		},
		
		// todo: swap this for a more efficient sweep-line implementation
		// returnEdges: if set, return all edges on A that have intersections
		
		intersect: function(A,B){
			var Aoffsetx = A.offsetx || 0;
			var Aoffsety = A.offsety || 0;
			
			var Boffsetx = B.offsetx || 0;
			var Boffsety = B.offsety || 0;
			
			A = A.slice(0);
			B = B.slice(0);
						
			for(var i=0; i<A.length-1; i++){
				for(var j=0; j<B.length-1; j++){
					var a1 = {x: A[i].x+Aoffsetx, y:A[i].y+Aoffsety};
					var a2 = {x: A[i+1].x+Aoffsetx, y:A[i+1].y+Aoffsety};
					var b1 = {x: B[j].x+Boffsetx, y: B[j].y+Boffsety};
					var b2 = {x: B[j+1].x+Boffsetx, y: B[j+1].y+Boffsety};
					
					var prevbindex = (j == 0) ? B.length-1 : j-1;
					var prevaindex = (i == 0) ? A.length-1 : i-1;
					var nextbindex = (j+1 == B.length-1) ? 0 : j+2;
					var nextaindex = (i+1 == A.length-1) ? 0 : i+2;
					
					// go even further back if we happen to hit on a loop end point
					if(B[prevbindex] == B[j] || (_almostEqual(B[prevbindex].x, B[j].x) && _almostEqual(B[prevbindex].y, B[j].y))){
						prevbindex = (prevbindex == 0) ? B.length-1 : prevbindex-1;
					}
					
					if(A[prevaindex] == A[i] || (_almostEqual(A[prevaindex].x, A[i].x) && _almostEqual(A[prevaindex].y, A[i].y))){
						prevaindex = (prevaindex == 0) ? A.length-1 : prevaindex-1;
					}
					
					// go even further forward if we happen to hit on a loop end point
					if(B[nextbindex] == B[j+1] || (_almostEqual(B[nextbindex].x, B[j+1].x) && _almostEqual(B[nextbindex].y, B[j+1].y))){
						nextbindex = (nextbindex == B.length-1) ? 0 : nextbindex+1;
					}
					
					if(A[nextaindex] == A[i+1] || (_almostEqual(A[nextaindex].x, A[i+1].x) && _almostEqual(A[nextaindex].y, A[i+1].y))){
						nextaindex = (nextaindex == A.length-1) ? 0 : nextaindex+1;
					}
					
					var a0 = {x: A[prevaindex].x + Aoffsetx, y: A[prevaindex].y + Aoffsety};
					var b0 = {x: B[prevbindex].x + Boffsetx, y: B[prevbindex].y + Boffsety};
					
					var a3 = {x: A[nextaindex].x + Aoffsetx, y: A[nextaindex].y + Aoffsety};
					var b3 = {x: B[nextbindex].x + Boffsetx, y: B[nextbindex].y + Boffsety};
					
					if(_onSegment(a1,a2,b1) || (_almostEqual(a1.x, b1.x) && _almostEqual(a1.y, b1.y))){
						// if a point is on a segment, it could intersect or it could not. Check via the neighboring points
						var b0in = this.pointInPolygon(b0, A);
						var b2in = this.pointInPolygon(b2, A);
						if((b0in === true && b2in === false) || (b0in === false && b2in === true)){
							return true;
						}
						else{
							continue;
						}
					}
					
					if(_onSegment(a1,a2,b2) || (_almostEqual(a2.x, b2.x) && _almostEqual(a2.y, b2.y))){
						// if a point is on a segment, it could intersect or it could not. Check via the neighboring points
						var b1in = this.pointInPolygon(b1, A);
						var b3in = this.pointInPolygon(b3, A);
						
						if((b1in === true && b3in === false) || (b1in === false && b3in === true)){
							return true;
						}
						else{
							continue;
						}
					}
					
					if(_onSegment(b1,b2,a1) || (_almostEqual(a1.x, b2.x) && _almostEqual(a1.y, b2.y))){
						// if a point is on a segment, it could intersect or it could not. Check via the neighboring points
						var a0in = this.pointInPolygon(a0, B);
						var a2in = this.pointInPolygon(a2, B);
						
						if((a0in === true && a2in === false) || (a0in === false && a2in === true)){
							return true;
						}
						else{
							continue;
						}
					}
					
					if(_onSegment(b1,b2,a2) || (_almostEqual(a2.x, b1.x) && _almostEqual(a2.y, b1.y))){
						// if a point is on a segment, it could intersect or it could not. Check via the neighboring points
						var a1in = this.pointInPolygon(a1, B);
						var a3in = this.pointInPolygon(a3, B);

						if((a1in === true && a3in === false) || (a1in === false && a3in === true)){
							return true;
						}
						else{
							continue;
						}
					}
										
					var p = _lineIntersect(b1, b2, a1, a2);
					
					if(p !== null){
						return true;
					}
				}
			}
			
			return false;
		},
		
		// placement algos as outlined in [1] http://www.cs.stir.ac.uk/~goc/papers/EffectiveHueristic2DAOR2013.pdf
		
		// returns a continuous polyline representing the normal-most edge of the given polygon
		// eg. a normal vector of [-1, 0] will return the left-most edge of the polygon
		// this is essentially algo 8 in [1], generalized for any vector direction
		polygonEdge: function(polygon, normal){
			if(!polygon || polygon.length < 3){
				return null;
			}
			
			normal = _normalizeVector(normal);
			
			var direction = {
				x: -normal.y,
				y: normal.x
			};
			
			// find the max and min points, they will be the endpoints of our edge
			var min = null;
			var max = null;
			
			var dotproduct = [];
			
			for(var i=0; i<polygon.length; i++){
				var dot = polygon[i].x*direction.x + polygon[i].y*direction.y;
				dotproduct.push(dot);
				if(min === null || dot < min){
					min = dot;
				}
				if(max === null || dot > max){
					max = dot;
				}
			}
			
			// there may be multiple vertices with min/max values. In which case we choose the one that is normal-most (eg. left most)
			var indexmin = 0;
			var indexmax = 0;
			
			var normalmin = null;
			var normalmax = null;
						
			for(i=0; i<polygon.length; i++){
				if(_almostEqual(dotproduct[i] , min)){
					var dot = polygon[i].x*normal.x + polygon[i].y*normal.y;
					if(normalmin === null || dot > normalmin){
						normalmin = dot;
						indexmin = i;
					}					
				}
				else if(_almostEqual(dotproduct[i] , max)){
					var dot = polygon[i].x*normal.x + polygon[i].y*normal.y;
					if(normalmax === null || dot > normalmax){
						normalmax = dot;
						indexmax = i;
					}					
				}
			}
						
			// now we have two edges bound by min and max points, figure out which edge faces our direction vector
			
			var indexleft = indexmin-1;
			var indexright = indexmin+1;
			
			if(indexleft < 0){
				indexleft = polygon.length-1;
			}
			if(indexright >= polygon.length){
				indexright = 0;
			}
			
			var minvertex = polygon[indexmin];
			var left = polygon[indexleft];
			var right = polygon[indexright];
			
			var leftvector = {
				x: left.x - minvertex.x,
				y: left.y - minvertex.y
			};
			
			var rightvector = {
				x: right.x - minvertex.x,
				y: right.y - minvertex.y
			};
			
			var dotleft = leftvector.x*direction.x + leftvector.y*direction.y;
			var dotright = rightvector.x*direction.x + rightvector.y*direction.y;
			
			// -1 = left, 1 = right
			var scandirection = -1;
			
			if(_almostEqual(dotleft, 0)){
				scandirection = 1;
			}
			else if(_almostEqual(dotright, 0)){
				scandirection = -1;
			}
			else{
				var normaldotleft;
				var normaldotright;
			
				if(_almostEqual(dotleft, dotright)){
					// the points line up exactly along the normal vector
					normaldotleft = leftvector.x*normal.x + leftvector.y*normal.y;
					normaldotright = rightvector.x*normal.x + rightvector.y*normal.y;
				}
				else if(dotleft < dotright){
					// normalize right vertex so normal projection can be directly compared
					normaldotleft = leftvector.x*normal.x + leftvector.y*normal.y;
					normaldotright = (rightvector.x*normal.x + rightvector.y*normal.y)*(dotleft/dotright);
				}
				else{
					// normalize left vertex so normal projection can be directly compared
					normaldotleft = leftvector.x*normal.x + leftvector.y*normal.y * (dotright/dotleft);
					normaldotright = rightvector.x*normal.x + rightvector.y*normal.y;
				}
				
				if(normaldotleft > normaldotright){
					scandirection = -1;
				}
				else{
					// technically they could be equal, (ie. the segments bound by left and right points are incident)
					// in which case we'll have to climb up the chain until lines are no longer incident
					// for now we'll just not handle it and assume people aren't giving us garbage input..
					scandirection = 1;
				}
			}
			
			// connect all points between indexmin and indexmax along the scan direction
			var edge = [];
			var count = 0;
			i=indexmin;
			while(count < polygon.length){
				if(i >= polygon.length){
					i=0;
				}
				else if(i < 0){
					i=polygon.length-1;
				}
				
				edge.push(polygon[i]);
				
				if(i == indexmax){
					break;
				}
				i += scandirection;
				count++;
			}
			
			return edge;
		},
		
		// returns the normal distance from p to a line segment defined by s1 s2
		// this is basically algo 9 in [1], generalized for any vector direction
		// eg. normal of [-1, 0] returns the horizontal distance between the point and the line segment
		// sxinclusive: if true, include endpoints instead of excluding them
		
		pointLineDistance: function(p, s1, s2, normal, s1inclusive, s2inclusive){
		
			normal = _normalizeVector(normal);
			
			var dir = {
				x: normal.y,
				y: -normal.x
			};
			
			var pdot = p.x*dir.x + p.y*dir.y;
			var s1dot = s1.x*dir.x + s1.y*dir.y;
			var s2dot = s2.x*dir.x + s2.y*dir.y;
			
			var pdotnorm = p.x*normal.x + p.y*normal.y;
			var s1dotnorm = s1.x*normal.x + s1.y*normal.y;
			var s2dotnorm = s2.x*normal.x + s2.y*normal.y;
			
			
			// point is exactly along the edge in the normal direction
			if(_almostEqual(pdot, s1dot) && _almostEqual(pdot, s2dot)){
				// point lies on an endpoint
				if(_almostEqual(pdotnorm, s1dotnorm) ){
					return null;
				}
				
				if(_almostEqual(pdotnorm, s2dotnorm)){
					return null;
				}
				
				// point is outside both endpoints
				if (pdotnorm>s1dotnorm && pdotnorm>s2dotnorm){
					return Math.min(pdotnorm - s1dotnorm, pdotnorm - s2dotnorm);
				}
				if (pdotnorm<s1dotnorm && pdotnorm<s2dotnorm){
					return -Math.min(s1dotnorm-pdotnorm, s2dotnorm-pdotnorm);
				}
				
				// point lies between endpoints
				var diff1 = pdotnorm - s1dotnorm;
				var diff2 = pdotnorm - s2dotnorm;
				if(diff1 > 0){
					return diff1;
				}
				else{
					return diff2;
				}
			}
			// point 
			else if(_almostEqual(pdot, s1dot)){
				if(s1inclusive){
					return pdotnorm-s1dotnorm;
				}
				else{
					return null;
				}
			}
			else if(_almostEqual(pdot, s2dot)){
				if(s2inclusive){
					return pdotnorm-s2dotnorm;
				}
				else{
					return null;
				}
			}
			else if ((pdot<s1dot && pdot<s2dot) || (pdot>s1dot && pdot>s2dot)){
				return null; // point doesn't collide with segment
			}
			
			return (pdotnorm - s1dotnorm + (s1dotnorm - s2dotnorm)*(s1dot - pdot)/(s1dot - s2dot));
		},
		
		pointDistance: function(p, s1, s2, normal, infinite){
			normal = _normalizeVector(normal);
			
			var dir = {
				x: normal.y,
				y: -normal.x
			};
			
			var pdot = p.x*dir.x + p.y*dir.y;
			var s1dot = s1.x*dir.x + s1.y*dir.y;
			var s2dot = s2.x*dir.x + s2.y*dir.y;
			
			var pdotnorm = p.x*normal.x + p.y*normal.y;
			var s1dotnorm = s1.x*normal.x + s1.y*normal.y;
			var s2dotnorm = s2.x*normal.x + s2.y*normal.y;
			
			if(!infinite){
				if (((pdot<s1dot || _almostEqual(pdot, s1dot)) && (pdot<s2dot || _almostEqual(pdot, s2dot))) || ((pdot>s1dot || _almostEqual(pdot, s1dot)) && (pdot>s2dot || _almostEqual(pdot, s2dot)))){
					return null; // dot doesn't collide with segment, or lies directly on the vertex
				}
				if ((_almostEqual(pdot, s1dot) && _almostEqual(pdot, s2dot)) && (pdotnorm>s1dotnorm && pdotnorm>s2dotnorm)){
					return Math.min(pdotnorm - s1dotnorm, pdotnorm - s2dotnorm);
				}
				if ((_almostEqual(pdot, s1dot) && _almostEqual(pdot, s2dot)) && (pdotnorm<s1dotnorm && pdotnorm<s2dotnorm)){
					return -Math.min(s1dotnorm-pdotnorm, s2dotnorm-pdotnorm);
				}
			}
			
			return -(pdotnorm - s1dotnorm + (s1dotnorm - s2dotnorm)*(s1dot - pdot)/(s1dot - s2dot));
		},
		
		segmentDistance: function(A, B, E, F, direction){
			var normal = {
				x: direction.y,
				y: -direction.x
			};
			
			var reverse = {
				x: -direction.x,
				y: -direction.y
			};
						
			var dotA = A.x*normal.x + A.y*normal.y;
			var dotB = B.x*normal.x + B.y*normal.y;
			var dotE = E.x*normal.x + E.y*normal.y;
			var dotF = F.x*normal.x + F.y*normal.y;
			
			var crossA = A.x*direction.x + A.y*direction.y;
			var crossB = B.x*direction.x + B.y*direction.y;
			var crossE = E.x*direction.x + E.y*direction.y;
			var crossF = F.x*direction.x + F.y*direction.y;
			
			var crossABmin = Math.min(crossA,crossB);
			var crossABmax = Math.max(crossA,crossB);
			
			var crossEFmax = Math.max(crossE,crossF);
			var crossEFmin = Math.min(crossE,crossF);

			var ABmin = Math.min(dotA,dotB);
			var ABmax = Math.max(dotA,dotB);
			
			var EFmax = Math.max(dotE,dotF);
			var EFmin = Math.min(dotE,dotF);
						
			// segments that will merely touch at one point
			if(_almostEqual(ABmax, EFmin,TOL) || _almostEqual(ABmin, EFmax,TOL)){
				return null;
			}
			// segments miss eachother completely
			if(ABmax < EFmin || ABmin > EFmax){
				return null;
			}
			
			var overlap;
			
			if((ABmax > EFmax && ABmin < EFmin) || (EFmax > ABmax && EFmin < ABmin)){
				overlap = 1;
			}
			else{
				var minMax = Math.min(ABmax, EFmax);
				var maxMin = Math.max(ABmin, EFmin);
				
				var maxMax = Math.max(ABmax, EFmax);
				var minMin = Math.min(ABmin, EFmin);
				
				overlap = (minMax-maxMin)/(maxMax-minMin);
			}
			
			var crossABE = (E.y - A.y) * (B.x - A.x) - (E.x - A.x) * (B.y - A.y);
			var crossABF = (F.y - A.y) * (B.x - A.x) - (F.x - A.x) * (B.y - A.y);
			
			// lines are colinear
			if(_almostEqual(crossABE,0) && _almostEqual(crossABF,0)){
				
				var ABnorm = {x: B.y-A.y, y: A.x-B.x};
				var EFnorm = {x: F.y-E.y, y: E.x-F.x};
				
				var ABnormlength = Math.sqrt(ABnorm.x*ABnorm.x + ABnorm.y*ABnorm.y);
				ABnorm.x /= ABnormlength;
				ABnorm.y /= ABnormlength;
				
				var EFnormlength = Math.sqrt(EFnorm.x*EFnorm.x + EFnorm.y*EFnorm.y);
				EFnorm.x /= EFnormlength;
				EFnorm.y /= EFnormlength;
				
				// segment normals must point in opposite directions
				if(Math.abs(ABnorm.y * EFnorm.x - ABnorm.x * EFnorm.y) < TOL && ABnorm.y * EFnorm.y + ABnorm.x * EFnorm.x < 0){
					// normal of AB segment must point in same direction as given direction vector
					var normdot = ABnorm.y * direction.y + ABnorm.x * direction.x;
					// the segments merely slide along eachother
					if(_almostEqual(normdot,0, TOL)){
						return null;
					}
					if(normdot < 0){
						return 0;
					}
				}
				return null;
			}
			
			var distances = [];
			
			// coincident points
			if(_almostEqual(dotA, dotE)){
				distances.push(crossA-crossE);
			}
			else if(_almostEqual(dotA, dotF)){
				distances.push(crossA-crossF);
			}
			else if(dotA > EFmin && dotA < EFmax){
				var d = this.pointDistance(A,E,F,reverse);
				if(d !== null && _almostEqual(d, 0)){ //  A currently touches EF, but AB is moving away from EF
					var dB = this.pointDistance(B,E,F,reverse,true);
					if(dB < 0 || _almostEqual(dB*overlap,0)){
						d = null;
					}
				}
				if(d !== null){
					distances.push(d);
				}
			}
						
			if(_almostEqual(dotB, dotE)){
				distances.push(crossB-crossE);
			}
			else if(_almostEqual(dotB, dotF)){
				distances.push(crossB-crossF);
			}
			else if(dotB > EFmin && dotB < EFmax){
				var d = this.pointDistance(B,E,F,reverse);
				
				if(d !== null && _almostEqual(d, 0)){ // crossA>crossB A currently touches EF, but AB is moving away from EF
					var dA = this.pointDistance(A,E,F,reverse,true);
					if(dA < 0 || _almostEqual(dA*overlap,0)){
						d = null;
					}
				}
				if(d !== null){
					distances.push(d);
				}
			}
			
			if(dotE > ABmin && dotE < ABmax){
				var d = this.pointDistance(E,A,B,direction);
				if(d !== null && _almostEqual(d, 0)){ // crossF<crossE A currently touches EF, but AB is moving away from EF
					var dF = this.pointDistance(F,A,B,direction, true);
					if(dF < 0 || _almostEqual(dF*overlap,0)){
						d = null;
					}
				}
				if(d !== null){
					distances.push(d);
				}
			}
			
			if(dotF > ABmin && dotF < ABmax){
				var d = this.pointDistance(F,A,B,direction);
				if(d !== null && _almostEqual(d, 0)){ // && crossE<crossF A currently touches EF, but AB is moving away from EF
					var dE = this.pointDistance(E,A,B,direction, true);
					if(dE < 0 || _almostEqual(dE*overlap,0)){
						d = null;
					}
				}
				if(d !== null){
					distances.push(d);
				}
			}
			
			if(distances.length == 0){
				return null;
			}

			return Math.min.apply(Math, distances);
		},
		
		polygonSlideDistance: function(A, B, direction, ignoreNegative){
			
			var A1, A2, B1, B2, Aoffsetx, Aoffsety, Boffsetx, Boffsety;
			
			Aoffsetx = A.offsetx || 0;
			Aoffsety = A.offsety || 0;
			
			Boffsetx = B.offsetx || 0;
			Boffsety = B.offsety || 0;
			
			A = A.slice(0);
			B = B.slice(0);
			
			// close the loop for polygons
			if(A[0] != A[A.length-1]){
				A.push(A[0]);
			}
			
			if(B[0] != B[B.length-1]){
				B.push(B[0]);
			}
			
			var edgeA = A;
			var edgeB = B;

			var distance = null;
			var p, s1, s2, d;
			
			
			var dir = _normalizeVector(direction);
			
			var normal = {
				x: dir.y,
				y: -dir.x
			};
			
			var reverse = {
				x: -dir.x,
				y: -dir.y,
			};
			
			for(var i=0; i<edgeB.length-1; i++){
				var mind = null;
				for(var j=0; j<edgeA.length-1; j++){
					A1 = {x: edgeA[j].x + Aoffsetx, y: edgeA[j].y + Aoffsety};
					A2 = {x: edgeA[j+1].x + Aoffsetx, y: edgeA[j+1].y + Aoffsety};
					B1 = {x: edgeB[i].x + Boffsetx, y: edgeB[i].y + Boffsety};
					B2 = {x: edgeB[i+1].x + Boffsetx, y: edgeB[i+1].y + Boffsety};
										
					if((_almostEqual(A1.x, A2.x) && _almostEqual(A1.y, A2.y)) || (_almostEqual(B1.x, B2.x) && _almostEqual(B1.y, B2.y))){
						continue; // ignore extremely small lines
					}
					
					d = this.segmentDistance(A1, A2, B1, B2, dir);
					
					if(d !== null && (distance === null || d < distance)){
						if(!ignoreNegative || d > 0 || _almostEqual(d, 0)){
							distance = d;
						}
					}
				}	
			}
			return distance;
		},
		
		// project each point of B onto A in the given direction, and return the 
		polygonProjectionDistance: function(A, B, direction){
			var Boffsetx = B.offsetx || 0;
			var Boffsety = B.offsety || 0;
			
			var Aoffsetx = A.offsetx || 0;
			var Aoffsety = A.offsety || 0;
			
			A = A.slice(0);
			B = B.slice(0);
			
			// close the loop for polygons
			if(A[0] != A[A.length-1]){
				A.push(A[0]);
			}
			
			if(B[0] != B[B.length-1]){
				B.push(B[0]);
			}
			
			var edgeA = A;
			var edgeB = B;
			
			var distance = null;
			var p, d, s1, s2;
			
			
			for(var i=0; i<edgeB.length; i++){
				// the shortest/most negative projection of B onto A
				var minprojection = null;
				var minp = null;
				for(var j=0; j<edgeA.length-1; j++){
					p = {x : edgeB[i].x + Boffsetx, y : edgeB[i].y + Boffsety};
					s1 = {x: edgeA[j].x + Aoffsetx, y: edgeA[j].y + Aoffsety};
					s2 = {x: edgeA[j+1].x + Aoffsetx, y: edgeA[j+1].y + Aoffsety} ;
					
					if(Math.abs((s2.y-s1.y) * direction.x - (s2.x-s1.x) * direction.y) < TOL){
						continue;
					}
					
					// project point, ignore edge boundaries
					d = this.pointDistance(p, s1, s2, direction);

					if(d !== null && (minprojection === null || d < minprojection)){
						minprojection = d;
						minp = p;
					}
				}
				if(minprojection !== null && (distance === null || minprojection > distance)){
					distance = minprojection;
				}
			}
			
			return distance;
		},
		
		// searches for an arrangement of A and B such that they do not overlap
		// if an NFP is given, only search for startpoints that have not already been traversed in the given NFP
		searchStartPoint: function(A,B,inside,NFP){
			// clone arrays
			A = A.slice(0);
			B = B.slice(0);
			
			// close the loop for polygons
			if(A[0] != A[A.length-1]){
				A.push(A[0]);
			}
			
			if(B[0] != B[B.length-1]){
				B.push(B[0]);
			}
						
			for(var i=0; i<A.length-1; i++){
				if(!A[i].marked){
					A[i].marked = true;
					for(var j=0; j<B.length; j++){
						B.offsetx = A[i].x - B[j].x;
						B.offsety = A[i].y - B[j].y;
						
						var Binside = null;
						for(var k=0; k<B.length; k++){
							var inpoly = this.pointInPolygon({x: B[k].x + B.offsetx, y: B[k].y + B.offsety}, A);
							if(inpoly !== null){
								Binside = inpoly;
								break;
							}
						}
						
						if(Binside === null){ // A and B are the same
							return null;
						}
											
						var startPoint = {x: B.offsetx, y: B.offsety};	
						if(((Binside && inside) || (!Binside && !inside)) && !this.intersect(A,B) && !inNfp(startPoint, NFP)){
							return startPoint;
						}
						
						// slide B along vector
						var vx = A[i+1].x - A[i].x;
						var vy = A[i+1].y - A[i].y;
												
						var d1 = this.polygonProjectionDistance(A,B,{x: vx, y: vy});
						var d2 = this.polygonProjectionDistance(B,A,{x: -vx, y: -vy});
						
						var d = null;
						
						// todo: clean this up
						if(d1 === null && d2 === null){
							// nothin
						}
						else if(d1 === null){
							d = d2;
						}
						else if(d2 === null){
							d = d1;
						}
						else{
							d = Math.min(d1,d2);
						}
												
						// only slide until no longer negative
						// todo: clean this up
						if(d !== null && !_almostEqual(d,0) && d > 0){
							
						}
						else{
							continue;
						}
						
						var vd2 = vx*vx + vy*vy;
						
						if(d*d < vd2 && !_almostEqual(d*d, vd2)){
							var vd = Math.sqrt(vx*vx + vy*vy);
							vx *= d/vd;
							vy *= d/vd;
						}
						
						B.offsetx += vx;
						B.offsety += vy;
							
						for(k=0; k<B.length; k++){
							var inpoly = this.pointInPolygon({x: B[k].x + B.offsetx, y: B[k].y + B.offsety}, A);
							if(inpoly !== null){
								Binside = inpoly;
								break;
							}
						}
						startPoint = {x: B.offsetx, y: B.offsety};
						if(((Binside && inside) || (!Binside && !inside)) && !this.intersect(A,B) && !inNfp(startPoint, NFP)){
							return startPoint;
						}
					}
				}
			}
			
			// returns true if point already exists in the given nfp
			function inNfp(p, nfp){
				if(!nfp || nfp.length == 0){
					return false;
				}
				
				for(var i=0; i<nfp.length; i++){
					for(var j=0; j<nfp[i].length; j++){
						if(_almostEqual(p.x, nfp[i][j].x) && _almostEqual(p.y, nfp[i][j].y)){
							return true;
						}
					}
				}
				
				return false;
			}
						
			return null;
		},
		
		isRectangle: function(poly, tolerance){
			var bb = this.getPolygonBounds(poly);
			tolerance = tolerance || TOL;
			
			for(var i=0; i<poly.length; i++){
				if(!_almostEqual(poly[i].x, bb.x) && !_almostEqual(poly[i].x, bb.x+bb.width)){
					return false;
				}
				if(!_almostEqual(poly[i].y, bb.y) && !_almostEqual(poly[i].y, bb.y+bb.height)){
					return false;
				}
			}
			
			return true;
		},
		
		// returns an interior NFP for the special case where A is a rectangle
		noFitPolygonRectangle: function(A, B){	
			var minAx = A[0].x;
			var minAy = A[0].y;
			var maxAx = A[0].x;
			var maxAy = A[0].y;
			
			for(var i=1; i<A.length; i++){
				if(A[i].x < minAx){
					minAx = A[i].x;
				}
				if(A[i].y < minAy){
					minAy = A[i].y;
				}
				if(A[i].x > maxAx){
					maxAx = A[i].x;
				}
				if(A[i].y > maxAy){
					maxAy = A[i].y;
				}
			}
			
			var minBx = B[0].x;
			var minBy = B[0].y;
			var maxBx = B[0].x;
			var maxBy = B[0].y;
			for(i=1; i<B.length; i++){
				if(B[i].x < minBx){
					minBx = B[i].x;
				}
				if(B[i].y < minBy){
					minBy = B[i].y;
				}
				if(B[i].x > maxBx){
					maxBx = B[i].x;
				}
				if(B[i].y > maxBy){
					maxBy = B[i].y;
				}
			}
			
			if(maxBx-minBx > maxAx-minAx){
				return null;
			}
			if(maxBy-minBy > maxAy-minAy){
				return null;
			}
			
			return [[
			{x: minAx-minBx+B[0].x, y: minAy-minBy+B[0].y},
			{x: maxAx-maxBx+B[0].x, y: minAy-minBy+B[0].y},
			{x: maxAx-maxBx+B[0].x, y: maxAy-maxBy+B[0].y},
			{x: minAx-minBx+B[0].x, y: maxAy-maxBy+B[0].y}
			]];
		},
		
		// given a static polygon A and a movable polygon B, compute a no fit polygon by orbiting B about A
		// if the inside flag is set, B is orbited inside of A rather than outside
		// if the searchEdges flag is set, all edges of A are explored for NFPs - multiple 
		noFitPolygon: function(A, B, inside, searchEdges){
			if(!A || A.length < 3 || !B || B.length < 3){
				return null;
			}
						
			A.offsetx = 0;
			A.offsety = 0;
			
			var i, j;
			
			var minA = A[0].y;
			var minAindex = 0;
			
			var maxB = B[0].y;
			var maxBindex = 0;
			
			for(i=1; i<A.length; i++){
				A[i].marked = false;
				if(A[i].y < minA){
					minA = A[i].y;
					minAindex = i;
				}
			}
			
			for(i=1; i<B.length; i++){
				B[i].marked = false;
				if(B[i].y > maxB){
					maxB = B[i].y;
					maxBindex = i;
				}
			}
						
			if(!inside){
				// shift B such that the bottom-most point of B is at the top-most point of A. This guarantees an initial placement with no intersections
				var startpoint = {
					x: A[minAindex].x-B[maxBindex].x,
					y: A[minAindex].y-B[maxBindex].y
				};
			}
			else{
				// no reliable heuristic for inside
				var startpoint = this.searchStartPoint(A,B,true);
			}
						
			var NFPlist = [];
						
			while(startpoint !== null){
				
				B.offsetx = startpoint.x;
				B.offsety = startpoint.y;

				// maintain a list of touching points/edges
				var touching;
				
				var prevvector = null; // keep track of previous vector
				var NFP = [{
					x: B[0].x+B.offsetx,
					y: B[0].y+B.offsety
				}];
				
				var referencex = B[0].x+B.offsetx;
				var referencey = B[0].y+B.offsety;
				var startx = referencex;
				var starty = referencey;
				var counter = 0;
				
				while(counter < 10*(A.length + B.length)){ // sanity check, prevent infinite loop
					touching = [];
					// find touching vertices/edges
					for(i=0; i<A.length; i++){
						var nexti = (i==A.length-1) ? 0 : i+1;
						for(j=0; j<B.length; j++){
							var nextj = (j==B.length-1) ? 0 : j+1;
							if(_almostEqual(A[i].x, B[j].x+B.offsetx) && _almostEqual(A[i].y, B[j].y+B.offsety)){
								touching.push({	type: 0, A: i, B: j });
							}
							else if(_onSegment(A[i],A[nexti],{x: B[j].x+B.offsetx, y: B[j].y + B.offsety})){
								touching.push({	type: 1, A: nexti, B: j });
							}
							else if(_onSegment({x: B[j].x+B.offsetx, y: B[j].y + B.offsety},{x: B[nextj].x+B.offsetx, y: B[nextj].y + B.offsety},A[i])){
								touching.push({	type: 2, A: i, B: nextj });
							}
						}
					}
					
					// generate translation vectors from touching vertices/edges
					var vectors = [];
					for(i=0; i<touching.length; i++){
						var vertexA = A[touching[i].A];
						vertexA.marked = true;
						
						// adjacent A vertices
						var prevAindex = touching[i].A-1;
						var nextAindex = touching[i].A+1;
						
						prevAindex = (prevAindex < 0) ? A.length-1 : prevAindex; // loop
						nextAindex = (nextAindex >= A.length) ? 0 : nextAindex; // loop
						
						var prevA = A[prevAindex];
						var nextA = A[nextAindex];
						
						// adjacent B vertices
						var vertexB = B[touching[i].B];
						
						var prevBindex = touching[i].B-1;
						var nextBindex = touching[i].B+1;
						
						prevBindex = (prevBindex < 0) ? B.length-1 : prevBindex; // loop
						nextBindex = (nextBindex >= B.length) ? 0 : nextBindex; // loop
						
						var prevB = B[prevBindex];
						var nextB = B[nextBindex];
						
						if(touching[i].type == 0){
							
							var vA1 = {
								x: prevA.x-vertexA.x,
								y: prevA.y-vertexA.y,
								start: vertexA,
								end: prevA
							};
							
							var vA2 = {
								x: nextA.x-vertexA.x,
								y: nextA.y-vertexA.y,
								start: vertexA,
								end: nextA
							};
							
							// B vectors need to be inverted
							var vB1 = {
								x: vertexB.x-prevB.x,
								y: vertexB.y-prevB.y,
								start: prevB,
								end: vertexB
							};
							
							var vB2 = {
								x: vertexB.x-nextB.x,
								y: vertexB.y-nextB.y,
								start: nextB,
								end: vertexB
							};
							
							vectors.push(vA1);
							vectors.push(vA2);
							vectors.push(vB1);
							vectors.push(vB2);
						}
						else if(touching[i].type == 1){
							vectors.push({
								x: vertexA.x-(vertexB.x+B.offsetx),
								y: vertexA.y-(vertexB.y+B.offsety),
								start: prevA,
								end: vertexA
							});
							
							vectors.push({
								x: prevA.x-(vertexB.x+B.offsetx),
								y: prevA.y-(vertexB.y+B.offsety),
								start: vertexA,
								end: prevA
							});
						}
						else if(touching[i].type == 2){
							vectors.push({
								x: vertexA.x-(vertexB.x+B.offsetx),
								y: vertexA.y-(vertexB.y+B.offsety),
								start: prevB,
								end: vertexB
							});
							
							vectors.push({
								x: vertexA.x-(prevB.x+B.offsetx),
								y: vertexA.y-(prevB.y+B.offsety),
								start: vertexB,
								end: prevB
							});
						}
					}

					// todo: there should be a faster way to reject vectors that will cause immediate intersection. For now just check them all
					
					var translate = null;
					var maxd = 0;
					
					for(i=0; i<vectors.length; i++){
						if(vectors[i].x == 0 && vectors[i].y == 0){
							continue;
						}
						
						// if this vector points us back to where we came from, ignore it.
						// ie cross product = 0, dot product < 0
						if(prevvector && vectors[i].y * prevvector.y + vectors[i].x * prevvector.x < 0){
							
							// compare magnitude with unit vectors
							var vectorlength = Math.sqrt(vectors[i].x*vectors[i].x+vectors[i].y*vectors[i].y);
							var unitv = {x: vectors[i].x/vectorlength, y:vectors[i].y/vectorlength};
							
							var prevlength = Math.sqrt(prevvector.x*prevvector.x+prevvector.y*prevvector.y);
							var prevunit = {x: prevvector.x/prevlength, y:prevvector.y/prevlength};
							
							// we need to scale down to unit vectors to normalize vector length. Could also just do a tan here
							if(Math.abs(unitv.y * prevunit.x - unitv.x * prevunit.y) < 0.0001){
								continue;
							}
						}
						
						var d = this.polygonSlideDistance(A, B, vectors[i], true);
						var vecd2 = vectors[i].x*vectors[i].x + vectors[i].y*vectors[i].y;
						
						if(d === null || d*d > vecd2){
							var vecd = Math.sqrt(vectors[i].x*vectors[i].x + vectors[i].y*vectors[i].y);
							d = vecd;
						}
						
						if(d !== null && d > maxd){
							maxd = d;
							translate = vectors[i];
						}
					}
					
					
					if(translate === null || _almostEqual(maxd, 0)){
						// didn't close the loop, something went wrong here
						NFP = null;
						break;
					}
					
					translate.start.marked = true;
					translate.end.marked = true;
					
					prevvector = translate;
					
					// trim
					var vlength2 = translate.x*translate.x + translate.y*translate.y;
					if(maxd*maxd < vlength2 && !_almostEqual(maxd*maxd, vlength2)){
						var scale = Math.sqrt((maxd*maxd)/vlength2);
						translate.x *= scale;
						translate.y *= scale;
					}
										
					referencex += translate.x;
					referencey += translate.y;
					
					if(_almostEqual(referencex, startx) && _almostEqual(referencey, starty)){
						// we've made a full loop
						break;
					}
					
					// if A and B start on a touching horizontal line, the end point may not be the start point
					var looped = false;
					if(NFP.length > 0){
						for(i=0; i<NFP.length-1; i++){
							if(_almostEqual(referencex, NFP[i].x) && _almostEqual(referencey, NFP[i].y)){
								looped = true;
							}
						}
					}
					
					if(looped){
						// we've made a full loop
						break;
					}
					
					NFP.push({
						x: referencex,
						y: referencey
					});
					
					B.offsetx += translate.x;
					B.offsety += translate.y;
					
					counter++;
				}
				
				if(NFP && NFP.length > 0){
					NFPlist.push(NFP);
				}
				
				if(!searchEdges){
					// only get outer NFP or first inner NFP
					break;
				}
				
				startpoint = this.searchStartPoint(A,B,inside,NFPlist);
				
			}
			
			return NFPlist;
		},
		
		// given two polygons that touch at at least one point, but do not intersect. Return the outer perimeter of both polygons as a single continuous polygon
		// A and B must have the same winding direction
		polygonHull: function(A,B){
			if(!A || A.length < 3 || !B || B.length < 3){
				return null;
			}
			
			var i, j;
			
			var Aoffsetx = A.offsetx || 0;
			var Aoffsety = A.offsety || 0;
			var Boffsetx = B.offsetx || 0;
			var Boffsety = B.offsety || 0;
			
			// start at an extreme point that is guaranteed to be on the final polygon
			var miny = A[0].y;
			var startPolygon = A;
			var startIndex = 0;
			
			for(i=0; i<A.length; i++){
				if(A[i].y+Aoffsety < miny){
					miny = A[i].y+Aoffsety;
					startPolygon = A;
					startIndex = i;
				}
			}
			
			for(i=0; i<B.length; i++){
				if(B[i].y+Boffsety < miny){
					miny = B[i].y+Boffsety;
					startPolygon = B;
					startIndex = i;
				}
			}
			
			// for simplicity we'll define polygon A as the starting polygon
			if(startPolygon == B){
				B = A;
				A = startPolygon;
				Aoffsetx = A.offsetx || 0;
				Aoffsety = A.offsety || 0;
				Boffsetx = B.offsetx || 0;
				Boffsety = B.offsety || 0;
			}
			
			A = A.slice(0);
			B = B.slice(0);
			
			var C = [];
			var current = startIndex;
			var intercept1 = null;
			var intercept2 = null;
			
			// scan forward from the starting point
			for(i=0; i<A.length+1; i++){
				current = (current == A.length) ? 0 : current;
				var next = (current==A.length-1) ? 0 : current+1;
				var touching = false;
				for(j=0; j<B.length; j++){
					var nextj = (j==B.length-1) ? 0 : j+1;
					if(_almostEqual(A[current].x+Aoffsetx, B[j].x+Boffsetx) && _almostEqual(A[current].y+Aoffsety, B[j].y+Boffsety)){
						C.push({x: A[current].x+Aoffsetx, y: A[current].y+Aoffsety});
						intercept1 = j;
						touching = true;
						break;
					}
					else if(_onSegment({x: A[current].x+Aoffsetx, y: A[current].y+Aoffsety},{x: A[next].x+Aoffsetx, y: A[next].y+Aoffsety},{x: B[j].x+Boffsetx, y: B[j].y + Boffsety})){
						C.push({x: A[current].x+Aoffsetx, y: A[current].y+Aoffsety});
						C.push({x: B[j].x+Boffsetx, y: B[j].y + Boffsety});
						intercept1 = j;
						touching = true;
						break;
					}
					else if(_onSegment({x: B[j].x+Boffsetx, y: B[j].y + Boffsety},{x: B[nextj].x+Boffsetx, y: B[nextj].y + Boffsety},{x: A[current].x+Aoffsetx, y: A[current].y+Aoffsety})){
						C.push({x: A[current].x+Aoffsetx, y: A[current].y+Aoffsety});
						C.push({x: B[nextj].x+Boffsetx, y: B[nextj].y + Boffsety});
						intercept1 = nextj;
						touching = true;
						break;
					}
				}
				
				if(touching){
					break;
				}
				
				C.push({x: A[current].x+Aoffsetx, y: A[current].y+Aoffsety});
				
				current++;
			}
			
			// scan backward from the starting point
			current = startIndex-1;
			for(i=0; i<A.length+1; i++){
				current = (current<0) ? A.length-1 : current;
				var next = (current==0) ? A.length-1 : current-1;
				var touching = false;
				for(j=0; j<B.length; j++){
					var nextj = (j==B.length-1) ? 0 : j+1;
					if(_almostEqual(A[current].x+Aoffsetx, B[j].x+Boffsetx) && _almostEqual(A[current].y, B[j].y+Boffsety)){
						C.unshift({x: A[current].x+Aoffsetx, y: A[current].y+Aoffsety});
						intercept2 = j;
						touching = true;
						break;
					}
					else if(_onSegment({x: A[current].x+Aoffsetx, y: A[current].y+Aoffsety},{x: A[next].x+Aoffsetx, y: A[next].y+Aoffsety},{x: B[j].x+Boffsetx, y: B[j].y + Boffsety})){
						C.unshift({x: A[current].x+Aoffsetx, y: A[current].y+Aoffsety});
						C.unshift({x: B[j].x+Boffsetx, y: B[j].y + Boffsety});
						intercept2 = j;
						touching = true;
						break;
					}
					else if(_onSegment({x: B[j].x+Boffsetx, y: B[j].y + Boffsety},{x: B[nextj].x+Boffsetx, y: B[nextj].y + Boffsety},{x: A[current].x+Aoffsetx, y: A[current].y+Aoffsety})){
						C.unshift({x: A[current].x+Aoffsetx, y: A[current].y+Aoffsety});
						intercept2 = j;
						touching = true;
						break;
					}
				}
				
				if(touching){
					break;
				}
				
				C.unshift({x: A[current].x+Aoffsetx, y: A[current].y+Aoffsety});
				
				current--;
			}
			
			
			
			if(intercept1 === null || intercept2 === null){
				// polygons not touching?
				return null;
			}
			
			// the relevant points on B now lie between intercept1 and intercept2
			current = intercept1+1;
			for(i=0; i<B.length; i++){
				current = (current==B.length) ? 0 : current;
				C.push({x: B[current].x+Boffsetx, y: B[current].y + Boffsety});
				
				if(current == intercept2){
					break;
				}
				
				current++;
			}
			
			// dedupe
			for(i=0; i<C.length; i++){
				var next = (i==C.length-1) ? 0 : i+1;
				if(_almostEqual(C[i].x,C[next].x) && _almostEqual(C[i].y,C[next].y)){
					C.splice(i,1);
					i--;
				}
			}
			
			return C;
		},
		
		rotatePolygon: function(polygon, angle){
			var rotated = [];
			angle = angle * Math.PI / 180;
			for(var i=0; i<polygon.length; i++){
				var x = polygon[i].x;
				var y = polygon[i].y;
				var x1 = x*Math.cos(angle)-y*Math.sin(angle);
				var y1 = x*Math.sin(angle)+y*Math.cos(angle);
								
				rotated.push({x:x1, y:y1});
			}
			// reset bounding box
			var bounds = GeometryUtil.getPolygonBounds(rotated);
			rotated.x = bounds.x;
			rotated.y = bounds.y;
			rotated.width = bounds.width;
			rotated.height = bounds.height;
			
			return rotated;
		}
	};
})(typeof window !== 'undefined' ? window : self);
