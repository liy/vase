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

export type Next<A = any> = (action: A) => A;

/**
 * Interceptor is a function which intercepts an action and output another action (usually be the same action). Return nothing will halt the operation
 */
export type Interceptor<M extends BaseActionMapping<M>, S = any> = (
  next: Next,
  store: S
) => Next<M[keyof M]>;

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
  private interceptor: Interceptor<M, Store>;

  constructor(
    protected state: State,
    protected reducer: Reducer<M, State>,
    interceptors: Interceptor<M, Store>[] = []
  ) {
    this.interceptor = interceptors.reverse().reduce(
      (a, b) => {
        return (action) => {
          return b(a(action, this), this);
        };
      },
      () => {
        return (action) => {
          this.processOperate(action);
        };
      }
    );
  }

  updateReducer(reducer: Reducer<M, State>) {
    this.reducer = reducer;
  }

  protected processOperate(action: M[keyof M]) {
    const fn = this.reducer[action.type];
    if (fn) {
      const oldState = this.state;
      this.state = fn(action, this.state);
      this.notify(action, this.state, oldState);
    }

    return action;
  }

  operate(action: M[keyof M]) {
    // @ts-ignore
    return this.interceptor()(action);
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
