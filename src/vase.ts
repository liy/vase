/**
 * Constraint the action type
 */
export type BaseAction = {
  type: string;
};

/**
 * Constrain the subscription function name and its parameters
 */
export type Subscription<S, Actions extends BaseAction> = {
  [A in Actions as A["type"]]?: (action: A, newState: S, oldState: S) => void;
};

/**
 * Constrain the reducer function name and its parameters
 */
export type Reducer<S, Actions extends BaseAction> = {
  [A in Actions as A["type"]]?: (action: A, state: S) => S;
};

export type Next<Actions extends BaseAction> = (
  action: Actions
) => Actions | null | undefined;

/**
 * Interceptor is a function which intercepts an action and output another action (usually be the same action). Return nothing will halt the operation
 */
export type Interceptor<Actions extends BaseAction> = (
  next: Next<Actions>
) => Next<Actions>;

export type Operate<Actions extends BaseAction> = (action: Actions) => Actions;

export type Subroutine<
  Actions extends BaseAction,
  StateType,
  ResolveType = void
> = (
  operate: Operate<Actions>,
  state: StateType
) => ResolveType extends void ? void : Promise<ResolveType>;

export class Store<State, Actions extends BaseAction> {
  protected subscriptions: Array<Subscription<State, Actions>> = [];
  private interceptor: Interceptor<Actions>;

  constructor(
    protected state: State,
    protected reducer: Reducer<State, Actions>,
    interceptors: Interceptor<Actions>[] = []
  ) {
    this.interceptor = interceptors.reverse().reduce(
      (a, b) => {
        return (action) => {
          return b(a(action));
        };
      },
      () => {
        return (action) => {
          this.processOperate(action);
        };
      }
    );
  }

  updateReducer(reducer: Reducer<State, Actions>) {
    this.reducer = reducer;
  }

  protected processOperate(action: Actions) {
    // @ts-ignore
    const fn = this.reducer[action.type];
    if (fn) {
      const oldState = this.state;
      this.state = fn(action, this.state);
      this.notify(action, this.state, oldState);
    }

    return action;
  }

  operate(action: Actions) {
    // @ts-ignore
    return this.interceptor()(action);
  }
  /**
   * Start a subroutine
   * @param thunk A subroutine, or a thunk if you familiar with redux.
   * @returns A Promise.
   */
  invoke<ResolveType>(thunk: Subroutine<Actions, State, ResolveType>) {
    if (typeof thunk !== "function") {
      throw new Error(
        "subroutine needs to be a function return a promise, use operate for normal action"
      );
    }
    // @ts-ignore
    return thunk(this.operate.bind(this), this.currentState);
  }

  protected notify(action: Actions, newState: State, oldState: State) {
    for (let subscription of this.subscriptions) {
      // Optional chaining function call
      // @ts-ignore
      subscription[action.type]?.(action, newState, oldState);
    }
  }

  subscribe(sub: Subscription<State, Actions>): () => void {
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
