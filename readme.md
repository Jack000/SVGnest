# SVGnest

A browser-based vector nesting tool.

demo: http://svgnest.com

(requires SVG and webworker support). Mobile warning: running the demo is CPU intensive.

references (PDF):
- [López-Camacho *et al.* 2013](http://www.cs.stir.ac.uk/~goc/papers/EffectiveHueristic2DAOR2013.pdf)
- [Kendall 2000](http://www.graham-kendall.com/papers/k2001.pdf)
- [E.K. Burke *et al.* 2006](http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.440.379&rep=rep1&type=pdf)

# What is "nesting"?

Given a set of shapes and a container. eg, a piece of wood and letters to be laser-cut:

[img]

We wish to use as few containers as possible to hold all the shapes, or simply reduce the material usage in a single container:

[img]

You may also know this as the bin packing problem and stock cutting problem.

# Configuration

- **Space between parts:** Minimum space between parts (eg. for laser kerf, CNC offset etc.)
- **Curve tolerance:** The maximum error allowed for linear approximations of Bezier paths and arcs, in SVG units or "pixels"
- **Part rotations:** The *possible* number of rotations to evaluate for each part. eg. 4 for only the cardinal directions. Larger values may improve results, but will be slower to converge.
- **GA population:** The population size for the Genetic Algorithm
- **GA mutation rate:** The probability of mutation for each gene or part placement. Values from 1-50
- **Explore concave areas:** When enabled, solves the following edge case at a cost of performance and placement robustness:

[img]

# Outline of algorithm

While [good heuristics](http://cgi.csc.liv.ac.uk/~epa/surveyhtml.html) exist for the rectangular bin packing problem, in the real world we are concerned with irregular shapes.

The strategy is made of two parts:

- the placement strategy (ie. how do I insert each part into a bin?)
- and the optimization strategy (ie. what's the best order of insertions?)

## Placing the part

The key concept here is the "No Fit Polygon".

Given polygons A and B, we want to "orbit" B around A such that they always touch but do not intersect.

[img]

The resulting orbit is the NFP. It's easy to see that if we have a part already placed, the best place to put the next part is somewhere on the NFP of parts 1 and 2.

Similarly we can construct an "Inner Fit Polygon" for the first part and the bin. This is the same as the NFP, except the orbiting polygon is inside the stationary one.

[img]

When two or more parts have already been placed, we can take the union of the NFPs of the previously placed parts.

[img]

This means that we need to compute O(nlogn) NFPs to complete the first packing. While there are ways to mitigate this, we take the brute-force approach which has good properties for the optimization algo.

## Optimization

Now that we can place the parts, we need to optimize the insertion order. Here's an example of a bad insertion order:

[img]

If the large "C" is placed last, the concave space inside it won't be utilized because all the parts that could have filled it have already been placed.

To solve this, we use the "first-fit-decreasing" heuristic. Larger parts are placed first, and smaller parts last. This is quite intuitive, as the smaller parts tend to act as "sand" to fill the gaps left by the larger parts.

While this strategy gives us a good start, we want to explore more of the solution space. We could simply randomize the insertion order, but we can probably do better with a genetic algorithm. (If you don't know what a GA is, [this article](http://www.ai-junkie.com/ga/intro/gat1.html) is a very approachable read)

# Evaluating fitness

In our GA the insertion order and the rotation of the parts form the gene. The fitness function follows these rules:

1. Minimize the number of unplaceable parts (parts that cannot fit any bin due to its rotation)
2. Minimize the number of bins used
3. Minimize the *width* of all placed parts

The third one is rather arbitrary, as we can also optimize for rectangular bounds or a minimal concave hull. In real-world use the material to be cut tends to be rectangular, and those options tend to result in long slivers of un-used material.

Because small mutations in the gene cause potentially large changes in overall fitness, the individuals of the population can be very similar. By caching NFPs new individuals can be evaluated very quickly.

Over successive generations, we hope that beneficial phenotypes are preserved. An example of a beneficial phenotype is placing parts with interlocking patterns:

[img]

# Performance

[img]

Appears to be on-par with commercial software, but may be slower for the initial packing.

# To-do

- Recursive placement (putting parts in holes of other parts)
- Customize fitness function (gravity direction, etc)
- kill worker threads when stop button is clicked
- fix certain edge cases in NFP generation