function isIterable(obj: any) {
  return obj != null && typeof obj[Symbol.iterator] === "function";
}

export default isIterable;
