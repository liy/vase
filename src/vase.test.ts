import { Middleware, Reducer, Store, Subroutine } from "./vase";

// Action
type Update = {
  type: "update";
  count: number;
};

type Log = {
  type: "log";
  lastUpdate: Update | null;
};

// action mapping
interface MockActionMapping {
  update: Update;
  log: Log;
}

type MockState = {
  count: number;
  lastUpdate: Update | null;
};

const initialState: MockState = {
  count: 1,
  lastUpdate: null,
};

const mockReducer: Reducer<MockActionMapping, MockState> = {
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
    const store = new Store<MockActionMapping>({ count: 1 }, mockReducer);

    store.operate({
      type: "update",
      count: -1,
    });

    expect(store.currentState.count).toBe(-1);
  });

  it("should not modify initial state", () => {
    const store = new Store<MockActionMapping>({ count: 1 }, mockReducer);

    store.operate({
      type: "update",
      count: -1,
    });

    expect(initialState.count).toBe(1);
  });

  it("async invoke produce correct state", async () => {
    const store = new Store<MockActionMapping, MockState>(
      initialState,
      mockReducer
    );

    function mockThunk(): Subroutine<MockActionMapping, MockState> {
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
    const store = new Store<MockActionMapping, MockState>(
      initialState,
      mockReducer
    );

    function mockThunk(): Subroutine<MockActionMapping, MockState> {
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
    const store = new Store<MockActionMapping, MockState>(
      initialState,
      mockReducer
    );

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

describe("middleware", () => {
  it("has correct order", () => {
    const m1 = jest.fn((action) => action);
    const m2 = jest.fn((action) => action);

    const store = new Store(initialState, mockReducer, [m1, m2]);

    store.operate({
      type: "update",
      count: 2,
    });

    expect(m1).toHaveBeenCalled();
    expect(m2).toHaveBeenCalled();
    expect(m1).toHaveBeenCalledBefore(m2);
    expect(store.currentState.count).toBe(2);
  });

  it("can halt the action chain", () => {
    const m1 = jest.fn();
    const m2 = jest.fn((action) => action);

    const store = new Store(initialState, mockReducer, [m1, m2]);

    store.operate({
      type: "update",
      count: 2,
    });

    expect(m2).toHaveBeenCalledTimes(0);
    expect(m1).toHaveBeenCalledBefore(m2);
    expect(store.currentState.count).toBe(1);
  });

  it("produce correct state", () => {
    const lastActionMW: Middleware<
      MockActionMapping,
      MockState,
      Store<MockActionMapping, MockState>
    > = (action, store) => {
      if (action.type !== "log") {
        store.operate({
          type: "log",
          lastUpdate: action,
        });
      }
      return action;
    };

    const validateMW: Middleware<
      MockActionMapping,
      MockState,
      Store<MockActionMapping, MockState>
    > = (action, _) => {
      // halt the action operation if action count is -1
      if (action.type === "update" && action.count === -1) {
        return null;
      }
      return action;
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
