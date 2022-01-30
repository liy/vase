/**
 * Constraint the action type
 */
export type BaseAction<M> = {
  type: keyof M;
};

/**
 * Constraints key of the mapping needs to be the type of the action(base action)
 */
export type BaseActionMapping<M> = Record<keyof M, BaseAction<M>>;

/**
 * Constrain the subscription function name and its parameters
 */
export type Subscription<M extends BaseActionMapping<M>, S = any> = {
  [K in keyof M]?: (
    action: Readonly<M[K]>,
    newState: Readonly<S>,
    oldState: Readonly<S>
  ) => void;
};

/**
 * Constrain the reducer function name and its parameters
 */
export type Reducer<M extends BaseActionMapping<M>, S = any> = {
  [K in keyof M]?: (action: Readonly<M[K]>, state: Readonly<S>) => S;
};

/**
 * Interceptor is a function which intercepts an action and output another action (usually be the same action). Return nothing will halt the operation
 */
export type Interceptor<
  M extends BaseActionMapping<M>,
  State,
  ST extends Store<M, State>
> = (
  action: Readonly<M[keyof M]>,
  store: ST
) => Readonly<M[keyof M]> | undefined | null;

export type Operate<M extends BaseActionMapping<M>> = (
  action: M[keyof M]
) => M[keyof M] | undefined;

export type Subroutine<
  M extends BaseActionMapping<M>,
  StateType,
  ResolveType = void
> = (
  operate: Operate<M>,
  state: StateType
) => ResolveType extends void ? void : Promise<ResolveType>;

export class Store<M extends BaseActionMapping<M> = any, State = any> {
  protected subscriptions: Array<Subscription<M, State>> = [];
  private interceptor: Interceptor<M, State, Store<M, State>>;

  constructor(
    protected state: State,
    protected reducer: Reducer<M, State>,
    interceptors: Interceptor<M, State, Store<M, State>>[] = []
  ) {
    this.interceptor = interceptors.reverse().reduce(
      (a, b) => {
        return (action, store) => {
          const newAction = b(action, store);
          if (newAction) {
            return a(newAction, store);
          }
        };
      },
      // initial dummy pass through function so we don't get conditional check in operate
      (action) => action
    );
  }

  updateReducer(reducer: Reducer<M, State>) {
    this.reducer = reducer;
  }

  operate(action: M[keyof M]) {
    const newAction = this.interceptor(action, this);
    // Halt the operate if action is not valid anymore
    if (!newAction) return;

    const fn = this.reducer[newAction.type];
    if (fn) {
      const oldState = this.state;
      this.state = fn(newAction, this.state);
      this.notify(newAction, this.state, oldState);
    }

    return action;
  }
  /**
   * Start a subroutine
   * @param thunk A subroutine, or a thunk if you familiar with redux.
   * @returns A Promise.
   */
  invoke<ResolveType>(thunk: Subroutine<M, State, ResolveType>) {
    if (typeof thunk !== "function") {
      throw new Error(
        "subroutine needs to be a function return a promise, use operate for normal action"
      );
    }
    return thunk(this.operate.bind(this), this.currentState);
  }

  protected notify(
    action: Readonly<M[keyof M]>,
    newState: Readonly<State>,
    oldState: Readonly<State>
  ) {
    for (let subscription of this.subscriptions) {
      // Optional chaining function call
      subscription[action.type]?.(action, newState, oldState);
    }
  }

  subscribe(sub: Subscription<M, State>): () => void {
    this.subscriptions.push(sub);

    return () => {
      const temp = [...this.subscriptions];
      const index = temp.indexOf(sub);
      temp.splice(index, 1);
      this.subscriptions = temp;
    };
  }

  get currentState() {
    return this.state;
  }
}
