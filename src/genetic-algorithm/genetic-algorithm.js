function shuffleArray(array) {
  const lastIndex = array.length - 1;
  let i = 0;
  let j = 0;
  let temp;

  for (i = lastIndex; i > 0; --i) {
    j = Math.floor(Math.random() * (i + 1));
    temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }

  return array;
}

class GeneticAlgorithm {
  constructor(adam, bin, config) {
    this.config = config || {
      populationSize: 10,
      mutationRate: 10,
      rotations: 4,
    };
    this.binBounds = GeometryUtil.getPolygonBounds(bin);

    // population is an array of individuals. Each individual is a object representing the order of insertion and the angle each part is rotated
    const angles = [];
    let i = 0;
    let mutant;
    for (i = 0; i < adam.length; ++i) {
      angles.push(this.randomAngle(adam[i]));
    }

    this.population = [new Phenotype(adam, angles)];

    while (this.population.length < config.populationSize) {
      mutant = this.mutate(this.population[0]);
      this.population.push(mutant);
    }
  }

  // returns a random angle of insertion
  randomAngle(part) {
    const angleCount = Math.max(this.config.rotations, 1);
    let angleList = [];
    let i = 0;
    let rotatedPart;

    for (i = 0; i < angleCount; ++i) {
      angleList.push(i * (360 / angleCount));
    }

    angleList = shuffleArray(angleList);

    for (i = 0; i < angleCount; ++i) {
      rotatedPart = GeometryUtil.rotatePolygon(part, angleList[i]);

      // don't use obviously bad angles where the part doesn't fit in the bin
      if (
        rotatedPart.width < this.binBounds.width &&
        rotatedPart.height < this.binBounds.height
      ) {
        return angleList[i];
      }
    }

    return 0;
  }

  // returns a mutated individual with the given mutation rate
  mutate(individual) {
    const trashold = 0.01 * this.config.mutationRate;
    const clone = individual.clone();
    const size = clone.size;
    let i = 0;
    let j = 0;
    let rand = 0;
    let placement;

    for (i = 0; i < size; ++i) {
      rand = Math.random();

      if (rand < trashold) {
        // swap current part with next part
        j = i + 1;

        if (j < size) {
          placement = clone.placement[i];
          clone.placement[i] = clone.placement[j];
          clone.placement[j] = placement;
        }
      }

      rand = Math.random();
      if (rand < trashold) {
        clone.rotation[i] = this.randomAngle(clone.placement[i]);
      }
    }

    return clone;
  }

  // single point crossover
  mate(male, female) {
    const cutPoint = Math.round(
      Math.min(Math.max(Math.random(), 0.1), 0.9) * (male.placement.length - 1)
    );
    const result = [male.cut(cutPoint), female.cut(cutPoint)];

    result[0].mate(female);
    result[1].mate(male);

    return result;
  }

  generation() {
    // Individuals with higher fitness are more likely to be selected for mating
    this.population.sort((a, b) => a.fitness - b.fitness);

    // fittest individual is preserved in the new generation (elitism)
    const result = [this.population[0]];
    const currentSize = this.population.length;
    let male;
    let female;
    let children;

    while (result.length < currentSize) {
      male = this.randomWeightedIndividual();
      female = this.randomWeightedIndividual(male);

      // each mating produces two children
      children = this.mate(male, female);

      // slightly mutate children
      result.push(this.mutate(children[0]));

      if (result.length < currentSize) {
        result.push(this.mutate(children[1]));
      }
    }

    this.population = result;
  }

  // returns a random individual from the population, weighted to the front of the list (lower fitness value is more likely to be selected)
  randomWeightedIndividual(exclude) {
    const localPopulation = this.population.slice();
    const excludeIndex = exclude ? localPopulation.indexOf(exclude) : -1;

    if (excludeIndex >= 0) {
      localPopulation.splice(excludeIndex, 1);
    }

    const size = localPopulation.length;
    const rand = Math.random();
    const weight = 2 / size;
    let lower = 0;
    let upper = weight / 2;
    let i = 0;

    for (i = 0; i < size; ++i) {
      // if the random number falls between lower and upper bounds, select this individual
      if (rand > lower && rand < upper) {
        return localPopulation[i];
      }

      lower = upper;
      upper += weight * ((size - i) / size);
    }

    return localPopulation[0];
  }
}
