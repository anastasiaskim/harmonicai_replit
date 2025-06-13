// Mock the Blob API
if (!global.Blob) {
  global.Blob = class Blob {
    constructor(bits, options) {
      this.type = options?.type || '';
      this.size = bits.reduce((acc, bit) => {
        if (bit instanceof ArrayBuffer || ArrayBuffer.isView(bit)) {
          return acc + bit.byteLength;
        }
        return acc + (bit.length || 0);
      }, 0);
      this.bits = bits;
    }
slice(start = 0, end = this.size, contentType = '') {
    // Normalize negative indices
    const normalizedStart = start < 0 ? Math.max(0, this.size + start) : Math.min(this.size, start);
    const normalizedEnd = end < 0 ? Math.max(0, this.size + end) : Math.min(this.size, end);
    
    if (normalizedStart >= normalizedEnd) {
      return new global.Blob([], { type: contentType || this.type });
    }
    
   // For a proper mock, we need to handle byte-level slicing
   // This is a simplified implementation that works for basic testing
   const slicedBits = this.bits;
    return new global.Blob(slicedBits, { type: contentType || this.type });
  }
    async text() {
      // Concatenate all bits as strings and return as a Promise
      return this.bits.map(bit => typeof bit === 'string' ? bit : String(bit)).join('');
    }
  };
}

// Mock the File API
if (!global.File) {
  global.File = class File extends global.Blob {
    constructor(bits, name, options = {}) {
      super(bits, options);
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
      this.type = options.type || '';
    }
    slice(start = 0, end = this.size, contentType = '') {
      // Use Blob's slice
      const slicedBlob = super.slice(start, end, contentType);
      // Return a File with the same name and lastModified
      return new global.File(slicedBlob.bits, this.name, {
        type: contentType || this.type,
        lastModified: this.lastModified,
      });
    }
  };
}

// Add Buffer if not available
if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
} 