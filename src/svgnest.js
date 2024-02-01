/*!
 * SvgNest
 * Licensed under the MIT license
 */

import ClipperLib from "js-clipper";

import { GeneticAlgorithm } from "./genetic-algorithm";
import { SvgParser } from "./svg-parser";
import { Parallel } from "./parallel";
import {
  polygonArea,
  pointInPolygon,
  almostEqual,
  getPolygonBounds
} from "./geometry-util";

function flattenTree(tree, hole, result = []) {
  const nodeCount = tree.length;
  let i = 0;
  let node;
  let children;

  for (i = 0; i < nodeCount; ++i) {
    node = tree[i];
    node.hole = hole;
    children = node.children;

    result.push(node);

    if (children && children.length > 0) {
      flattenTree(children, !hole, result);
    }
  }

  return result;
}

function toTree(list, idstart) {
  const parents = [];
  let i, j;

  // assign a unique id to each leaf
  let id = idstart || 0;
  let outerNode;
  let innerNode;
  let isChild = false;

  for (i = 0; i < list.length; ++i) {
    outerNode = list[i];
    isChild = false;

    for (j = 0; j < list.length; ++j) {
      innerNode = list[j];

      if (j !== i && pointInPolygon(outerNode[0], innerNode)) {
        if (!innerNode.children) {
          innerNode.children = [];
        }

        innerNode.children.push(outerNode);
        outerNode.parent = innerNode;
        isChild = true;
        break;
      }
    }

    if (!isChild) {
      parents.push(outerNode);
    }
  }

  for (i = 0; i < list.length; ++i) {
    if (parents.indexOf(list[i]) < 0) {
      list.splice(i, 1);
      i--;
    }
  }

  const parentCount = parents.length;
  let childId = id + parentCount;
  let parent;

  for (i = 0; i < parentCount; ++i) {
    parent = parents[i];
    parent.id = id + i;

    if (parent.children) {
      childId = toTree(parent.children, childId);
    }
  }

  return childId;
}

// offset tree recursively
function offsetTree(tree, offset, offsetFunction) {
  let i = 0;
  let node;
  let offsetPaths;
  const treeSize = tree.length;

  for (i = 0; i < treeSize; ++i) {
    node = tree[i];
    offsetPaths = offsetFunction(node, offset);

    if (offsetPaths.length == 1) {
      // replace array items in place
      Array.prototype.splice.apply(
        node,
        [0, node.length].concat(offsetPaths[0])
      );
    }

    if (node.childNodes && node.childNodes.length > 0) {
      offsetTree(node.childNodes, -offset, offsetFunction);
    }
  }
}

function toClipperCoordinates(polygon) {
  const result = [];
  let i = 0;

  for (i = 0; i < polygon.length; ++i) {
    result.push({
      X: polygon[i].x,
      Y: polygon[i].y
    });
  }

  return result;
}

function toNestCoordinates(polygon, scale) {
  const count = polygon.length;
  const result = [];
  let i = 0;

  for (i = 0; i < count; ++i) {
    result.push({
      x: polygon[i].X / scale,
      y: polygon[i].Y / scale
    });
  }

  return result;
}

function getPlacementWorkerData(
  binPolygon,
  paths,
  ids,
  rotations,
  config,
  nfpCache = {}
) {
  return {
    binPolygon,
    paths,
    ids,
    rotations,
    config,
    nfpCache
  };
}

export default class SvgNest {
  constructor() {
    this.svg = null;

    // keep a reference to any style nodes, to maintain color/fill info
    this.style = null;

    this.parts = null;

    this.tree = null;

    this.bin = null;
    this.binPolygon = null;
    this.binBounds = null;
    this.nfpCache = {};
    this.configuration = {
      clipperScale: 10000000,
      curveTolerance: 0.3,
      spacing: 0,
      rotations: 4,
      populationSize: 10,
      mutationRate: 10,
      useHoles: false,
      exploreConcave: false
    };

    this.working = false;

    this.genethicAlgorithm = null;
    this.best = null;
    this.workerTimer = null;
    this.progress = 0;
    this.svgParser = new SvgParser();
  }

  parsesvg(svgstring) {
    // reset if in progress
    this.stop();

    this.bin = null;
    this.binPolygon = null;
    this.tree = null;

    // parse svg
    this.svg = this.svgParser.load(svgstring);
    this.style = this.svgParser.getStyle();
    this.svg = this.svgParser.clean();
    this.tree = this.getParts(this.svg.childNodes);

    return this.svg;
  }

  setbin(element) {
    if (!this.svg) {
      return;
    }
    this.bin = element;
  }

