import { createCache, memoryStore } from "cache-manager";

const cache = createCache(
  memoryStore({
    ttl: 10 * 1000,
  })
);

export default cache;
