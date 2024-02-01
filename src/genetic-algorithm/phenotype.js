export default class Phenotype {
  constructor(placement, rotation) {
    this._placemant = placement;
    this._rotation = rotation;
  }

  cut(cutPoint) {
    return new Phenotype(
      this._placemant.slice(0, cutPoint),
      this._rotation.slice(0, cutPoint)
    );
  }

  clone() {
    return new Phenotype(this._placemant.slice(), this._rotation.slice());
  }

  contains(id) {
    let i = 0;
    const size = this.size;

    for (i = 0; i < size; ++i) {
      if (this._placemant[i].id === id) {
        return true;
      }
    }

    return false;
  }

  mate(phenotype) {
    let i = 0;
    let placement = phenotype.placement[0];
    let rotation = phenotype.rotation[0];

    for (i = 0; i < phenotype.size; ++i) {
      placement = phenotype.placement[i];
      rotation = phenotype.rotation[i];

      if (!this.contains(placement.id)) {
        this._placemant.push(placement);
        this._rotation.push(rotation);
      }
    }
  }

  get placement() {
    return this._placemant;
  }

  get rotation() {
    return this._rotation;
  }

  get size() {
    return this._placemant.length;
  }
}