  config(configuration) {
    // clean up inputs

    if (!configuration) {
      return this.configuration;
    }

    if (
      configuration.curveTolerance &&
      !almostEqual(parseFloat(configuration.curveTolerance), 0)
    ) {
      this.configuration.curveTolerance = parseFloat(
        configuration.curveTolerance
      );
    }

    if ("spacing" in configuration) {
      this.configuration.spacing = parseFloat(configuration.spacing);
    }

    if (configuration.rotations && parseInt(configuration.rotations) > 0) {
      this.configuration.rotations = parseInt(configuration.rotations);
    }

    if (
      configuration.populationSize &&
      parseInt(configuration.populationSize) > 2
    ) {
      this.configuration.populationSize = parseInt(
        configuration.populationSize
      );
    }

    if (
      configuration.mutationRate &&
      parseInt(configuration.mutationRate) > 0
    ) {
      this.configuration.mutationRate = parseInt(configuration.mutationRate);
    }

    if ("useHoles" in configuration) {
      this.configuration.useHoles = !!configuration.useHoles;
    }

    if ("exploreConcave" in configuration) {
      this.configuration.exploreConcave = !!configuration.exploreConcave;
    }

    this.svgParser.config({ tolerance: this.configuration.curveTolerance });

    this.best = null;
    this.nfpCache = {};
    this.binPolygon = null;
    this.genethicAlgorithm = null;

    return this.configuration;
  }

  // progressCallback is called when progress is made
  // displayCallback is called when a new placement has been made
  start(progressCallback, displayCallback) {
    if (!this.svg || !this.bin) {
      return false;
    }

    this.parts = Array.prototype.slice.call(this.svg.childNodes);
    const binIndex = this.parts.indexOf(this.bin);

    if (binIndex >= 0) {
      // don't process bin as a part of the tree
      this.parts.splice(binIndex, 1);
    }

    // build tree without bin
    this.tree = this.getParts(this.parts.slice(0));

    offsetTree(
      this.tree,
      0.5 * this.configuration.spacing,
      this.polygonOffset.bind(this)
    );

    this.binPolygon = this.svgParser.polygonify(this.bin);
    this.binPolygon = this.cleanPolygon(this.binPolygon);

    if (!this.binPolygon || this.binPolygon.length < 3) {
      return false;
    }

    this.binBounds = getPolygonBounds(this.binPolygon);

    if (this.configuration.spacing > 0) {
      const offsetBin = this.polygonOffset(
        this.binPolygon,
        -0.5 * this.configuration.spacing
      );
      if (offsetBin.length == 1) {
        // if the offset contains 0 or more than 1 path, something went wrong.
        this.binPolygon = offsetBin.pop();
      }
    }

    this.binPolygon.id = -1;

    let point = this.binPolygon[0];
    // put bin on origin
    let xbinmax = point.x;
    let xbinmin = point.x;
    let ybinmax = point.y;
    let ybinmin = point.y;

    let i = 0;
    const binSize = this.binPolygon.length;

    for (i = 1; i < binSize; ++i) {
      point = this.binPolygon[i];
      if (point.x > xbinmax) {
        xbinmax = point.x;
      } else if (point.x < xbinmin) {
        xbinmin = point.x;
      }
      if (point.y > ybinmax) {
        ybinmax = point.y;
      } else if (point.y < ybinmin) {
        ybinmin = point.y;
      }
    }

    for (i = 0; i < binSize; ++i) {
      point = this.binPolygon[i];
      point.x -= xbinmin;
      point.y -= ybinmin;
    }

    this.binPolygon.width = xbinmax - xbinmin;
    this.binPolygon.height = ybinmax - ybinmin;

    // all paths need to have the same winding direction
    if (polygonArea(this.binPolygon) > 0) {
      this.binPolygon.reverse();
    }

    let start;
    let end;
    let node;
    // remove duplicate endpoints, ensure counterclockwise winding direction
    for (i = 0; i < this.tree.length; ++i) {
      node = this.tree[i];
      start = node[0];
      end = node[node.length - 1];

      if (
        start == end ||
        (almostEqual(start.x, end.x) && almostEqual(start.y, end.y))
      ) {
        node.pop();
      }

      if (polygonArea(node) > 0) {
        node.reverse();
      }
    }

    this.working = false;

    this.workerTimer = setInterval(() => {
      if (!this.working) {
        this.launchWorkers(
          this.tree,
          this.binPolygon,
          this.configuration,
          progressCallback,
          displayCallback
        );
        this.working = true;
      }

      progressCallback(this.progress);
    }, 100);
  }

  launchWorkers(
    tree,
    binPolygon,
    configuration,
    progressCallback,
    displayCallback
  ) {
    let i, j;

    if (this.genethicAlgorithm === null) {
      // initiate new GA
      const adam = tree.slice(0);

      // seed with decreasing area
      adam.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));

