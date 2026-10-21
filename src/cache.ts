import { createCache } from "cache-manager";

const cache = createCache({
  ttl: 10 * 1000,
});

export default cache;
