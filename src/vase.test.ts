import { Interceptor, Reducer, Store, Subroutine } from "./vase";

// Action
type Update = {
  type: "update";
  count: number;
};

type Log = {
  type: "log";
  lastUpdate: Update | null;
};

type Actions = Update | Log;

type MockState = {
  count: number;
  lastUpdate: Update | null;
};

const initialState: MockState = {
  count: 1,
  lastUpdate: null,
};

const mockReducer: Reducer<MockState, Actions> = {
  update(action, state) {
    return {
      ...state,
      count: action.count,
    };
  },
  log(action, state) {
    return {
      ...state,
      lastUpdate: action.lastUpdate,
    };
  },
};

describe("vase", () => {
  it("initialize store state with correct value", () => {
    const store = new Store(initialState, {});
    expect(store.currentState.count).toBe(1);
  });

  it("sync operate produce correct state", () => {
    const store = new Store<MockState, Actions>(initialState, mockReducer);

    store.operate({
      type: "update",
      count: -1,
    });

    expect(store.currentState.count).toBe(-1);
  });

  it("should not modify initial state", () => {
    const store = new Store<MockState, Actions>(initialState, mockReducer);

    store.operate({
      type: "update",
      count: -1,
    });

    expect(initialState.count).toBe(1);
  });

  it("async invoke produce correct state", async () => {
    const store = new Store<MockState, Actions>(initialState, mockReducer);

    function mockThunk(): Subroutine<Actions, MockState> {
      return async (operate) => {
        operate({
          type: "update",
          count: await Promise.resolve(4),
        });
      };
    }

    await store.invoke(mockThunk());
    expect(store.currentState.count).toBe(4);
  });

  it("provide correct event subscription", (done) => {
    const store = new Store<MockState, Actions>(initialState, mockReducer);

    function mockThunk(): Subroutine<Actions, MockState> {
      return async (operate) => {
        operate({
          type: "update",
          count: await Promise.resolve(4),
        });
      };
    }

    store.subscribe({
      update(action, state) {
        expect(action.type).toBe("update");
        expect(action.count).toBe(4);
        expect(state.count).toBe(4);
        expect(store.currentState.count).toBe(4);
        done();
      },
    });

    store.invoke(mockThunk());
  });

  it("Subscription clean up correctly", () => {
    const store = new Store<MockState, Actions>(initialState, mockReducer);

    const mfn = jest.fn();
    const cleanup = store.subscribe({
      update: mfn,
    });

    // remove the subscription before update action
    cleanup();
    store.operate({ type: "update", count: 1 });

    expect(mfn).toBeCalledTimes(0);
  });
});

describe("interceptors", () => {
  it("has correct order", () => {
    const fn1 = jest.fn();
    const i1: Interceptor<any> = (next) => (action: any) => {
      console.log(store);
      fn1();
      next(action);
    };
    const fn2 = jest.fn();
    const i2: Interceptor<any> = (next) => (action: any) => {
      console.log(store);
      fn2();
      next(action);
    };

    const store = new Store(initialState, mockReducer, [i1, i2]);

    store.operate({
      type: "update",
      count: 2,
    });

    expect(fn1).toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
    expect(fn1).toHaveBeenCalledBefore(fn2);
    expect(store.currentState.count).toBe(2);
  });

  it("can halt the action chain", () => {
    const fn = jest.fn();
    const i1 = () => (action: any) => null;
    const i2 = () => (action: any) => fn();

    const store = new Store(initialState, mockReducer, [i1, i2]);

    store.operate({
      type: "update",
      count: 2,
    });

    expect(fn).toHaveBeenCalledTimes(0);
    expect(store.currentState.count).toBe(1);
  });

  it("produce correct state", () => {
    const lastActionMW: Interceptor<Actions> = (next) => (action) => {
      if (action.type !== "log") {
        store.operate({
          type: "log",
          lastUpdate: action,
        });
      }
      return next(action);
    };

    const validateMW: Interceptor<Actions> = (next) => (action) => {
      // halt the action operation if action count is -1
      if (action.type === "update" && action.count === -1) {
        return;
      }
      return next(action);
    };

    const store = new Store(initialState, mockReducer, [
      validateMW,
      lastActionMW,
    ]);

    const validAction: Update = {
      type: "update",
      count: 2,
    };
    store.operate(validAction);
    expect(store.currentState.count).toBe(2);
    expect(store.currentState.lastUpdate).toBe(validAction);

    store.operate({
      type: "update",
      count: -1,
    });

    expect(store.currentState.count).toBe(2);
    expect(store.currentState.lastUpdate).toBe(validAction);
  });
});