      this.genethicAlgorithm = new GeneticAlgorithm(
        adam,
        binPolygon,
        configuration
      );
    }

    let individual = null;

    // evaluate all members of the population
    for (i = 0; i < this.genethicAlgorithm.population.length; ++i) {
      if (!this.genethicAlgorithm.population[i].fitness) {
        individual = this.genethicAlgorithm.population[i];
        break;
      }
    }

    if (individual === null) {
      // all individuals have been evaluated, start next generation
      this.genethicAlgorithm.generation();
      individual = this.genethicAlgorithm.population[1];
    }

    const placeList = individual.placement;
    const rotations = individual.rotation;
    const placeCount = placeList.length;
    const ids = [];
    const nfpPairs = [];
    const newCache = {};
    let stringKey = "";
    let key;
    let part;

    const updateCache = (polygon1, polygon2, rotation1, rotation2, inside) => {
      key = {
        A: polygon1.id,
        B: polygon2.id,
        inside,
        Arotation: rotation1,
        Brotation: rotation2
      };

      stringKey = JSON.stringify(key);

      if (!this.nfpCache[stringKey]) {
        nfpPairs.push({ A: polygon1, B: polygon2, key: key });
      } else {
        newCache[stringKey] = this.nfpCache[stringKey];
      }
    };

    for (i = 0; i < placeCount; ++i) {
      part = placeList[i];
      ids.push(part.id);
      part.rotation = rotations[i];

      updateCache(binPolygon, part, 0, rotations[i], true);

      for (j = 0; j < i; ++j) {
        updateCache(placeList[j], part, rotations[j], rotations[i], false);
      }
    }

    // only keep cache for one cycle
    this.nfpCache = newCache;

    const placementWorkerData = getPlacementWorkerData(
      binPolygon,
      placeList.slice(0),
      ids,
      rotations,
      configuration,
      this.nfpCache
    );

    let spawnCount = 0;

    const onSpawn = () => {
      this.progress = spawnCount++ / nfpPairs.length;
    };

    const parallel = new Parallel(
      "pair",
      nfpPairs,
      {
        binPolygon,
        searchEdges: configuration.exploreConcave,
        useHoles: configuration.useHoles
      },
      onSpawn
    );

    parallel.then(
      (generatedNfp) => {
        if (generatedNfp) {
          let i = 0;
          let Nfp;
          let key;

          for (i = 0; i < generatedNfp.length; ++i) {
            Nfp = generatedNfp[i];

            if (Nfp) {
              // a null nfp means the nfp could not be generated, either because the parts simply don't fit or an error in the nfp algo
              key = JSON.stringify(Nfp.key);
              this.nfpCache[key] = Nfp.value;
            }
          }
        }

        placementWorkerData.nfpCache = this.nfpCache;

        // can't use .spawn because our data is an array
        const p2 = new Parallel(
          "placement",
          [placeList.slice()],
          placementWorkerData
        );

        p2.then(
          (placements) => {
            if (!placements || placements.length == 0) {
              return;
            }

            let i = 0;
            let j = 0;
            let bestResult = placements[0];

            individual.fitness = bestResult.fitness;

            for (i = 1; i < placements.length; ++i) {
              if (placements[i].fitness < bestResult.fitness) {
                bestResult = placements[i];
              }
            }

            if (!this.best || bestResult.fitness < this.best.fitness) {
              this.best = bestResult;

              let placedArea = 0;
              let totalArea = 0;
              let numPlacedParts = 0;
              let bestPlacement;
              const numParts = placeList.length;

              for (i = 0; i < this.best.placements.length; ++i) {
                totalArea += Math.abs(polygonArea(binPolygon));
                bestPlacement = this.best.placements[i];

                numPlacedParts += bestPlacement.length;

                for (j = 0; j < bestPlacement.length; ++j) {
                  placedArea += Math.abs(
                    polygonArea(tree[bestPlacement[j].id])
                  );
                }
              }

              displayCallback(
                this.applyPlacement(this.best.placements),
                placedArea / totalArea,
                numPlacedParts,
                numParts
              );
            } else {
              displayCallback();
            }
            this.working = false;
          },
          function (err) {
            console.log(err);
          }
        );
      },
      function (err) {
        console.log(err);
      }
    );
  }

  // assuming no intersections, return a tree where odd leaves are parts and even ones are holes
  // might be easier to use the DOM, but paths can't have paths as children. So we'll just make our own tree.
  getParts(paths) {
    let i;
    const polygons = [];
    const numChildren = paths.length;
    const trashold =
      this.configuration.curveTolerance * this.configuration.curveTolerance;
    let poly;

    for (i = 0; i < numChildren; ++i) {
      poly = this.svgParser.polygonify(paths[i]);
      poly = this.cleanPolygon(poly);

      // todo: warn user if poly could not be processed and is excluded from the nest
      if (poly && poly.length > 2 && Math.abs(polygonArea(poly)) > trashold) {
        poly.source = i;
        polygons.push(poly);
      }
    }

    // turn the list into a tree
    toTree(polygons);

    return polygons;
  }

  // use the clipper library to return an offset to the given polygon. Positive offset expands the polygon, negative contracts
  // note that this returns an array of polygons
  polygonOffset(polygon, offset) {
    if (!offset || offset == 0 || almostEqual(offset, 0)) {
      return polygon;
    }

    const p = this.svgToClipper(polygon);
    const miterLimit = 2;
    const co = new ClipperLib.ClipperOffset(
      miterLimit,
      this.configuration.curveTolerance * this.configuration.clipperScale
    );
    co.AddPath(
      p,
      ClipperLib.JoinType.jtRound,
      ClipperLib.EndType.etClosedPolygon
    );

    const newPaths = new ClipperLib.Paths();
    co.Execute(newPaths, offset * this.configuration.clipperScale);

    const result = [];
    let i = 0;

    for (i = 0; i < newPaths.length; ++i) {
      result.push(this.clipperToSvg(newPaths[i]));
    }

    return result;
  }

  // returns a less complex polygon that satisfies the curve tolerance
  cleanPolygon(polygon) {
    const p = this.svgToClipper(polygon);
    // remove self-intersections and find the biggest polygon that's left
    const simple = ClipperLib.Clipper.SimplifyPolygon(
      p,
      ClipperLib.PolyFillType.pftNonZero
    );

    if (!simple || simple.length == 0) {
      return null;
    }

    let i = 0;
    let biggest = simple[0];
    let biggestArea = Math.abs(ClipperLib.Clipper.Area(biggest));
    let area;

    for (i = 1; i < simple.length; ++i) {
      area = Math.abs(ClipperLib.Clipper.Area(simple[i]));

      if (area > biggestArea) {
        biggest = simple[i];
        biggestArea = area;
      }
    }

    // clean up singularities, coincident points and edges
    const clean = ClipperLib.Clipper.CleanPolygon(
      biggest,
      this.configuration.curveTolerance * this.configuration.clipperScale
    );

    if (!clean || clean.length === 0) {
      return null;
    }

    return this.clipperToSvg(clean);
  }

  // converts a polygon from normal float coordinates to integer coordinates used by clipper, as well as x/y -> X/Y
  svgToClipper(polygon) {
    const clip = toClipperCoordinates(polygon);

    ClipperLib.JS.ScaleUpPath(clip, this.configuration.clipperScale);

    return clip;
  }

  clipperToSvg(polygon) {
    return toNestCoordinates(polygon, this.configuration.clipperScale);
  }

  // returns an array of SVG elements that represent the placement, for export or rendering
  applyPlacement(placement) {
    const clone = [];
    const partCount = this.parts.length;
    const placementCount = placement.length;
    const svglist = [];
    let i, j, k;
    let newSvg;
    let binClone;
    let p;
    let part;
    let partGroup;
    let flattened;
    let c;

    for (i = 0; i < partCount; ++i) {
      clone.push(this.parts[i].cloneNode(false));
    }

    for (i = 0; i < placementCount; ++i) {
      newSvg = this.svg.cloneNode(false);
      newSvg.setAttribute(
        "viewBox",
        "0 0 " + this.binBounds.width + " " + this.binBounds.height
      );
      newSvg.setAttribute("width", this.binBounds.width + "px");
      newSvg.setAttribute("height", this.binBounds.height + "px");
      binClone = this.bin.cloneNode(false);

      binClone.setAttribute("class", "bin");
      binClone.setAttribute(
        "transform",
        "translate(" + -this.binBounds.x + " " + -this.binBounds.y + ")"
      );
      newSvg.appendChild(binClone);

      for (j = 0; j < placement[i].length; ++j) {
        p = placement[i][j];
        part = this.tree[p.id];

        // the original path could have transforms and stuff on it, so apply our transforms on a group
        partGroup = document.createElementNS(this.svg.namespaceURI, "g");
        partGroup.setAttribute(
          "transform",
          "translate(" + p.x + " " + p.y + ") rotate(" + p.rotation + ")"
        );
        partGroup.appendChild(clone[part.source]);

        if (part.children && part.children.length > 0) {
          flattened = flattenTree(part.children, true);

          for (k = 0; k < flattened.length; ++k) {
            c = clone[flattened[k].source];
            // add class to indicate hole
            if (
              flattened[k].hole &&
              (!c.getAttribute("class") ||
                c.getAttribute("class").indexOf("hole") < 0)
            ) {
              c.setAttribute("class", c.getAttribute("class") + " hole");
            }
            partGroup.appendChild(c);
          }
        }

        newSvg.appendChild(partGroup);
      }

      svglist.push(newSvg);
    }

    return svglist;
  }

  stop() {
    this.working = false;

    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
  }
}
