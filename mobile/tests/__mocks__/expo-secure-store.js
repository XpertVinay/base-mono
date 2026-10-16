const store = new Map();

module.exports = {
  setItemAsync: jest.fn(async (key, val) => {
    store.set(key, val);
  }),
  getItemAsync: jest.fn(async (key) => {
    return store.get(key) ?? null;
  }),
  deleteItemAsync: jest.fn(async (key) => {
    store.delete(key);
  }),
  isAvailableAsync: jest.fn(async () => true),
};
