
export default class DataChannel {
  // data: Float32Array or Int32Array with length divisible by componentCount
  // componentCount: integer 1-4 (x,y,z,w)
  constructor(name, data, componentCount=1, isDirty=true) {
    this.data = data;
    this.name = name;
    this.componentCount = componentCount;
    this.isFloat = data instanceof Float32Array;
    this.isInt = data instanceof Int32Array;
    this.isMultiple = data.length > componentCount;
    this.isDirty = isDirty;
    this.location = null;
  }
  get x() {
    if(this.isMultiple === true) throw new Error('nonconforming');
    return this.data[0];
  }
  set x(value) {
    if(this.isMultiple === true) throw new Error('nonconforming');
    this.data[0] = value;
    this.isDirty = true;
  }
  get y() {
    if(this.isMultiple === true || this.componentCount < 2)
      throw new Error('nonconforming');
    return this.data[1];
  }
  set y(value) {
    if(this.isMultiple === true || this.componentCount < 2)
      throw new Error('nonconforming');
    this.data[1] = value;
    this.isDirty = true;
  }
  get z() {
    if(this.isMultiple === true || this.componentCount < 3)
      throw new Error('nonconforming');
    return this.data[2];
  }
  set z(value) {
    if(this.isMultiple === true || this.componentCount < 3)
      throw new Error('nonconforming');
    this.data[2] = value;
    this.isDirty = true;
  }
  get w() {
    if(this.isMultiple === true || this.componentCount < 4)
      throw new Error('nonconforming');
    return this.data[3];
  }
  set w(value) {
    if(this.isMultiple === true || this.componentCount < 4)
      throw new Error('nonconforming');
    this.data[3] = value;
    this.isDirty = true;
  }
  clone() {
    return new DataChannel(
      this.name,
      this.data.slice(),
      this.componentCount,
      false);
  }
  update(isoview) {
    // Invoked during draw, so be quick!
    if(this.isDirty === false) return;
    if(this.location === null) {
      this.location =
        isoview.gl.getUniformLocation(isoview.program, this.name);
    }
    if(this.isMultiple === true || this.componentCount === 1) {
      isoview.gl[`uniform${
        this.componentCount}${
        this.isFloat ? 'f' : 'i'}${
        this.isMultiple ? 'v' : ''}`]
        (this.location, this.data);
    } else if(this.componentCount === 2) {
      isoview.gl[`uniform${
        this.componentCount}${
        this.isFloat ? 'f' : 'i'}`]
        (this.location, this.data[0], this.data[1]);
    } else if(this.componentCount === 3) {
      isoview.gl[`uniform${
        this.componentCount}${
        this.isFloat ? 'f' : 'i'}`]
        (this.location, this.data[0], this.data[1], this.data[2]);
    } else if(this.componentCount === 4) {
      isoview.gl[`uniform${
        this.componentCount}${
        this.isFloat ? 'f' : 'i'}`]
        (this.location, this.data[0], this.data[1], this.data[2], this.data[3]);
    }
    this.isDirty = false;
  }
}
